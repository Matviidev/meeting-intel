import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { sql } from 'drizzle-orm';
import type { Db } from './client.js';
import { schemaMigrations } from './schema.js';

const migrationsDir = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '../../migrations',
);

export async function migrate(db: Db, dir = migrationsDir): Promise<string[]> {
  await db.execute(
    sql`create table if not exists schema_migrations (name text primary key, applied_at timestamptz not null default now())`,
  );
  const applied = new Set((await db.select().from(schemaMigrations)).map((m) => m.name));
  const files = (await readdir(dir)).filter((f) => f.endsWith('.sql')).sort();
  const ran: string[] = [];

  for (const file of files) {
    if (applied.has(file)) continue;
    const body = await readFile(path.join(dir, file), 'utf8');
    await db.transaction(async (tx) => {
      for (const statement of splitStatements(body)) await tx.execute(sql.raw(statement));
      await tx.insert(schemaMigrations).values({ name: file });
    });
    ran.push(file);
  }
  return ran;
}

export function splitStatements(body: string): string[] {
  return body
    .split(/;\s*(?:\n|$)/)
    .map((s) => s.trim())
    .filter(Boolean);
}
