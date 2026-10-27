import { expect, test, type Page } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";

/**
 * Full-stack workflow. Requires a Supabase project with the migrations applied, email confirmation
 * disabled, and these variables in the environment of BOTH the app server and this test process:
 * NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY, E2E_FULLSTACK=1.
 * It creates throwaway synthetic users and a throwaway verified facility.
 */
const ready = !!process.env.E2E_FULLSTACK && !!process.env.SUPABASE_SERVICE_ROLE_KEY && !!process.env.NEXT_PUBLIC_SUPABASE_URL;
test.skip(!ready, "Set E2E_FULLSTACK=1 with Supabase credentials to run the full-stack workflow");
test.describe.configure({ mode: "serial" });

const stamp = Date.now();
const password = "Synthetic-pass-1234";
const email = (n: string) => `e2e-${n}-${stamp}@example.test`;

async function signUp(page: Page, role: "donor" | "staff" | "requester", name: string) {
  await page.goto(`/auth/sign-up?role=${role}`);
  await page.getByLabel("Full name").fill(name);
  await page.getByLabel("Email").fill(email(role));
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Create account" }).click();
  await expect(page.getByText(/Account created|Check your email/)).toBeVisible();
}

async function signIn(page: Page, role: string) {
  await page.goto("/auth/sign-in");
  await page.getByLabel("Email").fill(email(role));
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await page.waitForURL((u) => !u.pathname.startsWith("/auth/"));
}

let trackingUrl = "";
let centreId = "";

test("donor registers, opts in and becomes available", async ({ page }) => {
  await signUp(page, "donor", "Synthetic Donor");
  await signIn(page, "donor");
  await expect(page).toHaveURL(/donor\/dashboard/);
  await page.goto("/donor/profile");
  await page.getByLabel("Blood group").selectOption("O+");
  await page.getByLabel("City", { exact: true }).fill("Bengaluru");
  await page.context().grantPermissions(["geolocation"]);
  await page.context().setGeolocation({ latitude: 12.97, longitude: 77.59 });
  await page.getByRole("button", { name: "Use my location" }).click();
  await page.getByLabel(/I agree to be contacted/).check();
  await page.getByLabel("Availability").selectOption("available");
  await page.getByRole("button", { name: "Save profile" }).click();
  await expect(page.getByText("Profile saved.")).toBeVisible();
  await page.goto("/donor/dashboard");
  await expect(page.getByLabel("Available")).toBeChecked();
});

test("facility registers, is verified by an administrator and publishes stock", async ({ page }) => {
  await signUp(page, "staff", "Synthetic Staff");
  await signIn(page, "staff");
  await page.goto("/hospital/dashboard");
  await page.getByLabel("Facility name").fill(`E2E Synthetic Blood Bank ${stamp}`);
  await page.getByLabel("Licence or registration reference").fill("E2E-TEST-1");
  await page.getByLabel("City").fill("Bengaluru");
  await page.getByLabel("Address").fill("Synthetic street");
  await page.getByLabel("Public phone number").fill("0000000099");
  await page.context().grantPermissions(["geolocation"]);
  await page.context().setGeolocation({ latitude: 12.971, longitude: 77.594 });
  await page.getByRole("button", { name: "Use my location" }).click();
  await page.getByRole("button", { name: "Submit for verification" }).click();
  await expect(page.getByText("Awaiting administrator verification")).toBeVisible();

  await page.goto("/hospital/inventory");
  await expect(page).toHaveURL(/hospital\/dashboard/);

  const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
  const { data } = await sb.from("blood_centres").select("id").eq("name", `E2E Synthetic Blood Bank ${stamp}`).single();
  centreId = data!.id;
  await sb.from("blood_centres").update({ verification_status: "verified", verified_at: new Date().toISOString() }).eq("id", centreId);

  await page.goto("/hospital/inventory");
  await page.getByLabel("Units on the shelf (physical count)").fill("6");
  await page.getByRole("button", { name: "Save count" }).click();
  await expect(page.getByText("Stock count saved and confirmed.")).toBeVisible();
});

test("a requester submits a request and it is matched and trackable", async ({ page }) => {
  await page.goto("/request-blood");
  await page.getByLabel("Blood group needed").selectOption("O+");
  await page.getByLabel("Component").selectOption("red_cells");
  await page.getByLabel("Units required").fill("2");
  await page.getByRole("button", { name: /Continue/ }).click();
  await page.getByLabel("Another hospital or location").check();
  await page.getByLabel("Hospital or facility name").fill("Synthetic Treating Hospital");
  await page.getByLabel("City", { exact: true }).fill("Bengaluru");
  await page.getByLabel("Choose a city").selectOption({ index: 1 });
  await page.getByRole("button", { name: /Continue/ }).click();
  await page.getByLabel("Contact name").fill("Synthetic Requester");
  await page.getByLabel("Phone number").fill("+91 90000 11111");
  await page.getByLabel(/I agree that my contact details/).check();
  await page.getByRole("button", { name: /Continue/ }).click();
  await page.getByRole("button", { name: /Submit request/ }).click();
  await expect(page).toHaveURL(/\/track\/[A-Za-z0-9_-]{32}/);
  trackingUrl = page.url().split("?")[0];
  await expect(page.getByText("Request submitted")).toBeVisible();
  await expect(page.getByText(/Waiting for responses|Searching for sources/).first()).toBeVisible();
});

test("the donor and the facility respond; the requester sees distinct states", async ({ page }) => {
  await signIn(page, "donor");
  await page.goto("/donor/dashboard");
  await page.getByRole("button", { name: /I am willing/ }).first().click();
  await expect(page.getByText(/Thank you/)).toBeVisible();

  await page.context().clearCookies();
  await signIn(page, "staff");
  await page.goto("/hospital/requests");
  page.once("dialog", (d) => d.accept());
  await page.getByRole("button", { name: "Confirm availability" }).first().click();
  await expect(page.getByText("Availability confirmed and units reserved.")).toBeVisible();

  await page.context().clearCookies();
  await page.goto(trackingUrl);
  await expect(page.getByText("Facility confirmed availability")).toBeVisible();
  await expect(page.getByText(/Willing donors/)).toBeVisible();
});

test("unauthorised role access is rejected", async ({ page }) => {
  await signIn(page, "donor");
  await page.goto("/hospital/inventory");
  await expect(page).toHaveURL(/donor\/dashboard/);
  await page.goto("/admin/dashboard");
  await expect(page).toHaveURL(/donor\/dashboard/);
});

test.afterAll(async () => {
  if (!ready) return;
  const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
  const { data } = await sb.auth.admin.listUsers({ perPage: 200 });
  for (const u of data?.users ?? []) if (u.email?.includes(`-${stamp}@example.test`)) await sb.auth.admin.deleteUser(u.id);
  if (centreId) await sb.from("blood_centres").delete().eq("id", centreId);
});
