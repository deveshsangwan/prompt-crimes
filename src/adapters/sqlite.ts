export interface SqliteDatabase {
  prepare(query: string): SqliteStatement;
  close(): void;
}

export interface SqliteStatement {
  all(...params: unknown[]): unknown[];
}

type DatabaseConstructor = new (
  path: string,
  options?: { readonly?: boolean; readOnly?: boolean }
) => SqliteDatabase;

const dynamicImport = new Function("specifier", "return import(specifier)") as (
  specifier: string
) => Promise<unknown>;

export async function openReadonlyDatabase(path: string): Promise<SqliteDatabase | null> {
  const nodeSqlite = await tryNodeSqlite(path);
  if (nodeSqlite) return nodeSqlite;
  return tryBetterSqlite(path);
}

async function tryNodeSqlite(path: string): Promise<SqliteDatabase | null> {
  try {
    const mod = (await dynamicImport("node:sqlite")) as {
      DatabaseSync?: new (path: string, options?: { readOnly?: boolean }) => SqliteDatabase;
    };
    if (!mod.DatabaseSync) return null;
    return new mod.DatabaseSync(path, { readOnly: true });
  } catch {
    return null;
  }
}

async function tryBetterSqlite(path: string): Promise<SqliteDatabase | null> {
  try {
    const mod = (await dynamicImport("better-sqlite3")) as {
      default?: DatabaseConstructor;
    } & DatabaseConstructor;
    const Database = mod.default ?? mod;
    return new Database(path, { readonly: true });
  } catch {
    return null;
  }
}
