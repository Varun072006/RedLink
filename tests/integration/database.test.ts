import { beforeAll, describe, expect, it } from "vitest";
import { createDb, type Db } from "./harness";
import { canTransition, REQUEST_STATUSES } from "@/lib/domain/request-state";

let db: Db;
let admin: string;
let staffA: string;
let staffB: string;
let donor: string;
let donor2: string;
let outsider: string;
let centreA: string;
let centreB: string;

const rpc = (sql: string, params: unknown[] = []) => db.q(sql, params);

async function newRequest(units = 2, status = "awaiting_response") {
  const rows = await db.admin(() =>
    db.q<{ id: string }>(
      `insert into blood_requests (reference, tracking_hash, blood_group, component, units, urgency, status, facility_name, city,
        lat, lng, contact_name, contact_phone, contact_pref, consent_at, expires_at, requester_id)
       values ($1, $2, 'O+', 'red_cells', $3, 'urgent', $4, 'Synthetic Hospital', 'Bengaluru', 12.97, 77.59, 'Synthetic', '0000000000',
        'phone', now(), now() + interval '1 day', $5) returning id`,
      [`RL-${Math.random().toString(36).slice(2, 10)}`, Math.random().toString(36), units, status, outsider],
    ),
  );
  return rows[0].id;
}

async function addMatch(requestId: string, kind: "centre" | "donor", target: string, group = "O+") {
  const rows = await db.admin(() =>
    db.q<{ id: string }>(
      kind === "centre"
        ? `insert into request_matches (request_id, candidate_type, centre_id, supply_group, score, distance_km, expires_at)
           values ($1, 'centre', $2, $3, 50, 2, now() + interval '1 day') returning id`
        : `insert into request_matches (request_id, candidate_type, donor_id, score, distance_km, expires_at)
           values ($1, 'donor', $2, 30, 2, now() + interval '1 day') returning id`,
      kind === "centre" ? [requestId, target, group] : [requestId, target],
    ),
  );
  return rows[0].id;
}

beforeAll(async () => {
  db = await createDb();
  admin = await db.addUser("requester", "Admin");
  await db.pg.query("update profiles set role = 'admin' where id = $1", [admin]);
  staffA = await db.addUser("staff", "Staff A");
  staffB = await db.addUser("staff", "Staff B");
  donor = await db.addUser("donor", "Donor One");
  donor2 = await db.addUser("donor", "Donor Two");
  outsider = await db.addUser("requester", "Requester");

  const reg = (user: string, name: string) =>
    db.as(user, () =>
      db.q<{ id: string }>("select register_centre($1, 'blood_bank', 'Bengaluru', 'Addr', 12.97, 77.59, '0000000000', 'LIC-1') as id", [name]),
    );
  centreA = (await reg(staffA, "Synthetic Centre A"))[0].id;
  centreB = (await reg(staffB, "Synthetic Centre B"))[0].id;
  for (const c of [centreA, centreB]) {
    await db.as(admin, () => rpc("select review_centre($1, 'approve', 'ok')", [c]));
  }
  for (const [u, city] of [[donor, "Bengaluru"], [donor2, "Bengaluru"]] as const) {
    await db.as(u, () =>
      rpc(
        `insert into donor_profiles (user_id, blood_group, city, lat, lng, opted_in, consent_at, availability)
         values ($1, 'O+', $2, 12.97, 77.59, true, now(), 'available')`,
        [u, city],
      ),
    );
  }
  await db.as(staffA, () => rpc("select set_inventory('O+', 'red_cells', 5, 'initial count')"));
});

describe("identity and privilege", () => {
  it("assigns only low-privilege roles from sign-up metadata", async () => {
    const id = await db.addUser("staff");
    const rows = await db.q<{ role: string }>("select role from profiles where id = $1", [id]);
    expect(rows[0].role).toBe("staff");
    await db.pg.query("insert into auth.users (email, raw_user_meta_data) values ('x@example.test', '{\"role\":\"admin\"}')");
    const adm = await db.q<{ role: string }>("select role from profiles where id = (select id from auth.users where email = 'x@example.test')");
    expect(adm[0].role).toBe("requester");
  });

  it("blocks users from changing their own role or status", async () => {
    await expect(db.as(donor, () => rpc("update profiles set role = 'admin' where id = $1", [donor]))).rejects.toThrow();
    await expect(db.as(donor, () => rpc("update profiles set status = 'active' where id = $1", [donor]))).rejects.toThrow();
    const rows = await db.q<{ role: string }>("select role from profiles where id = $1", [donor]);
    expect(rows[0].role).toBe("donor");
  });

  it("lets users edit allowed profile fields but not other people's", async () => {
    await db.as(donor, () => rpc("update profiles set display_name = 'Renamed' where id = $1", [donor]));
    const other = await db.as(donor, () => rpc("update profiles set display_name = 'Hacked' where id = $1 returning id", [staffA]));
    expect(other).toHaveLength(0);
  });

  it("does not let a non-admin call the review function", async () => {
    await expect(db.as(staffA, () => rpc("select review_centre($1, 'approve', 'self')", [centreA]))).rejects.toThrow(/administrator/);
  });
});

describe("row level security", () => {
  it("shows anonymous visitors only verified centres and hides private columns", async () => {
    await db.admin(() =>
      rpc(
        `insert into blood_centres (name, kind, city, address, lat, lng, phone) values ('Pending Centre', 'hospital', 'X', 'a', 1, 1, '1')`,
      ),
    );
    const rows = await db.as(null, () => rpc("select name from blood_centres"));
    expect(rows.map((r) => r.name)).not.toContain("Pending Centre");
    await expect(db.as(null, () => rpc("select license_ref from blood_centres"))).rejects.toThrow(/permission denied/);
  });

  it("denies anonymous access to private tables", async () => {
    for (const t of ["blood_requests", "donor_profiles", "notifications", "request_matches", "audit_logs", "profiles"]) {
      await expect(db.as(null, () => rpc(`select * from ${t}`))).rejects.toThrow(/permission denied/);
    }
  });

  it("keeps donor profiles private to the owner and admin", async () => {
    expect(await db.as(donor, () => rpc("select * from donor_profiles"))).toHaveLength(1);
    expect(await db.as(staffA, () => rpc("select * from donor_profiles"))).toHaveLength(0);
    expect((await db.as(admin, () => rpc("select * from donor_profiles"))).length).toBeGreaterThanOrEqual(2);
  });

  it("denies direct writes to inventory, requests and centres", async () => {
    await expect(db.as(donor, () => rpc("update blood_inventory set units = 999"))).rejects.toThrow(/permission denied/);
    await expect(db.as(staffA, () => rpc("update blood_inventory set units = 999"))).rejects.toThrow(/permission denied/);
    await expect(db.as(staffA, () => rpc("update blood_centres set verification_status = 'verified'"))).rejects.toThrow(/permission denied/);
    await expect(db.as(outsider, () => rpc("delete from blood_requests"))).rejects.toThrow(/permission denied/);
    await expect(db.as(admin, () => rpc("delete from audit_logs"))).rejects.toThrow(/permission denied/);
  });

  it("exposes requests only to the requester, matched staff and admin", async () => {
    const rid = await newRequest();
    await addMatch(rid, "centre", centreA);
    const ids = (rows: Record<string, unknown>[]) => rows.map((r) => r.id);
    expect(ids(await db.as(outsider, () => rpc("select id from blood_requests")))).toContain(rid);
    expect(ids(await db.as(staffA, () => rpc("select id from blood_requests")))).toContain(rid);
    expect(ids(await db.as(staffB, () => rpc("select id from blood_requests")))).not.toContain(rid);
    expect(ids(await db.as(donor, () => rpc("select id from blood_requests")))).not.toContain(rid);
    expect(ids(await db.as(admin, () => rpc("select id from blood_requests")))).toContain(rid);
  });

  it("limits notifications to their owner", async () => {
    await db.admin(() => rpc("select notify_user($1, 't', 'Hello', 'b', null)", [donor]));
    expect((await db.as(donor, () => rpc("select * from notifications"))).length).toBeGreaterThan(0);
    expect(await db.as(donor2, () => rpc("select * from notifications"))).toHaveLength(0);
    await expect(db.as(donor, () => rpc("update notifications set title = 'x'"))).rejects.toThrow(/permission denied/);
    await db.as(donor, () => rpc("update notifications set read_at = now()"));
  });

  it("prevents browser roles from calling internal functions", async () => {
    await expect(db.as(donor, () => rpc("select notify_user($1, 't', 'x', 'y', null)", [donor2]))).rejects.toThrow(/permission denied/);
    const rid = await newRequest();
    await expect(db.as(staffA, () => rpc("select close_request($1, 'cancelled', 'x')", [rid]))).rejects.toThrow(/permission denied/);
    await expect(db.as(donor, () => rpc("select log_audit(null, 'a', 'b', 'c')"))).rejects.toThrow(/permission denied/);
  });
});

describe("inventory", () => {
  it("rejects stock changes from donors, unverified facilities and other facilities' staff", async () => {
    await expect(db.as(donor, () => rpc("select set_inventory('O+', 'red_cells', 99, 'x')"))).rejects.toThrow(/facility access/);
    const pendingStaff = await db.addUser("staff");
    await db.as(pendingStaff, () => rpc("select register_centre('Pend', 'hospital', 'X', 'a', 1, 1, '1', 'L')"));
    await expect(db.as(pendingStaff, () => rpc("select set_inventory('O+', 'red_cells', 1, 'x')"))).rejects.toThrow(/not verified/);
  });

  it("writes an audit trail for every change and confirms with a timestamp", async () => {
    await db.as(staffA, () => rpc("select adjust_inventory('O+', 'red_cells', 3, 'delivery')"));
    await db.as(staffA, () => rpc("select adjust_inventory('O+', 'red_cells', -3, 'wastage')"));
    const hist = await db.as(staffA, () => rpc("select kind, units_before, units_after from inventory_adjustments order by id"));
    expect(hist.length).toBeGreaterThanOrEqual(3);
    const inv = await db.as(staffA, () => rpc("select units, last_confirmed_at from blood_inventory where blood_group = 'O+'"));
    expect(inv[0].units).toBe(5);
    expect(inv[0].last_confirmed_at).not.toBeNull();
    expect(await db.as(staffB, () => rpc("select * from inventory_adjustments"))).toHaveLength(0);
  });

  it("refuses negative stock and stock below reserved units", async () => {
    await expect(db.as(staffA, () => rpc("select adjust_inventory('O+', 'red_cells', -50, 'oops')"))).rejects.toThrow(/fewer units/);
    await expect(db.as(staffA, () => rpc("select set_inventory('O+', 'red_cells', -1, 'oops')"))).rejects.toThrow();
  });

  it("adjusting stock does not refresh the confirmation timestamp", async () => {
    await db.admin(() => rpc("update blood_inventory set last_confirmed_at = now() - interval '2 days' where centre_id = $1", [centreA]));
    await db.as(staffA, () => rpc("select adjust_inventory('O+', 'red_cells', 1, 'delivery')"));
    const row = await db.q<{ age: number }>(
      "select extract(epoch from now() - last_confirmed_at) as age from blood_inventory where centre_id = $1 and blood_group = 'O+'",
      [centreA],
    );
    expect(Number(row[0].age)).toBeGreaterThan(86400);
    await db.as(staffA, () => rpc("select confirm_inventory()"));
    await db.as(staffA, () => rpc("select adjust_inventory('O+', 'red_cells', -1, 'correction')"));
  });
});

describe("donor responses", () => {
  it("records one response and rejects duplicates", async () => {
    const rid = await newRequest();
    const mid = await addMatch(rid, "donor", donor);
    await db.as(donor, () => rpc("select respond_to_match($1, true)", [mid]));
    await expect(db.as(donor, () => rpc("select respond_to_match($1, false)", [mid]))).rejects.toThrow(/already responded/);
    const rows = await db.q<{ status: string }>("select status from request_matches where id = $1", [mid]);
    expect(rows[0].status).toBe("accepted");
    const req = await db.q<{ status: string }>("select status from blood_requests where id = $1", [rid]);
    expect(req[0].status).toBe("awaiting_response");
    const notes = await db.as(outsider, () => rpc("select type from notifications where type = 'donor_response'"));
    expect(notes.length).toBeGreaterThan(0);
  });

  it("does not let another donor answer someone else's match", async () => {
    const mid = await addMatch(await newRequest(), "donor", donor);
    await expect(db.as(donor2, () => rpc("select respond_to_match($1, true)", [mid]))).rejects.toThrow(/not found/);
  });

  it("reveals requester contact to the donor only after acceptance", async () => {
    const rid = await newRequest();
    const mid = await addMatch(rid, "donor", donor);
    let rows = await db.as(donor, () => rpc("select contact_phone from donor_matches() where match_id = $1", [mid]));
    expect(rows[0].contact_phone).toBeNull();
    await db.as(donor, () => rpc("select respond_to_match($1, true)", [mid]));
    rows = await db.as(donor, () => rpc("select contact_phone from donor_matches() where match_id = $1", [mid]));
    expect(rows[0].contact_phone).toBe("0000000000");
  });

  it("rejects responses to expired requests", async () => {
    const rid = await newRequest();
    const mid = await addMatch(rid, "donor", donor);
    await db.admin(() => rpc("update blood_requests set expires_at = now() - interval '1 minute' where id = $1", [rid]));
    await expect(db.as(donor, () => rpc("select respond_to_match($1, true)", [mid]))).rejects.toThrow(/no longer open/);
  });

  it("does not treat a donor acceptance as availability confirmation", async () => {
    const rid = await newRequest();
    const mid = await addMatch(rid, "donor", donor2);
    await db.as(donor2, () => rpc("select respond_to_match($1, true)", [mid]));
    const req = await db.q<{ status: string }>("select status from blood_requests where id = $1", [rid]);
    expect(req[0].status).not.toBe("availability_confirmed");
  });
});

describe("facility confirmation, reservation and fulfilment", () => {
  it("reserves stock, blocks overselling and blocks other facilities", async () => {
    await db.as(staffA, () => rpc("select set_inventory('O+', 'red_cells', 5, 'count')"));
    const r1 = await newRequest(3);
    const r2 = await newRequest(3);
    const m1 = await addMatch(r1, "centre", centreA);
    const m2 = await addMatch(r2, "centre", centreA);
    await expect(db.as(staffB, () => rpc("select centre_respond($1, 'confirm')", [m1]))).rejects.toThrow(/not found/);
    await db.as(staffA, () => rpc("select centre_respond($1, 'confirm')", [m1]));
    await expect(db.as(staffA, () => rpc("select centre_respond($1, 'confirm')", [m2]))).rejects.toThrow(/not enough unreserved/);
    const inv = await db.q<{ units: number; reserved: number }>("select units, reserved from blood_inventory where centre_id = $1 and blood_group = 'O+'", [centreA]);
    expect(inv[0]).toMatchObject({ units: 5, reserved: 3 });
    const st = await db.q<{ status: string }>("select status from blood_requests where id = $1", [r1]);
    expect(st[0].status).toBe("availability_confirmed");
    await expect(db.as(staffA, () => rpc("select set_inventory('O+', 'red_cells', 2, 'x')"))).rejects.toThrow(/reserved/);
    await db.as(staffA, () => rpc("select fulfil_request($1)", [m1]));
    const after = await db.q<{ units: number; reserved: number }>("select units, reserved from blood_inventory where centre_id = $1 and blood_group = 'O+'", [centreA]);
    expect(after[0]).toMatchObject({ units: 2, reserved: 0 });
    const done = await db.q<{ status: string }>("select status from blood_requests where id = $1", [r1]);
    expect(done[0].status).toBe("fulfilled");
    await db.as(staffA, () => rpc("select set_inventory('O+', 'red_cells', 5, 'restock')"));
  });

  it("settles sequential competing confirmations without exceeding stock", async () => {
    const reqs = await Promise.all([newRequest(2), newRequest(2), newRequest(2)]);
    const matches = await Promise.all(reqs.map((r) => addMatch(r, "centre", centreA)));
    const results = await Promise.allSettled(
      matches.map((m) => db.as(staffA, () => rpc("select centre_respond($1, 'confirm')", [m]))),
    );
    const ok = results.filter((r) => r.status === "fulfilled").length;
    const inv = await db.q<{ units: number; reserved: number }>("select units, reserved from blood_inventory where centre_id = $1 and blood_group = 'O+'", [centreA]);
    expect(ok).toBeLessThanOrEqual(2);
    expect(inv[0].reserved).toBeLessThanOrEqual(inv[0].units);
    for (const r of reqs) await db.admin(() => rpc("select close_request($1, 'cancelled', 'test cleanup')", [r]));
    const clean = await db.q<{ reserved: number }>("select reserved from blood_inventory where centre_id = $1 and blood_group = 'O+'", [centreA]);
    expect(clean[0].reserved).toBe(0);
  });

  it("cancelling a request releases its reservation", async () => {
    const rid = await newRequest(2);
    const mid = await addMatch(rid, "centre", centreA);
    await db.as(staffA, () => rpc("select centre_respond($1, 'confirm')", [mid]));
    await db.admin(() => rpc("select close_request($1, 'cancelled', 'no longer needed')", [rid]));
    const inv = await db.q<{ reserved: number }>("select reserved from blood_inventory where centre_id = $1 and blood_group = 'O+'", [centreA]);
    expect(inv[0].reserved).toBe(0);
    const m = await db.q<{ status: string }>("select status from request_matches where id = $1", [mid]);
    expect(m[0].status).toBe("released");
  });

  it("returns to awaiting_response when the only reservation is released", async () => {
    const rid = await newRequest(1);
    const mid = await addMatch(rid, "centre", centreA);
    await db.as(staffA, () => rpc("select centre_respond($1, 'confirm')", [mid]));
    await db.as(staffA, () => rpc("select release_reservation($1)", [mid]));
    const st = await db.q<{ status: string }>("select status from blood_requests where id = $1", [rid]);
    expect(st[0].status).toBe("awaiting_response");
  });

  it("prevents fulfilling twice and fulfilling an unconfirmed match", async () => {
    const rid = await newRequest(1);
    const mid = await addMatch(rid, "centre", centreA);
    await expect(db.as(staffA, () => rpc("select fulfil_request($1)", [mid]))).rejects.toThrow(/confirmed reservation/);
    await db.as(staffA, () => rpc("select centre_respond($1, 'confirm')", [mid]));
    await db.as(staffA, () => rpc("select fulfil_request($1)", [mid]));
    await expect(db.as(staffA, () => rpc("select fulfil_request($1)", [mid]))).rejects.toThrow();
  });
});

describe("request lifecycle", () => {
  it("matches the TypeScript state machine for every transition pair", async () => {
    for (const from of REQUEST_STATUSES) {
      for (const to of REQUEST_STATUSES) {
        if (from === to) continue;
        const rid = await newRequest(1, from);
        let allowed = true;
        try {
          await db.admin(() => rpc("update blood_requests set status = $2 where id = $1", [rid, to]));
        } catch {
          allowed = false;
        }
        expect(allowed, `${from} -> ${to}`).toBe(canTransition(from, to));
      }
    }
  });

  it("stamps resolution time on terminal states", async () => {
    const rid = await newRequest();
    await db.admin(() => rpc("select close_request($1, 'expired', 'time')", [rid]));
    const row = await db.q<{ resolved_at: unknown; status: string }>("select resolved_at, status from blood_requests where id = $1", [rid]);
    expect(row[0].status).toBe("expired");
    expect(row[0].resolved_at).not.toBeNull();
  });
});

describe("verified donation history, audit and rate limits", () => {
  it("lets only verified facility staff record donations", async () => {
    const code = (await db.q<{ donor_code: string }>("select donor_code from donor_profiles where user_id = $1", [donor]))[0].donor_code;
    await expect(db.as(donor2, () => rpc("select record_donation($1, null)", [code]))).rejects.toThrow(/facility access/);
    await db.as(staffA, () => rpc("select record_donation($1, null)", [code]));
    const rows = await db.as(donor, () => rpc("select verified from donation_records"));
    expect(rows).toHaveLength(1);
    expect(await db.as(donor2, () => rpc("select * from donation_records"))).toHaveLength(0);
  });

  it("makes audit logs append-only and admin-visible only", async () => {
    await expect(db.admin(() => rpc("update audit_logs set action = 'x'"))).rejects.toThrow(/append-only/);
    expect((await db.as(admin, () => rpc("select * from audit_logs"))).length).toBeGreaterThan(0);
    expect(await db.as(staffA, () => rpc("select * from audit_logs"))).toHaveLength(0);
  });

  it("enforces the rate limit window", async () => {
    const res: boolean[] = [];
    for (let i = 0; i < 4; i++) {
      const r = await db.admin(() => rpc("select check_rate_limit('k', 3, 60) as ok"));
      res.push(r[0].ok as boolean);
    }
    expect(res).toEqual([true, true, true, false]);
  });
});

describe("seed data", () => {
  it("loads synthetic centres flagged as synthetic", async () => {
    const seeded = await createDb(true);
    const rows = await seeded.as(null, () => seeded.q<{ is_synthetic: boolean }>("select is_synthetic from blood_centres"));
    expect(rows.length).toBe(5);
    expect(rows.every((r) => r.is_synthetic)).toBe(true);
  });
});
