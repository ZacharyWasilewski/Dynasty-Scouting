import { Pool } from "pg";

// A single pooled connection, reused across requests within this
// process — matches the module-level singleton pattern already used
// for the sheet data cache elsewhere in the app.
let pool: Pool | null = null;

function getPool(): Pool {
  if (pool) return pool;
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error(
      "DATABASE_URL is not set — accounts require the Postgres service to be connected to this app on Railway."
    );
  }
  pool = new Pool({
    connectionString,
    // Railway's managed Postgres uses a certificate this driver can't
    // verify against a public CA by default — this is the standard,
    // widely-used pattern for connecting to hosted Postgres (Railway,
    // Heroku, etc.) from node-postgres.
    ssl: { rejectUnauthorized: false },
    // pg's default idle timeout (10s) closes a connection well within
    // the gap between two normal page views — the next request then
    // pays a full new TCP+TLS handshake to Railway's Postgres before
    // it can even run its query, which is most of where the ~1.4s
    // /api/auth/me latency was coming from. Keeping connections alive
    // longer, plus TCP keepalive packets so intermediate network
    // hops don't silently drop an idle connection, means most real
    // requests reuse an already-open connection instead of paying
    // that cost themselves.
    idleTimeoutMillis: 120_000,
    keepAlive: true,
  });
  return pool;
}

// Schema setup is idempotent (CREATE TABLE IF NOT EXISTS) and runs
// lazily on first real use rather than as a separate manual migration
// step — there's no way to run one-off scripts on this deployment
// setup, so the app has to be able to create its own tables on boot.
// Single-flight guarded the same way the sheet data cache is, so a
// burst of concurrent requests on a cold start only runs this once.
let schemaReady: Promise<void> | null = null;

async function ensureSchema(): Promise<void> {
  if (schemaReady) return schemaReady;
  schemaReady = (async () => {
    const db = getPool();
    await db.query(`
      CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY,
        email TEXT UNIQUE NOT NULL,
        password_hash TEXT NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now()
      );
    `);
    await db.query(`
      CREATE TABLE IF NOT EXISTS sessions (
        token TEXT PRIMARY KEY,
        user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        expires_at TIMESTAMPTZ NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now()
      );
    `);
    await db.query(`
      CREATE INDEX IF NOT EXISTS sessions_user_id_idx ON sessions(user_id);
    `);
    await db.query(`
      CREATE TABLE IF NOT EXISTS watchlist_items (
        user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        prospect_id TEXT NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        PRIMARY KEY (user_id, prospect_id)
      );
    `);
    await db.query(`
      CREATE TABLE IF NOT EXISTS saved_mock_drafts (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        class_year TEXT NOT NULL,
        -- Full draft state as JSON rather than one row per pick (at
        -- most 56 picks per draft) — it's always read and written as
        -- a single unit, so there's no reason to normalize it, and
        -- the whole thing runs only a few KB per saved draft.
        settings JSONB NOT NULL,
        picks JSONB NOT NULL,
        overall_grade TEXT,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now()
      );
    `);
    await db.query(`
      CREATE INDEX IF NOT EXISTS saved_mock_drafts_user_id_idx ON saved_mock_drafts(user_id, created_at DESC);
    `);
    await db.query(`
      -- A snapshot, not a live pointer — a Big Board keeps changing
      -- as its owner edits it, so a share link needs its own frozen
      -- copy of the ordering at the moment "Share" was clicked, or
      -- the link's content would silently change out from under
      -- whoever it was shared with. Prospect *data* (name, score,
      -- tier) still comes from live getProspects() at view time —
      -- only the ORDER is what's actually personal here, and that's
      -- exactly what's frozen.
      CREATE TABLE IF NOT EXISTS shared_boards (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        class_year TEXT NOT NULL,
        prospect_ids JSONB NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now()
      );
    `);
    await db.query(`
      CREATE TABLE IF NOT EXISTS custom_boards (
        user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        class_year TEXT NOT NULL,
        -- The user's own ordering as a JSON array of prospect ids,
        -- top to bottom — simplest possible representation of "my
        -- personal order for this class," and avoids needing
        -- fractional-index or gap-based row reordering in SQL.
        prospect_ids JSONB NOT NULL,
        updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        PRIMARY KEY (user_id, class_year)
      );
    `);
    await db.query(`
      CREATE TABLE IF NOT EXISTS synced_sleeper_teams (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        league_id TEXT NOT NULL,
        roster_id INTEGER NOT NULL,
        league_name TEXT NOT NULL,
        team_name TEXT NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        -- Bumped on every re-sync of the same team, not just at
        -- creation — Mock Draft's suggestions use whichever synced
        -- team was touched most recently, so re-syncing an existing
        -- team needs to move it back to the front without duplicating
        -- the row.
        updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        UNIQUE (user_id, league_id, roster_id)
      );
    `);
    await db.query(`
      CREATE INDEX IF NOT EXISTS synced_sleeper_teams_user_id_idx ON synced_sleeper_teams(user_id, updated_at DESC);
    `);
    await db.query(`
      CREATE TABLE IF NOT EXISTS password_reset_tokens (
        token TEXT PRIMARY KEY,
        user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        expires_at TIMESTAMPTZ NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now()
      );
    `);
    await db.query(`
      CREATE INDEX IF NOT EXISTS password_reset_tokens_user_id_idx ON password_reset_tokens(user_id);
    `);
    await db.query(`
      CREATE TABLE IF NOT EXISTS user_preferences (
        user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
        league_format TEXT,
        updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
      );
    `);
    await db.query(`
      -- Single row (id is always 1) tracking DD Score movement for
      -- the homepage's "Trending" section. Two slots, not one,
      -- because this site updates in occasional bursts (weekly-ish),
      -- not a steady drip — a single "overwrite every N hours"
      -- baseline would frequently get silently replaced by the very
      -- update it should be comparing against, hiding real changes
      -- more often than showing them. See lib/trending.ts for the
      -- actual state-machine logic that uses these columns.
      CREATE TABLE IF NOT EXISTS score_snapshot (
        id INTEGER PRIMARY KEY DEFAULT 1,
        settled_scores JSONB,
        settled_at TIMESTAMPTZ,
        pending_scores JSONB,
        pending_since TIMESTAMPTZ,
        CONSTRAINT single_row CHECK (id = 1)
      );
    `);
    // Covers the case where an earlier version of this table already
    // exists in production without these columns — safe/idempotent
    // either way, since a fresh CREATE above already has them.
    await db.query(`ALTER TABLE score_snapshot ADD COLUMN IF NOT EXISTS settled_scores JSONB;`);
    await db.query(`ALTER TABLE score_snapshot ADD COLUMN IF NOT EXISTS settled_at TIMESTAMPTZ;`);
    await db.query(`ALTER TABLE score_snapshot ADD COLUMN IF NOT EXISTS pending_scores JSONB;`);
    await db.query(`ALTER TABLE score_snapshot ADD COLUMN IF NOT EXISTS pending_since TIMESTAMPTZ;`);
    await db.query(`
      -- Minimal, aggregate-oriented usage tracking — no external
      -- analytics service is wired up, so every feature built so far
      -- has shipped with zero way to check whether it actually gets
      -- used. Deliberately lightweight: an event type, the path it
      -- happened on, and an optional user_id (null for anonymous
      -- visitors) — enough for "what's actually used" without being
      -- a detailed per-user activity log.
      CREATE TABLE IF NOT EXISTS usage_events (
        id BIGSERIAL PRIMARY KEY,
        event_type TEXT NOT NULL,
        path TEXT,
        user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now()
      );
    `);
    await db.query(`
      CREATE INDEX IF NOT EXISTS usage_events_type_created_idx
        ON usage_events(event_type, created_at DESC);
    `);
    await db.query(`
      -- Separate from usage_events (which is append-only and can grow
      -- large) — this is a single row per user, upserted on each My
      -- Stuff visit, specifically to power "what's changed since you
      -- were last here." Reading the OLD value before overwriting it
      -- is what makes that comparison possible at all.
      CREATE TABLE IF NOT EXISTS user_last_seen (
        user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
        page TEXT NOT NULL,
        last_seen_at TIMESTAMPTZ NOT NULL DEFAULT now()
      );
    `);
  })();
  return schemaReady;
}

/** Every query goes through here so the schema is always guaranteed
 *  to exist first — cheap after the first call (ensureSchema's own
 *  promise is cached), so this adds no real overhead. */
export async function query<T extends Record<string, unknown> = Record<string, unknown>>(
  text: string,
  params: unknown[] = []
): Promise<T[]> {
  await ensureSchema();
  const result = await getPool().query(text, params);
  return result.rows as T[];
}
