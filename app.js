/* =========================================================
   PRIME MAIL
   Real Supabase Authentication + Mailbox
   Clean version
========================================================= */


/* =========================================================
   SUPABASE
========================================================= */

const SUPABASE_URL =
  "https://spikrkbjhsqapoqhkkqp.supabase.co";

const SUPABASE_PUBLISHABLE_KEY =
  "sb_publishable_BrRmSLwqYP0_tZLIcksRGQ_Kd6S6CtI";


let supabaseClient = null;


/* =========================================================
   APP STATE
========================================================= */

let currentUser = null;
let currentProfile = null;

let currentFolder = "inbox";
let searchTerm = "";

let composeMinimized = false;

let emails = [];

let toastTimer = null;


/* =========================================================
   START SUPABASE
========================================================= */

function initializeSupabase() {

  if (!window.supabase) {

    console.error(
      "Supabase library was not loaded."
    );

    return false;
  }

  try {

    supabaseClient =
      window.supabase.createClient(
        SUPABASE_URL,
        SUPABASE_PUBLISHABLE_KEY
      );

    return true;

  } catch (error) {

    console.error(
      "Supabase initialization error:",
      error
    );

    return false;
  }
}


/* =========================================================
   INITIALIZATION
========================================================= */

document.addEventListener(
  "DOMContentLoaded",
  async function () {

    loadTheme();

    const ready =
      initializeSupabase();

    if (!ready) {

      showToast(
        "Prime Mail could not connect to Supabase."
      );

      return;
    }

    await checkExistingSession();


    supabaseClient.auth.onAuthStateChange(
      async function (event, session) {

        if (event === "SIGNED_OUT") {

          currentUser = null;
          currentProfile = null;
          emails = [];

          showLogin();

          return;
        }


        if (
          session &&
          session.user
        ) {

          currentUser =
            session.user;

          await loadUserProfile();

          await enterMailApp();
        }

      }
    );

  }
);


/* =========================================================
   EXISTING SESSION
========================================================= */

async function checkExistingSession() {

  if (!supabaseClient) {
    return;
  }


  const result =
    await supabaseClient.auth.getSession();


  if (result.error) {

    console.error(
      "Session error:",
      result.error
    );

    return;
  }


  const session =
    result.data.session;


  if (
    session &&
    session.user
  ) {

    currentUser =
      session.user;

    await loadUserProfile();

    await enterMailApp();
  }

}


/* =========================================================
   LOGIN
========================================================= */

async function login() {

  if (!supabaseClient) {

    showToast(
      "Supabase is not connected."
    );

    return;
  }


  const identifierInput =
    document.getElementById(
      "loginEmail"
    );

  const passwordInput =
    document.getElementById(
      "loginPassword"
    );


  const identifier =
    identifierInput
      ? identifierInput.value.trim().toLowerCase()
      : "";

  const password =
    passwordInput
      ? passwordInput.value
      : "";


  if (
    !identifier ||
    !password
  ) {

    showToast(
      "Please enter your username/email and password."
    );

    return;
  }


  /*
    If the user enters only a username,
    convert it to the internal Prime Mail
    Supabase Auth email.
  */

  let authEmail =
    identifier;


  if (
    !identifier.includes("@")
  ) {

    authEmail =
      identifier +
      "@prime-mail.primemail.workers.dev";

  }


  setButtonLoading(
    "loginButton",
    true,
    "Signing in..."
  );


  try {

    const result =
      await supabaseClient.auth.signInWithPassword({

        email:
          authEmail,

        password:
          password

      });


    setButtonLoading(
      "loginButton",
      false,
      "Sign in"
    );


    if (result.error) {

      console.error(
        "Login error:",
        result.error
      );

      showToast(
        "Invalid username/email or password."
      );

      return;
    }


    currentUser =
      result.data.user;


    await loadUserProfile();

    await enterMailApp();


    showToast(
      "Welcome to Prime Mail."
    );


  } catch (error) {

    setButtonLoading(
      "loginButton",
      false,
      "Sign in"
    );


    console.error(
      "Unexpected login error:",
      error
    );


    showToast(
      "Login failed. Please try again."
    );

  }

}

/* =========================================================
   SIGNUP
========================================================= */

async function signup() {

  if (!supabaseClient) {

    showToast(
      "Supabase is not connected."
    );

    return;
  }


  const nameInput =
    document.getElementById(
      "signupName"
    );

  const usernameInput =
    document.getElementById(
      "signupUsername"
    );

  const passwordInput =
    document.getElementById(
      "signupPassword"
    );


  const name =
    nameInput
      ? nameInput.value.trim()
      : "";

  const username =
    usernameInput
      ? usernameInput.value.trim().toLowerCase()
      : "";

  const password =
    passwordInput
      ? passwordInput.value
      : "";


  if (
    !name ||
    !username ||
    !password
  ) {

    showToast(
      "Please complete all fields."
    );

    return;
  }


  if (
    !/^[a-z0-9_]{3,30}$/.test(
      username
    )
  ) {

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


  try {

    /*
      Prime Mail internal Auth identity.

      This is used by Supabase Auth internally.
      It is NOT a real public Internet email address.
    */

    const authEmail =
      username +
      "@prime-mail.primemail.workers.dev";


    const signupResult =
      await supabaseClient.auth.signUp({

        email: authEmail,

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


    if (signupResult.error) {

      console.error(
        "Signup error:",
        signupResult.error
      );


      const errorMessage =
        signupResult.error.message ||
        "";


      if (
        errorMessage
          .toLowerCase()
          .includes(
            "already registered"
          )
      ) {

        showToast(
          "That username is already taken."
        );

      } else {

        showToast(
          errorMessage
        );

      }

      return;
    }


    const newUser =
      signupResult.data.user;

    const newSession =
      signupResult.data.session;


    if (
      newUser &&
      newSession
    ) {

      currentUser =
        newUser;

      await loadUserProfile();

      await enterMailApp();

      showToast(
        "Prime Mail account created successfully."
      );

      return;
    }


    /*
      This can happen when email confirmation
      is enabled in Supabase.
    */

    showToast(
      "Account created. Please sign in."
    );


    const loginEmail =
      document.getElementById(
        "loginEmail"
      );


    if (loginEmail) {

      loginEmail.value =
        username;
    }


    showLogin();


  } catch (error) {

    setButtonLoading(
      "signupButton",
      false,
      "Create account"
    );


    console.error(
      "Unexpected signup error:",
      error
    );


    showToast(
      "Account creation failed. Please try again."
    );

  }

}

/* =========================================================
   DEMO BUTTON
========================================================= */

function demoLogin() {

  showToast(
    "Demo mode is disabled. Please create a real Prime Mail account."
  );

}


/* =========================================================
   LOAD PROFILE
========================================================= */

async function loadUserProfile() {

  if (
    !currentUser ||
    !supabaseClient
  ) {

    return;
  }


  const result =
    await supabaseClient
      .from("profiles")
      .select("*")
      .eq(
        "id",
        currentUser.id
      )
      .maybeSingle();


  if (result.error) {

    console.error(
      "Profile loading error:",
      result.error
    );

    return;
  }


  currentProfile =
    result.data;


  updateProfileUI();

}


/* =========================================================
   ENTER MAIL APP
========================================================= */

async function enterMailApp() {

  const loginScreen =
    document.getElementById(
      "loginScreen"
    );

  const signupScreen =
    document.getElementById(
      "signupScreen"
    );

  const mailApp =
    document.getElementById(
      "mailApp"
    );


  if (loginScreen) {

    loginScreen
      .classList
      .add("hidden");
  }


  if (signupScreen) {

    signupScreen
      .classList
      .add("hidden");
  }


  if (mailApp) {

    mailApp
      .classList
      .remove("hidden");
  }


  currentFolder =
    "inbox";

  searchTerm =
    "";


  const searchInput =
    document.getElementById(
      "searchInput"
    );


  if (searchInput) {

    searchInput.value =
      "";
  }


  updateFolderHeader();

  updateProfileUI();

  await loadEmails();

}


/* =========================================================
   LOAD EMAILS
========================================================= */

async function loadEmails() {

  if (
    !currentUser ||
    !supabaseClient
  ) {

    emails = [];

    renderEmails();

    return;
  }


  /*
    IMPORTANT:
    No template literal is used here.
    This avoids the syntax problem from the
    previous deployed app.js.
  */

  const filter =
    "sender_id.eq." +
    currentUser.id +
    ",recipient_id.eq." +
    currentUser.id;


  const result =
    await supabaseClient
      .from("emails")
      .select("*")
      .or(filter)
      .order(
        "created_at",
        {
          ascending: false
        }
      );


  if (result.error) {

    console.error(
      "Email loading error:",
      result.error
    );

    showToast(
      "Could not load mailbox."
    );

    return;
  }


  emails =
    (result.data || []).map(
      convertDatabaseEmail
    );


  renderEmails();

  updateCounts();

}


/* =========================================================
   CONVERT DATABASE EMAIL
========================================================= */

function convertDatabaseEmail(
  row
) {

  const isSender =
    row.sender_id ===
    currentUser.id;


  let folder =
    row.mailbox_type ||
    "inbox";


  if (
    isSender &&
    folder === "inbox"
  ) {

    folder =
      "sent";
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
        ? (
            currentUser.email ||
            ""
          )
        : "Prime Mail User",

    subject:
      row.subject ||
      "(No subject)",

    preview:
      row.body ||
      "",

    body:
      row.body ||
      "",

    date:
      formatDate(
        row.created_at
      ),

    unread:
      !row.is_read &&
      !isSender,

    starred:
      Boolean(
        row.is_starred
      ),

    attachment:
      false
  };

}


/* =========================================================
   OPEN FOLDER
========================================================= */

function openFolder(
  folder
) {

  currentFolder =
    folder;

  searchTerm =
    "";


  const searchInput =
    document.getElementById(
      "searchInput"
    );


  if (searchInput) {

    searchInput.value =
      "";
  }


  document
    .querySelectorAll(
      ".nav-item"
    )
    .forEach(
      function (button) {

        button
          .classList
          .remove("active");

      }
    );


  document
    .querySelectorAll(
      ".nav-item"
    )
    .forEach(
      function (button) {

        if (
          button.dataset.folder ===
          folder
        ) {

          button
            .classList
            .add("active");
        }

      }
    );


  updateFolderHeader();

  renderEmails();

  closeMobileSidebar();

}


/* =========================================================
   FOLDER HEADER
========================================================= */

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
    ],

    archive: [
      "Archive",
      "Archived messages"
    ]

  };


  const data =
    titles[currentFolder] ||
    [
      "Mail",
      "Your messages"
    ];


  const title =
    document.getElementById(
      "folderTitle"
    );

  const description =
    document.getElementById(
      "folderDescription"
    );


  if (title) {

    title.textContent =
      data[0];
  }


  if (description) {

    description.textContent =
      data[1];
  }

}


/* =========================================================
   RENDER EMAILS
========================================================= */

function renderEmails() {

  const list =
    document.getElementById(
      "emailList"
    );

  const empty =
    document.getElementById(
      "emptyState"
    );


  if (
    !list ||
    !empty
  ) {

    return;
  }


  list.innerHTML =
    "";


  let filtered =
    emails.filter(
      function (email) {

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
        function (email) {

          const content =
            (
              email.sender +
              " " +
              email.email +
              " " +
              email.subject +
              " " +
              email.preview
            ).toLowerCase();


          return content.indexOf(
            searchTerm.toLowerCase()
          ) !== -1;

        }
      );
  }


  if (
    filtered.length ===
    0
  ) {

    empty
      .classList
      .remove("hidden");

    return;
  }


  empty
    .classList
    .add("hidden");


  filtered.forEach(
    function (email) {

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


      const checkbox =
        document.createElement(
          "input"
        );

      checkbox.type =
        "checkbox";

      checkbox.className =
        "email-checkbox";


      checkbox.addEventListener(
        "click",
        function (event) {

          event.stopPropagation();

        }
      );


      const star =
        document.createElement(
          "button"
        );

      star.className =
        "star-button" +
        (
          email.starred
            ? " starred"
            : ""
        );

      star.textContent =
        email.starred
          ? "★"
          : "☆";


      star.addEventListener(
        "click",
        function (event) {

          toggleStar(
            event,
            email.id
          );

        }
      );


      const sender =
        document.createElement(
          "div"
        );

      sender.className =
        "email-sender";

      sender.title =
        email.email;

      sender.textContent =
        email.sender;


      const main =
        document.createElement(
          "div"
        );

      main.className =
        "email-main";


      const subject =
        document.createElement(
          "span"
        );

      subject.className =
        "email-subject";

      subject.textContent =
        email.subject;


      const separator =
        document.createTextNode(
          " — "
        );


      const preview =
        document.createElement(
          "span"
        );

      preview.className =
        "email-preview";

      preview.textContent =
        email.preview;


      main.appendChild(
        subject
      );

      main.appendChild(
        separator
      );

      main.appendChild(
        preview
      );


      const date =
        document.createElement(
          "div"
        );

      date.className =
        "email-date";

      date.textContent =
        email.date;


      row.appendChild(
        checkbox
      );

      row.appendChild(
        star
      );

      row.appendChild(
        sender
      );

      row.appendChild(
        main
      );

      row.appendChild(
        date
      );


      row.addEventListener(
        "click",
        function (event) {

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


          openEmail(
            email.id
          );

        }
      );


      list.appendChild(
        row
      );

    }
  );

}


/* =========================================================
   SEARCH
========================================================= */

function searchMail() {

  const input =
    document.getElementById(
      "searchInput"
    );


  searchTerm =
    input
      ? input.value.trim()
      : "";


  renderEmails();

}


/* =========================================================
   OPEN EMAIL
========================================================= */

async function openEmail(
  id
) {

  const email =
    emails.find(
      function (item) {

        return item.id === id;

      }
    );


  if (!email) {
    return;
  }


  if (
    email.unread &&
    currentUser
  ) {

    const result =
      await supabaseClient
        .from("emails")
        .update({
          is_read: true
        })
        .eq(
          "id",
          id
        )
        .eq(
          "recipient_id",
          currentUser.id
        );


    if (result.error) {

      console.error(
        result.error
      );
    }


    email.unread =
      false;
  }


  /*
    Current HTML does not contain a
    full message viewer, so show the
    subject for now.
  */

  showToast(
    email.subject
  );


  renderEmails();

}


/* =========================================================
   STAR
========================================================= */

async function toggleStar(
  event,
  id
) {

  if (event) {

    event.stopPropagation();
  }


  const email =
    emails.find(
      function (item) {

        return item.id === id;

      }
    );


  if (!email) {
    return;
  }


  const newValue =
    !email.starred;


  const result =
    await supabaseClient
      .from("emails")
      .update({
        is_starred:
          newValue
      })
      .eq(
        "id",
        id
      );


  if (result.error) {

    showToast(
      result.error.message
    );

    return;
  }


  email.starred =
    newValue;


  renderEmails();

}


/* =========================================================
   SELECT ALL
========================================================= */

function toggleSelectAll() {

  const master =
    document.getElementById(
      "selectAll"
    );


  if (!master) {
    return;
  }


  document
    .querySelectorAll(
      ".email-checkbox"
    )
    .forEach(
      function (box) {

        box.checked =
          master.checked;

      }
    );

}


/* =========================================================
   DELETE SELECTED
========================================================= */

async function deleteSelected() {

  const selected =
    Array.from(
      document.querySelectorAll(
        ".email-checkbox:checked"
      )
    );


  if (
    selected.length ===
    0
  ) {

    showToast(
      "Select an email first."
    );

    return;
  }


  for (
    let i = 0;
    i < selected.length;
    i++
  ) {

    const row =
      selected[i]
        .closest(
          ".email-row"
        );


    if (!row) {
      continue;
    }


    const id =
      row.dataset.id;


    await supabaseClient
      .from("emails")
      .update({
        mailbox_type:
          "trash"
      })
      .eq(
        "id",
        id
      );
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


/* =========================================================
   ARCHIVE
========================================================= */

async function archiveSelected() {

  const selected =
    Array.from(
      document.querySelectorAll(
        ".email-checkbox:checked"
      )
    );


  if (
    selected.length ===
    0
  ) {

    showToast(
      "Select an email first."
    );

    return;
  }


  for (
    let i = 0;
    i < selected.length;
    i++
  ) {

    const row =
      selected[i]
        .closest(
          ".email-row"
        );


    if (!row) {
      continue;
    }


    const id =
      row.dataset.id;


    await supabaseClient
      .from("emails")
      .update({
        mailbox_type:
          "archive"
      })
      .eq(
        "id",
        id
      );
  }


  await loadEmails();


  showToast(
    "Messages archived."
  );

}


/* =========================================================
   REFRESH
========================================================= */

async function refreshMail() {

  showToast(
    "Checking for new messages..."
  );


  await loadEmails();


  showToast(
    "Mailbox is up to date."
  );

}


/* =========================================================
   COMPOSE
========================================================= */

function openCompose() {

  const compose =
    document.getElementById(
      "composeWindow"
    );


  if (!compose) {
    return;
  }


  compose
    .classList
    .remove("hidden");


  composeMinimized =
    false;


  compose.style.height =
    "";


  const to =
    document.getElementById(
      "composeTo"
    );


  if (to) {
    to.focus();
  }

}


function closeCompose() {

  const compose =
    document.getElementById(
      "composeWindow"
    );


  if (compose) {

    compose
      .classList
      .add("hidden");
  }


  const to =
    document.getElementById(
      "composeTo"
    );

  const subject =
    document.getElementById(
      "composeSubject"
    );

  const message =
    document.getElementById(
      "composeMessage"
    );


  if (to) {
    to.value = "";
  }

  if (subject) {
    subject.value = "";
  }

  if (message) {
    message.value = "";
  }

}


function minimizeCompose() {

  const compose =
    document.getElementById(
      "composeWindow"
    );


  if (!compose) {
    return;
  }


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


/* =========================================================
   SEND EMAIL
========================================================= */

async function sendEmail() {

  if (!currentUser) {

    showToast(
      "Please sign in first."
    );

    return;
  }


  const toInput =
    document.getElementById(
      "composeTo"
    );

  const subjectInput =
    document.getElementById(
      "composeSubject"
    );

  const messageInput =
    document.getElementById(
      "composeMessage"
    );


  const to =
    toInput
      ? toInput.value.trim()
      : "";

  const subject =
    subjectInput
      ? subjectInput.value.trim()
      : "";

  const message =
    messageInput
      ? messageInput.value.trim()
      : "";


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
    IMPORTANT

    Public Gmail/Yahoo/etc. sending is not
    connected yet.

    The current database has sender_id and
    recipient_id, so a proper Prime Mail
    internal messaging system can be connected
    once recipient lookup is added.
  */

  showToast(
    "Email sending will be connected next."
  );

}


/* =========================================================
   PROFILE UI
========================================================= */

function updateProfileUI() {

  if (!currentUser) {
    return;
  }


  let fullName =
    "Prime Mail User";


  let username =
    "user";


  if (
    currentProfile &&
    currentProfile.full_name
  ) {

    fullName =
      currentProfile.full_name;

  } else if (
    currentUser.user_metadata &&
    currentUser.user_metadata.full_name
  ) {

    fullName =
      currentUser.user_metadata.full_name;
  }


  if (
    currentProfile &&
    currentProfile.username
  ) {

    username =
      currentProfile.username;

  } else if (
    currentUser.user_metadata &&
    currentUser.user_metadata.username
  ) {

    username =
      currentUser.user_metadata.username;
  }


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


/* =========================================================
   LOGOUT
========================================================= */

async function logout() {

  if (!supabaseClient) {
    return;
  }


  const result =
    await supabaseClient.auth.signOut();


  if (result.error) {

    showToast(
      result.error.message
    );

    return;
  }


  currentUser =
    null;

  currentProfile =
    null;

  emails =
    [];


  showLogin();


  showToast(
    "You have been signed out."
  );

}


/* =========================================================
   SHOW SIGNUP
========================================================= */

function showSignup() {

  const loginScreen =
    document.getElementById(
      "loginScreen"
    );

  const signupScreen =
    document.getElementById(
      "signupScreen"
    );

  const mailApp =
    document.getElementById(
      "mailApp"
    );


  if (mailApp) {

    mailApp
      .classList
      .add("hidden");
  }


  if (loginScreen) {

    loginScreen
      .classList
      .add("hidden");
  }


  if (signupScreen) {

    signupScreen
      .classList
      .remove("hidden");
  }

}


/* =========================================================
   SHOW LOGIN
========================================================= */

function showLogin() {

  const loginScreen =
    document.getElementById(
      "loginScreen"
    );

  const signupScreen =
    document.getElementById(
      "signupScreen"
    );

  const mailApp =
    document.getElementById(
      "mailApp"
    );


  if (signupScreen) {

    signupScreen
      .classList
      .add("hidden");
  }


  if (mailApp) {

    mailApp
      .classList
      .add("hidden");
  }


  if (loginScreen) {

    loginScreen
      .classList
      .remove("hidden");
  }

}


/* =========================================================
   FORGOT PASSWORD
========================================================= */

async function showForgotPassword() {

  if (!supabaseClient) {

    showToast(
      "Supabase is not connected."
    );

    return;
  }


  const input =
    document.getElementById(
      "loginEmail"
    );


  const email =
    input
      ? input.value.trim()
      : "";


  if (!email) {

    showToast(
      "Enter your email first."
    );

    return;
  }


  const redirectUrl =
    window.location.origin +
    window.location.pathname;


  const result =
    await supabaseClient.auth.resetPasswordForEmail(
      email,
      {
        redirectTo:
          redirectUrl
      }
    );


  if (result.error) {

    showToast(
      result.error.message
    );

    return;
  }


  showToast(
    "Password reset email sent."
  );

}


/* =========================================================
   THEME
========================================================= */

function toggleTheme() {

  document
    .body
    .classList
    .toggle(
      "dark"
    );


  const dark =
    document
      .body
      .classList
      .contains(
        "dark"
      );


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
    theme ===
    "dark"
  ) {

    document
      .body
      .classList
      .add(
        "dark"
      );
  }

}


/* =========================================================
   PROFILE MENU
========================================================= */

function toggleProfileMenu() {

  const menu =
    document.getElementById(
      "profileMenu"
    );


  if (!menu) {
    return;
  }


  menu
    .classList
    .toggle(
      "hidden"
    );

}


document.addEventListener(
  "click",
  function (event) {

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
        .add(
          "hidden"
        );
    }

  }
);


/* =========================================================
   SETTINGS
========================================================= */

function showSettings() {

  showToast(
    "Settings will be connected next."
  );


  const menu =
    document.getElementById(
      "profileMenu"
    );


  if (menu) {

    menu
      .classList
      .add(
        "hidden"
      );
  }

}


function showAccount() {

  let message =
    "Account loaded.";


  if (
    currentProfile &&
    currentProfile.username
  ) {

    message =
      "Username: @" +
      currentProfile.username;
  }


  showToast(
    message
  );

}


function showNotifications() {

  showToast(
    "No new notifications."
  );

}


function addLabel() {

  showToast(
    "Custom labels will be added later."
  );

}


/* =========================================================
   MOBILE SIDEBAR
========================================================= */

function toggleSidebar() {

  const sidebar =
    document.getElementById(
      "sidebar"
    );


  if (!sidebar) {
    return;
  }


  sidebar
    .classList
    .toggle(
      "mobile-open"
    );

}


function closeMobileSidebar() {

  const sidebar =
    document.getElementById(
      "sidebar"
    );


  if (!sidebar) {
    return;
  }


  sidebar
    .classList
    .remove(
      "mobile-open"
    );

}


/* =========================================================
   PAGINATION
========================================================= */

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


/* =========================================================
   COUNTS
========================================================= */

function updateCounts() {

  const inboxCount =
    emails.filter(
      function (email) {

        return (
          email.folder ===
          "inbox" &&
          email.unread
        );

      }
    ).length;


  const draftCount =
    emails.filter(
      function (email) {

        return (
          email.folder ===
          "drafts"
        );

      }
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


/* =========================================================
   DATE
========================================================= */

function formatDate(
  value
) {

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


/* =========================================================
   BUTTON LOADING
========================================================= */

function setButtonLoading(
  id,
  loading,
  text
) {

  const button =
    document.getElementById(
      id
    );


  if (!button) {
    return;
  }


  button.disabled =
    loading;


  button.textContent =
    text;

}


/* =========================================================
   TOAST
========================================================= */

function showToast(
  message
) {

  const toast =
    document.getElementById(
      "toast"
    );

  const messageElement =
    document.getElementById(
      "toastMessage"
    );


  if (
    !toast ||
    !messageElement
  ) {

    alert(
      message
    );

    return;
  }


  messageElement.textContent =
    message;


  toast
    .classList
    .remove(
      "hidden"
    );


  clearTimeout(
    toastTimer
  );


  toastTimer =
    setTimeout(
      function () {

        toast
          .classList
          .add(
            "hidden"
          );

      },
      3000
    );

}


/* =========================================================
   KEYBOARD SHORTCUTS
========================================================= */

document.addEventListener(
  "keydown",
  function (event) {

    /*
      Press "/" to focus search.
    */

    if (
      event.key === "/" &&
      !event.ctrlKey &&
      !event.metaKey &&
      !event.altKey
    ) {

      const active =
        document.activeElement;


      const tag =
        active
          ? active.tagName
          : "";


      if (
        tag !== "INPUT" &&
        tag !== "TEXTAREA"
      ) {

        const search =
          document.getElementById(
            "searchInput"
          );


        if (search) {

          event.preventDefault();

          search.focus();
        }
      }
    }


    /*
      Escape closes compose.
    */

    if (
      event.key === "Escape"
    ) {

      const compose =
        document.getElementById(
          "composeWindow"
        );


      if (
        compose &&
        !compose.classList.contains(
          "hidden"
        )
      ) {

        closeCompose();
      }
    }

  }
);


/* =========================================================
   END
========================================================= */
