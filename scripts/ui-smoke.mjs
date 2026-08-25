import { chromium } from "playwright";

async function main() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1920, height: 1200 } });
  page.on("pageerror", (err) => console.error("PAGEERROR", err.message));

  await page.goto("http://localhost:1420", { waitUntil: "networkidle" });
  await page.evaluate(() => localStorage.removeItem("nova-layout"));
  await page.reload({ waitUntil: "networkidle" });
  await page.waitForTimeout(500);

  console.log("brand:", await page.locator(".status-brand").textContent());

  const page0 = page.locator(".home-page").nth(0);
  const shells = page0.locator(".widget-shell");
  console.log("widgets:", await shells.count());

  const lights = shells.filter({ has: page.locator(".w-label", { hasText: /^Lights$/ }) }).first();
  await lights.locator(".toggle").click();
  await page.waitForTimeout(200);
  console.log("lights off:", (await lights.innerText()).includes("Off"));

  // Turn back on via brightness-ish: click toggle again
  await lights.locator(".toggle").click();
  await page.waitForTimeout(150);

  const media = shells.filter({ hasText: "Northern Lights" }).first();
  await media.locator(".icon-btn.accent").click();
  await page.waitForTimeout(200);
  console.log("expanded after media play:", await page.locator(".expanded-app").count());

  const purifier = shells.filter({ hasText: "Air Purifier" }).first();
  await purifier.locator(".toggle").click();
  await page.waitForTimeout(150);
  console.log("purifier off:", (await purifier.innerText()).includes("OFF"));

  await shells
    .filter({ hasText: "Quick Controls" })
    .first()
    .getByRole("button", { name: "Movie Mode" })
    .click();
  await page.waitForTimeout(200);
  console.log("movie mode ok");

  await lights.click({ position: { x: 48, y: 36 } });
  await page.waitForTimeout(700);
  console.log("lights expanded:", await page.locator(".expanded-app").count());
  console.log("title:", await page.locator(".expanded-title").first().textContent());
  await page.locator(".expanded-close").click();
  await page.waitForTimeout(600);
  console.log("collapsed:", (await page.locator(".expanded-app").count()) === 0);

  const box = await page.locator(".home-viewport").boundingBox();
  if (box) {
    await page.mouse.move(box.x + box.width * 0.75, box.y + box.height * 0.55);
    await page.mouse.down();
    await page.mouse.move(box.x + box.width * 0.2, box.y + box.height * 0.55, { steps: 16 });
    await page.mouse.up();
    await page.waitForTimeout(500);
  }
  const pageAfter = await page.evaluate(() => {
    const raw = localStorage.getItem("nova-layout");
    return raw ? JSON.parse(raw).state.currentPage : null;
  });
  console.log("page after swipe:", pageAfter);

  if (box) {
    await page.mouse.move(box.x + box.width * 0.2, box.y + box.height * 0.55);
    await page.mouse.down();
    await page.mouse.move(box.x + box.width * 0.75, box.y + box.height * 0.55, { steps: 16 });
    await page.mouse.up();
    await page.waitForTimeout(500);
  }

  const climate = shells.filter({ hasText: "Indoor" }).first();
  const cbox = await climate.boundingBox();
  if (cbox) {
    await page.mouse.move(cbox.x + cbox.width / 2, cbox.y + cbox.height / 2);
    await page.mouse.down();
    await page.waitForTimeout(650);
    await page.mouse.up();
  }
  await page.waitForTimeout(350);
  console.log("edit mode:", (await page.locator(".edit-bar").count()) > 0);

  if ((await page.locator(".edit-bar").count()) > 0) {
    // Drag reorder: weather -> lights
    const weather = shells.filter({ hasText: "Hafnarfjörður" }).first();
    const wbox = await weather.boundingBox();
    const lbox = await lights.boundingBox();
    if (wbox && lbox) {
      await page.mouse.move(wbox.x + wbox.width / 2, wbox.y + wbox.height / 2);
      await page.mouse.down();
      await page.mouse.move(lbox.x + lbox.width / 2, lbox.y + lbox.height / 2, { steps: 12 });
      await page.waitForTimeout(200);
      await page.mouse.up();
      await page.waitForTimeout(400);
      console.log("drag reorder attempted");
    }

    await page.locator(".edit-bar button.primary").click();
    await page.waitForTimeout(250);
    console.log("gallery:", await page.locator(".gallery-panel").count());
    await page
      .locator(".gallery-item")
      .filter({ hasText: "Server Status" })
      .getByRole("button", { name: "Add" })
      .click();
    await page.waitForTimeout(250);
    console.log("widgets after add:", await shells.count());

    await shells.nth(0).locator(".widget-remove").click();
    await page.waitForTimeout(250);
    console.log("widgets after remove:", await shells.count());

    await page.locator(".edit-bar button", { hasText: "Done" }).click();
  }

  const stored = await page.evaluate(() => localStorage.getItem("nova-layout"));
  console.log("persisted:", !!stored, "count", stored ? JSON.parse(stored).state.widgets.length : 0);

  await browser.close();
  console.log("SMOKE OK");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
