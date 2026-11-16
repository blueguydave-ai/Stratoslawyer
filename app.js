// Persistent Supabase account session. Supabase stores the refreshable session
// in this browser's local storage and renews access tokens automatically.
const authPanel = document.getElementById("auth-panel");
const authForm = document.getElementById("auth-form");
const authName = document.getElementById("auth-name");
const authNameLabel = document.getElementById("auth-name-label");
const authEmail = document.getElementById("auth-email");
const authPassword = document.getElementById("auth-password");
const authSubmit = document.getElementById("auth-submit");
const authMessage = document.getElementById("auth-message");
const authTitle = document.getElementById("auth-title");
const accountMenuToggle = document.getElementById("account-menu-toggle");
const accountMenu = document.getElementById("account-menu");
const accountDisplayName = document.getElementById("account-display-name");
const menuHistoryToggle = document.getElementById("menu-history-toggle");
const historyPanel = document.getElementById("history-panel");
const historyList = document.getElementById("history-list");
const historyEmpty = document.getElementById("history-empty");
const historyFeedback = document.getElementById("history-feedback");
const historyCount = document.getElementById("history-count");
const historySearch = document.getElementById("history-search");
const historyFilter = document.getElementById("history-filter");
const dailyUsage = document.getElementById("daily-usage");
const dailyUsageNumber = document.getElementById("daily-usage-number");
const dailyUsageCaption = document.getElementById("daily-usage-caption");
const dailyUsageProgress = document.getElementById("daily-usage-progress");
const authSignout = document.getElementById("menu-signout");
let dailyAnalysesRemaining = null;
let dailyUsageRequest = 0;
let currentAnalysisMarkdown = "";
let currentAnalysisTitle = "Case analysis";
let savedAnalysisRecords = [];
let historyLoadRequest = 0;
const authSigninTab = document.getElementById("auth-signin-tab");
const authSignupTab = document.getElementById("auth-signup-tab");
const authForgot = document.getElementById("auth-forgot");
let authMode = "signin";
let authClient = null;
let currentAuthSession = null;

function setAuthMessage(message, isError=false) {
  authMessage.textContent = message || "";
  authMessage.hidden = !message;
  authMessage.classList.toggle("is-error",Boolean(isError));
}
function setAuthMode(mode) {
  authMode = mode;
  const signup = mode === "signup";
  const recovery = mode === "recovery";
  authSigninTab.hidden = recovery;
  authSignupTab.hidden = recovery;
  authSigninTab.classList.toggle("is-active",mode==="signin");
  authSignupTab.classList.toggle("is-active",signup);
  authSigninTab.setAttribute("aria-selected",String(mode==="signin"));
  authSignupTab.setAttribute("aria-selected",String(signup));
  authName.hidden = !signup;
  authNameLabel.hidden = !signup;
  authName.required = signup;
  authPassword.autocomplete = recovery ? "new-password" : signup ? "new-password" : "current-password";
  authPassword.placeholder = recovery ? "Choose a new password (at least 8 characters)" : "At least 8 characters";
  authTitle.textContent = recovery ? "Choose a new password." : signup ? "Create your STRATOS account." : "Your workspace, kept yours.";
  authSubmit.querySelector("span:first-child").textContent = recovery ? "Save new password" : signup ? "Create account" : "Sign in";
  authForgot.hidden = signup || recovery;
  setAuthMessage("");
}
function renderDailyUsage(usage) {
  const limit = Number(usage?.limit) || 10;
  const remainingValue = Number(usage?.remaining);
  if (!Number.isFinite(remainingValue)) {
    dailyAnalysesRemaining = null;
    dailyUsageNumber.textContent = "—";
    dailyUsageCaption.textContent = "COUNT UNAVAILABLE";
    dailyUsageProgress.style.strokeDashoffset = "100";
    dailyUsage.classList.remove("is-empty");
    dailyUsage.setAttribute("aria-label","Daily analysis count unavailable");
    return;
  }
  const remaining = Math.max(0,Math.min(limit,Math.floor(remainingValue)));
  dailyAnalysesRemaining = remaining;
  dailyUsageNumber.textContent = String(remaining);
  dailyUsageCaption.textContent = remaining === 0 ? "NONE LEFT TODAY" : remaining + " LEFT TODAY";
  dailyUsageProgress.style.strokeDashoffset = String(100 - (remaining / limit * 100));
  dailyUsage.classList.toggle("is-empty",remaining === 0);
  dailyUsage.setAttribute("aria-label",remaining + " of " + limit + " analyses remaining today");
}

async function refreshDailyUsage() {
  const requestId = ++dailyUsageRequest;
  const token = currentAuthSession?.access_token;
  if (!token) {
    renderDailyUsage(null);
    return;
  }
  try {
    const response = await fetch("/api/usage",{
      method:"GET",
      headers:{"Authorization":"Bearer " + token}
    });
    const data = await response.json().catch(()=>({}));
    if (requestId !== dailyUsageRequest) return;
    if (!response.ok) throw new Error("Daily allowance unavailable");
    renderDailyUsage(data);
  } catch(error) {
    if (requestId === dailyUsageRequest) renderDailyUsage(null);
  }
}

function applyAuthSession(session) {
  currentAuthSession = session || null;
  const signedIn = Boolean(session?.user);
  authPanel.hidden = signedIn;
  accountMenuToggle.hidden = !signedIn || authMode === "recovery";
  document.querySelector(".workspace").hidden = !signedIn;
  if (!signedIn) {
    document.getElementById("results").hidden = true;
    accountMenu.hidden = true;
    accountMenuToggle.setAttribute("aria-expanded","false");
    accountDisplayName.textContent = "Account";
    historyLoadRequest++;
    savedAnalysisRecords = [];
    renderSavedHistory();
    dailyUsageRequest++;
    renderDailyUsage(null);
  } else {
    const metadata = session.user.user_metadata || {};
    const displayName = String(metadata.full_name || metadata.name || "").trim() || "Account";
    accountDisplayName.textContent = displayName;
    loadSavedHistory(session.user.id);
    refreshDailyUsage();
    // The workspace was hidden until authentication completed. Observe it only
    // after it has entered the layout so its entrance animations can run.
    requestAnimationFrame(() => revealAllWithin(document.querySelector(".workspace")));
  }
}
try {
  if (window.supabase?.createClient && window.STRATOS_SUPABASE_URL && window.STRATOS_SUPABASE_PUBLISHABLE_KEY) {
    authClient = window.supabase.createClient(
      window.STRATOS_SUPABASE_URL,
      window.STRATOS_SUPABASE_PUBLISHABLE_KEY,
      {auth:{
        persistSession:true,
        autoRefreshToken:true,
        detectSessionInUrl:true,
        flowType:"pkce",
        storageKey:"stratoslawyer-auth-v1"
      }}
    );
    window.STRATOS_AUTH_CLIENT = authClient;
    authClient.auth.onAuthStateChange((event,session) => {
      applyAuthSession(session);
      if (event === "PASSWORD_RECOVERY") {
        authPanel.hidden = false;
        accountMenu.hidden = true;
        accountMenuToggle.hidden = true;
        document.querySelector(".workspace").hidden = true;
        setAuthMode("recovery");
        setAuthMessage("Choose a new password for your account.");
      }
    });
    authClient.auth.getSession().then(({data,error}) => {
      if (error) throw error;
      applyAuthSession(data.session);
    }).catch(() => {
      applyAuthSession(null);
      setAuthMessage("");
    });
  } else {
    applyAuthSession(null);
    setAuthMessage("");
  }
} catch (error) {
  applyAuthSession(null);
  setAuthMessage("");
}
authSigninTab.addEventListener("click",() => setAuthMode("signin"));
authSignupTab.addEventListener("click",() => setAuthMode("signup"));
authForm.addEventListener("submit",async event => {
  event.preventDefault();
  if (!authClient) return setAuthMessage("Account access is not available right now. Please refresh the page.",true);
  const email = authEmail.value.trim().toLowerCase();
  const password = authPassword.value;
  if (!email || !authEmail.validity.valid) return setAuthMessage("Enter a valid email address.",true);
  if (password.length < 8) return setAuthMessage("Use a password with at least 8 characters.",true);
  if (authMode === "signup" && !authName.value.trim()) return setAuthMessage("Enter your name to create the account.",true);
  authSubmit.disabled = true;
  setAuthMessage(authMode==="signup" ? "Creating your account..." : authMode==="recovery" ? "Updating your password..." : "Signing in...");
  try {
    if (authMode === "signup") {
      const {data,error} = await authClient.auth.signUp({
        email,password,
        options:{data:{full_name:authName.value.trim()}}
      });
      if (error) throw error;
      if (data.session) {
        applyAuthSession(data.session);
        setAuthMessage("Your account is ready.");
      } else {
        setAuthMessage("We couldn't complete account creation. Please try again.",true);
      }
    } else if (authMode === "recovery") {
      const {error} = await authClient.auth.updateUser({password});
      if (error) throw error;
      await authClient.auth.signOut({scope:"local"});
      authPassword.value = "";
      setAuthMode("signin");
      setAuthMessage("Password updated. Sign in with your new password.");
    } else {
      const {data,error} = await authClient.auth.signInWithPassword({email,password});
      if (error) throw error;
      applyAuthSession(data.session);
      setAuthMessage("");
    }
  } catch(error) {
    setAuthMessage(authMode==="signup" ? "We couldn't create your account. Check your details and try again." : authMode==="recovery" ? "We couldn't update your password. Please try again." : "Those sign-in details don't match. Check them and try again.",true);
  } finally {
    authSubmit.disabled = false;
  }
});
authForgot.addEventListener("click",async () => {
  if (!authClient) return setAuthMessage("Account access is not available right now.",true);
  const email = authEmail.value.trim().toLowerCase();
  if (!email || !authEmail.validity.valid) return setAuthMessage("Enter your account email first, then choose Forgot password.",true);
  authForgot.disabled = true;
  setAuthMessage("Sending the password reset link...");
  try {
    const {error} = await authClient.auth.resetPasswordForEmail(email,{redirectTo:window.location.origin + "/"});
    if (error) throw error;
    setAuthMessage("If an account exists for that email, a password reset link will be sent. Check your inbox.");
  } catch(error) {
    setAuthMessage("We couldn't send a reset link right now. Please try again later.",true);
  } finally {
    authForgot.disabled = false;
  }
});
function clearCaseWorkspace() {
  currentAnalysisMarkdown = "";
  document.querySelectorAll(".workspace input:not([type=file]),.workspace textarea,.workspace select").forEach(field => {
    field.value = "";
  });
  const fileInput = document.getElementById("file-input");
  if (fileInput) fileInput.value = "";
  if (Array.isArray(selectedFiles)) selectedFiles.splice(0);
  document.getElementById("file-list").replaceChildren();
  document.getElementById("analysis-output").replaceChildren();
  document.getElementById("analysis-nav").replaceChildren();
  document.getElementById("results").hidden = true;
  document.getElementById("progress-panel").hidden = true;
  document.getElementById("error-message").hidden = true;
  updateAnalyzeReadiness();
}

function getHistoryStorageKey(userId) {
  return "stratos-saved-analyses-v1:" + userId;
}
function captureIntakeSnapshot() {
  const snapshot = {};
  document.querySelectorAll(".intake-accordions input[id], .intake-accordions select[id], .intake-accordions textarea[id]").forEach(field => {
    if (field.id !== "file-input") snapshot[field.id] = field.value;
  });
  return snapshot;
}
function normalizeCloudAnalysis(row) {
  return {
    id:row.id,
    title:row.title || "Case analysis",
    savedAt:row.saved_at || row.updated_at || new Date().toISOString(),
    updatedAt:row.updated_at || row.saved_at || new Date().toISOString(),
    markdown:row.markdown || "",
    snapshot:row.intake_snapshot && typeof row.intake_snapshot === "object" ? row.intake_snapshot : {},
    favorite:Boolean(row.is_favorite),
    deadlines:Array.isArray(row.deadlines) ? row.deadlines : []
  };
}
async function loadSavedHistory(userId) {
  const requestId = ++historyLoadRequest;
  historyList.replaceChildren();
  historyEmpty.hidden = true;
  historyFeedback.hidden = true;
  try {
    const {data,error} = await authClient.from("saved_analyses")
      .select("id,title,markdown,intake_snapshot,is_favorite,deadlines,saved_at,updated_at")
      .eq("user_id",userId)
      .order("updated_at",{ascending:false})
      .limit(100);
    if (error) throw error;
    if (requestId !== historyLoadRequest || currentAuthSession?.user?.id !== userId) return;
    savedAnalysisRecords = (data || []).map(normalizeCloudAnalysis);
    renderSavedHistory();
    // Migrate older browser-only saved analyses once, without overwriting cloud records.
    const legacyKey = getHistoryStorageKey(userId);
    let legacy = [];
    try { legacy = JSON.parse(localStorage.getItem(legacyKey) || "[]"); } catch(error) {}
    if (savedAnalysisRecords.length === 0 && Array.isArray(legacy) && legacy.length) {
      const migrated = legacy.slice(0,30).filter(item => item && typeof item.markdown === "string").map(item => ({
        id:crypto.randomUUID(),
        user_id:userId,
        title:String(item.title || "Case analysis").slice(0,160),
        markdown:item.markdown,
        intake_snapshot:{},
        is_favorite:false,
        deadlines:[],
        saved_at:item.savedAt || new Date().toISOString()
      }));
      if (migrated.length) {
        const {data:migratedRows,error:migrateError} = await authClient.from("saved_analyses").insert(migrated).select("id,title,markdown,intake_snapshot,is_favorite,deadlines,saved_at,updated_at");
        if (migrateError) throw migrateError;
        if (requestId !== historyLoadRequest || currentAuthSession?.user?.id !== userId) return;
        savedAnalysisRecords = (migratedRows || []).map(normalizeCloudAnalysis);
        try { localStorage.removeItem(legacyKey); } catch(error) {}
        renderSavedHistory();
      }
    }
  } catch(error) {
    if (requestId !== historyLoadRequest || currentAuthSession?.user?.id !== userId) return;
    savedAnalysisRecords = [];
    renderSavedHistory();
    historyFeedback.textContent = "Your saved cases could not be loaded. Please refresh and try again.";
    historyFeedback.hidden = false;
  }
}
function renderSavedHistory() {
  historyList.replaceChildren();
  historyCount.textContent = String(savedAnalysisRecords.length);
  const query = (historySearch?.value || "").trim().toLowerCase();
  const filter = historyFilter?.value || "all";
  const now = new Date();
  const filtered = savedAnalysisRecords.filter(record => {
    const snapshot = record.snapshot || {};
    const searchable = [record.title,snapshot.court,snapshot.jurisdiction,snapshot.parties,snapshot["case-type"],snapshot["case-description"],record.savedAt,record.updatedAt,new Date(record.savedAt).toLocaleDateString()].join(" ").toLowerCase();
    if (query && !searchable.includes(query)) return false;
    if (filter === "favorites" && !record.favorite) return false;
    if (filter === "recent" && now - new Date(record.updatedAt || record.savedAt) > 7 * 86400000) return false;
    if (filter === "deadlines" && !(record.deadlines || []).some(item => item.date && new Date(item.date + "T23:59:59") >= new Date(now.toDateString()))) return false;
    return true;
  });
  historyEmpty.hidden = filtered.length > 0;
  historyEmpty.textContent = savedAnalysisRecords.length ? "No cases match this search or filter." : "Your saved analyses will appear here.";
  filtered.forEach(record => {
    const item = document.createElement("article");
    item.className = "history-item";
    const info = document.createElement("div");
    info.className = "history-item-info";
    const title = document.createElement("strong");
    title.textContent = record.title || "Case analysis";
    const date = document.createElement("small");
    date.textContent = "Updated " + new Date(record.updatedAt || record.savedAt).toLocaleString();
    info.append(title,date);
    const actions = document.createElement("div");
    actions.className = "history-item-actions";
    const makeButton = (label,handler,extraClass="") => {
      const button = document.createElement("button");
      button.type = "button";
      button.textContent = label;
      if (extraClass) button.className = extraClass;
      button.addEventListener("click",handler);
      return button;
    };
    actions.append(
      makeButton("Resume case",() => resumeSavedCase(record)),
      makeButton(record.favorite ? "★ Favourited" : "☆ Favourite",() => updateSavedRecord(record,{favorite:!record.favorite})),
      makeButton("Rename",() => {
        const next = window.prompt("Enter a name for this case",record.title || "");
        if (next && next.trim()) updateSavedRecord(record,{title:next.trim().slice(0,160)});
      }),
      makeButton("Delete",() => {
        if (window.confirm("Delete this saved case and its analysis? This cannot be undone.")) deleteSavedRecord(record);
      },"history-delete")
    );
    const download = document.createElement("select");
    download.className = "history-download";
    download.setAttribute("aria-label","Download " + (record.title || "analysis"));
    download.innerHTML = '<option value="">Download</option><option value="pdf">PDF</option><option value="docx">Word (.docx)</option><option value="md">Markdown</option><option value="txt">Text</option><option value="html">HTML</option>';
    download.addEventListener("change",() => { if(download.value) exportAnalysis(record,download.value); download.value = ""; });
    actions.append(download);
    item.append(info,actions);

    const deadlineSection = document.createElement("div");
    deadlineSection.className = "case-deadlines";
    const deadlineHeading = document.createElement("strong");
    deadlineHeading.textContent = "Case deadlines and next steps";
    deadlineSection.append(deadlineHeading);
    (record.deadlines || []).slice().sort((a,b)=>String(a.date).localeCompare(String(b.date))).forEach(deadline => {
      const line = document.createElement("div");
      line.className = "case-deadline-row";
      const label = document.createElement("span");
      const due = new Date(deadline.date + "T00:00:00");
      const today = new Date(); today.setHours(0,0,0,0);
      label.textContent = deadline.title + " · " + due.toLocaleDateString() + (due < today ? " · OVERDUE" : due.getTime() === today.getTime() ? " · TODAY" : "");
      const remove = makeButton("Remove",() => updateSavedRecord(record,{deadlines:(record.deadlines || []).filter(item=>item.id!==deadline.id)}));
      line.append(label,remove);
      deadlineSection.append(line);
    });
    const deadlineForm = document.createElement("form");
    deadlineForm.className = "deadline-form";
    const deadlineTitle = document.createElement("input");
    deadlineTitle.type = "text"; deadlineTitle.placeholder = "Hearing, filing or next step"; deadlineTitle.maxLength = 120; deadlineTitle.required = true;
    const deadlineDate = document.createElement("input");
    deadlineDate.type = "date"; deadlineDate.required = true;
    const deadlineAdd = document.createElement("button");
    deadlineAdd.type = "submit"; deadlineAdd.textContent = "Add";
    deadlineForm.append(deadlineTitle,deadlineDate,deadlineAdd);
    deadlineForm.addEventListener("submit",event => {
      event.preventDefault();
      const titleValue = deadlineTitle.value.trim();
      const dateValue = deadlineDate.value;
      if (!titleValue || !dateValue) return;
      updateSavedRecord(record,{deadlines:[...(record.deadlines || []),{id:crypto.randomUUID(),title:titleValue,date:dateValue}].slice(0,30)});
    });
    deadlineSection.append(deadlineForm);
    item.append(deadlineSection);
    historyList.append(item);
  });
}
async function updateSavedRecord(record,changes) {
  if (!currentAuthSession?.user?.id) return;
  const updated = {...record,...changes,updatedAt:new Date().toISOString()};
  const payload = {
    title:updated.title,
    markdown:updated.markdown,
    intake_snapshot:updated.snapshot || {},
    is_favorite:Boolean(updated.favorite),
    deadlines:Array.isArray(updated.deadlines) ? updated.deadlines : [],
    updated_at:updated.updatedAt
  };
  const {error} = await authClient.from("saved_analyses").update(payload).eq("id",record.id).eq("user_id",currentAuthSession.user.id);
  if (error) {
    historyFeedback.textContent = "That change could not be saved. Please try again.";
    historyFeedback.hidden = false;
    return;
  }
  savedAnalysisRecords = savedAnalysisRecords.map(item=>item.id===record.id?updated:item);
  renderSavedHistory();
}
async function deleteSavedRecord(record) {
  if (!currentAuthSession?.user?.id) return;
  const {error} = await authClient.from("saved_analyses").delete().eq("id",record.id).eq("user_id",currentAuthSession.user.id);
  if (error) {
    historyFeedback.textContent = "This case could not be deleted. Please try again.";
    historyFeedback.hidden = false;
    return;
  }
  savedAnalysisRecords = savedAnalysisRecords.filter(item=>item.id!==record.id);
  renderSavedHistory();
}
function resumeSavedCase(record) {
  Object.entries(record.snapshot || {}).forEach(([id,value]) => {
    const field = document.getElementById(id);
    if (field && field.id !== "file-input") field.value = value == null ? "" : String(value);
  });
  selectedFiles.splice(0,selectedFiles.length);
  if (typeof renderFiles === "function") renderFiles();
  if (typeof updateAnalyzeReadiness === "function") updateAnalyzeReadiness();
  currentAnalysisMarkdown = record.markdown;
  currentAnalysisTitle = record.title || "Case analysis";
  document.getElementById("save-analysis").disabled = false;
  document.getElementById("save-analysis").textContent = "Save analysis";
  renderAnalysis(record.markdown);
  results.hidden = false;
  results.classList.toggle("focus-mode",focusVisualMode);
  requestAnimationFrame(() => revealAllWithin(results));
  accountMenu.hidden = true;
  accountMenuToggle.setAttribute("aria-expanded","false");
  historyPanel.hidden = true;
  menuHistoryToggle.setAttribute("aria-expanded","false");
  document.querySelector(".workspace").scrollIntoView({behavior:"smooth",block:"start"});
}
async function persistSavedRecord(record) {
  if (!currentAuthSession?.user?.id) return false;
  const payload = {
    id:record.id,
    user_id:currentAuthSession.user.id,
    title:record.title,
    markdown:record.markdown,
    intake_snapshot:record.snapshot || {},
    is_favorite:Boolean(record.favorite),
    deadlines:Array.isArray(record.deadlines) ? record.deadlines : [],
    saved_at:record.savedAt,
    updated_at:record.updatedAt || record.savedAt
  };
  const {error} = await authClient.from("saved_analyses").upsert(payload,{onConflict:"id"});
  if (error) return false;
  return true;
}
function buildHistorySnapshot() {
  return captureIntakeSnapshot();
}
function buildAnalysisTitle() {
  const type = document.getElementById("case-type")?.value || "";
  const court = document.getElementById("court")?.value.trim() || "";
  const jurisdiction = document.getElementById("jurisdiction")?.value.trim() || "";
  return [type || "Case analysis",court,jurisdiction].filter(Boolean).join(" · ").slice(0,110);
}
function markdownToPlainText(markdown) {
  return String(markdown || "").replace(/^#{1,6}\s*/gm,"").replace(/\*\*(.*?)\*\*/g,"$1").replace(/\*(.*?)\*/g,"$1").replace(/^`{1,3}.*$/gm,"").replace(/^[-*+]\s/gm,"• ").replace(/^\d+\.\s/gm,"• ").replace(/\n{3,}/g,"\n\n");
}
let docxLibraryPromise = null;
function loadDocxLibrary() {
  if (window.docx?.Document && window.docx?.Packer) return Promise.resolve(window.docx);
  if (!docxLibraryPromise) {
    docxLibraryPromise = new Promise((resolve,reject) => {
      const script = document.createElement("script");
      script.src = "https://cdn.jsdelivr.net/npm/docx@8.5.0/build/index.umd.js";
      script.async = true;
      script.onload = () => window.docx?.Document && window.docx?.Packer
        ? resolve(window.docx)
        : reject(new Error("Word export library unavailable"));
      script.onerror = () => reject(new Error("Word export library could not be loaded"));
      document.head.append(script);
    }).catch(error => {
      docxLibraryPromise = null;
      throw error;
    });
  }
  return docxLibraryPromise;
}
async function exportAnalysis(record,format) {
  const title = record.title || "Case analysis";
  const markdown = record.markdown || "";
  const plain = markdownToPlainText(markdown);
  const filename = (title.toLowerCase().replace(/[^a-z0-9]+/g,"-").replace(/^-|-$/g,"").slice(0,55) || "case-analysis");
  if (format === "pdf") {
    const printWindow = window.open("","_blank");
    if (!printWindow) return;
    const safeTitle = title.replace(/[&<>"']/g,char=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[char]));
    const safeText = plain.replace(/[&<>"']/g,char=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[char]));
    printWindow.document.write('<!doctype html><html><head><title>'+safeTitle+'</title><style>body{font:12pt/1.65 Arial,sans-serif;max-width:850px;margin:40px auto;padding:0 24px;color:#20242a}h1{font-size:22pt}pre{white-space:pre-wrap;font:inherit}footer{margin-top:32px;color:#666;font-size:9pt}@media print{body{margin:18mm auto}}</style></head><body><h1>'+safeTitle+'</h1><pre>'+safeText+'</pre><footer>STRATOSLAWYER · Saved case analysis</footer><script>window.onload=()=>window.print()</script></body></html>');
    printWindow.document.close();
    return;
  }
  if (format === "docx") {
    let library;
    try {
      library = await loadDocxLibrary();
    } catch(error) {
      downloadBlob(plain,"text/plain;charset=utf-8",filename+".txt");
      return;
    }
    const {Document,Paragraph,TextRun,HeadingLevel,Packer}=library;
    const paragraphs = [new Paragraph({text:title,heading:HeadingLevel.TITLE})];
    markdown.split("\n").forEach(line => {
      const clean = line.replace(/^#{1,6}\s*/,"").replace(/\*\*(.*?)\*\*/g,"$1").trim();
      if (!clean) { paragraphs.push(new Paragraph({text:""})); return; }
      const heading = line.match(/^(#{1,3})\s+(.*)$/);
      paragraphs.push(new Paragraph({
        children:[new TextRun(clean)],
        ...(heading ? {heading:heading[1].length===1?HeadingLevel.HEADING_1:heading[1].length===2?HeadingLevel.HEADING_2:HeadingLevel.HEADING_3} : {})
      }));
    });
    const doc = new Document({sections:[{properties:{},children:paragraphs}]});
    Packer.toBlob(doc).then(blob=>downloadBlob(blob,"application/vnd.openxmlformats-officedocument.wordprocessingml.document",filename+".docx")).catch(()=>downloadBlob(plain,"text/plain;charset=utf-8",filename+".txt"));
    return;
  }
  if (format === "md") return downloadBlob(markdown,"text/markdown;charset=utf-8",filename+".md");
  if (format === "txt") return downloadBlob(plain,"text/plain;charset=utf-8",filename+".txt");
  if (format === "html") {
    const escaped = plain.replace(/[&<>"']/g,char=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[char]));
    const safeTitle = title.replace(/[&<>"']/g,char=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[char]));
    return downloadBlob("<!doctype html><meta charset=utf-8><title>"+safeTitle+"</title><h1>"+safeTitle+"</h1><pre>"+escaped+"</pre>","text/html;charset=utf-8",filename+".html");
  }
  return downloadBlob(plain,"text/plain;charset=utf-8",filename+".txt");
}
function downloadBlob(content,type,filename) {
  const blob = content instanceof Blob ? content : new Blob([content],{type});
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url; anchor.download = filename; document.body.append(anchor); anchor.click(); anchor.remove();
  setTimeout(()=>URL.revokeObjectURL(url),1500);
}
document.getElementById("save-analysis").addEventListener("click",async () => {
  if (!currentAnalysisMarkdown || !currentAuthSession?.user) return;
  const saveButton = document.getElementById("save-analysis");
  saveButton.disabled = true;
  saveButton.textContent = "Saving…";
  const now = new Date().toISOString();
  const record = {
    id:crypto.randomUUID(),
    title:String(currentAnalysisTitle || "Case analysis").slice(0,160),
    savedAt:now,
    updatedAt:now,
    markdown:currentAnalysisMarkdown,
    snapshot:buildHistorySnapshot(),
    favorite:false,
    deadlines:[]
  };
  const saved = await persistSavedRecord(record);
  if (!saved) {
    saveButton.disabled = false;
    saveButton.textContent = "Save analysis";
    historyFeedback.textContent = "This case could not be saved to your account. Please try again.";
    historyFeedback.hidden = false;
    accountMenu.hidden = false;
    accountMenuToggle.setAttribute("aria-expanded","true");
    historyPanel.hidden = false;
    menuHistoryToggle.setAttribute("aria-expanded","true");
    return;
  }
  savedAnalysisRecords = [record,...savedAnalysisRecords.filter(item=>item.id!==record.id)];
  renderSavedHistory();
  historyFeedback.hidden = true;
  saveButton.textContent = "Saved";
  saveButton.disabled = true;
});
accountMenuToggle.addEventListener("click",() => {
  const open = accountMenu.hidden;
  accountMenu.hidden = !open;
  accountMenuToggle.setAttribute("aria-expanded",String(open));
});
historySearch.addEventListener("input",renderSavedHistory);
historyFilter.addEventListener("change",renderSavedHistory);
menuHistoryToggle.addEventListener("click",() => {
  const open = historyPanel.hidden;
  historyPanel.hidden = !open;
  menuHistoryToggle.setAttribute("aria-expanded",String(open));
});
document.addEventListener("click",event => {
  if (!event.target.closest(".account-menu-wrap")) {
    accountMenu.hidden = true;
    accountMenuToggle.setAttribute("aria-expanded","false");
  }
});
document.addEventListener("keydown",event => {
  if (event.key === "Escape") {
    accountMenu.hidden = true;
    accountMenuToggle.setAttribute("aria-expanded","false");
  }
});
authSignout.addEventListener("click",async () => {
  if (!authClient) return;
  authSignout.disabled = true;
  try {
    const {error} = await authClient.auth.signOut({scope:"local"});
    if (error) throw error;
    applyAuthSession(null);
    clearCaseWorkspace();
    authPassword.value = "";
    setAuthMode("signin");
    setAuthMessage("You have signed out of this device.");
  } catch(error) {
    setAuthMessage("Sign out didn't work. Please try again.",true);
  } finally {
    authSignout.disabled = false;
  }
});

const input = document.getElementById("file-input");
// Persistent app-wide light/dark appearance control.
const themeToggle=document.getElementById("theme-toggle");
function applyTheme(theme){
  const light=theme==="light";
  document.documentElement.dataset.theme=light?"light":"dark";
  document.documentElement.style.colorScheme=light?"light":"dark";
  themeToggle.setAttribute("aria-pressed",String(light));
  themeToggle.setAttribute("aria-label",light?"Switch to dark mode":"Switch to light mode");
  themeToggle.querySelector(".theme-label").textContent=light?"Dark mode":"Light mode";
  themeToggle.querySelector(".theme-glyph").textContent=light?"☾":"☼";
}
let savedTheme="dark";
try{savedTheme=localStorage.getItem("stratos-theme")==="light"?"light":"dark";}catch(error){}
applyTheme(savedTheme);
themeToggle.addEventListener("click",()=>{
  const next=document.documentElement.dataset.theme==="light"?"dark":"light";
  applyTheme(next);
  try{localStorage.setItem("stratos-theme",next);}catch(error){}
});

const dropZone = document.getElementById("drop-zone");
const fileList = document.getElementById("file-list");
const description = document.getElementById("case-description");
const intakeFieldIds = ["case-type","case-role","case-stage","court","jurisdiction","next-date","relief","opponent-conduct","parties","opponent-position","orders-documents","client-objective","own-evidence","own-witnesses","opponent-evidence","opponent-witnesses"];
const analyzeButton = document.getElementById("analyze-button");
const errorMessage = document.getElementById("error-message");
const progressPanel = document.getElementById("progress-panel");
const progressTitle = document.getElementById("progress-title");
const progressDetail = document.getElementById("progress-detail");
const waitingInsight = document.getElementById("waiting-insight");
const results = document.getElementById("results");
const workspace = document.querySelector(".workspace");
const intakeAccordions = document.querySelector(".intake-accordions");
const output = document.getElementById("analysis-output");
const selectedFiles = [];

const waitingInsights = [
  "People often defend the version of events that makes their choices look inevitable. Ask what their account quietly needs you not to examine.",
  "A decision is a door that closes other doors. Before choosing, notice which options disappear simply because time passes.",
  "The most useful piece of information is not always the missing fact. It may be the fact that would make every other fact mean something different.",
  "An opponent's strongest position may depend on a weakness they cannot afford to acknowledge.",
  "Do not mistake a confident explanation for a complete one. Confidence describes the speaker; completeness describes the evidence.",
  "Some problems survive because everyone keeps solving the version that is easiest to describe.",
  "A deadline does more than limit time. It changes the value of every option still available.",
  "The first story that fits the facts can become a trap when later facts are forced to fit it.",
  "An advantage that cannot be preserved is often only a temporary feeling of strength.",
  "Ask what must be true for the other side's position to work. Then test those conditions one by one.",
  "Silence is not always consent, and activity is not always resistance. Context gives conduct its meaning.",
  "A weak point becomes strategically important when it connects to something the decision-maker must resolve.",
  "The best next move may be the smallest move that makes the next uncertainty observable.",
  "Every plan contains a prediction. Name it, or it will disguise itself as a fact.",
  "Do not spend effort disproving a claim that does not matter to the outcome.",
  "Two people can agree on every event and still disagree about what those events prove.",
  "The order in which facts are discovered can shape the story people believe. Revisit the facts in a different order.",
  "A useful question does not merely request information; it separates two competing explanations.",
  "Sometimes the costliest assumption is the one nobody thought needed to be stated.",
  "An option has value before it is used. Preserve it long enough to learn whether it is needed.",
  "Where incentives change, behaviour may change with them. Study what each person stands to gain next.",
  "An unanswered question is not automatically a weakness. It becomes one when a decision depends on its answer.",
  "Do not confuse a plausible sequence with a proven sequence. A gap between events may contain the whole dispute.",
  "The strongest response may be to change the question everyone is trying to answer.",
  "Every system has a point where its formal rules meet human discretion. Learn where that boundary actually lies.",
  "Look for the quiet dependency: the person, document, assumption or event without which the plan cannot proceed.",
  "An early concession can be intelligent when it protects something more valuable. Know the exchange rate.",
  "People reveal priorities through what they protect when resources become scarce.",
  "Do not let the volume of evidence obscure the difference between evidence that exists and evidence that proves.",
  "The timing of a fact can matter as much as its content. Ask when it became known and who knew it.",
  "A forecast is useful only when you can identify what would prove it wrong.",
  "Sometimes the apparent obstacle is performing a useful function: it is preventing a worse move.",
  "Separate what can be changed from what can only be managed. Mixing the two wastes attention.",
  "A position may be legally available yet practically costly. Analyse both realities without confusing them.",
  "Before escalating, identify the precise change you expect escalation to produce.",
  "The person who controls the sequence of decisions may shape the result without controlling the final decision.",
  "A clean explanation is not necessarily the true explanation. Reality often leaves seams.",
  "One verified detail can be worth more than ten confident impressions.",
  "Do not ask only who benefits from an outcome. Ask who had the ability, opportunity and reason to bring it about.",
  "The safest plan is not always the most passive one. Inaction also creates consequences.",
  "A useful contingency is specific enough to act on and modest enough to remain realistic.",
  "An argument can be logically sound and still fail because it answers a question nobody needs to decide.",
  "Look for the moment when a reversible choice becomes irreversible. That is often where attention belongs.",
  "Good preparation does not eliminate surprise. It reduces the number of surprises that can become disasters.",
  "The other side's mistake is not your advantage until you understand whether it can be corrected.",
  "Evidence has a lifecycle: creation, custody, interpretation, challenge and use. Weakness can enter at any stage.",
  "Do not optimise for appearing decisive. Optimise for making the next decision better informed.",
  "A small inconsistency can be noise; a pattern of inconsistencies may reveal the structure beneath the story.",
  "The purpose of analysis is not to make uncertainty disappear. It is to stop uncertainty from making decisions invisibly.",
  "Sometimes the decisive move is to preserve the ability to choose again."
];
const waitingInsightSlots = [...(waitingInsight?.querySelectorAll(".waiting-quote") || [])];
let waitingInsightTimer = null;
let waitingInsightPrevious = [];
let waitingInsightGeneration = 0;
const waitingInsightTimeouts = new Set();
function scheduleInsightTask(callback,delay,generation){
  const timer=window.setTimeout(()=>{
    waitingInsightTimeouts.delete(timer);
    if(generation===waitingInsightGeneration)callback();
  },delay);
  waitingInsightTimeouts.add(timer);
  return timer;
}
function stopWaitingInsights(){
  waitingInsightGeneration++;
  if(waitingInsightTimer){clearTimeout(waitingInsightTimer);waitingInsightTimeouts.delete(waitingInsightTimer);waitingInsightTimer=null;}
  waitingInsightTimeouts.forEach(timer=>clearTimeout(timer));
  waitingInsightTimeouts.clear();
  waitingInsightSlots.forEach(slot=>slot.classList.remove("is-writing"));
}
function shuffledInsights(){
  const pool=waitingInsights.map((_,i)=>i).filter(i=>!waitingInsightPrevious.includes(i));
  for(let i=pool.length-1;i>0;i--){
    const j=Math.floor(Math.random()*(i+1));
    [pool[i],pool[j]]=[pool[j],pool[i]];
  }
  return pool;
}
function typeInsight(slot,index,delay,generation){
  const textNode=slot.querySelector(".waiting-quote-text");
  const counter=slot.querySelector(".waiting-quote-index");
  if(!textNode||!counter)return;
  const fullText=waitingInsights[index];
  textNode.textContent="";
  counter.textContent=String(index+1).padStart(2,"0")+" / 50";
  slot.classList.remove("is-writing");
  scheduleInsightTask(()=>{
    if(generation!==waitingInsightGeneration||!slot.isConnected)return;
    slot.classList.add("is-writing");
    let cursor=0;
    const write=()=>{
      if(generation!==waitingInsightGeneration||!slot.isConnected)return;
      textNode.textContent=fullText.slice(0,cursor);
      cursor=Math.min(fullText.length,cursor+1);
      if(cursor<fullText.length)scheduleInsightTask(write,48,generation);
    };
    write();
  },delay,generation);
}
function startWaitingInsights(){
  stopWaitingInsights();
  if(!waitingInsight||waitingInsightSlots.length!==3)return;
  waitingInsightPrevious=[];
  const generation=waitingInsightGeneration;
  const showSet=()=>{
    if(generation!==waitingInsightGeneration)return;
    const order=shuffledInsights();
    const chosen=order.slice(0,3);
    waitingInsightPrevious=chosen;
    waitingInsightSlots.forEach((slot,i)=>typeInsight(slot,chosen[i],i*900,generation));
    // A variable pause keeps the next set from feeling like a fixed carousel.
    const pause=45000+Math.floor(Math.random()*15001);
    waitingInsightTimer=scheduleInsightTask(showSet,pause,generation);
  };
  showSet();
}

// Require enough usable material before spending an API request.
// Unknown fields may remain blank; the gate checks breadth and substance, not every field.
const intakeCoverageGroups = [
  ["case-type","case-role","parties","relief","client-objective"],
  ["case-stage","court","jurisdiction","next-date","orders-documents"],
  ["opponent-position","opponent-conduct"],
  ["own-evidence","own-witnesses","opponent-evidence","opponent-witnesses"]
];
function inspectIntakeQuality() {
  const completed = intakeFieldIds.filter(id => String(document.getElementById(id)?.value || "").trim());
  const coveredGroups = intakeCoverageGroups.filter(group => group.some(id => String(document.getElementById(id)?.value || "").trim()));
  const hasSubstantiveNarrative = description.value.trim().length >= 120;
  const hasDocuments = selectedFiles.length > 0;
  const enoughStructuredDetail = completed.length >= 5 && coveredGroups.length >= 3;
  const enoughSourceMaterial = hasSubstantiveNarrative || hasDocuments;
  return {
    ready: enoughStructuredDetail && enoughSourceMaterial,
    completedCount: completed.length,
    groupCount: coveredGroups.length,
    hasSubstantiveNarrative,
    hasDocuments,
    message: [
      !enoughStructuredDetail ? "Complete at least 5 relevant case fields across at least 3 different sections." : "",
      !enoughSourceMaterial ? "Add a case description of at least 120 characters or upload at least one case document." : ""
    ].filter(Boolean).join(" ")
  };
}
function updateAnalyzeReadiness() {
  const quality = inspectIntakeQuality();
  analyzeButton.classList.toggle("is-intake-ready", quality.ready);
  analyzeButton.setAttribute("data-intake-progress", quality.ready ? "DETAILS READY" : "MORE DETAILS NEEDED");
}
intakeAccordions.addEventListener("input", event => {
  if (event.target && (intakeFieldIds.includes(event.target.id) || event.target.id === "case-description")) updateAnalyzeReadiness();
});
intakeAccordions.addEventListener("change", event => {
  if (event.target && (intakeFieldIds.includes(event.target.id) || event.target.id === "case-description")) updateAnalyzeReadiness();
});
updateAnalyzeReadiness();

const allowedTypes = new Set(["application/pdf","text/plain","text/markdown","image/jpeg","image/png","image/webp"]);
const formatSize = bytes => bytes < 1024 * 1024 ? Math.round(bytes / 1024) + " KB" : (bytes / 1024 / 1024).toFixed(1) + " MB";

function showError(message) {
  const safeMessage = /daily limit|analyses for today|all ten analyses/i.test(message)
    ? "You've used all 10 analyses for today. Your allowance resets at midnight Nigeria time."
    : /not enough information/i.test(message)
    ? "Please add more case details before starting the analysis."
    : /session|sign in/i.test(message)
      ? "Your session has ended. Please sign in again."
      : /file|upload|document/i.test(message)
        ? "One or more files could not be processed. Check the file type and size, then try again."
        : "The analysis couldn't be completed right now. Please try again.";
  errorMessage.textContent = safeMessage;
  errorMessage.hidden = false;
  requestAnimationFrame(() => revealAllWithin(errorMessage));
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
    remove.addEventListener("click",() => { selectedFiles.splice(index,1); renderFiles(); updateAnalyzeReadiness(); });
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
  updateAnalyzeReadiness();
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
function slugify(value) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g,"-").replace(/^-|-$/g,"");
}

const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
let scrollRevealObserver = null;
let analysisActiveObserver = null;

// Animate meaningful interface units, not every nested text node or icon.
// This keeps observer targets and composited layers small on mobile devices.
const revealSelector = [
  ".topbar > *",
  ".intro",
  ".workspace",
  ".intake-group",
  ".evidence-grid",
  ".freeform-wrap",
  ".upload-zone",
  ".intake-footer > *",
  ".error-message",
  ".progress-panel",
  ".results-heading > *",
  ".results-warning",
  ".analysis-card",
  ".insight-tile",
  ".page-footer > *"
].join(",");

function observeScrollElements(elements) {
  if (!elements?.length) return;
  const candidates = [...new Set(elements)].filter(element =>
    element instanceof HTMLElement &&
    !element.matches("script,style,template,[hidden]") &&
    !element.closest("[hidden]")
  );
  if (!candidates.length) return;

  // Respect the device accessibility preference. If motion is reduced, never
  // leave content waiting for an observer that intentionally will not animate.
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches ||
      !("IntersectionObserver" in window)) {
    candidates.forEach(element => {
      element.classList.add("scroll-reveal", "is-visible");
    });
    return;
  }

  if (!scrollRevealObserver) {
    try {
      scrollRevealObserver = new IntersectionObserver(entries => {
        entries.forEach(entry => {
          // Re-entering the viewport replays the entrance; leaving resets it.
          entry.target.classList.toggle("is-visible", entry.isIntersecting);
        });
      }, { root:null, rootMargin:"0px 0px -8% 0px", threshold:0.01 });
    } catch (error) {
      candidates.forEach(element => {
        element.classList.add("scroll-reveal", "is-visible");
      });
      return;
    }
  }

  candidates.forEach(element => {
    if (!element.classList.contains("scroll-reveal")) {
      element.classList.add("scroll-reveal");
      element.classList.remove("is-visible");
    }
  });

  // Two frames guarantee that the hidden starting state is painted before
  // observation can reveal an element already inside the viewport.
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      candidates.forEach(element => {
        if (element.isConnected && !element.closest("[hidden]")) {
          scrollRevealObserver.observe(element);
        }
      });
    });
  });
}
function revealAllWithin(root) {
  if (!root) return;
  const targets = [];
  if (root instanceof HTMLElement && root.matches(revealSelector)) targets.push(root);
  if (root.querySelectorAll) targets.push(...root.querySelectorAll(revealSelector));
  observeScrollElements(targets);
}
function initializePageReveals() {
  // Observe only purposeful visual units; nested copy and icons animate with their parent.
  revealAllWithin(document.querySelector(".topbar"));
  revealAllWithin(document.querySelector(".shell"));
  document.querySelectorAll(".intake-group").forEach(group => {
    group.addEventListener("toggle", () => {
      if (group.open) requestAnimationFrame(() => revealAllWithin(group));
    });
  });
}
initializePageReveals();

function addTileExpansion(tile, body) {
  const needsExpansion = body.textContent.trim().length > 0;
  if (!needsExpansion) return;
  tile.classList.add("is-collapsible");
  body.style.maxHeight = "112px";
  const toggle = document.createElement("button");
  toggle.type = "button";
  toggle.className = "tile-expand";
  toggle.textContent = "Explore details";
  toggle.setAttribute("aria-expanded", "false");
  toggle.addEventListener("click", () => {
    const expanded = !tile.classList.contains("is-expanded");
    // Always establish the current rendered height as the animation's start.
    // This prevents a class/style update in the same frame from skipping the transition.
    body.style.maxHeight = body.getBoundingClientRect().height + "px";
    void body.offsetHeight;
    requestAnimationFrame(() => {
      tile.classList.toggle("is-expanded", expanded);
      body.style.maxHeight = expanded ? body.scrollHeight + "px" : "112px";
    });
    toggle.setAttribute("aria-expanded", String(expanded));
    toggle.textContent = expanded ? "Show less" : "Explore details";
  });
  body.addEventListener("transitionend", event => {
    if (event.propertyName !== "max-height") return;
    if (tile.classList.contains("is-expanded")) body.style.maxHeight = "none";
  });
  tile.append(toggle);
}

const categorySigils = [
  '<path d="M24 3 42 13v22L24 45 6 35V13L24 3Z"/><path d="M24 12v24M12 18l24 12M36 18 12 30"/>',
  '<path d="M8 8h32v32H8z"/><path d="M14 16h20M14 24h13M14 32h17"/><path d="m30 29 4 4 8-9"/>',
  '<path d="M24 4 43 40H5L24 4Z"/><path d="M24 16v11M24 33v1"/>',
  '<circle cx="24" cy="24" r="18"/><circle cx="24" cy="24" r="10"/><path d="M24 1v8M24 39v8M1 24h8M39 24h8"/>',
  '<path d="M6 12h36v24H6z"/><path d="m6 14 18 14 18-14"/><path d="M15 36v5M33 36v5"/>',
  '<path d="M24 4 39 12v14c0 9-7 14-15 18C16 40 9 35 9 26V12l15-8Z"/><path d="m16 24 5 5 11-12"/>',
  '<path d="M24 4v40M4 24h40"/><path d="m14 14 20 20M34 14 14 34"/><circle cx="24" cy="24" r="17"/>',
  '<path d="M8 40 24 6l16 34H8Z"/><path d="M16 31h16M20 23h8"/>',
  '<path d="M7 10h34v28H7z"/><path d="M13 17h22M13 24h15M13 31h18"/><path d="M17 4v6M31 4v6"/>',
  '<path d="M7 7h34v34H7z"/><path d="M14 16h20M14 24h20M14 32h12"/><path d="m30 30 4 4 7-8"/>',
  '<circle cx="24" cy="24" r="18"/><path d="M24 13v12l8 5"/><path d="M24 3v4M45 24h-4"/>',
  '<path d="M24 4 42 14v20L24 44 6 34V14L24 4Z"/><path d="M16 24h16M24 16v16"/><circle cx="24" cy="24" r="5"/>'
];
function makeCategorySigil(index) {
  const wrap=document.createElement("span");
  wrap.className="category-sigil";
  wrap.setAttribute("aria-hidden","true");
  wrap.innerHTML='<svg viewBox="0 0 48 48" fill="none" stroke="currentColor" stroke-width="1.35" stroke-linecap="round" stroke-linejoin="round">'+categorySigils[index%categorySigils.length]+'</svg>';
  return wrap;
}
function clearCardFocus() {
  output.querySelectorAll(".is-focused,.is-dimmed").forEach(card=>card.classList.remove("is-focused","is-dimmed"));
}
function updateSlideCue(parent, index, total) {
  if (!parent) return;
  let cue = parent.querySelector(":scope > .focus-slide-cue");
  if (!cue) {
    cue = document.createElement("div");
    cue.className = "focus-slide-cue";
    cue.setAttribute("aria-hidden", "true");
    parent.append(cue);
  }
  const direction = index >= total - 1 ? "left" : "right";
  cue.dataset.direction = direction;
  cue.innerHTML = direction === "left"
    ? '<span class="cue-arrow" aria-hidden="true">←</span><span>slide…</span>'
    : '<span>slide…</span><span class="cue-arrow" aria-hidden="true">→</span>';
  cue.classList.toggle("is-active", focusVisualMode && total > 1);
}
const focusScrollFrames = new WeakMap();
function easeFocusScroll(progress) {
  // Quintic ease-out: decisive movement with a soft, controlled landing.
  return 1-Math.pow(1-progress,5);
}
function slideCardToCenter(card,container) {
  if(!card || !container) return;
  const previousFrame=focusScrollFrames.get(container);
  if(previousFrame) cancelAnimationFrame(previousFrame);

  // Temporarily disable native snap: it otherwise competes with the animated
  // scroll position and can pull the card away from the exact centre.
  container.classList.add("is-centering-card");
  const containerRect=container.getBoundingClientRect();
  const cardRect=card.getBoundingClientRect();
  const visibleLeft=containerRect.left+container.clientLeft;
  const targetRaw=container.scrollLeft+(cardRect.left-visibleLeft)-(container.clientWidth-cardRect.width)/2;
  const maxScroll=Math.max(0,container.scrollWidth-container.clientWidth);
  const target=Math.max(0,Math.min(maxScroll,targetRaw));
  const start=container.scrollLeft;
  const distance=target-start;

  const finish=()=>{
    container.scrollLeft=target;
    container.classList.remove("is-centering-card");
    focusScrollFrames.delete(container);
  };
  if(prefersReducedMotion || Math.abs(distance)<1.5){finish();return;}

  const duration=Math.min(1150,Math.max(680,Math.abs(distance)*1.05));
  const started=performance.now();
  const animate=now=>{
    const progress=Math.min(1,(now-started)/duration);
    container.scrollLeft=start+distance*easeFocusScroll(progress);
    if(progress<1) focusScrollFrames.set(container,requestAnimationFrame(animate));
    else finish();
  };
  focusScrollFrames.set(container,requestAnimationFrame(animate));
}
function focusIntakeGroup(group) {
  if(!group || !focusVisualMode) return;
  const groups=[...intakeAccordions.querySelectorAll(".intake-group")];
  groups.forEach(card=>{
    card.classList.toggle("is-focused",card===group);
    card.classList.toggle("is-dimmed",card!==group);
  });
  updateSlideCue(workspace, groups.indexOf(group), groups.length);
  slideCardToCenter(group,intakeAccordions);
  updateInputArrowState();
}
const inputArrowControls=document.createElement("div");
inputArrowControls.className="focus-arrow-controls input-focus-arrows";
inputArrowControls.hidden=true;
inputArrowControls.innerHTML='<button type="button" data-input-previous aria-label="Previous input section" title="Previous section">←</button><button type="button" data-input-next aria-label="Next input section" title="Next section">→</button>';
intakeAccordions.append(inputArrowControls);
function updateInputArrowState(){
  const groups=[...intakeAccordions.querySelectorAll(".intake-group")];
  const current=groups.findIndex(group=>group.classList.contains("is-focused"));
  const previous=inputArrowControls.querySelector("[data-input-previous]");
  const next=inputArrowControls.querySelector("[data-input-next]");
  if(previous)previous.disabled=current<=0;
  if(next)next.disabled=current<0||current>=groups.length-1;
}
inputArrowControls.querySelector("[data-input-previous]").addEventListener("click",()=>{
  const groups=[...intakeAccordions.querySelectorAll(".intake-group")];
  const current=groups.findIndex(group=>group.classList.contains("is-focused"));
  if(current>0)focusIntakeGroup(groups[current-1]);
});
inputArrowControls.querySelector("[data-input-next]").addEventListener("click",()=>{
  const groups=[...intakeAccordions.querySelectorAll(".intake-group")];
  const current=groups.findIndex(group=>group.classList.contains("is-focused"));
  if(current>=0&&current<groups.length-1)focusIntakeGroup(groups[current+1]);
});
let focusedCategoryIndex=0;
let focusedPointIndex=0;
function setFocusedCard(target) {
  if(!results.classList.contains("focus-mode")) return;
  const categories=[...output.querySelectorAll(".analysis-card")];
  const category=target.closest(".analysis-card");
  if(!category) return;
  focusedCategoryIndex=categories.indexOf(category);
  const tiles=[...category.querySelectorAll(".insight-tile")];
  const requestedTile=target.classList.contains("insight-tile")?target:null;
  focusedPointIndex=requestedTile?Math.max(0,tiles.indexOf(requestedTile)):0;
  slideCardToCenter(category,output);
  categories.forEach((card,index)=>{
    card.classList.toggle("is-focused",card===category);
    card.classList.toggle("is-dimmed",card!==category);
    card.querySelectorAll(".insight-tile").forEach((tile,tileIndex)=>{
      const selected=card===category&&tileIndex===focusedPointIndex;
      tile.classList.toggle("is-focused",selected);
      tile.classList.toggle("is-dimmed",!selected);
    });
  });
  updateSlideCue(results.querySelector(".analysis-layout"),focusedCategoryIndex,categories.length);
  updateFocusControls();
}
function getAllOutputTiles(){
  return [...output.querySelectorAll(".analysis-card")].flatMap(category=>[...category.querySelectorAll(".insight-tile")]);
}
function moveOutputTile(direction){
  const all=getAllOutputTiles();
  if(!all.length)return;
  const current=all.findIndex(tile=>tile.classList.contains("is-focused"));
  const nextIndex=Math.max(0,Math.min(all.length-1,(current<0?0:current)+direction));
  setFocusedCard(all[nextIndex]);
}
function updateFocusControls(){
  const categories=[...output.querySelectorAll(".analysis-card")];
  const category=categories[focusedCategoryIndex];
  const tiles=category?[...category.querySelectorAll(".insight-tile")]:[];
  const previous=focusControls?.querySelector("[data-focus-previous]");
  const next=focusControls?.querySelector("[data-focus-next]");
  const nextCategory=focusControls?.querySelector("[data-focus-next-category]");
  const all=getAllOutputTiles();
  const active=all.findIndex(tile=>tile.classList.contains("is-focused"));
  if(previous)previous.disabled=active<=0;
  if(next)next.disabled=active<0||active>=all.length-1;
  if(nextCategory)nextCategory.disabled=categories.length<2;
  if(nextCategory)nextCategory.textContent="Next category ("+Math.min(focusedCategoryIndex+1,categories.length)+"/"+categories.length+")";
}
const focusControls=document.createElement("div");
focusControls.className="focus-controls";
focusControls.innerHTML='<div class="focus-arrow-controls output-focus-arrows"><button type="button" data-focus-previous aria-label="Previous output card" title="Previous card">←</button><button type="button" data-focus-next aria-label="Next output card" title="Next card">→</button></div><button type="button" data-focus-next-category>Next category</button>';
focusControls.hidden=true;
focusControls.querySelector("[data-focus-previous]").addEventListener("click",()=>moveOutputTile(-1));
focusControls.querySelector("[data-focus-next]").addEventListener("click",()=>moveOutputTile(1));
focusControls.querySelector("[data-focus-next-category]").addEventListener("click",()=>{
  const categories=output.querySelectorAll(".analysis-card");
  if(!categories.length)return;
  const next=(focusedCategoryIndex+1)%categories.length;
  setFocusedCard(categories[next]);
});
let focusVisualMode=false;
const viewModeToggle=document.getElementById("view-mode-toggle");
function updateViewModeControl(){
  viewModeToggle.setAttribute("aria-pressed",String(focusVisualMode));
  viewModeToggle.setAttribute("aria-label",focusVisualMode?"Switch to standard mode":"Enable focus visual mode");
  viewModeToggle.querySelector(".mode-label").textContent=focusVisualMode?"Standard mode":"Focus visual mode";
  viewModeToggle.querySelector(".mode-glyph").textContent=focusVisualMode?"◇":"◈";
}
viewModeToggle.addEventListener("click",()=>{
  focusVisualMode=!focusVisualMode;
  workspace.classList.toggle("focus-mode",focusVisualMode);
  results.classList.toggle("focus-mode",focusVisualMode);
  focusControls.hidden=!focusVisualMode;
  inputArrowControls.hidden=!focusVisualMode;
  document.body.classList.toggle("focus-visual-active",focusVisualMode);
  if(!focusVisualMode) document.querySelectorAll(".focus-slide-cue").forEach(cue=>cue.classList.remove("is-active"));
  updateViewModeControl();
  clearCardFocus();
  intakeAccordions.querySelectorAll(".intake-group").forEach(card=>card.classList.remove("is-focused","is-dimmed"));
  if(focusVisualMode){
    const firstIntake=intakeAccordions.querySelector(".intake-group");
    if(firstIntake)focusIntakeGroup(firstIntake);
    if(!results.hidden){
      const first=output.querySelector(".analysis-card");
      if(first)setFocusedCard(first);
    }
  }
});
intakeAccordions.addEventListener("click",event=>{
  if(!focusVisualMode)return;
  const group=event.target.closest(".intake-group");
  if(group)focusIntakeGroup(group);
});
updateViewModeControl();
output.addEventListener("click",event=>{
  if(!results.classList.contains("focus-mode")) return;
  const tile=event.target.closest(".insight-tile");
  const card=event.target.closest(".analysis-card");
  setFocusedCard(tile||card);
});


function renderStructuredChart(block) {
  const code = block.querySelector("code");
  if (!code || !code.classList.contains("language-stratos-chart")) return null;
  let chart;
  try { chart = JSON.parse(code.textContent.trim()); } catch (error) { return null; }
  if (!chart || !["bar","timeline"].includes(chart.type)) return null;
  const figure = document.createElement("figure");
  figure.className = "stratos-chart";
  const heading = document.createElement("figcaption");
  heading.className = "stratos-chart-title";
  heading.textContent = String(chart.title || (chart.type === "bar" ? "Comparison" : "Procedural sequence")).slice(0,120);
  figure.append(heading);
  if (chart.type === "bar" && Array.isArray(chart.items) && chart.items.length) {
    const items = chart.items.slice(0,8).filter(item => item && Number.isFinite(Number(item.value)) && Number(item.value) >= 0);
    if (!items.length) return null;
    const max = Math.max(...items.map(item => Number(item.value)), 1);
    const rows = document.createElement("div");
    rows.className = "chart-bars";
    items.forEach(item => {
      const row = document.createElement("div"); row.className = "chart-bar-row";
      const label = document.createElement("span"); label.className = "chart-bar-label"; label.textContent = String(item.label || "Item").slice(0,70);
      const track = document.createElement("span"); track.className = "chart-bar-track";
      const fill = document.createElement("span"); fill.className = "chart-bar-fill"; fill.style.width = (Number(item.value) / max * 100) + "%";
      track.append(fill);
      const value = document.createElement("strong"); value.className = "chart-bar-value"; value.textContent = String(item.value) + (chart.unit ? " " + String(chart.unit).slice(0,18) : "");
      row.append(label,track,value); rows.append(row);
    });
    figure.append(rows);
  } else if (chart.type === "timeline" && Array.isArray(chart.steps) && chart.steps.length) {
    const list = document.createElement("ol"); list.className = "chart-timeline";
    chart.steps.slice(0,8).forEach(step => {
      const item = document.createElement("li");
      const status = ["completed","current","conditional","unknown"].includes(step.status) ? step.status : "unknown";
      item.dataset.status = status;
      const name = document.createElement("strong"); name.textContent = String(step.label || "Stage").slice(0,90);
      const detail = document.createElement("span"); detail.textContent = String(step.detail || "").slice(0,180);
      const tag = document.createElement("small"); tag.textContent = ({completed:"Completed",current:"Current stage",conditional:"If triggered",unknown:"To confirm"})[status];
      item.append(name,detail,tag); list.append(item);
    });
    figure.append(list);
  } else return null;
  if (chart.note) {
    const note = document.createElement("p"); note.className = "stratos-chart-note"; note.textContent = String(chart.note).slice(0,240); figure.append(note);
  }
  return figure;
}

function renderAnalysis(markdown) {
  const nav = document.getElementById("analysis-nav");
  if (analysisActiveObserver) analysisActiveObserver.disconnect();
  if (scrollRevealObserver) output.querySelectorAll(".scroll-reveal").forEach(element => scrollRevealObserver.unobserve(element));
  nav.replaceChildren();
  output.replaceChildren();

  if (!window.marked || !window.DOMPurify) {
    const fallback = document.createElement("pre");
    fallback.className = "analysis-fallback";
    fallback.textContent = markdown;
    output.append(fallback);
    return;
  }

  marked.setOptions({ gfm:true, breaks:false, headerIds:false, mangle:false });
  const normalized = markdown
    .replace(/^([A-L]\.\s+.+)$/gm, "## $1")
    .replace(/^\*\*([A-L]\.\s+.+?)\*\*$/gm, "## $1");
  const headingPattern = /^##\s+(.+)$/gm;
  const matches = [...normalized.matchAll(headingPattern)];
  const sections = [];

  if (!matches.length) {
    sections.push({ title:"Case details", body:normalized });
  } else {
    if (normalized.slice(0,matches[0].index).trim()) {
      sections.push({title:"Overview",body:normalized.slice(0,matches[0].index)});
    }
    matches.forEach((match,index) => {
      const bodyStart = match.index + match[0].length;
      const bodyEnd = index + 1 < matches.length ? matches[index+1].index : normalized.length;
      sections.push({title:match[1].replace(/^\*\*|\*\*$/g,"").trim(),body:normalized.slice(bodyStart,bodyEnd).trim()});
    });
  }

  const outputFragment = document.createDocumentFragment();
  const navFragment = document.createDocumentFragment();
  const plainCategoryNames = [
    "Possible outcomes",
    "What the other side may do",
    "How you can respond",
    "Evidence and witnesses",
    "Weak points and missing facts",
    "What the law does not allow",
    "What may happen next",
    "Court rules and procedure",
    "What you can do at each stage",
    "What to do first",
    "Questions that need answers",
    "Information still needed"
  ];
  sections.forEach((section,index) => {
    const headingMatch = section.title.match(/^([A-L])\s*[.):-]?\s*/i);
    if (headingMatch) section.title = plainCategoryNames[headingMatch[1].toUpperCase().charCodeAt(0)-65] || section.title.replace(/^([A-L])\s*[.):-]?\s*/i,"");
    const id = "analysis-" + (slugify(section.title) || index);
    const card = document.createElement("section");
    card.className = "analysis-card";
    card.id = id;
    const heading = document.createElement("div");
    heading.className = "analysis-card-heading";
    const number = document.createElement("span");
    number.className = "analysis-card-number";
    number.textContent = String(index+1).padStart(2,"0");
    const title = document.createElement("h3");
    title.textContent = section.title;
    heading.append(number,title);
    const content = document.createElement("div");
    content.className = "analysis-card-content";
    const safeHtml = DOMPurify.sanitize(marked.parse(section.body || "_No additional detail provided._"));
    const parsed = document.createElement("template");
    parsed.innerHTML = safeHtml;

    // Each category remains a connected briefing section; individual findings
    // become compact tiles inside it, rather than long paragraphs in one card.
    const insightGrid = document.createElement("div");
    insightGrid.className = "insight-grid";
    let tileIndex = 0;
    const layoutPattern = ["feature","half","half","wide","narrow","full"];
    const makeInsightTile = (html, layout) => {
      const tile = document.createElement("article");
      tile.className = "insight-tile";
      tile.dataset.layout = layout || layoutPattern[tileIndex % layoutPattern.length];
      tile.dataset.index = String(tileIndex + 1);
      const topline = document.createElement("div");
      topline.className = "insight-tile-topline";
      const label = document.createElement("span");
      label.className = "insight-tile-label";
      label.textContent = "POINT " + String(tileIndex + 1).padStart(2,"0");
      topline.append(label);
      const body = document.createElement("div");
      body.className = "tile-body";
      body.innerHTML = html;
      tile.append(topline,body);
      tileIndex++;
      addTileExpansion(tile, body);
      return tile;
    };
    [...parsed.content.children].forEach(block => {
      if (block.tagName === "PRE") {
        const chart = renderStructuredChart(block);
        if (chart) {
          const tile = document.createElement("article");
          tile.className = "insight-tile chart-insight-tile";
          const topline = document.createElement("div"); topline.className = "insight-tile-topline";
          const label = document.createElement("span"); label.className = "insight-tile-label"; label.textContent = "VISUAL SUMMARY";
          topline.append(label);
          const body = document.createElement("div"); body.className = "tile-body"; body.append(chart);
          tile.append(topline,body); insightGrid.append(tile);
        } else {
          insightGrid.append(makeInsightTile(block.textContent));
        }
        return;
      }
      if (/^H[2-4]$/.test(block.tagName)) {
        const label = document.createElement("div");
        label.className = "insight-subheading";
        label.textContent = block.textContent;
        insightGrid.append(label);
        return;
      }
      if (block.tagName === "UL" || block.tagName === "OL") {
        [...block.children].forEach(item => {
          insightGrid.append(makeInsightTile(item.innerHTML));
        });
        return;
      }
      insightGrid.append(makeInsightTile(block.outerHTML));
    });
    if (!insightGrid.children.length) {
      insightGrid.append(makeInsightTile("No additional detail provided.","feature"));
    }
    content.append(insightGrid);
    const categoryMeta = document.createElement("span");
    categoryMeta.className = "category-meta";
    categoryMeta.textContent = "CASE REVIEW";
    heading.append(categoryMeta);
    card.append(heading,content);
    outputFragment.append(card);

    const link = document.createElement("button");
    link.type = "button";
    link.className = "analysis-nav-link" + (index===0 ? " is-active" : "");
    link.textContent = section.title;
    link.dataset.target = id;
    link.addEventListener("click",() => {
      if(results.classList.contains("focus-mode")) setFocusedCard(card);
      else card.scrollIntoView({behavior:"smooth",block:"start"});
      nav.querySelectorAll(".analysis-nav-link").forEach(item => item.classList.remove("is-active"));
      link.classList.add("is-active");
    });
    navFragment.append(link);
  });

  // Commit the complete layout in one DOM write instead of forcing repeated viewport work.
  output.append(outputFragment);
  nav.append(navFragment);
  const layout=results.querySelector(".analysis-layout");
  if(!focusControls.isConnected) layout.append(focusControls);
  const cards = [...output.querySelectorAll(".analysis-card")];
  if(focusVisualMode&&cards.length)setFocusedCard(cards[0]);
  // The caller reveals the results section first, then registers its cards with
  // the observer once the section has a measurable, visible layout.
  if (analysisActiveObserver) {
    analysisActiveObserver.disconnect();
    analysisActiveObserver = null;
  }
  if ("IntersectionObserver" in window) {
    analysisActiveObserver = new IntersectionObserver(entries => {
      const visible = entries.filter(entry => entry.isIntersecting).sort((a,b) => b.intersectionRatio-a.intersectionRatio)[0];
      if (!visible) return;
      nav.querySelectorAll(".analysis-nav-link").forEach(link => {
        link.classList.toggle("is-active",link.dataset.target === visible.target.id);
      });
    },{rootMargin:"-12% 0px -68% 0px",threshold:[0,0.12,0.35]});
    cards.forEach(card => analysisActiveObserver.observe(card));
  }
}

analyzeButton.addEventListener("click", async () => {
  errorMessage.hidden = true;
  results.hidden = true;
  const caseText = description.value.trim();
  const intakeQuality = inspectIntakeQuality();
  if (dailyAnalysesRemaining === 0) {
    showError("You've used all 10 analyses for today. Your allowance resets at midnight Nigeria time.");
    return;
  }
  if (!intakeQuality.ready) {
    showError("There is not enough information to analyse this matter yet. " + intakeQuality.message);
    const firstIncomplete = !intakeQuality.hasSubstantiveNarrative && !intakeQuality.hasDocuments
      ? document.getElementById("case-description")
      : intakeFieldIds.map(id => document.getElementById(id)).find(field => field && !String(field.value || "").trim());
    if (firstIncomplete) firstIncomplete.focus({preventScroll:true});
    return;
  }
  analyzeButton.disabled = true;
  analyzeButton.querySelector("span:first-child").textContent = "Analysing...";
  progressPanel.hidden = false;
  requestAnimationFrame(() => revealAllWithin(progressPanel));
  startWaitingInsights();
  progressTitle.textContent = "Reading the material...";
  progressDetail.textContent = "Identifying the legal environment and reconstructing the case.";
  progressPanel.scrollIntoView({behavior:"smooth",block:"center"});
  const stageTimer = setTimeout(() => {
    progressTitle.textContent = "Stress-testing both sides...";
    progressDetail.textContent = "Mapping outcome branches, opponent moves, lawful counters, evidence risks and second-order effects.";
  },4500);
  try {
    const files = await Promise.all(selectedFiles.map(async file => ({name:file.name,mimeType:file.type,data:await fileAsDataUrl(file)})));
    const {data:sessionData,error:sessionError} = await authClient.auth.getSession();
    if (sessionError || !sessionData.session?.access_token) {
      applyAuthSession(null);
      throw new Error("Your session has expired. Please sign in again before analysing a case.");
    }
    const response = await fetch("/api/analyze",{
      method:"POST",
      headers:{
        "Content-Type":"application/json",
        "Authorization":"Bearer " + sessionData.session.access_token
      },
      body:JSON.stringify({description:caseText,caseContext:Object.fromEntries(intakeFieldIds.map(id => [id,document.getElementById(id)?.value?.trim() || "Not supplied"])),files})
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      if (data.usage) renderDailyUsage(data.usage);
      if (data.code === "DAILY_LIMIT_REACHED") throw new Error(data.error || "Daily analysis limit reached.");
      throw new Error(response.status === 401 ? "Please sign in again." : "Analysis failed.");
    }
    if (data.usage) renderDailyUsage(data.usage);
    const {data:latestSessionData} = await authClient.auth.getSession();
    if (!latestSessionData.session?.user) {
      throw new Error("You signed out before the analysis finished. Sign in again to continue.");
    }
    clearTimeout(stageTimer);
    stopWaitingInsights();
    progressPanel.hidden = true;
    progressTitle.textContent = "Preparing your case intelligence...";
    progressDetail.textContent = "Outcome branches and opposing moves have been mapped against the supplied record.";
    currentAnalysisMarkdown = data.analysis;
    currentAnalysisTitle = buildAnalysisTitle();
    renderAnalysis(data.analysis);
    document.getElementById("save-analysis").disabled = false;
    document.getElementById("save-analysis").textContent = "Save analysis";
    results.classList.toggle("focus-mode",focusVisualMode);
    results.hidden = false;
    requestAnimationFrame(() => revealAllWithin(results));
    if(focusVisualMode)setTimeout(()=>{
      const first=output.querySelector(".analysis-card");
      if(first)setFocusedCard(first);
    },180);
    setTimeout(() => results.scrollIntoView({behavior:"smooth",block:"start"}),150);
  } catch(error) {
    clearTimeout(stageTimer);
    stopWaitingInsights();
    showError(error.message || "Something went wrong. Please try again.");
    progressPanel.hidden = true;
  } finally {
    analyzeButton.disabled = false;
    analyzeButton.querySelector("span:first-child").textContent = "Analyse my case";
  }
});
document.getElementById("new-analysis").addEventListener("click",() => {
  currentAnalysisMarkdown = "";
  document.getElementById("save-analysis").disabled = false;
  document.getElementById("save-analysis").textContent = "Save analysis";
  results.hidden = true;
  stopWaitingInsights();
  progressPanel.hidden = true;
  if(focusVisualMode){
    const first=intakeAccordions.querySelector(".intake-group");
    if(first)focusIntakeGroup(first);
  }
  description.focus();
  window.scrollTo({top:0,behavior:prefersReducedMotion?"auto":"smooth"});
});

/* One typewriter pass per page load. */
(function runIntroTypewriter(){
  const target=document.getElementById("intro-typewriter");
  const cursor=document.getElementById("intro-typewriter-cursor");
  if(!target||!cursor)return;
  const fullText=target.dataset.text||target.textContent;
  if(window.matchMedia("(prefers-reduced-motion: reduce)").matches){cursor.remove();return;}
  target.textContent="";
  let index=0;
  const interval=85;
  const typeNext=()=>{
    if(index<fullText.length){
      target.textContent+=fullText.charAt(index++);
      window.setTimeout(typeNext,interval);
    }else{
      window.setTimeout(()=>cursor.classList.add("is-gone"),5000);
      window.setTimeout(()=>cursor.remove(),5600);
    }
  };
  window.setTimeout(typeNext,420);
})();
