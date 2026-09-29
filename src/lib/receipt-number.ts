import { eq, and, sql } from "drizzle-orm";
import { transactions } from "../db/schema";

/**
 * Generates receipt number: RST-<device_short>-<seq> or CFE-<device_short>-<seq>
 * Sequence is per-outlet, per-device, auto-incrementing based on existing count.
 */
export async function generateReceiptNumber(
  db: any,
  outletSlug: string,
  deviceId: string,
  outletId: string
): Promise<string> {
  const prefix = outletSlug === "restoran" ? "RST" : "CFE";
  const deviceShort = deviceId.length > 6 ? deviceId.slice(-6) : deviceId;

  // Count existing transactions for this outlet + device to get next sequence
  const [result] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(transactions)
    .where(
      and(
        eq(transactions.outlet_id, outletId),
        eq(transactions.device_id, deviceId)
      )
    );

  const seq = (result?.count ?? 0) + 1;
  const seqStr = String(seq).padStart(6, "0");

  return `${prefix}-${deviceShort}-${seqStr}`;
}
