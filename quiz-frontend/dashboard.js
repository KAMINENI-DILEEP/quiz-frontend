const API_BASE = "https://quiz-backend-hrjv.onrender.com/api";
const authToken = sessionStorage.getItem('token');
const currentRole = sessionStorage.getItem('role');
let studentResults = [];

// ==========================================
// INITIALIZATION & AUTHENTICATION
// ==========================================
document.addEventListener('DOMContentLoaded', async () => {
  if (!authToken || currentRole !== 'STUDENT') {
    window.location.replace('index.html');
    return;
  }
  hydrateIdentity();
  if (window.lucide) lucide.createIcons();
  await loadStudentData();
});

function hydrateIdentity() {
  const name = sessionStorage.getItem('name') || 'Student';
  const email = sessionStorage.getItem('email') || '';
  const initial = (name || email || 'S').trim().charAt(0).toUpperCase();

  ['dashUserName', 'sideName'].forEach(id => {
    const e = document.getElementById(id);
    if (e) e.textContent = name;
  });

  ['userAvatarText', 'sideAvatar'].forEach(id => {
    const e = document.getElementById(id);
    if (e) e.textContent = initial;
  });

  document.getElementById('navUserEmail').textContent = email || 'Student account';
  document.getElementById('profileFullName').value = name;
  document.getElementById('profileEmail').value = email;
}

// ==========================================
// API DATA FETCHING
// ==========================================
async function loadStudentData() {
  try {
    const res = await fetch(`${API_BASE}/student/results`, {
      headers: {
        Authorization: `Bearer ${authToken}`,
        'Content-Type': 'application/json'
      }
    });

    if (res.status === 401 || res.status === 403) {
      sessionStorage.clear();
      window.location.replace('index.html');
      return;
    }

    if (!res.ok) throw new Error('Could not load your examination data.');

    const data = await res.json();
    studentResults = Array.isArray(data) ? data : [];
    renderStudentDashboard();
  } catch (err) {
    document.getElementById('examList').innerHTML = `<div class="dashboard-panel error-cell">${escapeHtml(err.message)}</div>`;
  }
}

async function updateStudentProfile(e) {
  e.preventDefault();
  const name = document.getElementById('profileFullName').value.trim();
  const email = document.getElementById('profileEmail').value.trim();

  try {
    const res = await fetch(`${API_BASE}/profile/update-general`, {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${authToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ name, email })
    });

    const data = await safeJson(res);
    if (!res.ok) throw new Error(data.message || 'Profile update failed.');

    sessionStorage.setItem('name', name);
    sessionStorage.setItem('email', email);
    hydrateIdentity();
    alert('Profile updated successfully.');
  } catch (err) {
    alert(err.message);
  }
}

// ==========================================
// DASHBOARD RENDERING & METRICS
// ==========================================
function renderStudentDashboard() {
  const completed = studentResults.filter(x => String(x.status).toUpperCase() === 'COMPLETED');
  const avg = completed.length ? completed.reduce((s, x) => s + Number(x.score || 0), 0) / completed.length : 0;
  const progress = studentResults.length ? Math.round((completed.length / studentResults.length) * 100) : 0;

  document.getElementById('statVal1').textContent = studentResults.length;
  document.getElementById('statVal2').textContent = completed.length;
  document.getElementById('statVal3').textContent = `${avg.toFixed(1)}%`;

  document.getElementById('progress-percent-text').textContent = `${progress}%`;
  document.getElementById('progress-bar-fill').style.width = `${progress}%`;
  document.getElementById('progress-caption').textContent = `${completed.length} of ${studentResults.length} assigned exams completed.`;

  renderExamList();
  renderRecent();
  renderNextExam();
}

function renderExamList() {
  const el = document.getElementById('examList');

  if (!studentResults.length) {
    el.innerHTML = '<div class="dashboard-panel empty-state"><i data-lucide="inbox"></i><h4>No exams assigned</h4><p>New assessments will appear here when they are assigned.</p></div>';
    return;
  }

  el.innerHTML = studentResults.map(item => {
    const done = String(item.status).toUpperCase() === 'COMPLETED';
    return `
            <article class="exam-card">
                <div class="exam-card-top">
                    <span class="status-badge ${done ? 'completed' : 'pending'}">${done ? 'Completed' : 'Pending'}</span>
                    <span class="exam-ref">#${escapeHtml(examId(item) ?? '—')}</span>
                </div>
                <h4>${escapeHtml(examName(item))}</h4>
                <p>${done ? `Final score: <strong>${Number(item.score || 0).toFixed(1)}%</strong>` : 'This assessment is ready when you are.'}</p>
                <div class="exam-card-footer">
                    ${done ? '<span class="locked-label"><i data-lucide="lock"></i> Submitted</span>' : `<button class="btn-success compact-btn" onclick="startAssignedExam('${escapeHtml(examId(item))}')"><i data-lucide="play"></i> Start Exam</button>`}
                </div>
            </article>
        `;
  }).join('');

  if (window.lucide) lucide.createIcons();
}

function renderRecent() {
  const el = document.getElementById('recentActivity');
  const rows = studentResults.slice(0, 4);

  el.innerHTML = rows.length ? rows.map(x => {
    const isDone = String(x.status).toUpperCase() === 'COMPLETED';
    return `
            <div class="activity-row">
                <div class="activity-icon"><i data-lucide="${isDone ? 'check' : 'clock-3'}"></i></div>
                <div><strong>${escapeHtml(examName(x))}</strong><small>${escapeHtml(x.status || 'PENDING')}</small></div>
                <span>${isDone ? Number(x.score || 0).toFixed(1) + '%' : 'Pending'}</span>
            </div>
        `;
  }).join('') : '<p class="panel-note">No activity yet.</p>';

  if (window.lucide) lucide.createIcons();
}

function renderNextExam() {
  const pending = studentResults.find(x => String(x.status).toUpperCase() !== 'COMPLETED');
  const el = document.getElementById('nextExamCard');

  el.innerHTML = pending ? `
        <strong>${escapeHtml(examName(pending))}</strong>
        <p>Pending assessment ready to start.</p>
        <button class="btn-success compact-btn" onclick="startAssignedExam('${escapeHtml(examId(pending))}')">Open assessment</button>
    ` : `
        <strong>All caught up!</strong>
        <p>You have completed every currently assigned exam.</p>
    `;
}

// ==========================================
// NAVIGATION & HELPERS
// ==========================================
function switchStudentTab(tab, e) {
  if (e) e.preventDefault();
  document.querySelectorAll('.dash-tab-content').forEach(x => x.style.display = 'none');
  document.querySelectorAll('.menu-item').forEach(x => x.classList.remove('active'));

  document.getElementById(`tab-${tab}`).style.display = 'block';
  if (e?.currentTarget) e.currentTarget.classList.add('active');
}

function startAssignedExam(id) {
  if (!id || id === 'undefined' || id === 'null') {
    alert('This exam does not have a valid exam ID.');
    return;
  }
  sessionStorage.setItem('requestedExamId', id);
  window.location.href = `index.html?startExam=${encodeURIComponent(id)}`;
}

function confirmStudentLogout() {
  sessionStorage.clear();
  window.location.replace('index.html');
}

function examName(item) {
  return item.examTitle || item.exam?.title || `Exam #${item.examId ?? item.exam?.id ?? '—'}`;
}

function examId(item) {
  return item.examId ?? item.exam?.id;
}

async function safeJson(res) {
  const t = await res.text();
  try {
    return t ? JSON.parse(t) : {};
  } catch {
    return {};
  }
}

function escapeHtml(v) {
  return String(v ?? '').replace(/[&<>'"]/g, c => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    "'": '&#39;',
    '"': '&quot;'
  }[c]));
}