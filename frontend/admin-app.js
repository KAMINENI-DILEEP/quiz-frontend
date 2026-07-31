const API = "https://quiz-backend-azsp.onrender.com/api";
let adminJwtToken = sessionStorage.getItem('adminToken') || null;

// Sub-16ms GPU View Router for Admin Portal
function routeToView(viewId) {
    requestAnimationFrame(() => {
        const views = document.querySelectorAll('.view');
        for (let i = 0; i < views.length; i++) {
            views[i].classList.remove('active');
            views[i].style.display = 'none';
        }

        const target = document.getElementById(viewId);
        if (target) {
            target.style.display = 'block';
            target.classList.add('active');
        }

        if (window.lucide) {
            lucide.createIcons();
        }
    });
}

document.addEventListener("DOMContentLoaded", () => {
    // Pre-warm backend HTTP connection on page load
    fetch(`${API}/ping`, { method: 'GET' }).catch(() => {});
    
    if (window.lucide) {
        lucide.createIcons();
    }

    // If token exists, load admin dashboard by default
    if (adminJwtToken) {
        loadAdminDashboardStats();
    }
});

// ==========================================================================
// 1. AUTHENTICATION (ADMIN & CANDIDATE) & PASSWORD RECOVERY
// ==========================================================================

async function executeAdminAuth(e) {
    if (e) e.preventDefault();
    
    const email = document.getElementById('adminEmail').value;
    const password = document.getElementById('adminPassword').value;

    try {
        const res = await fetch(`${API}/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password, authMode: 'EMAIL' })
        });

        const text = await res.text();
        const data = text ? JSON.parse(text) : {};

        if (!res.ok) throw new Error(data.message || 'Admin authentication failed.');
        if (data.role !== 'ADMIN') throw new Error('Unauthorized: Administrative privileges required.');

        adminJwtToken = data.token;
        sessionStorage.setItem('adminToken', data.token);

        const eb = document.getElementById('errBlock');
        if (eb) eb.style.display = 'none';

        routeToView('vAdminDash');
        loadAdminDashboardStats();
    } catch (err) {
        const eb = document.getElementById('errBlock');
        if (eb) {
            eb.innerText = err.message;
            eb.style.display = 'block';
        }
    }
}

// Candidate Login Handler
async function executeCandidateAuth(e) {
    if (e) e.preventDefault();
    const email = document.getElementById('candidateEmail').value;
    const password = document.getElementById('candidatePassword').value;

    try {
        const res = await fetch(`${API}/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password, authMode: 'EMAIL' })
        });

        const text = await res.text();
        const data = text ? JSON.parse(text) : {};

        if (!res.ok) throw new Error(data.message || 'Candidate authentication failed.');
        
        sessionStorage.setItem('token', data.token);
        sessionStorage.setItem('role', data.role);
        
        alert("Candidate login successful!");
        window.location.href = "index.html"; // Redirect to candidate portal space
    } catch (err) {
        alert(err.message);
    }
}

// Candidate Registration Handler (No OTP/Mobile required)
async function executeCandidateRegister(e) {
    if (e) e.preventDefault();
    const name = document.getElementById('regFullName').value;
    const email = document.getElementById('regEmail').value;
    const passwordHash = document.getElementById('regPassword').value;

    try {
        const res = await fetch(`${API}/register`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name, email, passwordHash, role: 'STUDENT' })
        });

        const text = await res.text();
        const data = text ? JSON.parse(text) : {};

        if (!res.ok) throw new Error(data.message || 'Registration failed.');
        alert('Candidate account created successfully! Please sign in.');
        routeToView('vCandidateLogin');
    } catch (err) {
        alert(err.message);
    }
}

// Direct Password Reset (No OTP Required)
async function confirmPasswordReset(e) {
    if (e) e.preventDefault();
    const email = document.getElementById('recoveryEmail').value;
    const newPassword = document.getElementById('newAccountPassword').value;

    if (!email || !newPassword) {
        alert("Please provide your email and your new password.");
        return;
    }

    try {
        const res = await fetch(`${API}/reset-password`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, newPassword })
        });
        
        const text = await res.text();
        const data = text ? JSON.parse(text) : {};

        if (!res.ok) throw new Error(data.message || 'Password reset failed.');
        alert("Password updated successfully. Please sign in with your new credentials.");
        routeToView('vAdminLogin');
    } catch (err) {
        alert(err.message);
    }
}

// ==========================================================================
// 2. ADMIN DASHBOARD METRICS & EXAM MANAGEMENT
// ==========================================================================

async function loadAdminDashboardStats() {
    routeToView('vAdminDash');
    try {
        const res = await fetch(`${API}/admin/stats`, {
            headers: { 'Authorization': `Bearer ${adminJwtToken}` }
        });
        const text = await res.text();
        if (!res.ok) {
            throw new Error(text || 'Failed to load stats');
        }
        const data = text ? JSON.parse(text) : {};

        document.getElementById('statTotalExams').innerText = data.totalExams || 0;
        document.getElementById('statTotalSubmissions').innerText = data.totalSubmissions || 0;
        document.getElementById('statAverageScore').innerText = `${(data.averageScore || 0).toFixed(1)}%`;
    } catch (err) {
        console.error(err);
    }
}

async function displayActiveExamsManagementList() {
    routeToView('vManageExams');
    try {
        const res = await fetch(`${API}/admin/exams`, {
            headers: { 'Authorization': `Bearer ${adminJwtToken}` }
        });
        const text = await res.text();
        if (!res.ok) {
            throw new Error(text || 'Failed to load exams list');
        }
        const list = text ? JSON.parse(text) : [];
        
        const tbody = document.getElementById('managementExamsTableBody');
        if (!tbody) return;

        let html = '';
        list.forEach(ex => {
            html += `
                <tr>
                    <td>#${ex.id}</td>
                    <td><strong>${ex.title}</strong></td>
                    <td>${ex.durationMinutes} mins</td>
                    <td style="text-align: right;">
                        <button class="btn-danger" onclick="deleteExamMatrix(${ex.id})" style="padding: 0.4rem 0.8rem; font-size: 0.85rem;">Delete</button>
                    </td>
                </tr>
            `;
        });
        tbody.innerHTML = html || '<tr><td colspan="4" style="text-align:center;">No examinations found.</td></tr>';
    } catch (err) {
        alert(err.message);
    }
}

async function deleteExamMatrix(id) {
    if (!confirm(`Are you sure you want to delete exam #${id}?`)) return;
    try {
        const res = await fetch(`${API}/admin/exams/${id}`, {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${adminJwtToken}` }
        });
        if (!res.ok) throw new Error('Deletion failed.');
        alert('Examination matrix deleted successfully.');
        displayActiveExamsManagementList();
    } catch (err) {
        alert(err.message);
    }
}

async function loadGlobalPerformanceTracker() {
    routeToView('vScoreTracker');
    try {
        const res = await fetch(`${API}/admin/results`, {
            headers: { 'Authorization': `Bearer ${adminJwtToken}` }
        });
        const text = await res.text();
        if (!res.ok) {
            throw new Error(text || 'Failed to load performance tracker');
        }
        const list = text ? JSON.parse(text) : [];

        const tbody = document.getElementById('scoresTableBody');
        if (!tbody) return;

        let html = '';
        list.forEach(item => {
            const grade = item.score || 0;
            html += `
                <tr>
                    <td>${item.studentName || 'Candidate'}</td>
                    <td>Exam #${item.examId}</td>
                    <td>${item.status}</td>
                    <td>
                        <div style="display:flex; align-items:center; gap:0.5rem;">
                            <div style="flex-grow:1; background:var(--surface); height:8px; border-radius:4px; overflow:hidden;">
                                <div style="width:${grade}%; background:var(--success); height:100%;"></div>
                            </div>
                            <span>${grade.toFixed(1)}%</span>
                        </div>
                    </td>
                    <td>${item.timeSpentSeconds || 0}s</td>
                </tr>
            `;
        });
        tbody.innerHTML = html || '<tr><td colspan="5" style="text-align:center;">No score submissions recorded.</td></tr>';
    } catch (err) {
        alert(err.message);
    }
}

// ==========================================================================
// 3. DROPDOWN, PROFILE & SESSION CONTROL
// ==========================================================================

function openAdminProfileSettings() {
    console.log("Admin profile settings opened.");
}

function openAdminLogoutModal() {
    const overlay = document.getElementById('adminLogoutModalOverlay');
    if (overlay) {
        overlay.style.display = 'flex';
        requestAnimationFrame(() => {
            overlay.style.opacity = '1';
            const card = document.getElementById('adminLogoutModalCard');
            if (card) card.style.transform = 'scale(1)';
        });
    }
}

function closeAdminLogoutModal() {
    const overlay = document.getElementById('adminLogoutModalOverlay');
    const card = document.getElementById('adminLogoutModalCard');
    if (card) card.style.transform = 'scale(0.85)';
    if (overlay) {
        overlay.style.opacity = '0';
        setTimeout(() => { overlay.style.display = 'none'; }, 150);
    }
}

function confirmAdminLogout() {
    adminJwtToken = null;
    sessionStorage.removeItem('adminToken');
    closeAdminLogoutModal();
    routeToView('vAdminLogin');
}
