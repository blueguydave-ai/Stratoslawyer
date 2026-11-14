const SUPABASE_URL = window.STRATOS_SUPABASE_URL;
const SUPABASE_PUBLISHABLE_KEY = window.STRATOS_SUPABASE_PUBLISHABLE_KEY;
const authClient = window.supabase?.createClient && SUPABASE_URL && SUPABASE_PUBLISHABLE_KEY
  ? window.supabase.createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY)
  : null;

const authPanel = document.getElementById("auth-panel");
const authForm = document.getElementById("auth-form");
const authName = document.getElementById("auth-name");
const authEmail = document.getElementById("auth-email");
const authPassword = document.getElementById("auth-password");
const authSubmit = document.getElementById("auth-submit");
const authToggle = document.getElementById("auth-toggle");
const forgotPassword = document.getElementById("forgot-password");
const authMessage = document.getElementById("auth-message");
const accountBar = document.getElementById("account-bar");
const accountEmail = document.getElementById("account-email");
const signOutButton = document.getElementById("sign-out");
const workspace = document.querySelector(".workspace");
const recoveryPanel = document.getElementById("recovery-panel");
const recoveryForm = document.getElementById("recovery-form");
const recoveryPassword = document.getElementById("recovery-password");
const recoveryConfirm = document.getElementById("recovery-confirm");
const recoverySubmit = document.getElementById("recovery-submit");
const recoveryMessage = document.getElementById("recovery-message");

let authMode = "login";
let currentSession = null;
let isRecoveringPassword = false;

function showAuthMessage(message, isError = false) {
  authMessage.textContent = message;
  authMessage.classList.toggle("is-error", isError);
}
function setAuthMode(mode) {
  authMode = mode;
  const registering = mode === "register";
  document.getElementById("auth-title").textContent = registering ? "Create your lawyer account." : "Sign in to STRATOSLAWYER.";
  authName.hidden = !registering;
  authName.required = registering;
  authPassword.autocomplete = registering ? "new-password" : "current-password";
  authSubmit.firstChild.textContent = registering ? "Create account " : "Sign in ";
  authToggle.textContent = registering ? "Already have an account? Sign in" : "Create an account";
  forgotPassword.hidden = registering;
  showAuthMessage("");
}
function applySession(session) {
  currentSession = session;
  if (isRecoveringPassword) {
    authPanel.hidden = true;
    recoveryPanel.hidden = false;
    workspace.hidden = true;
    accountBar.hidden = true;
    return;
  }
  recoveryPanel.hidden = true;
  const signedIn = Boolean(session?.access_token);
  authPanel.hidden = signedIn;
  workspace.hidden = !signedIn;
  accountBar.hidden = !signedIn;
  accountEmail.textContent = signedIn ? (session.user.email || "Signed in") : "";
  if (!signedIn) {
    document.getElementById("progress-panel").hidden = true;
    document.getElementById("results").hidden = true;
  }
}

if (!authClient) {
  showAuthMessage("The Supabase connection is not configured. Please contact the platform administrator.", true);
  authSubmit.disabled = true;
  authToggle.disabled = true;
  forgotPassword.disabled = true;
} else {
  authClient.auth.getSession().then(({data,error}) => {
    if (error) showAuthMessage(error.message, true);
    applySession(data?.session || null);
  });
  authClient.auth.onAuthStateChange((event, session) => {
    if (event === "PASSWORD_RECOVERY") {
      isRecoveringPassword = true;
      recoveryMessage.textContent = "Your recovery link is valid. Choose a new password.";
      recoveryMessage.classList.remove("is-error");
    }
    applySession(session);
  });
}

authToggle.addEventListener("click", () => setAuthMode(authMode === "login" ? "register" : "login"));

authForm.addEventListener("submit", async event => {
  event.preventDefault();
  if (!authClient) return;
  authSubmit.disabled = true;
  showAuthMessage(authMode === "register" ? "Creating your account..." : "Signing you in...");
  try {
    if (authMode === "register") {
      const {data,error} = await authClient.auth.signUp({
        email: authEmail.value.trim(),
        password: authPassword.value,
        options: { data: { full_name: authName.value.trim() }, emailRedirectTo: window.location.origin + "/" }
      });
      if (error) throw error;
      if (data.session) {
        showAuthMessage("Account created. You're signed in.");
      } else {
        showAuthMessage("Account created. Check your email to confirm your address, then sign in.");
        setAuthMode("login");
      }
    } else {
      const {error} = await authClient.auth.signInWithPassword({
        email: authEmail.value.trim(),
        password: authPassword.value
      });
      if (error) throw error;
      showAuthMessage("Signed in successfully.");
    }
  } catch (error) {
    showAuthMessage(error.message || "Authentication failed. Please try again.", true);
  } finally {
    authSubmit.disabled = false;
  }
});

recoveryForm.addEventListener("submit", async event => {
  event.preventDefault();
  if (!authClient) return;
  const password = recoveryPassword.value;
  if (password.length < 8) {
    recoveryMessage.textContent = "Your password must be at least 8 characters.";
    recoveryMessage.classList.add("is-error");
    return;
  }
  if (password !== recoveryConfirm.value) {
    recoveryMessage.textContent = "The passwords do not match. Please try again.";
    recoveryMessage.classList.add("is-error");
    recoveryConfirm.focus();
    return;
  }
  recoverySubmit.disabled = true;
  recoveryMessage.textContent = "Updating your password...";
  recoveryMessage.classList.remove("is-error");
  try {
    const {error} = await authClient.auth.updateUser({password});
    if (error) throw error;
    isRecoveringPassword = false;
    recoveryPanel.hidden = true;
    applySession(currentSession);
    showAuthMessage("Your password has been updated. You are now signed in.");
  } catch (error) {
    recoveryMessage.textContent = error.message || "Could not update your password. Request a fresh reset link and try again.";
    recoveryMessage.classList.add("is-error");
  } finally {
    recoverySubmit.disabled = false;
  }
});

forgotPassword.addEventListener("click", async () => {
  if (!authClient) return;
  const email = authEmail.value.trim();
  if (!email) {
    showAuthMessage("Enter your email address first, then choose Forgot password.", true);
    authEmail.focus();
    return;
  }
  forgotPassword.disabled = true;
  try {
    const {error} = await authClient.auth.resetPasswordForEmail(email, {
      redirectTo: window.location.origin + "/"
    });
    if (error) throw error;
    showAuthMessage("If an account exists for that address, a password-reset email will be sent. Follow its instructions.");
  } catch (error) {
    showAuthMessage(error.message || "Could not request a password reset.", true);
  } finally {
    forgotPassword.disabled = false;
  }
});

signOutButton.addEventListener("click", async () => {
  if (!authClient) return;
  signOutButton.disabled = true;
  const {error} = await authClient.auth.signOut();
  signOutButton.disabled = false;
  if (error) showAuthMessage(error.message, true);
});

const input = document.getElementById("file-input");
const dropZone = document.getElementById("drop-zone");
const fileList = document.getElementById("file-list");
const description = document.getElementById("case-description");
const analyzeButton = document.getElementById("analyze-button");
const errorMessage = document.getElementById("error-message");
const progressPanel = document.getElementById("progress-panel");
const progressTitle = document.getElementById("progress-title");
const progressDetail = document.getElementById("progress-detail");
const results = document.getElementById("results");
const output = document.getElementById("analysis-output");
const selectedFiles = [];

const allowedTypes = new Set(["application/pdf","text/plain","text/markdown","image/jpeg","image/png","image/webp"]);
const formatSize = bytes => bytes < 1024 * 1024 ? Math.round(bytes / 1024) + " KB" : (bytes / 1024 / 1024).toFixed(1) + " MB";

function showError(message) {
  errorMessage.textContent = message;
  errorMessage.hidden = false;
}
function renderFiles() {
  fileList.replaceChildren();
  selectedFiles.forEach((file,index) => {
    const row = document.createElement("div");
    row.className = "file-item";
    const label = document.createElement("span");
    label.textContent = file.name;
    const size = document.createElement("small");
    size.textContent = formatSize(file.size);
    label.append(" ",size);
    const remove = document.createElement("button");
    remove.className = "remove-file";
    remove.type = "button";
    remove.setAttribute("aria-label","Remove " + file.name);
    remove.textContent = "×";
    remove.addEventListener("click",() => { selectedFiles.splice(index,1); renderFiles(); });
    row.append(label,remove);
    fileList.append(row);
  });
}
function addFiles(files) {
  errorMessage.hidden = true;
  for (const file of files) {
    if (selectedFiles.length >= 6) { showError("You can attach up to 6 files per analysis."); break; }
    const combinedSize = selectedFiles.reduce((sum,item) => sum + item.size,0) + file.size;
    if (combinedSize > 2.7 * 1024 * 1024) { showError("The combined upload must stay below 2.7 MB in this first version."); continue; }
    if (!allowedTypes.has(file.type)) { showError(file.name + " is not supported. Use PDF, TXT, MD, JPG, PNG or WebP."); continue; }
    if (file.size > 2 * 1024 * 1024) { showError(file.name + " is larger than 2 MB."); continue; }
    if (selectedFiles.some(existing => existing.name === file.name && existing.size === file.size)) continue;
    selectedFiles.push(file);
  }
  renderFiles();
  input.value = "";
}
input.addEventListener("change",event => addFiles([...event.target.files]));
dropZone.addEventListener("click",event => { if (event.target !== input) input.click(); });
dropZone.addEventListener("keydown",event => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); input.click(); } });
["dragenter","dragover"].forEach(type => dropZone.addEventListener(type,event => { event.preventDefault(); dropZone.classList.add("dragover"); }));
["dragleave","drop"].forEach(type => dropZone.addEventListener(type,event => { event.preventDefault(); dropZone.classList.remove("dragover"); }));
dropZone.addEventListener("drop",event => addFiles([...event.dataTransfer.files]));

function fileAsDataUrl(file) {
  return new Promise((resolve,reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(new Error("Could not read " + file.name));
    reader.readAsDataURL(file);
  });
}
function escapeHtml(text) {
  return text.replace(/[&<>"']/g,char => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[char]));
}

analyzeButton.addEventListener("click", async () => {
  errorMessage.hidden = true;
  results.hidden = true;
  const caseText = description.value.trim();
  if (!caseText && !selectedFiles.length) { showError("Describe the matter or attach at least one supported document to begin."); return; }
  const {data:sessionData} = await authClient.auth.getSession();
  const accessToken = sessionData?.session?.access_token;
  if (!accessToken) { applySession(null); showError("Your session has expired. Please sign in again."); return; }
  analyzeButton.disabled = true;
  analyzeButton.querySelector("span:first-child").textContent = "Analysing...";
  progressPanel.hidden = false;
  progressTitle.textContent = "Reading the material...";
  progressDetail.textContent = "Identifying the legal environment and reconstructing the case.";
  progressPanel.scrollIntoView({behavior:"smooth",block:"center"});
  const stageTimer = setTimeout(() => {
    progressTitle.textContent = "Stress-testing both sides...";
    progressDetail.textContent = "Looking for evidence gaps, contradictions, procedural risks and plausible opposing arguments.";
  },4500);
  try {
    const files = await Promise.all(selectedFiles.map(async file => ({name:file.name,mimeType:file.type,data:await fileAsDataUrl(file)})));
    const response = await fetch("/api/analyze",{
      method:"POST",
      headers:{"Content-Type":"application/json","Authorization":"Bearer " + accessToken},
      body:JSON.stringify({description:caseText,files})
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.error || "Analysis failed. Please try again.");
    clearTimeout(stageTimer);
    progressTitle.textContent = "Preparing your case intelligence...";
    progressDetail.textContent = "The first analysis is ready.";
    output.innerHTML = escapeHtml(data.analysis).replace(/^([A-K]\. [^\n]+)$/gm,"<strong>$1</strong>");
    results.hidden = false;
    setTimeout(() => results.scrollIntoView({behavior:"smooth",block:"start"}),150);
  } catch(error) {
    clearTimeout(stageTimer);
    showError(error.message || "Something went wrong. Please try again.");
    progressPanel.hidden = true;
  } finally {
    analyzeButton.disabled = false;
    analyzeButton.querySelector("span:first-child").textContent = "Analyse my case";
  }
});
document.getElementById("new-analysis").addEventListener("click",() => {
  results.hidden = true;
  progressPanel.hidden = true;
  description.focus();
  window.scrollTo({top:0,behavior:"smooth"});
});
