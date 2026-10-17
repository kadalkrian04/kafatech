import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { requireUser } from "@/lib/http";
export async function GET() { const { response } = await requireUser(["admin","dispatcher"]); if (response) return response; try { const sql=getDb(); const reports=await sql`SELECT r.*,w.spk_number,w.title,w.work_date,w.status AS work_order_status,c.name AS customer_name,u.full_name AS technician_name FROM work_reports r JOIN work_orders w ON w.id=r.work_order_id LEFT JOIN customers c ON c.id=w.customer_id JOIN app_users u ON u.id=r.submitted_by ORDER BY r.submitted_at DESC LIMIT 300`; return NextResponse.json({reports}); } catch { return NextResponse.json({error:"Gagal memuat laporan."},{status:500}); } }
