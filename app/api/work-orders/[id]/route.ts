import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { requireUser } from "@/lib/http";
export async function GET(_req:Request,{params}:{params:Promise<{id:string}>}) {
 const {session,response}=await requireUser();if(response)return response;const {id}=await params;if(!/^\d+$/.test(id))return NextResponse.json({error:"ID SPK tidak valid."},{status:400});
 try {const sql=getDb();const rows=session!.role==="technician"?await sql`SELECT w.*,c.name AS customer_name,c.phone AS customer_phone,c.email AS customer_email,c.address AS customer_address,u.full_name AS technician_name FROM work_orders w LEFT JOIN customers c ON c.id=w.customer_id LEFT JOIN app_users u ON u.id=w.assigned_to WHERE w.id=${id} AND w.assigned_to=${session!.id} LIMIT 1`:await sql`SELECT w.*,c.name AS customer_name,c.phone AS customer_phone,c.email AS customer_email,c.address AS customer_address,u.full_name AS technician_name FROM work_orders w LEFT JOIN customers c ON c.id=w.customer_id LEFT JOIN app_users u ON u.id=w.assigned_to WHERE w.id=${id} LIMIT 1`;if(!rows.length)return NextResponse.json({error:"SPK tidak ditemukan."},{status:404});return NextResponse.json({workOrder:rows[0]});}catch{return NextResponse.json({error:"Gagal memuat detail SPK."},{status:500});}
}
