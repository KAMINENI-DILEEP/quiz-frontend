const API_BASE = "https://quiz-backend-hrjv.onrender.com/api";

let studentResults = [];

// ======================================================
// INITIALIZATION & AUTHENTICATION
// ======================================================

document.addEventListener("DOMContentLoaded", async () => {

    const authToken = sessionStorage.getItem("token");

    const currentRole = String(
        sessionStorage.getItem("role") || ""
    ).toUpperCase();

    console.log("STUDENT PAGE LOADED");
    console.log("Token exists:", !!authToken);
    console.log("Role:", currentRole);

    // No token = not logged in
    if (!authToken) {
        console.error("No authentication token found.");
        window.location.replace("index.html");
        return;
    }

    // Admin should not access student dashboard
    if (currentRole === "ADMIN") {
        console.log("Admin detected. Redirecting to admin page.");
        window.location.replace("admin.html");
        return;
    }

    /*
     * IMPORTANT:
     * Never clear sessionStorage automatically here.
     *
     * If the role is temporarily unavailable or incorrect,
     * keep the session so we can diagnose the problem.
     */
    if (currentRole !== "STUDENT") {
        console.error(
            "Unexpected account role:",
            currentRole
        );

        showDashboardError(
            "Your login session exists, but the account role could not be verified."
        );

        return;
    }

    hydrateIdentity();

    if (window.lucide) {
        lucide.createIcons();
    }

    await loadStudentData();
});


// ======================================================
// USER IDENTITY
// ======================================================

function hydrateIdentity() {

    const name =
        sessionStorage.getItem("name") ||
        "Student";

    const email =
        sessionStorage.getItem("email") ||
        "";

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


    const navUserEmail =
        document.getElementById(
            "navUserEmail"
        );

    if (navUserEmail) {
        navUserEmail.textContent =
            email || "Student account";
    }


    const profileFullName =
        document.getElementById(
            "profileFullName"
        );

    if (profileFullName) {
        profileFullName.value = name;
    }


    const profileEmail =
        document.getElementById(
            "profileEmail"
        );

    if (profileEmail) {
        profileEmail.value = email;
    }
}


// ======================================================
// LOAD STUDENT DATA
// ======================================================

async function loadStudentData() {

    /*
     * Read the token at request time.
     * Do not depend on a token captured when JS first loaded.
     */
    const authToken =
        sessionStorage.getItem("token");

    if (!authToken) {

        console.error(
            "Token missing before student/results request."
        );

        showDashboardError(
            "Authentication token is unavailable."
        );

        return;
    }


    try {

        console.log(
            "Loading student results..."
        );


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


        console.log(
            "student/results status:",
            res.status
        );


        /*
         * IMPORTANT:
         *
         * DO NOT clear sessionStorage for
         * 401 or 403 responses.
         *
         * This prevents automatic logout.
         */

        if (res.status === 401) {

            console.error(
                "Backend returned 401 Unauthorized."
            );

            showDashboardError(
                "The backend rejected your authentication token. Please check the JWT configuration."
            );

            return;
        }


        if (res.status === 403) {

            console.error(
                "Backend returned 403 Forbidden."
            );

            showDashboardError(
                "You are logged in, but the backend denied access to student records."
            );

            return;
        }


        if (!res.ok) {

            const errorData =
                await safeJson(res);

            throw new Error(
                errorData.message ||
                `Could not load examination data. HTTP ${res.status}`
            );
        }


        const data =
            await res.json();


        studentResults =
            Array.isArray(data)
                ? data
                : [];


        console.log(
            "Student results loaded:",
            studentResults.length
        );


        renderStudentDashboard();


    } catch (err) {

        console.error(
            "Student dashboard request failed:",
            err
        );


        showDashboardError(
            err.message ||
            "Unable to load student dashboard."
        );
    }
}


// ======================================================
// ERROR DISPLAY
// ======================================================

function showDashboardError(message) {

    console.error(message);

    const examList =
        document.getElementById(
            "examList"
        );


    if (examList) {

        examList.innerHTML = `

            <div class="dashboard-panel error-cell">

                <strong>
                    Unable to load dashboard data
                </strong>

                <p>
                    ${escapeHtml(message)}
                </p>

            </div>
        `;
    }
}


// ======================================================
// PROFILE UPDATE
// ======================================================

async function updateStudentProfile(e) {

    if (e) {
        e.preventDefault();
    }


    const authToken =
        sessionStorage.getItem("token");


    if (!authToken) {

        alert(
            "Authentication token is unavailable."
        );

        return;
    }


    const nameElement =
        document.getElementById(
            "profileFullName"
        );


    const emailElement =
        document.getElementById(
            "profileEmail"
        );


    if (!nameElement || !emailElement) {
        return;
    }


    const name =
        nameElement.value.trim();

    const email =
        emailElement.value.trim();


    if (!name || !email) {

        alert(
            "Name and email are required."
        );

        return;
    }


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
                "Authentication token was rejected."
            );
        }


        if (res.status === 403) {

            throw new Error(
                "Server denied permission to update your profile."
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

        console.error(
            "Profile update error:",
            err
        );

        alert(err.message);
    }
}


// ======================================================
// DASHBOARD METRICS
// ======================================================

function renderStudentDashboard() {

    const completed =
        studentResults.filter(
            item =>
                String(
                    item.status || ""
                ).toUpperCase() ===
                "COMPLETED"
        );


    const averageScore =
        completed.length
            ? completed.reduce(
                (sum, item) =>
                    sum +
                    Number(
                        item.score || 0
                    ),
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
        `${averageScore.toFixed(1)}%`
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


// ======================================================
// EXAM LIST
// ======================================================

function renderExamList() {

    const element =
        document.getElementById(
            "examList"
        );


    if (!element) {
        return;
    }


    if (!studentResults.length) {

        element.innerHTML = `

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


        refreshIcons();

        return;
    }


    element.innerHTML =
        studentResults
            .map(item => {

                const done =
                    String(
                        item.status || ""
                    ).toUpperCase() ===
                    "COMPLETED";


                const id =
                    examId(item);


                const title =
                    examName(item);


                return `

                    <article class="exam-card">

                        <div class="exam-card-top">

                            <span
                                class="status-badge ${
                                    done
                                        ? "completed"
                                        : "pending"
                                }"
                            >

                                ${
                                    done
                                        ? "Completed"
                                        : "Pending"
                                }

                            </span>


                            <span class="exam-ref">

                                #${escapeHtml(
                                    id ?? "—"
                                )}

                            </span>

                        </div>


                        <h4>

                            ${escapeHtml(
                                title
                            )}

                        </h4>


                        <p>

                            ${
                                done
                                    ? `
                                        Final score:
                                        <strong>
                                            ${Number(
                                                item.score || 0
                                            ).toFixed(1)}%
                                        </strong>
                                    `
                                    : `
                                        This assessment is ready when you are.
                                    `
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
                                            type="button"
                                            class="btn-success compact-btn"
                                            onclick="startAssignedExam('${escapeJsString(id)}')"
                                        >

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


    refreshIcons();
}


// ======================================================
// RECENT ACTIVITY
// ======================================================

function renderRecent() {

    const element =
        document.getElementById(
            "recentActivity"
        );


    if (!element) {
        return;
    }


    const rows =
        studentResults.slice(
            0,
            4
        );


    if (!rows.length) {

        element.innerHTML = `

            <p class="panel-note">
                No activity yet.
            </p>
        `;

        return;
    }


    element.innerHTML =
        rows
            .map(item => {

                const done =
                    String(
                        item.status || ""
                    ).toUpperCase() ===
                    "COMPLETED";


                return `

                    <div class="activity-row">

                        <div class="activity-icon">

                            <i
                                data-lucide="${
                                    done
                                        ? "check"
                                        : "clock-3"
                                }"
                            ></i>

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

            })
            .join("");


    refreshIcons();
}


// ======================================================
// NEXT EXAM
// ======================================================

function renderNextExam() {

    const element =
        document.getElementById(
            "nextExamCard"
        );


    if (!element) {
        return;
    }


    const pending =
        studentResults.find(
            item =>
                String(
                    item.status || ""
                ).toUpperCase() !==
                "COMPLETED"
        );


    if (pending) {

        element.innerHTML = `

            <strong>

                ${escapeHtml(
                    examName(pending)
                )}

            </strong>


            <p>
                Pending assessment ready to start.
            </p>


            <button
                type="button"
                class="btn-success compact-btn"
                onclick="startAssignedExam('${escapeJsString(examId(pending))}')"
            >

                Open assessment

            </button>
        `;

    } else {

        element.innerHTML = `

            <strong>
                All caught up!
            </strong>

            <p>
                You have completed every currently assigned exam.
            </p>
        `;
    }


    refreshIcons();
}


// ======================================================
// TAB NAVIGATION
// ======================================================

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


    if (e && e.currentTarget) {

        e.currentTarget
            .classList
            .add("active");
    }


    refreshIcons();
}


// ======================================================
// START ASSIGNED EXAM
// ======================================================

function startAssignedExam(id) {

    if (
        id === undefined ||
        id === null ||
        id === "" ||
        id === "undefined" ||
        id === "null"
    ) {

        alert(
            "This exam does not have a valid exam ID."
        );

        return;
    }


    const authToken =
        sessionStorage.getItem(
            "token"
        );


    if (!authToken) {

        alert(
            "Your login session is unavailable."
        );

        return;
    }


    /*
     * Keep authentication intact.
     * Only store the requested examination.
     */

    sessionStorage.setItem(
        "requestedExamId",
        String(id)
    );


    window.location.href =
        `index.html?startExam=${encodeURIComponent(id)}`;
}


// ======================================================
// EXPLICIT STUDENT LOGOUT
// ======================================================

function confirmStudentLogout() {

    /*
     * Authentication is cleared ONLY when
     * the user deliberately presses Logout.
     */

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
        "adminToken"
    );

    sessionStorage.removeItem(
        "requestedExamId"
    );


    window.location.replace(
        "index.html"
    );
}


// ======================================================
// EXAM HELPERS
// ======================================================

function examName(item) {

    if (!item) {
        return "Exam";
    }


    return (
        item.examTitle ||
        item.exam?.title ||
        item.title ||
        `Exam #${
            item.examId ??
            item.exam?.id ??
            "—"
        }`
    );
}


function examId(item) {

    if (!item) {
        return null;
    }


    return (
        item.examId ??
        item.exam?.id ??
        item.id ??
        null
    );
}


// ======================================================
// JSON HELPER
// ======================================================

async function safeJson(res) {

    const text =
        await res.text();


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


// ======================================================
// TEXT HELPER
// ======================================================

function setText(
    id,
    value
) {

    const element =
        document.getElementById(id);


    if (element) {

        element.textContent =
            value;
    }
}


// ======================================================
// ICON HELPER
// ======================================================

function refreshIcons() {

    if (window.lucide) {

        lucide.createIcons();
    }
}


// ======================================================
// HTML ESCAPING
// ======================================================

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


// ======================================================
// JAVASCRIPT STRING ESCAPING
// ======================================================

function escapeJsString(value) {

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
