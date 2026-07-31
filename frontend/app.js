const API = "https://quiz-backend-azsp.onrender.com/api";
let jwtToken = sessionStorage.getItem('token') || null;
let clockInterval = null;
let totalSecondsElapsed = 0;
let activeExamDurationSeconds = 0;
let mfaRequiredState = false;
const EXPECTED_MOCK_OTP = "123456";

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
    fetch(`${API}/ping`, { method: 'GET' }).catch(() => {});
    
    if (window.lucide) {
        lucide.createIcons();
    }
    
    bindOtpGroupInteractions('.mfa-box');
});

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

function getOtpValue(selector) {
    return Array.from(document.querySelectorAll(selector)).map(b => b.value).join('');
}

function togglePasswordDisplay(inputElementId) {
    const field = document.getElementById(inputElementId);
    if (!field) return;
    const isPass = field.type === 'password';
    field.type = isPass ? 'text' : 'password';

    const wrapper = field.closest('.password-wrapper');
    if (wrapper) {
        const btn = wrapper.querySelector('.password-toggle-btn i, .password-toggle-btn [data-lucide]');
        if (btn && window.lucide) {
            btn.setAttribute('data-lucide', isPass ? 'eye-off' : 'eye');
            lucide.createIcons();
        }
    }
}

function toggleAuthForms(showSignUp) {
    const signInCard = document.getElementById('authSignInCard');
    const signUpCard = document.getElementById('authSignUpCard');

    if (showSignUp) {
        if (signInCard) signInCard.style.display = 'none';
        if (signUpCard) signUpCard.style.display = 'block';
    } else {
        if (signInCard) signInCard.style.display = 'block';
        if (signUpCard) signUpCard.style.display = 'none';
    }
}

// Direct Password Reset (No OTP required)
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

// Complete Profile Registration directly without OTP
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
                role: 'STUDENT'
            })
        });
        const text = await res.text();
        const data = text ? JSON.parse(text) : {};
        if (!res.ok) throw new Error(data.message || 'Registration failed.');
        alert("Account registered successfully. Please sign in.");
        toggleAuthForms(false);
    } catch (err) { alert(err.message); }
}

async function appLogin(e) {
    if (e) e.preventDefault();

    let payload = { 
        authMode: 'EMAIL',
        email: document.getElementById('email').value,
        password: document.getElementById('password').value
    };

    if (mfaRequiredState) {
        payload.otp = getOtpValue('.mfa-box');
    }
    
    try {
        const res = await fetch(`${API}/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        const text = await res.text();
        const data = text ? JSON.parse(text) : {};
        if (!res.ok) throw new Error(data.message || 'Login verification failed.');

        if (data.mfaRequired) {
            mfaRequiredState = true;
            document.getElementById('mfaContainer').style.display = 'block';
            document.getElementById('btnLoginSubmit').innerText = "Verify 2FA Code & Sign In";
            setTimeout(() => {
                const firstMfaBox = document.getElementById('mfa_0');
                if (firstMfaBox) firstMfaBox.focus();
            }, 50);
            return;
        }

        if (data.role === 'ADMIN') {
            window.location.href = "admin.html";
            return;
        }
        
        jwtToken = data.token;
        sessionStorage.setItem('token', data.token);

        document.getElementById('usrName').innerText = data.name || 'Student';
        document.getElementById('profStudentName').value = data.name || '';
        document.getElementById('profStudentEmail').value = data.email || payload.email || '';

        const mfaToggle = document.getElementById('mfaToggle');
        if (mfaToggle) mfaToggle.checked = !!data.mfaEnabled;

        const eb = document.getElementById('errBlock');
        if (eb) eb.style.display = 'none';

        showDashboardView();
    } catch (err) {
        const eb = document.getElementById('errBlock');
        if (eb) {
            eb.innerText = err.message;
            eb.style.display = 'block';
        }
    }
}

async function showDashboardView() {
    routeTo('vDash');

    if (dataCache.dashboard) {
        renderDashboardExams(dataCache.dashboard);
    }

    try {
        const res = await fetch(`${API}/student/results`, {
            headers: { 'Authorization': `Bearer ${jwtToken}` }
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
            headers: { 'Authorization': `Bearer ${jwtToken}` }
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

async function toggleMfaSetting(enabled) {
    try {
        const res = await fetch(`${API}/profile/toggle-mfa`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${jwtToken}`
            },
            body: JSON.stringify({ mfaEnabled: enabled })
        });
        const text = await res.text();
        const data = text ? JSON.parse(text) : {};
        if (!res.ok) throw new Error(data.message || 'Toggle failed.');
        alert(`Two-Factor Authentication is now ${enabled ? 'ENABLED' : 'DISABLED'}.`);
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
    mfaRequiredState = false;
    sessionStorage.clear();
    closeLogoutModal();
    routeTo('vAuthSpace');
}
