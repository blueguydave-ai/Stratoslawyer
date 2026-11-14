const input = document.getElementById("file-input");
const dropZone = document.getElementById("drop-zone");
const fileList = document.getElementById("file-list");
const description = document.getElementById("case-description");
const intakeFieldIds = ["case-type","case-role","case-stage","court","jurisdiction","next-date","relief","opponent-conduct","parties","opponent-position","orders-documents","client-objective","own-evidence","own-witnesses","opponent-evidence","opponent-witnesses"];
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
function slugify(value) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g,"-").replace(/^-|-$/g,"");
}

const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
let scrollRevealObserver = null;

// Animate meaningful interface units, not every nested text node or icon.
// This keeps observer targets and composited layers small on mobile devices.
const revealSelector = [
  ".topbar > *",
  ".intro > *",
  ".workspace > *",
  ".intake-group",
  ".intake-group > summary",
  ".intake-field",
  ".evidence-panel",
  ".freeform-wrap",
  ".upload-zone",
  ".file-item",
  ".intake-footer > *",
  ".error-message",
  ".progress-panel > *",
  ".results-heading > *",
  ".results-warning",
  ".analysis-card",
  ".analysis-nav-link",
  ".page-footer > *"
].join(",");

function observeScrollElements(elements) {
  if (!elements?.length) return;
  const candidates = [...new Set(elements)].filter(element =>
    element instanceof HTMLElement &&
    !element.matches("script,style,template,[hidden]") &&
    element.getClientRects().length
  );
  if (prefersReducedMotion || !("IntersectionObserver" in window)) {
    candidates.forEach(element => element.classList.add("is-visible"));
    return;
  }
  if (!scrollRevealObserver) {
    scrollRevealObserver = new IntersectionObserver(entries => {
      entries.forEach(entry => {
        // Keep observing after exit so the entrance replays on re-entry.
        entry.target.classList.toggle("is-visible", entry.isIntersecting);
      });
    }, {rootMargin:"0px 0px -5% 0px", threshold:0.01});
  }
  candidates.forEach((element,index) => {
    if (element.classList.contains("scroll-reveal")) return;
    element.classList.add("scroll-reveal");
    element.style.setProperty("--reveal-delay", Math.min(index % 8, 7) * 14 + "ms");
    scrollRevealObserver.observe(element);
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

function renderAnalysis(markdown) {
  const nav = document.getElementById("analysis-nav");
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
    .replace(/^([A-N]\.\s+.+)$/gm, "## $1")
    .replace(/^\*\*([A-N]\.\s+.+?)\*\*$/gm, "## $1");
  const headingPattern = /^##\s+(.+)$/gm;
  const matches = [...normalized.matchAll(headingPattern)];
  const sections = [];

  if (!matches.length) {
    sections.push({ title:"Case analysis", body:normalized });
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

  sections.forEach((section,index) => {
    const id = "analysis-" + (slugify(section.title) || index);
    const card = document.createElement("section");
    card.className = "analysis-card";
    card.id = id;
    card.style.setProperty("--reveal-order", Math.min(index,12));
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
    let subheading = null;
    [...parsed.content.children].forEach(block => {
      if (/^H[2-4]$/.test(block.tagName)) {
        const label = document.createElement("div");
        label.className = "insight-subheading";
        label.textContent = block.textContent;
        insightGrid.append(label);
        subheading = label;
        return;
      }
      if (block.tagName === "UL" || block.tagName === "OL") {
        [...block.children].forEach(item => {
          const tile = document.createElement("article");
          tile.className = "insight-tile";
          tile.innerHTML = item.innerHTML;
          insightGrid.append(tile);
        });
        return;
      }
      const tile = document.createElement("article");
      tile.className = "insight-tile";
      tile.innerHTML = block.outerHTML;
      insightGrid.append(tile);
    });
    if (!insightGrid.children.length) {
      const tile = document.createElement("article");
      tile.className = "insight-tile";
      tile.textContent = "No additional detail provided.";
      insightGrid.append(tile);
    }
    content.append(insightGrid);
    card.append(heading,content);
    output.append(card);

    const link = document.createElement("button");
    link.type = "button";
    link.className = "analysis-nav-link" + (index===0 ? " is-active" : "");
    link.textContent = section.title;
    link.addEventListener("click",() => {
      card.scrollIntoView({behavior:"smooth",block:"start"});
      nav.querySelectorAll(".analysis-nav-link").forEach(item => item.classList.remove("is-active"));
      link.classList.add("is-active");
    });
    nav.append(link);
  });

  const cards = [...output.querySelectorAll(".analysis-card")];
  // Results are revealed immediately after renderAnalysis returns. Start observing
  // on the next frame so the cards are measured in their visible layout.
  requestAnimationFrame(() => revealAllWithin(results));
  if ("IntersectionObserver" in window) {
    const activeObserver = new IntersectionObserver(entries => {
      const visible = entries.filter(entry => entry.isIntersecting).sort((a,b) => b.intersectionRatio-a.intersectionRatio)[0];
      if (!visible) return;
      nav.querySelectorAll(".analysis-nav-link").forEach(link => {
        link.classList.toggle("is-active",link.textContent === visible.target.querySelector("h3")?.textContent);
      });
    },{rootMargin:"-12% 0px -68% 0px",threshold:[0,0.12,0.35]});
    cards.forEach(card => activeObserver.observe(card));
  }
}

analyzeButton.addEventListener("click", async () => {
  errorMessage.hidden = true;
  results.hidden = true;
  const caseText = description.value.trim();
  const hasStructuredContext = intakeFieldIds.some(id => (document.getElementById(id)?.value || "").trim());
  if (!caseText && !hasStructuredContext && !selectedFiles.length) { showError("Add a few case details or attach at least one supported document to begin."); return; }
  analyzeButton.disabled = true;
  analyzeButton.querySelector("span:first-child").textContent = "Analysing...";
  progressPanel.hidden = false;
  requestAnimationFrame(() => revealAllWithin(progressPanel));
  progressTitle.textContent = "Reading the material...";
  progressDetail.textContent = "Identifying the legal environment and reconstructing the case.";
  progressPanel.scrollIntoView({behavior:"smooth",block:"center"});
  const stageTimer = setTimeout(() => {
    progressTitle.textContent = "Stress-testing both sides...";
    progressDetail.textContent = "Mapping outcome branches, opponent moves, lawful counters, evidence risks and second-order effects.";
  },4500);
  try {
    const files = await Promise.all(selectedFiles.map(async file => ({name:file.name,mimeType:file.type,data:await fileAsDataUrl(file)})));
    const response = await fetch("/api/analyze",{
      method:"POST",
      headers:{"Content-Type":"application/json"},
      body:JSON.stringify({description:caseText,caseContext:Object.fromEntries(intakeFieldIds.map(id => [id,document.getElementById(id)?.value?.trim() || "Not supplied"])),files})
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.error || "Analysis failed. Please try again.");
    clearTimeout(stageTimer);
    progressTitle.textContent = "Preparing your case intelligence...";
    progressDetail.textContent = "Outcome branches and opposing moves have been mapped against the supplied record.";
    renderAnalysis(data.analysis);
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
