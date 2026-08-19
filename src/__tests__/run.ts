import { processUtterance, emptyContext } from "../assistant/process";
import { applyContextFromResult } from "../assistant/process";
import { RoomSnapshot } from "../assistant/types";
import { packWidgets, reorderWidgets, cycleSize, normalizeOrders } from "../lib/layout";
import { normalizeForSpeech } from "../lib/tts";
import { patternToRegex } from "../assistant/matcher";
import { BUILTIN_ROUTINES } from "../lib/routines";
import { WidgetInstance } from "../types/widgets";
import { DEFAULT_LIGHTS, DEFAULT_QUEUE, DEFAULT_EVENTS, HOURLY_FORECAST } from "../lib/mockData";

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

test("good night routine", () => {
  const r = processUtterance("good night", snap());
  assert(r.success, r.response);
  assert(r.actions.length > 1, JSON.stringify(r.actions));
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
  const keepAm = normalizeForSpeech("I am Nova.");
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
});

test("hey nova is a greeting", () => {
  for (const p of ["hey nova", "Hey Nova", "nova", "hi nova"]) {
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
  assert(/nova/i.test(you.response), you.response);
  const made = processUtterance("who made you", snap());
  assert(made.intent !== "social.who" || /local|tablet|room|whoever|install/i.test(made.response), made.response);
  assert(!/^nova\.?\s*(your )?room assistant\.?$/i.test(made.response.trim()), `creator collided with identity: ${made.response}`);
  const built = processUtterance("who built this thing", snap());
  assert(/local|tablet|room|whoever|install/i.test(built.response), built.response);
  const siri = processUtterance("who is siri", snap());
  assert(!/^nova/i.test(siri.response), `siri became identity: ${siri.response}`);
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
  const weather = processUtterance("ayo nova weather tomorrow", snap());
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

if (failed) {
  console.log(`\n${failed} failed`);
  process.exit(1);
}
console.log("\nall tests passed");
