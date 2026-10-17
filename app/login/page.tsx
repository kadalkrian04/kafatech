"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { ShieldCheck, LockKeyhole, UserRound, LoaderCircle } from "lucide-react";

export default function LoginPage() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const router = useRouter();

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: username.trim(), password }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Login gagal. Periksa username dan password.");
      router.replace(data.redirect || "/");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Login gagal. Coba lagi.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="login-shell">
      <section className="login-brand-panel">
        <div className="login-brand-lockup">
          <div className="login-brand-icon"><ShieldCheck size={27} /></div>
          <div><b>KAFAGU TECH</b><span>PROSPEROUS · FIELD OPERATIONS</span></div>
        </div>
        <div className="login-brand-copy">
          <div className="login-eyebrow">FIELD OPERATIONS MANAGEMENT</div>
          <h1>Semua pekerjaan.<br />Satu kendali.</h1>
          <p>Kelola SPK, koordinasi teknisi, pantau progres, dan verifikasi dokumentasi dalam satu workspace.</p>
        </div>
        <small className="login-copyright">© 2026 PT. Kafagu Tech Prosperous</small>
      </section>
      <section className="login-form-panel">
        <form onSubmit={submit} className="login-form">
          <div className="login-form-icon"><LockKeyhole size={22} /></div>
          <h2>Selamat datang</h2>
          <p className="login-intro">Masuk menggunakan akun yang diberikan Admin.</p>
          <label htmlFor="username">Username</label>
          <div className="login-input-wrap"><UserRound size={17} aria-hidden="true" /><input id="username" name="username" value={username} onChange={e => setUsername(e.target.value)} autoComplete="username" required placeholder="Masukkan username" /></div>
          <label htmlFor="password">Password</label>
          <div className="login-input-wrap"><LockKeyhole size={17} aria-hidden="true" /><input id="password" name="password" type="password" value={password} onChange={e => setPassword(e.target.value)} autoComplete="current-password" required placeholder="Masukkan password" /></div>
          {error && <p className="login-error" role="alert">{error}</p>}
          <button className="login-submit" type="submit" disabled={busy}>{busy && <LoaderCircle size={17} className="login-spinner" />}<span>{busy ? "Memeriksa akun…" : "Masuk ke dashboard"}</span></button>
          <p className="login-help">Tidak ada pendaftaran mandiri. Hubungi Admin untuk membuat atau mengatur akun.</p>
        </form>
      </section>
    </main>
  );
}
