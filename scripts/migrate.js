import "dotenv/config";
import pg from "pg";

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  console.log("DATABASE_URL not set; skipping migrations.");
  process.exit(0);
}

let normalizedConnectionString = String(connectionString).trim();
if (normalizedConnectionString.startsWith("DATABASE_URL=")) {
  normalizedConnectionString = normalizedConnectionString.slice("DATABASE_URL=".length);
}

const client = new pg.Client({
  connectionString: normalizedConnectionString,
  ssl: { rejectUnauthorized: false }
});

// Ordered list of migrations. Each is applied once, tracked in `schema_migrations`.
// Add new migrations at the end with a unique, monotonically increasing id.
const MIGRATIONS = [
  {
    id: "0001_users_and_state",
    sql: `
      create table if not exists users (
        id bigserial primary key,
        email text not null unique,
        password_hash text not null,
        email_verified boolean not null default false,
        plan text not null default 'free',
        stripe_customer_id text null,
        stripe_subscription_id text null,
        stripe_subscription_status text null,
        stripe_current_period_end timestamptz null,
        created_at timestamptz not null default now()
      );

      alter table users add column if not exists email_verified boolean not null default false;
      alter table users add column if not exists plan text not null default 'free';
      alter table users add column if not exists stripe_customer_id text;
      alter table users add column if not exists stripe_subscription_id text;
      alter table users add column if not exists stripe_subscription_status text;
      alter table users add column if not exists stripe_current_period_end timestamptz;

      create unique index if not exists users_stripe_customer_id_key
        on users(stripe_customer_id)
        where stripe_customer_id is not null;

      create index if not exists users_stripe_subscription_id_idx
        on users(stripe_subscription_id)
        where stripe_subscription_id is not null;

      create table if not exists user_states (
        user_id bigint primary key references users(id) on delete cascade,
        data jsonb not null default '{}'::jsonb,
        updated_at timestamptz not null default now()
      );

      create index if not exists user_states_updated_at_idx
        on user_states(updated_at desc);

      create table if not exists user_state_versions (
        id bigserial primary key,
        user_id bigint not null references users(id) on delete cascade,
        data jsonb not null,
        created_at timestamptz not null default now()
      );

      create index if not exists user_state_versions_user_created_idx
        on user_state_versions(user_id, created_at desc);

      create table if not exists auth_tokens (
        id bigserial primary key,
        user_id bigint not null references users(id) on delete cascade,
        kind text not null check (kind in ('password_reset', 'email_verify')),
        token_hash text not null,
        expires_at timestamptz not null,
        created_at timestamptz not null default now(),
        used_at timestamptz null
      );

      create index if not exists auth_tokens_lookup_idx
        on auth_tokens(user_id, kind, expires_at desc)
        where used_at is null;
    `
  }
];

async function ensureTrackerTable() {
  await client.query(`
    create table if not exists schema_migrations (
      id text primary key,
      applied_at timestamptz not null default now()
    );
  `);
}

async function listAppliedIds() {
  const { rows } = await client.query("select id from schema_migrations");
  return new Set(rows.map((r) => r.id));
}

async function runMigration(migration) {
  await client.query("begin");
  try {
    await client.query(migration.sql);
    await client.query("insert into schema_migrations (id) values ($1)", [migration.id]);
    await client.query("commit");
    console.log(`  applied ${migration.id}`);
  } catch (err) {
    await client.query("rollback").catch(() => {});
    throw err;
  }
}

async function main() {
  await client.connect();
  await ensureTrackerTable();
  const applied = await listAppliedIds();
  let count = 0;
  for (const m of MIGRATIONS) {
    if (applied.has(m.id)) continue;
    await runMigration(m);
    count += 1;
  }
  if (count === 0) {
    console.log("No migrations to apply.");
  } else {
    console.log(`Applied ${count} migration(s).`);
  }
  console.log("Migration complete.");
}

main()
  .catch((err) => {
    if (err?.code === "28P01") {
      console.error("Database authentication failed. Check the username/password in DATABASE_URL.");
      process.exitCode = 1;
      return;
    }
    if (err?.code === "ENOTFOUND" || err?.code === "EAI_AGAIN") {
      console.error(
        `Cannot resolve database host (${err?.hostname || err?.host || "unknown-host"}). If running locally, use the external Render DB URL.`
      );
      process.exitCode = 1;
      return;
    }
    console.error(err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await client.end().catch(() => {});
  });
