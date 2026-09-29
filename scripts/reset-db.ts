import "dotenv/config";
import postgres from "postgres";

async function run() {
  const url = process.env.DATABASE_URL;
  const client = postgres(url!, { prepare: false });

  console.log("Wiping public schema...");
  try {
    await client`DROP SCHEMA public CASCADE;`;
    await client`CREATE SCHEMA public;`;
    await client`GRANT ALL ON SCHEMA public TO postgres;`;
    await client`GRANT ALL ON SCHEMA public TO public;`;
    console.log("Database wiped clean.");
  } catch (error) {
    console.error("Wipe failed:", error);
  } finally {
    await client.end();
  }
}

run();
