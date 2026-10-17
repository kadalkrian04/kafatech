import { NextResponse } from "next/server";
import { getSession, type SessionUser } from "@/lib/auth";
import { getDb } from "@/lib/db";

export async function requireUser(roles?: SessionUser["role"][]) {
  const session = await getSession();
  if (!session) return { session: null, response: NextResponse.json({ error: "Sesi tidak valid. Silakan login kembali." }, { status: 401 }) };
  try {
    const sql = getDb();
    const rows = await sql`SELECT is_active, role FROM app_users WHERE id=${session.id} LIMIT 1`;
    if (!rows.length || !rows[0].is_active || rows[0].role !== session.role) return { session: null, response: NextResponse.json({ error: "Akun tidak aktif atau sesi sudah tidak berlaku." }, { status: 401 }) };
  } catch {
    return { session: null, response: NextResponse.json({ error: "Layanan belum siap. Periksa konfigurasi database." }, { status: 503 }) };
  }
  if (roles && !roles.includes(session.role)) return { session: null, response: NextResponse.json({ error: "Anda tidak memiliki izin untuk tindakan ini." }, { status: 403 }) };
  return { session, response: null };
}

export async function audit(actorId: string, action: string, entityType: string, entityId?: string | number | null, details: Record<string, unknown> = {}) {
  try {
    const sql = getDb();
    await sql`INSERT INTO audit_logs(actor_id,action,entity_type,entity_id,details) VALUES(${actorId},${action},${entityType},${entityId == null ? null : String(entityId)},${JSON.stringify(details)}::jsonb)`;
  } catch (error) { console.error("Audit log failed", error); }
}

export function errorResponse(error: unknown, message = "Permintaan gagal diproses.") {
  console.error(error);
  return NextResponse.json({ error: message }, { status: 500 });
}
