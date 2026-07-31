const API = "https://quiz-backend-hrjv.onrender.com/api";
let jwtToken = sessionStorage.getItem('token') || null;
let clockInterval = null;
let totalSecondsElapsed = 0;
let activeExamDurationSeconds = 0;

const dataCache = {
    dashboard: null,
    exams: {}
};

function routeTo(viewId) {
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
    fetch(`${API}/ping`, { method: 'GET' }).catch(() => { });

    if (window.lucide) {
        lucide.createIcons();
    }
});

function togglePasswordDisplay(fieldId) {
    const passwordInput = document.getElementById(fieldId);
    if (!passwordInput) return;

    const button = event.currentTarget;
    const icon = button ? button.querySelector('i') : null;

    if (passwordInput.type === 'password') {
        passwordInput.type = 'text';
        if (icon) {
            icon.setAttribute('data-lucide', 'eye-off');
        }
    } else {
        passwordInput.type = 'password';
        if (icon) {
            icon.setAttribute('data-lucide', 'eye');
        }
    }

    if (window.lucide) {
        lucide.createIcons();
    }
}

function triggerAuthSlide(isSignUp) {
    const container = document.getElementById('swappingContainer');
    if (container) {
        if (isSignUp) {
            container.classList.add('right-panel-active', 'active-signup');
        } else {
            container.classList.remove('right-panel-active', 'active-signup');
        }
    }
}

// Direct Password Reset
async function confirmPasswordReset(e) {
    e.preventDefault();
    const email = document.getElementById('recoveryEmail').value;
    const newPassword = document.getElementById('newAccountPassword').value;

    if (!email || !newPassword) {
        alert("Please provide your email and new password.");
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
        routeTo('vAuthSpace');
    } catch (err) {
        alert(err.message);
    }
}

// Complete Profile Registration with Gender Parameter
async function appRegister(e) {
    e.preventDefault();

    try {
        const res = await fetch(`${API}/register`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                name: document.getElementById('regName').value,
                email: document.getElementById('regEmail').value,
                passwordHash: document.getElementById('regPassword').value,
                gender: document.getElementById('regGender').value,
                role: 'STUDENT'
            })
        });
        const text = await res.text();
        const data = text ? JSON.parse(text) : {};
        if (!res.ok) throw new Error(data.message || 'Registration failed.');
        alert("Account registered successfully. Please sign in.");
        triggerAuthSlide(false);
    } catch (err) { alert(err.message); }
}

async function appLogin(e) {
    if (e) e.preventDefault();

    let payload = {
        email: document.getElementById('email').value,
        password: document.getElementById('password').value
    };

    try {
        const res = await fetch(`${API}/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        const text = await res.text();
        const data = text ? JSON.parse(text) : {};
        if (!res.ok) throw new Error(data.message || 'Login verification failed.');

        jwtToken = data.token;
        sessionStorage.setItem('token', data.token);
        sessionStorage.setItem('role', data.role);
        sessionStorage.setItem('name', data.name || 'Student');
        sessionStorage.setItem('email', data.email || payload.email);

        if (role === 'ADMIN') {
            window.location.href = "dashboard.html";
        } else {
            window.location.href = "student-dashboard.html";
        }

        const usrNameEl = document.getElementById('usrName');
        if (usrNameEl) usrNameEl.innerText = data.name || 'Student';

        const profNameEl = document.getElementById('profStudentName');
        if (profNameEl) profNameEl.value = data.name || '';

        const profEmailEl = document.getElementById('profStudentEmail');
        if (profEmailEl) profEmailEl.value = data.email || payload.email || '';

        const eb = document.getElementById('errBlock');
        if (eb) eb.style.display = 'none';

        window.location.href = "dashboard.html";
    } catch (err) {
        const eb = document.getElementById('errBlock');
        if (eb) {
            eb.innerText = err.message;
            eb.style.display = 'block';
        }
    }
}

async function appAdminLogin(e) {
    if (e) e.preventDefault();
    const email = document.getElementById('adminEmail').value;
    const password = document.getElementById('adminPassword').value;

    try {
        const res = await fetch(`${API}/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password })
        });

        const text = await res.text();
        const data = text ? JSON.parse(text) : {};

        if (!res.ok) throw new Error(data.message || 'Admin authentication failed.');
        if (data.role !== 'ADMIN') throw new Error('Unauthorized: Administrative privileges required.');

        jwtToken = data.token;
        sessionStorage.setItem('token', data.token);
        sessionStorage.setItem('role', data.role);
        sessionStorage.setItem('name', data.name || 'Admin');
        sessionStorage.setItem('email', data.email || email);

        window.location.href = "dashboard.html";
    } catch (err) {
        alert(err.message);
    }
}

async function showDashboardView() {
    routeTo('vDash');

    if (dataCache.dashboard) {
        renderDashboardExams(dataCache.dashboard);
    }

    try {
        const res = await fetch(`${API}/student/results`, {
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${jwtToken}`
            }
        });

        if (!res.ok) throw new Error("Dashboard fetch error");

        const list = await res.json();
        dataCache.dashboard = list;
        renderDashboardExams(list);
    } catch (err) {
        console.error(err);
    }
}

function renderDashboardExams(list) {
    const container = document.getElementById('examList');
    if (!container) return;

    let html = '';
    list.forEach(item => {
        const done = item.status === 'COMPLETED';
        html += `
            <div style="padding:1rem; border:1px solid var(--border); margin-bottom:0.5rem; display:flex; justify-content:space-between; align-items:center; background:var(--surface-card); border-radius:8px;">
                <div>
                    <strong>Exam Reference Assignment ID: #${item.examId}</strong><br>
                    <small style="color:var(--text-muted);">Status: ${item.status} ${done ? `| Grade: ${item.score.toFixed(1)}%` : ''}</small>
                </div>
                ${done ? '<strong>Locked</strong>' : `<button class="btn-primary" onclick="startExamEngine(${item.examId})">Start Exam</button>`}
            </div>
        `;
    });

    container.innerHTML = html;
}

async function startExamEngine(id) {
    try {
        if (dataCache.exams[id]) {
            renderExamQuestions(dataCache.exams[id], id);
            return;
        }

        const res = await fetch(`${API}/student/exams/${id}/start`, {
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${jwtToken}`
            }
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.message);

        dataCache.exams[id] = data;
        renderExamQuestions(data, id);
    } catch (err) { alert(err.message); }
}

function renderExamQuestions(data, id) {
    document.getElementById('examTitle').innerText = data.exam.title;
    const container = document.getElementById('questionsContainer');

    let html = '';
    data.questions.forEach((q, index) => {
        html += `
            <div class="q-card card" data-exam-id="${id}">
                <p style="margin-top:1rem; font-weight:700;">Q${index + 1}: ${q.questionText}</p>
                <label class="option"><input type="radio" name="q_${q.questionId}" value="A" required> ${q.optionA}</label>
                <label class="option"><input type="radio" name="q_${q.questionId}" value="B"> ${q.optionB}</label>
                ${q.optionC ? `<label class="option"><input type="radio" name="q_${q.questionId}" value="C"> ${q.optionC}</label>` : ''}
                ${q.optionD ? `<label class="option"><input type="radio" name="q_${q.questionId}" value="D"> ${q.optionD}</label>` : ''}
            </div>
        `;
    });

    container.innerHTML = html;
    routeTo('vExam');
    runClock(data.exam.durationMinutes, id);
}

function runClock(mins, examId) {
    clearInterval(clockInterval);
    totalSecondsElapsed = 0;
    activeExamDurationSeconds = mins * 60;

    const clockEl = document.getElementById('clock');
    clockInterval = setInterval(() => {
        totalSecondsElapsed++;
        let remainder = activeExamDurationSeconds - totalSecondsElapsed;
        if (remainder <= 0) {
            clearInterval(clockInterval);
            submitExamPayload(null, examId);
        } else {
            let m = Math.floor(remainder / 60).toString().padStart(2, '0');
            let s = (remainder % 60).toString().padStart(2, '0');
            clockEl.innerText = `${m}:${s}`;
        }
    }, 1000);
}

async function submitExamPayload(e, autoId = null) {
    if (e) e.preventDefault();
    clearInterval(clockInterval);

    const answers = [];
    const qCards = document.querySelectorAll('.q-card');
    if (qCards.length === 0) return;

    const targetExamId = autoId || qCards[0].dataset.examId;
    qCards.forEach(card => {
        const input = card.querySelector('input[type="radio"]');
        if (input) {
            const id = input.name.split('_')[1];
            const checked = card.querySelector('input[type="radio"]:checked');
            answers.push({
                question_id: parseInt(id),
                selected: checked ? checked.value : ""
            });
        }
    });

    try {
        const res = await fetch(`${API}/student/exams/${targetExamId}/submit`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${jwtToken}`
            },
            body: JSON.stringify({ answers: answers, time_spent_seconds: totalSecondsElapsed })
        });

        if (!res.ok) throw new Error("Submission network routing validation failure.");
        const data = await res.json();

        dataCache.dashboard = null;

        document.getElementById('scoreMetric').innerText = `${data.score.toFixed(2)}%`;
        document.getElementById('timeMetric').innerText = data.time_spent_seconds;
        routeTo('vResult');
    } catch (err) { alert("Submission Error: " + err.message); }
}

function openStudentProfileSettings() {
    routeTo('vStudentProfile');
    document.getElementById('profStudentCurrentPassword').value = '';
    document.getElementById('profStudentNewPassword').value = '';
}

async function updateStudentGeneralMetadata(e) {
    e.preventDefault();
    try {
        const res = await fetch(`${API}/profile/update-general`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${jwtToken}`
            },
            body: JSON.stringify({
                name: document.getElementById('profStudentName').value,
                email: document.getElementById('profStudentEmail').value
            })
        });
        const text = await res.text();
        const data = text ? JSON.parse(text) : {};
        if (!res.ok) throw new Error(data.message || 'Profile updates rejected.');
        alert('General profile updates saved successfully.');
        document.getElementById('usrName').innerText = document.getElementById('profStudentName').value;
        showDashboardView();
    } catch (err) { alert(err.message); }
}

async function updateStudentPasswordSecurityMetric(e) {
    e.preventDefault();
    try {
        const res = await fetch(`${API}/profile/update-password`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${jwtToken}`
            },
            body: JSON.stringify({
                currentPassword: document.getElementById('profStudentCurrentPassword').value,
                newPassword: document.getElementById('profStudentNewPassword').value
            })
        });
        const text = await res.text();
        const data = text ? JSON.parse(text) : {};
        if (!res.ok) throw new Error(data.message || 'Password update rejected.');
        alert('Password modified successfully.');
        e.target.reset();
        showDashboardView();
    } catch (err) { alert(err.message); }
}

function openLogoutModal() {
    const overlay = document.getElementById('logoutModalOverlay');
    if (overlay) {
        overlay.style.display = 'flex';
        requestAnimationFrame(() => {
            overlay.style.opacity = '1';
            const card = document.getElementById('logoutModalCard');
            if (card) card.style.transform = 'scale(1)';
        });
    }
}

function closeLogoutModal() {
    const overlay = document.getElementById('logoutModalOverlay');
    const card = document.getElementById('logoutModalCard');
    if (card) card.style.transform = 'scale(0.85)';
    if (overlay) {
        overlay.style.opacity = '0';
        setTimeout(() => { overlay.style.display = 'none'; }, 150);
    }
}

function confirmApplicationLogout() {
    jwtToken = null;
    sessionStorage.clear();
    closeLogoutModal();
    routeTo('vAuthSpace');
}