import { processUtterance, emptyContext } from "../assistant/process";
import { applyContextFromResult } from "../assistant/process";
import { RoomSnapshot } from "../assistant/types";
import { packWidgets, placeWidgets, canPlaceWidget, reorderWidgets, cycleSize, normalizeOrders, usedPageCount, visiblePageCount } from "../lib/layout";
import { homeScaleFor, measureWidgetGrid, novaShellSize, NOVA_FRAME } from "../lib/widgetGrid";
import { DEMO_ACTIVITY, DEMO_HOST_STATS, DEMO_MEDIA, DEMO_TIMERS, DEMO_WEATHER } from "../lib/demoStats";
import { GRID_COLS, GRID_ROWS, WidgetInstance, WIDGET_LABELS } from "../types/widgets";
import { normalizeForSpeech } from "../lib/tts";
import { patternToRegex } from "../assistant/matcher";
import { BUILTIN_ROUTINES } from "../lib/routines";
import { DEFAULT_LIGHTS, DEFAULT_QUEUE, DEFAULT_EVENTS, HOURLY_FORECAST } from "../lib/mockData";
import { clampPct, snapPct, snapBoxToGrid, EDITOR_GRID_PX, CANONICAL, moveNode, defaultNode, nodesFor, filledSizes, hitBox, withLayout, chartSeries } from "../slopbox/schema";
import { makeFromTemplate } from "../slopbox/templates";
import { exportHookCode, parseWidgetFile, serializeWidget } from "../slopbox/export";
import { sanitizeSvg } from "../slopbox/svg";
import { overlayTransition } from "../lib/performance";
import { isLinuxWebview } from "../lib/platform";
import { monthCells } from "../components/widgets/chrome";
import { compatibleReleaseTags, confirmInstallBody, generateUninstallChallenge, isNewerVersion, isSameVersion, releaseLabel, versionChange, type ReleaseInfo } from "../lib/install";

function snap(): RoomSnapshot {
  return {
    lights: DEFAULT_LIGHTS.map((l) => ({ ...l })),
    scene: "Cozy",
    doNotDisturb: false,
    media: {
      playing: false,
      progress: 0,
      volume: 62,
      trackIndex: 0,
      queue: DEFAULT_QUEUE,
    },
    climate: { indoorTemp: 21.4, outdoorTemp: 11, humidity: 42, comfort: "Comfortable" },
    weather: {
      location: "Hafnarfjörður",
      temp: 11,
      condition: "Cloudy",
      high: 13,
      low: 9,
      precipNote: "Rain around 22:00",
      humidity: 78,
      wind: 18,
      hourly: HOURLY_FORECAST,
      daily: [
        { date: "2026-08-14", label: "Today", high: 13, low: 9, condition: "Cloudy", precip: 40 },
        { date: "2026-08-15", label: "Tomorrow", high: 12, low: 8, condition: "Rain", precip: 70 },
      ],
    },
    purifier: {
      on: true,
      mode: "auto",
      fanSpeed: 42,
      airQuality: "Good",
      aqi: 28,
      filterHealth: 76,
    },
    events: DEFAULT_EVENTS,
    timers: [],
    routines: BUILTIN_ROUTINES,
    server: {
      online: true,
      latency: 4,
      services: [{ name: "Core", online: true, latency: 4 }],
    },
  };
}

let failed = 0;
function test(name: string, fn: () => void) {
  try {
    fn();
    console.log(`ok  ${name}`);
  } catch (err) {
    failed += 1;
    console.error(`fail  ${name}`);
    console.error(err);
  }
}

function assert(cond: unknown, msg: string) {
  if (!cond) throw new Error(msg);
}

test("lights off variants resolve to power off", () => {
  const phrases = [
    "turn my lights off",
    "lights off",
    "kill the lights",
    "make it dark in here",
    "switch everything off",
  ];
  for (const p of phrases) {
    const r = processUtterance(p, snap());
    assert(r.success, `${p} should succeed`);
    assert(
      r.actions.some((a) => a.type === "lights.power" && a.on === false),
      `${p} should turn lights off (intent=${r.intent} actions=${JSON.stringify(r.actions)})`
    );
  }
});

test("already-off is acknowledged without a redundant action", () => {
  const s = snap();
  s.lights = s.lights.map((l) => ({ ...l, on: false }));
  const r = processUtterance("turn the lights off", s);
  assert(r.success, "success");
  assert(/already/i.test(r.response), `expected already-off, got ${r.response}`);
  assert(r.actions.length === 0, "no actions");
});

test("context: them refers to lights", () => {
  const s = snap();
  let ctx = emptyContext();
  const first = processUtterance("turn the lights blue", s, ctx);
  ctx = applyContextFromResult(ctx, first);
  const second = processUtterance("make them darker", s, ctx);
  assert(second.success, "follow-up succeeds");
  assert(
    second.actions.some((a) => a.type === "lights.brightness" && a.relative),
    `expected relative brightness, got ${JSON.stringify(second.actions)}`
  );
  assert(second.usedContext, "should use context");
});

test("weather follow-up tomorrow", () => {
  const s = snap();
  let ctx = emptyContext();
  const first = processUtterance("what's the temperature outside", s, ctx);
  ctx = applyContextFromResult(ctx, first);
  const second = processUtterance("what about tomorrow", s, ctx);
  assert(second.success, "tomorrow succeeds");
  assert(/tomorrow/i.test(second.response), second.response);
});

test("multi-intent lights + alarm + weather", () => {
  const r = processUtterance(
    "Turn off the lights, set my alarm for 7 and tell me tomorrow's weather.",
    snap()
  );
  assert(r.clauses.length >= 2, `expected multiple clauses, got ${r.debug.clauses}`);
  assert(
    r.actions.some((a) => a.type === "lights.power" && a.on === false),
    "lights off"
  );
  assert(
    r.actions.some((a) => a.type === "alarm.create" && a.hour === 7),
    `alarm 7, actions=${JSON.stringify(r.actions)}`
  );
  assert(/tomorrow/i.test(r.response), r.response);
});

test("except desk lights", () => {
  const r = processUtterance("Turn everything off except my desk lights", snap());
  const power = r.actions.filter((a) => a.type === "lights.power");
  assert(power.length >= 1, JSON.stringify(r.actions));
  const off = power.find((a) => a.type === "lights.power" && a.on === false);
  assert(off && off.type === "lights.power" && off.ids && !off.ids.includes("desk"), JSON.stringify(off));
});

test("warmer + play music", () => {
  const r = processUtterance("Make the room warmer and play some music", snap());
  assert(
    r.actions.some((a) => a.type === "lights.colorTemp"),
    JSON.stringify(r.actions)
  );
  assert(
    r.actions.some((a) => a.type === "media.play" && a.playing !== false),
    JSON.stringify(r.actions)
  );
});

test("delayed lights off", () => {
  const r = processUtterance("Turn the lights off in 20 minutes", snap());
  const t = r.actions.find((a) => a.type === "timer.create");
  assert(t && t.type === "timer.create", JSON.stringify(r.actions));
  if (t && t.type === "timer.create") {
    assert(Math.abs(t.durationMs - 20 * 60_000) < 1000, String(t.durationMs));
    assert(t.fireText, "stores command to run later");
  }
});

test("teach routine", () => {
  const r = processUtterance(
    'When I say "movie mode extra", turn the main lights off',
    snap()
  );
  assert(
    r.actions.some((a) => a.type === "routine.create"),
    JSON.stringify(r.actions)
  );
});

test("custom routine runs its command", () => {
  const s = snap();
  s.routines = [
    ...s.routines,
    {
      id: "r-desk",
      name: "Desk",
      phrases: ["desk time"],
      command: "turn on the desk lamp",
    },
  ];
  const r = processUtterance("desk time", s);
  const a = r.actions.find((x) => x.type === "lights.power");
  assert(a && a.type === "lights.power" && a.on === true, JSON.stringify(r.actions));
  assert(a && a.type === "lights.power" && a.ids?.includes("desk"), JSON.stringify(a));
});

test("device alias desk lamp", () => {
  const r = processUtterance("turn on the desk lamp", snap());
  const a = r.actions.find((x) => x.type === "lights.power");
  assert(a && a.type === "lights.power" && a.on === true, JSON.stringify(r.actions));
  assert(a && a.type === "lights.power" && a.ids?.includes("desk"), JSON.stringify(a));
});

test("pattern optionals still match", () => {
  assert(patternToRegex("dim (the) {lights|light}").test("dim the lights"), "dim the lights");
  assert(patternToRegex("how is (the) air").test("how is the air"), "how is the air");
  assert(
    patternToRegex("{turn|switch} (my|the) {lights|light} {on|off}").test("turn my lights off"),
    "turn my lights off"
  );
});

test("tts normalization", () => {
  assert(normalizeForSpeech("21°C") === "21 degrees", normalizeForSpeech("21°C"));
  assert(normalizeForSpeech("Volume 40%").includes("percent"), normalizeForSpeech("Volume 40%"));
  assert(
    normalizeForSpeech("192.168.1.40").includes("dot"),
    normalizeForSpeech("192.168.1.40")
  );
  const mhm = normalizeForSpeech("Mhm.");
  assert(mhm.toLowerCase().includes("mm hmm"), `Mhm spoken as ${mhm}`);
  assert(!/m\s*h\s*m/i.test(mhm.replace(/mm hmm/i, "")), `should not spell Mhm: ${mhm}`);
  const am = normalizeForSpeech("Alarm for 7 A.M.");
  assert(/morning/i.test(am), `A.M. should be morning, got ${am}`);
  assert(!/\bam\b/i.test(am), `A.M. should not be the word am: ${am}`);
  const pm = normalizeForSpeech("Meeting at 7 P.M.");
  assert(/evening/i.test(pm), pm);
  const clock = normalizeForSpeech("Next is coffee at 09:00.");
  assert(/morning/i.test(clock), clock);
  const night = normalizeForSpeech("Rain around 22:00.");
  assert(/night/i.test(night), night);
  const keepAm = normalizeForSpeech("I am Judie.");
  assert(/\bam\b/i.test(keepAm), keepAm);
});

test("layout pack and reorder", () => {
  const widgets: WidgetInstance[] = [
    { id: "a", type: "weather", page: 0, size: "2x2", order: 0 },
    { id: "b", type: "lights", page: 0, size: "1x2", order: 1 },
    { id: "c", type: "media", page: 0, size: "1x2", order: 2 },
  ];
  const packed = packWidgets(widgets);
  assert(packed.length === 3, "packed all");
  assert(packed[0].col === 0 && packed[0].row === 0, "first at origin");
  const reordered = normalizeOrders(reorderWidgets(widgets, "c", "a"));
  assert(reordered.find((w) => w.id === "c")!.order < reordered.find((w) => w.id === "a")!.order, "c before a");
  assert(cycleSize("1x2", ["1x2", "2x2"]) === "2x2", "cycle");
  assert(usedPageCount(widgets) === 1, "one used page");
  assert(visiblePageCount(widgets, false) === 1, "no swipe pages");
  assert(visiblePageCount(widgets, true) === 2, "edit offers one empty page");
});

test("free placement keeps empty zones", () => {
  const widgets: WidgetInstance[] = [
    { id: "a", type: "weather", page: 0, size: "1x1", order: 0, col: 0, row: 0 },
    { id: "b", type: "lights", page: 0, size: "1x1", order: 1, col: 5, row: 3 },
  ];
  const placed = placeWidgets(widgets);
  assert(placed.length === 2, "both placed");
  assert(placed.find((w) => w.id === "a")!.col === 0 && placed.find((w) => w.id === "a")!.row === 0, "a stays");
  assert(placed.find((w) => w.id === "b")!.col === 5 && placed.find((w) => w.id === "b")!.row === 3, "b stays in corner");
  assert(canPlaceWidget(widgets, "a", 2, 1), "empty cell free");
  assert(!canPlaceWidget(widgets, "a", 5, 3), "occupied blocked");
});

test("square cells keep ratio with side padding when height-limited", () => {
  const wide = measureWidgetGrid(1848, 1092);
  const hd = measureWidgetGrid(1848, 972);
  assert(Math.abs(wide.cellW - wide.cellH) < 0.01, "16:10 cells are square");
  assert(Math.abs(hd.cellW - hd.cellH) < 0.01, "16:9 cells are square");
  assert(Math.abs(wide.cellH * GRID_ROWS - 1092) < 0.01, "1920x1200 fills height");
  assert(Math.abs(hd.cellH * GRID_ROWS - 972) < 0.01, "1920x1080 fills height");
  assert(wide.offsetX > 0, "side padding when taller aspect");
  assert(hd.offsetX >= wide.offsetX - 0.01, "more side pad on shorter height");
  assert(Math.abs(wide.cellW * GRID_COLS + wide.offsetX * 2 - 1848) < 0.01, "pads fill width");
});

test("gallery demo stats are frozen and look occupied", () => {
  assert(DEMO_HOST_STATS.cpuHistory.length >= 8, "cpu spark has points");
  assert(DEMO_HOST_STATS.top.length >= 4, "process list");
  assert(DEMO_WEATHER.hourly.length >= 5, "hourly forecast");
  assert(DEMO_ACTIVITY.length >= 4, "activity rows");
  assert(DEMO_TIMERS[0].fireText === "8:12", "timer uses a static countdown");
  assert(DEMO_MEDIA.playing && DEMO_MEDIA.queue.length > 1, "media demo is playing");
});

test("widget creator export includes hidden descriptors", () => {
  assert(clampPct(120) === 100, "clamp high");
  assert(clampPct(-4) === 0, "clamp low");
  assert(snapPct(3.24) === 3, "snap");
  const node = defaultNode("metric", 8, 8);
  const moved = moveNode(node, 200, 0);
  assert(moved.x + moved.w <= 100.01, "stay on artboard");
  const stat = makeFromTemplate("stat");
  assert(stat.sizes.includes("1x1") && stat.sizes.includes("2x2"), "stat sizes");
  assert(nodesFor(stat, "1x1").length > 0, "1x1 layout");
  const packed = packWidgets([
    { id: "s1", type: "custom", page: 0, size: "1x2", order: 0, customId: stat.id },
  ]);
  assert(packed[0].col === 0 && packed[0].row === 0, "custom packs");
  const json = serializeWidget(stat);
  assert(json.includes("judie-widget"), "format tag");
  assert(json.includes("climate.indoorTemp"), "descriptor in json");
  const roundTrip = parseWidgetFile(json);
  assert(roundTrip.name === stat.name, "round trip name");
  const code = exportHookCode(stat);
  assert(code.includes("@hook climate.indoorTemp"), "descriptor in exported code");
  assert(code.includes("data-hook="), "data-hook attribute");
  assert(!code.toLowerCase().includes("visible on the widget") || code.includes("NOT visible"), "notes invisibility");
});

test("widget creator grid is pixel cells not stretched percents", () => {
  const small = CANONICAL["1x1"];
  const large = CANONICAL["2x2"];
  const snapped = snapBoxToGrid({ x: 11.1, y: 7.7, w: 22.2, h: 18.4 }, small);
  const xPx = (snapped.x / 100) * small.w;
  assert(Math.abs(xPx - Math.round(xPx / EDITOR_GRID_PX) * EDITOR_GRID_PX) < 0.02, "snaps to 8px");
  assert(Math.floor(large.w / EDITOR_GRID_PX) > Math.floor(small.w / EDITOR_GRID_PX), "bigger size has more cells");
});

test("widget creator sanitizes dropped svg", () => {
  const dirty =
    '<svg viewBox="0 0 24 24" onclick="alert(1)"><script>alert(1)</script><circle cx="12" cy="12" r="8"/></svg>';
  const clean = sanitizeSvg(dirty);
  assert(!!clean && !clean.includes("<script"), "strip script");
  assert(!!clean && !/onclick/i.test(clean), "strip handlers");
  assert(sanitizeSvg("<div>nope</div>") === null, "reject non-svg");
});

test("widget creator preview packs empty neighbor sizes", () => {
  const placed = packWidgets([
    { id: "live", type: "custom", page: 0, size: "1x2", order: 0 },
    { id: "a", type: "custom", page: 0, size: "1x1", order: 1 },
    { id: "b", type: "custom", page: 0, size: "2x2", order: 2 },
  ]);
  assert(placed[0].id === "live" && placed[0].col === 0, "live first");
  assert(placed.some((w) => w.size === "1x1"), "has 1x1 neighbor");
  assert(placed.some((w) => w.size === "2x2"), "has 2x2 neighbor");
});

test("empty widget sizes stay off the home screen", () => {
  const blank = makeFromTemplate("blank");
  assert(filledSizes(blank).length === 0, "blank is not addable");
  assert(nodesFor(blank, "1x2").length === 0, "empty 1x2 is empty");
  const stat = makeFromTemplate("stat");
  const stripped = {
    ...stat,
    layouts: { ...stat.layouts, "1x2": [] },
  };
  assert(!filledSizes(stripped).includes("1x2"), "unfilled 1x2 is omitted");
  assert(nodesFor(stripped, "1x2").length === 0, "no layout fallback");
  assert(filledSizes(stripped).includes("1x1"), "filled 1x1 remains");
});

test("metric hitbox hugs the glyphs", () => {
  const shell = CANONICAL["1x2"];
  const node = { ...defaultNode("metric", 8, 8, shell), w: 80, h: 40, text: "21°" };
  const hit = hitBox(node, shell);
  assert(hit.w < 35, `hitbox still huge (${hit.w})`);
  assert(hit.h <= node.h, "height not larger than the old box");
});

test("editing 1x1 does not change 2x2", () => {
  const stat = makeFromTemplate("stat");
  const before = nodesFor(stat, "2x2");
  const layouts = withLayout(stat.layouts, "1x1", [
    defaultNode("text", 10, 10, CANONICAL["1x1"]),
  ]);
  const after = { ...stat, layouts };
  assert(JSON.stringify(nodesFor(after, "2x2")) === JSON.stringify(before), "2x2 untouched");
  assert(nodesFor(after, "1x1").length === 1, "1x1 replaced");
  assert(nodesFor(after, "1x1")[0].kind === "text", "1x1 has the new node");
});

test("hey judie is a greeting", () => {
  for (const p of ["hey judie", "Hey Judie", "judie", "hi judie"]) {
    const r = processUtterance(p, snap());
    assert(r.success, p);
    assert(r.intent === "social.hello", `${p} intent=${r.intent}`);
    assert(/hey|hi|yeah/i.test(r.response), r.response);
  }
});

test("math", () => {
  const r = processUtterance("what is 12 times 7", snap());
  assert(r.success && r.response.startsWith("84"), r.response);
  const two = processUtterance("2 + 2", snap());
  assert(two.response.startsWith("4"), two.response);
  let ctx = emptyContext();
  const first = processUtterance("10 plus 5", snap(), ctx);
  ctx = applyContextFromResult(ctx, first);
  const next = processUtterance("times 2", snap(), ctx);
  assert(next.response.startsWith("30"), next.response);
});

test("games and eggs", () => {
  const coin = processUtterance("flip a coin", snap());
  assert(/heads|tails/i.test(coin.response), coin.response);
  const rps = processUtterance("rock", snap());
  assert(/rock|paper|scissors/i.test(rps.response), rps.response);
  const egg = processUtterance("open the pod bay doors", snap());
  assert(/HAL|tablet/i.test(egg.response), egg.response);
  const life = processUtterance("meaning of life", snap());
  assert(life.response.includes("42"), life.response);
});

test("status questions do not toggle lights", () => {
  const r = processUtterance("are the lights on", snap());
  assert(r.success, r.response);
  assert(
    !r.actions.some((a) => a.type === "lights.power"),
    JSON.stringify(r.actions)
  );
  assert(/on|off/i.test(r.response), r.response);
});

test("dim the lights sets a low level", () => {
  const r = processUtterance("dim the lights", snap());
  const a = r.actions.find((x) => x.type === "lights.brightness");
  assert(a && a.type === "lights.brightness" && !a.relative && a.value === 22, JSON.stringify(r.actions));
});

test("mute and air and home", () => {
  const mute = processUtterance("mute", snap());
  assert(
    mute.actions.some((a) => a.type === "media.mute" && a.on === true),
    JSON.stringify(mute.actions)
  );
  const air = processUtterance("how's the air", snap());
  assert(/aqi|air/i.test(air.response), air.response);
  const home = processUtterance("I'm home", snap());
  assert(home.success, home.response);
  assert(home.actions.length > 0, JSON.stringify(home.actions));
});

test("rain, five-minute timer, repeat", () => {
  const rain = processUtterance("will it rain", snap());
  assert(rain.success, rain.response);
  const timer = processUtterance("set a timer for five minutes", snap());
  const t = timer.actions.find((a) => a.type === "timer.create");
  assert(t && t.type === "timer.create" && Math.abs(t.durationMs - 5 * 60_000) < 1000, JSON.stringify(timer.actions));
  let ctx = emptyContext();
  const first = processUtterance("what time is it", snap(), ctx);
  ctx = applyContextFromResult(ctx, first, "what time is it");
  const again = processUtterance("repeat that", snap(), ctx);
  assert(again.response === first.response, `${again.response} vs ${first.response}`);
});

function assertNotDate(r: { intent: string | null; response: string }, label: string) {
  assert(r.intent !== "system.time", `${label} routed to date/time: ${r.intent} ${r.response}`);
  assert(!/\b(monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b/i.test(r.response), `${label} sounded like a date: ${r.response}`);
}

test("preference is not the date", () => {
  for (const p of [
    "what's your favorite food",
    "got a preferred snack",
    "do you eat",
    "what's your favourite colour",
    "what's your favorite day",
  ]) {
    const r = processUtterance(p, snap());
    assert(r.success, p);
    assertNotDate(r, p);
    assert(r.debug.route === "conversation" || r.intent?.startsWith("talk."), `${p} route=${r.debug.route} intent=${r.intent}`);
  }
});

test("date slang still hits the calendar", () => {
  for (const p of [
    "what day is it",
    "what's today's date",
    "yo what day we on",
    "what date is it today",
    "tell me today's date",
    "Ain't no bot what day is it?",
  ]) {
    const r = processUtterance(p, snap());
    assert(r.intent === "system.time", `${p} intent=${r.intent} resp=${r.response}`);
    assert(/august|friday|thursday|saturday|sunday|monday|tuesday|wednesday|\d/i.test(r.response), r.response);
  }
});

test("who-questions are not one bucket", () => {
  const you = processUtterance("who are you", snap());
  assert(/judie/i.test(you.response), you.response);
  const made = processUtterance("who made you", snap());
  assert(made.intent !== "social.who" || /local|tablet|room|whoever|install/i.test(made.response), made.response);
  assert(!/^judie\.?\s*(your )?room assistant\.?$/i.test(made.response.trim()), `creator collided with identity: ${made.response}`);
  const built = processUtterance("who built this thing", snap());
  assert(/local|tablet|room|whoever|install/i.test(built.response), built.response);
  const siri = processUtterance("who is siri", snap());
  assert(!/^judie/i.test(siri.response), `siri became identity: ${siri.response}`);
  const jobs = processUtterance("who is Steve Jobs", snap());
  assert(!/room assistant/i.test(jobs.response), jobs.response);
});

test("nova johnson easter egg stays rare", () => {
  const hit = processUtterance("do you know who Nova Johnson is", snap());
  assert(/how do you know that name|not supposed to know/i.test(hit.response), hit.response);
  const also = processUtterance("who is nova johnson", snap());
  assert(/how do you know that name|not supposed to know/i.test(also.response), also.response);
  const plain = processUtterance("who is nova", snap());
  assert(!/how do you know that name/i.test(plain.response), plain.response);
  const johnson = processUtterance("who is johnson", snap());
  assert(!/how do you know that name/i.test(johnson.response), johnson.response);
});

test("insults and comparisons are not wellbeing", () => {
  for (const p of ["why are you so stupid", "you're useless", "you suck", "why are you acting weird"]) {
    const r = processUtterance(p, snap());
    assert(r.intent !== "social.how", `${p} → ${r.intent} ${r.response}`);
    assert(!/^(good|fine|working|still here)\.?$/i.test(r.response.trim()), `${p} → ${r.response}`);
  }
  for (const p of [
    "are you better or worse than Siri",
    "are you better than siri",
    "what's the difference between you and alexa",
    "how good are you",
  ]) {
    const r = processUtterance(p, snap());
    assert(r.intent !== "social.how", `${p} → ${r.intent}`);
    assert(!/^(good|fine|working|still here)\.?$/i.test(r.response.trim()), `${p} → ${r.response}`);
  }
  const well = processUtterance("how are you", snap());
  assert(/fine|still here|good/i.test(well.response), well.response);
});

test("spoken math variants", () => {
  const cases: [string, string][] = [
    ["5x11", "55"],
    ["can you tell me what 5x11 is", "55"],
    ["5 * 11", "55"],
    ["what's 5 times 11", "55"],
    ["whats five times eleven again", "55"],
    ["divide 100 by 4", "25"],
    ["20 + 35", "55"],
    ["12 squared", "144"],
    ["half of 80", "40"],
    ["10% of 250", "25"],
    ["2 to the power of 8", "256"],
  ];
  for (const [p, n] of cases) {
    const r = processUtterance(p, snap());
    assert(r.response.startsWith(n), `${p} => ${r.response} (want ${n})`);
  }
});

test("slang commands still work", () => {
  const dim = processUtterance("lights could you turn em down", snap());
  assert(
    dim.actions.some((a) => a.type === "lights.brightness" && a.relative),
    JSON.stringify(dim.actions)
  );
  const weather = processUtterance("ayo judie weather tomorrow", snap());
  assert(/tomorrow/i.test(weather.response), weather.response);
});

test("low-confidence keywords do not execute", () => {
  const r = processUtterance("I like the colour of that painting", snap());
  assert(
    !r.actions.some((a) => a.type.startsWith("lights")),
    `painted the room: ${JSON.stringify(r.actions)} ${r.intent}`
  );
});

test("no fail-language in replies", () => {
  for (const p of ["asdfgh", "what's your favorite food", "who made you", "blarg"]) {
    const r = processUtterance(p, snap());
    assert(!/\bfail\b|\berror\b|unrecognised|unmatched|null|undefined|not sure/i.test(r.response), `${p}: ${r.response}`);
  }
});

test("editor 100% uses the live home shell, not the 1920 design", () => {
  const pi = { w: 1280, h: 800 };
  const live = novaShellSize("1x2", pi);
  const design = novaShellSize("1x2", NOVA_FRAME);
  assert(live.w < design.w - 40, "a 1280 home tile is smaller than the 1920 design");
  assert(Math.abs(homeScaleFor("1x2", NOVA_FRAME) - 1) < 0.001, "design tablet is 100%");
});

test("list pair toggle and chart are addable kinds", () => {
  const list = defaultNode("list", 8, 8, CANONICAL["1x2"]);
  const pair = defaultNode("pair", 8, 8, CANONICAL["1x2"]);
  const toggle = defaultNode("toggle", 8, 8, CANONICAL["1x1"]);
  const chart = defaultNode("chart", 8, 8, CANONICAL["1x1"]);
  assert(list.kind === "list" && (list.text ?? "").includes("\n"), "list has rows");
  assert(pair.kind === "pair" && (pair.text ?? "").includes("\n"), "pair has label and value");
  assert(toggle.kind === "toggle" && (toggle.value ?? 0) >= 50, "toggle defaults on");
  assert(chart.kind === "chart" && chartSeries(chart.text).length >= 8, "chart has a series");
  assert(!("trends" in WIDGET_LABELS), "trends widget is gone");
});

test("calendar month fills adjacent-month days", () => {
  const cells = monthCells(new Date(2026, 7, 1));
  assert(cells.length === 42, "six weeks covering August 2026");
  assert(cells.slice(0, 6).every((c) => c.outside), "Sunday-Friday before Saturday the 1st");
  assert(cells[6].day === 1 && !cells[6].outside, "the 1st sits on Saturday");
  assert(cells[cells.length - 1].outside, "trailing next-month days fill the last week");
});

test("linux motion helpers are inert in node", () => {
  assert(!isLinuxWebview(), "node is not a linux webview");
  assert(overlayTransition().duration === 0.18, "desktop overlay duration");
});

test("release labels mark the running copy", () => {
  const rel: ReleaseInfo = {
    tag: "v0.1.2",
    name: "Judie 0.1.2",
    publishedAt: "",
    current: true,
    installable: true,
    assetName: "judie_0.1.2_armhf.deb",
    assetUrl: "",
  };
  assert(releaseLabel(rel).includes("this version"), releaseLabel(rel));
});

test("version switch confirm names upgrade, downgrade, and current", () => {
  assert(isNewerVersion("0.1.1", "0.1.0"), "0.1.1 beats 0.1.0");
  assert(isNewerVersion("v0.1.2", "0.1.1"), "v prefix is ignored");
  assert(!isNewerVersion("0.1.0", "0.1.1"), "older is not newer");
  assert(!isNewerVersion("0.1.1", "0.1.1"), "same version is current");
  assert(isSameVersion("v0.2.9", "0.2.9"), "v prefix is the same version");
  assert(versionChange("0.2.10", "0.2.9") === "upgrade", "upgrade");
  assert(versionChange("0.2.9", "0.2.10") === "downgrade", "downgrade");
  assert(versionChange("v0.2.9", "0.2.9") === "same", "already installed");
  const up = confirmInstallBody("0.2.9", "0.2.10");
  assert(up.includes("Current version: 0.2.9"), up);
  assert(up.includes("Target version: 0.2.10"), up);
  assert(up.includes("an upgrade"), up);
  const down = confirmInstallBody("0.2.10", "0.2.9");
  assert(down.includes("a downgrade"), down);
  const same = confirmInstallBody("0.2.9", "0.2.9");
  assert(same.includes("already installed"), same);
});

test("release filter drops drafts, prereleases, incompatible debs, and duplicates", () => {
  const tags = compatibleReleaseTags(
    [
      { tag: "v0.2.10", installable: true, assetName: "Judie_0.2.10_armhf.deb" },
      { tag: "v0.2.10", installable: true, assetName: "judie_armhf.deb" },
      { tag: "v0.2.9-rc1", prerelease: true, installable: true, assetName: "Judie_0.2.9-rc1_armhf.deb" },
      { tag: "v0.2.8", draft: true, installable: true, assetName: "Judie_0.2.8_armhf.deb" },
      { tag: "v0.2.7", installable: true, assetName: "Judie_0.2.7_amd64.deb" },
      { tag: "v0.2.6", installable: true, assetName: "Judie_0.2.6_armhf.deb" },
    ],
    "linux",
    "armhf",
  );
  assert(tags.join(",") === "v0.2.10,v0.2.6", tags.join(","));
});

test("uninstall challenge mixes letters, digits, and symbols", () => {
  const code = generateUninstallChallenge();
  assert(code.length === 12, code);
  assert(/[a-z]/.test(code), "has lowercase");
  assert(/[A-Z]/.test(code), "has uppercase");
  assert(/[0-9]/.test(code), "has a digit");
  assert(/[^A-Za-z0-9]/.test(code), "has a symbol");
  assert(generateUninstallChallenge() !== generateUninstallChallenge(), "fresh each time");
});

if (failed) {
  console.log(`\n${failed} failed`);
  process.exit(1);
}
console.log("\nall tests passed");
