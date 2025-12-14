import pg from "pg";

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  console.log("DATABASE_URL not set; skipping migrations.");
  process.exit(0);
}

const client = new pg.Client({
  connectionString,
  ssl: { rejectUnauthorized: false }
});

async function main() {
  await client.connect();

  await client.query(`
    create table if not exists users (
      id bigserial primary key,
      email text not null unique,
      password_hash text not null,
      created_at timestamptz not null default now()
    );
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

  console.log("Migration complete.");
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await client.end().catch(() => {});
  });
