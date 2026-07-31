const API = "https://quiz-backend-hrjv.onrender.com/api";
let adminJwtToken = localStorage.getItem("adminToken") || null;
let adminRecordsCache = [];
let adminExamsCache = [];
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
  await Promise.allSettled([fetchAdminResults(silent),loadAdminExams(silent)]);
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
  const candidates=["/admin/exams","/admin/exams/all","/admin/manage-exams"];
  let lastStatus=null;
  for(const path of candidates){
    try{
      const res=await fetch(`${API}${path}`,{headers:authHeaders()});lastStatus=res.status;
      if(res.status===401){clearAdminSession();showLoginView();return;}
      if(res.ok){
        const data=await res.json();adminExamsCache=Array.isArray(data)?data:(Array.isArray(data.exams)?data.exams:[]);
        renderAdminExams();updateAdminOverview(adminRecordsCache,adminExamsCache);return;
      }
      if(res.status===403){if(!silent)showError("Backend denied access to admin exams.");return;} if(res.status!==404&&res.status!==405)break;
    }catch(_){}
  }
  adminExamsCache=deriveExamsFromResults(adminRecordsCache);
  renderAdminExams();
  if(!adminExamsCache.length && body) body.innerHTML=`<tr><td colspan="4">Exam list endpoint is not available${lastStatus?` (HTTP ${lastStatus})`:""}.</td></tr>`;
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
  if(!document.querySelector("#dynamicQuestionsContainer .admin-question-card"))appendQuestionTemplate();
  p?.scrollIntoView({behavior:"smooth",block:"start"});refreshIcons();
}
function closeCreateExamPanel(){const p=document.getElementById("createExamPanel");if(p)p.style.display="none";}
function appendQuestionTemplate(){
  const c=document.getElementById("dynamicQuestionsContainer");if(!c)return;
  const card=document.createElement("div");card.className="admin-question-card";
  card.innerHTML=`<div class="question-card-head"><strong class="question-number-label">Question</strong><button type="button" onclick="removeQuestionCard(this)" class="question-remove-btn" title="Remove question"><i data-lucide="trash-2"></i></button></div>
    <div class="form-group"><label>Question</label><textarea class="q-text" required placeholder="Type the question here"></textarea></div>
    <div class="admin-options-grid">
      <div class="form-group"><label>Option A</label><input class="q-a" required placeholder="Answer choice A"></div>
      <div class="form-group"><label>Option B</label><input class="q-b" required placeholder="Answer choice B"></div>
      <div class="form-group"><label>Option C</label><input class="q-c" required placeholder="Answer choice C"></div>
      <div class="form-group"><label>Option D</label><input class="q-d" required placeholder="Answer choice D"></div>
    </div>
    <div class="form-group"><label>Correct Answer</label><select class="q-answer" required><option value="">Select correct answer</option><option value="A">Option A</option><option value="B">Option B</option><option value="C">Option C</option><option value="D">Option D</option></select></div>`;
  c.appendChild(card);renumberQuestions();refreshIcons();
}
function removeQuestionCard(button){
  button.closest(".admin-question-card")?.remove();
  renumberQuestions();
}
function renumberQuestions(){
  [...document.querySelectorAll("#dynamicQuestionsContainer .admin-question-card")].forEach((card,index)=>{
    const label=card.querySelector(".question-number-label");
    if(label)label.textContent=`Question ${index+1}`;
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
function renderAdminResults(){
  let records=[...(Array.isArray(adminRecordsCache)?adminRecordsCache:[])];
  const gender=document.getElementById("adminFilterGender")?.value||"ALL",exam=document.getElementById("adminSortExam")?.value||"ALL",order=document.getElementById("adminSortOrder")?.value||"high-to-low";
  if(gender!=="ALL")records=records.filter(r=>String(r.gender||r.user?.gender||"").toLowerCase()===gender.toLowerCase());
  if(exam!=="ALL")records=records.filter(r=>String(r.examId??r.exam?.id)===exam);
  records.sort((a,b)=>order==="high-to-low"?Number(b.score||0)-Number(a.score||0):Number(a.score||0)-Number(b.score||0));
  const body=document.getElementById("admin-results-table-body");if(!body)return;
  if(!records.length){body.innerHTML='<tr><td colspan="6">No matching records found.</td></tr>';return;}
  body.innerHTML=records.map(r=>{
    const score=Number(r.score||0),status=String(r.status||"COMPLETED").toUpperCase(),time=formatTime(r.timeSpentSeconds??r.time_spent_seconds??r.timeConsumed);
    return `<tr><td><strong>${escapeHtml(r.studentName||r.name||r.user?.name||"Unknown Student")}</strong><small class="table-subtext">${escapeHtml(r.studentEmail||r.user?.email||"")}</small></td>
      <td>${escapeHtml(r.gender||r.user?.gender||"N/A")}</td><td>${escapeHtml(r.examTitle||r.exam?.title||`Exam #${r.examId??r.exam?.id??"—"}`)}</td>
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

async function createAdministrator(e){
  e.preventDefault();
  const payload={name:document.getElementById("newAdminName").value.trim(),email:document.getElementById("newAdminEmail").value.trim(),password:document.getElementById("newAdminPassword").value,passwordHash:document.getElementById("newAdminPassword").value,role:"ADMIN"};
  const candidates=["/admin/register","/admin/create-admin","/admin/users"];
  for(const path of candidates){
    const res=await fetch(`${API}${path}`,{method:"POST",headers:authHeaders(true),body:JSON.stringify(payload)});const data=await safeJson(res);
    if(res.ok){showNotice(data.message||"Administrator created successfully.","success");e.target.reset();return;}
    if(res.status!==404&&res.status!==405){showError(data.message||`Admin creation failed (HTTP ${res.status}).`);return;}
  }
  showError("Your backend does not expose an admin-creation endpoint yet.");
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
  if(name==="analytics")renderAdminResults();if(name==="exams")renderAdminExams();if(name==="profile")hydrateAdminProfile();refreshIcons();
}
function openAdminLogoutModal(){const o=document.getElementById("adminLogoutModalOverlay");if(o)o.style.display="flex";refreshIcons();}
function closeAdminLogoutModal(){const o=document.getElementById("adminLogoutModalOverlay");if(o)o.style.display="none";}
function confirmAdminLogout(){clearAdminSession();["token","role","name","email"].forEach(k=>localStorage.removeItem(k));window.location.replace("admin.html");}
function togglePasswordDisplay(id,e){const input=document.getElementById(id);if(!input)return;input.type=input.type==="password"?"text":"password";const icon=e?.currentTarget?.querySelector("i");if(icon)icon.setAttribute("data-lucide",input.type==="password"?"eye":"eye-off");refreshIcons();}
function setText(id,v){const el=document.getElementById(id);if(el)el.textContent=v;}
function escapeHtml(v){return String(v??"").replace(/[&<>'"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;","'":"&#39;",'"':"&quot;"}[c]));}
function escapeJs(v){return String(v??"").replace(/\\/g,"\\\\").replace(/'/g,"\\'").replace(/\r/g,"\\r").replace(/\n/g,"\\n");}
