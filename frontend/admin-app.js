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
    
    // Bind split 6-digit OTP handlers for recovery
    bindOtpGroupInteractions('.recovery-otp-box');

    // If token exists, load admin dashboard by default
    if (adminJwtToken) {
        loadAdminDashboardStats();
    }
});

// ==========================================================================
// 1. ADMIN AUTHENTICATION & PASSWORD RECOVERY
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

// Request Password Reset Code via Email (Shared with Admin and Users)
async function requestPasswordResetOtp() {
    const email = document.getElementById('recoveryEmail').value;
    if (!email) {
        alert("Please enter your administrative email address.");
        return;
    }

    try {
        const res = await fetch(`${API}/forgot-password`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email })
        });
        
        const text = await res.text();
        const data = text ? JSON.parse(text) : {};

        if (!res.ok) throw new Error(data.message || 'Failed to dispatch recovery code.');
        alert(`Recovery code dispatched to: ${email}`);
        
        const otpContainer = document.getElementById('recoveryOtpContainer');
        if (otpContainer) {
            otpContainer.style.display = 'block';
        }
    } catch (err) {
        alert(err.message);
    }
}

// Complete Password Reset with Email & Split OTP Code
async function confirmPasswordReset(e) {
    if (e) e.preventDefault();
    const email = document.getElementById('recoveryEmail').value;
    const otp = getOtpValue('.recovery-otp-box');
    const newPassword = document.getElementById('newAccountPassword').value;

    if (!email || otp.length !== 6 || !newPassword) {
        alert("Please provide your email, the 6-digit verification code, and your new password.");
        return;
    }

    try {
        const res = await fetch(`${API}/reset-password`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, otp, newPassword })
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

function getOtpValue(selector) {
    return Array.from(document.querySelectorAll(selector)).map(b => b.value).join('');
}

function bindOtpGroupInteractions(selector) {
    const boxes = document.querySelectorAll(selector);
    boxes.forEach((box, index) => {
        box.addEventListener('input', (e) => {
            if (e.target.value.length === 1 && index < boxes.length - 1) {
                boxes[index + 1].focus();
            }
        });
        box.addEventListener('keydown', (e) => {
            if (e.key === 'Backspace' && !e.target.value && index > 0) {
                boxes[index - 1].focus();
            }
        });
        box.addEventListener('paste', (e) => {
            e.preventDefault();
            const text = e.clipboardData.getData('text').trim();
            if (/^\d{6}$/.test(text)) {
                text.split('').forEach((char, i) => {
                    if (boxes[i]) boxes[i].value = char;
                });
                boxes[boxes.length - 1].focus();
            }
        });
    });
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
        const data = text ? JSON.parse(text) : {};
        if (!res.ok) throw new Error(data.message || 'Failed to load stats');

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
// 3. DROPDOWN & SESSION CONTROL
// ==========================================================================

function toggleAdminDropdownMenu(e) {
    if (e) e.stopPropagation();
    const menu = document.getElementById('adminDropdownMenuContent');
    if (menu) {
        menu.style.display = menu.style.display === 'block' ? 'none' : 'block';
    }
}

function closeAdminDropdownDirectly() {
    const menu = document.getElementById('adminDropdownMenuContent');
    if (menu) menu.style.display = 'none';
}

window.addEventListener('click', () => {
    closeAdminDropdownDirectly();
});

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
    routeToView('index.html');
}
