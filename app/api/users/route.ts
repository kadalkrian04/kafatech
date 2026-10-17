import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { getDb } from "@/lib/db";
import { requireUser, audit } from "@/lib/http";

export async function GET() {
  const { session, response } = await requireUser(["admin", "dispatcher"]);
  if (response) return response;
  try {
    const sql = getDb();
    const users = session!.role === "admin"
      ? await sql`SELECT id,username,full_name,role,is_active,created_at FROM app_users ORDER BY created_at DESC`
      : await sql`SELECT id,full_name,role,is_active FROM app_users WHERE role='technician' AND is_active=TRUE ORDER BY full_name`;
    return NextResponse.json({ users });
  } catch {
    return NextResponse.json({ error: "Gagal memuat akun." }, { status: 500 });
  }
}

export async function POST(req: Request) {
  const { session, response } = await requireUser(["admin"]);
  if (response) return response;
  try {
    const b = await req.json();
    const username = typeof b.username === "string" ? b.username.trim() : "";
    const fullName = typeof b.fullName === "string" ? b.fullName.trim() : "";
    const password = typeof b.password === "string" ? b.password : "";
    const role = String(b.role ?? "");
    if (!/^[a-zA-Z0-9._-]{3,60}$/.test(username) || !fullName || fullName.length > 120 || password.length < 12 || password.length > 200 || !["admin", "dispatcher", "technician"].includes(role)) {
      return NextResponse.json({ error: "Data tidak valid. Username 3–60 karakter dan password minimal 12 karakter." }, { status: 400 });
    }
    const sql = getDb();
    const hash = await bcrypt.hash(password, 12);
    const rows = await sql`INSERT INTO app_users(username,full_name,password_hash,role) VALUES(${username},${fullName},${hash},${role}) RETURNING id,username,full_name,role,is_active`;
    await audit(session!.id, "user.created", "app_user", rows[0].id, { username, role });
    return NextResponse.json({ user: rows[0] }, { status: 201 });
  } catch {
    return NextResponse.json({ error: "Gagal membuat akun. Username mungkin sudah digunakan." }, { status: 400 });
  }
}
