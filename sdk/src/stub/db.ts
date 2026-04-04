import postgres from 'postgres'
import { readFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))

let _sql: postgres.Sql | null = null

export function getSql(): postgres.Sql {
  if (!_sql) {
    const url = process.env['SOLIDUS_STUB_DB_URL']
    if (!url) throw new Error('SOLIDUS_STUB_DB_URL is required when SOLIDUS_SDK_MODE=stub')
    _sql = postgres(url, { max: 5 })
  }
  return _sql
}

export async function runMigrations(): Promise<void> {
  const sql = getSql()
  const migrationPath = join(__dirname, 'migrations', '001_stub_schema.sql')
  const migration = readFileSync(migrationPath, 'utf-8')
  await sql.unsafe(migration)
}

export async function closeConnection(): Promise<void> {
  if (_sql) {
    await _sql.end()
    _sql = null
  }
}
