import pg from 'pg';

// The app's queries are written in SQLite style. This turns them into PostgreSQL
// so the same code runs on Neon (Vercel) and on a local SQLite file.

pg.types.setTypeParser(20, (v) => (v === null ? null : Number(v))); // bigint: COUNT/SUM
pg.types.setTypeParser(1700, (v) => (v === null ? null : Number(v))); // numeric
pg.types.setTypeParser(1082, (v) => v); // date: keep 'YYYY-MM-DD' text

// Tables with an `id` column, so INSERTs can return the new id
const ID_TABLES = new Set(['users', 'plans', 'subscriptions', 'payments', 'pages', 'products', 'rules', 'customers',
  'messages', 'orders', 'knowledge', 'sync_logs']);

export function toPg(sql) {
  let s = sql.replace(/\bIFNULL\s*\(/gi, 'COALESCE(');
  let ignore = false;
  s = s.replace(/INSERT\s+OR\s+IGNORE\s+INTO/gi, () => {
    ignore = true;
    return 'INSERT INTO';
  });
  s = s.trimEnd().replace(/;$/, '');
  if (ignore) s += ' ON CONFLICT DO NOTHING';
  const ins = /^\s*INSERT\s+INTO\s+"?(\w+)"?/i.exec(s);
  if (ins && ID_TABLES.has(ins[1].toLowerCase()) && !/\bRETURNING\b/i.test(s)) s += ' RETURNING id';
  let n = 0;
  s = s.replace(/\?/g, () => `$${++n}`);
  return s;
}

/** SQLite schema text → PostgreSQL DDL */
export function schemaToPg(schema) {
  return schema
    .replace(/INTEGER PRIMARY KEY AUTOINCREMENT/g, 'BIGSERIAL PRIMARY KEY')
    .replace(/\bINTEGER\b/g, 'BIGINT')
    .replace(/\bREAL\b/g, 'DOUBLE PRECISION');
}

// SQLite's datetime()/date()/strftime() with 'now' and '+N days'-style modifiers.
// Times are stored as UTC text 'YYYY-MM-DD HH:MM:SS', exactly like SQLite does.
export const PG_FUNCTIONS = `
CREATE OR REPLACE FUNCTION sp_ts(v text, mods text[]) RETURNS timestamp LANGUAGE plpgsql VOLATILE AS $$
DECLARE t timestamp; m text;
BEGIN
  IF v IS NULL THEN RETURN NULL; END IF;
  IF v = 'now' THEN t := (now() AT TIME ZONE 'utc'); ELSE t := v::timestamp; END IF;
  IF mods IS NOT NULL THEN
    FOREACH m IN ARRAY mods LOOP t := t + m::interval; END LOOP;
  END IF;
  RETURN t;
END $$;

CREATE OR REPLACE FUNCTION datetime(v text, VARIADIC mods text[] DEFAULT '{}'::text[]) RETURNS text LANGUAGE sql VOLATILE AS $$
  SELECT to_char(sp_ts(v, mods), 'YYYY-MM-DD HH24:MI:SS')
$$;

CREATE OR REPLACE FUNCTION "date"(v text, VARIADIC mods text[] DEFAULT '{}'::text[]) RETURNS date LANGUAGE sql VOLATILE AS $$
  SELECT sp_ts(v, mods)::date
$$;

CREATE OR REPLACE FUNCTION "date"(v date, VARIADIC mods text[] DEFAULT '{}'::text[]) RETURNS date LANGUAGE sql VOLATILE AS $$
  SELECT sp_ts(v::text, mods)::date
$$;

CREATE OR REPLACE FUNCTION strftime(fmt text, v text) RETURNS text LANGUAGE sql VOLATILE AS $$
  SELECT to_char(sp_ts(v, '{}'::text[]),
    replace(replace(replace(replace(replace(replace(fmt, '%Y', 'YYYY'), '%m', 'MM'), '%d', 'DD'), '%H', 'HH24'), '%M', 'MI'), '%S', 'SS'))
$$;
`;

export function createPool(url) {
  return new pg.Pool({ connectionString: url, max: 3, idleTimeoutMillis: 10_000, connectionTimeoutMillis: 15_000 });
}
