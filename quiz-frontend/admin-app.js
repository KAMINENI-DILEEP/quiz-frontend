const API = "https://quiz-backend-hrjv.onrender.com/api";
let adminJwtToken = sessionStorage.getItem('adminToken') || null;
let adminRecordsCache = [];

document.addEventListener('DOMContentLoaded', async () => {
  if (window.lucide) lucide.createIcons();
  // Never trust a generic student token for this page.
  if (!adminJwtToken || sessionStorage.getItem('role') !== 'ADMIN') {
    clearAdminSession();
    showLoginView();
    return;
  }
  await verifyAdminSession();
});

function clearAdminSession() {
  sessionStorage.removeItem('adminToken');
  if (sessionStorage.getItem('role') === 'ADMIN') {
    sessionStorage.removeItem('token'); sessionStorage.removeItem('role'); sessionStorage.removeItem('name'); sessionStorage.removeItem('email');
  }
  adminJwtToken = null;
}
function showLoginView() {
  document.getElementById('vAdminLogin').style.display = 'flex';
  document.getElementById('vAdminDash').style.display = 'none';
}
function showDashboardView() {
  document.getElementById('vAdminLogin').style.display = 'none';
  document.getElementById('vAdminDash').style.display = 'flex';
  document.getElementById('adminEmailDisplay').textContent = sessionStorage.getItem('email') || 'Administrator';
  if (window.lucide) lucide.createIcons();
}
async function verifyAdminSession() {
  try {
    const res = await fetch(`${API}/admin/results`, { headers: { Authorization: `Bearer ${adminJwtToken}` } });
    if (res.status === 401 || res.status === 403) throw new Error('Admin session expired. Please sign in again.');
    if (!res.ok) throw new Error('Unable to verify administrator access.');
    adminRecordsCache = await res.json();
    showDashboardView();
    updateAdminOverview(adminRecordsCache);
  } catch (err) {
    clearAdminSession(); showLoginView(); showError(err.message);
  }
}
async function executeAdminAuth(e) {
  e.preventDefault();
  const email = document.getElementById('adminEmail').value.trim();
  const password = document.getElementById('adminPassword').value;
  try {
    const res = await fetch(`${API}/login`, { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({email,password}) });
    const data = await safeJson(res);
    if (!res.ok) throw new Error(data.message || 'Invalid credentials.');
    if (data.role !== 'ADMIN') throw new Error('Access denied. This account is not an administrator.');
    adminJwtToken = data.token;
    sessionStorage.setItem('adminToken', data.token);
    sessionStorage.setItem('token', data.token);
    sessionStorage.setItem('role', 'ADMIN');
    sessionStorage.setItem('email', data.email || email);
    sessionStorage.setItem('name', data.name || 'Administrator');
    await verifyAdminSession();
  } catch (err) { clearAdminSession(); showLoginView(); showError(err.message); }
}
async function safeJson(res){ const t=await res.text(); try{return t?JSON.parse(t):{};}catch{return{};} }
function showError(message){ const el=document.getElementById('errBlock'); if(!el)return; el.textContent=message; el.style.display='block'; }
function updateAdminOverview(records){
  const rows=Array.isArray(records)?records:[];
  const students=new Set(rows.map(r=>r.user?.id || r.userId || r.studentId || r.studentName || r.name).filter(Boolean));
  const exams=new Set(rows.map(r=>r.exam?.id || r.examId).filter(v=>v!==undefined&&v!==null));
  const scores=rows.map(r=>Number(r.score)).filter(Number.isFinite);
  document.getElementById('adminStatUsers').textContent=students.size || 0;
  document.getElementById('adminStatExams').textContent=exams.size || 0;
  document.getElementById('adminStatAvg').textContent=`${(scores.length?scores.reduce((a,b)=>a+b,0)/scores.length:0).toFixed(1)}%`;
  populateExamFilter(rows);
}
function populateExamFilter(records){
  const select=document.getElementById('adminSortExam'); if(!select)return;
  const current=select.value; const exams=new Map();
  records.forEach(r=>{const id=r.exam?.id ?? r.examId; if(id!=null) exams.set(String(id), r.examTitle || r.exam?.title || `Exam #${id}`);});
  select.innerHTML='<option value="ALL">All exams</option>'+[...exams].map(([id,title])=>`<option value="${escapeHtml(id)}">${escapeHtml(title)}</option>`).join('');
  if([...select.options].some(o=>o.value===current)) select.value=current;
}
async function fetchAdminResultsWithSorting(){
  const body=document.getElementById('admin-results-table-body'); if(!body)return;
  body.innerHTML='<tr><td colspan="4">Loading records…</td></tr>';
  try{
    const res=await fetch(`${API}/admin/results`,{headers:{Authorization:`Bearer ${adminJwtToken}`}});
    if(res.status===401||res.status===403){clearAdminSession();showLoginView();throw new Error('Admin session expired.');}
    if(!res.ok) throw new Error('Failed to load student records.');
    adminRecordsCache=await res.json(); updateAdminOverview(adminRecordsCache); renderAdminResults();
  }catch(err){body.innerHTML=`<tr><td colspan="4" class="error-cell">${escapeHtml(err.message)}</td></tr>`;}
}
function renderAdminResults(){
  let records=[...(Array.isArray(adminRecordsCache)?adminRecordsCache:[])];
  const gender=document.getElementById('adminFilterGender').value, exam=document.getElementById('adminSortExam').value, order=document.getElementById('adminSortOrder').value;
  if(gender!=='ALL') records=records.filter(r=>String(r.gender||r.user?.gender||'').toLowerCase()===gender.toLowerCase());
  if(exam!=='ALL') records=records.filter(r=>String(r.examId??r.exam?.id)===exam);
  records.sort((a,b)=>order==='high-to-low'?Number(b.score||0)-Number(a.score||0):Number(a.score||0)-Number(b.score||0));
  const body=document.getElementById('admin-results-table-body');
  if(!records.length){body.innerHTML='<tr><td colspan="4">No matching records found.</td></tr>';return;}
  body.innerHTML=records.map(r=>{const score=Number(r.score||0);return `<tr><td><strong>${escapeHtml(r.studentName||r.name||r.user?.name||'Unknown Student')}</strong></td><td>${escapeHtml(r.gender||r.user?.gender||'N/A')}</td><td>${escapeHtml(r.examTitle||r.exam?.title||`Exam #${r.examId??r.exam?.id??'—'}`)}</td><td><span class="score-chip">${score.toFixed(1)}%</span></td></tr>`;}).join('');
}
function switchAdminTab(name,e){
  if(e)e.preventDefault(); document.querySelectorAll('.dash-tab-content').forEach(x=>x.style.display='none'); document.querySelectorAll('.menu-item').forEach(x=>x.classList.remove('active'));
  const tab=document.getElementById(`tab-${name}`); if(tab)tab.style.display='block'; if(e?.currentTarget)e.currentTarget.classList.add('active'); if(name==='analytics')fetchAdminResultsWithSorting();
}
function confirmAdminLogout(){ clearAdminSession(); sessionStorage.clear(); window.location.replace('admin.html'); }
function togglePasswordDisplay(id,e){const input=document.getElementById(id); if(!input)return; input.type=input.type==='password'?'text':'password'; const icon=e?.currentTarget?.querySelector('i'); if(icon)icon.setAttribute('data-lucide',input.type==='password'?'eye':'eye-off'); if(window.lucide)lucide.createIcons();}
function escapeHtml(v){return String(v??'').replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));}
