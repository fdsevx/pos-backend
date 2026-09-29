import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";

export function createDb(connectionString: string) {
  const client = postgres(connectionString, {
    prepare: false, // required for Hyperdrive/transaction pooling
  });
  return drizzle(client);
}
