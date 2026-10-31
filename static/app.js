/* ─────────────────────────────────────────────────────────────
   70MM AI — Script Intelligence Engine (Group 2)
   Frontend JavaScript — app.js
───────────────────────────────────────────────────────────── */

const API_BASE = 'http://localhost:5000';

// ─── State ───────────────────────────────────────────────────
let currentScreenplay = '';
let envKeyLoaded = true; // Key is preconfigured in .env

// ─── Check .env key on startup ────────────────────────────────
async function checkEnvKey() {
  try {
    const res = await fetch(API_BASE + '/api/env-key');
    const data = await res.json();
    if (data.has_env_key) {
      envKeyLoaded = true;

      const badge = document.getElementById('headerEnvBadge');
      const text = document.getElementById('headerEnvText');
      if (badge) badge.style.display = 'inline-flex';
      if (text) text.textContent = `.env Connected (${data.masked})`;

      console.log('✅ Gemini API key active via .env');
    } else {
      const badge = document.getElementById('headerEnvBadge');
      const text = document.getElementById('headerEnvText');
      if (badge) {
        badge.style.borderColor = 'rgba(239, 68, 68, 0.4)';
        badge.style.color = '#f87171';
      }
      if (text) text.textContent = '⚠️ Missing key in .env';
      showToast('⚠️ No GEMINI_API_KEY found in .env', 'error');
    }
  } catch (_) {
    // Server initializing
  }
}

// ─── Helper: get API key ──────────────────────────────────────
function getApiKey() {
  return 'env'; // Backend automatically uses GEMINI_API_KEY from .env
}

// ─── Tab Navigation ───────────────────────────────────────────
function showTab(tabName) {
  document.querySelectorAll('.tab-section').forEach(s => s.classList.remove('active'));
  document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
  const section = document.getElementById('tab-' + tabName);
  if (section) section.classList.add('active');
  const navBtns = document.querySelectorAll('.nav-btn');
  const tabOrder = ['screenplay', 'language', 'character', 'doctor', 'coverage'];
  const idx = tabOrder.indexOf(tabName);
  if (navBtns[idx]) navBtns[idx].classList.add('active');

  // Sync pipeline workflow banner
  const pipeMap = {
    screenplay: 'story',
    character: 'bible',
    doctor: 'doctor',
    coverage: 'coverage'
  };
  if (pipeMap[tabName]) {
    updatePipelineActive(pipeMap[tabName]);
  }
}

// ─── Character Sub-tabs ───────────────────────────────────────
function showCharTab(tabName, clickedBtn) {
  document.querySelectorAll('.char-tab-content').forEach(t => t.classList.remove('active'));
  document.querySelectorAll('.char-tab-btn').forEach(b => b.classList.remove('active'));
  const content = document.getElementById('charTab-' + tabName);
  if (content) content.classList.add('active');
  if (clickedBtn) {
    clickedBtn.classList.add('active');
  } else {
    const btns = document.querySelectorAll('.char-tab-btn');
    if (tabName === 'bible' && btns[0]) btns[0].classList.add('active');
    if (tabName === 'develop' && btns[1]) btns[1].classList.add('active');
  }
}

// ─── Loading Overlay ──────────────────────────────────────────
function showLoading(text = 'Processing with Gemini AI…') {
  const overlay = document.getElementById('loadingOverlay');
  const textEl = document.getElementById('loadingText');
  if (textEl) textEl.textContent = text;
  if (overlay) overlay.style.display = 'flex';
}

function hideLoading() {
  const overlay = document.getElementById('loadingOverlay');
  if (overlay) overlay.style.display = 'none';
}

// ─── Toast Notifications ──────────────────────────────────────
function showToast(msg, type = '') {
  const toast = document.getElementById('toast');
  if (!toast) return;
  toast.textContent = msg;
  toast.className = 'toast show ' + type;
  setTimeout(() => { toast.className = 'toast'; }, 3500);
}

// ─── Set Output in Workspace ──────────────────────────────────
function setOutput(elementId, content) {
  const el = document.getElementById(elementId);
  if (!el) return;
  el.textContent = content;
  el.style.color = 'var(--text-primary)';
}

// ─── Clear Field ──────────────────────────────────────────────
function clearField(id) {
  const el = document.getElementById(id);
  if (el) el.value = '';
}

// ─── Copy to Clipboard ────────────────────────────────────────
function copyOutput(id) {
  const el = document.getElementById(id);
  if (!el || !el.textContent.trim() || el.querySelector('.empty-state')) {
    showToast('Nothing to copy yet.', 'error');
    return;
  }
  navigator.clipboard.writeText(el.textContent).then(() => {
    showToast('✅ Copied to clipboard!', 'success');
  });
}

// ─── Download Output as Text File ─────────────────────────────
function downloadText(id, filename) {
  const el = document.getElementById(id);
  if (!el || !el.textContent.trim() || el.querySelector('.empty-state')) {
    showToast('Nothing to download yet.', 'error');
    return;
  }
  const blob = new Blob([el.textContent], { type: 'text/plain;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
  showToast('⬇ Download started!', 'success');
}

// ─── API Call Helper ──────────────────────────────────────────
async function apiCall(endpoint, body) {
  const res = await fetch(API_BASE + endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });
  const text = await res.text();
  try {
    return JSON.parse(text);
  } catch (_) {
    throw new Error(text || `Server error HTTP ${res.status}`);
  }
}

// ─── File Upload Handler (PDF, DOCX, TXT, JSON) ───────────────
async function uploadAndFill(fileInputOrFile, targetInputId, chipId) {
  let file = null;
  if (fileInputOrFile instanceof File) {
    file = fileInputOrFile;
  } else if (fileInputOrFile && fileInputOrFile.files && fileInputOrFile.files[0]) {
    file = fileInputOrFile.files[0];
  }
  if (!file) return;

  const validExts = ['.pdf', '.docx', '.doc', '.txt', '.json', '.md', '.fountain'];
  const ext = '.' + file.name.split('.').pop().toLowerCase();
  if (!validExts.includes(ext)) {
    showToast(`⚠️ Unsupported file format (${ext}). Upload PDF, DOCX, TXT, or JSON.`, 'error');
    return;
  }

  showLoading(`Extracting text from ${file.name}…`);

  const formData = new FormData();
  formData.append('file', file);

  try {
    const res = await fetch(API_BASE + '/api/extract-text', {
      method: 'POST',
      body: formData
    });
    const data = await res.json();
    if (data.success) {
      const targetEl = document.getElementById(targetInputId);
      if (targetEl) {
        targetEl.value = data.text;
        targetEl.dispatchEvent(new Event('input'));
      }

      if (chipId) {
        const chip = document.getElementById(chipId);
        if (chip) {
          chip.style.display = 'inline-flex';
          const nameEl = chip.querySelector('.chip-filename');
          const metaEl = chip.querySelector('.chip-meta');
          if (nameEl) nameEl.textContent = data.filename;
          if (metaEl) metaEl.textContent = `(${data.word_count.toLocaleString()} words · ${data.char_count.toLocaleString()} chars)`;
        }
      }

      showToast(`✅ Loaded ${data.filename} (${data.word_count.toLocaleString()} words)!`, 'success');
    } else {
      showToast(`❌ ${data.error || 'Failed to extract text'}`, 'error');
    }
  } catch (err) {
    showToast(`❌ Upload error: ${err.message}`, 'error');
  } finally {
    hideLoading();
    if (fileInputOrFile && fileInputOrFile.value) {
      fileInputOrFile.value = '';
    }
  }
}

// ─── Drag & Drop Handlers ─────────────────────────────────────
function handleDragOver(e) {
  e.preventDefault();
  e.stopPropagation();
  e.currentTarget.classList.add('drag-active');
}

function handleDragLeave(e) {
  e.preventDefault();
  e.stopPropagation();
  e.currentTarget.classList.remove('drag-active');
}

function handleDrop(e, targetInputId, chipId) {
  e.preventDefault();
  e.stopPropagation();
  e.currentTarget.classList.remove('drag-active');
  if (e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files.length > 0) {
    uploadAndFill(e.dataTransfer.files[0], targetInputId, chipId);
  }
}

function clearUploadedFile(targetInputId, chipId) {
  const targetEl = document.getElementById(targetInputId);
  if (targetEl) targetEl.value = '';
  if (chipId) {
    const chip = document.getElementById(chipId);
    if (chip) chip.style.display = 'none';
  }
  showToast('Cleared content', '');
}

// ─── Sample Data Presets ──────────────────────────────────────
const SAMPLES = {
  story: `Arjun, a 26-year-old software engineer in Hyderabad, receives an encrypted email on the anniversary of his father's mysterious death. The email contains security camera footage of a high-tech laboratory in HITEC City where his father worked as a chief cryptographer.

When Arjun decrypts the attached code, he discovers an AI backdoor designed to manipulate national biometric surveillance systems. Moments later, two armed men in black suits break into his apartment. 

Arjun escapes through the fire exit into the crowded midnight streets of Charminar, holding only his laptop and his father's vintage mechanical watch. He must find Vikram, a renegade investigative journalist, before the assassins track his digital footprint.`,

  dialogue: `ARJUN
(whispering urgently)
I told you not to come here. Why didn't you listen to me? They're watching every terminal in the building.

PRIYA
Because your father didn't die for a code you keep hidden on a hard drive. He died trying to get this out. We are running out of time, Arjun.

ARJUN
You don't understand who these people are. If they catch us, there won't be a trial. Just another missing persons file.`,

  screenplay: `FADE IN:

INT. ARJUN'S APARTMENT - NIGHT

Rain lashes against the floor-to-ceiling windows overlooking Hyderabad's illuminated skyline. 

Blue light from three oversized monitors flickers across ARJUN (26), dark circles under sharp, determined eyes. 

A progress bar on the center monitor hits 100%. A chime.

ARJUN
(under his breath)
Come on, Dad... what did you leave behind?

A video file opens. Security footage: A sterile server room. A MAN in a white lab coat frantically copies files to a thumb drive. It's PROFESSOR SHARMA (55) — Arjun's late father.

Suddenly, the apartment DOOR HANDLE rattles. 

Arjun freezes. His hand drifts to his mouse.

Heavy footsteps outside. A metallic CLICK — a lock-picking tool.

ARJUN
(whispering)
No. Not already.

Arjun rips the flash drive from the USB port, grabs his father's vintage watch from the desk, and sprints toward the kitchen fire escape.

The front door KICKS OPEN. Two men in tactical black enter with silenced handguns.

CUT TO:

EXT. HYDERABAD RAIN-SOAKED ALLEY - CONTINUOUS

Arjun drops from the fire ladder into the mud, splashing into the neon-lit alleyway below. Sirens wail in the distance.

FADE OUT.`
};

function loadSample(type, targetId) {
  const content = SAMPLES[type];
  if (!content) return;
  const target = document.getElementById(targetId);
  if (target) {
    target.value = content;
    target.dispatchEvent(new Event('input'));
    showToast(`✨ Loaded sample ${type}!`, 'success');
  }
}

// ─── 1. Story → Screenplay ────────────────────────────────────
async function convertStory() {
  const story = document.getElementById('storyInput').value.trim();
  if (!story) {
    showToast('Please enter or upload a story first, or click "Load Sample".', 'error');
    return;
  }

  const language = document.getElementById('screenplay-lang').value;
  const btn = document.getElementById('convertBtn');
  btn.disabled = true;
  showLoading('Converting story to screenplay with Gemini AI…');

  try {
    const data = await apiCall('/api/story-to-screenplay', {
      api_key: 'env',
      story: story,
      language: language
    });
    if (data.success) {
      currentScreenplay = data.screenplay;
      setOutput('screenplayOutput', data.screenplay);
      showToast('🎬 Screenplay generated successfully!', 'success');
    } else {
      showToast('❌ Error: ' + (data.error || 'Conversion failed'), 'error');
    }
  } catch (err) {
    showToast('❌ Network error: ' + err.message, 'error');
  } finally {
    hideLoading();
    btn.disabled = false;
  }
}

// ─── 2. Script Assist ────────────────────────────────────────
async function scriptAssist() {
  const screenplay = document.getElementById('screenplayOutput').textContent;
  const instruction = document.getElementById('assistInput').value.trim();

  if (!screenplay || screenplay.includes('Your screenplay will appear')) {
    showToast('Please generate a screenplay first.', 'error');
    return;
  }
  if (!instruction) {
    showToast('Please enter an instruction (e.g. "Add more tension", "Make dialogue punchier").', 'error');
    return;
  }

  const language = document.getElementById('screenplay-lang').value;
  showLoading('Applying AI edit to screenplay…');

  try {
    const data = await apiCall('/api/script-assist', {
      api_key: 'env',
      screenplay: screenplay,
      instruction: instruction,
      language: language
    });
    if (data.success) {
      currentScreenplay = data.result;
      setOutput('screenplayOutput', data.result);
      document.getElementById('assistInput').value = '';
      showToast('✅ AI Edit applied to screenplay!', 'success');
    } else {
      showToast('❌ Error: ' + (data.error || 'Assist failed'), 'error');
    }
  } catch (err) {
    showToast('❌ Network error: ' + err.message, 'error');
  } finally {
    hideLoading();
  }
}

// ─── 3. Continue Scene ────────────────────────────────────────
async function continueScene() {
  const screenplay = document.getElementById('screenplayOutput').textContent;
  if (!screenplay || screenplay.includes('Your screenplay will appear')) {
    showToast('Please generate or provide a screenplay first.', 'error');
    return;
  }

  const language = document.getElementById('screenplay-lang').value;
  const btn = document.getElementById('continueBtn');
  if (btn) btn.disabled = true;
  showLoading('Continuing screenplay with next scene…');

  try {
    const data = await apiCall('/api/continue-scene', {
      api_key: 'env',
      screenplay: screenplay,
      language: language
    });
    if (data.success) {
      const continued = screenplay + '\n\n' + data.result;
      currentScreenplay = continued;
      setOutput('screenplayOutput', continued);
      showToast('✍️ Next scene continued!', 'success');
    } else {
      showToast('❌ Error: ' + (data.error || 'Continue scene failed'), 'error');
    }
  } catch (err) {
    showToast('❌ Network error: ' + err.message, 'error');
  } finally {
    hideLoading();
    if (btn) btn.disabled = false;
  }
}

// ─── 4. Language Convert (Tenglish / Hinglish) ─────────────────
async function convertLanguage() {
  const dialogue = document.getElementById('dialogueInput').value.trim();
  if (!dialogue) {
    showToast('Please enter dialogue to convert or click "Load Sample".', 'error');
    return;
  }

  const target_lang = document.getElementById('targetLang').value;
  const character_name = document.getElementById('charNameLang').value.trim();
  const character_personality = document.getElementById('charPersonality').value.trim();

  const btn = document.getElementById('langConvertBtn');
  if (btn) btn.disabled = true;
  showLoading(`Converting dialogue to authentic ${target_lang}…`);

  try {
    const data = await apiCall('/api/language-convert', {
      api_key: 'env',
      dialogue: dialogue,
      target_lang: target_lang,
      character_name: character_name,
      character_personality: character_personality
    });
    if (data.success) {
      setOutput('langOutput', data.result);
      showToast(`🌐 Dialogue converted to ${target_lang}!`, 'success');
    } else {
      showToast('❌ Error: ' + (data.error || 'Language conversion failed'), 'error');
    }
  } catch (err) {
    showToast('❌ Network error: ' + err.message, 'error');
  } finally {
    hideLoading();
    if (btn) btn.disabled = false;
  }
}

// ─── 5. Character Bible ───────────────────────────────────────
async function generateBible() {
  const content = document.getElementById('bibleInput').value.trim();
  if (!content) {
    showToast('Please paste a story or screenplay, or click "Load Sample".', 'error');
    return;
  }

  const btn = document.getElementById('bibleBtn');
  if (btn) btn.disabled = true;
  showLoading('Analyzing text & building Character Bible…');

  try {
    const data = await apiCall('/api/character-bible', {
      api_key: 'env',
      content: content
    });
    if (data.success) {
      setOutput('bibleOutput', data.result);
      showToast('📖 Character Bible created successfully!', 'success');
    } else {
      showToast('❌ Error: ' + (data.error || 'Failed to generate bible'), 'error');
    }
  } catch (err) {
    showToast('❌ Network error: ' + err.message, 'error');
  } finally {
    hideLoading();
    if (btn) btn.disabled = false;
  }
}

// ─── 6. Character Development ─────────────────────────────────
async function developCharacter() {
  const character_name = document.getElementById('devCharName').value.trim();
  const character_description = document.getElementById('devCharDesc').value.trim();
  const story_context = document.getElementById('devStoryCtx').value.trim();

  if (!character_name || !character_description) {
    showToast('Please enter both Character Name and Description.', 'error');
    return;
  }

  const btn = document.getElementById('devBtn');
  if (btn) btn.disabled = true;
  showLoading(`Analyzing character arc for ${character_name}…`);

  try {
    const data = await apiCall('/api/character-develop', {
      api_key: 'env',
      character_name: character_name,
      character_description: character_description,
      story_context: story_context
    });
    if (data.success) {
      setOutput('devOutput', data.result);
      showToast('🧠 Character development analysis complete!', 'success');
    } else {
      showToast('❌ Error: ' + (data.error || 'Analysis failed'), 'error');
    }
  } catch (err) {
    showToast('❌ Network error: ' + err.message, 'error');
  } finally {
    hideLoading();
    if (btn) btn.disabled = false;
  }
}

// ─── 7. Script Doctor ─────────────────────────────────────────
async function runScriptDoctor() {
  const screenplay = document.getElementById('doctorInput').value.trim();
  if (!screenplay) {
    showToast('Please paste a screenplay or click "Load Sample" to diagnose.', 'error');
    return;
  }

  const btn = document.getElementById('doctorBtn');
  if (btn) btn.disabled = true;
  showLoading('Running 12-category Script Doctor diagnosis…');

  try {
    const data = await apiCall('/api/script-doctor', {
      api_key: 'env',
      screenplay: screenplay
    });
    if (data.success) {
      setOutput('doctorOutput', data.result);
      showToast('🩺 Script Doctor diagnosis complete!', 'success');
    } else {
      showToast('❌ Error: ' + (data.error || 'Diagnosis failed'), 'error');
    }
  } catch (err) {
    showToast('❌ Network error: ' + err.message, 'error');
  } finally {
    hideLoading();
    if (btn) btn.disabled = false;
  }
}

// ─── 8. Script Coverage ───────────────────────────────────────
async function generateCoverage() {
  const screenplay = document.getElementById('coverageInput').value.trim();
  if (!screenplay) {
    showToast('Please paste a screenplay or click "Load Sample" for coverage.', 'error');
    return;
  }

  const btn = document.getElementById('coverageBtn');
  if (btn) btn.disabled = true;
  showLoading('Generating industry-standard Script Coverage report…');

  try {
    const data = await apiCall('/api/script-coverage', {
      api_key: 'env',
      screenplay: screenplay
    });
    if (data.success) {
      setOutput('coverageOutput', data.result);
      showToast('📊 Script Coverage report ready!', 'success');
    } else {
      showToast('❌ Error: ' + (data.error || 'Coverage generation failed'), 'error');
    }
  } catch (err) {
    showToast('❌ Network error: ' + err.message, 'error');
  } finally {
    hideLoading();
    if (btn) btn.disabled = false;
  }
}

// ─── Pipeline Workflow Navigator ─────────────────────────────
function updatePipelineActive(stepId) {
  document.querySelectorAll('.pipe-step').forEach(btn => btn.classList.remove('active'));
  const activeBtn = document.getElementById('pipe-' + stepId);
  if (activeBtn) activeBtn.classList.add('active');
}

function getGeneratedScreenplay() {
  const el = document.getElementById('screenplayOutput');
  if (!el) return '';
  const txt = el.textContent.trim();
  if (txt && !txt.includes('Your screenplay will appear here')) {
    return txt;
  }
  return currentScreenplay || '';
}

function goToPipelineStep(step) {
  updatePipelineActive(step);

  if (step === 'story') {
    showTab('screenplay');
    const input = document.getElementById('storyInput');
    if (input) {
      input.scrollIntoView({ behavior: 'smooth', block: 'center' });
      input.focus();
    }
    showToast('📌 Step 1: Input your story or source material', 'info');
  } 
  else if (step === 'convert') {
    showTab('screenplay');
    const story = document.getElementById('storyInput').value.trim();
    if (!story) {
      loadSample('story', 'storyInput');
      showToast('✨ Loaded sample story — click "Convert to Screenplay"!', 'info');
    } else {
      convertStory();
    }
  } 
  else if (step === 'editor') {
    showTab('screenplay');
    const out = document.getElementById('screenplayOutput');
    const assist = document.getElementById('assistInput');
    if (out) out.scrollIntoView({ behavior: 'smooth', block: 'center' });
    if (assist) assist.focus();
    showToast('✏️ Step 3: Screenplay Editor & AI Assist', 'info');
  } 
  else if (step === 'bible') {
    showTab('character');
    showCharTab('bible');
    const bibleInput = document.getElementById('bibleInput');
    const script = getGeneratedScreenplay();
    if (script && bibleInput && !bibleInput.value.trim()) {
      bibleInput.value = script;
      showToast('📥 Auto-loaded screenplay into Character Bible!', 'success');
    } else {
      showToast('📖 Step 4: Character Intelligence & Bible', 'info');
    }
  } 
  else if (step === 'doctor') {
    showTab('doctor');
    const docInput = document.getElementById('doctorInput');
    const script = getGeneratedScreenplay();
    if (script && docInput && !docInput.value.trim()) {
      docInput.value = script;
      showToast('📥 Auto-loaded screenplay into Script Doctor!', 'success');
    } else {
      showToast('🩺 Step 5: Script Doctor Diagnosis', 'info');
    }
  } 
  else if (step === 'coverage') {
    showTab('coverage');
    const covInput = document.getElementById('coverageInput');
    const script = getGeneratedScreenplay();
    if (script && covInput && !covInput.value.trim()) {
      covInput.value = script;
      showToast('📥 Auto-loaded screenplay into Script Coverage!', 'success');
    } else {
      showToast('📊 Step 6: Script Coverage Report', 'info');
    }
  } 
  else if (step === 'final') {
    showFinalScreenplayModal();
  }
}

// ─── Final Screenplay Master View Modal ───────────────────────
function showFinalScreenplayModal() {
  const modal = document.getElementById('finalModal');
  const target = document.getElementById('finalScriptContent');
  if (!modal || !target) return;

  const script = getGeneratedScreenplay();
  if (!script) {
    // Load sample screenplay so modal is not blank
    loadSample('screenplay', 'finalScriptContent');
    showToast('💡 Showing sample screenplay in Master View.', 'info');
  } else {
    target.textContent = script;
  }

  // Calculate statistics
  const currentText = target.textContent || '';
  const wordCount = currentText.trim().split(/\s+/).filter(Boolean).length;
  // Standard Hollywood rule: ~250 words per page, ~1 page = 1 min screen time
  const pages = Math.max(1, Math.round((wordCount / 250) * 10) / 10);
  const runtime = Math.round(pages);

  document.getElementById('metaWords').textContent = wordCount.toLocaleString();
  document.getElementById('metaPages').textContent = pages;
  document.getElementById('metaRuntime').textContent = `~${runtime} mins`;

  modal.style.display = 'flex';
}

function closeFinalModal() {
  const modal = document.getElementById('finalModal');
  if (modal) modal.style.display = 'none';
}

function printFinalScreenplay() {
  window.print();
}

function sendFinalTo(targetTab) {
  const script = getGeneratedScreenplay() || document.getElementById('finalScriptContent').textContent;
  closeFinalModal();
  if (targetTab === 'doctor') {
    showTab('doctor');
    const docInput = document.getElementById('doctorInput');
    if (docInput && script) {
      docInput.value = script;
      showToast('📥 Screenplay sent to Script Doctor!', 'success');
    }
  } else if (targetTab === 'coverage') {
    showTab('coverage');
    const covInput = document.getElementById('coverageInput');
    if (covInput && script) {
      covInput.value = script;
      showToast('📥 Screenplay sent to Script Coverage!', 'success');
    }
  }
}

// ─── Init ────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  // Auto-detect .env API key
  checkEnvKey();

  // Enter key on assist bar
  const assistInput = document.getElementById('assistInput');
  if (assistInput) {
    assistInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') scriptAssist();
    });
  }

  showTab('screenplay');
});
