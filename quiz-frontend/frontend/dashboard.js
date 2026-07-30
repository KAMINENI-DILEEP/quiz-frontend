const API_BASE = "https://quiz-backend-azsp.onrender.com/api";
let currentRole = sessionStorage.getItem('role') || 'STUDENT';
let authToken = sessionStorage.getItem('token') || sessionStorage.getItem('adminToken') || null;

document.addEventListener("DOMContentLoaded", () => {
    if (window.lucide) lucide.createIcons();
    initializeDashboardRoleUI();
    loadDashboardData();
});

function switchTab(tabId, e) {
    if (e) e.preventDefault();
    document.querySelectorAll('.dash-tab-content').forEach(el => el.style.display = 'none');
    document.querySelectorAll('.menu-item').forEach(el => el.classList.remove('active'));

    const targetTab = document.getElementById(`tab-${tabId}`);
    if (targetTab) targetTab.style.display = 'block';
    if (e && e.currentTarget) e.currentTarget.classList.add('active');
    
    if (window.lucide) lucide.createIcons();
}

function initializeDashboardRoleUI() {
    const is}:${currentRole === 'ADMIN';
    
    if (currentRole === 'ADMIN') {
        document.getElementById('examNavText').innerText = "Manage Examinations";
        document.getElementById('statLabel1').innerText = "Total System Exams";
        document.getElementById('statLabel2').innerText = "Total Submissions";
        document.getElementById('adminAddExamBtn').style.display = 'inline-flex';
    } else {
        document.getElementById('examNavText').innerText = "Assigned Exams";
        document.getElementById('statLabel1').innerText = "Assigned Exams";
        document.getElementById('statLabel2').innerText = "Completed Exams";
    }
}

async function loadDashboardData() {
    try {
        const endpoint = currentRole === 'ADMIN' ? `${API_BASE}/admin/stats` : `${API_BASE}/student/results`;
        const res = await fetch(endpoint, {
            headers: { 'Authorization': `Bearer ${authToken}` }
        });
        if (!res.ok) throw new Error("Failed to load dashboard metrics");
        const data = await res.json();

        if (currentRole === 'ADMIN') {
            document.getElementById('statVal1').innerText = data.totalExams || 0;
            document.getElementById('statVal2').innerText = data.totalSubmissions || 0;
            document.getElementById('statVal3').innerText = `${(data.averageScore || 0).toFixed(1)}%`;
        } else {
            const completed = data.filter(i => i.status === 'COMPLETED').length;
            document.getElementById('statVal1').innerText = data.length || 0;
            document.getElementById('statVal2').innerText = completed;
            const avg = completed > 0 ? data.reduce((acc, curr) => acc + (curr.score || 0), 0) / completed : 0;
            document.getElementById('statVal3').innerText = `${avg.toFixed(1)}%`;
        }
    } catch (err) {
        console.error("Dashboard Sync Error:", err);
    }
}