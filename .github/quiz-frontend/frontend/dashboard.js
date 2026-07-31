const API_BASE = "https://quiz-backend-hrjv.onrender.com/api";
let currentRole = sessionStorage.getItem('role') || 'STUDENT';
let authToken = sessionStorage.getItem('token') || sessionStorage.getItem('adminToken') || null;

document.addEventListener("DOMContentLoaded", () => {
    // Inject correct side-by-side layout structure dynamically if missing
    if (!document.querySelector('aside')) {
        document.body.innerHTML = `
            <aside style="display:flex; flex-direction:column; justify-content:space-between; width:16rem; min-width:16rem; height:100vh; background-color:#0b0f19; border-right:1px solid #1e293b; position:fixed; top:0; left:0;">
                <div style="padding:1.5rem;">
                    <h2 id="portalTitle" style="color:#34d399; font-weight:bold; font-size:0.75rem; text-transform:uppercase; letter-spacing:0.05em; margin-bottom:1.5rem;">Portal</h2>
                    <nav style="display:flex; flex-direction:column; gap:0.5rem;">
                        <a href="#" onclick="switchTab('overview', event)" class="menu-item active" style="display:flex; align-items:center; gap:0.75rem; padding:0.625rem 1rem; border-radius:0.75rem; font-size:0.875rem; font-weight:500; background:rgba(52,211,153,0.1); color:#34d399; border:1px solid rgba(52,211,153,0.2); text-decoration:none;">Overview & Progress</a>
                        <a href="#" onclick="switchTab('exams', event)" class="menu-item" style="display:flex; align-items:center; gap:0.75rem; padding:0.625rem 1rem; border-radius:0.75rem; font-size:0.875rem; font-weight:500; color:#94a3b8; text-decoration:none;">Assigned Exams</a>
                        <a href="#" onclick="switchTab('settings', event)" class="menu-item" style="display:flex; align-items:center; gap:0.75rem; padding:0.625rem 1rem; border-radius:0.75rem; font-size:0.875rem; font-weight:500; color:#94a3b8; text-decoration:none;">Profile Settings</a>
                    </nav>
                </div>
                <div style="padding:1.5rem; border-top:1px solid rgba(30,41,59,0.6);">
                    <button onclick="confirmLogout()" style="width:100%; background:rgba(244,63,94,0.1); color:#f43f5e; border:1px solid rgba(244,63,94,0.2); padding:0.625rem; border-radius:0.75rem; font-size:0.875rem; font-weight:500; cursor:pointer;">Logout Session</button>
                </div>
            </aside>
            <main style="margin-left:16rem; display:flex; flex-direction:column; flex:1; min-height:100vh; background-color:#030712; color:#f1f5f9; padding:2rem; width:calc(100vw - 16rem);">
                <div style="max-width:80rem; width:100%; margin:0 auto; display:flex; flex-direction:column; gap:1.5rem;">
                    <div style="background:rgba(15,23,42,0.6); border:1px solid rgba(30,41,59,0.8); border-radius:1rem; padding:1.5rem; display:flex; justify-content:space-between; align-items:center;">
                        <div>
                            <h1 style="font-size:1.25rem; font-weight:bold; color:#fff; margin:0;">Dashboard Overview</h1>
                            <p style="font-size:0.875rem; color:#94a3b8; margin:0.25rem 0 0 0;">Manage your active records and metrics.</p>
                        </div>
                        <div style="background:rgba(3,7,18,0.6); border:1px solid #1e293b; padding:0.5rem 1rem; border-radius:0.75rem; font-size:0.875rem; color:#e2e8f0;" id="userEmailDisplay">user@domain.com</div>
                    </div>
                    <div id="tab-overview" class="dash-tab-content" style="display:block;">
                        <div style="display:grid; grid-template-columns:repeat(3, minmax(0, 1fr)); gap:1.5rem;">
                            <div style="background:rgba(15,23,42,0.6); border:1px solid rgba(30,41,59,0.8); padding:1.5rem; border-radius:1rem;">
                                <p style="font-size:0.75rem; text-transform:uppercase; color:#94a3b8; font-weight:600; margin:0;" id="statLabel1">Metric 1</p>
                                <h3 id="statVal1" style="font-size:1.875rem; font-weight:800; color:#fff; margin:0.5rem 0 0 0;">0</h3>
                            </div>
                            <div style="background:rgba(15,23,42,0.6); border:1px solid rgba(30,41,59,0.8); padding:1.5rem; border-radius:1rem;">
                                <p style="font-size:0.75rem; text-transform:uppercase; color:#94a3b8; font-weight:600; margin:0;" id="statLabel2">Metric 2</p>
                                <h3 id="statVal2" style="font-size:1.875rem; font-weight:800; color:#fff; margin:0.5rem 0 0 0;">0</h3>
                            </div>
                            <div style="background:rgba(15,23,42,0.6); border:1px solid rgba(30,41,59,0.8); padding:1.5rem; border-radius:1rem;">
                                <p style="font-size:0.75rem; text-transform:uppercase; color:#94a3b8; font-weight:600; margin:0;">Average Score</p>
                                <h3 id="statVal3" style="font-size:1.875rem; font-weight:800; color:#34d399; margin:0.5rem 0 0 0;">0.0%</h3>
                            </div>
                        </div>
                    </div>
                    <div id="tab-exams" class="dash-tab-content" style="display:none; background:rgba(15,23,42,0.6); border:1px solid rgba(30,41,59,0.8); padding:1.5rem; border-radius:1rem;">
                        <h3 style="color:#fff; margin-top:0;">Assigned Examinations</h3>
                        <p style="color:#94a3b8;">Your assigned modules will load here.</p>
                    </div>
                    <div id="tab-settings" class="dash-tab-content" style="display:none; background:rgba(15,23,42,0.6); border:1px solid rgba(30,41,59,0.8); padding:1.5rem; border-radius:1rem;">
                        <h3 style="color:#fff; margin-top:0;">Profile Configuration</h3>
                        <p style="color:#94a3b8;">Account preferences and security settings.</p>
                    </div>
                </div>
            </main>
        `;
    }

    // Set user email view
    const savedEmail = sessionStorage.getItem('email');
    if (savedEmail && document.getElementById('userEmailDisplay')) {
        document.getElementById('userEmailDisplay').innerText = savedEmail;
    }

    if (window.lucide) lucide.createIcons();
    initializeDashboardRoleUI();
    loadDashboardData();
});

function switchTab(tabId, e) {
    if (e) e.preventDefault();
    document.querySelectorAll('.dash-tab-content').forEach(el => el.style.display = 'none');
    document.querySelectorAll('.menu-item').forEach(el => {
        el.style.background = 'transparent';
        el.style.color = '#94a3b8';
        el.style.border = 'none';
    });

    const targetTab = document.getElementById(`tab-${tabId}`);
    if (targetTab) targetTab.style.display = 'block';
    if (e && e.currentTarget) {
        e.currentTarget.style.background = 'rgba(52,211,153,0.1)';
        e.currentTarget.style.color = '#34d399';
        e.currentTarget.style.border = '1px solid rgba(52,211,153,0.2)';
    }
}

function initializeDashboardRoleUI() {
    const isAdmin = (currentRole === 'ADMIN');
    const titleEl = document.getElementById('portalTitle');
    if (titleEl) titleEl.innerText = isAdmin ? "Admin Control" : "Student Portal";

    if (isAdmin) {
        if (document.getElementById('statLabel1')) document.getElementById('statLabel1').innerText = "Total System Exams";
        if (document.getElementById('statLabel2')) document.getElementById('statLabel2').innerText = "Total Submissions";
    } else {
        if (document.getElementById('statLabel1')) document.getElementById('statLabel1').innerText = "Assigned Exams";
        if (document.getElementById('statLabel2')) document.getElementById('statLabel2').innerText = "Completed Exams";
    }
}

async function loadDashboardData() {
    try {
        const endpoint = currentRole === 'ADMIN' ? `${API_BASE}/admin/stats` : `${API_BASE}/student/results`;
        const res = await fetch(endpoint, {
            headers: { 
                'Authorization': `Bearer ${authToken}`,
                'Content-Type': 'application/json'
            }
        });
        if (!res.ok) return; // Silent return if 403/401 until token permissions sync
        const data = await res.json();

        if (currentRole === 'ADMIN') {
            document.getElementById('statVal1').innerText = data.totalExams || 0;
            document.getElementById('statVal2').innerText = data.totalSubmissions || 0;
            document.getElementById('statVal3').innerText = `${(data.averageScore || 0).toFixed(1)}%`;
        } else {
            const completed = Array.isArray(data) ? data.filter(i => i.status === 'COMPLETED').length : 0;
            document.getElementById('statVal1').innerText = Array.isArray(data) ? data.length : 0;
            document.getElementById('statVal2').innerText = completed;
            const avg = (Array.isArray(data) && completed > 0) ? data.reduce((acc, curr) => acc + (curr.score || 0), 0) / completed : 0;
            document.getElementById('statVal3').innerText = `${avg.toFixed(1)}%`;
        }
    } catch (err) {
        console.error("Dashboard Sync Error:", err);
    }
}

function confirmLogout() {
    sessionStorage.clear();
    window.location.href = "index.html";
}