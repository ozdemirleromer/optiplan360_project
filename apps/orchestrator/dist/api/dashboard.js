"use strict";
/**
 * Orchestrator Dashboard — Tam panelli HTML dashboard
 * Sidebar menü + tüm bölümler (Jobs, Config, State Machine, Müşteri Arama, API Docs)
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.renderDashboard = renderDashboard;
const STATES = [
    "NEW", "PREPARED", "OPTI_IMPORTED", "OPTI_RUNNING",
    "OPTI_DONE", "XML_READY", "DELIVERED", "DONE", "HOLD", "FAILED",
];
const STATE_COLORS = {
    NEW: { bg: "#334155", fg: "#e2e8f0" },
    PREPARED: { bg: "#1e3a5f", fg: "#7dd3fc" },
    OPTI_IMPORTED: { bg: "#1e3a5f", fg: "#93c5fd" },
    OPTI_RUNNING: { bg: "#422006", fg: "#fbbf24" },
    OPTI_DONE: { bg: "#064e3b", fg: "#6ee7b7" },
    XML_READY: { bg: "#134e4a", fg: "#5eead4" },
    DELIVERED: { bg: "#1e3a5f", fg: "#67e8f9" },
    DONE: { bg: "#065f46", fg: "#34d399" },
    HOLD: { bg: "#78350f", fg: "#fde68a" },
    FAILED: { bg: "#7f1d1d", fg: "#fca5a5" },
};
function escapeHtml(str) {
    return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}
function formatDate(iso) {
    try {
        return new Date(iso).toLocaleString("tr-TR");
    }
    catch {
        return iso;
    }
}
function renderDashboard(data) {
    const { jobs, paths, rules, uptime } = data;
    const total = jobs.length;
    const byState = {};
    for (const j of jobs) {
        byState[j.state] = (byState[j.state] ?? 0) + 1;
    }
    // Stat kartları
    const running = (byState["OPTI_RUNNING"] ?? 0) + (byState["PREPARED"] ?? 0) + (byState["OPTI_IMPORTED"] ?? 0);
    // Durum dağılımı tablosu
    const stateRows = STATES
        .filter((s) => byState[s])
        .map((s) => {
        const c = STATE_COLORS[s] ?? { bg: "#334155", fg: "#e2e8f0" };
        return `<tr><td><span class="badge" style="background:${c.bg};color:${c.fg}">${s}</span></td><td>${byState[s]}</td></tr>`;
    })
        .join("") || `<tr><td colspan="2" class="empty">Henuz is yok</td></tr>`;
    // Job satırları
    const jobRows = jobs
        .slice(0, 50)
        .map((j) => {
        const c = STATE_COLORS[j.state] ?? { bg: "#334155", fg: "#e2e8f0" };
        const err = j.error_code ? `<span class="err">${escapeHtml(j.error_code)}</span>` : "-";
        return `<tr>
        <td><a href="/ui/jobs/${j.id}">${j.id.slice(0, 8)}...</a></td>
        <td>${escapeHtml(j.order_id)}</td>
        <td><span class="badge" style="background:${c.bg};color:${c.fg}">${j.state}</span></td>
        <td>${j.opti_mode || "C"}</td>
        <td>${j.retry_count}</td>
        <td>${err}</td>
        <td>${formatDate(j.created_at)}</td>
        <td>${formatDate(j.updated_at)}</td>
        <td class="actions">
          <button onclick="doAction('/jobs/${j.id}/retry','POST')" title="Yeniden Dene">&#x21bb;</button>
          <button onclick="doAction('/jobs/${j.id}/approve','POST')" title="Onayla">&#x2713;</button>
        </td>
      </tr>`;
    })
        .join("") || `<tr><td colspan="9" class="empty">Henuz is yok</td></tr>`;
    // Config JSON
    const pathsJson = paths ? JSON.stringify(paths, null, 2) : "Yuklenmedi";
    const rulesJson = rules ? JSON.stringify(rules, null, 2) : "Yuklenmedi";
    // State machine diagram (ASCII art)
    const stateMachine = `NEW ──► PREPARED ──► OPTI_IMPORTED ──► OPTI_RUNNING ──► OPTI_DONE ──► XML_READY ──► DELIVERED ──► DONE
 │                                         │                │
 │                                         ▼                ▼
 └─────────────────────────────────────── HOLD ◄────────── FAILED
                                           │
                                           └──► (approve) ──► NEW`;
    return `<!DOCTYPE html>
<html lang="tr">
<head>
  <meta charset="utf-8"/>
  <meta name="viewport" content="width=device-width,initial-scale=1"/>
  <title>OptiPlan360 Orchestrator</title>
  <style>
    *{box-sizing:border-box;margin:0;padding:0}
    :root{
      --bg:#0f172a;--surface:#1e293b;--surface2:#334155;
      --text:#e2e8f0;--text2:#94a3b8;--accent:#38bdf8;--accent2:#818cf8;
      --success:#34d399;--warn:#fbbf24;--danger:#f87171;
      --sidebar-w:220px;
    }
    body{font-family:system-ui,-apple-system,sans-serif;background:var(--bg);color:var(--text);display:flex;min-height:100vh}

    /* Sidebar */
    .sidebar{width:var(--sidebar-w);background:var(--surface);border-right:1px solid var(--surface2);padding:1.5rem 0;position:fixed;top:0;left:0;bottom:0;overflow-y:auto;z-index:10}
    .sidebar .logo{padding:0 1.25rem;margin-bottom:2rem}
    .sidebar .logo h1{font-size:1rem;color:var(--accent);line-height:1.3}
    .sidebar .logo p{font-size:.7rem;color:var(--text2)}
    .sidebar nav a{display:flex;align-items:center;gap:.6rem;padding:.6rem 1.25rem;color:var(--text2);text-decoration:none;font-size:.85rem;transition:all .15s}
    .sidebar nav a:hover{background:var(--surface2);color:var(--text)}
    .sidebar nav a.active{background:var(--accent);background:rgba(56,189,248,.12);color:var(--accent);border-right:3px solid var(--accent)}
    .sidebar nav .sep{height:1px;background:var(--surface2);margin:.75rem 1.25rem}
    .sidebar .status{padding:1rem 1.25rem;border-top:1px solid var(--surface2);margin-top:auto;position:absolute;bottom:0;left:0;right:0}
    .sidebar .status .dot{display:inline-block;width:8px;height:8px;border-radius:50%;background:var(--success);margin-right:.4rem}
    .sidebar .status span{font-size:.75rem;color:var(--text2)}

    /* Main */
    .main{margin-left:var(--sidebar-w);flex:1;padding:1.5rem 2rem}
    .main h2{font-size:1.15rem;color:var(--text);margin-bottom:1rem}
    .main h3{font-size:.95rem;color:var(--text2);margin:1.5rem 0 .75rem}

    /* Section show/hide */
    .section{display:none}
    .section.active{display:block}

    /* Cards */
    .cards{display:grid;grid-template-columns:repeat(auto-fill,minmax(160px,1fr));gap:.75rem;margin-bottom:1.5rem}
    .card{background:var(--surface);border-radius:8px;padding:1rem 1.25rem}
    .card .num{font-size:1.75rem;font-weight:700;color:var(--text)}
    .card .lbl{font-size:.7rem;color:var(--text2);text-transform:uppercase;letter-spacing:.05em;margin-top:.15rem}

    /* Tables */
    table{width:100%;border-collapse:collapse;background:var(--surface);border-radius:8px;overflow:hidden;font-size:.85rem}
    th{background:var(--surface2);text-align:left;padding:.5rem .75rem;font-size:.7rem;text-transform:uppercase;letter-spacing:.05em;color:var(--text2);white-space:nowrap}
    td{padding:.5rem .75rem;border-top:1px solid var(--surface2);vertical-align:middle}
    a{color:var(--accent);text-decoration:none}
    a:hover{text-decoration:underline}
    .empty{color:var(--text2);text-align:center;padding:2rem}

    /* Badge */
    .badge{padding:2px 8px;border-radius:4px;font-size:.7rem;font-weight:600;white-space:nowrap}
    .err{color:var(--danger);font-size:.75rem}

    /* Actions */
    .actions{white-space:nowrap}
    .actions button{background:var(--surface2);border:none;color:var(--text);padding:4px 8px;border-radius:4px;cursor:pointer;font-size:.85rem;margin-right:2px}
    .actions button:hover{background:var(--accent);color:var(--bg)}

    /* Pre/Code */
    pre{background:var(--surface);border-radius:8px;padding:1rem;overflow-x:auto;font-size:.8rem;line-height:1.5;color:var(--text2)}
    code{font-family:'Cascadia Code','Fira Code',monospace}

    /* State Machine */
    .state-diagram{background:var(--surface);border-radius:8px;padding:1.5rem;font-family:monospace;font-size:.8rem;line-height:1.8;white-space:pre;overflow-x:auto;color:var(--accent)}

    /* Search form */
    .search-form{display:flex;gap:.5rem;margin-bottom:1rem;max-width:500px}
    .search-form input{flex:1;padding:.5rem .75rem;border-radius:6px;border:1px solid var(--surface2);background:var(--surface);color:var(--text);font-size:.85rem}
    .search-form input::placeholder{color:var(--text2)}
    .search-form button{padding:.5rem 1rem;border-radius:6px;border:none;background:var(--accent);color:var(--bg);font-weight:600;cursor:pointer;font-size:.85rem}
    #lookup-result{background:var(--surface);border-radius:8px;padding:1rem;margin-top:.5rem;font-size:.85rem;min-height:60px}

    /* API docs */
    .api-list{list-style:none}
    .api-list li{background:var(--surface);border-radius:6px;padding:.75rem 1rem;margin-bottom:.5rem;display:flex;align-items:center;gap:.75rem}
    .method{padding:2px 8px;border-radius:4px;font-size:.7rem;font-weight:700;font-family:monospace;min-width:50px;text-align:center}
    .method.get{background:#064e3b;color:#6ee7b7}
    .method.post{background:#1e3a5f;color:#7dd3fc}
    .api-path{font-family:monospace;font-size:.85rem;color:var(--text)}
    .api-desc{font-size:.75rem;color:var(--text2);margin-left:auto}

    /* Toast */
    #toast{position:fixed;bottom:2rem;right:2rem;background:var(--surface);border:1px solid var(--surface2);padding:.75rem 1.25rem;border-radius:8px;font-size:.85rem;display:none;z-index:100;box-shadow:0 4px 12px rgba(0,0,0,.4)}
    #toast.show{display:block}
    #toast.ok{border-color:var(--success);color:var(--success)}
    #toast.fail{border-color:var(--danger);color:var(--danger)}

    /* Responsive */
    @media(max-width:768px){
      .sidebar{width:60px;padding:1rem 0}
      .sidebar .logo h1,.sidebar .logo p,.sidebar nav a span,.sidebar .status span{display:none}
      .sidebar nav a{justify-content:center;padding:.75rem}
      .main{margin-left:60px;padding:1rem}
      .cards{grid-template-columns:repeat(2,1fr)}
    }
  </style>
</head>
<body>
  <aside class="sidebar">
    <div class="logo">
      <h1>OptiPlan360</h1>
      <p>Orchestrator v1.0</p>
    </div>
    <nav>
      <a href="#" class="active" data-section="dashboard">&#x25A0; <span>Dashboard</span></a>
      <a href="#" data-section="jobs">&#x2630; <span>Isler (Jobs)</span></a>
      <a href="#" data-section="state-machine">&#x27F3; <span>State Machine</span></a>
      <div class="sep"></div>
      <a href="#" data-section="customer">&#x260E; <span>Musteri Arama</span></a>
      <a href="#" data-section="config">&#x2699; <span>Konfigürasyon</span></a>
      <div class="sep"></div>
      <a href="#" data-section="api-docs">&#x2197; <span>API Dokümantasyonu</span></a>
    </nav>
    <div class="status">
      <span class="dot"></span>
      <span>Aktif &mdash; ${uptime}</span>
    </div>
  </aside>

  <main class="main">
    <!-- DASHBOARD -->
    <div id="dashboard" class="section active">
      <h2>Dashboard</h2>
      <p style="color:var(--text2);font-size:.85rem;margin-bottom:1rem">${new Date().toLocaleString("tr-TR")}</p>

      <div class="cards">
        <div class="card"><div class="num">${total}</div><div class="lbl">Toplam Is</div></div>
        <div class="card"><div class="num" style="color:var(--warn)">${running}</div><div class="lbl">Islemde</div></div>
        <div class="card"><div class="num" style="color:var(--success)">${byState["DONE"] ?? 0}</div><div class="lbl">Tamamlanan</div></div>
        <div class="card"><div class="num" style="color:var(--danger)">${byState["FAILED"] ?? 0}</div><div class="lbl">Hatali</div></div>
        <div class="card"><div class="num" style="color:var(--warn)">${byState["HOLD"] ?? 0}</div><div class="lbl">Beklemede</div></div>
      </div>

      <h3>Durum Dagilimi</h3>
      <table style="max-width:350px">
        <tr><th>Durum</th><th>Adet</th></tr>
        ${stateRows}
      </table>

      <h3>Son Isler</h3>
      <table>
        <tr><th>ID</th><th>Siparis</th><th>Durum</th><th>Mod</th><th>Retry</th><th>Hata</th><th>Olusturulma</th><th>Guncelleme</th><th>Islem</th></tr>
        ${jobRows}
      </table>
    </div>

    <!-- JOBS -->
    <div id="jobs" class="section">
      <h2>Tum Isler</h2>
      <p style="color:var(--text2);font-size:.85rem;margin-bottom:1rem">Toplam ${total} is kayitli</p>
      <table>
        <tr><th>ID</th><th>Siparis</th><th>Durum</th><th>Mod</th><th>Retry</th><th>Hata</th><th>Olusturulma</th><th>Guncelleme</th><th>Islem</th></tr>
        ${jobRows}
      </table>
    </div>

    <!-- STATE MACHINE -->
    <div id="state-machine" class="section">
      <h2>State Machine</h2>
      <p style="color:var(--text2);font-size:.85rem;margin-bottom:1rem">Canonical is durumu gecisleri</p>
      <div class="state-diagram">${escapeHtml(stateMachine)}</div>

      <h3>Durum Aciklamalari</h3>
      <table style="max-width:700px">
        <tr><th>Durum</th><th>Aciklama</th></tr>
        <tr><td><span class="badge" style="background:#334155;color:#e2e8f0">NEW</span></td><td>Is olusturuldu, isleme alinmayi bekliyor</td></tr>
        <tr><td><span class="badge" style="background:#1e3a5f;color:#7dd3fc">PREPARED</span></td><td>Parcalar donusturuldu, XLSX hazirlandi</td></tr>
        <tr><td><span class="badge" style="background:#1e3a5f;color:#93c5fd">OPTI_IMPORTED</span></td><td>OptiPlanning import klasorune kopyalandi</td></tr>
        <tr><td><span class="badge" style="background:#422006;color:#fbbf24">OPTI_RUNNING</span></td><td>OptiPlanning islemi calistiriliyor</td></tr>
        <tr><td><span class="badge" style="background:#064e3b;color:#6ee7b7">OPTI_DONE</span></td><td>OptiPlanning tamamlandi, sonuc XML bekleniyor</td></tr>
        <tr><td><span class="badge" style="background:#134e4a;color:#5eead4">XML_READY</span></td><td>XML okundu, makine dosyasi hazir</td></tr>
        <tr><td><span class="badge" style="background:#1e3a5f;color:#67e8f9">DELIVERED</span></td><td>Dosya makine paylasim klasorune gonderildi</td></tr>
        <tr><td><span class="badge" style="background:#065f46;color:#34d399">DONE</span></td><td>Is basariyla tamamlandi</td></tr>
        <tr><td><span class="badge" style="background:#78350f;color:#fde68a">HOLD</span></td><td>Manuel onay bekliyor (CRM eslesme yok vb.)</td></tr>
        <tr><td><span class="badge" style="background:#7f1d1d;color:#fca5a5">FAILED</span></td><td>Hata olustu, retry limiti asildi</td></tr>
      </table>
    </div>

    <!-- CUSTOMER LOOKUP -->
    <div id="customer" class="section">
      <h2>Musteri Arama</h2>
      <p style="color:var(--text2);font-size:.85rem;margin-bottom:1rem">Telefon numarasiyla CRM musteri eslestirmesi</p>
      <div class="search-form">
        <input type="text" id="phone-input" placeholder="05XX XXX XX XX" />
        <button onclick="lookupCustomer()">Ara</button>
      </div>
      <div id="lookup-result">Bir telefon numarasi girin ve "Ara" butonuna basin.</div>
    </div>

    <!-- CONFIG -->
    <div id="config" class="section">
      <h2>Konfigürasyon</h2>

      <h3>Dosya Yollari (paths.json)</h3>
      <pre><code>${escapeHtml(pathsJson)}</code></pre>

      <h3>Is Kurallari (rules.json)</h3>
      <pre><code>${escapeHtml(rulesJson)}</code></pre>
    </div>

    <!-- API DOCS -->
    <div id="api-docs" class="section">
      <h2>API Dokümantasyonu</h2>
      <p style="color:var(--text2);font-size:.85rem;margin-bottom:1rem">Orchestrator REST API endpoint'leri</p>

      <h3>Genel</h3>
      <ul class="api-list">
        <li><span class="method get">GET</span><span class="api-path">/health</span><span class="api-desc">Servis durumu kontrolu</span></li>
        <li><span class="method get">GET</span><span class="api-path">/</span><span class="api-desc">Dashboard (bu sayfa)</span></li>
      </ul>

      <h3>Isler (Jobs)</h3>
      <ul class="api-list">
        <li><span class="method post">POST</span><span class="api-path">/jobs</span><span class="api-desc">Yeni is olustur</span></li>
        <li><span class="method get">GET</span><span class="api-path">/jobs</span><span class="api-desc">Tum isleri listele (?limit=N)</span></li>
        <li><span class="method get">GET</span><span class="api-path">/jobs/:id</span><span class="api-desc">Is detayi + audit log</span></li>
        <li><span class="method post">POST</span><span class="api-path">/jobs/:id/retry</span><span class="api-desc">Basarisiz isi yeniden dene</span></li>
        <li><span class="method post">POST</span><span class="api-path">/jobs/:id/approve</span><span class="api-desc">HOLD durumunu onayla</span></li>
      </ul>

      <h3>Facade (Uyumluluk)</h3>
      <ul class="api-list">
        <li><span class="method post">POST</span><span class="api-path">/orders/:orderId/import/xlsx</span><span class="api-desc">Siparis bazli is olustur</span></li>
      </ul>

      <h3>Musteri</h3>
      <ul class="api-list">
        <li><span class="method get">GET</span><span class="api-path">/customers/lookup?phone=05XX...</span><span class="api-desc">Telefon ile CRM eslestirmesi</span></li>
      </ul>

      <h3>Konfigürasyon</h3>
      <ul class="api-list">
        <li><span class="method get">GET</span><span class="api-path">/config/paths</span><span class="api-desc">Dosya yollari konfigurasyonu</span></li>
        <li><span class="method get">GET</span><span class="api-path">/config/rules</span><span class="api-desc">Is kurallari konfigurasyonu</span></li>
      </ul>

      <h3>Auth</h3>
      <ul class="api-list">
        <li><span class="method post">POST</span><span class="api-path">/auth/login</span><span class="api-desc">JWT token al</span></li>
        <li><span class="method get">GET</span><span class="api-path">/auth/verify</span><span class="api-desc">Token dogrula</span></li>
        <li><span class="method get">GET</span><span class="api-path">/auth/me</span><span class="api-desc">Mevcut kullanici bilgisi</span></li>
      </ul>
    </div>
  </main>

  <div id="toast"></div>

  <script>
    // Navigation
    document.querySelectorAll('.sidebar nav a[data-section]').forEach(link => {
      link.addEventListener('click', (e) => {
        e.preventDefault();
        const target = link.getAttribute('data-section');
        document.querySelectorAll('.section').forEach(s => s.classList.remove('active'));
        document.querySelectorAll('.sidebar nav a').forEach(a => a.classList.remove('active'));
        document.getElementById(target).classList.add('active');
        link.classList.add('active');
      });
    });

    // Toast
    function showToast(msg, ok) {
      const t = document.getElementById('toast');
      t.textContent = msg;
      t.className = 'show ' + (ok ? 'ok' : 'fail');
      setTimeout(() => t.className = '', 3000);
    }

    // Job actions (retry, approve)
    async function doAction(url, method) {
      try {
        const res = await fetch(url, { method });
        const data = await res.json();
        if (res.ok) {
          showToast('Basarili! Sayfa yenileniyor...', true);
          setTimeout(() => location.reload(), 800);
        } else {
          showToast('Hata: ' + (data.error?.message || 'Bilinmeyen hata'), false);
        }
      } catch (err) {
        showToast('Ag hatasi: ' + err.message, false);
      }
    }

    // Customer lookup
    async function lookupCustomer() {
      const phone = document.getElementById('phone-input').value.trim();
      const result = document.getElementById('lookup-result');
      if (!phone) { result.innerHTML = '<span style="color:var(--warn)">Telefon numarasi girin</span>'; return; }
      result.innerHTML = 'Araniyor...';
      try {
        const res = await fetch('/customers/lookup?phone=' + encodeURIComponent(phone));
        const data = await res.json();
        if (data.error) {
          result.innerHTML = '<span style="color:var(--danger)">Hata: ' + data.error.message + '</span>';
        } else if (data.customer) {
          result.innerHTML = '<strong style="color:var(--success)">Musteri bulundu!</strong><pre>' + JSON.stringify(data.customer, null, 2) + '</pre>';
        } else {
          result.innerHTML = '<span style="color:var(--warn)">Musteri bulunamadi</span><br><small>Normalize: ' + (data.phone_normalized || phone) + '</small>';
        }
      } catch (err) {
        result.innerHTML = '<span style="color:var(--danger)">Ag hatasi: ' + err.message + '</span>';
      }
    }

    // Enter key for search
    document.getElementById('phone-input')?.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') lookupCustomer();
    });
  </script>
</body>
</html>`;
}
