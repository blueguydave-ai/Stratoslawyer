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
      headers:{"Content-Type":"application/json"},
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
