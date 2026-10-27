import { PGlite } from "@electric-sql/pglite";
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "../../supabase");

const AUTH_STUB = `
create role anon nologin;
create role authenticated nologin;
create role service_role nologin bypassrls;
create schema auth;
create table auth.users (id uuid primary key default gen_random_uuid(), email text, raw_user_meta_data jsonb default '{}'::jsonb);
create function auth.uid() returns uuid language sql stable as $$
  select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid
$$;
grant usage on schema auth to anon, authenticated, service_role;
grant execute on function auth.uid() to anon, authenticated, service_role;
`;

export interface Db {
  pg: PGlite;
  addUser(role: "requester" | "donor" | "staff", name?: string): Promise<string>;
  as<T>(userId: string | null, fn: () => Promise<T>): Promise<T>;
  admin<T>(fn: () => Promise<T>): Promise<T>;
  q<R = Record<string, unknown>>(sql: string, params?: unknown[]): Promise<R[]>;
}

export async function createDb(withSeed = false): Promise<Db> {
  const pg = new PGlite();
  await pg.exec(AUTH_STUB);
  for (const f of readdirSync(path.join(root, "migrations")).sort()) {
    await pg.exec(readFileSync(path.join(root, "migrations", f), "utf8"));
  }
  if (withSeed) await pg.exec(readFileSync(path.join(root, "seed.sql"), "utf8"));

  const q = async <R>(sql: string, params: unknown[] = []) => (await pg.query<R>(sql, params)).rows;

  async function setSession(userId: string | null, role: string) {
    await pg.exec(`reset role; select set_config('request.jwt.claim.sub', '${userId ?? ""}', false); set role ${role};`);
  }

  return {
    pg,
    q: q as Db["q"],
    async addUser(role, name = "Synthetic User") {
      await pg.exec("reset role");
      const rows = await q<{ id: string }>(
        "insert into auth.users (email, raw_user_meta_data) values ($1, $2) returning id",
        [`${Math.random().toString(36).slice(2)}@example.test`, JSON.stringify({ role, display_name: name })],
      );
      return rows[0].id;
    },
    async as(userId, fn) {
      await setSession(userId, userId ? "authenticated" : "anon");
      try {
        return await fn();
      } finally {
        await pg.exec("reset role");
      }
    },
    async admin(fn) {
      await pg.exec("reset role; select set_config('request.jwt.claim.sub', '', false); set role service_role;");
      try {
        return await fn();
      } finally {
        await pg.exec("reset role");
      }
    },
  };
}
