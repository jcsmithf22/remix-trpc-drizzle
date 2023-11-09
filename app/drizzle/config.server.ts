import * as schema from "./schema.server";
import { drizzle } from "drizzle-orm/libsql";
import { migrate } from "drizzle-orm/libsql/migrator";
import { createClient } from "@libsql/client";

if (!process.env.DATABASE_URL) {
  throw new Error("Missing environment variable DATABASE_URL");
}

if (!process.env.DATABASE_AUTH_TOKEN) {
  throw new Error("Missing environment variable DATABASE_AUTH_TOKEN");
}

const client = createClient({
  url: process.env.DATABASE_URL,
  authToken: process.env.DATABASE_AUTH_TOKEN,
});

export const db = drizzle(client, { schema });

await migrate(db, {
  migrationsFolder: "app/drizzle/migrations",
});
