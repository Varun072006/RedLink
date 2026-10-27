import { expect, test } from "@playwright/test";

const PUBLIC_ROUTES = ["/", "/availability", "/request-blood", "/auth/sign-in", "/auth/sign-up", "/auth/forgot-password", "/about", "/privacy", "/offline"];
const WIDTHS = [320, 375, 768, 1024, 1440];

test.describe("routes render", () => {
  for (const route of PUBLIC_ROUTES) {
    test(`${route} responds with a heading`, async ({ page }) => {
      const res = await page.goto(route);
      expect(res?.status()).toBe(200);
      await expect(page.locator("h1").first()).toBeVisible();
    });
  }

  test("unknown routes show the not-found page", async ({ page }) => {
    const res = await page.goto("/definitely-not-a-page");
    expect(res?.status()).toBe(404);
    await expect(page.getByRole("heading", { name: /isn.t here/i })).toBeVisible();
  });

  test("malformed tracking references are not found", async ({ page }) => {
    await page.goto("/track/not-a-real-token");
    await expect(page.getByRole("heading", { name: /isn.t here/i })).toBeVisible();
  });
});

test.describe("responsive layout has no horizontal overflow", () => {
  for (const width of WIDTHS) {
    test(`at ${width}px`, async ({ page }) => {
      await page.setViewportSize({ width, height: 800 });
      for (const route of [...PUBLIC_ROUTES, "/availability?g=O%2B&c=red_cells"]) {
        await page.goto(route);
        await page.waitForLoadState("networkidle");
        const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
        expect(overflow, `${route} overflows at ${width}px`).toBeLessThanOrEqual(0);
      }
    });
  }
});

test.describe("navigation", () => {
  test("mobile shows bottom navigation and no desktop nav", async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 800 });
    await page.goto("/");
    const bottom = page.getByRole("navigation", { name: "Primary mobile" });
    await expect(bottom).toBeVisible();
    await expect(page.getByRole("navigation", { name: "Primary", exact: true })).toBeHidden();
    await bottom.getByRole("link", { name: "Find blood" }).click();
    await expect(page).toHaveURL(/\/availability/);
    await expect(bottom.getByRole("link", { name: "Find blood" })).toHaveAttribute("aria-current", "page");
  });

  test("desktop shows top navigation and no bottom bar", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto("/");
    await expect(page.getByRole("navigation", { name: "Primary", exact: true })).toBeVisible();
    await expect(page.getByRole("navigation", { name: "Primary mobile" })).toBeHidden();
  });

  test("skip link is the first focusable element and shows a focus ring", async ({ page }) => {
    await page.goto("/");
    await page.keyboard.press("Tab");
    const skip = page.getByRole("link", { name: "Skip to content" });
    await expect(skip).toBeFocused();
    await expect(skip).toBeVisible();
  });
});

test.describe("availability search (demonstration mode)", () => {
  test("labels synthetic data and never shows stale stock as confirmed", async ({ page }) => {
    await page.goto("/availability?g=O%2B&c=red_cells");
    await expect(page.getByText("Synthetic demonstration data")).toBeVisible();
    const cards = page.locator("main ul > li", { hasText: "SYNTHETIC Demo" });
    await expect(cards.first()).toBeVisible();
    for (const card of await cards.all()) {
      const text = await card.innerText();
      if (/Stale|Never confirmed|Confirmed earlier/.test(text)) {
        expect(text).not.toMatch(/Confirmed recently/);
        expect(text).toMatch(/call to verify|Call to verify/i);
      }
    }
    await expect(page.getByText("Stale, needs reconfirmation").first()).toBeVisible();
    await expect(page.getByText("Confirmed recently").first()).toBeVisible();
  });

  test("shows an empty state when no group is chosen and validates the form", async ({ page }) => {
    await page.goto("/availability");
    await page.waitForLoadState("networkidle");
    await expect(page.getByText("Choose a blood group to search")).toBeVisible();
    await page.getByRole("button", { name: "Search availability" }).click();
    await expect(page.getByText("Choose a blood group").first()).toBeVisible();
  });

  test("searching updates the URL and the map view renders", async ({ page }) => {
    await page.goto("/availability");
    await page.waitForLoadState("networkidle");
    await page.getByLabel("Blood group needed").selectOption("O+");
    await page.getByRole("button", { name: "Search availability" }).click();
    await expect(page).toHaveURL(/g=O%2B/);
    await page.getByRole("link", { name: "Map" }).click();
    await expect(page.getByLabel("Map of blood centres")).toBeVisible();
  });
});

test.describe("emergency request wizard", () => {
  test("validates each step and reaches the review step", async ({ page }) => {
    await page.goto("/request-blood");
    await page.waitForLoadState("networkidle");
    await page.getByRole("button", { name: /Continue/ }).click();
    await expect(page.getByText("Choose a blood group")).toBeVisible();
    await page.getByLabel("Blood group needed").selectOption("A+");
    await page.getByLabel("Component").selectOption("red_cells");
    await page.getByLabel("Units required").fill("2");
    await page.getByRole("button", { name: /Continue/ }).click();

    await expect(page.getByText("Treating facility")).toBeVisible();
    await page.getByRole("button", { name: /Continue/ }).click();
    await expect(page.getByText("Facility name is required")).toBeVisible();
    await page.getByLabel("Hospital or facility name").fill("Synthetic Test Hospital");
    await page.getByLabel("City", { exact: true }).fill("Bengaluru");
    await page.getByLabel("Choose a city").selectOption("Bengaluru");
    await page.getByRole("button", { name: /Continue/ }).click();

    await page.getByRole("button", { name: /Continue/ }).click();
    await expect(page.getByText("Contact name is required")).toBeVisible();
    await page.getByLabel("Contact name").fill("Test Person");
    await page.getByLabel("Phone number").fill("12");
    await page.getByRole("button", { name: /Continue/ }).click();
    await expect(page.getByText("Enter a valid phone number")).toBeVisible();
    await page.getByLabel("Phone number").fill("+91 90000 00000");
    await page.getByRole("button", { name: /Continue/ }).click();
    await expect(page.getByText("Consent is required")).toBeVisible();
    await page.getByLabel(/I agree that my contact details/).check();
    await page.getByRole("button", { name: /Continue/ }).click();

    await expect(page.getByText("Before you submit")).toBeVisible();
    await expect(page.getByText("2 unit(s) · A+ · Red cells")).toBeVisible();
    await expect(page.getByRole("button", { name: /Submit request/ })).toBeDisabled();
  });
});

test.describe("unauthorised access", () => {
  for (const route of ["/donor/dashboard", "/donor/profile", "/hospital/dashboard", "/hospital/inventory", "/hospital/requests", "/admin/dashboard", "/admin/verifications", "/admin/audit-logs", "/admin/users", "/notifications", "/settings"]) {
    test(`${route} sends visitors to sign in`, async ({ page }) => {
      await page.goto(route);
      await expect(page).toHaveURL(/\/auth\/sign-in/);
      await expect(page.getByRole("heading", { name: "Sign in" })).toBeVisible();
    });
  }

  test("sign-in refuses open redirects", async ({ page }) => {
    await page.goto("/auth/sign-in?next=//evil.example");
    await expect(page).toHaveURL(/\/auth\/sign-in/);
  });
});

test.describe("API safety", () => {
  test("cron endpoint rejects unauthenticated calls", async ({ request }) => {
    expect((await request.get("/api/cron/maintenance")).status()).toBe(401);
    expect((await request.get("/api/cron/maintenance", { headers: { authorization: "Bearer wrong" } })).status()).toBe(401);
  });
  test("tracking API does not leak when unconfigured or unknown", async ({ request }) => {
    const res = await request.get("/api/track/aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa");
    expect([404, 503]).toContain(res.status());
  });
  test("geocode requires configuration and valid input", async ({ request }) => {
    expect([400, 501]).toContain((await request.get("/api/geocode?q=ab")).status());
  });
  test("security headers are set and the framework is not advertised", async ({ request }) => {
    const res = await request.get("/");
    const h = res.headers();
    expect(h["x-content-type-options"]).toBe("nosniff");
    expect(h["x-frame-options"]).toBe("DENY");
    expect(h["strict-transport-security"]).toContain("max-age");
    expect(h["x-powered-by"]).toBeUndefined();
  });
});

test.describe("progressive web app", () => {
  test("serves a valid manifest, icons and a scoped service worker", async ({ request }) => {
    const manifest = await (await request.get("/manifest.webmanifest")).json();
    expect(manifest.display).toBe("standalone");
    expect(manifest.icons.length).toBeGreaterThanOrEqual(2);
    for (const icon of manifest.icons) {
      const r = await request.get(icon.src);
      expect(r.status(), icon.src).toBe(200);
      expect(r.headers()["content-type"]).toContain("image/png");
    }
    const sw = await request.get("/sw.js");
    expect(sw.status()).toBe(200);
    const body = await sw.text();
    expect(body).toContain("/_next/static/");
    expect(body).not.toMatch(/\/track\//);
    expect(sw.headers()["cache-control"]).toContain("no-cache");
  });
  test("shows an offline banner when the connection drops", async ({ page, context }) => {
    await page.goto("/");
    await context.setOffline(true);
    await expect(page.getByText(/You are offline/)).toBeVisible();
    await context.setOffline(false);
    await expect(page.getByText(/You are offline/)).toBeHidden();
  });
});

test.describe("accessibility basics", () => {
  test("form controls have labels and errors are announced", async ({ page }) => {
    await page.goto("/auth/sign-in");
    await page.waitForLoadState("networkidle");
    await expect(page.getByLabel("Email")).toBeVisible();
    await expect(page.getByLabel("Password")).toBeVisible();
    await page.getByRole("button", { name: "Sign in" }).click();
    await expect(page.getByRole("alert").first()).toBeVisible();
  });
  test("reduced motion removes transitions", async ({ browser }) => {
    const ctx = await browser.newContext({ reducedMotion: "reduce" });
    const page = await ctx.newPage();
    await page.goto("/");
    const dur = await page.evaluate(() => getComputedStyle(document.querySelector("a")!).transitionDuration);
    expect(parseFloat(dur)).toBeLessThan(0.001);
    await ctx.close();
  });
  test("keyboard focus is visible on links", async ({ page }) => {
    await page.goto("/about");
    await page.keyboard.press("Tab");
    await page.keyboard.press("Tab");
    const outline = await page.evaluate(() => getComputedStyle(document.activeElement!).outlineStyle);
    expect(outline).not.toBe("none");
  });
});
