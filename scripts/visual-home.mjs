import { chromium } from "playwright";
import { readFileSync } from "node:fs";

const FRAME = { w: 1920, h: 1200 };
const HEADER_H = 88;
const CLOCK = 44;

function overlap(a, b) {
  return a.x < b.x + b.width && a.x + a.width > b.x && a.y < b.y + b.height && a.y + a.height > b.y;
}

async function measure(page, clock, date) {
  await page.evaluate(
    ({ clock, date }) => {
      document.getElementById("clock").textContent = clock;
      document.getElementById("date").textContent = date;
    },
    { clock, date }
  );
  const boxes = await page.evaluate(() => {
    const box = (el) => {
      const r = el.getBoundingClientRect();
      return { x: r.x, y: r.y, width: r.width, height: r.height, size: parseFloat(getComputedStyle(el).fontSize) };
    };
    return {
      clock: box(document.getElementById("clock")),
      date: box(document.getElementById("date")),
      status: box(document.getElementById("status")),
      settings: box(document.getElementById("settings")),
      widgets: box(document.getElementById("widgets")),
      header: box(document.getElementById("header")),
    };
  });
  return boxes;
}

async function main() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: FRAME.w, height: FRAME.h } });
  const html = `<!doctype html>
<html><head><style>
  html,body { margin:0; width:${FRAME.w}px; height:${FRAME.h}px; background:#000; color:#fff;
    font-family: "DejaVu Sans Mono", ui-monospace, monospace; overflow:hidden; }
  #header { height:${HEADER_H}px; display:grid; grid-template-columns:1fr 1fr 1fr; align-items:center; }
  #status { padding-left:20px; font-size:14px; opacity:0.85; }
  #center { text-align:center; min-width:0; overflow:hidden; }
  #clock { font-size:${CLOCK}px; font-weight:700; line-height:1.05; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
  #date { font-size:14px; color:#8a8a8a; margin-top:2px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
  #settings { height:100%; }
  #widgets { height:${FRAME.h - HEADER_H}px; border-top:1px solid #222; }
</style></head>
<body>
  <div id="header">
    <div id="status">v0.2.15 DND</div>
    <div id="center"><div id="clock">23:59</div><div id="date">Wednesday 30 September</div></div>
    <div id="settings"></div>
  </div>
  <div id="widgets"></div>
</body></html>`;
  await page.setContent(html);

  const cases = [
    ["00:00", "Monday 1 May"],
    ["09:05", "Sat 2 Sep"],
    ["23:59", "Wednesday 30 September"],
    ["12:59 AM", "Wednesday 30 September"],
    ["11:59 PM", "Wednesday 30 September"],
  ];

  for (const [clock, date] of cases) {
    const b = await measure(page, clock, date);
    if (Math.abs(b.clock.size - CLOCK) > 0.5) throw new Error(`clock size ${b.clock.size} for ${clock}`);
    if (b.header.height > HEADER_H + 1) throw new Error(`header grew to ${b.header.height}`);
    if (overlap(b.clock, b.date)) throw new Error(`clock overlaps date (${clock} / ${date})`);
    if (overlap(b.clock, b.status)) throw new Error(`clock overlaps status (${clock})`);
    if (overlap(b.clock, b.settings)) throw new Error(`clock overlaps settings (${clock})`);
    if (overlap(b.clock, b.widgets) || overlap(b.date, b.widgets)) throw new Error(`header overlaps widgets (${clock})`);
    if (b.clock.x < FRAME.w / 3 - 8 || b.clock.x + b.clock.width > (FRAME.w * 2) / 3 + 8) {
      throw new Error(`clock left the center third: ${clock} x=${b.clock.x} w=${b.clock.width}`);
    }
    if (b.date.y + b.date.height > HEADER_H + 1) throw new Error(`date clipped: ${date}`);
    console.log("ok", clock, date, `clock ${Math.round(b.clock.width)}×${Math.round(b.clock.height)}`);
  }

  const hero = await page.evaluate(() => {
    const el = document.createElement("div");
    el.style.fontSize = "32px";
    el.style.fontWeight = "700";
    el.textContent = "999%";
    document.body.appendChild(el);
    const size = parseFloat(getComputedStyle(el).fontSize);
    el.remove();
    return size;
  });
  if (hero >= CLOCK) throw new Error(`hero ${hero} must stay below clock ${CLOCK}`);

  const slint = readFileSync("src-tauri/ui/pi/cards.slint", "utf8");
  if (!slint.includes("type-clock: 44px")) throw new Error("slint clock scale missing");

  await browser.close();
  console.log("VISUAL HOME OK", FRAME.w + "x" + FRAME.h);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
