import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { getDb } from "@/lib/db";
import { createSession } from "@/lib/auth";
export async function POST(req: Request) {
 try { const body=await req.json(); const username=typeof body.username==="string"?body.username.trim():""; const password=typeof body.password==="string"?body.password:""; if(!username||!password)return NextResponse.json({error:"Username dan password wajib diisi."},{status:400}); const sql=getDb(); const rows=await sql`SELECT id,username,full_name,password_hash,role,is_active FROM app_users WHERE username=${username} LIMIT 1`; const user=rows[0]; if(!user||!user.is_active||!(await bcrypt.compare(password,user.password_hash)))return NextResponse.json({error:"Username atau password salah."},{status:401}); await sql`UPDATE app_users SET last_login_at=NOW() WHERE id=${user.id}`; await createSession({id:String(user.id),username:user.username,fullName:user.full_name,role:user.role}); const redirect=user.role==="technician"?"/teknisi":user.role==="dispatcher"?"/dispatcher":"/"; return NextResponse.json({ok:true,redirect,user:{username:user.username,fullName:user.full_name,role:user.role}}); }
 catch(error){console.error("Login failed",error);return NextResponse.json({error:"Login belum dapat diproses. Periksa konfigurasi aplikasi."},{status:503});}
}
