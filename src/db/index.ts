import { drizzle } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'
import * as schema from './schema'

function createDb() {
  const client = postgres(process.env.DATABASE_URL!, { prepare: false })
  return drizzle(client, { schema })
}

type Db = ReturnType<typeof createDb>

// Persist the connection across hot-module reloads in dev to avoid cold-start latency
const g = globalThis as typeof globalThis & { _db?: Db }
if (!g._db) g._db = createDb()

export const db: Db = g._db
