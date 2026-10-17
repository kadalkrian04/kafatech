"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Activity, ArrowRight, ArrowUpRight, Bell, CalendarDays,
  Check, CheckCircle2, ChevronDown, ChevronRight, ClipboardCheck,
  Clock3, Download, Filter, Headphones, LayoutDashboard, LifeBuoy, MapPin,
  Menu, MoreHorizontal, Plus, Search, Settings2, ShieldCheck, Users, Wrench,
  X, Zap, CircleAlert, FileText, Camera, LoaderCircle
} from "lucide-react";

type Job = { id: string; customer: string; task: string; location: string; time: string; tech: string; initials: string; color: string; status: "Dalam perjalanan" | "Sedang dikerjakan" | "Menunggu" | "Selesai"; priority: "Normal" | "Urgent" };

const nav = [
  { label: "Overview", icon: LayoutDashboard }, { label: "Jadwal & SPK", icon: ClipboardCheck },
  { label: "Teknisi", icon: Users }, { label: "Pelanggan", icon: Headphones }, { label: "Laporan", icon: FileText },
];
const statusClass: Record<Job["status"], string> = { "Dalam perjalanan": "travel", "Sedang dikerjakan": "working", "Menunggu": "waiting", "Selesai": "done" };

export default function Home() {
  const [isAuthorized, setIsAuthorized] = useState(false); // Mencegah teknisi melihat dashboard admin
  const [jobs, setJobs] = useState<Job[]>([]);
  const [technicianIds, setTechnicianIds] = useState<Record<string,string>>({});
  const [availableTechnicians, setAvailableTechnicians] = useState<any[]>([]);
  const [loadingJobs, setLoadingJobs] = useState(true);
  
  const [activeNav, setActiveNav] = useState("Overview");
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("Semua status");
  const [showJobModal, setShowJobModal] = useState(false);
  const [showMobileNav, setShowMobileNav] = useState(false);
  const [toast, setToast] = useState("");
  const [jobForm, setJobForm] = useState({ customer: "", task: "", location: "", tech: "", workDate: new Date().toLocaleDateString("en-CA"), time: "15:30 – 16:30" });
  const [adminUser, setAdminUser] = useState<{fullName: string; initials: string} | null>(null);

  useEffect(() => {
    let alive = true;
    const load = async () => {
      try {
        // 1. Cek Autentikasi Terlebih Dahulu
        const meRes = await fetch("/api/auth/me", {cache:"no-store"});
        const meData = await meRes.json();
        
        if (!meRes.ok) { window.location.assign("/login"); return; }
        
        // 2. Cegah akses jika bukan Admin/Dispatcher
        if (meData.user?.role === "technician") { 
          window.location.assign("/"); // Arahkan ke halaman teknisi
          return; 
        }
        
        if (alive) {
          setAdminUser({
            fullName: meData.user?.fullName || "Administrator",
            initials: (meData.user?.fullName || "Admin").split(" ").map((n:string)=>n[0]).join("").substring(0,2).toUpperCase()
          });
          setIsAuthorized(true); // Izinkan render UI Admin
        }

        // 3. Ambil data dari Backend setelah lolos pengecekan
        const [jobsRes, usersRes] = await Promise.all([fetch("/api/work-orders", {cache:"no-store"}), fetch("/api/users", {cache:"no-store"})]);
        
        let fetchedJobs: Job[] = [];
        
        if (jobsRes.ok) { 
          const data = await jobsRes.json(); 
          fetchedJobs = (data.workOrders ?? []).map((w:any) => { 
            const displayStatus: Job["status"] = w.status === "completed" ? "Selesai" : w.status === "in_progress" ? "Sedang dikerjakan" : w.status === "assigned" ? "Dalam perjalanan" : "Menunggu"; 
            const techName = w.technician_name || "Belum ditugaskan"; 
            const initials = techName !== "Belum ditugaskan" ? techName.split(" ").map((n:string)=>n[0]).join("").substring(0,2).toUpperCase() : "--";
            
            return {
              id: w.spk_number, 
              customer: w.customer_name || "Pelanggan", 
              task: w.title || w.service_type || "Pekerjaan", 
              location: w.location || "-", 
              time: [w.start_time, w.end_time].filter(Boolean).join(" – ") || "Belum dijadwalkan", 
              tech: techName, 
              initials: initials, 
              color: "blue", // Bisa disesuaikan dengan logika warna dinamis
              status: displayStatus, 
              priority: w.priority === "urgent" || w.priority === "high" ? "Urgent" : "Normal"
            }; 
          }); 
          if (alive) setJobs(fetchedJobs); 
        }
        
        if (usersRes.ok) { 
          const data = await usersRes.json(); 
          const map:Record<string,string> = {}; 
          const techs = (data.users ?? []).filter((u:any) => u.role === "technician" && u.is_active);
          
          for (const u of techs) {
            map[u.full_name] = String(u.id);
          }
          
          if (alive) { 
            setTechnicianIds(map); 
            // Hitung statistik dinamis tiap teknisi berdasarkan data SPK riil
            setAvailableTechnicians(techs.map((u:any) => {
              const techJobs = fetchedJobs.filter(j => j.tech === u.full_name && j.status !== "Selesai");
              const isWorking = techJobs.some(j => j.status === "Sedang dikerjakan" || j.status === "Dalam perjalanan");
              return {
                id: String(u.id),
                name: u.full_name,
                role: "Technician",
                initials: u.full_name.split(" ").map((n:string)=>n[0]).join("").substring(0,2).toUpperCase(),
                color: "blue",
                jobsCount: techJobs.length,
                status: isWorking ? "On field" : "Available",
                progress: techJobs.length > 0 ? 50 : 0 // Angka dummy progress, bisa dihubungkan jika backend punya kolom progress
              };
            })); 
          } 
        }
      } catch { 
        if (alive) notify("Tidak dapat memuat data server. Periksa koneksi."); 
      } finally { 
        if (alive) setLoadingJobs(false); 
      }
    }; 
    void load(); 
    return () => { alive = false };
  }, []);

  const filteredJobs = useMemo(() => jobs.filter(j => [j.customer,j.task,j.location,j.tech,j.id].join(" ").toLowerCase().includes(query.toLowerCase()) && (statusFilter === "Semua status" || j.status === statusFilter)), [jobs, query, statusFilter]);
  
  const notify = (message: string) => { setToast(message); setTimeout(() => setToast(""), 2600); };
  const completeJob = (id: string) => { notify(`SPK ${id} hanya dapat diselesaikan setelah laporan dikirim teknisi.`); };
  
  const createJob = async (e: React.FormEvent) => { 
    e.preventDefault(); 
    if (!jobForm.customer.trim() || !jobForm.task.trim() || !jobForm.workDate) return; 
    const assignedTech = availableTechnicians.find(t => t.name === jobForm.tech); 
    const parts = jobForm.time.split(/[–-]/).map(v => v.trim()); 
    const payload = {
      customerName: jobForm.customer.trim(),
      title: jobForm.task.trim(),
      serviceType: jobForm.task.trim(),
      location: jobForm.location.trim() || "Belum ditentukan",
      workDate: jobForm.workDate,
      startTime: /^\d{2}:\d{2}$/.test(parts[0] || "") ? parts[0] : null,
      endTime: /^\d{2}:\d{2}$/.test(parts[1] || "") ? parts[1] : null,
      technicianId: technicianIds[jobForm.tech] || null,
      priority: "normal"
    }; 
    
    try { 
      const r = await fetch("/api/work-orders", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) }); 
      const data = await r.json(); 
      if (!r.ok) throw new Error(data.error || "Gagal membuat SPK"); 
      const w = data.workOrder; 
      
      const newJob: Job = {
        id: w.spk_number,
        customer: w.customer_name || payload.customerName,
        task: w.title || payload.title,
        location: w.location,
        time: [w.start_time, w.end_time].filter(Boolean).join(" – ") || "Belum dijadwalkan",
        tech: assignedTech?.name || "Belum ditugaskan",
        initials: assignedTech?.initials || "--",
        color: "blue",
        status: payload.technicianId ? "Dalam perjalanan" : "Menunggu",
        priority: "Normal"
      };
      
      setJobs(old => [newJob, ...old]);
      setShowJobModal(false);
      setJobForm({ customer: "", task: "", location: "", tech: "", workDate: new Date().toLocaleDateString("en-CA"), time: "15:30 – 16:30" });
      notify("SPK berhasil disimpan ke server."); 
    } catch(err) { 
      notify(err instanceof Error ? err.message : "Gagal membuat SPK."); 
    } 
  };

  // Mencegah FOUC (Teknisi tidak akan melihat ini sama sekali saat baru login)
  if (!isAuthorized) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', background: '#f8fafc', color: '#64748b' }}>
        <LoaderCircle className="animate-spin" size={32} />
      </div>
    );
  }

  // Hitung persentase sukses (Real data dari Backend)
  const completedCount = jobs.filter(j => j.status === "Selesai").length;
  const performanceRate = jobs.length > 0 ? Math.round((completedCount / jobs.length) * 100) : 0;

  return (
    <div className="app-shell">
      <aside className={`sidebar ${showMobileNav ? "mobile-open" : ""}`}>
        <div className="brand"><div className="brand-mark"><span>K</span><i /></div><div><b>KAFAGU<span>TECH</span></b><small>PROSPEROUS · FIELD OPS</small></div><button className="mobile-close" onClick={() => setShowMobileNav(false)}><X size={19}/></button></div>
        <div className="workspace-label">WORKSPACE</div>
        <div className="workspace"><div className="workspace-icon"><ShieldCheck size={19}/></div><div><b>Operations Center</b><small>Surabaya Raya</small></div><ChevronDown size={15} className="workspace-chevron"/></div>
        
        <div className="nav-label">MENU UTAMA</div>
        <nav>
          {nav.map(item => (
            <button key={item.label} onClick={() => {
              setShowMobileNav(false); 
              if(item.label === "Pelanggan") { window.location.href="/pelanggan"; return; } 
              if(item.label === "Laporan") { window.location.href="/laporan"; return; } 
              if(item.label === "Teknisi") { window.location.href="/akun"; return; } 
              if(item.label === "Jadwal & SPK") { window.location.href="/dispatcher"; return; } 
              setActiveNav(item.label);
            }} className={`nav-item ${activeNav === item.label ? "active" : ""}`}>
              <item.icon size={18}/><span>{item.label}</span>
              {item.label === "Jadwal & SPK" && <em>{jobs.filter(j=>j.status!=="Selesai").length}</em>}
              {activeNav === item.label && <i className="active-line"/>}
            </button>
          ))}
        </nav>
        
        <div className="nav-label tools-label">TOOLS</div>
        <nav>
          <button className="nav-item"><LifeBuoy size={18}/><span>Pusat Bantuan</span></button>
          <button className="nav-item"><Settings2 size={18}/><span>Pengaturan</span></button>
        </nav>
        
        <div className="sidebar-bottom">
          <div className="profile">
            <div className="avatar admin-avatar">{adminUser?.initials}</div>
            <div className="profile-info"><b>{adminUser?.fullName}</b><small>Administrator</small></div>
            <MoreHorizontal size={19}/>
          </div>
        </div>
      </aside>

      <main className="main-area">
        <header className="topbar">
          <div className="top-left">
            <button className="menu-toggle" onClick={() => setShowMobileNav(true)}><Menu size={20}/></button>
            <div className="breadcrumb">Workspace <ChevronRight size={14}/> <b>{activeNav}</b></div>
          </div>
          <div className="top-actions">
            <div className="date-chip"><CalendarDays size={16}/><span>{new Date().toLocaleDateString('id-ID', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</span></div>
            <button className="icon-btn notification" aria-label="Notifikasi"><Bell size={19}/></button>
            <div className="top-divider"/>
            <div className="top-user"><div className="avatar admin-avatar">{adminUser?.initials}</div><ChevronDown size={14}/></div>
          </div>
        </header>
        
        <div className="page-content">
          <section className="welcome-row">
            <div>
              <div className="eyebrow"><span className="live-dot"/> LIVE OPERATIONS DASHBOARD</div>
              <h1>Selamat pagi, {adminUser?.fullName?.split(" ")[0]} <span className="wave">✦</span></h1>
              <p>Pantau tim teknisi dan kelola pekerjaan hari ini dari satu tempat.</p>
            </div>
            <div className="welcome-actions">
              <button className="btn-secondary" onClick={() => window.print()}><Download size={16}/> Cetak Laporan</button>
              <button className="btn-primary" onClick={() => setShowJobModal(true)}><Plus size={17}/> Buat SPK Baru</button>
            </div>
          </section>

          <section className="stats-grid">
            <StatCard title="Total Teknisi" value={String(availableTechnicians.length)} suffix="orang" change="Akun aktif (Database)" icon={<Users size={19}/>} tone="blue"/>
            <StatCard title="Total SPK" value={String(jobs.length)} suffix="SPK" change="Semua data pekerjaan" icon={<ClipboardCheck size={19}/>} tone="violet"/>
            <StatCard title="Sedang Berjalan" value={String(jobs.filter(j=>j.status==="Dalam perjalanan"||j.status==="Sedang dikerjakan").length)} suffix="job" change="Belum tuntas" icon={<Activity size={19}/>} tone="cyan"/>
            <StatCard title="SPK Selesai" value={String(completedCount)} suffix="job" change="Pekerjaan terselesaikan" icon={<CheckCircle2 size={19}/>} tone="green" positive/>
          </section>

          <section className="content-grid">
            <div className="panel jobs-panel">
              <div className="panel-heading">
                <div>
                  <div className="section-kicker">FIELD OPERATIONS</div>
                  <h2>Jadwal & pekerjaan</h2>
                  <p>Monitor SPK dan progres tim secara real-time.</p>
                </div>
                <button className="more-btn" aria-label="Opsi pekerjaan"><MoreHorizontal size={21}/></button>
              </div>
              
              <div className="job-toolbar">
                <div className="search-box">
                  <Search size={16}/>
                  <input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Cari SPK, pelanggan, teknisi..."/>
                </div>
                <div className="filter-wrap">
                  <Filter size={15}/>
                  <select value={statusFilter} onChange={e=>setStatusFilter(e.target.value)} aria-label="Filter status">
                    <option>Semua status</option>
                    <option>Dalam perjalanan</option>
                    <option>Sedang dikerjakan</option>
                    <option>Menunggu</option>
                    <option>Selesai</option>
                  </select>
                  <ChevronDown size={13}/>
                </div>
              </div>
              
              <div className="jobs-list">
                {loadingJobs ? (
                  <div className="empty-state">Memuat data SPK dari server…</div>
                ) : filteredJobs.length ? (
                  filteredJobs.map(job => (
                    <article className="job-row" key={job.id}>
                      <div className={`job-symbol ${job.color}`}><Wrench size={18}/></div>
                      <div className="job-main">
                        <div className="job-topline"><b>{job.customer}</b>{job.priority === "Urgent" && <span className="priority"><span/> Urgent</span>}</div>
                        <div className="job-task">{job.task}</div>
                        <div className="job-meta">
                          <span><MapPin size={13}/>{job.location}</span>
                          <span><Clock3 size={13}/>{job.time}</span>
                        </div>
                        <div className="job-bottom">
                          <span className={`status-pill ${statusClass[job.status]}`}><i/>{job.status}</span>
                          <div className="assigned">
                            <div className={`avatar tiny ${job.color}`}>{job.initials}</div>
                            <span>{job.tech}</span>
                          </div>
                        </div>
                      </div>
                      <button className="job-action" title="Lihat alur penyelesaian" onClick={() => completeJob(job.id)}>
                        {job.status === "Selesai" ? <Check size={17}/> : <ChevronRight size={18}/>}
                      </button>
                    </article>
                  ))
                ) : (
                  <div className="empty-state">
                    <Search size={24}/>
                    <b>Tidak ada pekerjaan ditemukan</b>
                    <span>Coba kata kunci atau filter status yang lain.</span>
                  </div>
                )}
              </div>
              <div className="panel-footer">
                <span>Menampilkan <b>{filteredJobs.length}</b> dari <b>{jobs.length}</b> pekerjaan</span>
                <button onClick={() => window.location.href="/dispatcher"}>Lihat semua SPK <ArrowRight size={15}/></button>
              </div>
            </div>

            <div className="right-column">
              <div className="panel team-panel">
                <div className="panel-heading compact">
                  <div><div className="section-kicker">YOUR CREW</div><h2>Tim teknisi</h2></div>
                  <button className="more-btn" onClick={() => window.location.href="/akun"}><ArrowRight size={18}/></button>
                </div>
                
                <div className="technician-list">
                  {availableTechnicians.length === 0 && !loadingJobs && (
                    <div className="empty-state" style={{padding: '20px 0'}}>Belum ada data teknisi</div>
                  )}
                  {availableTechnicians.map(t => (
                    <div className="technician" key={t.id}>
                      <div className={`avatar ${t.color}`}>{t.initials}</div>
                      <div className="tech-details">
                        <div className="tech-name">{t.name}</div>
                        <div className="tech-role">{t.role}</div>
                        {/* Menampilkan indikator jika teknisi sedang mengerjakan SPK */}
                        {t.jobsCount > 0 && (
                          <div className="progress-track"><span style={{width: `50%`}}/></div>
                        )}
                      </div>
                      <div className="tech-right">
                        <span className={`availability ${t.status === "On field" ? "field" : "available"}`}><i/>{t.status}</span>
                        <small>{t.jobsCount} SPK aktif</small>
                      </div>
                    </div>
                  ))}
                </div>
                <button className="full-width-link" onClick={() => window.location.href="/akun"}>Kelola semua teknisi <ArrowRight size={15}/></button>
              </div>

              <div className="panel performance-panel">
                <div className="panel-heading compact">
                  <div><div className="section-kicker">PERFORMANCE</div><h2>Performa Tim (Real)</h2></div>
                </div>
                <div className="performance-metric">
                  <div>
                    <strong>{performanceRate}<span>%</span></strong>
                    <div className="performance-caption">Tingkat penyelesaian SPK Keseluruhan</div>
                  </div>
                </div>
                <div className="performance-footer">
                  <span><i className="legend-dot"/> Berdasarkan {completedCount} SPK Selesai</span>
                </div>
              </div>
            </div>
          </section>

          <section className="bottom-strip">
            <div className="bottom-icon"><CircleAlert size={19}/></div>
            <div className="bottom-copy">
              <b>Jangan lewatkan dokumentasi pekerjaan</b>
              <span>Pastikan teknisi mengunggah foto sebelum dan sesudah pengerjaan untuk setiap SPK.</span>
            </div>
            <div className="strip-decoration"><Camera size={55}/></div>
          </section>
          
          <footer>
            <span>© {new Date().getFullYear()} PT. Kafagu Tech Prosperous</span>
            <span><span className="footer-status"/> Backend Connected <span className="footer-separator">·</span> v1.0.0</span>
          </footer>
        </div>
      </main>

      {showJobModal && (
        <div className="modal-backdrop" onMouseDown={e=>{if(e.target===e.currentTarget)setShowJobModal(false)}}>
          <form className="job-modal" onSubmit={createJob}>
            <div className="modal-head">
              <div>
                <div className="section-kicker">FIELD SERVICE MANAGEMENT</div>
                <h2>Buat SPK baru</h2>
                <p>Tambahkan pekerjaan dan tetapkan teknisi.</p>
              </div>
              <button type="button" className="modal-close" onClick={()=>setShowJobModal(false)}><X size={19}/></button>
            </div>
            
            <label>Nama pelanggan
              <input autoFocus value={jobForm.customer} onChange={e=>setJobForm({...jobForm,customer:e.target.value})} placeholder="Contoh: PT Maju Bersama" required/>
            </label>
            <label>Jenis pekerjaan
              <input value={jobForm.task} onChange={e=>setJobForm({...jobForm,task:e.target.value})} placeholder="Contoh: Instalasi 4 kamera CCTV" required/>
            </label>
            <label>Lokasi pekerjaan
              <input value={jobForm.location} onChange={e=>setJobForm({...jobForm,location:e.target.value})} placeholder="Alamat / area pekerjaan"/>
            </label>
            
            <div className="modal-two">
              <label>Tanggal SPK
                <input type="date" value={jobForm.workDate} onChange={e=>setJobForm({...jobForm,workDate:e.target.value})} required/>
              </label>
              <label>Teknisi
                <select value={jobForm.tech} onChange={e=>setJobForm({...jobForm,tech:e.target.value})}>
                  <option value="">Belum ditugaskan</option>
                  {availableTechnicians.map(t=><option key={t.id} value={t.name}>{t.name}</option>)}
                </select>
              </label>
              <label>Jadwal
                <input value={jobForm.time} onChange={e=>setJobForm({...jobForm,time:e.target.value})} placeholder="09:00 – 10:00"/>
              </label>
            </div>
            
            <div className="modal-note"><ShieldCheck size={16}/> SPK akan dibuat dengan status Menunggu.</div>
            <div className="modal-actions">
              <button type="button" className="btn-secondary" onClick={()=>setShowJobModal(false)}>Batal</button>
              <button type="submit" className="btn-primary"><Plus size={16}/> Buat SPK</button>
            </div>
          </form>
        </div>
      )}
      
      {toast && <div className="toast"><CheckCircle2 size={18}/>{toast}<button onClick={()=>setToast("")}><X size={15}/></button></div>}
    </div>
  );
}

function StatCard({title,value,suffix,change,icon,tone,positive=false}:{title:string;value:string;suffix:string;change:string;icon:React.ReactNode;tone:string;positive?:boolean}) { 
  return (
    <div className="stat-card">
      <div className="stat-top"><span>{title}</span><div className={`stat-icon ${tone}`}>{icon}</div></div>
      <div className="stat-number">{value}<small>{suffix}</small></div>
      <div className={`stat-change ${positive?"positive":""}`}>{positive?<ArrowUpRight size={14}/>:<span className="mini-dot"/>}{change}</div>
      <div className={`stat-glow ${tone}`}/>
    </div>
  );
}