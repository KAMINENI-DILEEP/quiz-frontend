const API = "https://quiz-backend-hrjv.onrender.com/api";
let adminJwtToken = sessionStorage.getItem('adminToken') || sessionStorage.getItem('token') || null;

document.addEventListener("DOMContentLoaded", () => {
    if (window.lucide) { lucide.createIcons(); }

    // Pre-warm ping check
    fetch(`${API}/ping`, { method: 'GET' }).catch(() => { });

    // Display Admin Email if element exists
    const emailSpan = document.getElementById('adminEmailDisplay');
    if (emailSpan && sessionStorage.getItem('email')) {
        emailSpan.innerText = sessionStorage.getItem('email');
    }

    // Check token and manage view routing safely inside admin.html
    if (adminJwtToken && document.getElementById('vAdminDash')) {
        showDashboardView();
    } else if (document.getElementById('vAdminLogin')) {
        showLoginView();
    }

    // Automatically trigger data load with sorting on page load if elements exist
    if (document.getElementById('admin-results-table-body')) {
        fetchAdminResultsWithSorting();
    }
});

function showLoginView(e) {
    if (e) e.preventDefault();
    const loginView = document.getElementById('vAdminLogin');
    const forgotView = document.getElementById('vForgotPassword');
    const adminDash = document.getElementById('vAdminDash');

    if (loginView) loginView.style.display = 'flex';
    if (forgotView) forgotView.style.display = 'none';
    if (adminDash) adminDash.style.display = 'none';
    if (window.lucide) { lucide.createIcons(); }
}

function showForgotPasswordView(e) {
    if (e) e.preventDefault();
    const loginView = document.getElementById('vAdminLogin');
    const forgotView = document.getElementById('vForgotPassword');
    const adminDash = document.getElementById('vAdminDash');

    if (loginView) loginView.style.display = 'none';
    if (forgotView) forgotView.style.display = 'flex';
    if (adminDash) adminDash.style.display = 'none';
    if (window.lucide) { lucide.createIcons(); }
}

function showDashboardView() {
    const loginView = document.getElementById('vAdminLogin');
    const forgotView = document.getElementById('vForgotPassword');
    const adminDash = document.getElementById('vAdminDash');

    if (loginView) loginView.style.display = 'none';
    if (forgotView) forgotView.style.display = 'none';
    if (adminDash) adminDash.style.display = 'flex';

    fetchAdminResultsWithSorting();
}

async function executeAdminAuth(e) {
    if (e) e.preventDefault();

    const emailEl = document.getElementById('adminEmail');
    const passwordEl = document.getElementById('adminPassword');
    const eb = document.getElementById('errBlock');

    if (!emailEl || !passwordEl) return;

    const email = emailEl.value;
    const password = passwordEl.value;

    try {
        const res = await fetch(`${API}/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password })
        });

        const text = await res.text();
        const data = text ? JSON.parse(text) : {};

        if (!res.ok) throw new Error(data.message || 'Invalid database credentials.');

        // Verify database role is strictly ADMIN
        if (data.role === 'ADMIN') {
            adminJwtToken = data.token;
            sessionStorage.setItem('token', data.token);
            sessionStorage.setItem('adminToken', data.token);
            sessionStorage.setItem('role', data.role);
            sessionStorage.setItem('email', data.email || email);

            if (eb) eb.style.display = 'none';

            // Switch views or redirect seamlessly
            if (document.getElementById('vAdminDash')) {
                showDashboardView();
            } else {
                window.location.href = "admin.html";
            }
        } else {
            throw new Error('Unauthorized: Administrative privileges required.');
        }
    } catch (err) {
        if (eb) {
            eb.innerText = err.message;
            eb.style.display = 'block';
            setTimeout(() => { eb.style.display = 'none'; }, 4000);
        } else {
            alert(err.message);
        }
    }
}

async function confirmPasswordReset(e) {
    if (e) e.preventDefault();
    const emailEl = document.getElementById('recoveryEmail');
    const passEl = document.getElementById('newAccountPassword');
    const eb = document.getElementById('errBlock');

    if (!emailEl || !passEl) return;

    const email = emailEl.value;
    const newPassword = passEl.value;

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
        showLoginView();
    } catch (err) {
        if (eb) {
            eb.innerText = err.message;
            eb.style.display = 'block';
            setTimeout(() => { eb.style.display = 'none'; }, 4000);
        } else {
            alert(err.message);
        }
    }
}

async function fetchAdminResultsWithSorting() {
    const genderFilterEl = document.getElementById('adminFilterGender') || document.getElementById('filter-gender');
    const examFilterEl = document.getElementById('adminSortExam');
    const sortOrderEl = document.getElementById('adminSortOrder') || document.getElementById('sort-order');

    const genderFilter = genderFilterEl ? genderFilterEl.value : 'ALL';
    const examFilter = examFilterEl ? examFilterEl.value : 'ALL';
    const sortOrder = sortOrderEl ? sortOrderEl.value : 'high-to-low';

    const tableBody = document.getElementById('admin-results-table-body');
    if (!tableBody) return;

    tableBody.innerHTML = `<tr><td colspan="4" class="p-6 text-center text-slate-400">Filtering records...</td></tr>`;

    try {
        const token = sessionStorage.getItem('adminToken') || sessionStorage.getItem('token');

        const response = await fetch(`${API}/admin/results`, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            }
        });

        if (!response.ok) throw new Error("Failed to load student exam records.");

        let records = await response.json();

        // 1. Filter by Gender
        if (genderFilter !== 'ALL') {
            records = records.filter(r => {
                const g = r.gender || (r.user && r.user.gender);
                return g && g.toLowerCase() === genderFilter.toLowerCase();
            });
        }

        // 2. Filter by Exam Reference ID
        if (examFilter !== 'ALL') {
            records = records.filter(r => {
                const eId = r.examId || (r.exam && r.exam.id);
                return String(eId) === String(examFilter);
            });
        }

        // 3. Sort by Score (High to Low / Low to High)
        records.sort((a, b) => {
            const scoreA = a.score !== undefined ? a.score : 0;
            const scoreB = b.score !== undefined ? b.score : 0;
            return sortOrder === 'high-to-low' ? scoreB - scoreA : scoreA - scoreB;
        });

        // Clear and render table rows
        tableBody.innerHTML = '';

        if (records.length === 0) {
            tableBody.innerHTML = `<tr><td colspan="4" class="p-6 text-center text-slate-400">No matching student records found.</td></tr>`;
            return;
        }

        records.forEach(record => {
            const studentName = record.studentName || record.name || (record.user ? record.user.name : 'Unknown Student');
            const studentGender = record.gender || (record.user ? record.user.gender : 'N/A');
            const examTitle = record.examTitle || (record.exam ? record.exam.title : `Exam #${record.examId || '1'}`);
            const scoreVal = record.score !== undefined ? record.score : 0.0;

            const row = document.createElement('tr');
            row.className = "border-b border-slate-800/60 hover:bg-slate-900/40 transition";
            row.innerHTML = `
                <td class="p-4 font-medium text-white">${studentName}</td>
                <td class="p-4 text-slate-300">${studentGender || 'N/A'}</td>
                <td class="p-4 text-slate-300">${examTitle}</td>
                <td class="p-4 font-semibold text-emerald-400">${typeof scoreVal === 'number' ? scoreVal.toFixed(1) : scoreVal}%</td>
            `;
            tableBody.appendChild(row);
        });

    } catch (err) {
        console.error(err);
        tableBody.innerHTML = `<tr><td colspan="4" class="p-6 text-center text-rose-400">Error loading records or unauthorized access.</td></tr>`;
    }
}

function switchAdminTab(tabName, event) {
    if (event) event.preventDefault();

    document.querySelectorAll('.dash-tab-content').forEach(el => {
        el.style.display = 'none';
        el.classList.remove('active');
    });

    document.querySelectorAll('aside nav a').forEach(el => {
        el.classList.remove('active', 'bg-emerald-500/20', 'text-emerald-300');
        el.classList.add('text-slate-400');
    });

    const targetTab = document.getElementById(`tab-${tabName}`);
    if (targetTab) {
        targetTab.style.display = 'block';
        targetTab.classList.add('active');
    }

    if (event && event.currentTarget) {
        event.currentTarget.classList.add('active', 'bg-emerald-500/20', 'text-emerald-300');
        event.currentTarget.classList.remove('text-slate-400');
    }

    if (window.lucide) {
        lucide.createIcons();
    }
}

function confirmAdminLogout() {
    adminJwtToken = null;
    sessionStorage.clear();
    showLoginView();
}

function togglePasswordDisplay(fieldId) {
    const passwordInput = document.getElementById(fieldId);
    if (!passwordInput) return;

    const button = event ? event.currentTarget : null;
    const icon = button ? button.querySelector('i') : null;

    if (passwordInput.type === 'password') {
        passwordInput.type = 'text';
        if (icon) icon.setAttribute('data-lucide', 'eye-off');
    } else {
        passwordInput.type = 'password';
        if (icon) icon.setAttribute('data-lucide', 'eye');
    }

    if (window.lucide) {
        lucide.createIcons();
    }
}