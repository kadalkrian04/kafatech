import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { requireUser, audit } from "@/lib/http";

export async function GET(req: Request) {
  const { session, response } = await requireUser(); if (response) return response;
  try { const q = new URL(req.url).searchParams.get("q")?.trim() ?? ""; const sql = getDb();
    const customers = await sql`SELECT c.*, COUNT(w.id)::int AS work_order_count FROM customers c LEFT JOIN work_orders w ON w.customer_id=c.id WHERE (${q}='' OR c.name ILIKE ${`%${q}%`} OR COALESCE(c.company_name,'') ILIKE ${`%${q}%`} OR COALESCE(c.phone,'') ILIKE ${`%${q}%`}) GROUP BY c.id ORDER BY c.created_at DESC LIMIT 250`;
    return NextResponse.json({ customers });
  } catch { return NextResponse.json({ error: "Gagal memuat data pelanggan." }, { status: 500 }); }
}
export async function POST(req: Request) {
  const { session, response } = await requireUser(["admin", "dispatcher"]); if (response) return response;
  try { const b = await req.json(); const name = String(b.name ?? "").trim(); const address = String(b.address ?? "").trim();
    if (!name || !address) return NextResponse.json({ error: "Nama pelanggan dan alamat wajib diisi." }, { status: 400 });
    const sql = getDb(); const rows = await sql`INSERT INTO customers(name,company_name,phone,email,address,city,notes,created_by) VALUES(${name},${String(b.companyName ?? "").trim() || null},${String(b.phone ?? "").trim() || null},${String(b.email ?? "").trim() || null},${address},${String(b.city ?? "").trim() || null},${String(b.notes ?? "").trim() || null},${session!.id}) RETURNING *`;
    await audit(session!.id, "customer.created", "customer", rows[0].id); return NextResponse.json({ customer: rows[0] }, { status: 201 });
  } catch { return NextResponse.json({ error: "Gagal menyimpan pelanggan. Periksa data yang dimasukkan." }, { status: 400 }); }
}
