import { Pool } from "pg";
import { drizzle, type NodePgDatabase } from "drizzle-orm/node-postgres";
import * as schema from "./schema";

type Database = NodePgDatabase<typeof schema>;

const globalForDb = globalThis as unknown as {
  __azubiportalPool?: Pool;
  __azubiportalDb?: Database;
};

function createPool(): Pool {
  if (!process.env.DATABASE_URL) {
    throw new Error(
      "DATABASE_URL ist nicht gesetzt. Ohne Verbindungszeichenfolge kann die Anwendung nicht auf die Datenbank zugreifen.",
    );
  }
  return new Pool({
    connectionString: process.env.DATABASE_URL,
    max: Number(process.env.DATABASE_POOL_MAX ?? 10),
  });
}

function getPool(): Pool {
  if (!globalForDb.__azubiportalPool) {
    const pool = createPool();
    // In der Entwicklung überlebt der Pool den Hot Reload.
    if (process.env.NODE_ENV !== "production") globalForDb.__azubiportalPool = pool;
    else globalForDb.__azubiportalPool = pool;
  }
  return globalForDb.__azubiportalPool;
}

function getDb(): Database {
  if (!globalForDb.__azubiportalDb) {
    globalForDb.__azubiportalDb = drizzle(getPool(), { schema, casing: "snake_case" });
  }
  return globalForDb.__azubiportalDb;
}

/**
 * Verbindung und Abfrage-Schnittstelle werden erst beim ersten Zugriff
 * aufgebaut. Dadurch lässt sich die Anwendung bauen, ohne dass zur Bauzeit
 * eine Datenbank erreichbar sein muss – im Container ist sie das nicht.
 */
function lazy<T extends object>(resolve: () => T): T {
  return new Proxy({} as T, {
    get(_target, property) {
      const instance = resolve() as Record<string | symbol, unknown>;
      const value = instance[property];
      return typeof value === "function" ? value.bind(instance) : value;
    },
    has(_target, property) {
      return property in (resolve() as object);
    },
  });
}

export const pool = lazy(getPool);
export const db = lazy(getDb);
export { schema };
