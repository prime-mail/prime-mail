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
let drafts = [];
let labels = [];
let selectedAttachments = [];
let draftSaveTimer = null;
let suppressDraftSave = false;

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
    setupDraftAutosave();
    setupSearchShortcuts();

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

  const result =
    await supabaseClient.rpc(
      "get_my_emails"
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

  await loadDrafts();
  await loadLabels();
  await loadEmailAttachments();

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


  const username =
    isSender
      ? (row.recipient_username || "")
      : (row.sender_username || "");


  const mailIdentity =
    username
      ? username + "@prime-mail.primemail.workers.dev"
      : "Prime Mail User";


  return {

    id: row.id,

    folder: folder,

    sender:
      mailIdentity,

    email:
      mailIdentity,

    senderUsername:
      username,

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
      false,

    labels: []
  };

}


/* =========================================================
   DRAFTS
========================================================= */

async function loadDrafts() {

  if (!currentUser || !supabaseClient) {
    drafts = [];
    return;
  }

  const result =
    await supabaseClient
      .from("drafts")
      .select("*")
      .eq("user_id", currentUser.id)
      .order("updated_at", { ascending: false });

  if (result.error) {
    console.error("Draft loading error:", result.error);
    drafts = [];
    return;
  }

  drafts = (result.data || []).map(convertDraft);

  emails =
    emails
      .filter(function (email) {
        return email.folder !== "drafts";
      })
      .concat(drafts);
}

function convertDraft(row) {

  return {
    id: row.id,
    folder: "drafts",
    sender: "Draft",
    email: currentUser ? (currentUser.email || "") : "",
    subject: row.subject || "(No subject)",
    preview: row.body || "",
    body: row.body || "",
    draftTo: row.to_username || "",
    date: formatDate(row.updated_at || row.created_at),
    unread: false,
    starred: false,
    attachment: false,
    labels: []
  };

}

function setupDraftAutosave() {

  ["composeTo", "composeSubject", "composeMessage"]
    .forEach(function (id) {

      const input = document.getElementById(id);

      if (!input) {
        return;
      }

      input.addEventListener("input", scheduleDraftSave);
      input.addEventListener("change", scheduleDraftSave);

    });

}

function scheduleDraftSave() {

  if (suppressDraftSave || !currentUser) {
    return;
  }

  clearTimeout(draftSaveTimer);

  draftSaveTimer =
    setTimeout(async function () {
      await saveDraft();
    }, 700);

}

async function saveDraft() {

  if (suppressDraftSave || !currentUser || !supabaseClient) {
    return null;
  }

  const toInput = document.getElementById("composeTo");
  const subjectInput = document.getElementById("composeSubject");
  const messageInput = document.getElementById("composeMessage");

  const to = toInput ? toInput.value.trim().toLowerCase() : "";
  const subject = subjectInput ? subjectInput.value.trim() : "";
  const body = messageInput ? messageInput.value : "";

  if (!to && !subject && !body.trim()) {
    return null;
  }

  const compose = document.getElementById("composeWindow");
  const draftId = compose ? (compose.dataset.draftId || "") : "";

  let result;

  if (draftId) {

    result =
      await supabaseClient
        .from("drafts")
        .update({
          to_username: to,
          subject: subject,
          body: body,
          updated_at: new Date().toISOString()
        })
        .eq("id", draftId)
        .eq("user_id", currentUser.id)
        .select()
        .maybeSingle();

  } else {

    result =
      await supabaseClient
        .from("drafts")
        .insert({
          user_id: currentUser.id,
          to_username: to,
          subject: subject,
          body: body
        })
        .select()
        .single();

  }

  if (result.error) {
    console.error("Draft save error:", result.error);
    return null;
  }

  if (result.data && compose) {
    compose.dataset.draftId = result.data.id;
  }

  const draft = convertDraft(result.data);

  emails =
    emails.filter(function (email) {
      return email.folder !== "drafts" || email.id === draft.id;
    });

  const existingIndex =
    emails.findIndex(function (email) {
      return email.id === draft.id;
    });

  if (existingIndex >= 0) {
    emails[existingIndex] = draft;
  } else {
    emails.unshift(draft);
  }

  drafts =
    emails.filter(function (email) {
      return email.folder === "drafts";
    });

  renderEmails();
  updateCounts();

  return draft;
}

async function editDraft(email) {

  if (!email || email.folder !== "drafts") {
    return;
  }

  const compose = document.getElementById("composeWindow");

  if (!compose) {
    return;
  }

  suppressDraftSave = true;

  openCompose();

  const toInput = document.getElementById("composeTo");
  const subjectInput = document.getElementById("composeSubject");
  const messageInput = document.getElementById("composeMessage");

  if (toInput) {
    toInput.value = email.draftTo || "";
  }

  if (subjectInput) {
    subjectInput.value =
      email.subject === "(No subject)" ? "" : (email.subject || "");
  }

  if (messageInput) {
    messageInput.value = email.body || "";
  }

  compose.dataset.draftId = email.id;
  delete compose.dataset.replyId;

  suppressDraftSave = false;

  if (toInput) {
    toInput.focus();
  }

}

async function deleteCurrentDraft() {

  const compose = document.getElementById("composeWindow");
  const draftId = compose ? (compose.dataset.draftId || "") : "";

  if (!draftId) {
    suppressDraftSave = true;
    hideComposeWindow();
    suppressDraftSave = false;
    return;
  }

  const result =
    await supabaseClient
      .from("drafts")
      .delete()
      .eq("id", draftId)
      .eq("user_id", currentUser.id);

  if (result.error) {
    console.error("Draft delete error:", result.error);
    showToast(result.error.message);
    return;
  }

  suppressDraftSave = true;
  hideComposeWindow();
  suppressDraftSave = false;

  await loadEmails();

  showToast("Draft deleted.");
}

/* =========================================================
   ATTACHMENTS
========================================================= */

function handleAttachmentSelection(event) {

  const input = event.target;

  if (!input || !input.files) {
    return;
  }

  Array.from(input.files).forEach(function (file) {

    const duplicate = selectedAttachments.some(function (item) {
      return (
        item.name === file.name &&
        item.size === file.size &&
        item.lastModified === file.lastModified
      );
    });

    if (!duplicate) {
      selectedAttachments.push(file);
    }
  });

  input.value = "";
  renderSelectedAttachments();
}

function renderSelectedAttachments() {

  const list = document.getElementById("attachmentList");

  if (!list) {
    return;
  }

  list.innerHTML = "";

  if (!selectedAttachments.length) {
    list.classList.add("hidden");
    return;
  }

  list.classList.remove("hidden");

  selectedAttachments.forEach(function (file, index) {

    const row = document.createElement("div");
    row.className = "selected-attachment";

    const icon = document.createElement("span");
    icon.textContent = file.type && file.type.indexOf("image/") === 0
      ? "🖼️"
      : "📎";

    const name = document.createElement("span");
    name.className = "selected-attachment-name";
    name.textContent = file.name + " (" + formatFileSize(file.size) + ")";
    name.title = file.name;

    const remove = document.createElement("button");
    remove.type = "button";
    remove.textContent = "×";
    remove.title = "Remove attachment";

    remove.onclick = function () {
      selectedAttachments.splice(index, 1);
      renderSelectedAttachments();
    };

    row.appendChild(icon);
    row.appendChild(name);
    row.appendChild(remove);
    list.appendChild(row);
  });
}

function formatFileSize(bytes) {

  if (!Number.isFinite(bytes) || bytes <= 0) {
    return "0 B";
  }

  const units = ["B", "KB", "MB", "GB", "TB"];
  const index = Math.min(
    Math.floor(Math.log(bytes) / Math.log(1024)),
    units.length - 1
  );

  return (
    bytes / Math.pow(1024, index)
  ).toFixed(index === 0 ? 0 : 1) +
    " " +
    units[index];
}

function resetSelectedAttachments() {

  selectedAttachments = [];
  renderSelectedAttachments();

}

async function uploadEmailAttachments(emailId, files) {

  if (!files || !files.length) {
    return { success: true, uploaded: 0, failed: 0 };
  }

  let uploaded = 0;
  let failed = 0;

  for (let i = 0; i < files.length; i++) {

    const file = files[i];

    const safeName =
      file.name
        .replace(/[^a-zA-Z0-9._-]/g, "_")
        .slice(0, 180) || "attachment";

    const path =
      emailId + "/" +
      Date.now() + "_" +
      Math.random().toString(36).slice(2) +
      "_" +
      safeName;

    const uploadResult =
      await supabaseClient
        .storage
        .from("email-attachments")
        .upload(path, file, {
          contentType: file.type || "application/octet-stream",
          upsert: false
        });

    if (uploadResult.error) {
      console.error("Attachment upload error:", uploadResult.error);
      failed++;
      continue;
    }

    const dbResult =
      await supabaseClient
        .from("email_attachments")
        .insert({
          email_id: emailId,
          sender_id: currentUser.id,
          file_name: file.name,
          file_path: path,
          content_type: file.type || "application/octet-stream",
          size_bytes: file.size
        });

    if (dbResult.error) {

      console.error("Attachment record error:", dbResult.error);

      await supabaseClient
        .storage
        .from("email-attachments")
        .remove([path]);

      failed++;
      continue;
    }

    uploaded++;
  }

  return {
    success: failed === 0,
    uploaded: uploaded,
    failed: failed
  };
}

async function loadEmailAttachments() {

  if (!currentUser || !supabaseClient || !emails.length) {
    return;
  }

  const result =
    await supabaseClient
      .from("email_attachments")
      .select("*");

  if (result.error) {
    console.error("Attachment loading error:", result.error);
    return;
  }

  const byEmail = {};

  (result.data || []).forEach(function (item) {

    if (!byEmail[item.email_id]) {
      byEmail[item.email_id] = [];
    }

    byEmail[item.email_id].push(item);
  });

  emails.forEach(function (email) {
    email.attachments = byEmail[email.id] || [];
  });
}

function downloadEmailAttachment(attachment) {

  if (!attachment || !supabaseClient) {
    return;
  }

  supabaseClient
    .storage
    .from("email-attachments")
    .createSignedUrl(attachment.file_path, 60)
    .then(function (result) {

      if (result.error) {
        console.error("Attachment download error:", result.error);
        showToast(result.error.message || "Could not open attachment.");
        return;
      }

      const link = document.createElement("a");
      link.href = result.data.signedUrl;
      link.target = "_blank";
      link.rel = "noopener";
      link.download = attachment.file_name || "attachment";
      document.body.appendChild(link);
      link.click();
      link.remove();
    });
}

/* =========================================================
   LABELS
========================================================= */

async function loadLabels() {

  if (!currentUser || !supabaseClient) {
    labels = [];
    return;
  }

  const labelResult =
    await supabaseClient
      .from("labels")
      .select("*")
      .eq("user_id", currentUser.id)
      .order("name", { ascending: true });

  if (labelResult.error) {
    console.error("Label loading error:", labelResult.error);
    labels = [];
    renderLabelSidebar();
    return;
  }

  labels = labelResult.data || [];

  const emailLabelResult =
    await supabaseClient.rpc("get_my_email_labels");

  if (emailLabelResult.error) {
    console.error("Email label loading error:", emailLabelResult.error);
  } else {
    const byEmail = {};

    (emailLabelResult.data || []).forEach(function (item) {
      if (!byEmail[item.email_id]) {
        byEmail[item.email_id] = [];
      }

      byEmail[item.email_id].push({
        id: item.label_id,
        name: item.label_name,
        color: item.label_color
      });
    });

    emails.forEach(function (email) {
      email.labels = byEmail[email.id] || [];
    });
  }

  renderLabelSidebar();
}

function renderLabelSidebar() {

  const section = document.querySelector(".sidebar-section");

  if (!section) {
    return;
  }

  section.innerHTML = "";

  const title = document.createElement("div");
  title.className = "sidebar-title";

  const titleText = document.createElement("span");
  titleText.textContent = "Labels";

  const addButton = document.createElement("button");
  addButton.type = "button";
  addButton.textContent = "＋";
  addButton.title = "Create label";
  addButton.onclick = addLabel;

  title.appendChild(titleText);
  title.appendChild(addButton);
  section.appendChild(title);

  labels.forEach(function (label) {

    const row = document.createElement("div");
    row.className = "label-row";

    const openButton = document.createElement("button");
    openButton.type = "button";
    openButton.className = "label-item";
    openButton.title = "Show emails with this label";

    const dot = document.createElement("span");
    dot.className = "label-dot";
    dot.style.background = label.color || "#5b5bd6";

    const name = document.createElement("span");
    name.textContent = label.name;

    openButton.appendChild(dot);
    openButton.appendChild(name);

    openButton.onclick = function () {
      openLabel(label.id);
    };

    const deleteButton = document.createElement("button");
    deleteButton.type = "button";
    deleteButton.className = "label-delete-button";
    deleteButton.textContent = "×";
    deleteButton.title = "Delete label";

    deleteButton.onclick = function (event) {
      event.stopPropagation();
      deleteLabel(label.id);
    };

    row.appendChild(openButton);
    row.appendChild(deleteButton);
    section.appendChild(row);
  });
}

async function addLabel() {

  if (!currentUser || !supabaseClient) {
    showToast("Please sign in first.");
    return;
  }

  const name = window.prompt("Enter a label name:");

  if (name === null) {
    return;
  }

  const cleanName = name.trim();

  if (!cleanName) {
    showToast("Label name cannot be empty.");
    return;
  }

  if (cleanName.length > 40) {
    showToast("Label name must be 40 characters or less.");
    return;
  }

  const color = window.prompt(
    "Enter a color (example: #5b5bd6). Press Cancel for the default color:",
    "#5b5bd6"
  );

  let cleanColor = (color || "#5b5bd6").trim();

  if (!/^#[0-9a-fA-F]{6}$/.test(cleanColor)) {
    cleanColor = "#5b5bd6";
  }

  const result =
    await supabaseClient
      .from("labels")
      .insert({
        user_id: currentUser.id,
        name: cleanName,
        color: cleanColor
      })
      .select()
      .single();

  if (result.error) {
    if ((result.error.message || "").toLowerCase().includes("duplicate")) {
      showToast("That label already exists.");
    } else {
      console.error("Label creation error:", result.error);
      showToast(result.error.message || "Could not create label.");
    }
    return;
  }

  labels.push(result.data);
  labels.sort(function (a, b) {
    return a.name.localeCompare(b.name);
  });

  renderLabelSidebar();
  showToast("Label created: " + result.data.name);
}

async function deleteLabel(labelId) {

  const label = labels.find(function (item) {
    return item.id === labelId;
  });

  if (!label) {
    return;
  }

  if (!window.confirm("Delete the label "" + label.name + ""? Emails will not be deleted.")) {
    return;
  }

  const result =
    await supabaseClient
      .from("labels")
      .delete()
      .eq("id", labelId)
      .eq("user_id", currentUser.id);

  if (result.error) {
    console.error("Label delete error:", result.error);
    showToast(result.error.message || "Could not delete label.");
    return;
  }

  labels =
    labels.filter(function (item) {
      return item.id !== labelId;
    });

  emails.forEach(function (email) {
    email.labels =
      (email.labels || []).filter(function (item) {
        return item.id !== labelId;
      });
  });

  if (currentFolder === "label:" + labelId) {
    currentFolder = "inbox";
    updateFolderHeader();
  }

  renderLabelSidebar();
  renderEmails();
  showToast("Label deleted.");
}

function openLabel(labelId) {

  const label = labels.find(function (item) {
    return item.id === labelId;
  });

  if (!label) {
    return;
  }

  currentFolder = "label:" + labelId;
  searchTerm = "";

  const searchInput = document.getElementById("searchInput");

  if (searchInput) {
    searchInput.value = "";
  }

  document.querySelectorAll(".nav-item").forEach(function (button) {
    button.classList.remove("active");
  });

  updateFolderHeader();
  renderEmails();
  closeMobileSidebar();
}

async function manageEmailLabels(emailId) {

  const email = emails.find(function (item) {
    return item.id === emailId;
  });

  if (!email || email.folder === "drafts") {
    return;
  }

  const old = document.getElementById("primeMailLabelPicker");

  if (old) {
    old.remove();
  }

  const overlay = document.createElement("div");
  overlay.id = "primeMailLabelPicker";
  overlay.className = "label-picker-overlay";

  const box = document.createElement("div");
  box.className = "label-picker";

  const header = document.createElement("div");
  header.className = "label-picker-header";

  const title = document.createElement("strong");
  title.textContent = "Labels";

  const close = document.createElement("button");
  close.type = "button";
  close.textContent = "×";
  close.onclick = function () {
    overlay.remove();
  };

  header.appendChild(title);
  header.appendChild(close);
  box.appendChild(header);

  if (labels.length === 0) {
    const empty = document.createElement("p");
    empty.textContent = "No labels yet. Create one from the sidebar.";
    box.appendChild(empty);
  }

  labels.forEach(function (label) {

    const item = document.createElement("label");
    item.className = "label-picker-item";

    const checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    checkbox.dataset.labelId = label.id;

    const current = (email.labels || []).some(function (item) {
      return item.id === label.id;
    });

    checkbox.checked = current;

    const dot = document.createElement("span");
    dot.className = "label-dot";
    dot.style.background = label.color || "#5b5bd6";

    const text = document.createElement("span");
    text.textContent = label.name;

    item.appendChild(checkbox);
    item.appendChild(dot);
    item.appendChild(text);
    box.appendChild(item);
  });

  const footer = document.createElement("div");
  footer.className = "label-picker-footer";

  const cancel = document.createElement("button");
  cancel.type = "button";
  cancel.textContent = "Cancel";
  cancel.onclick = function () {
    overlay.remove();
  };

  const save = document.createElement("button");
  save.type = "button";
  save.className = "primary-button";
  save.textContent = "Save labels";

  save.onclick = async function () {

    save.disabled = true;

    const checkedIds =
      Array.from(
        box.querySelectorAll("input[type='checkbox']")
      )
      .filter(function (checkbox) {
        return checkbox.checked;
      })
      .map(function (checkbox) {
        return checkbox.dataset.labelId;
      });

    const existingIds =
      (email.labels || []).map(function (item) {
        return item.id;
      });

    const toAdd =
      checkedIds.filter(function (id) {
        return existingIds.indexOf(id) === -1;
      });

    const toRemove =
      existingIds.filter(function (id) {
        return checkedIds.indexOf(id) === -1;
      });

    for (let i = 0; i < toAdd.length; i++) {
      const addResult =
        await supabaseClient
          .from("email_labels")
          .insert({
            email_id: emailId,
            label_id: toAdd[i]
          });

      if (addResult.error) {
        console.error("Add email label error:", addResult.error);
        showToast(addResult.error.message || "Could not add label.");
        save.disabled = false;
        return;
      }
    }

    for (let i = 0; i < toRemove.length; i++) {
      const removeResult =
        await supabaseClient
          .from("email_labels")
          .delete()
          .eq("email_id", emailId)
          .eq("label_id", toRemove[i]);

      if (removeResult.error) {
        console.error("Remove email label error:", removeResult.error);
        showToast(removeResult.error.message || "Could not remove label.");
        save.disabled = false;
        return;
      }
    }

    email.labels =
      labels.filter(function (label) {
        return checkedIds.indexOf(label.id) !== -1;
      });

    overlay.remove();
    renderEmails();
    showToast("Labels updated.");
  };

  footer.appendChild(cancel);
  footer.appendChild(save);
  box.appendChild(footer);

  overlay.appendChild(box);

  overlay.addEventListener("click", function (event) {
    if (event.target === overlay) {
      overlay.remove();
    }
  });

  document.body.appendChild(overlay);
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

  if (currentFolder.indexOf("label:") === 0) {

    const labelId = currentFolder.slice(6);

    const label = labels.find(function (item) {
      return item.id === labelId;
    });

    if (label) {
      titles[currentFolder] = [
        label.name,
        "Messages with this label"
      ];
    }
  }


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


  /*
    Search mode:
    When the user types in Search Mail, search the
    complete mailbox instead of only the open folder.
    Without a search term, show the selected folder.
  */
  let filtered;

  if (searchTerm) {

    const query =
      searchTerm
        .trim()
        .toLowerCase();

    filtered =
      emails.filter(
        function (email) {

          const content =
            (
              email.sender || "" +
              " " +
              email.email || "" +
              " " +
              email.subject || "" +
              " " +
              email.preview || "" +
              " " +
              email.body || "" +
              " " +
              email.draftTo || "" +
              " " +
              email.id || ""
            ).toLowerCase();

          return content.indexOf(query) !== -1;

        }
      );

  } else {

    filtered =
      emails.filter(
        function (email) {

          if (
            currentFolder ===
            "starred"
          ) {

            return email.starred;
          }

          if (
            currentFolder.indexOf("label:") === 0
          ) {

            const labelId =
              currentFolder.slice(6);

            return (email.labels || []).some(function (label) {
              return label.id === labelId;
            });
          }

          return (
            email.folder ===
            currentFolder
          );

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

      if (email.attachments && email.attachments.length) {
        const attachmentMark = document.createElement("span");
        attachmentMark.className = "email-attachment-mark";
        attachmentMark.textContent = " 📎 " + email.attachments.length;
        main.appendChild(attachmentMark);
      }


      const date =
        document.createElement(
          "div"
        );

      date.className =
        "email-date";

      date.textContent =
        email.date;


      const labelButton =
        document.createElement("button");

      labelButton.type = "button";
      labelButton.className = "email-label-button";
      labelButton.textContent = "🏷";
      labelButton.title = "Manage labels";

      if (email.labels && email.labels.length) {
        labelButton.classList.add("has-labels");
      }

      labelButton.addEventListener("click", function (event) {
        event.stopPropagation();
        manageEmailLabels(email.id);
      });

      row.appendChild(
        checkbox
      );

      row.appendChild(
        star
      );

      row.appendChild(
        labelButton
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
   SEARCH KEYBOARD SHORTCUTS
========================================================= */

function setupSearchShortcuts() {

  const input =
    document.getElementById(
      "searchInput"
    );

  if (!input) {
    return;
  }

  input.addEventListener(
    "keydown",
    function (event) {

      if (event.key === "Escape") {

        input.value = "";
        searchTerm = "";
        renderEmails();
        input.blur();

        return;
      }

    }
  );


  document.addEventListener(
    "keydown",
    function (event) {

      const active =
        document.activeElement;

      const isTyping =
        active &&
        (
          active.tagName === "INPUT" ||
          active.tagName === "TEXTAREA" ||
          active.isContentEditable
        );

      if (
        event.key === "/" &&
        !isTyping
      ) {

        event.preventDefault();
        input.focus();
        input.select();

      }

    }
  );

}

async function openEmail(id) {

  const email =
    emails.find(
      function (item) {
        return item.id === id;
      }
    );

  if (!email) {
    console.error("Email not found:", id);
    return;
  }

  if (email.folder === "drafts") {
    await editDraft(email);
    return;
  }

  /* Mark incoming message as read */

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
        "Mark as read error:",
        result.error
      );
    } else {
      email.unread = false;
    }
  }

  /* Open full message viewer */

  showMessageViewer(email);

  /* Refresh email list */

  renderEmails();

}
/* =========================================================
   OPEN EMAIL
========================================================= */

function showMessageViewer(email) {

  const oldViewer =
    document.getElementById("primeMailMessageViewer");

  if (oldViewer) {
    oldViewer.remove();
  }

  const viewer =
    document.createElement("div");

  viewer.id =
    "primeMailMessageViewer";

  viewer.style.position = "fixed";
  viewer.style.inset = "0";
  viewer.style.background = "rgba(0,0,0,0.55)";
  viewer.style.zIndex = "99999";
  viewer.style.display = "flex";
  viewer.style.alignItems = "center";
  viewer.style.justifyContent = "center";
  viewer.style.padding = "20px";
  viewer.style.boxSizing = "border-box";

  const box =
    document.createElement("div");

  box.style.width = "100%";
  box.style.maxWidth = "760px";
  box.style.maxHeight = "85vh";
  box.style.overflowY = "auto";
  box.style.background = "#ffffff";
  box.style.borderRadius = "16px";
  box.style.padding = "24px";
  box.style.boxSizing = "border-box";
  box.style.boxShadow = "0 20px 60px rgba(0,0,0,0.25)";

  const header =
    document.createElement("div");

  header.style.display = "flex";
  header.style.justifyContent = "space-between";
  header.style.alignItems = "center";
  header.style.gap = "15px";
  header.style.marginBottom = "20px";

  const title =
    document.createElement("h2");

  title.textContent =
    email.subject || "(No subject)";

  title.style.margin = "0";
  title.style.wordBreak = "break-word";

  const closeButton =
    document.createElement("button");

  closeButton.textContent = "×";
  closeButton.style.border = "none";
  closeButton.style.background = "transparent";
  closeButton.style.fontSize = "32px";
  closeButton.style.cursor = "pointer";
  closeButton.style.lineHeight = "1";

  closeButton.onclick =
    function () {
      viewer.remove();
    };

  header.appendChild(title);
  header.appendChild(closeButton);

  const info =
    document.createElement("div");

  info.style.padding = "14px";
  info.style.background = "#f5f7fa";
  info.style.borderRadius = "10px";
  info.style.marginBottom = "20px";

  const from =
    document.createElement("div");

  from.innerHTML =
    "<strong>From:</strong> ";

  const fromText =
    document.createElement("span");

  fromText.textContent =
    email.sender || "Prime Mail User";

  from.appendChild(fromText);

  const date =
    document.createElement("div");

  date.style.marginTop = "6px";

  date.innerHTML =
    "<strong>Date:</strong> ";

  const dateText =
    document.createElement("span");

  dateText.textContent =
    email.date || "";

  date.appendChild(dateText);

  info.appendChild(from);
  info.appendChild(date);

  const body =
    document.createElement("div");

  body.textContent =
    email.body || email.preview || "";

  body.style.whiteSpace = "pre-wrap";
  body.style.wordBreak = "break-word";
  body.style.lineHeight = "1.7";
  body.style.fontSize = "16px";
  body.style.padding = "10px 2px";
  body.style.minHeight = "120px";

  if (email.attachments && email.attachments.length) {

    const attachmentBox = document.createElement("div");
    attachmentBox.className = "message-attachments";

    const attachmentTitle = document.createElement("strong");
    attachmentTitle.textContent =
      "Attachments (" + email.attachments.length + ")";

    attachmentBox.appendChild(attachmentTitle);

    email.attachments.forEach(function (attachment) {

      const item = document.createElement("button");
      item.type = "button";
      item.className = "message-attachment";

      const icon =
        attachment.content_type &&
        attachment.content_type.indexOf("image/") === 0
          ? "🖼️"
          : "📎";

      item.textContent =
        icon + " " +
        attachment.file_name +
        " (" +
        formatFileSize(attachment.size_bytes) +
        ")";

      item.onclick = function () {
        downloadEmailAttachment(attachment);
      };

      attachmentBox.appendChild(item);
    });

    box.appendChild(attachmentBox);
  }

  const buttons =
    document.createElement("div");

  buttons.style.display = "flex";
  buttons.style.gap = "10px";
  buttons.style.marginTop = "25px";
  buttons.style.flexWrap = "wrap";

  const closeBottom =
    document.createElement("button");

  closeBottom.textContent =
    "Close";

  closeBottom.style.padding =
    "10px 18px";

  closeBottom.style.borderRadius =
    "8px";

  closeBottom.style.border =
    "1px solid #ccc";

  closeBottom.style.background =
    "#ffffff";

  closeBottom.style.cursor =
    "pointer";

  closeBottom.onclick =
    function () {
      viewer.remove();
    };

  buttons.appendChild(closeBottom);

  const isSent =
    email.folder === "sent" ||
    email.isSender === true;

  if (!isSent) {

    const replyButton =
      document.createElement("button");

    replyButton.textContent =
      "↩ Reply";

    replyButton.style.padding =
      "10px 18px";

    replyButton.style.borderRadius =
      "8px";

    replyButton.style.border =
      "none";

    replyButton.style.background =
      "#2563eb";

    replyButton.style.color =
      "#ffffff";

    replyButton.style.cursor =
      "pointer";

    replyButton.onclick =
      function () {

        viewer.remove();

        replyToMessage(email);

      };

    buttons.appendChild(replyButton);
  }

  box.appendChild(header);
  box.appendChild(info);
  box.appendChild(body);
  box.appendChild(buttons);

  viewer.appendChild(box);

  viewer.addEventListener(
    "click",
    function (event) {

      if (event.target === viewer) {
        viewer.remove();
      }

    }
  );

  document.body.appendChild(viewer);

}
function replyToMessage(email) {

  const compose =
    document.getElementById("composeModal") ||
    document.getElementById("composeWindow");

  if (typeof openCompose === "function") {
    openCompose();
  }

  const toInput =
    document.getElementById("composeTo");

  const subjectInput =
    document.getElementById("composeSubject");

  const messageInput =
    document.getElementById("composeMessage");

  if (toInput) {
    toInput.value =
      email.senderUsername ||
      email.sender ||
      "";
  }

  if (subjectInput) {

    const subject =
      email.subject || "";

    subjectInput.value =
      /^re:/i.test(subject)
        ? subject
        : "Re: " + subject;
  }

  if (messageInput) {
    messageInput.value = "";
    messageInput.focus();
  }

  if (compose) {
    compose.dataset.replyId =
      email.id;
  }

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

  if (email.folder === "drafts") {
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

    const selectedEmail =
      emails.find(function (email) {
        return email.id === id;
      });

    if (
      selectedEmail &&
      selectedEmail.folder === "drafts"
    ) {

      await supabaseClient
        .from("drafts")
        .delete()
        .eq("id", id)
        .eq("user_id", currentUser.id);

    } else {

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


async function closeCompose() {

  if (!suppressDraftSave) {
    await saveDraft();
  }

  hideComposeWindow();

}

function hideComposeWindow() {

  const compose =
    document.getElementById(
      "composeWindow"
    );

  if (compose) {

    compose
      .classList
      .add("hidden");

    delete compose.dataset.draftId;
    delete compose.dataset.replyId;
  }

  const to = document.getElementById("composeTo");
  const subject = document.getElementById("composeSubject");
  const message = document.getElementById("composeMessage");

  if (to) to.value = "";
  if (subject) subject.value = "";
  if (message) message.value = "";

  resetSelectedAttachments();

}

function markComposeAsSent() {

  suppressDraftSave = true;

  const compose = document.getElementById("composeWindow");

  return compose ? (compose.dataset.draftId || "") : "";
}

async function removeDraftAfterSend(draftId) {

  if (!draftId) {
    return;
  }

  const result =
    await supabaseClient
      .from("drafts")
      .delete()
      .eq("id", draftId)
      .eq("user_id", currentUser.id);

  if (result.error) {
    console.error("Draft cleanup error:", result.error);
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
      ? toInput.value.trim().toLowerCase()
      : "";

  const subject =
    subjectInput
      ? subjectInput.value.trim()
      : "";

  const message =
    messageInput
      ? messageInput.value.trim()
      : "";

  const filesToSend = selectedAttachments.slice();


  const compose =
    document.getElementById(
      "composeWindow"
    );


  const replyId =
    compose
      ? compose.dataset.replyId
      : "";


  /* =====================================================
     REPLY MESSAGE
  ===================================================== */

  if (replyId) {

    if (!message) {

      showToast(
        "Please write a reply."
      );

      return;
    }


    try {

      const result =
        await supabaseClient.rpc(
          "reply_prime_mail",
          {
            p_email_id:
              replyId,

            p_body:
              message
          }
        );


      if (result.error) {

        console.error(
          "Reply error:",
          result.error
        );

        showToast(
          result.error.message
        );

        return;
      }


      if (compose) {

        delete compose.dataset.replyId;

      }


      const draftId = markComposeAsSent();

      await removeDraftAfterSend(draftId);

      showToast(
        "Reply sent successfully."
      );

      await closeCompose();

      suppressDraftSave = false;

      await loadEmails();


      return;


    } catch (error) {

      console.error(
        "Unexpected reply error:",
        error
      );


      showToast(
        "Reply could not be sent."
      );

      return;

    }

  }


  /* =====================================================
     NORMAL NEW MESSAGE
  ===================================================== */

  if (!to) {

    showToast(
      "Please enter recipient username."
    );

    return;
  }


  if (
    !/^[a-z0-9_]{3,30}$/.test(to)
  ) {

    showToast(
      "Please enter a valid Prime Mail username."
    );

    return;
  }


  if (!subject) {

    showToast(
      "Please enter a subject."
    );

    return;
  }


  if (!message && !filesToSend.length) {

    showToast(
      "Please write a message or attach a file."
    );

    return;
  }


  try {

    const result =
      await supabaseClient.rpc(
        "send_prime_mail",
        {
          p_recipient_username:
            to,

          p_subject:
            subject,

          p_body:
            message
        }
      );


    if (result.error) {

      console.error(
        "Send email error:",
        result.error
      );

      showToast(
        result.error.message
      );

      return;
    }

    const sentEmailId = result.data;

    const uploadResult =
      await uploadEmailAttachments(
        sentEmailId,
        filesToSend
      );

    resetSelectedAttachments();

    const draftId = markComposeAsSent();

    await removeDraftAfterSend(draftId);

    showToast(
      uploadResult.failed
        ? "Message sent, but " + uploadResult.failed + " attachment(s) could not be uploaded."
        : "Message sent successfully."
    );

    await closeCompose();

    suppressDraftSave = false;

    await loadEmails();


  } catch (error) {

    console.error(
      "Unexpected send error:",
      error
    );


    showToast(
      "Message could not be sent."
    );

  }

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
