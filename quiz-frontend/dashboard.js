const API_BASE = "https://quiz-backend-hrjv.onrender.com/api";

let authToken = sessionStorage.getItem("token");
let currentRole = sessionStorage.getItem("role");
let studentResults = [];

// ==========================================
// INITIALIZATION
// ==========================================

document.addEventListener("DOMContentLoaded", async () => {

    // Only redirect when there is genuinely no login session
    if (!authToken) {
        window.location.replace("index.html");
        return;
    }

    // Normalize role
    currentRole = (currentRole || "").toUpperCase();

    // Prevent ADMIN from opening student dashboard
    if (currentRole === "ADMIN") {
        window.location.replace("admin.html");
        return;
    }

    // Student role check
    if (currentRole !== "STUDENT") {
        sessionStorage.clear();
        window.location.replace("index.html");
        return;
    }

    hydrateIdentity();

    if (window.lucide) {
        lucide.createIcons();
    }

    await loadStudentData();
});


// ==========================================
// USER INFORMATION
// ==========================================

function hydrateIdentity() {

    const name =
        sessionStorage.getItem("name") || "Student";

    const email =
        sessionStorage.getItem("email") || "";

    const initial =
        (name || email || "S")
            .trim()
            .charAt(0)
            .toUpperCase();

    ["dashUserName", "sideName"].forEach(id => {

        const element =
            document.getElementById(id);

        if (element) {
            element.textContent = name;
        }
    });

    ["userAvatarText", "sideAvatar"].forEach(id => {

        const element =
            document.getElementById(id);

        if (element) {
            element.textContent = initial;
        }
    });

    const emailElement =
        document.getElementById("navUserEmail");

    if (emailElement) {
        emailElement.textContent =
            email || "Student account";
    }

    const profileName =
        document.getElementById("profileFullName");

    if (profileName) {
        profileName.value = name;
    }

    const profileEmail =
        document.getElementById("profileEmail");

    if (profileEmail) {
        profileEmail.value = email;
    }
}


// ==========================================
// LOAD STUDENT DATA
// ==========================================

async function loadStudentData() {

    const examList =
        document.getElementById("examList");

    try {

        const res = await fetch(
            `${API_BASE}/student/results`,
            {
                method: "GET",

                headers: {
                    "Authorization":
                        `Bearer ${authToken}`,

                    "Content-Type":
                        "application/json"
                }
            }
        );

        /*
         * IMPORTANT
         *
         * Do NOT automatically clear session
         * for every 403.
         *
         * 403 can mean a Spring Security
         * authority configuration problem.
         */

        if (res.status === 401) {

            console.error(
                "JWT rejected by backend."
            );

            showDashboardError(
                "Your authentication token was rejected. Please sign in again."
            );

            return;
        }

        if (res.status === 403) {

            console.error(
                "Student API returned 403 Forbidden."
            );

            showDashboardError(
                "Your account is logged in, but the server denied access to student records."
            );

            return;
        }

        if (!res.ok) {

            const errorData =
                await safeJson(res);

            throw new Error(
                errorData.message ||
                `Unable to load examination data (${res.status}).`
            );
        }

        const data =
            await res.json();

        studentResults =
            Array.isArray(data)
                ? data
                : [];

        renderStudentDashboard();

    } catch (err) {

        console.error(
            "Student dashboard error:",
            err
        );

        if (examList) {

            examList.innerHTML = `
                <div class="dashboard-panel error-cell">
                    ${escapeHtml(err.message)}
                </div>
            `;
        }
    }
}


// ==========================================
// ERROR DISPLAY
// ==========================================

function showDashboardError(message) {

    const examList =
        document.getElementById("examList");

    if (examList) {

        examList.innerHTML = `
            <div class="dashboard-panel error-cell">
                <strong>Unable to load dashboard data</strong>
                <p>${escapeHtml(message)}</p>
            </div>
        `;
    }
}


// ==========================================
// UPDATE PROFILE
// ==========================================

async function updateStudentProfile(e) {

    e.preventDefault();

    const name =
        document
            .getElementById("profileFullName")
            .value
            .trim();

    const email =
        document
            .getElementById("profileEmail")
            .value
            .trim();

    try {

        const res = await fetch(
            `${API_BASE}/profile/update-general`,
            {
                method: "PUT",

                headers: {
                    "Authorization":
                        `Bearer ${authToken}`,

                    "Content-Type":
                        "application/json"
                },

                body: JSON.stringify({
                    name,
                    email
                })
            }
        );

        const data =
            await safeJson(res);

        if (res.status === 401) {

            throw new Error(
                "Authentication expired. Please sign in again."
            );
        }

        if (res.status === 403) {

            throw new Error(
                "Server denied permission to update this profile."
            );
        }

        if (!res.ok) {

            throw new Error(
                data.message ||
                "Profile update failed."
            );
        }

        sessionStorage.setItem(
            "name",
            name
        );

        sessionStorage.setItem(
            "email",
            email
        );

        hydrateIdentity();

        alert(
            "Profile updated successfully."
        );

    } catch (err) {

        alert(err.message);
    }
}


// ==========================================
// DASHBOARD
// ==========================================

function renderStudentDashboard() {

    const completed =
        studentResults.filter(
            item =>
                String(item.status)
                    .toUpperCase() ===
                "COMPLETED"
        );

    const avg =
        completed.length
            ? completed.reduce(
                (sum, item) =>
                    sum +
                    Number(item.score || 0),
                0
            ) / completed.length
            : 0;

    const progress =
        studentResults.length
            ? Math.round(
                (
                    completed.length /
                    studentResults.length
                ) * 100
            )
            : 0;


    setText(
        "statVal1",
        studentResults.length
    );

    setText(
        "statVal2",
        completed.length
    );

    setText(
        "statVal3",
        `${avg.toFixed(1)}%`
    );

    setText(
        "progress-percent-text",
        `${progress}%`
    );

    const progressBar =
        document.getElementById(
            "progress-bar-fill"
        );

    if (progressBar) {
        progressBar.style.width =
            `${progress}%`;
    }

    setText(
        "progress-caption",
        `${completed.length} of ${studentResults.length} assigned exams completed.`
    );

    renderExamList();
    renderRecent();
    renderNextExam();
}


// ==========================================
// EXAM LIST
// ==========================================

function renderExamList() {

    const el =
        document.getElementById(
            "examList"
        );

    if (!el) return;


    if (!studentResults.length) {

        el.innerHTML = `
            <div class="dashboard-panel empty-state">

                <i data-lucide="inbox"></i>

                <h4>
                    No exams assigned
                </h4>

                <p>
                    New assessments will appear here when they are assigned.
                </p>

            </div>
        `;

        if (window.lucide) {
            lucide.createIcons();
        }

        return;
    }


    el.innerHTML =
        studentResults
            .map(item => {

                const done =
                    String(item.status)
                        .toUpperCase() ===
                    "COMPLETED";

                const id =
                    examId(item);

                return `

                <article class="exam-card">

                    <div class="exam-card-top">

                        <span class="status-badge ${done ? "completed" : "pending"}">

                            ${
                                done
                                    ? "Completed"
                                    : "Pending"
                            }

                        </span>

                        <span class="exam-ref">
                            #${escapeHtml(id ?? "—")}
                        </span>

                    </div>


                    <h4>
                        ${escapeHtml(
                            examName(item)
                        )}
                    </h4>


                    <p>

                        ${
                            done
                                ? `Final score: <strong>${Number(item.score || 0).toFixed(1)}%</strong>`
                                : "This assessment is ready when you are."
                        }

                    </p>


                    <div class="exam-card-footer">

                        ${
                            done

                                ? `
                                <span class="locked-label">
                                    <i data-lucide="lock"></i>
                                    Submitted
                                </span>
                                `

                                : `
                                <button
                                    class="btn-success compact-btn"
                                    onclick="startAssignedExam('${escapeHtml(id)}')">

                                    <i data-lucide="play"></i>

                                    Start Exam

                                </button>
                                `
                        }

                    </div>

                </article>
                `;

            })
            .join("");


    if (window.lucide) {
        lucide.createIcons();
    }
}


// ==========================================
// RECENT ACTIVITY
// ==========================================

function renderRecent() {

    const el =
        document.getElementById(
            "recentActivity"
        );

    if (!el) return;


    const rows =
        studentResults.slice(0, 4);


    if (!rows.length) {

        el.innerHTML =
            `<p class="panel-note">
                No activity yet.
             </p>`;

        return;
    }


    el.innerHTML =
        rows.map(item => {

            const done =
                String(item.status)
                    .toUpperCase() ===
                "COMPLETED";

            return `

            <div class="activity-row">

                <div class="activity-icon">

                    <i data-lucide="${
                        done
                            ? "check"
                            : "clock-3"
                    }"></i>

                </div>


                <div>

                    <strong>
                        ${escapeHtml(
                            examName(item)
                        )}
                    </strong>

                    <small>
                        ${escapeHtml(
                            item.status ||
                            "PENDING"
                        )}
                    </small>

                </div>


                <span>

                    ${
                        done
                            ? Number(
                                item.score || 0
                            ).toFixed(1) + "%"
                            : "Pending"
                    }

                </span>

            </div>
            `;

        }).join("");


    if (window.lucide) {
        lucide.createIcons();
    }
}


// ==========================================
// NEXT EXAM
// ==========================================

function renderNextExam() {

    const el =
        document.getElementById(
            "nextExamCard"
        );

    if (!el) return;


    const pending =
        studentResults.find(
            item =>
                String(item.status)
                    .toUpperCase() !==
                "COMPLETED"
        );


    if (pending) {

        el.innerHTML = `

            <strong>
                ${escapeHtml(
                    examName(pending)
                )}
            </strong>

            <p>
                Pending assessment ready to start.
            </p>

            <button
                class="btn-success compact-btn"
                onclick="startAssignedExam('${escapeHtml(examId(pending))}')">

                Open assessment

            </button>
        `;

    } else {

        el.innerHTML = `

            <strong>
                All caught up!
            </strong>

            <p>
                You have completed every currently assigned exam.
            </p>
        `;
    }
}


// ==========================================
// TAB NAVIGATION
// ==========================================

function switchStudentTab(
    tab,
    e
) {

    if (e) {
        e.preventDefault();
    }


    document
        .querySelectorAll(
            ".dash-tab-content"
        )
        .forEach(element => {

            element.style.display =
                "none";
        });


    document
        .querySelectorAll(
            ".menu-item"
        )
        .forEach(element => {

            element.classList.remove(
                "active"
            );
        });


    const target =
        document.getElementById(
            `tab-${tab}`
        );


    if (target) {
        target.style.display =
            "block";
    }


    if (e?.currentTarget) {

        e.currentTarget
            .classList
            .add("active");
    }


    if (window.lucide) {
        lucide.createIcons();
    }
}


// ==========================================
// START EXAM
// ==========================================

function startAssignedExam(id) {

    if (
        !id ||
        id === "undefined" ||
        id === "null"
    ) {

        alert(
            "This exam does not have a valid exam ID."
        );

        return;
    }


    sessionStorage.setItem(
        "requestedExamId",
        id
    );


    /*
     * IMPORTANT:
     * Do NOT clear session here.
     */

    window.location.href =
        `index.html?startExam=${encodeURIComponent(id)}`;
}


// ==========================================
// LOGOUT
// ==========================================

function confirmStudentLogout() {

    sessionStorage.removeItem(
        "token"
    );

    sessionStorage.removeItem(
        "role"
    );

    sessionStorage.removeItem(
        "name"
    );

    sessionStorage.removeItem(
        "email"
    );

    sessionStorage.removeItem(
        "requestedExamId"
    );

    window.location.replace(
        "index.html"
    );
}


// ==========================================
// HELPERS
// ==========================================

function examName(item) {

    return (
        item.examTitle ||
        item.exam?.title ||
        `Exam #${
            item.examId ??
            item.exam?.id ??
            "—"
        }`
    );
}


function examId(item) {

    return (
        item.examId ??
        item.exam?.id
    );
}


async function safeJson(res) {

    const text =
        await res.text();

    try {

        return text
            ? JSON.parse(text)
            : {};

    } catch {

        return {};
    }
}


function setText(id, value) {

    const element =
        document.getElementById(id);

    if (element) {
        element.textContent =
            value;
    }
}


function escapeHtml(value) {

    return String(value ?? "")
        .replace(
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
