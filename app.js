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

// Light the Analyse button when the structured intake is substantially complete.
// Unknown or genuinely unavailable facts can remain blank; analysis is never blocked.
function updateAnalyzeReadiness() {
  const completedFields = intakeFieldIds.filter(id => {
    const field = document.getElementById(id);
    return Boolean(field && String(field.value || "").trim());
  }).length;
  const isReady = completedFields >= Math.ceil(intakeFieldIds.length * 0.5);
  analyzeButton.classList.toggle("is-intake-ready", isReady);
  analyzeButton.setAttribute("data-intake-progress", `${completedFields}/${intakeFieldIds.length}`);
}
intakeAccordions.addEventListener("input", event => {
  if (event.target && intakeFieldIds.includes(event.target.id)) updateAnalyzeReadiness();
});
intakeAccordions.addEventListener("change", event => {
  if (event.target && intakeFieldIds.includes(event.target.id)) updateAnalyzeReadiness();
});
updateAnalyzeReadiness();

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
}
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
function updateFocusControls(){
  const categories=[...output.querySelectorAll(".analysis-card")];
  const category=categories[focusedCategoryIndex];
  const tiles=category?[...category.querySelectorAll(".insight-tile")]:[];
  const nextPoint=focusControls?.querySelector("[data-focus-next-point]");
  const nextCategory=focusControls?.querySelector("[data-focus-next-category]");
  if(nextPoint) nextPoint.disabled=!tiles.length||focusedPointIndex>=tiles.length-1;
  if(nextCategory) nextCategory.disabled=categories.length<2;
  if(nextPoint) nextPoint.textContent=tiles.length?("Next point ("+Math.min(focusedPointIndex+1,tiles.length)+"/"+tiles.length+")"):"Next point";
  if(nextCategory) nextCategory.textContent="Next category ("+Math.min(focusedCategoryIndex+1,categories.length)+"/"+categories.length+")";
}
const focusControls=document.createElement("div");
focusControls.className="focus-controls";
focusControls.innerHTML='<button type="button" data-focus-next-point>Next point</button><button type="button" data-focus-next-category>Next category</button>';
focusControls.hidden=true;
focusControls.querySelector("[data-focus-next-point]").addEventListener("click",()=>{
  const category=output.querySelectorAll(".analysis-card")[focusedCategoryIndex];
  if(!category)return;
  const tiles=category.querySelectorAll(".insight-tile");
  if(focusedPointIndex<tiles.length-1)setFocusedCard(tiles[focusedPointIndex+1]);
});
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
    const headingMatch = section.title.match(/^([A-L])\\s*[.):-]?\\s*/i);
    if (headingMatch) section.title = plainCategoryNames[headingMatch[1].toUpperCase().charCodeAt(0)-65] || section.title.replace(/^([A-L])\\s*[.):-]?\\s*/i,"");
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
    const response = await fetch("/api/analyze",{
      method:"POST",
      headers:{"Content-Type":"application/json"},
      body:JSON.stringify({description:caseText,caseContext:Object.fromEntries(intakeFieldIds.map(id => [id,document.getElementById(id)?.value?.trim() || "Not supplied"])),files})
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.error || "Analysis failed. Please try again.");
    clearTimeout(stageTimer);
    stopWaitingInsights();
    progressPanel.hidden = true;
    progressTitle.textContent = "Preparing your case intelligence...";
    progressDetail.textContent = "Outcome branches and opposing moves have been mapped against the supplied record.";
    renderAnalysis(data.analysis);
    results.classList.toggle("focus-mode",focusVisualMode);
    results.hidden = false;
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
