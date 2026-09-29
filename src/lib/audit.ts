import { audit_logs } from "../db/schema";

interface AuditData {
  outlet_id?: string | null;
  user_id: string;
  action: string;
  entity_type: string;
  entity_id?: string | null;
  before_data?: any;
  after_data?: any;
}

/**
 * Creates an audit log entry.
 * Should be called inside a transaction if part of a larger operation.
 */
export async function logAudit(db: any, data: AuditData) {
  await db.insert(audit_logs).values({
    outlet_id: data.outlet_id ?? null,
    user_id: data.user_id,
    action: data.action,
    entity_type: data.entity_type,
    entity_id: data.entity_id ?? null,
    before_data: data.before_data ? JSON.stringify(data.before_data) : null,
    after_data: data.after_data ? JSON.stringify(data.after_data) : null,
  });
}
