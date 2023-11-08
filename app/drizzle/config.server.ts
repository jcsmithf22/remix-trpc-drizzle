// import { drizzle } from "drizzle-orm/neon-http";
// import { migrate } from "drizzle-orm/neon-http/migrator";
import * as schema from "./schema.server";
// import postgres from "postgres";
// import { neon, neonConfig } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/libsql";
import { migrate } from "drizzle-orm/libsql/migrator";
import { createClient } from "@libsql/client";

if (!process.env.DATABASE_URL) {
  throw new Error("Missing environment variable DATABASE_URL");
}

if (!process.env.DATABASE_AUTH_TOKEN) {
  throw new Error("Missing environment variable DATABASE_AUTH_TOKEN");
}

// Neon configuration

// neonConfig.fetchConnectionCache = true;

// // const connectionString = process.env.DATABASE_URL;
// // const client = postgres(connectionString, { ssl: true });
// // const migrationClient = postgres(connectionString, { max: 1, ssl: true });
// const client = neon(process.env.DATABASE_URL);

// export const db = drizzle(client, { schema });

const client = createClient({
  url: process.env.DATABASE_URL,
  authToken: process.env.DATABASE_AUTH_TOKEN,
});

export const db = drizzle(client, { schema });

await migrate(db, {
  migrationsFolder: "app/drizzle/migrations",
});
