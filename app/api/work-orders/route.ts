import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { requireUser, audit } from "@/lib/http";

const statusValues = ["scheduled", "assigned", "in_progress", "report_submitted", "revision_required", "completed", "cancelled"];
const priorityValues = ["low", "normal", "high", "urgent"];
const validDate = (v: unknown) => typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v) && !Number.isNaN(Date.parse(`${v}T00:00:00Z`));

export async function GET(req: Request) {
  const { session, response } = await requireUser(); if (response) return response;
  try {
    const sql = getDb(); const url = new URL(req.url); const date = url.searchParams.get("date"); const status = url.searchParams.get("status");
    const rows = session!.role === "technician"
      ? await sql`SELECT w.*, c.name AS customer_name, c.phone AS customer_phone, u.full_name AS technician_name FROM work_orders w LEFT JOIN customers c ON c.id=w.customer_id LEFT JOIN app_users u ON u.id=w.assigned_to WHERE w.assigned_to=${session!.id} AND (${date}::date IS NULL OR w.work_date=${date}::date) ORDER BY w.work_date,w.start_time`
      : await sql`SELECT w.*, c.name AS customer_name, c.phone AS customer_phone, u.full_name AS technician_name FROM work_orders w LEFT JOIN customers c ON c.id=w.customer_id LEFT JOIN app_users u ON u.id=w.assigned_to WHERE (${date}::date IS NULL OR w.work_date=${date}::date) AND (${status}::text IS NULL OR w.status=${status}) ORDER BY w.work_date DESC,w.start_time`;
    return NextResponse.json({ workOrders: rows });
  } catch (e) { return NextResponse.json({ error: "Gagal memuat SPK." }, { status: 500 }); }
}

export async function POST(req: Request) {
  const { session, response } = await requireUser(["admin", "dispatcher"]); if (response) return response;
  try {
    const b = await req.json();
    const customerName = String(b.customerName ?? b.customer ?? "").trim();
    const title = String(b.title ?? b.jobType ?? b.task ?? "").trim();
    const location = String(b.location ?? b.address ?? "").trim();
    if (!customerName || !title || !location || !validDate(b.workDate)) return NextResponse.json({ error: "Nama pelanggan, jenis pekerjaan, lokasi, dan tanggal kerja yang valid wajib diisi." }, { status: 400 });
    if (b.startTime && !/^([01]\d|2[0-3]):[0-5]\d$/.test(b.startTime)) return NextResponse.json({ error: "Format waktu mulai tidak valid." }, { status: 400 });
    if (b.endTime && !/^([01]\d|2[0-3]):[0-5]\d$/.test(b.endTime)) return NextResponse.json({ error: "Format waktu selesai tidak valid." }, { status: 400 });
    if (b.startTime && b.endTime && b.endTime <= b.startTime) return NextResponse.json({ error: "Waktu selesai harus setelah waktu mulai." }, { status: 400 });
    const sql = getDb();
    let customerId: string;
    if (b.customerId) {
      const found = await sql`SELECT id FROM customers WHERE id=${String(b.customerId)} LIMIT 1`;
      if (!found.length) return NextResponse.json({ error: "Pelanggan tidak ditemukan." }, { status: 400 });
      customerId = String(found[0].id);
    } else {
      const found = await sql`SELECT id FROM customers WHERE lower(name)=lower(${customerName}) LIMIT 1`;
      if (found.length) customerId = String(found[0].id);
      else {
        const created = await sql`INSERT INTO customers(name,phone,address,created_by) VALUES(${customerName},${String(b.customerPhone ?? "").trim() || null},${location},${session!.id}) RETURNING id`;
        customerId = String(created[0].id);
      }
    }
    const technicianId = b.technicianId || b.assignedTo ? String(b.technicianId ?? b.assignedTo) : null;
    if (technicianId) {
      const tech = await sql`SELECT id FROM app_users WHERE id=${technicianId} AND role='technician' AND is_active=TRUE LIMIT 1`;
      if (!tech.length) return NextResponse.json({ error: "Akun teknisi tidak ditemukan atau tidak aktif." }, { status: 400 });
    }
    const datePart = String(b.workDate).replaceAll("-", "").slice(2);
    const spkNumber = `SPK-${datePart}-${crypto.randomUUID().slice(0, 8).toUpperCase()}`;
    const priority = priorityValues.includes(b.priority) ? b.priority : (b.priority === "Urgent" ? "urgent" : "normal");
    const rows = await sql`INSERT INTO work_orders(spk_number,title,description,service_type,customer_id,assigned_to,created_by,work_date,start_time,end_time,location,priority,status) VALUES(${spkNumber},${title},${String(b.description ?? "").trim() || null},${title},${customerId},${technicianId},${session!.id},${b.workDate}::date,${b.startTime || null},${b.endTime || null},${location},${priority},${technicianId ? "assigned" : "scheduled"}) RETURNING *`;
    await audit(session!.id, "work_order.created", "work_order", rows[0].id, { spkNumber });
    return NextResponse.json({ workOrder: { ...rows[0], customer_name: customerName } }, { status: 201 });
  } catch (e) { return NextResponse.json({ error: "Gagal membuat SPK. Periksa data dan konfigurasi database." }, { status: 500 }); }
}

export async function PATCH(req: Request) {
  const { session, response } = await requireUser(["admin", "dispatcher"]); if (response) return response;
  try {
    const b = await req.json(); const id = String(b.id ?? "");
    if (!/^\d+$/.test(id)) return NextResponse.json({ error: "ID SPK tidak valid." }, { status: 400 });
    if (b.status && (!statusValues.includes(b.status) || b.status === "completed" || b.status === "report_submitted")) return NextResponse.json({ error: "Status tersebut hanya dapat ditetapkan melalui alur laporan dan persetujuan." }, { status: 400 });
    const sql = getDb();
    const hasTechnician = Object.prototype.hasOwnProperty.call(b, "technicianId");
    const technicianId = b.technicianId === null || b.technicianId === "" ? null : b.technicianId == null ? undefined : String(b.technicianId);
    if (technicianId) { const t = await sql`SELECT id FROM app_users WHERE id=${technicianId} AND role='technician' AND is_active=TRUE`; if (!t.length) return NextResponse.json({ error: "Teknisi tidak valid." }, { status: 400 }); }
    const nextStatus = b.status ?? (hasTechnician ? (technicianId ? "assigned" : "scheduled") : null);
    if (nextStatus && !statusValues.includes(nextStatus)) return NextResponse.json({ error: "Status SPK tidak valid." }, { status: 400 });
    if (nextStatus === "completed" || nextStatus === "report_submitted") return NextResponse.json({ error: "Status tersebut hanya dapat ditetapkan melalui alur laporan dan persetujuan." }, { status: 400 });
    const rows = await sql`UPDATE work_orders SET assigned_to=CASE WHEN ${hasTechnician} THEN ${technicianId ?? null}::bigint ELSE assigned_to END,status=COALESCE(${nextStatus},status),priority=COALESCE(${b.priority && priorityValues.includes(b.priority) ? b.priority : null},priority),admin_notes=COALESCE(${b.adminNotes ?? null},admin_notes),updated_at=NOW() WHERE id=${id} AND status <> 'completed' RETURNING *`;
    if (!rows.length) return NextResponse.json({ error: "SPK tidak ditemukan atau sudah selesai." }, { status: 404 });
    await audit(session!.id, "work_order.updated", "work_order", id, b);
    return NextResponse.json({ workOrder: rows[0] });
  } catch (e) { return NextResponse.json({ error: "Gagal memperbarui SPK." }, { status: 500 }); }
}
