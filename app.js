/* =========================================
   PRIME MAIL
   Frontend Application
========================================= */


/* =========================================
   DEMO EMAIL DATA
========================================= */

const emails = [

  {
    id: 1,
    folder: "inbox",
    sender: "Sarah Johnson",
    email: "sarah@example.com",
    subject: "Welcome to Prime Mail",
    preview: "Thanks for joining us. Here are some things you can do...",
    date: "10:42 AM",
    unread: true,
    starred: true,
    attachment: false
  },

  {
    id: 2,
    folder: "inbox",
    sender: "Prime Security",
    email: "security@prime.example",
    subject: "Your account security",
    preview: "Your account has been successfully created...",
    date: "9:15 AM",
    unread: true,
    starred: false,
    attachment: false
  },

  {
    id: 3,
    folder: "inbox",
    sender: "Michael Brown",
    email: "michael@example.com",
    subject: "Project update",
    preview: "I have attached the latest version of the project...",
    date: "Yesterday",
    unread: true,
    starred: false,
    attachment: true
  },

  {
    id: 4,
    folder: "inbox",
    sender: "Emma Wilson",
    email: "emma@example.com",
    subject: "Meeting tomorrow",
    preview: "Are we still meeting tomorrow at 10 AM?",
    date: "Yesterday",
    unread: false,
    starred: true,
    attachment: false
  },

  {
    id: 5,
    folder: "sent",
    sender: "You",
    email: "alex@example.com",
    subject: "Re: Project update",
    preview: "Thanks Michael. I will review the files today.",
    date: "Yesterday",
    unread: false,
    starred: false,
    attachment: false
  },

  {
    id: 6,
    folder: "sent",
    sender: "You",
    email: "sarah@example.com",
    subject: "Thank you",
    preview: "Thank you for the information.",
    date: "Sep 26",
    unread: false,
    starred: false,
    attachment: false
  },

  {
    id: 7,
    folder: "spam",
    sender: "Unknown Sender",
    email: "unknown@example.com",
    subject: "You won a prize!",
    preview: "Congratulations! You have been selected...",
    date: "Sep 25",
    unread: true,
    starred: false,
    attachment: false
  }

];


/* =========================================
   APP STATE
========================================= */

let currentFolder = "inbox";

let searchTerm = "";

let composeMinimized = false;


/* =========================================
   INITIALIZATION
========================================= */

document.addEventListener("DOMContentLoaded", () => {

  loadTheme();

  updateCounts();

});


/* =========================================
   LOGIN
========================================= */

function login() {

  const email =
    document.getElementById("loginEmail").value.trim();

  const password =
    document.getElementById("loginPassword").value.trim();


  if (!email || !password) {

    showToast("Please enter your email and password.");

    return;
  }


  enterMailApp();
}


function demoLogin() {

  document.getElementById("loginEmail").value =
    "alex@example.com";

  document.getElementById("loginPassword").value =
    "demo";

  enterMailApp();

}


function enterMailApp() {

  document
    .getElementById("loginScreen")
    .classList.add("hidden");

  document
    .getElementById("signupScreen")
    .classList.add("hidden");

  document
    .getElementById("mailApp")
    .classList.remove("hidden");

  renderEmails();

  showToast("Welcome to Prime Mail.");

}


/* =========================================
   SIGNUP
========================================= */

function signup() {

  const name =
    document.getElementById("signupName").value.trim();

  const email =
    document.getElementById("signupEmail").value.trim();

  const password =
    document.getElementById("signupPassword").value.trim();


  if (!name || !email || !password) {

    showToast("Please complete all fields.");

    return;
  }


  if (password.length < 6) {

    showToast(
      "Password must contain at least 6 characters."
    );

    return;
  }


  showToast(
    "Demo account created successfully."
  );


  setTimeout(() => {

    showLogin();

    document.getElementById("loginEmail").value =
      email;

  }, 700);

}


/* =========================================
   LOGIN / SIGNUP SCREENS
========================================= */

function showSignup() {

  document
    .getElementById("loginScreen")
    .classList.add("hidden");

  document
    .getElementById("signupScreen")
    .classList.remove("hidden");

}


function showLogin() {

  document
    .getElementById("signupScreen")
    .classList.add("hidden");

  document
    .getElementById("loginScreen")
    .classList.remove("hidden");

}


function showForgotPassword() {

  showToast(
    "Password recovery will be connected to Supabase in the next version."
  );

}


/* =========================================
   LOGOUT
========================================= */

function logout() {

  document
    .getElementById("mailApp")
    .classList.add("hidden");

  document
    .getElementById("loginScreen")
    .classList.remove("hidden");

  document
    .getElementById("profileMenu")
    .classList.add("hidden");

  showToast("You have been signed out.");

}


/* =========================================
   EMAIL RENDERING
========================================= */

function renderEmails() {

  const list =
    document.getElementById("emailList");

  const empty =
    document.getElementById("emptyState");


  list.innerHTML = "";


  let filtered =
    emails.filter(email => {

      if (currentFolder === "starred") {

        return email.starred;

      }

      return email.folder === currentFolder;

    });


  if (searchTerm) {

    filtered = filtered.filter(email => {

      const content =
        `${email.sender}
         ${email.email}
         ${email.subject}
         ${email.preview}`
        .toLowerCase();

      return content.includes(
        searchTerm.toLowerCase()
      );

    });

  }


  if (filtered.length === 0) {

    empty.classList.remove("hidden");

    return;

  }


  empty.classList.add("hidden");


  filtered.forEach(email => {

    const row =
      document.createElement("div");

    row.className =
      "email-row" +
      (email.unread ? " unread" : "");

    row.dataset.id = email.id;


    row.innerHTML = `

      <input
        class="email-checkbox"
        type="checkbox"
        onclick="event.stopPropagation()"
      >

      <button
        class="star-button ${email.starred ? "starred" : ""}"
        onclick="toggleStar(event, ${email.id})"
      >
        ${email.starred ? "★" : "☆"}
      </button>

      <div
        class="email-sender"
        title="${escapeHTML(email.email)}"
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

      ${
        email.attachment
          ? `<span class="attachment-icon">📎</span>`
          : ""
      }

      <div class="email-date">
        ${escapeHTML(email.date)}
      </div>

    `;


    row.addEventListener(
      "click",
      event => {

        if (
          event.target.closest(".star-button") ||
          event.target.closest(".email-checkbox")
        ) {
          return;
        }

        openEmail(email.id);

      }
    );


    list.appendChild(row);

  });

}


/* =========================================
   FOLDERS
========================================= */

function openFolder(folder) {

  currentFolder = folder;

  searchTerm = "";

  document
    .getElementById("searchInput")
    .value = "";


  document
    .querySelectorAll(".nav-item")
    .forEach(button => {

      button.classList.remove("active");

    });


  const active =
    document.querySelector(
      `.nav-item[data-folder="${folder}"]`
    );


  if (active) {

    active.classList.add("active");

  }


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
    titles[folder] ||
    ["Mail", "Your messages"];


  document
    .getElementById("folderTitle")
    .textContent = data[0];


  document
    .getElementById("folderDescription")
    .textContent = data[1];


  renderEmails();

  closeMobileSidebar();

}


/* =========================================
   SEARCH
========================================= */

function searchMail() {

  searchTerm =
    document
      .getElementById("searchInput")
      .value
      .trim();

  renderEmails();

}


/* =========================================
   STAR
========================================= */

function toggleStar(event, id) {

  event.stopPropagation();


  const email =
    emails.find(item => item.id === id);


  if (!email) return;


  email.starred =
    !email.starred;


  renderEmails();

  showToast(
    email.starred
      ? "Added to Starred."
      : "Removed from Starred."
  );

}


/* =========================================
   OPEN EMAIL
========================================= */

function openEmail(id) {

  const email =
    emails.find(item => item.id === id);


  if (!email) return;


  email.unread = false;


  showToast(
    `Opening: ${email.subject}`
  );


  renderEmails();

}


/* =========================================
   SELECT ALL
========================================= */

function toggleSelectAll() {

  const checked =
    document.getElementById("selectAll").checked;


  document
    .querySelectorAll(".email-checkbox")
    .forEach(box => {

      box.checked = checked;

    });

}


/* =========================================
   DELETE SELECTED
========================================= */

function deleteSelected() {

  const selected =
    Array.from(
      document.querySelectorAll(
        ".email-checkbox:checked"
      )
    );


  if (selected.length === 0) {

    showToast("Select an email first.");

    return;
  }


  const ids =
    selected.map(box => {

      return Number(
        box.closest(".email-row").dataset.id
      );

    });


  ids.forEach(id => {

    const email =
      emails.find(item => item.id === id);

    if (email) {

      email.folder = "trash";

    }

  });


  document
    .getElementById("selectAll")
    .checked = false;


  updateCounts();

  renderEmails();

  showToast(
    `${ids.length} message(s) moved to Trash.`
  );

}


/* =========================================
   ARCHIVE
========================================= */

function archiveSelected() {

  const selected =
    Array.from(
      document.querySelectorAll(
        ".email-checkbox:checked"
      )
    );


  if (selected.length === 0) {

    showToast("Select an email first.");

    return;
  }


  selected.forEach(box => {

    const id =
      Number(
        box.closest(".email-row").dataset.id
      );


    const email =
      emails.find(item => item.id === id);


    if (email) {

      email.folder = "archive";

    }

  });


  renderEmails();

  showToast("Messages archived.");

}


/* =========================================
   REFRESH
========================================= */

function refreshMail() {

  showToast("Checking for new messages...");


  setTimeout(() => {

    renderEmails();

    showToast("Inbox is up to date.");

  }, 700);

}


/* =========================================
   COMPOSE
========================================= */

function openCompose() {

  const compose =
    document.getElementById("composeWindow");


  compose.classList.remove("hidden");

  composeMinimized = false;

  compose.style.height = "";


  document
    .getElementById("composeTo")
    .focus();

}


function closeCompose() {

  document
    .getElementById("composeWindow")
    .classList.add("hidden");


  document
    .getElementById("composeTo")
    .value = "";


  document
    .getElementById("composeSubject")
    .value = "";


  document
    .getElementById("composeMessage")
    .value = "";

}


function minimizeCompose() {

  const compose =
    document.getElementById("composeWindow");


  composeMinimized =
    !composeMinimized;


  if (composeMinimized) {

    compose.style.height = "45px";

  } else {

    compose.style.height = "";

  }

}


/* =========================================
   SEND EMAIL
========================================= */

function sendEmail() {

  const to =
    document
      .getElementById("composeTo")
      .value
      .trim();


  const subject =
    document
      .getElementById("composeSubject")
      .value
      .trim();


  const message =
    document
      .getElementById("composeMessage")
      .value
      .trim();


  if (!to) {

    showToast("Please enter a recipient.");

    return;

  }


  if (!subject) {

    showToast("Please enter a subject.");

    return;

  }


  if (!message) {

    showToast("Please write a message.");

    return;

  }


  emails.unshift({

    id: Date.now(),

    folder: "sent",

    sender: "You",

    email: to,

    subject: subject,

    preview: message,

    date: "Just now",

    unread: false,

    starred: false,

    attachment: false

  });


  closeCompose();


  updateCounts();

  showToast(
    "Demo message added to Sent."
  );


  if (currentFolder === "sent") {

    renderEmails();

  }

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
    document.body.classList.contains("dark");


  localStorage.setItem(
    "prime-theme",
    dark ? "dark" : "light"
  );

}


function loadTheme() {

  const theme =
    localStorage.getItem("prime-theme");


  if (theme === "dark") {

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
    .getElementById("profileMenu")
    .classList
    .toggle("hidden");

}


document.addEventListener(
  "click",
  event => {

    const menu =
      document.getElementById("profileMenu");

    const profile =
      document.querySelector(".profile-button");


    if (
      !menu.classList.contains("hidden") &&
      !menu.contains(event.target) &&
      !profile.contains(event.target)
    ) {

      menu.classList.add("hidden");

    }

  }
);


/* =========================================
   SETTINGS / ACCOUNT
========================================= */

function showSettings() {

  showToast(
    "Settings will be connected in the next version."
  );

  document
    .getElementById("profileMenu")
    .classList
    .add("hidden");

}


function showAccount() {

  showToast(
    "Account management will be connected to Supabase."
  );

}


function showNotifications() {

  showToast(
    "You have 2 new notifications."
  );

}


function addLabel() {

  showToast(
    "Custom labels will be available soon."
  );

}


/* =========================================
   MOBILE SIDEBAR
========================================= */

function toggleSidebar() {

  document
    .getElementById("sidebar")
    .classList
    .toggle("mobile-open");

}


function closeMobileSidebar() {

  document
    .getElementById("sidebar")
    .classList
    .remove("mobile-open");

}


/* =========================================
   PAGINATION DEMO
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
        email.folder === "inbox" &&
        email.unread
    ).length;


  const inboxElement =
    document.getElementById("inboxCount");


  if (inboxElement) {

    inboxElement.textContent =
      inboxCount;

  }

}


/* =========================================
   TOAST
========================================= */

let toastTimer;


function showToast(message) {

  const toast =
    document.getElementById("toast");


  const messageElement =
    document.getElementById("toastMessage");


  messageElement.textContent =
    message;


  toast.classList.remove("hidden");


  clearTimeout(toastTimer);


  toastTimer =
    setTimeout(() => {

      toast.classList.add("hidden");

    }, 2800);

}


/* =========================================
   SECURITY
   Basic HTML escaping for demo content
========================================= */

function escapeHTML(value) {

  return String(value)

    .replaceAll("&", "&amp;")

    .replaceAll("<", "&lt;")

    .replaceAll(">", "&gt;")

    .replaceAll('"', "&quot;")

    .replaceAll("'", "&#039;");

}
