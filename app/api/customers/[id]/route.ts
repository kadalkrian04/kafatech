import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { requireUser, audit } from "@/lib/http";
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
 const { session, response } = await requireUser(["admin", "dispatcher"]); if (response) return response;
 const { id } = await params; if (!/^\d+$/.test(id)) return NextResponse.json({ error: "ID pelanggan tidak valid." }, { status: 400 });
 try { const b = await req.json(); const sql = getDb(); const rows = await sql`UPDATE customers SET name=COALESCE(${b.name?.trim?.() || null},name),company_name=COALESCE(${b.companyName?.trim?.() || null},company_name),phone=COALESCE(${b.phone?.trim?.() || null},phone),email=COALESCE(${b.email?.trim?.() || null},email),address=COALESCE(${b.address?.trim?.() || null},address),city=COALESCE(${b.city?.trim?.() || null},city),notes=COALESCE(${b.notes?.trim?.() || null},notes) WHERE id=${id} RETURNING *`; if (!rows.length) return NextResponse.json({ error: "Pelanggan tidak ditemukan." }, { status: 404 }); await audit(session!.id, "customer.updated", "customer", id); return NextResponse.json({ customer: rows[0] }); }
 catch { return NextResponse.json({ error: "Gagal memperbarui pelanggan." }, { status: 400 }); }
}
export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
 const { session, response } = await requireUser(["admin"]); if (response) return response; const { id } = await params;
 try { const sql = getDb(); const used = await sql`SELECT id FROM work_orders WHERE customer_id=${id} LIMIT 1`; if (used.length) return NextResponse.json({ error: "Pelanggan memiliki riwayat SPK, sehingga tidak dapat dihapus." }, { status: 409 }); const rows = await sql`DELETE FROM customers WHERE id=${id} RETURNING id`; if (!rows.length) return NextResponse.json({ error: "Pelanggan tidak ditemukan." }, { status: 404 }); await audit(session!.id, "customer.deleted", "customer", id); return NextResponse.json({ ok: true }); }
 catch { return NextResponse.json({ error: "Gagal menghapus pelanggan." }, { status: 500 }); }
}
