"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { 
  CalendarDays, Camera, CheckCircle2, LogOut, MapPin, RefreshCw, 
  ShieldCheck, UploadCloud, Wrench, X, Sparkles, Image as ImageIcon, CheckCircle 
} from "lucide-react";

type Work = { id: string; spk_number: string; customer_name: string; customer_phone?: string; title: string; location: string; work_date: string; start_time: string | null; end_time: string | null; status: string; progress_percent: number; description?: string };
type Photo = { id?: string; file_url: string; photo_type: string; file_name?: string };
type ChecklistItem = { label: string; checked: boolean };

const statusLabels: Record<string, string> = { scheduled: "Menunggu", assigned: "Ditugaskan", in_progress: "Sedang dikerjakan", report_submitted: "Menunggu verifikasi", revision_required: "Perlu revisi", completed: "Selesai", cancelled: "Dibatalkan" };
const defaultChecklist = ["Kamera dan perangkat berfungsi", "Kabel dan konektor diperiksa", "Sudut pandang kamera sesuai", "NVR / jaringan diuji", "Area kerja dirapikan"];

export default function TechnicianPage() {
  const [works, setWorks] = useState<Work[]>([]);
  const [user, setUser] = useState<{ fullName: string; role: string } | null>(null);
  const [selected, setSelected] = useState("");
  const [progress, setProgress] = useState(0);
  const [notes, setNotes] = useState("");
  const [photos, setPhotos] = useState<Record<string, Photo[]>>({});
  const [checklist, setChecklist] = useState<ChecklistItem[]>(defaultChecklist.map(label => ({ label, checked: false })));
  const [summary, setSummary] = useState("");
  const [materials, setMaterials] = useState("");
  const [issues, setIssues] = useState("");
  const [recommendations, setRecommendations] = useState("");
  const [customerName, setCustomerName] = useState("");
  const [customerConfirmed, setCustomerConfirmed] = useState(false);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const [tab, setTab] = useState("active");
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const drawing = useRef(false);
  const hasSignature = useRef(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [meRes, jRes] = await Promise.all([
        fetch("/api/auth/me", { cache: "no-store" }),
        fetch("/api/work-orders", { cache: "no-store" })
      ]);
      const me = await meRes.json();
      if (!meRes.ok) throw new Error(me.error || "Sesi tidak valid. Silakan login kembali.");
      setUser(me.user);
      
      const jd = await jRes.json();
      if (!jRes.ok) throw new Error(jd.error || "Gagal memuat tugas");
      const list: Work[] = jd.workOrders || [];
      setWorks(list);
      setSelected(old => list.some(w => String(w.id) === old) ? old : (list[0] ? String(list[0].id) : ""));
    } catch (e) {
      setNotice(e instanceof Error ? e.message : "Gagal memuat data");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load() }, [load]);
  
  const active = works.find(w => String(w.id) === selected);
  const visible = useMemo(() => works.filter(w => tab === "history" ? ["completed", "cancelled"].includes(w.status) : !["completed", "cancelled"].includes(w.status)), [works, tab]);
  const currentPhotos = photos[selected] || [];

  useEffect(() => {
    if (!active) return;
    setProgress(active.progress_percent);
    setNotes("");
    setChecklist(defaultChecklist.map(label => ({ label, checked: false })));
    setSummary("");
    setMaterials("");
    setIssues("");
    setRecommendations("");
    setCustomerName("");
    setCustomerConfirmed(false);
    hasSignature.current = false;
    
    const c = canvasRef.current;
    if (c) {
      const ctx = c.getContext("2d");
      ctx?.clearRect(0, 0, c.width, c.height);
    }
    
    let alive = true;
    fetch(`/api/work-orders/${active.id}/report`, { cache: "no-store" })
      .then(async r => {
        const d = await r.json();
        if (alive && r.ok) {
          setPhotos(old => ({ ...old, [String(active.id)]: d.photos || [] }));
          if (d.report) {
            setSummary(d.report.work_summary || "");
            setMaterials(Array.isArray(d.report.materials_used) ? d.report.materials_used.join(", ") : "");
            setIssues(d.report.issues_found || "");
            setRecommendations(d.report.recommendations || "");
            setCustomerName(d.report.customer_name_signed || "");
            setChecklist(Array.isArray(d.report.checklist) ? d.report.checklist : defaultChecklist.map(label => ({ label, checked: false })));
          }
        }
      }).catch(() => { });
    return () => { alive = false };
  }, [selected]);

  const notify = (s: string) => setNotice(s);

  async function logout() {
    setBusy(true);
    try { await fetch("/api/auth/logout", { method: "POST", credentials: "same-origin" }); }
    catch { /* Redirect tetap dilakukan */ }
    finally { window.location.assign("/login"); }
  }

  async function uploadFile(file: File, kind: string) {
    const form = new FormData();
    form.append("file", file);
    form.append("kind", kind);
    const r = await fetch("/api/uploads", { method: "POST", body: form });
    const d = await r.json();
    if (!r.ok) throw new Error(d.error || "Upload gagal");
    return d as { url: string; originalName: string; mimeType: string; size: number };
  }

  async function addPhotos(files: FileList | null, kind: "before" | "during" | "after") {
    if (!files || !files.length || !active) return;
    setBusy(true);
    try {
      const added: Photo[] = [];
      for (const file of Array.from(files)) {
        if (!file.type.startsWith("image/")) throw new Error("Hanya file gambar yang diperbolehkan.");
        const uploaded = await uploadFile(file, `work-photo-${kind}`);
        const r = await fetch(`/api/work-orders/${active.id}/photos`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ photoType: kind, fileUrl: uploaded.url, fileName: uploaded.originalName, mimeType: uploaded.mimeType, fileSizeBytes: uploaded.size })
        });
        const d = await r.json();
        if (!r.ok) throw new Error(d.error || "Gagal menyimpan foto");
        added.push(d.photo);
      }
      setPhotos(old => ({ ...old, [selected]: [...(old[selected] || []), ...added] }));
      notify("Foto berhasil diunggah.");
    } catch (e) {
      notify(e instanceof Error ? e.message : "Upload foto gagal");
    } finally {
      setBusy(false);
    }
  }

  async function saveProgress() {
    if (!active) return;
    if (!notes.trim()) { notify("Catatan progres wajib diisi."); return; }
    setBusy(true);
    try {
      const r = await fetch(`/api/work-orders/${active.id}/progress`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ progress, note: notes.trim() })
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || "Gagal menyimpan progres");
      notify("Progres tersimpan.");
      await load();
    } catch (e) {
      notify(e instanceof Error ? e.message : "Gagal menyimpan progres");
    } finally {
      setBusy(false);
    }
  }

  function startDraw(e: React.PointerEvent<HTMLCanvasElement>) {
    const c = canvasRef.current;
    if (!c) return;
    drawing.current = true;
    c.setPointerCapture(e.pointerId);
    const rect = c.getBoundingClientRect();
    const ctx = c.getContext("2d");
    if (!ctx) return;
    ctx.strokeStyle = "#1e40af"; // Deep blue
    ctx.lineWidth = 2.5;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.beginPath();
    ctx.moveTo((e.clientX - rect.left) * c.width / rect.width, (e.clientY - rect.top) * c.height / rect.height);
  }

  function draw(e: React.PointerEvent<HTMLCanvasElement>) {
    if (!drawing.current) return;
    const c = canvasRef.current;
    if (!c) return;
    const rect = c.getBoundingClientRect();
    const ctx = c.getContext("2d");
    if (!ctx) return;
    ctx.lineTo((e.clientX - rect.left) * c.width / rect.width, (e.clientY - rect.top) * c.height / rect.height);
    ctx.stroke();
    hasSignature.current = true;
  }

  function stopDraw() { drawing.current = false; }

  async function submitReport() {
    if (!active) return;
    if (progress !== 100) { notify("Atur progres menjadi 100% sebelum mengirim laporan."); return; }
    if (!summary.trim()) { notify("Ringkasan pekerjaan wajib diisi."); return; }
    if (checklist.some(x => !x.checked)) { notify("Semua item checklist teknis harus diperiksa."); return; }
    if (!currentPhotos.some(p => p.photo_type === "before") || !currentPhotos.some(p => p.photo_type === "after")) { notify("Foto sebelum dan sesudah wajib diunggah."); return; }
    if (!customerName.trim() || !customerConfirmed || !hasSignature.current) { notify("Nama, tanda tangan, dan konfirmasi pelanggan wajib lengkap."); return; }
    
    setBusy(true);
    try {
      const canvas = canvasRef.current!;
      const blob: Blob = await new Promise((resolve, reject) => canvas.toBlob(b => b ? resolve(b) : reject(new Error("Tanda tangan gagal diproses")), "image/png"));
      const signatureFile = new File([blob], "customer-signature.png", { type: "image/png" });
      const uploaded = await uploadFile(signatureFile, "customer-signature");
      
      const r = await fetch(`/api/work-orders/${active.id}/report`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ workSummary: summary.trim(), materialsUsed: materials.split(/[,\n]/).map(x => x.trim()).filter(Boolean), checklist, issuesFound: issues, recommendations, customerNameSigned: customerName.trim(), customerSignatureUrl: uploaded.url, customerConfirmed: true })
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || "Gagal mengirim laporan");
      notify("Laporan berhasil dikirim. SPK menunggu verifikasi admin.");
      await load();
    } catch (e) {
      notify(e instanceof Error ? e.message : "Gagal mengirim laporan");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 font-sans pb-24 lg:pb-12">
      
      {/* Header */}
      <header className="bg-white border-b border-slate-200 px-4 md:px-8 py-3 flex items-center justify-between sticky top-0 z-30 shadow-sm">
        <a href="/" className="flex items-center gap-3 decoration-none">
          <div className="bg-blue-600 text-white w-9 h-9 flex items-center justify-center rounded-xl font-bold text-lg shadow-sm">
            K
          </div>
          <div className="leading-tight">
            <b className="text-slate-800 text-sm md:text-base tracking-wide">KAFAGU <span className="text-blue-600">TECH</span></b>
            <small className="block text-[10px] text-slate-500 font-semibold tracking-[0.1em]">FIELD SERVICE</small>
          </div>
        </a>
        
        <div className="flex items-center gap-3">
          {/* Tombol Refresh */}
          <button onClick={() => void load()} className="p-2 text-slate-400 hover:text-blue-600 border border-slate-200 rounded-full bg-slate-50 hover:bg-blue-50 transition-colors" title="Muat ulang data">
            <RefreshCw size={16} className={loading ? "animate-spin" : ""} />
          </button>
          
          {/* Avatar (disembunyikan di HP biar hemat tempat) */}
          <div className="hidden md:flex w-9 h-9 rounded-full bg-blue-100 text-blue-700 items-center justify-center font-bold text-sm border border-blue-200">
            {user?.fullName?.split(" ").map(n => n[0]).join("").substring(0, 2).toUpperCase() || "AP"}
          </div>

          {/* Tombol Logout */}
          <button onClick={() => void logout()} disabled={busy} className="flex items-center gap-2 px-3 py-2 bg-red-50 hover:bg-red-100 text-red-600 border border-red-200 rounded-xl text-xs font-bold transition-colors disabled:opacity-50 ml-1">
            <LogOut size={14} /> <span className="hidden sm:inline">Logout</span>
          </button>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 md:px-6 mt-6">
        
        {/* Top Greeting (Tombol kembali ke admin panel sudah dihapus) */}
        <div className="mb-8">
          <div className="flex items-center gap-2 text-emerald-500 text-xs font-extrabold tracking-widest uppercase mb-1">
            <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></div>
            Technician Workspace
          </div>
          <h1 className="text-3xl md:text-4xl font-extrabold text-slate-900 tracking-tight flex items-center gap-2">
            Halo, {user?.fullName?.split(" ")[0] || "Teknisi"} <Sparkles className="text-blue-500" size={28} />
          </h1>
          <p className="text-slate-500 mt-2 text-sm md:text-base">
            Ini daftar tugasmu hari ini. Kerjakan, dokumentasikan, lalu kirim laporan ke admin.
          </p>
        </div>

        {/* Info Banner */}
        <div className="bg-emerald-50 border border-emerald-100 rounded-2xl p-4 flex items-center gap-4 mb-6 shadow-sm">
          <div className="bg-white p-2 rounded-xl text-emerald-600 shadow-sm">
            <ShieldCheck size={24} />
          </div>
          <div>
            <h3 className="font-bold text-emerald-900 text-sm">Field team aktif</h3>
            <p className="text-emerald-700 text-xs mt-0.5">Semangat, utamakan keselamatan!</p>
          </div>
        </div>

        {/* Dashboard Stats */}
        <div className="grid grid-cols-3 gap-3 md:gap-5 mb-8">
          <div className="bg-white border border-slate-200 rounded-2xl p-4 md:p-5 shadow-sm flex flex-col justify-between">
            <div className="flex items-center gap-2 text-slate-500 mb-3">
              <div className="bg-blue-50 p-1.5 rounded-lg text-blue-500"><CalendarDays size={16}/></div>
              <span className="text-[11px] md:text-xs font-semibold hidden md:inline">Tugas hari ini</span>
            </div>
            <div className="text-2xl md:text-3xl font-extrabold text-slate-800">{works.filter(w => !['completed', 'cancelled'].includes(w.status)).length}</div>
            <div className="text-[10px] md:text-xs text-slate-400 mt-1">SPK ditugaskan</div>
          </div>
          
          <div className="bg-white border border-slate-200 rounded-2xl p-4 md:p-5 shadow-sm flex flex-col justify-between">
            <div className="flex items-center gap-2 text-slate-500 mb-3">
              <div className="bg-purple-50 p-1.5 rounded-lg text-purple-500"><RefreshCw size={16}/></div>
              <span className="text-[11px] md:text-xs font-semibold hidden md:inline">Sedang dikerjakan</span>
            </div>
            <div className="text-2xl md:text-3xl font-extrabold text-slate-800">{works.filter(w => w.status === 'in_progress').length}</div>
            <div className="text-[10px] md:text-xs text-slate-400 mt-1">Perlu diperbarui</div>
          </div>

          <div className="bg-white border border-slate-200 rounded-2xl p-4 md:p-5 shadow-sm flex flex-col justify-between">
            <div className="flex items-center gap-2 text-slate-500 mb-3">
              <div className="bg-emerald-50 p-1.5 rounded-lg text-emerald-500"><CheckCircle size={16}/></div>
              <span className="text-[11px] md:text-xs font-semibold hidden md:inline">Selesai</span>
            </div>
            <div className="text-2xl md:text-3xl font-extrabold text-slate-800">{works.filter(w => w.status === 'completed').length}</div>
            <div className="text-[10px] md:text-xs text-slate-400 mt-1">Hari ini</div>
          </div>
        </div>

        {/* Main Grid: Job List & Job Details */}
        <div className="grid grid-cols-1 lg:grid-cols-[380px_1fr] gap-6 items-start">
          
          {/* Left Column: Job List */}
          <section className="bg-white border border-slate-200 rounded-3xl overflow-hidden shadow-sm flex flex-col h-full md:max-h-[800px]">
            <div className="p-5 border-b border-slate-100 flex justify-between items-center">
              <div>
                <h2 className="text-[10px] font-extrabold tracking-widest text-slate-400 uppercase">Daftar Pekerjaan</h2>
                <h3 className="font-bold text-xl text-slate-800 mt-1">Tugas saya</h3>
              </div>
              <div className="bg-blue-50 text-blue-600 text-xs font-bold px-3 py-1 rounded-full">
                {visible.length} SPK
              </div>
            </div>
            
            <div className="px-5 pt-2 flex gap-4 border-b border-slate-100">
              <button 
                onClick={() => setTab("active")} 
                className={`pb-3 text-sm font-semibold border-b-2 transition-colors ${tab === "active" ? "border-blue-600 text-blue-700" : "border-transparent text-slate-400 hover:text-slate-600"}`}
              >
                Tugas saya
              </button>
              <button 
                onClick={() => setTab("history")} 
                className={`pb-3 text-sm font-semibold border-b-2 transition-colors ${tab === "history" ? "border-blue-600 text-blue-700" : "border-transparent text-slate-400 hover:text-slate-600"}`}
              >
                Riwayat
              </button>
            </div>

            <div className="overflow-y-auto flex-1 p-3">
              {loading && <p className="p-4 text-center text-sm text-slate-500 animate-pulse">Memuat tugas...</p>}
              {!loading && !visible.length && (
                <div className="p-8 text-center flex flex-col items-center justify-center">
                  <div className="bg-emerald-50 text-emerald-500 p-4 rounded-full mb-4">
                    <CheckCircle size={28} />
                  </div>
                  <b className="text-slate-700">Belum ada pekerjaan di sini</b>
                  <p className="text-xs text-slate-400 mt-2">SPK akan tampil saat ditugaskan admin.</p>
                </div>
              )}
              {visible.map(w => (
                <button 
                  key={w.id} 
                  onClick={() => setSelected(String(w.id))} 
                  className={`w-full text-left p-4 rounded-2xl border mb-3 transition-all ${String(w.id) === selected ? "border-blue-200 bg-blue-50/50 shadow-sm" : "border-slate-100 bg-white hover:border-slate-300 hover:bg-slate-50"}`}
                >
                  <div className="flex justify-between items-start mb-2">
                    <b className="text-sm text-slate-800">{w.customer_name || "Pelanggan"}</b>
                    <span className={`text-[10px] font-bold px-2 py-1 rounded-md ${w.status === 'completed' ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-600'}`}>
                      {statusLabels[w.status] || w.status}
                    </span>
                  </div>
                  <div className="text-xs text-slate-500 mb-3 font-medium">{w.spk_number} · {w.title}</div>
                  <div className="space-y-1.5">
                    <div className="flex items-center gap-2 text-[11px] text-slate-500">
                      <MapPin size={13} className="text-slate-400" /> <span className="truncate">{w.location}</span>
                    </div>
                  </div>
                  <div className="mt-4">
                    <div className="flex justify-between text-[10px] font-bold text-slate-500 mb-1.5">
                      <span>Progres</span>
                      <span className="text-blue-600">{w.progress_percent}%</span>
                    </div>
                    <div className="h-1.5 w-full bg-slate-200 rounded-full overflow-hidden">
                      <div className="h-full bg-blue-600 rounded-full transition-all duration-500" style={{ width: `${w.progress_percent}%` }} />
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </section>

          {/* Right Column: Active Job Details */}
          <section className="bg-white border border-slate-200 rounded-3xl shadow-sm overflow-hidden">
            {!active ? (
              <div className="p-12 text-center text-slate-500 flex flex-col items-center justify-center min-h-[400px]">
                <div className="bg-slate-100 p-4 rounded-full mb-4">
                  <Wrench size={32} className="text-slate-400" />
                </div>
                <h3 className="font-bold text-slate-700 text-lg">Belum ada SPK dipilih</h3>
                <p className="text-sm mt-2 text-slate-400">Pilih pekerjaan di daftar samping untuk melihat detail.</p>
              </div>
            ) : (
              <div>
                {/* Header Detail SPK */}
                <div className="p-6 md:p-8 border-b border-slate-100">
                  <div className="flex justify-between items-start gap-4 mb-2">
                    <small className="text-[10px] font-extrabold tracking-widest text-slate-400 uppercase">DETAIL SPK</small>
                    <span className="bg-slate-100 text-slate-500 text-[10px] font-bold px-3 py-1 rounded-full">
                      {active.spk_number}
                    </span>
                  </div>
                  <h2 className="text-2xl font-extrabold text-slate-900 mt-1 mb-2 leading-tight">Update pekerjaan</h2>
                  <p className="text-sm text-slate-500">Perbarui status, progres, dan dokumentasi.</p>
                  
                  <div className="mt-6 p-4 border border-slate-200 rounded-2xl bg-slate-50 flex items-center justify-between">
                    <div>
                      <h4 className="font-bold text-slate-800 text-sm">{active.customer_name}</h4>
                      <p className="text-xs text-slate-500 mt-1">{active.title}</p>
                      <div className="flex items-center gap-1.5 text-xs text-slate-500 mt-2">
                        <MapPin size={12} /> <span className="truncate max-w-[200px] md:max-w-md">{active.location}</span>
                      </div>
                    </div>
                    {active.customer_phone && (
                      <a href={`tel:${active.customer_phone}`} className="w-10 h-10 rounded-full border border-slate-200 flex items-center justify-center bg-white text-blue-600 hover:bg-blue-50 transition-colors">
                        <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"></path></svg>
                      </a>
                    )}
                  </div>
                </div>

                <div className="p-6 md:p-8">
                  {["report_submitted", "completed", "cancelled"].includes(active.status) ? (
                    <div className="p-5 bg-slate-50 border border-slate-200 rounded-xl text-slate-600 text-sm text-center">
                      SPK dengan status <b className="text-slate-800">{statusLabels[active.status]}</b> tidak dapat diperbarui dari halaman ini.
                    </div>
                  ) : (
                    <div className="space-y-10">
                      
                      {/* Step 1: Progres */}
                      <section>
                        <div className="flex justify-between items-end mb-4">
                          <div>
                            <div className="text-[10px] font-bold text-slate-400 tracking-wider mb-1">01 · STATUS PEKERJAAN</div>
                            <h3 className="text-lg font-bold text-slate-800">Sejauh mana pekerjaanmu?</h3>
                          </div>
                          <span className="text-3xl font-extrabold text-blue-600">{progress}%</span>
                        </div>
                        
                        <div className="mt-6 mb-8">
                          <input type="range" min="0" max="100" step="5" value={progress} onChange={e => setProgress(Number(e.target.value))} className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-blue-600" />
                          <div className="flex justify-between text-[10px] text-slate-400 font-medium mt-3">
                            <span>0% - Belum mulai</span>
                            <span>100% - Selesai</span>
                          </div>
                          <div className="flex gap-2 mt-4">
                            {[0, 25, 50, 75, 100].map(val => (
                              <button key={val} onClick={() => setProgress(val)} className={`flex-1 py-2 rounded-lg text-xs font-bold border transition-colors ${progress === val ? 'bg-blue-50 border-blue-600 text-blue-700' : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'}`}>
                                {val}%
                              </button>
                            ))}
                          </div>
                        </div>

                        <div className="space-y-3">
                          <div className="flex justify-between items-center">
                            <label className="text-sm font-bold text-slate-700">Catatan progres</label>
                            <span className="text-[10px] font-semibold text-slate-400">Opsional</span>
                          </div>
                          <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={3} className="w-full p-4 border border-slate-200 rounded-xl bg-slate-50 text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 focus:bg-white transition-all resize-none" placeholder="Tarik kabel selesai. Pemasangan kamera sedang berjalan..."></textarea>
                          <button disabled={busy} onClick={() => void saveProgress()} className="w-full py-3.5 bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-100 font-bold rounded-xl text-sm flex items-center justify-center gap-2 transition-colors disabled:opacity-50">
                            <CheckCircle2 size={18} /> Simpan progres
                          </button>
                        </div>
                      </section>
                      
                      <hr className="border-slate-100" />

                      {/* Step 2: Foto */}
                      <section>
                        <div className="flex justify-between items-start mb-4">
                          <div>
                            <div className="text-[10px] font-bold text-slate-400 tracking-wider mb-1">02 · BUKTI PEKERJAAN</div>
                            <h3 className="text-lg font-bold text-slate-800">Dokumentasi foto</h3>
                            <p className="text-xs text-slate-500 mt-1">Upload foto sebelum dan sesudah untuk bukti kerja.</p>
                          </div>
                          <div className="flex items-center gap-1.5 px-3 py-1.5 border border-slate-200 rounded-lg text-xs font-semibold text-slate-500 bg-white">
                            <Camera size={14} /> {currentPhotos.length} foto
                          </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-6">
                          {/* Foto Sebelum */}
                          <label className="border-2 border-dashed border-slate-200 hover:border-blue-300 hover:bg-blue-50/30 rounded-2xl p-6 flex flex-col items-center text-center cursor-pointer transition-all">
                            <input type="file" accept="image/*" multiple capture="environment" disabled={busy} onChange={e => { void addPhotos(e.target.files, "before"); e.currentTarget.value = "" }} className="hidden" />
                            <div className="w-12 h-12 rounded-full bg-blue-50 flex items-center justify-center mb-3">
                              <UploadCloud size={24} className="text-blue-600" />
                            </div>
                            <b className="text-sm text-slate-800">Foto sebelum</b>
                            <span className="text-xs text-slate-400 mt-1">Foto kondisi awal</span>
                            <span className="text-blue-600 text-sm font-bold mt-4 flex items-center gap-1"><span className="text-lg leading-none">+</span> Tambah foto</span>
                            {currentPhotos.filter(p => p.photo_type === "before").length > 0 && (
                              <div className="mt-3 text-[10px] font-bold bg-blue-100 text-blue-700 px-2 py-1 rounded">
                                {currentPhotos.filter(p => p.photo_type === "before").length} Terunggah
                              </div>
                            )}
                          </label>

                          {/* Foto Sesudah */}
                          <label className="border-2 border-dashed border-slate-200 hover:border-emerald-300 hover:bg-emerald-50/30 rounded-2xl p-6 flex flex-col items-center text-center cursor-pointer transition-all">
                            <input type="file" accept="image/*" multiple capture="environment" disabled={busy} onChange={e => { void addPhotos(e.target.files, "after"); e.currentTarget.value = "" }} className="hidden" />
                            <div className="w-12 h-12 rounded-full bg-emerald-50 flex items-center justify-center mb-3">
                              <ImageIcon size={24} className="text-emerald-500" />
                            </div>
                            <b className="text-sm text-slate-800">Foto sesudah</b>
                            <span className="text-xs text-slate-400 mt-1">Foto hasil pengerjaan</span>
                            <span className="text-emerald-600 text-sm font-bold mt-4 flex items-center gap-1"><span className="text-lg leading-none">+</span> Tambah foto</span>
                            {currentPhotos.filter(p => p.photo_type === "after").length > 0 && (
                              <div className="mt-3 text-[10px] font-bold bg-emerald-100 text-emerald-700 px-2 py-1 rounded">
                                {currentPhotos.filter(p => p.photo_type === "after").length} Terunggah
                              </div>
                            )}
                          </label>
                        </div>
                      </section>
                      
                      <hr className="border-slate-100" />

                      {/* Step 3: Laporan & TTD */}
                      <section>
                        <div className="text-[10px] font-bold text-slate-400 tracking-wider mb-1">03 · LAPORAN AKHIR</div>
                        <h3 className="text-lg font-bold text-slate-800 mb-4">Penyelesaian Laporan</h3>
                        
                        <div className="space-y-5">
                          <div>
                            <label className="text-sm font-bold text-slate-700 block mb-2">Ringkasan pekerjaan <span className="text-red-500">*</span></label>
                            <textarea value={summary} onChange={e => setSummary(e.target.value)} rows={3} className="w-full p-4 border border-slate-200 rounded-xl bg-slate-50 text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 focus:bg-white transition-all resize-none" placeholder="Jelaskan hasil pekerjaan dan pengujian..."></textarea>
                          </div>
                          
                          <div>
                            <label className="text-sm font-bold text-slate-700 block mb-2">Material digunakan</label>
                            <textarea value={materials} onChange={e => setMaterials(e.target.value)} rows={2} className="w-full p-4 border border-slate-200 rounded-xl bg-slate-50 text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 focus:bg-white transition-all resize-none" placeholder="Contoh: Kabel UTP 20m, Konektor RJ45..."></textarea>
                          </div>

                          <div className="bg-slate-50 border border-slate-200 rounded-xl p-5 mt-6">
                            <h4 className="text-sm font-bold text-slate-800 mb-3">Checklist Teknis</h4>
                            <div className="space-y-3">
                              {checklist.map((item, i) => (
                                <label key={item.label} className="flex items-start gap-3 cursor-pointer group">
                                  <div className="relative flex items-center justify-center mt-0.5">
                                    <input type="checkbox" checked={item.checked} onChange={e => setChecklist(old => old.map((x, n) => n === i ? { ...x, checked: e.target.checked } : x))} className="peer sr-only" />
                                    <div className="w-5 h-5 rounded border-2 border-slate-300 bg-white peer-checked:bg-blue-600 peer-checked:border-blue-600 transition-colors"></div>
                                    <svg className="absolute w-3.5 h-3.5 text-white opacity-0 peer-checked:opacity-100 pointer-events-none transition-opacity" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="3"><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7"></path></svg>
                                  </div>
                                  <span className="text-sm text-slate-700 group-hover:text-slate-900 transition-colors">{item.label}</span>
                                </label>
                              ))}
                            </div>
                          </div>

                          <div className="pt-4">
                            <label className="text-sm font-bold text-slate-700 block mb-2">Nama pelanggan menyetujui <span className="text-red-500">*</span></label>
                            <input type="text" value={customerName} onChange={e => setCustomerName(e.target.value)} className="w-full p-4 border border-slate-200 rounded-xl bg-slate-50 text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 focus:bg-white transition-all" placeholder="Nama lengkap pelanggan" />
                          </div>

                          <div>
                            <div className="flex justify-between items-center mb-2">
                              <label className="text-sm font-bold text-slate-700 block">Tanda tangan pelanggan <span className="text-red-500">*</span></label>
                              <button onClick={() => { const c = canvasRef.current; const ctx = c?.getContext("2d"); if (c && ctx) ctx.clearRect(0, 0, c.width, c.height); hasSignature.current = false }} className="text-[11px] font-bold text-red-500 hover:text-red-700">
                                Hapus
                              </button>
                            </div>
                            <div className="border-2 border-dashed border-slate-300 rounded-xl bg-slate-50 overflow-hidden touch-none relative">
                              {!hasSignature.current && (
                                <span className="absolute inset-0 flex items-center justify-center text-slate-300 text-sm font-medium pointer-events-none">
                                  Tanda tangan di sini
                                </span>
                              )}
                              <canvas ref={canvasRef} width={720} height={200} onPointerDown={startDraw} onPointerMove={draw} onPointerUp={stopDraw} onPointerCancel={stopDraw} className="w-full h-[150px] md:h-[200px] bg-transparent cursor-crosshair relative z-10" />
                            </div>
                          </div>

                          <label className="flex items-start gap-3 p-4 bg-blue-50/50 border border-blue-100 rounded-xl cursor-pointer mt-4">
                            <input type="checkbox" checked={customerConfirmed} onChange={e => setCustomerConfirmed(e.target.checked)} className="mt-1 accent-blue-600 w-4 h-4" />
                            <span className="text-xs text-slate-600 leading-relaxed">
                              Saya mengonfirmasi pelanggan telah memeriksa hasil pekerjaan dan menyetujui seluruh laporan beserta catatan teknis ini.
                            </span>
                          </label>

                          <div className="bg-slate-50 border border-slate-200 p-4 rounded-xl flex gap-3 mt-6">
                            <ShieldCheck className="text-blue-600 flex-shrink-0" size={20} />
                            <div>
                              <b className="text-sm text-slate-800 block">Checklist sebelum menyelesaikan SPK</b>
                              <p className="text-xs text-slate-500 mt-1">Pastikan foto kondisi awal, hasil akhir, dan catatan pekerjaan sudah lengkap.</p>
                            </div>
                          </div>

                          <button disabled={busy} onClick={() => void submitReport()} className="w-full py-4 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl text-[15px] flex items-center justify-center gap-2 shadow-lg shadow-blue-600/20 transition-all disabled:opacity-50 active:scale-[0.98] mt-6">
                            <CheckCircle2 size={20} /> {busy ? "Memproses..." : "Kirim laporan & selesaikan SPK"}
                          </button>
                          
                          <p className="text-center text-[10px] text-slate-400 mt-4">
                            Admin akan dapat meninjau progres dan dokumentasi setelah sistem terhubung ke backend.
                          </p>
                        </div>
                      </section>
                    </div>
                  )}
                </div>
              </div>
            )}
          </section>
        </div>
      </main>

      <footer className="mt-16 text-center text-[11px] text-slate-400 font-medium pb-8">
        © {new Date().getFullYear()} PT. Kafagu Tech Prosperous &middot; Field Service Workspace
      </footer>

      {notice && (
        <div className="fixed bottom-6 right-6 left-6 md:left-auto md:w-96 bg-slate-900 text-white p-4 rounded-xl shadow-2xl flex items-start gap-3 z-50 animate-in slide-in-from-bottom-5">
          <div className="flex-1 text-sm">{notice}</div>
          <button onClick={() => setNotice("")} className="text-slate-400 hover:text-white p-1">
            <X size={16} />
          </button>
        </div>
      )}
    </div>
  );
}