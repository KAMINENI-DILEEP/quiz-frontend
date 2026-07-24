const API_BASE_URL = 'https://quiz-backend-azsp.onrender.com/api';
let adminJwtToken = null;
let currentQuestionIndex = 0;
let isFetchingMetrics = false;

window.routeToView = function(viewId) {
    const views = document.querySelectorAll('.view');
    views.forEach(v => {
        v.classList.remove('active');
        v.style.removeProperty('display');
    });
         
    const targetView = document.getElementById(viewId);
    if (targetView) {
        targetView.classList.add('active');
    }
         
    const errorBlock = document.getElementById('errBlock');
    if (errorBlock) {
        errorBlock.style.display = 'none';
    }

    if (typeof lucide !== 'undefined') {
        requestAnimationFrame(() => lucide.createIcons());
    }
};

async function calculateDashboardMetrics() {
    if (isFetchingMetrics || !adminJwtToken) return; 
    isFetchingMetrics = true;
    
    const statExams = document.getElementById('statTotalExams');
    const statSubs = document.getElementById('statTotalSubmissions');
    const statAvg = document.getElementById('statAverageScore');
    
    if (statExams) statExams.innerText = "...";
    if (statSubs) statSubs.innerText = "...";
    if (statAvg) statAvg.innerText = "...";

    try {
        const [resultsRes, examsRes] = await Promise.all([
            fetch(`${API_BASE_URL}/results`, { headers: { 'Authorization': `Bearer ${adminJwtToken}` } }),
            fetch(`${API_BASE_URL}/admin/exams-list`, { headers: { 'Authorization': `Bearer ${adminJwtToken}` } })
        ]);

        const records = resultsRes.ok ? await resultsRes.json() : [];
        let uniqueExamsCount = 0;

        if (examsRes.ok) {
            const examsList = await examsRes.json();
            uniqueExamsCount = examsList.length;
        } else {
            uniqueExamsCount = [...new Set(records.map(r => r.examId))].length;
        }

        const finished = records.filter(r => r.status === 'COMPLETED');
        const avgScore = finished.length > 0 ? (finished.reduce((sum, r) => sum + r.score, 0) / finished.length) : 0;
        
        if (statExams) statExams.innerText = uniqueExamsCount || 0;
        if (statSubs) statSubs.innerText = finished.length;
        if (statAvg) statAvg.innerText = `${avgScore.toFixed(1)}%`;
    } catch(e) {
        console.error("Metrics collection error: ", e);
        if (statExams) statExams.innerText = "0";
        if (statSubs) statSubs.innerText = "0";
        if (statAvg) statAvg.innerText = "0.0%";
    } finally {
        isFetchingMetrics = false; 
    }
}

function initializeAdminPortalGateway() {
    if (typeof lucide !== 'undefined') {
        requestAnimationFrame(() => lucide.createIcons());
    }
         
    window.addEventListener('click', (e) => {
        if (!e.target.matches('.dropdown-trigger-btn') && !e.target.closest('.dropdown-trigger-btn')) {
            closeAdminDropdownDirectly();
        }
    });

    const sessionToken = sessionStorage.getItem('adminToken') || localStorage.getItem('adminToken');
    if (sessionToken) {
        adminJwtToken = sessionToken;
        window.routeToView('vAdminDash');
        calculateDashboardMetrics();
    } else {
        window.routeToView('vAdminLogin');
    }
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializeAdminPortalGateway);
} else {
    initializeAdminPortalGateway();
}

function toggleAdminDropdownMenu(event) {
    event.stopPropagation();
    const dropdown = document.getElementById('adminDropdownMenuContent');
    if (dropdown) {
        if (dropdown.style.display === 'none' || !dropdown.classList.contains('show-dropdown')) {
            dropdown.style.display = 'flex';
            dropdown.classList.add('show-dropdown');
        } else {
            dropdown.style.display = 'none';
            dropdown.classList.remove('show-dropdown');
        }
    }
}

function closeAdminDropdownDirectly() {
    const dropdown = document.getElementById('adminDropdownMenuContent');
    if (dropdown) {
        dropdown.classList.remove('show-dropdown');
        dropdown.style.display = 'none';
    }
}

function togglePasswordDisplay(inputElementId) {
    const field = document.getElementById(inputElementId);
    if (!field) return;
    
    const isPass = field.type === 'password';
    field.type = isPass ? 'text' : 'password';
         
    const wrapper = field.closest('.password-wrapper');
    if (wrapper) {
        const icon = wrapper.querySelector('.password-toggle-btn i, .password-toggle-btn [data-lucide]');
        if (icon && typeof lucide !== 'undefined') {
            icon.setAttribute('data-lucide', isPass ? 'eye-off' : 'eye');
            lucide.createIcons();
        }
    }
}

async function transmitAdminRegistration(e) {
    e.preventDefault();
    if (!adminJwtToken) {
        showAlert("Session expired. Please log in again.");
        window.routeToView('vAdminLogin');
        return;
    }
    try {
        const res = await fetch(`${API_BASE_URL}/admin/register-admin`, {
            method: 'POST',
            headers: { 
                'Content-Type': 'application/json', 
                'Authorization': `Bearer ${adminJwtToken}`
            },
            body: JSON.stringify({
                 name: document.getElementById('newAdminName').value,
                 email: document.getElementById('newAdminEmail').value,
                 password: document.getElementById('newAdminPassword').value
             })
        });
        if (!res.ok) {
            const errorData = await res.json().catch(() => ({}));
            throw new Error(errorData.message || 'Failed to create admin.');
        }
        alert('New Admin created.');
        e.target.reset();
        window.routeToView('vAdminDash');
        calculateDashboardMetrics();
    } catch (err) { showAlert(err.message); }
}

function executeAdminPasswordResetRequest(e) {
    e.preventDefault();
    const mail = document.getElementById('resetAdminEmailField').value;
    alert(`Administrative password reset confirmation link deployed successfully to: ${mail}`);
    e.target.reset();
    window.routeToView('vAdminLogin');
}

function showAlert(message) {
    const errorBlock = document.getElementById('errBlock');
    if (errorBlock) {
        errorBlock.innerText = message;
        errorBlock.style.display = 'block';
    }
}

async function executeAdminAuth(e) {
    e.preventDefault();
    const emailVal = document.getElementById('adminEmail').value;
    const passVal = document.getElementById('adminPassword').value;
    try {
        const res = await fetch(`${API_BASE_URL}/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email: emailVal, password: passVal })
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.message || 'Verification failure.');
        if (data.role !== 'ADMIN') throw new Error('Account lacks administrative privileges.');
        
        adminJwtToken = data.token;
        sessionStorage.setItem('adminToken', data.token);
              
        const profName = document.getElementById('profAdminName');
        const profEmail = document.getElementById('profAdminEmail');
        if (profName) profName.value = data.name || '';
        if (profEmail) profEmail.value = emailVal;
        
        window.routeToView('vAdminDash');
        calculateDashboardMetrics();
    } catch (err) {
        showAlert(err.message);
    }
}

function openAdminProfileSettings() {
    window.routeToView('vAdminProfile');
    const currPass = document.getElementById('profAdminCurrentPassword');
    const newPass = document.getElementById('profAdminNewPassword');
    if (currPass) currPass.value = '';
    if (newPass) newPass.value = '';
}

async function updateAdminGeneralMetadata(e) {
    e.preventDefault();
    const name = document.getElementById('profAdminName').value;
    const email = document.getElementById('profAdminEmail').value;
    try {
        const res = await fetch(`${API_BASE_URL}/profile/update-general`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${adminJwtToken}` },
            body: JSON.stringify({ name, email })
        });

        const textData = await res.text();
        const data = textData ? JSON.parse(textData) : {};

        if (!res.ok) throw new Error(data.message || 'Updates failed.');
        alert('Admin details updated successfully.');
        window.routeToView('vAdminDash');
    } catch(err) { 
        alert(err.message); 
    }
}

async function updateAdminPasswordSecurityMetric(e) {
    e.preventDefault();
    const currentPassword = document.getElementById('profAdminCurrentPassword').value;
    const newPassword = document.getElementById('profAdminNewPassword').value;
    try {
        const res = await fetch(`${API_BASE_URL}/profile/update-password`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${adminJwtToken}` },
            body: JSON.stringify({ currentPassword, newPassword })
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.message || 'Verification mismatch.');
        alert('Administrative password modified cleanly.');
        e.target.reset();
        window.routeToView('vAdminDash');
    } catch(err) { alert(err.message); }
}

function appendQuestionTemplate(type) {
    currentQuestionIndex++;
    const container = document.getElementById('dynamicQuestionsContainer');
    const block = document.createElement('div');
    block.className = 'card question-block';
    block.id = `qBlock_${currentQuestionIndex}`;
    block.dataset.type = type;
    let conditionalInputs = '';
    if (type === 'MCQ') {
        conditionalInputs = `
            <div class="form-group"><label>Option A</label><input type="text" class="optA" required></div>
            <div class="form-group"><label>Option B</label><input type="text" class="optB" required></div>
            <div class="form-group"><label>Option C</label><input type="text" class="optC" required></div>
            <div class="form-group"><label>Option D</label><input type="text" class="optD" required></div>
            <div class="form-group">
                <label>Correct Selection Key</label>
                <select class="correctOpt"><option value="A">A</option><option value="B">B</option><option value="C">C</option><option value="D">D</option></select>
            </div>
        `;
    } else {
        conditionalInputs = `
            <div class="form-group">
                <label>Correct Answer Key</label>
                <select class="correctOpt"><option value="A">True</option><option value="B">False</option></select>
            </div>
        `;
    }
    block.innerHTML = `
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:1rem;">
            <strong>Question Slot #${currentQuestionIndex} [${type}]</strong>
            <button type="button" class="btn-danger" style="padding:0.25rem 0.5rem; font-size:0.8rem;" onclick="document.getElementById('${block.id}').remove()">Remove</button>
        </div>
        <div class="form-group"><label>Question Wording</label><textarea class="qText" rows="2" required></textarea></div>
        ${conditionalInputs}
    `;
    container.appendChild(block);
}

async function transmitExamMatrix(e) {
    e.preventDefault();
    const blocks = document.querySelectorAll('.question-block');
    if (blocks.length === 0) { alert('Assessment must contain at least 1 question.'); return; }
    const questionsList = [];
    blocks.forEach(block => {
        const type = block.dataset.type;
        questionsList.push({
            question_text: block.querySelector('.qText').value,
            correct_option: block.querySelector('.correctOpt').value,
            option_a: type === 'MCQ' ? block.querySelector('.optA').value : 'True',
            option_b: type === 'MCQ' ? block.querySelector('.optB').value : 'False',
            option_c: type === 'MCQ' ? block.querySelector('.optC').value : null,
            option_d: type === 'MCQ' ? block.querySelector('.optD').value : null
        });
    });
    try {
        const res = await fetch(`${API_BASE_URL}/admin/exams`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${adminJwtToken}` },
            body: JSON.stringify({
                title: document.getElementById('examTitleInput').value,
                duration_minutes: parseInt(document.getElementById('examDurationInput').value),
                questionsList: questionsList
            })
        });
        if (!res.ok) throw new Error('Failed to save configuration.');
                 
        alert('Exam Published successfully.');
        document.getElementById('dynamicQuestionsContainer').innerHTML = '';
        e.target.reset();
        window.routeToView('vAdminDash');
        calculateDashboardMetrics();
    } catch (err) { showAlert(err.message); }
}

async function loadGlobalPerformanceTracker() {
    window.routeToView('vScoreTracker');
    try {
        const res = await fetch(`${API_BASE_URL}/results`, {
            headers: { 'Authorization': `Bearer ${adminJwtToken}` }
        });
        const dataset = await res.json();
        const tbody = document.getElementById('scoresTableBody');
        tbody.innerHTML = '';
                 
        dataset.forEach(row => {
            const isDone = row.status === 'COMPLETED';
            const pct = isDone ? row.score : 0;
            const progressBarHtml = `
                <div style="display:flex; align-items:center; gap:0.5rem;">
                    <span style="font-weight:bold; min-width:45px;">${pct.toFixed(1)}%</span>
                    <div style="flex-grow:1; background:#1e2638; height:8px; border-radius:4px; overflow:hidden;">
                        <div style="background:${pct >= 70 ? 'var(--success)' : pct >= 40 ? '#eab308' : 'var(--danger)'}; width:${pct}%; height:100%;"></div>
                    </div>
                </div>`;
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td>
                    <div style="font-weight: 700; color: var(--text-main);">${row.studentName}</div>
                    <small style="color: var(--text-muted);">UID: #${row.studentId}</small>
                </td>
                <td>Exam Target: ${row.examId}</td>
                <td><span style="color:${isDone ? 'var(--success)' : 'orange'}; font-weight:bold;">${row.status}</span></td>
                <td>${progressBarHtml}</td>
                <td>${row.timeSpentSeconds}s</td>
            `;
            tbody.appendChild(tr);
        });
    } catch (err) { showAlert('Failed to connect to result tracker systems.'); }
}

async function displayActiveExamsManagementList() {
    window.routeToView('vManageExams');
    try {
        const res = await fetch(`${API_BASE_URL}/admin/exams-list`, {
            headers: { 'Authorization': `Bearer ${adminJwtToken}` }
        });
        const exams = await res.json();
        const tbody = document.getElementById('managementExamsTableBody');
        tbody.innerHTML = '';
        if (exams.length === 0) {
            tbody.innerHTML = `<tr><td colspan="4" style="text-align:center; color:var(--text-muted);">No active exam matrices configured in system storage.</td></tr>`;
            return;
        }
        exams.forEach(exam => {
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td><strong>#${exam.examId}</strong></td>
                <td><span style="font-weight:600; color:var(--primary);">${exam.title}</span></td>
                <td>${exam.durationMinutes} Minutes</td>
                <td style="text-align: right;">
                    <button class="btn-danger" style="padding: 0.4rem 1rem; font-size: 0.85rem;" onclick="deleteExamMatrixEntryFromDatabase(${exam.examId})">Delete Matrix</button>
                </td>
            `;
            tbody.appendChild(tr);
        });
    } catch(err) {
        showAlert("Failed to query live examination list configuration profiles.");
    }
}

async function deleteExamMatrixEntryFromDatabase(examId) {
    if (!confirm(`Are you sure you want to completely delete Exam Matrix Entry #${examId}?`)) {
        return;
    }
    try {
        const res = await fetch(`${API_BASE_URL}/admin/exams/${examId}`, {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${adminJwtToken}` }
        });
        if (!res.ok) {
            const errorText = await res.text();
            let errorMessage = "Failed to drop the exam entry.";
            try {
                if (errorText) {
                    const errorJson = JSON.parse(errorText);
                    errorMessage = errorJson.message || errorMessage;
                }
            } catch(e) {
                if (errorText) errorMessage = errorText;
            }
            throw new Error(errorMessage);
        }
        alert('Exam matrix configuration successfully dropped.');
        displayActiveExamsManagementList();
    } catch(err) {
        alert("Deletion Failure: " + err.message);
    }
}

function openAdminLogoutModal() {
    const o = document.getElementById('adminLogoutModalOverlay');
    const c = document.getElementById('adminLogoutModalCard');
    if (o && c) {
        o.style.display = 'flex'; void o.offsetWidth;
        o.style.opacity = '1'; c.style.transform = 'scale(1)';
    }
}

function closeAdminLogoutModal() {
    const o = document.getElementById('adminLogoutModalOverlay');
    const c = document.getElementById('adminLogoutModalCard');
    if (o && c) {
        o.style.opacity = '0'; c.style.transform = 'scale(0.85)';
        setTimeout(() => { o.style.display = 'none'; }, 300);
    }
}

function confirmAdminLogout() {
    adminJwtToken = null;
    sessionStorage.removeItem('adminToken');
    localStorage.removeItem('adminToken');
    closeAdminLogoutModal();
    window.location.replace("index.html");
}
