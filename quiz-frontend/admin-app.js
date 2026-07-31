const API = "https://quiz-backend-hrjv.onrender.com/api";

let adminJwtToken =
    localStorage.getItem("adminToken") ||
    localStorage.getItem("token") ||
    null;

let adminRecordsCache = [];
let adminExamsCache = [];
let adminUsersCache = [];
let adminAutoRefreshTimer = null;


// ======================================================
// INITIALIZATION
// ======================================================

document.addEventListener("DOMContentLoaded", async () => {

    refreshIcons();

    const role =
        String(
            localStorage.getItem("role") || ""
        ).toUpperCase();

    if (!adminJwtToken || role !== "ADMIN") {

        clearAdminSession();

        showLoginView();

        return;
    }

    showDashboardView();

    hydrateAdminProfile();

    await refreshAdminData();

    startAdminAutoRefresh();
});


// ======================================================
// ICONS
// ======================================================

function refreshIcons() {

    if (window.lucide) {
        lucide.createIcons();
    }
}


// ======================================================
// ADMIN SESSION
// ======================================================

function clearAdminSession() {

    localStorage.removeItem("adminToken");
    localStorage.removeItem("token");
    localStorage.removeItem("role");
    localStorage.removeItem("name");
    localStorage.removeItem("email");

    adminJwtToken = null;
}


function showLoginView() {

    const login =
        document.getElementById("vAdminLogin");

    const dashboard =
        document.getElementById("vAdminDash");

    if (login) {
        login.style.display = "flex";
    }

    if (dashboard) {
        dashboard.style.display = "none";
    }
}


function showDashboardView() {

    const login =
        document.getElementById("vAdminLogin");

    const dashboard =
        document.getElementById("vAdminDash");

    if (login) {
        login.style.display = "none";
    }

    if (dashboard) {
        dashboard.style.display = "flex";
    }

    const name =
        localStorage.getItem("name") ||
        "Administrator";

    const email =
        localStorage.getItem("email") ||
        "Administrator";

    const emailDisplay =
        document.getElementById(
            "adminEmailDisplay"
        );

    if (emailDisplay) {
        emailDisplay.textContent = email;
    }

    const avatar =
        document.getElementById(
            "adminAvatar"
        );

    if (avatar) {

        avatar.textContent =
            (name || email)
                .trim()
                .charAt(0)
                .toUpperCase() || "A";
    }

    refreshIcons();
}


// ======================================================
// ADMIN LOGIN
// ======================================================

async function executeAdminAuth(event) {

    event.preventDefault();

    const email =
        document
            .getElementById("adminEmail")
            .value
            .trim();

    const password =
        document
            .getElementById("adminPassword")
            .value;

    try {

        const response =
            await fetch(
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
            await safeJson(response);

        if (!response.ok) {

            throw new Error(
                data.message ||
                "Invalid email or password."
            );
        }

        const role =
            String(
                data.role || ""
            ).toUpperCase();

        if (role !== "ADMIN") {

            throw new Error(
                "Access denied. This account is not an administrator."
            );
        }

        if (!data.token) {

            throw new Error(
                "Authentication token was not returned."
            );
        }

        adminJwtToken =
            data.token;

        localStorage.setItem(
            "adminToken",
            data.token
        );

        localStorage.setItem(
            "token",
            data.token
        );

        localStorage.setItem(
            "role",
            "ADMIN"
        );

        localStorage.setItem(
            "email",
            data.email || email
        );

        localStorage.setItem(
            "name",
            data.name ||
            "Administrator"
        );

        const errorBlock =
            document.getElementById(
                "errBlock"
            );

        if (errorBlock) {

            errorBlock.style.display =
                "none";
        }

        showDashboardView();

        hydrateAdminProfile();

        await refreshAdminData();

        startAdminAutoRefresh();

    } catch (error) {

        clearAdminSession();

        showLoginView();

        showError(
            error.message
        );
    }
}


// ======================================================
// API HELPERS
// ======================================================

function authHeaders(
    json = false
) {

    const headers = {

        Authorization:
            `Bearer ${adminJwtToken}`
    };

    if (json) {

        headers["Content-Type"] =
            "application/json";
    }

    return headers;
}


async function safeJson(
    response
) {

    const text =
        await response.text();

    try {

        return text
            ? JSON.parse(text)
            : {};

    } catch {

        return {};
    }
}


// ======================================================
// NOTIFICATIONS
// ======================================================

function showNotice(
    message,
    type = "info"
) {

    const element =
        document.getElementById(
            "adminNotice"
        );

    if (!element) return;

    element.className =
        `admin-notice ${type}`;

    element.textContent =
        message;

    element.style.display =
        "block";

    clearTimeout(
        showNotice.timeout
    );

    showNotice.timeout =
        setTimeout(
            () => {

                element.style.display =
                    "none";

            },
            5000
        );
}


function showError(
    message
) {

    showNotice(
        message,
        "error"
    );

    const element =
        document.getElementById(
            "errBlock"
        );

    if (element) {

        element.textContent =
            message;

        element.style.display =
            "block";
    }
}


// ======================================================
// AUTO REFRESH
// ======================================================

function startAdminAutoRefresh() {

    if (
        adminAutoRefreshTimer
    ) {

        clearInterval(
            adminAutoRefreshTimer
        );
    }

    adminAutoRefreshTimer =
        setInterval(
            async () => {

                if (
                    document.visibilityState ===
                    "visible" &&
                    adminJwtToken
                ) {

                    await refreshAdminData(
                        true
                    );
                }

            },
            5000
        );
}


// ======================================================
// REFRESH ALL ADMIN DATA
// ======================================================

async function refreshAdminData(
    silent = false
) {

    await Promise.allSettled([

        fetchAdminResults(
            silent
        ),

        loadAdminExams(
            silent
        ),

        loadAdminUsers(
            silent
        )
    ]);

    updateAdminOverview(
        adminRecordsCache,
        adminExamsCache
    );

    renderRecentActivity();
}


// ======================================================
// SYSTEM OVERVIEW
// ======================================================

function updateAdminOverview(
    records,
    exams
) {

    const rows =
        Array.isArray(records)
            ? records
            : [];

    const students =
        adminUsersCache.filter(
            user =>
                String(
                    user.role
                ).toUpperCase() ===
                "STUDENT"
        );

    const completed =
        rows.filter(
            result =>
                String(
                    result.status ||
                    "COMPLETED"
                ).toUpperCase() ===
                "COMPLETED"
        );

    const scores =
        completed
            .map(
                result =>
                    Number(
                        result.score
                    )
            )
            .filter(
                Number.isFinite
            );

    const average =
        scores.length
            ? scores.reduce(
                (a, b) =>
                    a + b,
                0
            ) /
              scores.length
            : 0;

    setText(
        "adminStatUsers",
        students.length
    );

    setText(
        "adminStatExams",
        Array.isArray(exams)
            ? exams.length
            : 0
    );

    setText(
        "adminStatSubmissions",
        completed.length
    );

    setText(
        "adminStatAvg",
        `${average.toFixed(1)}%`
    );

    renderOverviewCharts(rows, completed);
}



function renderOverviewCharts(rows, completed) {
    const bars = document.getElementById("performanceBars");
    const validScores = completed.map(r => Number(r.score)).filter(Number.isFinite);
    const groups = [
        ["Excellent", validScores.filter(v => v >= 80).length],
        ["Good", validScores.filter(v => v >= 60 && v < 80).length],
        ["Average", validScores.filter(v => v >= 40 && v < 60).length],
        ["Needs Work", validScores.filter(v => v < 40).length]
    ];
    const max = Math.max(1, ...groups.map(g => g[1]));
    if (bars) bars.innerHTML = groups.map(([label,value]) => `
      <div class="performance-row"><div class="performance-label"><span>${label}</span><b>${value}</b></div>
      <div class="bar-track"><div class="bar-fill" style="width:${(value/max)*100}%"></div></div></div>`).join("");
    const total = rows.length;
    const done = completed.length;
    const rate = total ? Math.round((done / total) * 100) : 0;
    setText("submissionRate", `${rate}%`);
    setText("completedCount", done);
    setText("pendingCount", Math.max(0,total-done));
    const ring = document.querySelector(".donut-ring");
    if (ring) ring.style.setProperty("--progress", `${rate * 3.6}deg`);
}

// ======================================================
// EXAMS
// ======================================================

async function loadAdminExams(
    silent = false
) {

    const body =
        document.getElementById(
            "managementExamsTableBody"
        );

    if (body) {

        body.innerHTML = `
            <tr>
                <td colspan="4">
                    Loading exams...
                </td>
            </tr>
        `;
    }

    try {

        const response =
            await fetch(
                `${API}/admin/exams`,
                {
                    headers:
                        authHeaders()
                }
            );

        if (
            response.status ===
            401
        ) {

            clearAdminSession();

            showLoginView();

            return;
        }

        const data =
            await safeJson(
                response
            );

        if (!response.ok) {

            throw new Error(
                data.message ||
                `Unable to load exams (${response.status}).`
            );
        }

        adminExamsCache =
            Array.isArray(data)
                ? data
                : [];

        renderAdminExams();

        updateAdminOverview(
            adminRecordsCache,
            adminExamsCache
        );

    } catch (error) {

        if (!silent) {

            showError(
                error.message
            );
        }
    }
}


function renderAdminExams() {

    const body =
        document.getElementById(
            "managementExamsTableBody"
        );

    if (!body) return;

    if (
        !adminExamsCache.length
    ) {

        body.innerHTML = `
            <tr>
                <td colspan="4">
                    No examinations found.
                </td>
            </tr>
        `;

        return;
    }

    body.innerHTML =
        adminExamsCache
            .map(
                exam => {

                    const id =
                        exam.examId ??
                        exam.id;

                    const title =
                        exam.title ??
                        exam.examTitle ??
                        `Exam #${id}`;

                    const duration =
                        exam.durationMinutes ??
                        exam.duration ??
                        "—";

                    return `
                        <tr>

                            <td>
                                #${escapeHtml(id)}
                            </td>

                            <td>
                                <strong>
                                    ${escapeHtml(title)}
                                </strong>
                            </td>

                            <td>
                                ${escapeHtml(duration)}
                                ${duration !== "—"
                                    ? " min"
                                    : ""}
                            </td>

                            <td>

                                <button
                                    class="table-danger-btn"
                                    onclick="deleteAdminExam(
                                        '${escapeJs(id)}',
                                        '${escapeJs(title)}'
                                    )">

                                    <i data-lucide="trash-2"></i>

                                    Delete

                                </button>

                            </td>

                        </tr>
                    `;
                }
            )
            .join("");

    refreshIcons();
}


// ======================================================
// CREATE EXAM PANEL
// ======================================================

function openCreateExamPanel() {

    const panel =
        document.getElementById(
            "createExamPanel"
        );

    if (!panel) return;

    panel.style.display =
        "block";

    /*
     * IMPORTANT:
     *
     * We DO NOT automatically add an MCQ here.
     *
     * Admin chooses:
     *
     * + Multiple Choice
     * OR
     * + True / False
     */

    panel.scrollIntoView({
        behavior: "smooth",
        block: "start"
    });

    refreshIcons();
}


function closeCreateExamPanel() {

    const panel =
        document.getElementById(
            "createExamPanel"
        );

    if (panel) {

        panel.style.display =
            "none";
    }
}


// ======================================================
// QUESTION BUILDER
// ======================================================

function appendQuestionTemplate(
    type = "MCQ"
) {

    const container =
        document.getElementById(
            "dynamicQuestionsContainer"
        );

    if (!container) return;

    const card =
        document.createElement(
            "div"
        );

    card.className =
        "admin-question-card";

    card.dataset.type =
        type;


    // ==================================================
    // TRUE / FALSE
    // ==================================================

    if (type === "TF") {

        card.innerHTML = `

            <div class="question-card-head">

                <strong
                    class="question-number-label">

                    Question

                </strong>


                <span
                    class="question-type-badge">

                    True / False

                </span>


                <button
                    type="button"
                    class="question-remove-btn"
                    onclick="removeQuestionCard(this)"
                    title="Delete Question">

                    <i data-lucide="trash-2"></i>

                </button>

            </div>


            <div class="form-group">

                <label>
                    True / False Statement
                </label>

                <textarea
                    class="q-text"
                    required
                    placeholder="Enter the statement here"></textarea>

            </div>


            <input
                type="hidden"
                class="q-a"
                value="True">


            <input
                type="hidden"
                class="q-b"
                value="False">


            <div class="form-group">

                <label>
                    Correct Answer
                </label>

                <select
                    class="q-answer"
                    required>

                    <option value="">
                        Select correct answer
                    </option>

                    <option value="A">
                        True
                    </option>

                    <option value="B">
                        False
                    </option>

                </select>

            </div>
        `;
    }


    // ==================================================
    // MULTIPLE CHOICE
    // ==================================================

    else {

        card.innerHTML = `

            <div class="question-card-head">

                <strong
                    class="question-number-label">

                    Question

                </strong>


                <span
                    class="question-type-badge">

                    Multiple Choice

                </span>


                <button
                    type="button"
                    class="question-remove-btn"
                    onclick="removeQuestionCard(this)"
                    title="Delete Question">

                    <i data-lucide="trash-2"></i>

                </button>

            </div>


            <div class="form-group">

                <label>
                    Question
                </label>

                <textarea
                    class="q-text"
                    required
                    placeholder="Enter your question"></textarea>

            </div>


            <div class="admin-options-grid">


                <div class="form-group">

                    <label>
                        Option A
                    </label>

                    <input
                        type="text"
                        class="q-a"
                        required
                        placeholder="Answer choice A">

                </div>


                <div class="form-group">

                    <label>
                        Option B
                    </label>

                    <input
                        type="text"
                        class="q-b"
                        required
                        placeholder="Answer choice B">

                </div>


                <div class="form-group">

                    <label>
                        Option C
                    </label>

                    <input
                        type="text"
                        class="q-c"
                        required
                        placeholder="Answer choice C">

                </div>


                <div class="form-group">

                    <label>
                        Option D
                    </label>

                    <input
                        type="text"
                        class="q-d"
                        required
                        placeholder="Answer choice D">

                </div>

            </div>


            <div class="form-group">

                <label>
                    Correct Answer
                </label>

                <select
                    class="q-answer"
                    required>

                    <option value="">
                        Select correct answer
                    </option>

                    <option value="A">
                        Option A
                    </option>

                    <option value="B">
                        Option B
                    </option>

                    <option value="C">
                        Option C
                    </option>

                    <option value="D">
                        Option D
                    </option>

                </select>

            </div>
        `;
    }


    container.appendChild(
        card
    );

    renumberQuestions();

    refreshIcons();
}


// ======================================================
// REMOVE QUESTION
// ======================================================

function removeQuestionCard(
    button
) {

    const card =
        button.closest(
            ".admin-question-card"
        );

    if (card) {

        card.remove();
    }

    /*
     * After deleting:
     *
     * Question 1
     * Question 3
     * Question 5
     *
     * becomes:
     *
     * Question 1
     * Question 2
     * Question 3
     */

    renumberQuestions();
}


// ======================================================
// RENUMBER QUESTIONS
// ======================================================

function renumberQuestions() {

    const questions =
        document.querySelectorAll(
            "#dynamicQuestionsContainer .admin-question-card"
        );

    questions.forEach(
        (card, index) => {

            const label =
                card.querySelector(
                    ".question-number-label"
                );

            if (label) {

                label.textContent =
                    `Question ${index + 1}`;
            }
        }
    );
}


// ======================================================
// COLLECT QUESTIONS
// ======================================================

function collectQuestions() {

    const cards =
        document.querySelectorAll(
            "#dynamicQuestionsContainer .admin-question-card"
        );

    return [...cards].map(
        card => {

            const type =
                card.dataset.type ||
                "MCQ";

            return {

                questionText:
                    card
                        .querySelector(
                            ".q-text"
                        )
                        ?.value
                        .trim(),

                optionA:
                    card
                        .querySelector(
                            ".q-a"
                        )
                        ?.value
                        .trim() ||
                    null,

                optionB:
                    card
                        .querySelector(
                            ".q-b"
                        )
                        ?.value
                        .trim() ||
                    null,

                optionC:
                    type === "TF"
                        ? null
                        : card
                            .querySelector(
                                ".q-c"
                            )
                            ?.value
                            .trim() ||
                          null,

                optionD:
                    type === "TF"
                        ? null
                        : card
                            .querySelector(
                                ".q-d"
                            )
                            ?.value
                            .trim() ||
                          null,

                correctAnswer:
                    card
                        .querySelector(
                            ".q-answer"
                        )
                        ?.value,

                type:
                    type
            };
        }
    );
}


// ======================================================
// CREATE EXAM
// ======================================================

async function createAdminExam(
    event
) {

    event.preventDefault();

    const title =
        document
            .getElementById(
                "examTitleInput"
            )
            .value
            .trim();

    const durationMinutes =
        Number(
            document
                .getElementById(
                    "examDurationInput"
                )
                .value
        );

    const questions =
        collectQuestions();

    if (!title) {

        showError(
            "Assessment title is required."
        );

        return;
    }

    if (
        !durationMinutes ||
        durationMinutes <= 0
    ) {

        showError(
            "Enter a valid exam duration."
        );

        return;
    }

    if (
        questions.length === 0
    ) {

        showError(
            "Add at least one question."
        );

        return;
    }

    for (
        let i = 0;
        i < questions.length;
        i++
    ) {

        const question =
            questions[i];

        if (
            !question.questionText
        ) {

            showError(
                `Question ${i + 1} is empty.`
            );

            return;
        }

        if (
            !question.correctAnswer
        ) {

            showError(
                `Select the correct answer for Question ${i + 1}.`
            );

            return;
        }
    }


    const payload = {

        title,

        durationMinutes,

        questions
    };


    try {

        const response =
            await fetch(
                `${API}/admin/exams`,
                {

                    method: "POST",

                    headers:
                        authHeaders(
                            true
                        ),

                    body:
                        JSON.stringify(
                            payload
                        )
                }
            );


        const data =
            await safeJson(
                response
            );


        if (!response.ok) {

            throw new Error(
                data.message ||
                `Exam creation failed (${response.status}).`
            );
        }


        showNotice(
            data.message ||
            "Exam created successfully.",
            "success"
        );


        event.target.reset();


        const container =
            document.getElementById(
                "dynamicQuestionsContainer"
            );

        if (container) {

            container.innerHTML =
                "";
        }


        closeCreateExamPanel();


        await loadAdminExams();


    } catch (error) {

        showError(
            error.message
        );
    }
}


// ======================================================
// DELETE EXAM
// ======================================================

async function deleteAdminExam(
    id,
    title
) {

    const confirmed =
        confirm(
            `Delete "${title}"?\n\nThis action cannot be undone.`
        );

    if (!confirmed) {
        return;
    }

    try {

        const response =
            await fetch(
                `${API}/admin/exams/${encodeURIComponent(id)}`,
                {

                    method: "DELETE",

                    headers:
                        authHeaders()
                }
            );


        const data =
            await safeJson(
                response
            );


        if (!response.ok) {

            throw new Error(
                data.message ||
                `Unable to delete exam (${response.status}).`
            );
        }


        showNotice(
            data.message ||
            "Exam deleted successfully.",
            "success"
        );


        await loadAdminExams();


    } catch (error) {

        showError(
            error.message
        );
    }
}


// ======================================================
// GLOBAL RESULTS
// ======================================================

async function fetchAdminResults(
    silent = false
) {

    try {

        const response =
            await fetch(
                `${API}/admin/results`,
                {
                    headers:
                        authHeaders()
                }
            );


        if (
            response.status ===
            401
        ) {

            clearAdminSession();

            showLoginView();

            return;
        }


        const data =
            await safeJson(
                response
            );


        if (!response.ok) {

            throw new Error(
                data.message ||
                `Unable to load results (${response.status}).`
            );
        }


        adminRecordsCache =
            Array.isArray(data)
                ? data
                : [];


        renderAdminResults();


    } catch (error) {

        if (!silent) {

            showError(
                error.message
            );
        }
    }
}


// ======================================================
// GLOBAL RESULT FILTER
// ======================================================

function handleGlobalResultFilter() {

    const filter =
        document.getElementById(
            "globalResultFilter"
        )?.value;


    const dateRange =
        document.getElementById(
            "globalDateRange"
        );


    if (dateRange) {

        dateRange.style.display =
            filter === "DATE_RANGE"
                ? "flex"
                : "none";
    }


    renderAdminResults();
}


function renderAdminResults() {

    let records =
        [
            ...adminRecordsCache
        ];


    const filter =
        document.getElementById(
            "globalResultFilter"
        )?.value ||
        "ALL";


    if (
        filter ===
        "STUDENT"
    ) {

        records =
            records.filter(
                result =>
                    String(
                        result.studentRole ||
                        "STUDENT"
                    ).toUpperCase() ===
                    "STUDENT"
            );
    }


    if (
        filter ===
        "ADMIN"
    ) {

        records =
            records.filter(
                result =>
                    String(
                        result.studentRole ||
                        ""
                    ).toUpperCase() ===
                    "ADMIN"
            );
    }


    if (
        filter ===
        "SCORE_DESC"
    ) {

        records.sort(
            (a, b) =>
                Number(
                    b.score || 0
                ) -
                Number(
                    a.score || 0
                )
        );
    }


    if (
        filter ===
        "SCORE_ASC"
    ) {

        records.sort(
            (a, b) =>
                Number(
                    a.score || 0
                ) -
                Number(
                    b.score || 0
                )
        );
    }


    if (
        filter ===
        "THIS_MONTH"
    ) {

        records =
            records.filter(
                result =>
                    isThisMonth(
                        result.completedAt,
                        0
                    )
            );
    }


    if (
        filter ===
        "LAST_MONTH"
    ) {

        records =
            records.filter(
                result =>
                    isThisMonth(
                        result.completedAt,
                        -1
                    )
            );
    }


    if (
        filter ===
        "DATE_RANGE"
    ) {

        const from =
            document.getElementById(
                "globalDateFrom"
            )?.value;

        const to =
            document.getElementById(
                "globalDateTo"
            )?.value;


        records =
            records.filter(
                result =>
                    dateInRange(
                        result.completedAt,
                        from,
                        to
                    )
            );
    }


    const body =
        document.getElementById(
            "admin-results-table-body"
        );


    if (!body) return;


    if (
        records.length === 0
    ) {

        body.innerHTML = `

            <tr>

                <td colspan="6">

                    No matching records found.

                </td>

            </tr>
        `;

        return;
    }


    body.innerHTML =
        records.map(
            result => {

                const score =
                    Number(
                        result.score ||
                        0
                    );


                const status =
                    String(
                        result.status ||
                        "COMPLETED"
                    ).toUpperCase();


                const time =
                    formatTime(
                        result.timeSpentSeconds
                    );


                return `

                    <tr>

                        <td>

                            <strong>

                                ${escapeHtml(
                                    result.studentName ||
                                    "Unknown Student"
                                )}

                            </strong>

                            <small
                                class="table-subtext">

                                ${escapeHtml(
                                    result.studentEmail ||
                                    ""
                                )}

                            </small>

                        </td>


                        <td>

                            ${escapeHtml(
                                result.studentRole ||
                                "STUDENT"
                            )}

                        </td>


                        <td>

                            ${escapeHtml(
                                result.examTitle ||
                                `Exam #${result.examId ?? "—"}`
                            )}

                        </td>


                        <td>

                            <span
                                class="status-badge ${
                                    status ===
                                    "COMPLETED"
                                        ? "completed"
                                        : "pending"
                                }">

                                ${escapeHtml(
                                    status
                                )}

                            </span>

                        </td>


                        <td>

                            <div
                                class="score-cell">

                                <strong>

                                    ${score.toFixed(
                                        1
                                    )}%

                                </strong>

                                <div
                                    class="mini-progress">

                                    <span
                                        style="width:${Math.max(
                                            0,
                                            Math.min(
                                                100,
                                                score
                                            )
                                        )}%">
                                    </span>

                                </div>

                            </div>

                        </td>


                        <td>

                            ${escapeHtml(
                                time
                            )}

                        </td>

                    </tr>
                `;
            }
        )
        .join("");
}


// ======================================================
// REGISTERED USERS
// ======================================================

async function loadAdminUsers(
    silent = false
) {

    try {

        const response =
            await fetch(
                `${API}/admin/users`,
                {
                    headers:
                        authHeaders()
                }
            );


        const data =
            await safeJson(
                response
            );


        if (!response.ok) {

            throw new Error(
                data.message ||
                `Unable to load registered accounts (${response.status}).`
            );
        }


        adminUsersCache =
            Array.isArray(data)
                ? data
                : [];


        renderAdminUsers();
        renderPortalStudents();


    } catch (error) {

        if (!silent) {

            showError(
                error.message
            );
        }
    }
}


// ======================================================
// USER FILTER
// ======================================================

function handleAccountFilter() {

    const filter =
        document.getElementById(
            "accountFilter"
        )?.value;


    const range =
        document.getElementById(
            "accountDateRange"
        );


    if (range) {

        range.style.display =
            filter ===
            "DATE_RANGE"
                ? "flex"
                : "none";
    }


    renderAdminUsers();
}


function renderAdminUsers() {

    let users =
        [
            ...adminUsersCache
        ];


    const filter =
        document.getElementById(
            "accountFilter"
        )?.value ||
        "ALL";


    if (
        filter ===
        "STUDENT" ||
        filter ===
        "ADMIN"
    ) {

        users =
            users.filter(
                user =>
                    String(
                        user.role
                    ).toUpperCase() ===
                    filter
            );
    }


    if (
        filter ===
        "THIS_MONTH"
    ) {

        users =
            users.filter(
                user =>
                    isThisMonth(
                        user.createdAt,
                        0
                    )
            );
    }


    if (
        filter ===
        "LAST_MONTH"
    ) {

        users =
            users.filter(
                user =>
                    isThisMonth(
                        user.createdAt,
                        -1
                    )
            );
    }


    if (
        filter ===
        "NEWEST"
    ) {

        users.sort(
            (a, b) =>
                new Date(
                    b.createdAt
                ) -
                new Date(
                    a.createdAt
                )
        );
    }


    if (
        filter ===
        "OLDEST"
    ) {

        users.sort(
            (a, b) =>
                new Date(
                    a.createdAt
                ) -
                new Date(
                    b.createdAt
                )
        );
    }


    if (
        filter ===
        "DATE_RANGE"
    ) {

        const from =
            document.getElementById(
                "accountDateFrom"
            )?.value;


        const to =
            document.getElementById(
                "accountDateTo"
            )?.value;


        users =
            users.filter(
                user =>
                    dateInRange(
                        user.createdAt,
                        from,
                        to
                    )
            );
    }


    const body =
        document.getElementById(
            "admin-users-table-body"
        );


    if (!body) return;


    if (
        users.length === 0
    ) {

        body.innerHTML = `

            <tr>

                <td colspan="6">

                    No matching accounts found.

                </td>

            </tr>
        `;

        return;
    }


    body.innerHTML =
        users.map(
            user => `

                <tr>

                    <td>

                        <strong>

                            ${escapeHtml(
                                user.name
                            )}

                        </strong>

                    </td>


                    <td>

                        ${escapeHtml(
                            user.email
                        )}

                    </td>


                    <td>

                        <span
                            class="role-pill ${String(
                                user.role
                            ).toLowerCase()}">

                            ${escapeHtml(
                                user.role
                            )}

                        </span>

                    </td>


                    <td>

                        ${escapeHtml(
                            formatDateTime(
                                user.createdAt
                            )
                        )}

                    </td>


                    <td>

                        <span
                            class="secured-password">

                            <i data-lucide="shield-check"></i>

                            Secured

                        </span>

                    </td>


                    <td>

                        <button
                            class="mini-icon-btn labeled"
                            onclick="adminResetUserPassword(
                                '${escapeJs(
                                    user.userId
                                )}',
                                '${escapeJs(
                                    user.email
                                )}'
                            )">

                            <i data-lucide="key-round"></i>

                            Reset

                        </button>

                    </td>

                </tr>
            `
        )
        .join("");


    refreshIcons();
}


// ======================================================
// ADMIN RESET USER PASSWORD
// ======================================================

async function adminResetUserPassword(
    id,
    email
) {

    const password =
        prompt(
            `Enter a new password for ${email}:`
        );


    if (
        password === null
    ) {

        return;
    }


    if (
        password.length < 6
    ) {

        showError(
            "Password must contain at least 6 characters."
        );

        return;
    }


    try {

        const response =
            await fetch(
                `${API}/admin/users/${encodeURIComponent(id)}/reset-password`,
                {

                    method: "PUT",

                    headers:
                        authHeaders(
                            true
                        ),

                    body:
                        JSON.stringify({
                            newPassword:
                                password
                        })
                }
            );


        const data =
            await safeJson(
                response
            );


        if (!response.ok) {

            throw new Error(
                data.message ||
                "Password reset failed."
            );
        }


        showNotice(
            data.message ||
            "Password reset successfully.",
            "success"
        );


    } catch (error) {

        showError(
            error.message
        );
    }
}


// ======================================================
// STUDENT PORTAL CONTROL
// ======================================================
async function loadStudentPortalSettings() {
  try { const r=await fetch(`${API}/admin/student-portal/settings`,{headers:authHeaders()}); const d=await safeJson(r); if(!r.ok) throw new Error(d.message||"Unable to load portal settings."); const t=document.getElementById("registrationControlToggle"); if(t)t.checked=!!d.registrationEnabled; updateRegistrationControlText(!!d.registrationEnabled); } catch(e){ showError(e.message); }
}
function updateRegistrationControlText(enabled){ const e=document.getElementById("registrationControlText"); if(e)e.textContent=enabled?"Students can create accounts from the public signup page.":"Public signup is stopped. Admin-created students are still allowed."; }
async function setPublicRegistration(enabled){ try{ const r=await fetch(`${API}/admin/student-portal/settings`,{method:"PUT",headers:authHeaders(true),body:JSON.stringify({registrationEnabled:enabled})}); const d=await safeJson(r); if(!r.ok)throw new Error(d.message||"Unable to update registration."); updateRegistrationControlText(enabled); showNotice(d.message,"success"); }catch(e){ const t=document.getElementById("registrationControlToggle"); if(t)t.checked=!enabled; showError(e.message); } }
async function adminCreateStudent(e){ e.preventDefault(); const name=document.getElementById("portalStudentName").value.trim(),email=document.getElementById("portalStudentEmail").value.trim(),password=document.getElementById("portalStudentPassword").value; try{ const r=await fetch(`${API}/admin/students`,{method:"POST",headers:authHeaders(true),body:JSON.stringify({name,email,password})}); const d=await safeJson(r); if(!r.ok)throw new Error(d.message||"Unable to create student."); e.target.reset(); showNotice(`${d.message} ${d.displayId||""}`,"success"); await loadAdminUsers(true); }catch(x){showError(x.message);} }
function renderPortalStudents(){ const b=document.getElementById("portalStudentsBody"); if(!b)return; const users=adminUsersCache.filter(u=>String(u.role).toUpperCase()==="STUDENT"); b.innerHTML=users.length?users.map(u=>`<tr><td><strong>${escapeHtml(u.displayId||"—")}</strong></td><td>${escapeHtml(u.name)}</td><td>${escapeHtml(u.email)}</td><td>${escapeHtml(formatDateTime(u.createdAt))}</td><td><span class="status-badge ${u.accountEnabled!==false?"completed":"pending"}">${u.accountEnabled!==false?"Enabled":"Disabled"}</span></td><td><div class="portal-actions"><button class="mini-icon-btn labeled" onclick="setStudentEnabled('${escapeJs(u.userId)}',${u.accountEnabled===false})">${u.accountEnabled===false?"Enable":"Disable"}</button><button class="table-danger-btn" onclick="deleteStudentAccount('${escapeJs(u.userId)}','${escapeJs(u.name)}')">Delete</button></div></td></tr>`).join(""):"<tr><td colspan=\"6\">No student accounts found.</td></tr>"; refreshIcons(); }
async function setStudentEnabled(id,enabled){ try{ const r=await fetch(`${API}/admin/users/${encodeURIComponent(id)}/enabled`,{method:"PUT",headers:authHeaders(true),body:JSON.stringify({enabled})}); const d=await safeJson(r); if(!r.ok)throw new Error(d.message||"Unable to update account."); await loadAdminUsers(true); showNotice(enabled?"Student account enabled.":"Student account disabled.","success"); }catch(e){showError(e.message);} }
async function deleteStudentAccount(id,name){ if(!confirm(`Delete student account "${name}"?`))return; try{ const r=await fetch(`${API}/admin/users/${encodeURIComponent(id)}`,{method:"DELETE",headers:authHeaders()}); const d=await safeJson(r); if(!r.ok)throw new Error(d.message||"Unable to delete student."); await loadAdminUsers(true); showNotice(d.message,"success"); }catch(e){showError(e.message);} }

// ======================================================
// CREATE ADMINISTRATOR
// ======================================================

async function createAdministrator(
    event
) {

    event.preventDefault();


    const name =
        document
            .getElementById(
                "newAdminName"
            )
            .value
            .trim();


    const email =
        document
            .getElementById(
                "newAdminEmail"
            )
            .value
            .trim();


    const password =
        document
            .getElementById(
                "newAdminPassword"
            )
            .value;


    try {

        const response =
            await fetch(
                `${API}/admin/create-admin`,
                {

                    method: "POST",

                    headers:
                        authHeaders(
                            true
                        ),

                    body:
                        JSON.stringify({
                            name,
                            email,
                            password
                        })
                }
            );


        const data =
            await safeJson(
                response
            );


        if (!response.ok) {

            throw new Error(
                data.message ||
                `Admin creation failed (${response.status}).`
            );
        }


        showNotice(
            data.message ||
            "Administrator created successfully.",
            "success"
        );


        event.target.reset();


        await loadAdminUsers(
            true
        );


    } catch (error) {

        showError(
            error.message
        );
    }
}


// ======================================================
// ADMIN PROFILE
// ======================================================

function hydrateAdminProfile() {

    const name =
        localStorage.getItem(
            "name"
        ) ||
        "Administrator";


    const email =
        localStorage.getItem(
            "email"
        ) ||
        "";


    const nameInput =
        document.getElementById(
            "profAdminName"
        );


    const emailInput =
        document.getElementById(
            "profAdminEmail"
        );


    if (nameInput) {

        nameInput.value =
            name;
    }


    if (emailInput) {

        emailInput.value =
            email;
    }
}


// ======================================================
// UPDATE PROFILE
// ======================================================

async function updateAdminGeneralMetadata(
    event
) {

    event.preventDefault();


    const name =
        document
            .getElementById(
                "profAdminName"
            )
            .value
            .trim();


    const email =
        document
            .getElementById(
                "profAdminEmail"
            )
            .value
            .trim();


    try {

        const response =
            await fetch(
                `${API}/profile/update-general`,
                {

                    method: "PUT",

                    headers:
                        authHeaders(
                            true
                        ),

                    body:
                        JSON.stringify({
                            name,
                            email
                        })
                }
            );


        const data =
            await safeJson(
                response
            );


        if (!response.ok) {

            throw new Error(
                data.message ||
                "Profile update failed."
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


        showDashboardView();


        showNotice(
            "Admin profile updated successfully.",
            "success"
        );


    } catch (error) {

        showError(
            error.message
        );
    }
}


// ======================================================
// CHANGE ADMIN PASSWORD
// ======================================================

async function updateAdminPasswordSecurityMetric(
    event
) {

    event.preventDefault();


    const currentPassword =
        document.getElementById(
            "profAdminCurrentPassword"
        ).value;


    const newPassword =
        document.getElementById(
            "profAdminNewPassword"
        ).value;


    if (
        newPassword.length < 6
    ) {

        showError(
            "New password must contain at least 6 characters."
        );

        return;
    }


    try {

        const response =
            await fetch(
                `${API}/profile/update-password`,
                {

                    method: "PUT",

                    headers:
                        authHeaders(
                            true
                        ),

                    body:
                        JSON.stringify({
                            currentPassword,
                            newPassword
                        })
                }
            );


        const data =
            await safeJson(
                response
            );


        if (!response.ok) {

            throw new Error(
                data.message ||
                "Password update failed."
            );
        }


        event.target.reset();


        showNotice(
            "Password changed successfully.",
            "success"
        );


    } catch (error) {

        showError(
            error.message
        );
    }
}


// ======================================================
// RECENT ACTIVITY
// ======================================================

function renderRecentActivity() {

    const element =
        document.getElementById(
            "adminRecentActivity"
        );


    if (!element) return;


    const rows =
        [
            ...adminRecordsCache
        ]
            .slice(-5)
            .reverse();


    if (
        rows.length === 0
    ) {

        element.innerHTML = `

            <p class="panel-note">

                No submissions yet.

            </p>
        `;

        return;
    }


    element.innerHTML =
        rows.map(
            result => `

                <div
                    class="admin-recent-row">

                    <div
                        class="activity-icon">

                        <i data-lucide="check"></i>

                    </div>


                    <div>

                        <strong>

                            ${escapeHtml(
                                result.studentName ||
                                "Student"
                            )}

                        </strong>

                        <small>

                            ${escapeHtml(
                                result.examTitle ||
                                "Exam"
                            )}

                        </small>

                    </div>


                    <span>

                        ${Number(
                            result.score ||
                            0
                        ).toFixed(1)}%

                    </span>

                </div>
            `
        )
        .join("");


    refreshIcons();
}


// ======================================================
// ADMIN NAVIGATION
// ======================================================

function switchAdminTab(
    name,
    event
) {

    if (event) {

        event.preventDefault();
    }


    document
        .querySelectorAll(
            ".dash-tab-content"
        )
        .forEach(
            element => {

                element.style.display =
                    "none";
            }
        );


    document
        .querySelectorAll(
            ".menu-item"
        )
        .forEach(
            element => {

                element.classList.remove(
                    "active"
                );
            }
        );


    const tab =
        document.getElementById(
            `tab-${name}`
        );


    if (tab) {

        tab.style.display =
            "block";
    }


    if (
        event?.currentTarget
    ) {

        event.currentTarget
            .classList.add(
                "active"
            );
    }


    if (
        name ===
        "analytics"
    ) {

        renderAdminResults();
    }


    if (
        name ===
        "exams"
    ) {

        renderAdminExams();
    }


    if (
        name ===
        "users"
    ) {

        renderAdminUsers();
    }


    if (name === "student-control") { loadStudentPortalSettings(); renderPortalStudents(); }

    if (
        name ===
        "profile"
    ) {

        hydrateAdminProfile();
    }


    refreshIcons();
}


// ======================================================
// LOGOUT
// ======================================================

function openAdminLogoutModal() {

    const modal =
        document.getElementById(
            "adminLogoutModalOverlay"
        );


    if (modal) {

        modal.style.display =
            "flex";
    }


    refreshIcons();
}


function closeAdminLogoutModal() {

    const modal =
        document.getElementById(
            "adminLogoutModalOverlay"
        );


    if (modal) {

        modal.style.display =
            "none";
    }
}


function confirmAdminLogout() {

    clearAdminSession();

    window.location.replace(
        "admin.html"
    );
}


// ======================================================
// PASSWORD VISIBILITY
// ======================================================

function togglePasswordDisplay(
    id,
    event
) {

    const input =
        document.getElementById(
            id
        );


    if (!input) return;


    input.type =
        input.type ===
        "password"
            ? "text"
            : "password";


    const icon =
        event
            ?.currentTarget
            ?.querySelector(
                "i"
            );


    if (icon) {

        icon.setAttribute(
            "data-lucide",
            input.type ===
            "password"
                ? "eye"
                : "eye-off"
        );
    }


    refreshIcons();
}


// ======================================================
// DATE HELPERS
// ======================================================

function dateInRange(
    value,
    from,
    to
) {

    if (!value) return false;


    const date =
        new Date(value);


    if (
        Number.isNaN(
            date.getTime()
        )
    ) {

        return false;
    }


    if (
        from &&
        date <
        new Date(
            `${from}T00:00:00`
        )
    ) {

        return false;
    }


    if (
        to &&
        date >
        new Date(
            `${to}T23:59:59`
        )
    ) {

        return false;
    }


    return true;
}


function isThisMonth(
    value,
    offset = 0
) {

    if (!value) return false;


    const date =
        new Date(value);


    const now =
        new Date();


    const target =
        new Date(
            now.getFullYear(),
            now.getMonth() +
            offset,
            1
        );


    return (
        date.getFullYear() ===
            target.getFullYear() &&

        date.getMonth() ===
            target.getMonth()
    );
}


function formatDateTime(
    value
) {

    if (!value) {

        return "—";
    }


    const date =
        new Date(value);


    if (
        Number.isNaN(
            date.getTime()
        )
    ) {

        return String(value);
    }


    return date.toLocaleString();
}


function formatTime(
    seconds
) {

    if (
        seconds === null ||
        seconds === undefined ||
        seconds === ""
    ) {

        return "—";
    }


    const number =
        Number(seconds);


    if (
        !Number.isFinite(
            number
        )
    ) {

        return String(seconds);
    }


    const minutes =
        Math.floor(
            number / 60
        );


    const remaining =
        Math.floor(
            number % 60
        );


    return `${minutes}m ${remaining}s`;
}


// ======================================================
// GENERAL HELPERS
// ======================================================

function setText(
    id,
    value
) {

    const element =
        document.getElementById(
            id
        );


    if (element) {

        element.textContent =
            value;
    }
}


function escapeHtml(
    value
) {

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
        })[character]
    );
}


function escapeJs(
    value
) {

    return String(
        value ?? ""
    )
        .replace(
            /\\/g,
            "\\\\"
        )
        .replace(
            /'/g,
            "\\'"
        )
        .replace(
            /\r/g,
            "\\r"
        )
        .replace(
            /\n/g,
            "\\n"
        );
}
