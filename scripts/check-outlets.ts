import "dotenv/config";
import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import { outlets } from "../src/db/schema";

async function run() {
  const url = process.env.DATABASE_URL;
  const client = postgres(url!);
  const db = drizzle(client);

  const list = await db.select().from(outlets);
  console.log("Daftar Outlet di Database:");
  console.log(list.map(o => ({ id: o.id, name: o.name, slug: o.slug })));

  await client.end();
}

run();
