import "dotenv/config";
import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import postgres from "postgres";

async function run() {
  const url = process.env.DATABASE_URL;
  const migrationClient = postgres(url!, { max: 1 });
  const db = drizzle(migrationClient);

  console.log("Running migrations...");
  try {
    await migrate(db, { migrationsFolder: "./drizzle" });
    console.log("Migrations successful!");
  } catch (error) {
    console.error("Migration failed:");
    console.error(error);
  } finally {
    await migrationClient.end();
  }
}

run();
