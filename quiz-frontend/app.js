const API = "https://quiz-backend-hrjv.onrender.com/api";

let jwtToken = localStorage.getItem("token") || null;
let clockInterval = null;
let totalSecondsElapsed = 0;
let activeExamDurationSeconds = 0;

const dataCache = {
    dashboard: null,
    exams: {}
};
window.addEventListener("load", () => {
    const nav = performance.getEntriesByType("navigation");

    if (nav.length && nav[0].type === "reload") {
        sessionStorage.clear();
        window.location.replace("index.html");
    }
});

// ======================================================
// VIEW ROUTING
// ======================================================

function routeTo(viewId) {

    requestAnimationFrame(() => {

        const views = document.querySelectorAll(".view");

        views.forEach(view => {
            view.classList.remove("active");
            view.style.display = "none";
        });

        const target = document.getElementById(viewId);

        if (target) {
            target.style.display = "block";
            target.classList.add("active");
        }

        if (window.lucide) {
            lucide.createIcons();
        }
    });
}


// ======================================================
// INITIALIZATION
// ======================================================

document.addEventListener("DOMContentLoaded", () => {

    // Backend wake-up only.
    // This must NEVER clear the user session.
    fetch(`${API}/ping`, {
        method: "GET"
    }).catch(() => {
        console.log("Backend wake-up request failed.");
    });

    if (window.lucide) {
        lucide.createIcons();
    }

    /*
     * index.html is the login/exam workspace.
     *
     * IMPORTANT:
     * Do NOT automatically clear localStorage here.
     */

    const token = localStorage.getItem("token");
    const role = (
        localStorage.getItem("role") || ""
    ).toUpperCase();

    const params = new URLSearchParams(
        window.location.search
    );

    const requestedExamId =
        params.get("startExam") ||
        localStorage.getItem("requestedExamId");


    /*
     * Student came from student.html after
     * pressing Start Exam.
     */
    if (
        token &&
        role === "STUDENT" &&
        requestedExamId
    ) {

        jwtToken = token;

        localStorage.removeItem(
            "requestedExamId"
        );

        // Remove ?startExam= from address bar
        if (window.history.replaceState) {
            window.history.replaceState(
                {},
                document.title,
                "index.html"
            );
        }

        startExamEngine(
            requestedExamId
        );

        return;
    }


    /*
     * If someone manually opens index.html while
     * already logged in, keep their session.
     *
     * We do NOT logout automatically.
     */
});


// ======================================================
// PASSWORD VISIBILITY
// ======================================================

function togglePasswordDisplay(fieldId, e) {

    const passwordInput =
        document.getElementById(fieldId);

    if (!passwordInput) return;

    const eventObject =
        e || window.event;

    const button =
        eventObject
            ? eventObject.currentTarget
            : null;

    const icon =
        button
            ? button.querySelector("i")
            : null;


    if (passwordInput.type === "password") {

        passwordInput.type = "text";

        if (icon) {
            icon.setAttribute(
                "data-lucide",
                "eye-off"
            );
        }

    } else {

        passwordInput.type = "password";

        if (icon) {
            icon.setAttribute(
                "data-lucide",
                "eye"
            );
        }
    }


    if (window.lucide) {
        lucide.createIcons();
    }
}


// ======================================================
// LOGIN / REGISTER PANEL
// ======================================================

function triggerAuthSlide(isSignUp) {

    const container =
        document.getElementById(
            "swappingContainer"
        );

    if (!container) return;


    if (isSignUp) {

        container.classList.add(
            "right-panel-active",
            "active-signup"
        );

    } else {

        container.classList.remove(
            "right-panel-active",
            "active-signup"
        );
    }
}


// ======================================================
// PASSWORD RESET
// ======================================================

async function confirmPasswordReset(e) {

    if (e) {
        e.preventDefault();
    }

    const emailElement =
        document.getElementById(
            "recoveryEmail"
        );

    const passwordElement =
        document.getElementById(
            "newAccountPassword"
        );

    if (!emailElement || !passwordElement) {
        return;
    }

    const email =
        emailElement.value.trim();

    const newPassword =
        passwordElement.value;


    if (!email || !newPassword) {

        alert(
            "Please provide your email and new password."
        );

        return;
    }


    try {

        const res = await fetch(
            `${API}/reset-password`,
            {
                method: "POST",

                headers: {
                    "Content-Type":
                        "application/json"
                },

                body: JSON.stringify({
                    email,
                    newPassword
                })
            }
        );


        const data =
            await safeJsonResponse(res);


        if (!res.ok) {

            throw new Error(
                data.message ||
                "Password reset failed."
            );
        }


        alert(
            "Password updated successfully. Please sign in with your new credentials."
        );

        routeTo("vAuthSpace");


    } catch (err) {

        alert(err.message);
    }
}


async function syncPublicRegistrationStatus() {
  try {
    const r = await fetch(`${API}/registration-status`);
    const d = await safeJsonResponse(r);
    const form = document.querySelector(".sign-up-form-container form");
    const btn = form?.querySelector('button[type="submit"]');
    if (btn) { btn.disabled = d.registrationEnabled === false; btn.textContent = d.registrationEnabled === false ? "Registration Temporarily Closed" : "Register Profile"; }
    if (form) form.classList.toggle("registration-disabled", d.registrationEnabled === false);
  } catch (_) {}
}
document.addEventListener("DOMContentLoaded", syncPublicRegistrationStatus);

// ======================================================
// STUDENT REGISTRATION
// ======================================================

async function appRegister(e) {

    if (e) {
        e.preventDefault();
    }


    const name =
        document.getElementById(
            "regName"
        )?.value.trim();

    const email =
        document.getElementById(
            "regEmail"
        )?.value.trim();

    const password =
        document.getElementById(
            "regPassword"
        )?.value;

    const gender =
        document.getElementById(
            "regGender"
        )?.value;


    if (!name || !email || !password) {

        alert(
            "Please complete all required fields."
        );

        return;
    }


    try {

        const res = await fetch(
            `${API}/register`,
            {
                method: "POST",

                headers: {
                    "Content-Type":
                        "application/json"
                },

                body: JSON.stringify({
                    name,
                    email,
                    password,
                    gender

                    /*
                     * Do NOT send role.
                     *
                     * Backend AuthController now
                     * forces public registrations
                     * to STUDENT.
                     */
                })
            }
        );


        const data =
            await safeJsonResponse(res);


        if (!res.ok) {

            throw new Error(
                data.message ||
                "Registration failed."
            );
        }


        alert(
            "Account registered successfully. Please sign in."
        );

        triggerAuthSlide(false);


    } catch (err) {

        alert(err.message);
    }
}


// ======================================================
// MAIN LOGIN
// ======================================================

async function appLogin(e) {

    if (e) {
        e.preventDefault();
    }


    const emailElement =
        document.getElementById("email");

    const passwordElement =
        document.getElementById("password");

    const errorBlock =
        document.getElementById("errBlock");


    if (!emailElement || !passwordElement) {
        return;
    }


    const email =
        emailElement.value.trim();

    const password =
        passwordElement.value;


    if (errorBlock) {

        errorBlock.innerText = "";
        errorBlock.style.display = "none";
    }


    if (!email || !password) {

        showLoginError(
            "Please enter your email and password."
        );

        return;
    }


    try {

        const res = await fetch(
            `${API}/login`,
            {
                method: "POST",

                headers: {
                    "Content-Type":
                        "application/json"
                },

                body: JSON.stringify({
                    email,
                    password
                })
            }
        );


        const data =
            await safeJsonResponse(res);


        if (!res.ok) {

            throw new Error(
                data.message ||
                "Login verification failed."
            );
        }


        if (!data.token) {

            throw new Error(
                "Server did not return an authentication token."
            );
        }


        const role =
            String(
                data.role || ""
            ).toUpperCase();


        if (
            role !== "STUDENT" &&
            role !== "ADMIN"
        ) {

            throw new Error(
                "Invalid account role returned by server."
            );
        }


        /*
         * Save authentication FIRST.
         *
         * Nothing below this point should clear
         * the session.
         */

        jwtToken = data.token;


        localStorage.setItem(
            "token",
            data.token
        );

        localStorage.setItem(
            "role",
            role
        );

        localStorage.setItem(
            "name",
            data.name ||
            (
                role === "ADMIN"
                    ? "Administrator"
                    : "Student"
            )
        );

        localStorage.setItem(
            "email",
            data.email || email
        );


        // ======================================
        // ADMIN
        // ======================================

        if (role === "ADMIN") {

            localStorage.setItem(
                "adminToken",
                data.token
            );

            /*
             * Remove student-specific state.
             */
            localStorage.removeItem(
                "requestedExamId"
            );


            window.location.replace(
                "admin.html"
            );

            return;
        }


        // ======================================
        // STUDENT
        // ======================================

        /*
         * Student should not carry an old
         * administrator token.
         */
        localStorage.removeItem(
            "adminToken"
        );

        localStorage.removeItem(
            "requestedExamId"
        );


        window.location.replace(
            "student.html"
        );


    } catch (err) {

        console.error(
            "Login error:",
            err
        );

        showLoginError(
            err.message ||
            "Unable to sign in."
        );
    }
}


// ======================================================
// OPTIONAL ADMIN LOGIN
// ======================================================

async function appAdminLogin(e) {

    if (e) {
        e.preventDefault();
    }


    const emailElement =
        document.getElementById(
            "adminEmail"
        );

    const passwordElement =
        document.getElementById(
            "adminPassword"
        );


    if (!emailElement || !passwordElement) {

        alert(
            "Admin login form is unavailable."
        );

        return;
    }


    const email =
        emailElement.value.trim();

    const password =
        passwordElement.value;


    if (!email || !password) {

        alert(
            "Enter administrator email and password."
        );

        return;
    }


    try {

        const res = await fetch(
            `${API}/login`,
            {
                method: "POST",

                headers: {
                    "Content-Type":
                        "application/json"
                },

                body: JSON.stringify({
                    email,
                    password
                })
            }
        );


        const data =
            await safeJsonResponse(res);


        if (!res.ok) {

            throw new Error(
                data.message ||
                "Admin authentication failed."
            );
        }


        const role =
            String(
                data.role || ""
            ).toUpperCase();


        if (role !== "ADMIN") {

            throw new Error(
                "Unauthorized: Administrative privileges required."
            );
        }


        if (!data.token) {

            throw new Error(
                "Authentication token was not returned."
            );
        }


        jwtToken =
            data.token;


        localStorage.setItem(
            "token",
            data.token
        );

        localStorage.setItem(
            "adminToken",
            data.token
        );

        localStorage.setItem(
            "role",
            "ADMIN"
        );

        localStorage.setItem(
            "name",
            data.name ||
            "Administrator"
        );

        localStorage.setItem(
            "email",
            data.email || email
        );


        window.location.replace(
            "admin.html"
        );


    } catch (err) {

        alert(err.message);
    }
}


// ======================================================
// LOGIN ERROR
// ======================================================

function showLoginError(message) {

    const errorBlock =
        document.getElementById(
            "errBlock"
        );


    if (errorBlock) {

        errorBlock.innerText =
            message;

        errorBlock.style.display =
            "block";

    } else {

        alert(message);
    }
}


// ======================================================
// OLD INLINE STUDENT DASHBOARD SUPPORT
// ======================================================

async function showDashboardView() {

    jwtToken =
        localStorage.getItem(
            "token"
        );


    if (!jwtToken) {

        routeTo(
            "vAuthSpace"
        );

        return;
    }


    routeTo(
        "vDash"
    );


    if (dataCache.dashboard) {

        renderDashboardExams(
            dataCache.dashboard
        );
    }


    try {

        const res = await fetch(
            `${API}/student/results`,
            {
                headers: {

                    "Content-Type":
                        "application/json",

                    "Authorization":
                        `Bearer ${jwtToken}`
                }
            }
        );


        /*
         * Do not automatically logout on 403.
         */

        if (res.status === 401) {

            throw new Error(
                "Authentication token rejected."
            );
        }


        if (res.status === 403) {

            throw new Error(
                "Student access was denied by the server."
            );
        }


        if (!res.ok) {

            throw new Error(
                "Dashboard fetch error."
            );
        }


        const list =
            await res.json();


        dataCache.dashboard =
            Array.isArray(list)
                ? list
                : [];


        renderDashboardExams(
            dataCache.dashboard
        );


    } catch (err) {

        console.error(
            "Dashboard error:",
            err
        );
    }
}


// ======================================================
// OLD DASHBOARD EXAM LIST
// ======================================================

function renderDashboardExams(list) {

    const container =
        document.getElementById(
            "examList"
        );


    if (!container) {
        return;
    }


    if (!Array.isArray(list)) {

        container.innerHTML =
            "";

        return;
    }


    let html = "";


    list.forEach(item => {

        const done =
            String(
                item.status || ""
            ).toUpperCase() ===
            "COMPLETED";


        const examId =
            item.examId ??
            item.exam?.id;


        const score =
            Number(
                item.score || 0
            );


        html += `

            <div
                style="
                    padding:1rem;
                    border:1px solid var(--border);
                    margin-bottom:0.5rem;
                    display:flex;
                    justify-content:space-between;
                    align-items:center;
                    background:var(--surface-card);
                    border-radius:8px;
                "
            >

                <div>

                    <strong>
                        Exam Reference Assignment ID:
                        #${escapeHtml(examId ?? "—")}
                    </strong>

                    <br>

                    <small
                        style="
                            color:var(--text-muted);
                        "
                    >

                        Status:
                        ${escapeHtml(
                            item.status ||
                            "PENDING"
                        )}

                        ${
                            done
                                ? ` | Grade: ${score.toFixed(1)}%`
                                : ""
                        }

                    </small>

                </div>


                ${
                    done

                        ? "<strong>Locked</strong>"

                        : `
                            <button
                                class="btn-primary"
                                onclick="startExamEngine('${escapeHtml(examId)}')"
                            >
                                Start Exam
                            </button>
                        `
                }

            </div>
        `;
    });


    container.innerHTML =
        html;
}


// ======================================================
// START EXAM
// ======================================================

async function startExamEngine(id) {

    jwtToken =
        localStorage.getItem(
            "token"
        );


    if (!jwtToken) {

        alert(
            "Please sign in before starting the exam."
        );

        window.location.replace(
            "index.html"
        );

        return;
    }


    if (
        !id ||
        id === "undefined" ||
        id === "null"
    ) {

        alert(
            "Invalid examination ID."
        );

        return;
    }


    try {

        if (dataCache.exams[id]) {

            renderExamQuestions(
                dataCache.exams[id],
                id
            );

            return;
        }


        const res = await fetch(
            `${API}/student/exams/${encodeURIComponent(id)}/start`,
            {
                method: "GET",

                headers: {

                    "Content-Type":
                        "application/json",

                    "Authorization":
                        `Bearer ${jwtToken}`
                }
            }
        );


        const data =
            await safeJsonResponse(res);


        if (res.status === 401) {

            throw new Error(
                "Your authentication token was rejected."
            );
        }


        if (res.status === 403) {

            throw new Error(
                "You do not have permission to start this exam."
            );
        }


        if (!res.ok) {

            throw new Error(
                data.message ||
                "Unable to start exam."
            );
        }


        dataCache.exams[id] =
            data;


        renderExamQuestions(
            data,
            id
        );


    } catch (err) {

        alert(
            err.message
        );

        /*
         * Return to student dashboard,
         * but DO NOT logout.
         */

        window.location.replace(
            "student.html"
        );
    }
}


// ======================================================
// RENDER EXAM
// ======================================================

function renderExamQuestions(
    data,
    id
) {

    if (
        !data ||
        !data.exam ||
        !Array.isArray(data.questions)
    ) {

        alert(
            "Invalid exam information received from server."
        );

        window.location.replace(
            "student.html"
        );

        return;
    }


    const examTitle =
        document.getElementById(
            "examTitle"
        );


    if (examTitle) {

        examTitle.innerText =
            data.exam.title ||
            "Assessment";
    }


    const container =
        document.getElementById(
            "questionsContainer"
        );


    if (!container) {

        alert(
            "Exam workspace could not be loaded."
        );

        return;
    }


    let html = "";


    data.questions.forEach(
        (question, index) => {

            html += `

                <div
                    class="q-card card"
                    data-exam-id="${escapeHtml(id)}"
                >

                    <p
                        style="
                            margin-top:1rem;
                            font-weight:700;
                        "
                    >

                        Q${index + 1}:
                        ${escapeHtml(
                            question.questionText
                        )}

                    </p>


                    ${createExamOption(
                        question.questionId,
                        "A",
                        question.optionA,
                        true
                    )}


                    ${createExamOption(
                        question.questionId,
                        "B",
                        question.optionB
                    )}


                    ${
                        question.optionC
                            ? createExamOption(
                                question.questionId,
                                "C",
                                question.optionC
                            )
                            : ""
                    }


                    ${
                        question.optionD
                            ? createExamOption(
                                question.questionId,
                                "D",
                                question.optionD
                            )
                            : ""
                    }

                </div>
            `;
        }
    );


    container.innerHTML =
        html;


    routeTo(
        "vExam"
    );


    runClock(
        Number(
            data.exam.durationMinutes || 0
        ),
        id
    );
}


// ======================================================
// CREATE OPTION
// ======================================================

function createExamOption(
    questionId,
    value,
    text,
    required = false
) {

    return `

        <label class="option">

            <input
                type="radio"
                name="q_${escapeHtml(questionId)}"
                value="${escapeHtml(value)}"
                ${required ? "required" : ""}
            >

            ${escapeHtml(text)}

        </label>
    `;
}


// ======================================================
// EXAM CLOCK
// ======================================================

function runClock(
    mins,
    examId
) {

    clearInterval(
        clockInterval
    );


    totalSecondsElapsed =
        0;


    activeExamDurationSeconds =
        Math.max(
            0,
            Number(mins) * 60
        );


    const clockEl =
        document.getElementById(
            "clock"
        );


    function updateClock() {

        const remainder =
            Math.max(
                0,
                activeExamDurationSeconds -
                totalSecondsElapsed
            );


        const minutes =
            Math.floor(
                remainder / 60
            )
                .toString()
                .padStart(2, "0");


        const seconds =
            (
                remainder % 60
            )
                .toString()
                .padStart(2, "0");


        if (clockEl) {

            clockEl.innerText =
                `${minutes}:${seconds}`;
        }
    }


    updateClock();


    clockInterval =
        setInterval(
            () => {

                totalSecondsElapsed++;


                const remainder =
                    activeExamDurationSeconds -
                    totalSecondsElapsed;


                if (remainder <= 0) {

                    clearInterval(
                        clockInterval
                    );

                    updateClock();

                    submitExamPayload(
                        null,
                        examId
                    );

                    return;
                }


                updateClock();

            },
            1000
        );
}


// ======================================================
// SUBMIT EXAM
// ======================================================

async function submitExamPayload(
    e,
    autoId = null
) {

    if (e) {
        e.preventDefault();
    }


    clearInterval(
        clockInterval
    );


    jwtToken =
        localStorage.getItem(
            "token"
        );


    if (!jwtToken) {

        alert(
            "Authentication session is unavailable."
        );

        return;
    }


    const qCards =
        document.querySelectorAll(
            ".q-card"
        );


    if (!qCards.length) {
        return;
    }


    const targetExamId =
        autoId ||
        qCards[0].dataset.examId;


    const answers = [];


    qCards.forEach(card => {

        const firstInput =
            card.querySelector(
                'input[type="radio"]'
            );


        if (!firstInput) {
            return;
        }


        const questionId =
            firstInput.name
                .split("_")[1];


        const checked =
            card.querySelector(
                'input[type="radio"]:checked'
            );


        answers.push({

            question_id:
                parseInt(
                    questionId,
                    10
                ),

            selected:
                checked
                    ? checked.value
                    : ""
        });
    });


    try {

        const res = await fetch(
            `${API}/student/exams/${encodeURIComponent(targetExamId)}/submit`,
            {
                method: "POST",

                headers: {

                    "Content-Type":
                        "application/json",

                    "Authorization":
                        `Bearer ${jwtToken}`
                },

                body: JSON.stringify({

                    answers,

                    time_spent_seconds:
                        totalSecondsElapsed
                })
            }
        );


        const data =
            await safeJsonResponse(res);


        if (res.status === 401) {

            throw new Error(
                "Authentication token was rejected."
            );
        }


        if (res.status === 403) {

            throw new Error(
                "Server denied permission to submit this exam."
            );
        }


        if (!res.ok) {

            throw new Error(
                data.message ||
                "Exam submission failed."
            );
        }


        dataCache.dashboard =
            null;


        const scoreMetric =
            document.getElementById(
                "scoreMetric"
            );


        if (scoreMetric) {

            scoreMetric.innerText =
                `${Number(
                    data.score || 0
                ).toFixed(2)}%`;
        }


        const timeMetric =
            document.getElementById(
                "timeMetric"
            );


        if (timeMetric) {

            timeMetric.innerText =
                data.time_spent_seconds ??
                totalSecondsElapsed;
        }


        routeTo(
            "vResult"
        );


    } catch (err) {

        alert(
            "Submission Error: " +
            err.message
        );
    }
}


// ======================================================
// STUDENT PROFILE
// ======================================================

function openStudentProfileSettings() {

    routeTo(
        "vStudentProfile"
    );


    const currentPassword =
        document.getElementById(
            "profStudentCurrentPassword"
        );


    const newPassword =
        document.getElementById(
            "profStudentNewPassword"
        );


    if (currentPassword) {
        currentPassword.value = "";
    }


    if (newPassword) {
        newPassword.value = "";
    }
}


// ======================================================
// UPDATE STUDENT DETAILS
// ======================================================

async function updateStudentGeneralMetadata(e) {

    if (e) {
        e.preventDefault();
    }


    jwtToken =
        localStorage.getItem(
            "token"
        );


    const name =
        document.getElementById(
            "profStudentName"
        )?.value.trim();


    const email =
        document.getElementById(
            "profStudentEmail"
        )?.value.trim();


    try {

        const res = await fetch(
            `${API}/profile/update-general`,
            {
                method: "PUT",

                headers: {

                    "Content-Type":
                        "application/json",

                    "Authorization":
                        `Bearer ${jwtToken}`
                },

                body: JSON.stringify({
                    name,
                    email
                })
            }
        );


        const data =
            await safeJsonResponse(res);


        if (!res.ok) {

            throw new Error(
                data.message ||
                "Profile updates rejected."
            );
        }


        localStorage.setItem(
            "name",
            name
        );


        localStorage.setItem(
            "email",
            email
        );


        alert(
            "General profile updates saved successfully."
        );


        window.location.replace(
            "student.html"
        );


    } catch (err) {

        alert(err.message);
    }
}


// ======================================================
// UPDATE PASSWORD
// ======================================================

async function updateStudentPasswordSecurityMetric(e) {

    if (e) {
        e.preventDefault();
    }


    jwtToken =
        localStorage.getItem(
            "token"
        );


    try {

        const res = await fetch(
            `${API}/profile/update-password`,
            {
                method: "PUT",

                headers: {

                    "Content-Type":
                        "application/json",

                    "Authorization":
                        `Bearer ${jwtToken}`
                },

                body: JSON.stringify({

                    currentPassword:
                        document.getElementById(
                            "profStudentCurrentPassword"
                        )?.value,

                    newPassword:
                        document.getElementById(
                            "profStudentNewPassword"
                        )?.value
                })
            }
        );


        const data =
            await safeJsonResponse(res);


        if (!res.ok) {

            throw new Error(
                data.message ||
                "Password update rejected."
            );
        }


        alert(
            "Password modified successfully."
        );


        if (e?.target) {
            e.target.reset();
        }


        window.location.replace(
            "student.html"
        );


    } catch (err) {

        alert(err.message);
    }
}


// ======================================================
// LOGOUT MODAL
// ======================================================

function openLogoutModal() {

    const overlay =
        document.getElementById(
            "logoutModalOverlay"
        );


    if (!overlay) {
        return;
    }


    overlay.style.display =
        "flex";


    requestAnimationFrame(
        () => {

            overlay.style.opacity =
                "1";


            const card =
                document.getElementById(
                    "logoutModalCard"
                );


            if (card) {

                card.style.transform =
                    "scale(1)";
            }
        }
    );
}


function closeLogoutModal() {

    const overlay =
        document.getElementById(
            "logoutModalOverlay"
        );


    const card =
        document.getElementById(
            "logoutModalCard"
        );


    if (card) {

        card.style.transform =
            "scale(0.85)";
    }


    if (overlay) {

        overlay.style.opacity =
            "0";


        setTimeout(
            () => {

                overlay.style.display =
                    "none";

            },
            150
        );
    }
}


// ======================================================
// REAL LOGOUT
// ======================================================

function confirmApplicationLogout() {

    clearInterval(
        clockInterval
    );


    jwtToken =
        null;


    /*
     * ONLY explicit logout clears authentication.
     */

    localStorage.removeItem(
        "token"
    );

    localStorage.removeItem(
        "adminToken"
    );

    localStorage.removeItem(
        "role"
    );

    localStorage.removeItem(
        "name"
    );

    localStorage.removeItem(
        "email"
    );

    localStorage.removeItem(
        "requestedExamId"
    );


    closeLogoutModal();


    window.location.replace(
        "index.html"
    );
}


// ======================================================
// HELPERS
// ======================================================

async function safeJsonResponse(
    response
) {

    const text =
        await response.text();


    if (!text) {
        return {};
    }


    try {

        return JSON.parse(
            text
        );

    } catch {

        return {};
    }
}


function escapeHtml(value) {

    return String(
        value ?? ""
    ).replace(
        /[&<>'"]/g,
        character => ({

            "&": "&amp;",
            "<": "&lt;",
            ">": "&gt;",
            "'": "&#39;",
            '"': "&quot;"

        }[character])
    );
}
