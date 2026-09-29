```javascript
/* =========================================
   PRIME MAIL
   Real Supabase Authentication + Mailbox
========================================= */


/* =========================================
   SUPABASE
========================================= */

const SUPABASE_URL =
  "https://spikrkbjhsqapoqhkkqp.supabase.co";

const SUPABASE_PUBLISHABLE_KEY =
  "sb_publishable_BrRmSLwqYP0_tZLIcksRGQ_Kd6S6CtI";

const supabaseClient =
  window.supabase.createClient(
    SUPABASE_URL,
    SUPABASE_PUBLISHABLE_KEY
  );


/* =========================================
   APP STATE
========================================= */

let currentUser = null;

let currentProfile = null;

let currentFolder = "inbox";

let searchTerm = "";

let composeMinimized = false;

let emails = [];


/* =========================================
   INITIALIZATION
========================================= */

document.addEventListener(
  "DOMContentLoaded",
  async () => {

    loadTheme();

    await checkExistingSession();

    supabaseClient.auth.onAuthStateChange(
      async (event, session) => {

        if (event === "SIGNED_OUT") {

          currentUser = null;
          currentProfile = null;
          emails = [];

          showLogin();

          return;
        }

        if (session && session.user) {

          currentUser = session.user;

          await loadUserProfile();

          await enterMailApp();

        }

      }
    );

  }
);


/* =========================================
   SESSION
========================================= */

async function checkExistingSession() {

  const {
    data,
    error
  } = await supabaseClient.auth.getSession();

  if (error) {

    console.error(error);

    return;

  }

  if (data.session && data.session.user) {

    currentUser = data.session.user;

    await loadUserProfile();

    await enterMailApp();

  }

}


/* =========================================
   LOGIN
========================================= */

async function login() {

  const email =
    document
      .getElementById("loginEmail")
      .value
      .trim();

  const password =
    document
      .getElementById("loginPassword")
      .value;

  if (!email || !password) {

    showToast(
      "Please enter your email and password."
    );

    return;

  }

  setButtonLoading(
    "loginButton",
    true,
    "Signing in..."
  );

  const {
    data,
    error
  } =
    await supabaseClient.auth.signInWithPassword({
      email: email,
      password: password
    });

  setButtonLoading(
    "loginButton",
    false,
    "Sign in"
  );

  if (error) {

    showToast(
      error.message
    );

    return;

  }

  currentUser = data.user;

  await loadUserProfile();

  await enterMailApp();

}


/* =========================================
   REAL SIGNUP
========================================= */

async function signup() {

  const name =
    document
      .getElementById("signupName")
      .value
      .trim();

  const username =
    document
      .getElementById("signupUsername")
      .value
      .trim()
      .toLowerCase();

  const email =
    document
      .getElementById("signupEmail")
      .value
      .trim()
      .toLowerCase();

  const password =
    document
      .getElementById("signupPassword")
      .value;

  if (!name || !username || !email || !password) {

    showToast(
      "Please complete all fields."
    );

    return;

  }

  if (!/^[a-z0-9_]{3,30}$/.test(username)) {

    showToast(
      "Username must be 3-30 characters: letters, numbers or underscore."
    );

    return;

  }

  if (password.length < 6) {

    showToast(
      "Password must contain at least 6 characters."
    );

    return;

  }

  setButtonLoading(
    "signupButton",
    true,
    "Creating account..."
  );


  /*
    Check whether username is already used.
  */

  const {
    data: existingUsername,
    error: usernameError
  } =
    await supabaseClient
      .from("profiles")
      .select("id")
      .eq("username", username)
      .maybeSingle();


  if (usernameError) {

    setButtonLoading(
      "signupButton",
      false,
      "Create account"
    );

    showToast(
      usernameError.message
    );

    return;

  }


  if (existingUsername) {

    setButtonLoading(
      "signupButton",
      false,
      "Create account"
    );

    showToast(
      "That username is already taken."
    );

    return;

  }


  /*
    Create real Supabase Auth user.
  */

  const {
    data,
    error
  } =
    await supabaseClient.auth.signUp({

      email: email,

      password: password,

      options: {

        data: {

          full_name: name,

          username: username

        }

      }

    });


  setButtonLoading(
    "signupButton",
    false,
    "Create account"
  );


  if (error) {

    showToast(
      error.message
    );

    return;

  }


  /*
    If email confirmation is disabled,
    Supabase normally gives us a session.
  */

  if (data.session && data.user) {

    currentUser = data.user;

    await loadUserProfile();

    await enterMailApp();

    showToast(
      "Prime Mail account created successfully."
    );

    return;

  }


  /*
    If confirmation is enabled later,
    user must verify email first.
  */

  showToast(
    "Account created. Please check your email to confirm your account."
  );

  document
    .getElementById("loginEmail")
    .value = email;

  showLogin();

}


/* =========================================
   DEMO LOGIN
========================================= */

function demoLogin() {

  showToast(
    "Demo mode has been removed. Please create a real account."
  );

}


/* =========================================
   LOAD PROFILE
========================================= */

async function loadUserProfile() {

  if (!currentUser) return;


  const {
    data,
    error
  } =
    await supabaseClient
      .from("profiles")
      .select("*")
      .eq("id", currentUser.id)
      .maybeSingle();


  if (error) {

    console.error(
      "Profile error:",
      error
    );

    return;

  }


  currentProfile = data;


  if (currentProfile) {

    updateProfileUI();

  }

}


/* =========================================
   ENTER MAIL APP
========================================= */

async function enterMailApp() {

  document
    .getElementById("loginScreen")
    .classList
    .add("hidden");

  document
    .getElementById("signupScreen")
    .classList
    .add("hidden");

  document
    .getElementById("mailApp")
    .classList
    .remove("hidden");


  currentFolder = "inbox";

  searchTerm = "";


  const search =
    document.getElementById("searchInput");

  if (search) {

    search.value = "";

  }


  updateFolderHeader();

  updateProfileUI();

  await loadEmails();

}


/* =========================================
   LOAD REAL EMAILS FROM DATABASE
========================================= */

async function loadEmails() {

  if (!currentUser) {

    emails = [];

    renderEmails();

    return;

  }


  let query =
    supabaseClient
      .from("emails")
      .select("*")
      .or(
        `sender_id.eq.${currentUser.id},recipient_id.eq.${currentUser.id}`
      )
      .order(
        "created_at",
        {
          ascending: false
        }
      );


  const {
    data,
    error
  } = await query;


  if (error) {

    console.error(
      "Email loading error:",
      error
    );

    showToast(
      "Could not load mailbox."
    );

    return;

  }


  emails =
    (data || []).map(
      convertDatabaseEmail
    );


  renderEmails();

  updateCounts();

}


/* =========================================
   CONVERT DATABASE EMAIL
========================================= */

function convertDatabaseEmail(row) {

  const isSender =
    row.sender_id === currentUser.id;

  let folder =
    row.mailbox_type || "inbox";


  if (isSender && folder === "inbox") {

    folder = "sent";

  }


  return {

    id: row.id,

    folder: folder,

    sender:
      isSender
        ? "You"
        : "Prime Mail User",

    email:
      isSender
        ? (currentUser.email || "")
        : "Prime Mail User",

    subject:
      row.subject || "(No subject)",

    preview:
      row.body || "",

    body:
      row.body || "",

    date:
      formatDate(row.created_at),

    unread:
      !row.is_read && !isSender,

    starred:
      Boolean(row.is_starred),

    attachment:
      false

  };

}


/* =========================================
   FOLDER DISPLAY
========================================= */

function openFolder(folder) {

  currentFolder = folder;

  searchTerm = "";


  const search =
    document.getElementById(
      "searchInput"
    );

  if (search) {

    search.value = "";

  }


  document
    .querySelectorAll(".nav-item")
    .forEach(
      button => {

        button
          .classList
          .remove("active");

      }
    );


  const active =
    document.querySelector(
      `.nav-item[data-folder="${folder}"]`
    );


  if (active) {

    active
      .classList
      .add("active");

  }


  updateFolderHeader();

  renderEmails();

  closeMobileSidebar();

}


function updateFolderHeader() {

  const titles = {

    inbox: [
      "Inbox",
      "Your recent conversations"
    ],

    starred: [
      "Starred",
      "Messages you have starred"
    ],

    sent: [
      "Sent",
      "Messages you have sent"
    ],

    drafts: [
      "Drafts",
      "Messages waiting to be finished"
    ],

    spam: [
      "Spam",
      "Suspicious or unwanted messages"
    ],

    trash: [
      "Trash",
      "Deleted messages"
    ]

  };


  const data =
    titles[currentFolder] ||
    [
      "Mail",
      "Your messages"
    ];


  document
    .getElementById("folderTitle")
    .textContent =
      data[0];


  document
    .getElementById("folderDescription")
    .textContent =
      data[1];

}


/* =========================================
   RENDER REAL EMAILS
========================================= */

function renderEmails() {

  const list =
    document.getElementById(
      "emailList"
    );

  const empty =
    document.getElementById(
      "emptyState"
    );


  if (!list || !empty) return;


  list.innerHTML = "";


  let filtered =
    emails.filter(
      email => {

        if (
          currentFolder ===
          "starred"
        ) {

          return email.starred;

        }


        return (
          email.folder ===
          currentFolder
        );

      }
    );


  if (searchTerm) {

    filtered =
      filtered.filter(
        email => {

          const content =
            (
              email.sender +
              " " +
              email.email +
              " " +
              email.subject +
              " " +
              email.preview
            )
              .toLowerCase();


          return content.includes(
            searchTerm.toLowerCase()
          );

        }
      );

  }


  if (filtered.length === 0) {

    empty
      .classList
      .remove("hidden");

    return;

  }


  empty
    .classList
    .add("hidden");


  filtered.forEach(
    email => {

      const row =
        document.createElement(
          "div"
        );


      row.className =
        "email-row" +
        (
          email.unread
            ? " unread"
            : ""
        );


      row.dataset.id =
        email.id;


      row.innerHTML = `

        <input
          class="email-checkbox"
          type="checkbox"
          onclick="event.stopPropagation()"
        >

        <button
          class="star-button ${
            email.starred
              ? "starred"
              : ""
          }"
          onclick="toggleStar(event, '${escapeAttribute(email.id)}')"
        >
          ${
            email.starred
              ? "★"
              : "☆"
          }
        </button>

        <div
          class="email-sender"
          title="${escapeAttribute(email.email)}"
        >
          ${escapeHTML(email.sender)}
        </div>

        <div class="email-main">

          <span class="email-subject">
            ${escapeHTML(email.subject)}
          </span>

          <span> — </span>

          <span class="email-preview">
            ${escapeHTML(email.preview)}
          </span>

        </div>

        <div class="email-date">
          ${escapeHTML(email.date)}
        </div>

      `;


      row.addEventListener(
        "click",
        event => {

          if (
            event.target.closest(
              ".star-button"
            ) ||
            event.target.closest(
              ".email-checkbox"
            )
          ) {

            return;

          }


          openEmail(email.id);

        }
      );


      list.appendChild(row);

    }
  );

}


/* =========================================
   SEARCH
========================================= */

function searchMail() {

  searchTerm =
    document
      .getElementById(
        "searchInput"
      )
      .value
      .trim();


  renderEmails();

}


/* =========================================
   OPEN EMAIL
========================================= */

async function openEmail(id) {

  const email =
    emails.find(
      item =>
        item.id === id
    );


  if (!email) return;


  if (
    email.unread &&
    currentUser
  ) {

    await supabaseClient
      .from("emails")
      .update({
        is_read: true
      })
      .eq("id", id)
      .eq(
        "recipient_id",
        currentUser.id
      );


    email.unread = false;

  }


  showToast(
    email.subject
  );


  renderEmails();

}


/* =========================================
   STAR
========================================= */

async function toggleStar(
  event,
  id
) {

  event.stopPropagation();


  const email =
    emails.find(
      item =>
        item.id === id
    );


  if (!email) return;


  const newValue =
    !email.starred;


  const {
    error
  } =
    await supabaseClient
      .from("emails")
      .update({
        is_starred: newValue
      })
      .eq("id", id);


  if (error) {

    showToast(
      error.message
    );

    return;

  }


  email.starred =
    newValue;


  renderEmails();

}


/* =========================================
   SELECT ALL
========================================= */

function toggleSelectAll() {

  const master =
    document.getElementById(
      "selectAll"
    );


  if (!master) return;


  document
    .querySelectorAll(
      ".email-checkbox"
    )
    .forEach(
      box => {

        box.checked =
          master.checked;

      }
    );

}


/* =========================================
   DELETE SELECTED
========================================= */

async function deleteSelected() {

  const selected =
    Array.from(
      document.querySelectorAll(
        ".email-checkbox:checked"
      )
    );


  if (
    selected.length === 0
  ) {

    showToast(
      "Select an email first."
    );

    return;

  }


  const ids =
    selected.map(
      box =>
        box
          .closest(".email-row")
          .dataset.id
    );


  for (
    const id of ids
  ) {

    await supabaseClient
      .from("emails")
      .update({
        mailbox_type: "trash"
      })
      .eq("id", id);

  }


  const master =
    document.getElementById(
      "selectAll"
    );

  if (master) {

    master.checked =
      false;

  }


  await loadEmails();

  showToast(
    "Message(s) moved to Trash."
  );

}


/* =========================================
   ARCHIVE
========================================= */

async function archiveSelected() {

  const selected =
    Array.from(
      document.querySelectorAll(
        ".email-checkbox:checked"
      )
    );


  if (
    selected.length === 0
  ) {

    showToast(
      "Select an email first."
    );

    return;

  }


  const ids =
    selected.map(
      box =>
        box
          .closest(".email-row")
          .dataset.id
    );


  for (
    const id of ids
  ) {

    await supabaseClient
      .from("emails")
      .update({
        mailbox_type: "archive"
      })
      .eq("id", id);

  }


  await loadEmails();

  showToast(
    "Messages archived."
  );

}


/* =========================================
   REFRESH
========================================= */

async function refreshMail() {

  showToast(
    "Checking for new messages..."
  );


  await loadEmails();


  showToast(
    "Mailbox is up to date."
  );

}


/* =========================================
   COMPOSE
========================================= */

function openCompose() {

  const compose =
    document.getElementById(
      "composeWindow"
    );


  compose
    .classList
    .remove("hidden");


  composeMinimized =
    false;


  compose.style.height =
    "";


  document
    .getElementById(
      "composeTo"
    )
    .focus();

}


function closeCompose() {

  document
    .getElementById(
      "composeWindow"
    )
    .classList
    .add("hidden");


  document
    .getElementById(
      "composeTo"
    )
    .value = "";


  document
    .getElementById(
      "composeSubject"
    )
    .value = "";


  document
    .getElementById(
      "composeMessage"
    )
    .value = "";

}


function minimizeCompose() {

  const compose =
    document.getElementById(
      "composeWindow"
    );


  composeMinimized =
    !composeMinimized;


  if (
    composeMinimized
  ) {

    compose.style.height =
      "45px";

  } else {

    compose.style.height =
      "";

  }

}


/* =========================================
   SEND
========================================= */

async function sendEmail() {

  if (!currentUser) {

    showToast(
      "Please sign in first."
    );

    return;

  }


  const to =
    document
      .getElementById(
        "composeTo"
      )
      .value
      .trim();


  const subject =
    document
      .getElementById(
        "composeSubject"
      )
      .value
      .trim();


  const message =
    document
      .getElementById(
        "composeMessage"
      )
      .value
      .trim();


  if (!to) {

    showToast(
      "Please enter a recipient."
    );

    return;

  }


  if (!subject) {

    showToast(
      "Please enter a subject."
    );

    return;

  }


  if (!message) {

    showToast(
      "Please write a message."
    );

    return;

  }


  /*
    IMPORTANT:
    At this stage the database can store
    emails between known Prime Mail users,
    but we have not yet built the public
    email-address delivery system.
  */

  showToast(
    "Real external email sending is not connected yet."
  );

}


/* =========================================
   PROFILE UI
========================================= */

function updateProfileUI() {

  if (!currentUser) return;


  const fullName =
    (
      currentProfile &&
      currentProfile.full_name
    ) ||
    currentUser
      .user_metadata
      ?.full_name ||
    "Prime Mail User";


  const username =
    (
      currentProfile &&
      currentProfile.username
    ) ||
    currentUser
      .user_metadata
      ?.username ||
    "user";


  const email =
    currentUser.email ||
    "";


  const initial =
    fullName
      .charAt(0)
      .toUpperCase() ||
    "P";


  const profileName =
    document.getElementById(
      "profileName"
    );

  const profileFullName =
    document.getElementById(
      "profileFullName"
    );

  const profileEmail =
    document.getElementById(
      "profileEmail"
    );

  const profileUsername =
    document.getElementById(
      "profileUsername"
    );

  const avatar =
    document.getElementById(
      "profileAvatar"
    );

  const largeAvatar =
    document.getElementById(
      "profileLargeAvatar"
    );


  if (profileName) {

    profileName.textContent =
      fullName;

  }


  if (profileFullName) {

    profileFullName.textContent =
      fullName;

  }


  if (profileEmail) {

    profileEmail.textContent =
      email;

  }


  if (profileUsername) {

    profileUsername.textContent =
      "@" + username;

  }


  if (avatar) {

    avatar.textContent =
      initial;

  }


  if (largeAvatar) {

    largeAvatar.textContent =
      initial;

  }

}


/* =========================================
   LOGOUT
========================================= */

async function logout() {

  const {
    error
  } =
    await supabaseClient
      .auth
      .signOut();


  if (error) {

    showToast(
      error.message
    );

    return;

  }


  currentUser = null;

  currentProfile = null;

  emails = [];

  showLogin();

  showToast(
    "You have been signed out."
  );

}


/* =========================================
   LOGIN / SIGNUP SCREENS
========================================= */

function showSignup() {

  document
    .getElementById(
      "loginScreen"
    )
    .classList
    .add("hidden");


  document
    .getElementById(
      "signupScreen"
    )
    .classList
    .remove("hidden");

}


function showLogin() {

  document
    .getElementById(
      "signupScreen"
    )
    .classList
    .add("hidden");


  document
    .getElementById(
      "mailApp"
    )
    .classList
    .add("hidden");


  document
    .getElementById(
      "loginScreen"
    )
    .classList
    .remove("hidden");

}


/* =========================================
   PASSWORD RESET
========================================= */

async function showForgotPassword() {

  const email =
    document
      .getElementById(
        "loginEmail"
      )
      .value
      .trim();


  if (!email) {

    showToast(
      "Enter your email first."
    );

    return;

  }


  const redirectUrl =
    window.location.origin +
    window.location.pathname;


  const {
    error
  } =
    await supabaseClient
      .auth
      .resetPasswordForEmail(
        email,
        {
          redirectTo:
            redirectUrl
        }
      );


  if (error) {

    showToast(
      error.message
    );

    return;

  }


  showToast(
    "Password reset email sent."
  );

}


/* =========================================
   THEME
========================================= */

function toggleTheme() {

  document
    .body
    .classList
    .toggle("dark");


  const dark =
    document
      .body
      .classList
      .contains("dark");


  localStorage.setItem(
    "prime-theme",
    dark
      ? "dark"
      : "light"
  );

}


function loadTheme() {

  const theme =
    localStorage.getItem(
      "prime-theme"
    );


  if (
    theme === "dark"
  ) {

    document
      .body
      .classList
      .add("dark");

  }

}


/* =========================================
   PROFILE MENU
========================================= */

function toggleProfileMenu() {

  document
    .getElementById(
      "profileMenu"
    )
    .classList
    .toggle("hidden");

}


document.addEventListener(
  "click",
  event => {

    const menu =
      document.getElementById(
        "profileMenu"
      );

    const profile =
      document.querySelector(
        ".profile-button"
      );


    if (
      menu &&
      profile &&
      !menu.classList.contains(
        "hidden"
      ) &&
      !menu.contains(
        event.target
      ) &&
      !profile.contains(
        event.target
      )
    ) {

      menu
        .classList
        .add("hidden");

    }

  }
);


/* =========================================
   SETTINGS / ACCOUNT
========================================= */

function showSettings() {

  showToast(
    "Settings will be connected next."
  );


  document
    .getElementById(
      "profileMenu"
    )
    .classList
    .add("hidden");

}


function showAccount() {

  showToast(
    currentProfile &&
    currentProfile.username
      ? "Username: @" +
        currentProfile.username
      : "Account loaded."
  );

}


function showNotifications() {

  showToast(
    "Notifications will be connected next."
  );

}


function addLabel() {

  showToast(
    "Custom labels will be added later."
  );

}


/* =========================================
   MOBILE SIDEBAR
========================================= */

function toggleSidebar() {

  document
    .getElementById(
      "sidebar"
    )
    .classList
    .toggle(
      "mobile-open"
    );

}


function closeMobileSidebar() {

  document
    .getElementById(
      "sidebar"
    )
    .classList
    .remove(
      "mobile-open"
    );

}


/* =========================================
   PAGINATION
========================================= */

function previousPage() {

  showToast(
    "You are already on the first page."
  );

}


function nextPage() {

  showToast(
    "No more messages."
  );

}


/* =========================================
   COUNTS
========================================= */

function updateCounts() {

  const inboxCount =
    emails.filter(
      email =>
        email.folder ===
          "inbox" &&
        email.unread
    ).length;


  const draftCount =
    emails.filter(
      email =>
        email.folder ===
        "drafts"
    ).length;


  const inboxElement =
    document.getElementById(
      "inboxCount"
    );


  const draftElement =
    document.getElementById(
      "draftCount"
    );


  if (inboxElement) {

    inboxElement.textContent =
      inboxCount;

  }


  if (draftElement) {

    draftElement.textContent =
      draftCount;

  }

}


/* =========================================
   DATE
========================================= */

function formatDate(value) {

  if (!value) {

    return "";

  }


  const date =
    new Date(value);


  if (
    Number.isNaN(
      date.getTime()
    )
  ) {

    return "";

  }


  return date.toLocaleString(
    undefined,
    {
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit"
    }
  );

}


/* =========================================
   BUTTON LOADING
========================================= */

function setButtonLoading(
  id,
  loading,
  text
) {

  const button =
    document.getElementById(
      id
    );


  if (!button) return;


  button.disabled =
    loading;


  button.textContent =
    text;

}


/* =========================================
   TOAST
========================================= */

let toastTimer;


function showToast(message) {

  const toast =
    document.getElementById(
      "toast"
    );

  const messageElement =
    document.getElementById(
      "toastMessage"
    );


  if (!toast || !messageElement) {

    alert(message);

    return;

  }


  messageElement.textContent =
    message;


  toast
    .classList
    .remove("hidden");


  clearTimeout(
    toastTimer
  );


  toastTimer =
    setTimeout(
      () => {

        toast
          .classList
          .add("hidden");

      },
      3000
    );

}


/* =========================================
   SECURITY
========================================= */

function escapeHTML(value) {

  return String(value)

    .replaceAll(
      "&",
      "&amp;"
    )

    .replaceAll(
      "<",
      "&lt;"
    )

    .replaceAll(
      ">",
      "&gt;"
    )

    .replaceAll(
      '"',
      "&quot;"
    )

    .replaceAll(
      "'",
      "&#039;"
    );

}


function escapeAttribute(value) {

  return escapeHTML(
    value
  );

}
```
