import { clamp } from "../lib/colors";
import { extractExcept, refersToAllLights } from "../lib/devices";
import { formatClock, formatDateLong } from "../lib/time";
import { tryEasterEgg } from "./eggs";
import { extractEntities, namedPerson, parseDuration, resolveScene, type Entities } from "./entities";
import { tryGame } from "./games";
import { INTENTS } from "./intents";
import { resetMatcher } from "./matcher";
import { formatNumber, looksLikeMath, tryEvaluate } from "./math";
import { hasAnaphora, isWakeOnly, normalizeUtterance, splitClauses } from "./normalize";
import { converse } from "./converse";
import { CAPABILITY_MIN, CONVERSATION_MIN, scoreRoute } from "./frames";
import {
  CONTEXT_TTL_MS,
  ConversationContext,
  ClauseResult,
  ProcessResult,
  RoomAction,
  RoomSnapshot,
  emptyContext,
} from "./types";

resetMatcher(INTENTS);

const pick = (opts: string[]) => opts[Math.floor(Math.random() * opts.length)];

function contextFresh(ctx: ConversationContext) {
  return Date.now() - ctx.updatedAt < CONTEXT_TTL_MS;
}

function isQuestion(text: string) {
  return /^(is|are|am|was|were|do|does|did|what|whats|how|which|who|when|where|why)\b/.test(text);
}

function lightIds(snap: RoomSnapshot, e: Entities, ctx: ConversationContext, text: string): string[] {
  if (e.exceptId) {
    return snap.lights.filter((l) => l.id !== e.exceptId).map((l) => l.id);
  }
  const explicit = e.deviceIds.filter((id) => snap.lights.some((l) => l.id === id));
  if (explicit.length) return explicit;
  if (refersToAllLights(text) || /\b(lights|everything|room)\b/.test(text)) {
    return snap.lights.map((l) => l.id);
  }
  if (contextFresh(ctx) && ctx.lastDomain === "lights" && ctx.lastDeviceIds.length) {
    return ctx.lastDeviceIds;
  }
  return snap.lights.map((l) => l.id);
}

function names(snap: RoomSnapshot, ids: string[]) {
  if (ids.length === snap.lights.length) return "Lights";
  return ids
    .map((id) => snap.lights.find((l) => l.id === id)?.name ?? id)
    .join(", ");
}

function alreadyPower(snap: RoomSnapshot, ids: string[], on: boolean) {
  return ids.every((id) => {
    const l = snap.lights.find((x) => x.id === id);
    return l ? l.on === on : true;
  });
}

function teachRoutine(text: string): { phrase: string; command: string } | null {
  const quoted = text.match(/^when i (?:say|say the words)\s+["']([^"']+)["']\s*,?\s*(.+)$/);
  if (quoted) return { phrase: quoted[1].trim(), command: quoted[2].trim() };
  const m = text.match(/^when i (?:say|say the words)\s+(.+?)\s*,\s*(.+)$/);
  if (!m) return null;
  return { phrase: m[1].replace(/^to\s+/, "").trim(), command: m[2].trim() };
}

function matchRoutine(snap: RoomSnapshot, text: string) {
  const t = text.toLowerCase();
  return snap.routines.find((r) => r.phrases.some((p) => t === p || t.includes(p)));
}

function weatherLine(snap: RoomSnapshot, offset = 0) {
  const w = snap.weather;
  if (offset === 1 && w.daily?.[1]) {
    const d = w.daily[1];
    return `Tomorrow: ${d.condition}, ${d.low} to ${d.high} degrees.`;
  }
  return `${w.temp}° in ${w.location}, ${w.condition}. ${w.precipNote}.`;
}

function rainLine(snap: RoomSnapshot) {
  const soon = snap.weather.hourly.find((h) => h.precip >= 50);
  if (/rain/i.test(snap.weather.condition) && (snap.weather.hourly[0]?.precip ?? 50) >= 40) {
    return `It's raining. ${snap.weather.temp}°.`;
  }
  if (soon) return `Rain around ${soon.hour}.`;
  if (/rain/i.test(snap.weather.precipNote)) return snap.weather.precipNote.endsWith(".")
    ? snap.weather.precipNote
    : `${snap.weather.precipNote}.`;
  return "No rain in the next few hours.";
}

function weekendLine(snap: RoomSnapshot) {
  const days = snap.weather.daily ?? [];
  if (days.length >= 2) {
    const rest = days.slice(0, 3).map((d) => `${d.label}: ${d.condition}, ${d.low} to ${d.high}`).join(". ");
    return rest.endsWith(".") ? rest : `${rest}.`;
  }
  return weatherLine(snap, 1);
}

function laterTodayLine(snap: RoomSnapshot) {
  const later = snap.weather.hourly.slice(0, 4);
  if (!later.length) return weatherLine(snap, 0);
  const wet = later.find((h) => h.precip >= 50);
  if (wet) return `Rain around ${wet.hour}. ${wet.temp}°.`;
  const last = later[later.length - 1];
  return `Later: ${last.condition}, ${last.temp}°.`;
}

function lightsStatusLine(snap: RoomSnapshot, text: string) {
  if (/\bscene\b/.test(text)) return `${snap.scene}.`;
  if (/\bhow bright\b/.test(text)) {
    const on = snap.lights.filter((l) => l.on);
    if (!on.length) return "They're off.";
    const avg = Math.round(on.reduce((s, l) => s + l.brightness, 0) / on.length);
    return `${avg} percent.`;
  }
  const on = snap.lights.filter((l) => l.on);
  const off = snap.lights.filter((l) => !l.on);
  if (/\bwhich\b/.test(text) && /\boff\b/.test(text)) {
    if (!off.length) return "None off.";
    return `${off.map((l) => l.name).join(", ")} off.`;
  }
  if (!on.length) return "All off.";
  if (off.length === 0) return "All on.";
  return `${on.map((l) => l.name).join(", ")} on. ${off.map((l) => l.name).join(", ")} off.`;
}

function timerListLine(snap: RoomSnapshot) {
  if (!snap.timers.length) return "No timers.";
  return snap.timers
    .map((t) => {
      const mins = Math.max(0, Math.round((t.fireAt - Date.now()) / 60_000));
      if (mins <= 0) return `${t.name} is due.`;
      if (mins === 1) return `${t.name} in 1 min.`;
      if (mins >= 60) {
        const h = Math.round(mins / 60);
        return `${t.name} in ${h} hour${h === 1 ? "" : "s"}.`;
      }
      return `${t.name} in ${mins} min.`;
    })
    .join(" ");
}

function hello(): ClauseResult {
  const empty: Entities = { deviceIds: [] };
  return ok("social.hello", 1, empty, pick(["Hey.", "Hi.", "Yeah?"]), []);
}

function dispatch(
  text: string,
  snap: RoomSnapshot,
  ctx: ConversationContext
): ClauseResult {
  const e = extractEntities(text);

  if (isWakeOnly(text) || /^(hey|hi|hello|yo)$/.test(text)) {
    return tagged(hello(), "capability", []);
  }

  if (
    /^(do that again|do it again|once more)$/.test(text) &&
    ctx.lastUtterance &&
    ctx.lastUtterance !== text
  ) {
    return dispatch(ctx.lastUtterance, snap, { ...ctx, lastUtterance: undefined });
  }

  const egg = tryEasterEgg(text);
  if (egg) {
    return tagged(ok("easter.egg", 0.99, e, egg, []), "egg", []);
  }

  const mathHit =
    tryEvaluate(text, ctx.lastMath) ??
    (looksLikeMath(text) ? tryEvaluate(text) : null);
  if (mathHit && (looksLikeMath(text) || (ctx.lastDomain === "math" && contextFresh(ctx)))) {
    const response = `${formatNumber(mathHit.value)}.`;
    return {
      ...tagged(ok("math.calculate", 0.95, e, response, []), "math", []),
      lastMath: mathHit.value,
    };
  }

  const game = tryGame(text, ctx);
  if (game) {
    return {
      ...ok(game.intent, 0.94, e, game.response, []),
      game: game.game,
      gameTouched: true,
    };
  }

  const taught = teachRoutine(text);
  if (taught) {
    return ok("routine.teach", 0.96, e, `I'll do that when you say "${taught.phrase}".`, [
      { type: "routine.create", phrase: taught.phrase, command: taught.command },
    ]);
  }

  const delayed = parseDelayed(text);
  if (delayed) {
    return ok("delayed.action", 0.9, e, `In ${delayed.label}.`, [
      { type: "timer.create", name: delayed.label, durationMs: delayed.ms, fireText: delayed.command },
    ]);
  }

  const routine = matchRoutine(snap, text);
  if (routine && !/\bwhen i say\b/.test(text)) {
    if (routine.command) {
      const inner = processUtterance(routine.command, snap, ctx);
      return ok("routine.run", 0.95, e, inner.response, inner.actions, { usedContext: inner.usedContext });
    }
    if (routine.actions?.length) {
      return ok("routine.run", 0.95, e, `${routine.name}.`, routine.actions);
    }
  }

  const routed = scoreRoute(text);
  const candidates = routed.candidates;
  let intentName = routed.capability?.name ?? null;
  let confidence = routed.capability?.confidence ?? 0;
  let usedContext = false;
  const domain = routed.capability?.domain;

  const anaphora = hasAnaphora(text);
  if (anaphora && contextFresh(ctx) && ctx.lastDomain) {
    const follow = followUp(text, e, snap, ctx);
    if (follow) return tagged(follow, "context", candidates);
  }

  if ((!intentName || confidence < CAPABILITY_MIN) && contextFresh(ctx) && ctx.lastDomain) {
    const follow = followUp(text, e, snap, ctx);
    if (follow) return tagged(follow, "context", candidates);
  }

  if (contextFresh(ctx) && ctx.lastRelative && /^(a bit |a little )?(more|less)$/.test(text)) {
    const follow = relativeNudge(text, e, snap, ctx);
    if (follow) return tagged(follow, "context", candidates);
  }

  if (anaphora && contextFresh(ctx) && ctx.lastDomain === "lights") {
    usedContext = true;
    if (!intentName || confidence < CAPABILITY_MIN) {
      if (/\b(darker|dimmer|brighter)\b/.test(text)) intentName = "lights.relative";
      else if (e.color) intentName = "lights.color";
      else if (/\b(warmer|cooler)\b/.test(text)) intentName = "lights.temp";
      if (intentName) confidence = Math.max(confidence, 0.8);
    }
  }

  if (/\bwhat about tomorrow\b/.test(text) && contextFresh(ctx) && ctx.lastDomain === "weather") {
    return tagged(
      ok("weather.query", 0.9, { ...e, dayOffset: 1 }, weatherLine(snap, 1), [], { usedContext: true }),
      "context",
      candidates
    );
  }

  if (intentName && confidence >= CAPABILITY_MIN) {
    return tagged(
      runIntent(intentName, text, e, snap, ctx, confidence, usedContext, domain),
      "capability",
      candidates
    );
  }

  if (routed.conversation && routed.conversation.confidence >= CONVERSATION_MIN) {
    const reply = converse(routed.conversation.act, text, ctx, routed.conversation.entity || e.person);
    return tagged(
      ok(`talk.${routed.conversation.act}`, routed.conversation.confidence, e, reply, []),
      "conversation",
      candidates
    );
  }

  if (!intentName || confidence < CAPABILITY_MIN) {
    const guess = heuristic(text, e, snap, ctx);
    if (guess) return tagged(guess, "capability", candidates);
    const reply = converse("unsupported", text, ctx);
    return tagged(ok("talk.fallback", confidence, e, reply, []), "conversation", candidates);
  }

  return tagged(
    runIntent(intentName, text, e, snap, ctx, confidence, usedContext, domain),
    "capability",
    candidates
  );
}

function tagged(
  clause: ClauseResult,
  route: string,
  candidates: { name: string; confidence: number; source: string }[]
): ClauseResult {
  return { ...clause, route, candidates };
}

function relativeNudge(
  text: string,
  e: Entities,
  snap: RoomSnapshot,
  ctx: ConversationContext
): ClauseResult | null {
  const rel = ctx.lastRelative;
  if (!rel || !contextFresh(ctx)) return null;
  const less = /\bless\b/.test(text);
  const sign = (less ? -rel.sign : rel.sign) as 1 | -1;
  const amount = 10;
  if (rel.kind === "brightness") {
    return ok("lights.relative", 0.9, e, sign < 0 ? "Dimmer." : "Brighter.", [
      { type: "lights.brightness", ids: lightIds(snap, e, ctx, text), value: amount * sign, relative: true },
    ], { usedContext: true, deviceIds: lightIds(snap, e, ctx, text), lastRelative: { kind: "brightness", sign } });
  }
  if (rel.kind === "volume") {
    return ok("media.volume", 0.9, e, sign < 0 ? "Quieter." : "Louder.", [
      { type: "media.volume", value: amount * sign, relative: true },
    ], { usedContext: true, lastRelative: { kind: "volume", sign } });
  }
  if (rel.kind === "temp") {
    return ok("lights.temp", 0.9, e, sign > 0 ? "Cooler." : "Warmer.", [
      { type: "lights.colorTemp", ids: lightIds(snap, e, ctx, text), value: 400 * sign, relative: true },
    ], { usedContext: true, deviceIds: lightIds(snap, e, ctx, text), lastRelative: { kind: "temp", sign } });
  }
  return null;
}

function followUp(
  text: string,
  e: Entities,
  snap: RoomSnapshot,
  ctx: ConversationContext
): ClauseResult | null {
  const nudge = relativeNudge(text, e, snap, ctx);
  if (nudge) return nudge;
  if (/^(the )?other way$/.test(text) && ctx.lastRelative) {
    const flipped = { ...ctx, lastRelative: { ...ctx.lastRelative, sign: -ctx.lastRelative.sign as 1 | -1 } };
    return relativeNudge("a bit more", e, snap, flipped);
  }
  if (ctx.lastDomain === "weather") {
    if (/\btomorrow\b/.test(text) || /\bwhat about\b/.test(text)) {
      return ok("weather.query", 0.88, e, weatherLine(snap, 1), [], { usedContext: true });
    }
    if (/\brain\b/.test(text)) {
      return ok("weather.query", 0.88, e, rainLine(snap), [], { usedContext: true });
    }
    if (/\bweekend\b/.test(text)) {
      return ok("weather.query", 0.88, e, weekendLine(snap), [], { usedContext: true });
    }
  }
  if (ctx.lastDomain === "lights") {
    if (/\b(darker|dimmer|brighter)\b/.test(text)) {
      return runIntent("lights.relative", text, e, snap, ctx, 0.86, true, "lights");
    }
    if (e.color) return runIntent("lights.color", text, e, snap, ctx, 0.86, true, "lights");
    if (/\b(warmer|cooler)\b/.test(text)) {
      return runIntent("lights.temp", text, e, snap, ctx, 0.86, true, "lights");
    }
    if (e.on != null && !isQuestion(text)) return runIntent("lights.power", text, e, snap, ctx, 0.84, true, "lights");
  }
  if (ctx.lastDomain === "media") {
    if (/\b(louder|quieter|up|down)\b/.test(text)) {
      return runIntent("media.volume", text, e, snap, ctx, 0.84, true, "media");
    }
    if (/\b(skip|next)\b/.test(text)) {
      return runIntent("media.skip", text, e, snap, ctx, 0.84, true, "media");
    }
    if (/\b(mute|unmute|silence)\b/.test(text)) {
      return runIntent("media.mute", text, e, snap, ctx, 0.84, true, "media");
    }
  }
  return null;
}

function heuristic(text: string, e: Entities, snap: RoomSnapshot, ctx: ConversationContext): ClauseResult | null {
  if (isQuestion(text) && /\b(you|your|nova|siri|alexa)\b/.test(text) && !/\blights?\b/.test(text)) {
    return null;
  }
  if (isQuestion(text) && /\blights?\b/.test(text)) {
    return runIntent("lights.status", text, e, snap, ctx, 0.82, false, "lights");
  }
  if (/\b(dark|lights out|pitch black)\b/.test(text) && !/\bbrighter\b/.test(text) && !isQuestion(text)) {
    return runIntent("lights.power", text, { ...e, on: false }, snap, ctx, 0.8, false, "lights");
  }
  if (e.on != null && !isQuestion(text) && (refersToAllLights(text) || e.deviceIds.length || /\blights?\b/.test(text))) {
    return runIntent("lights.power", text, e, snap, ctx, 0.78, false, "lights");
  }
  if (e.percent != null && (e.deviceIds.length || /\blights?\b/.test(text)) && !/\bvolume\b/.test(text)) {
    return runIntent("lights.brightness", text, e, snap, ctx, 0.8, false, "lights");
  }
  if (e.color && /\b(light|lights|led|them)\b/.test(text)) {
    return runIntent("lights.color", text, e, snap, ctx, 0.8, false, "lights");
  }
  if (/\b(mute|unmute)\b/.test(text)) {
    return runIntent("media.mute", text, e, snap, ctx, 0.8, false, "media");
  }
  if (/\b(air quality|aqi|filter)\b/.test(text)) {
    return runIntent("air.query", text, e, snap, ctx, 0.8, false, "purifier");
  }
  if (/\b(temperature|weather|forecast|rain)\b/.test(text)) {
    return runIntent("weather.query", text, e, snap, ctx, 0.75, false, "weather");
  }
  return null;
}

function parseDelayed(text: string): { ms: number; label: string; command: string } | null {
  const m = text.match(/^(.*)\s+in\s+(.+)$/);
  if (!m) return null;
  const command = m[1].trim();
  const rest = m[2].trim();
  if (!command || /^(a|an)$/.test(command)) return null;
  if (/\b(timer|remind|alarm)\b/.test(command)) return null;
  const ms = parseDuration("in " + rest) ?? parseDuration(rest);
  if (!ms) return null;
  const looksLikeAction = /\b(turn|set|play|pause|off|on|dim|lights|music|purifier|mute)\b/.test(command);
  if (!looksLikeAction) return null;
  const mins = Math.round(ms / 60000);
  return { ms, label: mins >= 60 ? `${Math.round(mins / 60)} hour` : `${mins} min`, command };
}

function runIntent(
  intent: string,
  text: string,
  e: Entities,
  snap: RoomSnapshot,
  ctx: ConversationContext,
  confidence: number,
  usedContext: boolean,
  _domain?: string
): ClauseResult {
  const ids = lightIds(snap, e, ctx, text);

  switch (intent) {
    case "assistant.stop":
      return ok(intent, 1, e, "Okay.", []);
    case "assistant.undo":
      return ok(intent, 1, e, "Undoing.", []);
    case "assistant.repeat": {
      const last = ctx.lastResponse?.trim();
      if (!last) return ok(intent, 1, e, "Nothing to repeat.", []);
      return ok(intent, 1, e, last, []);
    }
    case "assistant.again": {
      if (ctx.lastUtterance && ctx.lastUtterance !== text) {
        return dispatch(ctx.lastUtterance, snap, { ...ctx, lastUtterance: undefined });
      }
      return fail(intent, confidence, e, "Nothing to redo.");
    }
    case "assistant.why": {
      const last = snap.lastActivity;
      if (!last) return ok(intent, 0.9, e, "Nothing recent to explain.", []);
      return ok(intent, 0.9, e, last.title, []);
    }
    case "lights.status":
      return ok(intent, confidence, e, lightsStatusLine(snap, text), [], { usedContext, deviceIds: ids });
    case "lights.power": {
      if (isQuestion(text)) {
        return ok("lights.status", confidence, e, lightsStatusLine(snap, text), [], { usedContext, deviceIds: ids });
      }
      let on = e.on;
      if (on == null) {
        if (/\b(darker|dimmer)\b/.test(text)) {
          /* not a power command */
        } else if (/\b(dark|kill|off|out|cannot see)\b/.test(text) && !/\boutside\b/.test(text)) on = false;
        else if (/\bon\b/.test(text)) on = true;
      }
      if (on == null) {
        return fail(intent, confidence, e, "On or off?");
      }
      const except = extractExcept(text);
      const target = except ? snap.lights.filter((l) => l.id !== except.id).map((l) => l.id) : ids;
      if (alreadyPower(snap, target, on)) {
        return ok(intent, confidence, e, on ? "They're already on." : "They're already off.", [], {
          usedContext,
        });
      }
      const actions: RoomAction[] = [{ type: "lights.power", ids: target, on }];
      if (except && on === false) {
        actions.push({ type: "lights.power", ids: [except.id], on: true });
      }
      const label = except ? `Everything off except ${except.name}.` : on ? `${names(snap, target)} on.` : `${names(snap, target)} off.`;
      return ok(intent, confidence, e, label, actions, { usedContext, deviceIds: target });
    }
    case "lights.brightness": {
      let value = e.percent;
      if (value == null) {
        if (/\bdim\b/.test(text) && !/\bdimmer\b/.test(text)) value = 22;
        else if (/\b(full|max|maximum|brightest)\b/.test(text)) value = 100;
        else if (/\bhalf/.test(text)) value = 50;
        else value = 50;
      }
      value = clamp(value, 0, 100);
      return ok(intent, confidence, e, `${names(snap, ids)} at ${value}%.`, [
        { type: "lights.brightness", ids, value },
      ], { usedContext, deviceIds: ids });
    }
    case "lights.relative": {
      const darker = /\b(darker|dimmer|down|decrease|less)\b/.test(text);
      const delta = (e.relative ?? 15) * (darker ? -1 : 1);
      const sign = (darker ? -1 : 1) as 1 | -1;
      return ok(intent, confidence, e, darker ? "Dimmer." : "Brighter.", [
        { type: "lights.brightness", ids, value: delta, relative: true },
      ], { usedContext, deviceIds: ids, lastRelative: { kind: "brightness", sign } });
    }
    case "lights.color": {
      if (!e.color) {
        return {
          intent,
          confidence,
          entities: e as unknown as Record<string, unknown>,
          actions: [],
          response: "Which colour?",
          success: false,
          usedContext,
          clarification: "color",
        };
      }
      return ok(intent, confidence, e, `${names(snap, ids)} set.`, [
        { type: "lights.color", ids, color: e.color },
      ], { usedContext, deviceIds: ids });
    }
    case "lights.temp": {
      const cooler = /\bcooler\b/.test(text);
      const delta = (e.relative ?? 400) * (cooler ? 1 : -1);
      const sign = (cooler ? 1 : -1) as 1 | -1;
      return ok(intent, confidence, e, cooler ? "Cooler." : "Warmer.", [
        { type: "lights.colorTemp", ids, value: delta, relative: true },
      ], { usedContext, deviceIds: ids, lastRelative: { kind: "temp", sign } });
    }
    case "lights.scene": {
      const scene = e.scene || resolveScene(text);
      if (!scene) {
        return fail(intent, confidence, e, "Which scene?");
      }
      return ok(intent, confidence, e, `${scene}.`, [{ type: "lights.scene", scene }], { usedContext });
    }
    case "media.play": {
      const pause = /\b(pause|stop)\b/.test(text) && !/\bunpause\b/.test(text);
      if (pause && !snap.media.playing) return ok(intent, confidence, e, "Already paused.", []);
      if (!pause && snap.media.playing && !/\bplay\b|\bresume\b/.test(text)) {
        return ok(intent, confidence, e, "Already playing.", []);
      }
      const playing = !pause;
      const track = snap.media.queue[snap.media.trackIndex];
      return ok(intent, confidence, e, playing ? `Playing ${track.title}.` : "Paused.", [
        { type: "media.play", playing },
      ]);
    }
    case "media.skip": {
      const prev = /\b(previous|last|back)\b/.test(text);
      return ok(intent, confidence, e, prev ? "Previous." : "Next.", [
        { type: "media.skip", direction: prev ? "prev" : "next" },
      ]);
    }
    case "media.mute": {
      const unmute = /\bunmute\b/.test(text);
      if (!unmute && snap.media.volume === 0) return ok(intent, confidence, e, "Already muted.", []);
      if (unmute && snap.media.volume > 0) return ok(intent, confidence, e, "Not muted.", []);
      return ok(intent, confidence, e, unmute ? "Unmuted." : "Muted.", [
        { type: "media.mute", on: !unmute },
      ]);
    }
    case "media.volume": {
      const down = /\b(quieter|down|decrease|less)\b/.test(text);
      if (e.percent != null && !/\b(louder|quieter|up|down)\b/.test(text)) {
        return ok(intent, confidence, e, `Volume ${e.percent}.`, [
          { type: "media.volume", value: e.percent },
        ]);
      }
      const delta = (e.relative ?? 10) * (down ? -1 : 1);
      const sign = (down ? -1 : 1) as 1 | -1;
      return ok(intent, confidence, e, down ? "Quieter." : "Louder.", [
        { type: "media.volume", value: delta, relative: true },
      ], { lastRelative: { kind: "volume", sign } });
    }
    case "media.now": {
      if (/\bvolume\b|\bloud\b/.test(text)) {
        return ok(intent, confidence, e, `Volume ${snap.media.volume}.`, []);
      }
      const t = snap.media.queue[snap.media.trackIndex];
      const playing = snap.media.playing ? "" : "Paused. ";
      return ok(intent, confidence, e, `${playing}${t.title} by ${t.artist}.`, []);
    }
    case "purifier.control": {
      if (/\b(auto|sleep|manual)\b/.test(text)) {
        const mode = (text.match(/\b(auto|sleep|manual)\b/)?.[1] ?? "auto") as "auto" | "sleep" | "manual";
        return ok(intent, confidence, e, `Purifier ${mode}.`, [{ type: "purifier.mode", mode }]);
      }
      if (e.percent != null && /\b(fan|speed)\b/.test(text)) {
        return ok(intent, confidence, e, `Fan ${e.percent}%.`, [{ type: "purifier.fan", value: e.percent }]);
      }
      const on = e.on ?? !/\boff\b/.test(text);
      if (snap.purifier.on === on) {
        return ok(intent, confidence, e, on ? "Purifier is already on." : "Purifier is already off.", []);
      }
      return ok(intent, confidence, e, on ? "Purifier on." : "Purifier off.", [{ type: "purifier.power", on }]);
    }
    case "air.query": {
      if (/\bfilter\b/.test(text)) {
        return ok(intent, confidence, e, `Filter at ${snap.purifier.filterHealth}%.`, []);
      }
      return ok(
        intent,
        confidence,
        e,
        `Air ${snap.purifier.airQuality}. AQI ${snap.purifier.aqi}.`,
        []
      );
    }
    case "weather.query": {
      if (/\bweekend\b/.test(text)) {
        return ok(intent, confidence, e, weekendLine(snap), [], { usedContext });
      }
      if (/\blater today\b/.test(text)) {
        return ok(intent, confidence, e, laterTodayLine(snap), [], { usedContext });
      }
      if (/\brain\b/.test(text) && !/\btomorrow\b/.test(text)) {
        return ok(intent, confidence, e, rainLine(snap), [], { usedContext });
      }
      const offset = e.dayOffset === 1 || /\btomorrow\b/.test(text) ? 1 : 0;
      return ok(intent, confidence, e, weatherLine(snap, offset), [], { usedContext });
    }
    case "climate.query": {
      if (e.outdoor) return ok("weather.query", confidence, e, weatherLine(snap, 0), []);
      const inside = `${snap.climate.indoorTemp.toFixed(1)}° inside, ${snap.climate.humidity}% humidity. ${snap.climate.comfort}.`;
      return ok(intent, confidence, e, inside, []);
    }
    case "calendar.query": {
      const upcoming = upcomingEvents(snap);
      if (!upcoming.length) return ok(intent, confidence, e, "Nothing else on today.", []);
      if (/\btoday\b/.test(text) && upcoming.length > 1) {
        const list = upcoming.slice(0, 3).map((n) => `${n.title} at ${n.time}`).join(". ");
        return ok(intent, confidence, e, `${list}.`, []);
      }
      const n = upcoming[0];
      return ok(intent, confidence, e, `Next is ${n.title} at ${n.time}.`, []);
    }
    case "timer.set": {
      if (e.hour != null && /\b(alarm|wake)\b/.test(text) && !e.durationMs) {
        return ok(intent, confidence, e, `Alarm for ${pad(e.hour)}:${pad(e.minute ?? 0)}.`, [
          { type: "alarm.create", name: "Alarm", hour: e.hour, minute: e.minute ?? 0 },
        ]);
      }
      const ms = e.durationMs ?? 5 * 60_000;
      const mins = Math.round(ms / 60000);
      const name = /\bremind\b/.test(text) ? "Reminder" : "Timer";
      return ok(intent, confidence, e, `${name} for ${mins} min.`, [
        { type: "timer.create", name, durationMs: ms },
      ]);
    }
    case "timer.list":
      return ok(intent, confidence, e, timerListLine(snap), []);
    case "timer.cancel": {
      if (!snap.timers.length) return ok(intent, confidence, e, "No timers.", []);
      const all = /\ball\b/.test(text) || /\bclear\b/.test(text) || /\btimers\b/.test(text);
      if (all) {
        return ok(intent, confidence, e, "Timers cancelled.", [{ type: "timer.cancel", all: true }]);
      }
      return ok(intent, confidence, e, "Timer cancelled.", [{ type: "timer.cancel" }]);
    }
    case "system.dnd": {
      let on: boolean;
      if (/\b(off|disable)\b/.test(text)) on = false;
      else if (/\b(on|enable)\b/.test(text) || /\bquiet hours\b/.test(text)) on = true;
      else on = !snap.doNotDisturb;
      if (snap.doNotDisturb === on) {
        return ok(intent, confidence, e, on ? "Already on do not disturb." : "Do not disturb is off.", []);
      }
      return ok(intent, confidence, e, on ? "Do not disturb on." : "Do not disturb off.", [{ type: "dnd", on }]);
    }
    case "system.status": {
      if (/^ping$/.test(text)) return ok(intent, confidence, e, "Pong.", []);
      const down = snap.server.services.filter((s) => !s.online);
      if (!snap.server.online) return ok(intent, confidence, e, "I'm up, but the backend looks offline.", []);
      if (down.length) return ok(intent, confidence, e, `Trouble with ${down.map((d) => d.name).join(", ")}.`, []);
      return ok(intent, confidence, e, `All good. ${snap.server.latency} ms.`, [], {
        spoken: "All good.",
      });
    }
    case "system.time": {
      const n = new Date();
      const wantsTime = /\btime\b|\bclock\b|\bhow late\b/.test(text);
      const wantsDate = /\b(day|date)\b/.test(text);
      if (wantsDate && !wantsTime) return ok(intent, confidence, e, `${formatDateLong(n)}.`, []);
      if (wantsTime && !wantsDate) return ok(intent, confidence, e, `${formatClock(n)}.`, []);
      return ok(intent, confidence, e, `${formatClock(n)}. ${formatDateLong(n)}.`, []);
    }
    case "system.help":
      return ok(
        intent,
        confidence,
        e,
        "Lights, music, weather, timers, calendar, air, math, games. Dim, mute, scenes, routines, undo.",
        []
      );
    case "social.hello":
      return ok(intent, confidence, e, pick(["Hey.", "Hi.", "Yeah?"]), []);
    case "social.how":
      return ok(intent, confidence, e, pick(["Fine.", "Still here.", "Good."]), []);
    case "social.bye":
      return ok(intent, confidence, e, pick(["See you.", "Later.", "Bye."]), []);
    case "social.thanks":
      return ok(intent, confidence, e, pick(["Yep.", "Mhm.", "Anytime.", "Sure."]), []);
    case "social.who": {
      const person = namedPerson(text) || (e.person as string | undefined);
      if (person && !/^(you|nova|nova assistant)$/.test(person)) {
        return ok("talk.person", confidence, e, converse("person", text, ctx, person), []);
      }
      if (/\b(made|created|built|coded|owns|designed)\b/.test(text)) {
        return ok("talk.creator", confidence, e, converse("creator", text, ctx), []);
      }
      return ok(intent, confidence, e, converse("identity", text, ctx), []);
    }
    case "easter.podbay":
    case "easter.egg":
      return ok(intent, confidence, e, tryEasterEgg(text) ?? "I'm a room tablet, not HAL. Lights I can do.", []);
    default: {
      const reply = converse("unsupported", text, ctx);
      return ok("talk.fallback", confidence, e, reply, []);
    }
  }
}

function upcomingEvents(snap: RoomSnapshot) {
  const now = formatClock(new Date());
  return snap.events.filter((ev) => !ev.dayOffset && ev.time >= now && /^\d/.test(ev.time));
}

function pad(n: number) {
  return n.toString().padStart(2, "0");
}

function ok(
  intent: string,
  confidence: number,
  e: Entities,
  response: string,
  actions: RoomAction[],
  extra?: {
    usedContext?: boolean;
    deviceIds?: string[];
    spoken?: string;
    lastRelative?: ConversationContext["lastRelative"];
  }
): ClauseResult {
  return {
    intent,
    confidence,
    entities: { ...e, deviceIds: extra?.deviceIds ?? e.deviceIds },
    actions,
    response,
    spoken: extra?.spoken,
    success: true,
    usedContext: extra?.usedContext ?? false,
    lastRelative: extra?.lastRelative,
  };
}

function fail(intent: string, confidence: number, e: Entities, response: string): ClauseResult {
  return {
    intent,
    confidence,
    entities: e as unknown as Record<string, unknown>,
    actions: [],
    response,
    success: false,
    usedContext: false,
  };
}

export function processUtterance(
  raw: string,
  snap: RoomSnapshot,
  ctx: ConversationContext = emptyContext()
): ProcessResult {
  const started = performance.now?.() ?? Date.now();
  const prepared = normalizeUtterance(raw, true);
  const normalized = normalizeUtterance(raw);
  if (isWakeOnly(raw) || normalized === "nova" || normalized === "hey nova") {
    return finalize([hello()], normalized || "hey nova", [normalized || "hey nova"], started);
  }
  if (!normalized) {
    return {
      success: false,
      response: "",
      spoken: "",
      actions: [],
      intent: null,
      confidence: 0,
      entities: {},
      usedContext: false,
      clauses: [],
      debug: { normalized, clauses: [], ms: 0, route: "conversation", candidates: [] },
    };
  }

  if (/^(stop|shut up|be quiet)$/.test(normalized)) {
    const clause = dispatch(normalized, snap, ctx);
    return finalize([clause], normalized, [normalized], started);
  }

  const taughtAll = teachRoutine(prepared);
  if (taughtAll?.command) {
    const clause = dispatch(prepared, snap, ctx);
    return finalize([clause], normalized, [prepared], started);
  }

  const clauses = splitClauses(prepared).map((c) =>
    c.replace(/,/g, " ").replace(/\s+/g, " ").trim()
  ).filter(Boolean);
  const results: ClauseResult[] = [];
  const nextCtx = { ...ctx };

  for (const clause of clauses) {
    const r = dispatch(clause, snap, nextCtx);
    results.push(r);
    if (r.intent) {
      nextCtx.lastIntent = r.intent;
      nextCtx.lastDomain = r.intent.split(".")[0];
      const ids = (r.entities.deviceIds as string[] | undefined) ?? [];
      if (ids.length) nextCtx.lastDeviceIds = ids;
      nextCtx.lastAction = r.intent;
      nextCtx.updatedAt = Date.now();
    }
    if (r.lastMath != null) nextCtx.lastMath = r.lastMath;
    if (r.gameTouched) nextCtx.game = r.game ?? null;
    if (r.lastRelative) nextCtx.lastRelative = r.lastRelative;
  }

  return finalize(results, normalized, clauses, started);
}

function rememberUtterance(intent: string | null, utterance: string) {
  if (!utterance) return false;
  if (!intent) return true;
  if (intent === "assistant.repeat" || intent === "assistant.again" || intent === "assistant.stop") {
    return false;
  }
  return true;
}

function finalize(
  results: ClauseResult[],
  normalized: string,
  clauses: string[],
  started: number
): ProcessResult {
  const actions = results.flatMap((r) => r.actions);
  const responses = results.map((r) => r.response).filter(Boolean);
  const response = responses.join(" ");
  const spoken = results.map((r) => r.spoken || r.response).filter(Boolean).join(" ");
  const success = results.every((r) => r.success);
  const primary = results[0];
  const ms = (performance.now?.() ?? Date.now()) - started;
  let lastMath: number | undefined;
  let lastRelative: ConversationContext["lastRelative"];
  let game: ConversationContext["game"] | undefined;
  let gameTouched = false;
  for (const r of results) {
    if (r.lastMath != null) lastMath = r.lastMath;
    if (r.lastRelative) lastRelative = r.lastRelative;
    if (r.gameTouched) {
      game = r.game ?? null;
      gameTouched = true;
    }
  }
  const intent = primary?.intent ?? null;
  return {
    success,
    response,
    spoken,
    actions,
    intent,
    confidence: primary?.confidence ?? 0,
    entities: primary?.entities ?? {},
    usedContext: results.some((r) => r.usedContext),
    clauses: results,
    lastMath,
    lastRelative,
    game: gameTouched ? game : undefined,
    debug: {
      normalized,
      clauses,
      ms,
      route: primary?.route,
      candidates: primary?.candidates,
      bestCandidate: primary?.candidates?.[0],
    },
  };
}

export function applyContextFromResult(
  ctx: ConversationContext,
  result: ProcessResult,
  utterance?: string
): ConversationContext {
  const skipRemember =
    result.intent === "assistant.repeat" ||
    result.intent === "assistant.again" ||
    result.intent === "assistant.stop";
  const nextUtterance = skipRemember
    ? ctx.lastUtterance
    : rememberUtterance(result.intent, utterance || "")
      ? utterance || ctx.lastUtterance
      : ctx.lastUtterance;
  if (!result.intent && result.game === undefined && result.lastMath == null) {
    return {
      ...ctx,
      lastResponse: result.response || ctx.lastResponse,
      lastUtterance: nextUtterance,
      lastSuccess: result.success,
    };
  }
  const ids = (result.entities.deviceIds as string[] | undefined) ?? ctx.lastDeviceIds;
  return {
    lastIntent: result.intent ?? ctx.lastIntent,
    lastDomain: result.intent ? result.intent.split(".")[0] : ctx.lastDomain,
    lastDeviceIds: ids,
    lastAction: result.intent ?? ctx.lastAction,
    updatedAt: Date.now(),
    lastMath: result.lastMath ?? (result.intent?.startsWith("math") ? undefined : ctx.lastMath),
    lastResponse: skipRemember ? ctx.lastResponse : result.response || ctx.lastResponse,
    lastUtterance: nextUtterance,
    lastRelative: result.lastRelative ?? ctx.lastRelative,
    lastSuccess: result.success,
    game: result.game !== undefined ? result.game : ctx.game,
  };
}

export { emptyContext };
