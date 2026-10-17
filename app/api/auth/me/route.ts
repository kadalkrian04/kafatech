import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { getDb } from "@/lib/db";
export async function GET() {
 const session=await getSession(); if(!session)return NextResponse.json({user:null},{status:401});
 try { const sql=getDb(); const rows=await sql`SELECT id,username,full_name,role,is_active FROM app_users WHERE id=${session.id} LIMIT 1`; if(!rows.length||!rows[0].is_active)return NextResponse.json({user:null},{status:401}); return NextResponse.json({user:{id:String(rows[0].id),username:rows[0].username,fullName:rows[0].full_name,role:rows[0].role}}); } catch { return NextResponse.json({error:"Gagal memvalidasi sesi."},{status:503}); }
}
