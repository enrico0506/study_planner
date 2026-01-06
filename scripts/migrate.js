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

async function main() {
  await client.connect();

  await client.query(`
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
  `);

  await client.query(`alter table users add column if not exists email_verified boolean not null default false;`);
  await client.query(`alter table users add column if not exists plan text not null default 'free';`);
  await client.query(`alter table users add column if not exists stripe_customer_id text;`);
  await client.query(`alter table users add column if not exists stripe_subscription_id text;`);
  await client.query(`alter table users add column if not exists stripe_subscription_status text;`);
  await client.query(`alter table users add column if not exists stripe_current_period_end timestamptz;`);

  await client.query(`
    create unique index if not exists users_stripe_customer_id_key
      on users(stripe_customer_id)
      where stripe_customer_id is not null;
  `);

  await client.query(`
    create index if not exists users_stripe_subscription_id_idx
      on users(stripe_subscription_id)
      where stripe_subscription_id is not null;
  `);

  await client.query(`
    create table if not exists user_states (
      user_id bigint primary key references users(id) on delete cascade,
      data jsonb not null default '{}'::jsonb,
      updated_at timestamptz not null default now()
    );
  `);

  await client.query(`
    create index if not exists user_states_updated_at_idx
      on user_states(updated_at desc);
  `);

  await client.query(`
    create table if not exists user_state_versions (
      id bigserial primary key,
      user_id bigint not null references users(id) on delete cascade,
      data jsonb not null,
      created_at timestamptz not null default now()
    );
  `);

  await client.query(`
    create index if not exists user_state_versions_user_created_idx
      on user_state_versions(user_id, created_at desc);
  `);

  await client.query(`
    create table if not exists auth_tokens (
      id bigserial primary key,
      user_id bigint not null references users(id) on delete cascade,
      kind text not null check (kind in ('password_reset', 'email_verify')),
      token_hash text not null,
      expires_at timestamptz not null,
      created_at timestamptz not null default now(),
      used_at timestamptz null
    );
  `);

  await client.query(`
    create index if not exists auth_tokens_lookup_idx
      on auth_tokens(user_id, kind, expires_at desc)
      where used_at is null;
  `);

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
