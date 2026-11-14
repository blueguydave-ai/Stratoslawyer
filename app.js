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
  const toggle = document.createElement("button");
  toggle.type = "button";
  toggle.className = "tile-expand";
  toggle.textContent = "Explore details";
  toggle.setAttribute("aria-expanded", "false");
  toggle.addEventListener("click", () => {
    const expanded = tile.classList.toggle("is-expanded");
    toggle.setAttribute("aria-expanded", String(expanded));
    toggle.textContent = expanded ? "Show less" : "Explore details";
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
function setFocusedCard(target) {
  if(!results.classList.contains("focus-mode")) return;
  const category=target.closest(".analysis-card");
  if(!category) return;
  category.scrollIntoView({behavior:prefersReducedMotion?"auto":"smooth",block:"nearest",inline:"center"});
  output.querySelectorAll(".analysis-card").forEach(card=>{
    card.classList.toggle("is-focused",card===category);
    card.classList.toggle("is-dimmed",card!==category);
  });
  const chosenTile=target.classList.contains("insight-tile")?target:null;
  category.querySelectorAll(".insight-tile").forEach(tile=>{
    tile.classList.toggle("is-focused",tile===chosenTile);
    tile.classList.toggle("is-dimmed",Boolean(chosenTile)&&tile!==chosenTile);
  });
}
const viewModeToggle=document.getElementById("view-mode-toggle");
viewModeToggle.addEventListener("click",()=>{
  const active=results.classList.toggle("focus-mode");
  viewModeToggle.setAttribute("aria-pressed",String(active));
  viewModeToggle.querySelector(".mode-label").textContent=active?"Standard mode":"Focus visual mode";
  viewModeToggle.querySelector(".mode-glyph").textContent=active?"◇":"◈";
  clearCardFocus();
  if(active){const first=output.querySelector(".analysis-card");if(first)setFocusedCard(first);}
});
output.addEventListener("click",event=>{
  if(!results.classList.contains("focus-mode")) return;
  const tile=event.target.closest(".insight-tile");
  const card=event.target.closest(".analysis-card");
  setFocusedCard(tile||card);
});

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
    requestAnimationFrame(() => revealAllWithin(results));
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

  const outputFragment = document.createDocumentFragment();
  const navFragment = document.createDocumentFragment();
  sections.forEach((section,index) => {
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
    [...parsed.content.children].forEach(block => {
      if (/^H[2-4]$/.test(block.tagName)) {
        const label = document.createElement("div");
        label.className = "insight-subheading";
        label.textContent = block.textContent;
        insightGrid.append(label);
        return;
      }
      if (block.tagName === "UL" || block.tagName === "OL") {
        [...block.children].forEach(item => {
          const tile = document.createElement("article");
          tile.className = "insight-tile";
          tile.dataset.layout = layoutPattern[tileIndex++ % layoutPattern.length];
          const body = document.createElement("div");
          body.className = "tile-body";
          body.innerHTML = item.innerHTML;
          tile.append(body);
          addTileExpansion(tile, body);
          insightGrid.append(tile);
        });
        return;
      }
      const tile = document.createElement("article");
      tile.className = "insight-tile";
      tile.dataset.layout = layoutPattern[tileIndex++ % layoutPattern.length];
      const body = document.createElement("div");
      body.className = "tile-body";
      body.innerHTML = block.outerHTML;
      tile.append(body);
      addTileExpansion(tile, body);
      insightGrid.append(tile);
    });
    if (!insightGrid.children.length) {
      const tile = document.createElement("article");
      tile.className = "insight-tile";
      tile.dataset.layout = "feature";
      tile.textContent = "No additional detail provided.";
      insightGrid.append(tile);
    }
    content.append(insightGrid);
    const categoryMeta = document.createElement("span");
    categoryMeta.className = "category-meta";
    categoryMeta.textContent = "INTELLIGENCE CATEGORY";
    heading.append(categoryMeta);
    card.append(heading,content);
    outputFragment.append(card);

    const link = document.createElement("button");
    link.type = "button";
    link.className = "analysis-nav-link" + (index===0 ? " is-active" : "");
    link.textContent = section.title;
    link.dataset.target = id;
    link.addEventListener("click",() => {
      card.scrollIntoView({behavior:"smooth",block:"start"});
      nav.querySelectorAll(".analysis-nav-link").forEach(item => item.classList.remove("is-active"));
      link.classList.add("is-active");
    });
    navFragment.append(link);
  });

  // Commit the complete layout in one DOM write instead of forcing repeated viewport work.
  output.append(outputFragment);
  nav.append(navFragment);
  const cards = [...output.querySelectorAll(".analysis-card")];
  // Results are revealed immediately after renderAnalysis returns. Start observing
  // on the next frame so the cards are measured in their visible layout.
  requestAnimationFrame(() => revealAllWithin(results));
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
    progressPanel.hidden = true;
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
