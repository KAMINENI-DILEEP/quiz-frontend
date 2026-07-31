const API = "https://quiz-backend-hrjv.onrender.com/api";
let adminJwtToken = localStorage.getItem("adminToken") || null;
let adminRecordsCache = [];
let adminExamsCache = [];
let adminUsersCache = [];
let questionCounter = 0;
let adminAutoRefreshTimer = null;
function startAdminAutoRefresh(){
  if(adminAutoRefreshTimer) clearInterval(adminAutoRefreshTimer);
  adminAutoRefreshTimer=setInterval(()=>{
    if(document.visibilityState==="visible" && adminJwtToken) refreshAdminData(true);
  },30000);
}


document.addEventListener("DOMContentLoaded", async () => {
  refreshIcons();
  if (!adminJwtToken || String(localStorage.getItem("role") || "").toUpperCase() !== "ADMIN") {
    clearAdminSession();
    showLoginView();
    return;
  }
  showDashboardView();
  hydrateAdminProfile();
  await refreshAdminData();
  startAdminAutoRefresh();
});

function refreshIcons(){ if(window.lucide) lucide.createIcons(); }
function clearAdminSession(){
  localStorage.removeItem("adminToken");
  if(String(localStorage.getItem("role")||"").toUpperCase()==="ADMIN"){
    ["token","role","name","email"].forEach(k=>localStorage.removeItem(k));
  }
  adminJwtToken=null;
}
function showLoginView(){
  document.getElementById("vAdminLogin").style.display="flex";
  document.getElementById("vAdminDash").style.display="none";
}
function showDashboardView(){
  document.getElementById("vAdminLogin").style.display="none";
  document.getElementById("vAdminDash").style.display="flex";
  const name=localStorage.getItem("name")||"Administrator";
  const email=localStorage.getItem("email")||"Administrator";
  document.getElementById("adminEmailDisplay").textContent=email;
  const av=document.getElementById("adminAvatar"); if(av) av.textContent=(name||email).trim().charAt(0).toUpperCase()||"A";
  refreshIcons();
}
function hydrateAdminProfile(){
  const name=localStorage.getItem("name")||"Administrator";
  const email=localStorage.getItem("email")||"";
  const n=document.getElementById("profAdminName"), m=document.getElementById("profAdminEmail");
  if(n)n.value=name; if(m)m.value=email;
}
function showNotice(message,type="info"){
  const el=document.getElementById("adminNotice"); if(!el)return;
  el.className=`admin-notice ${type}`; el.textContent=message; el.style.display="block";
  clearTimeout(showNotice._t); showNotice._t=setTimeout(()=>el.style.display="none",5500);
}
function showError(message){ showNotice(message,"error"); const el=document.getElementById("errBlock"); if(el){el.textContent=message;el.style.display="block";} }
async function safeJson(res){const t=await res.text();try{return t?JSON.parse(t):{};}catch{return{};}}
function authHeaders(json=false){const h={Authorization:`Bearer ${adminJwtToken}`};if(json)h["Content-Type"]="application/json";return h;}

async function executeAdminAuth(e){
  e.preventDefault();
  const email=document.getElementById("adminEmail").value.trim();
  const password=document.getElementById("adminPassword").value;
  try{
    const res=await fetch(`${API}/login`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({email,password})});
    const data=await safeJson(res);
    if(!res.ok)throw new Error(data.message||"Invalid credentials.");
    if(String(data.role||"").toUpperCase()!=="ADMIN")throw new Error("Access denied. This account is not an administrator.");
    if(!data.token)throw new Error("Server did not return an admin token.");
    adminJwtToken=data.token;
    localStorage.setItem("adminToken",data.token);localStorage.setItem("token",data.token);localStorage.setItem("role","ADMIN");
    localStorage.setItem("email",data.email||email);localStorage.setItem("name",data.name||"Administrator");
    const err=document.getElementById("errBlock");if(err)err.style.display="none";
    showDashboardView();hydrateAdminProfile();await refreshAdminData();startAdminAutoRefresh();
  }catch(err){clearAdminSession();showLoginView();showError(err.message);}
}

async function refreshAdminData(silent=false){
  await Promise.allSettled([fetchAdminResults(silent),loadAdminExams(silent),loadAdminUsers(silent)]);
  updateAdminOverview(adminRecordsCache,adminExamsCache);
  renderRecentActivity();
}
async function fetchAdminResults(silent=false){
  try{
    const res=await fetch(`${API}/admin/results`,{headers:authHeaders()});
    if(res.status===401){clearAdminSession();showLoginView();throw new Error("Admin session expired. Please sign in again.");}
    if(res.status===403)throw new Error("Backend denied access to admin results.");
    if(!res.ok)throw new Error(`Unable to load results (${res.status}).`);
    const data=await res.json();adminRecordsCache=Array.isArray(data)?data:[];populateExamFilter(adminRecordsCache);renderAdminResults();
  }catch(err){if(!silent)showError(err.message);}
}
async function fetchAdminResultsWithSorting(){await fetchAdminResults();}

async function loadAdminExams(silent=false){
  const body=document.getElementById("managementExamsTableBody");
  if(body)body.innerHTML='<tr><td colspan="4">Loading exams…</td></tr>';
  try{
    const res=await fetch(`${API}/admin/exams`,{headers:authHeaders()});
    if(res.status===401){clearAdminSession();showLoginView();return;}
    const data=await safeJson(res);
    if(!res.ok)throw new Error(data.message||`Unable to load exams (${res.status}).`);
    adminExamsCache=Array.isArray(data)?data:[];
    renderAdminExams();updateAdminOverview(adminRecordsCache,adminExamsCache);
  }catch(err){if(!silent)showError(err.message);}
}
function deriveExamsFromResults(records){
  const map=new Map();
  (records||[]).forEach(r=>{const id=r.exam?.id??r.examId;if(id!=null&&!map.has(String(id)))map.set(String(id),{id,title:r.examTitle||r.exam?.title||`Exam #${id}`,durationMinutes:r.exam?.durationMinutes??r.durationMinutes});});
  return [...map.values()];
}
function renderAdminExams(){
  const body=document.getElementById("managementExamsTableBody");if(!body)return;
  if(!adminExamsCache.length){body.innerHTML='<tr><td colspan="4">No examinations found.</td></tr>';return;}
  body.innerHTML=adminExamsCache.map(x=>{
    const id=x.id??x.examId;const title=x.title??x.examTitle??`Exam #${id??"—"}`;const duration=x.durationMinutes??x.duration??"—";
    return `<tr><td>#${escapeHtml(id??"—")}</td><td><strong>${escapeHtml(title)}</strong></td><td>${escapeHtml(duration)}${duration!=="—"?" min":""}</td><td><button class="table-danger-btn" onclick="deleteAdminExam('${escapeJs(id)}','${escapeJs(title)}')"><i data-lucide="trash-2"></i> Delete</button></td></tr>`;
  }).join("");refreshIcons();
}

function openCreateExamPanel(){
  const p=document.getElementById("createExamPanel");if(p)p.style.display="block";
  if(!document.querySelector("#dynamicQuestionsContainer .admin-question-card"))appendQuestionTemplate("MCQ");
  p?.scrollIntoView({behavior:"smooth",block:"start"});refreshIcons();
}
function closeCreateExamPanel(){const p=document.getElementById("createExamPanel");if(p)p.style.display="none";}
function appendQuestionTemplate(type="MCQ"){
  const c=document.getElementById("dynamicQuestionsContainer");if(!c)return;
  const card=document.createElement("div");card.className="admin-question-card";card.dataset.type=type;
  if(type==="TF"){
    card.innerHTML=`<div class="question-card-head"><strong class="question-number-label">Question</strong><span class="question-type-badge">True / False</span><button type="button" onclick="removeQuestionCard(this)" class="question-remove-btn"><i data-lucide="trash-2"></i></button></div>
      <div class="form-group"><label>Question</label><textarea class="q-text" required placeholder="Type the True / False statement here"></textarea></div>
      <input class="q-a" type="hidden" value="True"><input class="q-b" type="hidden" value="False">
      <div class="form-group"><label>Correct Answer</label><select class="q-answer" required><option value="">Select correct answer</option><option value="A">True</option><option value="B">False</option></select></div>`;
  }else{
    card.innerHTML=`<div class="question-card-head"><strong class="question-number-label">Question</strong><span class="question-type-badge">Multiple Choice</span><button type="button" onclick="removeQuestionCard(this)" class="question-remove-btn"><i data-lucide="trash-2"></i></button></div>
      <div class="form-group"><label>Question</label><textarea class="q-text" required placeholder="Type the question here"></textarea></div>
      <div class="admin-options-grid">
        <div class="form-group"><label>Option A</label><input class="q-a" required placeholder="Answer choice A"></div>
        <div class="form-group"><label>Option B</label><input class="q-b" required placeholder="Answer choice B"></div>
        <div class="form-group"><label>Option C</label><input class="q-c" required placeholder="Answer choice C"></div>
        <div class="form-group"><label>Option D</label><input class="q-d" required placeholder="Answer choice D"></div>
      </div>
      <div class="form-group"><label>Correct Answer</label><select class="q-answer" required><option value="">Select correct answer</option><option value="A">Option A</option><option value="B">Option B</option><option value="C">Option C</option><option value="D">Option D</option></select></div>`;
  }
  c.appendChild(card);renumberQuestions();refreshIcons();
}
function removeQuestionCard(button){button.closest(".admin-question-card")?.remove();renumberQuestions();}
function renumberQuestions(){
  [...document.querySelectorAll("#dynamicQuestionsContainer .admin-question-card")].forEach((card,index)=>{
    const label=card.querySelector(".question-number-label");if(label)label.textContent=`Question ${index+1}`;
  });
}
function collectQuestions(){
  return [...document.querySelectorAll("#dynamicQuestionsContainer .admin-question-card")].map(card=>({
    questionText:card.querySelector(".q-text")?.value.trim(),
    optionA:card.querySelector(".q-a")?.value.trim(),
    optionB:card.querySelector(".q-b")?.value.trim(),
    optionC:card.querySelector(".q-c")?.value.trim()||null,
    optionD:card.querySelector(".q-d")?.value.trim()||null,
    correctAnswer:card.querySelector(".q-answer")?.value
  }));
}
async function createAdminExam(e){
  e.preventDefault();
  const title=document.getElementById("examTitleInput").value.trim();
  const durationMinutes=Number(document.getElementById("examDurationInput").value);
  const questions=collectQuestions();
  if(!questions.length){showError("Add at least one question.");return;}
  const payload={title,durationMinutes,questions};
  const candidates=["/admin/exams","/admin/exams/create","/admin/create-exam"];
  let responseData={}, lastStatus=0;
  for(const path of candidates){
    const res=await fetch(`${API}${path}`,{method:"POST",headers:authHeaders(true),body:JSON.stringify(payload)});lastStatus=res.status;responseData=await safeJson(res);
    if(res.ok){
      showNotice(responseData.message||"Exam created successfully.","success");e.target.reset();document.getElementById("dynamicQuestionsContainer").innerHTML="";closeCreateExamPanel();await loadAdminExams();return;
    }
    if(res.status!==404&&res.status!==405){showError(responseData.message||`Exam creation failed (HTTP ${res.status}).`);return;}
  }
  showError(`Your backend does not expose an exam creation endpoint (last HTTP ${lastStatus||"error"}).`);
}
async function deleteAdminExam(id,title){
  if(!confirm(`Delete "${title}"? This action cannot be undone.`))return;
  const candidates=[`/admin/exams/${encodeURIComponent(id)}`,`/admin/exam/${encodeURIComponent(id)}`];
  for(const path of candidates){
    const res=await fetch(`${API}${path}`,{method:"DELETE",headers:authHeaders()});const data=await safeJson(res);
    if(res.ok){showNotice(data.message||"Exam deleted successfully.","success");await loadAdminExams();return;}
    if(res.status!==404&&res.status!==405){showError(data.message||`Delete failed (HTTP ${res.status}).`);return;}
  }
  showError("Your backend does not expose a supported exam delete endpoint.");
}

function updateAdminOverview(records,exams){
  const rows=Array.isArray(records)?records:[];
  const students=new Set(rows.map(r=>r.user?.id??r.userId??r.studentId??r.studentEmail??r.user?.email??r.studentName??r.name).filter(Boolean));
  const examIds=new Set(rows.map(r=>r.exam?.id??r.examId).filter(v=>v!=null));
  const scores=rows.map(r=>Number(r.score)).filter(Number.isFinite);
  setText("adminStatUsers",students.size);
  setText("adminStatExams",(Array.isArray(exams)&&exams.length)?exams.length:examIds.size);
  setText("adminStatSubmissions",rows.filter(r=>String(r.status||"COMPLETED").toUpperCase()==="COMPLETED").length);
  setText("adminStatAvg",`${(scores.length?scores.reduce((a,b)=>a+b,0)/scores.length:0).toFixed(1)}%`);
  populateExamFilter(rows);
}
function populateExamFilter(records){
  const select=document.getElementById("adminSortExam");if(!select)return;const current=select.value,exams=new Map();
  (records||[]).forEach(r=>{const id=r.exam?.id??r.examId;if(id!=null)exams.set(String(id),r.examTitle||r.exam?.title||`Exam #${id}`);});
  select.innerHTML='<option value="ALL">All exams</option>'+[...exams].map(([id,t])=>`<option value="${escapeHtml(id)}">${escapeHtml(t)}</option>`).join("");
  if([...select.options].some(o=>o.value===current))select.value=current;
}
function handleGlobalResultFilter(){
  const value=document.getElementById("globalResultFilter")?.value;
  const range=document.getElementById("globalDateRange");
  if(range)range.style.display=value==="DATE_RANGE"?"flex":"none";
  renderAdminResults();
}
function dateInRange(value,from,to){
  if(!value)return false;const d=new Date(value);if(Number.isNaN(d.getTime()))return false;
  if(from && d<new Date(from+"T00:00:00"))return false;
  if(to && d>new Date(to+"T23:59:59"))return false;
  return true;
}
function isThisMonth(value,offset=0){
  if(!value)return false;const d=new Date(value),now=new Date();
  const target=new Date(now.getFullYear(),now.getMonth()+offset,1);
  return d.getFullYear()===target.getFullYear()&&d.getMonth()===target.getMonth();
}
function renderAdminResults(){
  let records=[...(Array.isArray(adminRecordsCache)?adminRecordsCache:[])];
  const filter=document.getElementById("globalResultFilter")?.value||"ALL";
  if(filter==="STUDENT")records=records.filter(r=>String(r.studentRole||"STUDENT")==="STUDENT");
  if(filter==="ADMIN")records=records.filter(r=>String(r.studentRole||"")==="ADMIN");
  if(filter==="SCORE_DESC")records.sort((a,b)=>Number(b.score||0)-Number(a.score||0));
  if(filter==="SCORE_ASC")records.sort((a,b)=>Number(a.score||0)-Number(b.score||0));
  if(filter==="THIS_MONTH")records=records.filter(r=>isThisMonth(r.completedAt,0));
  if(filter==="LAST_MONTH")records=records.filter(r=>isThisMonth(r.completedAt,-1));
  if(filter==="DATE_RANGE"){
    const from=document.getElementById("globalDateFrom")?.value,to=document.getElementById("globalDateTo")?.value;
    records=records.filter(r=>dateInRange(r.completedAt,from,to));
  }
  const body=document.getElementById("admin-results-table-body");if(!body)return;
  if(!records.length){body.innerHTML='<tr><td colspan="6">No matching records found.</td></tr>';return;}
  body.innerHTML=records.map(r=>{
    const score=Number(r.score||0),status=String(r.status||"COMPLETED").toUpperCase(),time=formatTime(r.timeSpentSeconds);
    return `<tr><td><strong>${escapeHtml(r.studentName||"Unknown Student")}</strong><small class="table-subtext">${escapeHtml(r.studentEmail||"")}</small></td>
      <td>${escapeHtml(r.studentRole||"STUDENT")}</td><td>${escapeHtml(r.examTitle||`Exam #${r.examId??"—"}`)}</td>
      <td><span class="status-badge ${status==="COMPLETED"?"completed":"pending"}">${escapeHtml(status)}</span></td>
      <td><div class="score-cell"><strong>${score.toFixed(1)}%</strong><div class="mini-progress"><span style="width:${Math.max(0,Math.min(100,score))}%"></span></div></div></td><td>${escapeHtml(time)}</td></tr>`;
  }).join("");
}
function renderRecentActivity(){
  const el=document.getElementById("adminRecentActivity");if(!el)return;
  const rows=[...(adminRecordsCache||[])].slice(-5).reverse();
  if(!rows.length){el.innerHTML='<p class="panel-note">No submissions yet.</p>';return;}
  el.innerHTML=rows.map(r=>`<div class="admin-recent-row"><div class="activity-icon"><i data-lucide="check"></i></div><div><strong>${escapeHtml(r.studentName||r.user?.name||"Student")}</strong><small>${escapeHtml(r.examTitle||r.exam?.title||"Exam")}</small></div><span>${Number(r.score||0).toFixed(1)}%</span></div>`).join("");refreshIcons();
}
function formatTime(v){if(v==null||v==="")return"—";const n=Number(v);if(!Number.isFinite(n))return String(v);const m=Math.floor(n/60),s=Math.floor(n%60);return`${m}m ${s}s`;}

async function loadAdminUsers(silent=false){
  try{
    const res=await fetch(`${API}/admin/users`,{headers:authHeaders()});
    const data=await safeJson(res);
    if(!res.ok)throw new Error(data.message||`Unable to load registered accounts (${res.status}).`);
    adminUsersCache=Array.isArray(data)?data:[];renderAdminUsers();
  }catch(err){if(!silent)showError(err.message);}
}
function handleAccountFilter(){
  const value=document.getElementById("accountFilter")?.value;
  const range=document.getElementById("accountDateRange");
  if(range)range.style.display=value==="DATE_RANGE"?"flex":"none";
  renderAdminUsers();
}
function renderAdminUsers(){
  let users=[...(adminUsersCache||[])];
  const filter=document.getElementById("accountFilter")?.value||"ALL";
  if(filter==="STUDENT"||filter==="ADMIN")users=users.filter(u=>String(u.role)===filter);
  if(filter==="THIS_MONTH")users=users.filter(u=>isThisMonth(u.createdAt,0));
  if(filter==="LAST_MONTH")users=users.filter(u=>isThisMonth(u.createdAt,-1));
  if(filter==="NEWEST")users.sort((a,b)=>new Date(b.createdAt)-new Date(a.createdAt));
  if(filter==="OLDEST")users.sort((a,b)=>new Date(a.createdAt)-new Date(b.createdAt));
  if(filter==="DATE_RANGE"){
    const from=document.getElementById("accountDateFrom")?.value,to=document.getElementById("accountDateTo")?.value;
    users=users.filter(u=>dateInRange(u.createdAt,from,to));
  }
  const body=document.getElementById("admin-users-table-body");if(!body)return;
  if(!users.length){body.innerHTML='<tr><td colspan="6">No matching accounts found.</td></tr>';return;}
  body.innerHTML=users.map(u=>`<tr>
    <td><strong>${escapeHtml(u.name)}</strong></td><td>${escapeHtml(u.email)}</td>
    <td><span class="role-pill ${String(u.role).toLowerCase()}">${escapeHtml(u.role)}</span></td>
    <td>${escapeHtml(formatDateTime(u.createdAt))}</td>
    <td><span class="secured-password"><i data-lucide="shield-check"></i> Secured</span></td>
    <td><button class="mini-icon-btn labeled" onclick="adminResetUserPassword('${escapeJs(u.userId)}','${escapeJs(u.email)}')"><i data-lucide="key-round"></i> Reset</button></td>
  </tr>`).join("");refreshIcons();
}
function formatDateTime(v){if(!v)return"—";const d=new Date(v);return Number.isNaN(d.getTime())?String(v):d.toLocaleString();}
async function adminResetUserPassword(id,email){
  const password=prompt(`Set a new password for ${email} (minimum 6 characters):`);
  if(password===null)return;if(password.length<6){showError("Password must be at least 6 characters.");return;}
  const res=await fetch(`${API}/admin/users/${encodeURIComponent(id)}/reset-password`,{method:"PUT",headers:authHeaders(true),body:JSON.stringify({newPassword:password})});
  const data=await safeJson(res);if(!res.ok){showError(data.message||"Password reset failed.");return;}
  showNotice(data.message||"Password reset successfully.","success");
}

async function createAdministrator(e){
  e.preventDefault();
  const payload={name:document.getElementById("newAdminName").value.trim(),email:document.getElementById("newAdminEmail").value.trim(),password:document.getElementById("newAdminPassword").value};
  const res=await fetch(`${API}/admin/create-admin`,{method:"POST",headers:authHeaders(true),body:JSON.stringify(payload)});
  const data=await safeJson(res);
  if(!res.ok){showError(data.message||`Admin creation failed (${res.status}).`);return;}
  showNotice(data.message||"Administrator created successfully.","success");e.target.reset();await loadAdminUsers(true);
}
async function updateAdminGeneralMetadata(e){
  e.preventDefault();
  const name=document.getElementById("profAdminName").value.trim(),email=document.getElementById("profAdminEmail").value.trim();
  try{
    const res=await fetch(`${API}/profile/update-general`,{method:"PUT",headers:authHeaders(true),body:JSON.stringify({name,email})});const data=await safeJson(res);
    if(!res.ok)throw new Error(data.message||"Profile update failed.");
    localStorage.setItem("name",name);localStorage.setItem("email",email);showDashboardView();showNotice("Admin profile updated.","success");
  }catch(err){showError(err.message);}
}
async function updateAdminPasswordSecurityMetric(e){
  e.preventDefault();
  const currentPassword=document.getElementById("profAdminCurrentPassword").value,newPassword=document.getElementById("profAdminNewPassword").value;
  try{
    const res=await fetch(`${API}/profile/update-password`,{method:"PUT",headers:authHeaders(true),body:JSON.stringify({currentPassword,newPassword})});const data=await safeJson(res);
    if(!res.ok)throw new Error(data.message||"Password update failed.");
    e.target.reset();showNotice("Password updated successfully.","success");
  }catch(err){showError(err.message);}
}

function switchAdminTab(name,e){
  if(e)e.preventDefault();
  document.querySelectorAll(".dash-tab-content").forEach(x=>x.style.display="none");
  document.querySelectorAll(".menu-item").forEach(x=>x.classList.remove("active"));
  const tab=document.getElementById(`tab-${name}`);if(tab)tab.style.display="block";
  const link=e?.currentTarget||[...document.querySelectorAll(".menu-item")].find(a=>a.getAttribute("onclick")?.includes(`'${name}'`));if(link)link.classList.add("active");
  if(name==="analytics")renderAdminResults();if(name==="exams")renderAdminExams();if(name==="users")renderAdminUsers();if(name==="profile")hydrateAdminProfile();refreshIcons();
}
function openAdminLogoutModal(){const o=document.getElementById("adminLogoutModalOverlay");if(o)o.style.display="flex";refreshIcons();}
function closeAdminLogoutModal(){const o=document.getElementById("adminLogoutModalOverlay");if(o)o.style.display="none";}
function confirmAdminLogout(){clearAdminSession();["token","role","name","email"].forEach(k=>localStorage.removeItem(k));window.location.replace("admin.html");}
function togglePasswordDisplay(id,e){const input=document.getElementById(id);if(!input)return;input.type=input.type==="password"?"text":"password";const icon=e?.currentTarget?.querySelector("i");if(icon)icon.setAttribute("data-lucide",input.type==="password"?"eye":"eye-off");refreshIcons();}
function setText(id,v){const el=document.getElementById(id);if(el)el.textContent=v;}
function escapeHtml(v){return String(v??"").replace(/[&<>'"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;","'":"&#39;",'"':"&quot;"}[c]));}
function escapeJs(v){return String(v??"").replace(/\\/g,"\\\\").replace(/'/g,"\\'").replace(/\r/g,"\\r").replace(/\n/g,"\\n");}
