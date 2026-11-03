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

  // If navigating to Language tab, auto-populate character dropdown
  if (tabName === 'language') {
    populateCharacterDropdown();
  }

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

// ─── Markdown → HTML Renderer ────────────────────────────────
// ─── Table Helpers ────────────────────────────────────────────
function isTableRow(str) {
  if (!str) return false;
  const s = str.trim();
  if (!s.includes('|')) return false;
  if (/^#{1,6}\s+/.test(s) || /^---+$/.test(s) || /^\*\*\*+$/.test(s)) return false;
  return true;
}

function parseTableCells(rowStr) {
  let s = rowStr.trim();
  if (s.startsWith('|')) s = s.substring(1);
  if (s.endsWith('|')) s = s.substring(0, s.length - 1);
  // Support escaped pipe \|
  s = s.replace(/\\\|/g, '\uE000');
  const cells = s.split('|').map(c => c.replace(/\uE000/g, '|').trim());
  return cells;
}

function isTableDelimiterRow(str) {
  if (!isTableRow(str)) return false;
  const cells = parseTableCells(str);
  if (cells.length < 2) return false;
  return cells.every(c => /^:?-{2,}:?$/.test(c));
}

function getColumnClass(headerText) {
  const h = (headerText || '').toLowerCase();
  if (h.includes('scene') || h.includes('location')) return 'col-location';
  if (h.includes('problem') || h.includes('issue') || h.includes('weakness')) return 'col-problem';
  if (h.includes('diagnosis')) return 'col-diagnosis';
  if (h.includes('recommendation') || h.includes('suggestion') || h.includes('fix')) return 'col-recommendation';
  if (h.includes('rewrite') || h.includes('example')) return 'col-rewrite';
  if (h.includes('score') || h.includes('rating') || h.includes('health')) return 'col-score';
  if (h.includes('category') || h.includes('dimension')) return 'col-category';
  return '';
}

// ─── Markdown → HTML Renderer ────────────────────────────────
function renderMarkdown(text) {
  if (!text) return '';

  // Escape raw HTML to prevent XSS
  let html = text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');

  const lines = html.split('\n');
  const output = [];
  let inList = false;
  let listType = '';

  for (let i = 0; i < lines.length; i++) {
    let line = lines[i];

    // ── Skip lone delimiter row ──
    if (isTableDelimiterRow(line)) {
      continue;
    }

    // ── Table Parsing ──
    if (isTableRow(line)) {
      if (inList) { output.push(`</${listType}>`); inList = false; }

      const isStandardTable = (i + 1 < lines.length && isTableDelimiterRow(lines[i + 1]));
      let isDelimiterlessTable = false;
      if (!isStandardTable && i + 1 < lines.length && isTableRow(lines[i + 1]) && !isTableDelimiterRow(lines[i + 1])) {
        const c0 = parseTableCells(line);
        const c1 = parseTableCells(lines[i + 1]);
        if (c0.length >= 2 && c0.length === c1.length) {
          isDelimiterlessTable = true;
        }
      }

      if (isStandardTable || isDelimiterlessTable) {
        const headerCells = parseTableCells(line);
        let alignments = [];
        let startBodyIdx = i + 1;

        if (isStandardTable) {
          alignments = parseTableCells(lines[i + 1]).map(c => {
            const left = c.startsWith(':');
            const right = c.endsWith(':');
            if (left && right) return 'center';
            if (right) return 'right';
            return 'left';
          });
          startBodyIdx = i + 2;
        } else {
          alignments = headerCells.map(() => 'left');
          startBodyIdx = i + 1;
        }

        const colClasses = headerCells.map(h => getColumnClass(h));

        const ths = headerCells.map((cell, idx) => {
          const align = alignments[idx] || 'left';
          const cls = colClasses[idx] ? ` class="${colClasses[idx]}"` : '';
          return `<th style="text-align: ${align};"${cls}>${applyInline(cell)}</th>`;
        }).join('');

        let tableRows = [];
        let r = startBodyIdx;
        while (r < lines.length && isTableRow(lines[r]) && !isTableDelimiterRow(lines[r])) {
          const cells = parseTableCells(lines[r]);
          const numCols = Math.max(headerCells.length, cells.length);
          let tds = [];
          for (let c = 0; c < numCols; c++) {
            const cell = cells[c] || '';
            const align = alignments[c] || 'left';
            const cls = colClasses[c] ? ` class="${colClasses[c]}"` : '';
            tds.push(`<td style="text-align: ${align};"${cls}>${applyInline(cell)}</td>`);
          }
          tableRows.push(`<tr>${tds.join('')}</tr>`);
          r++;
        }

        output.push(`
          <div class="md-table-wrap">
            <table class="md-table">
              <thead><tr>${ths}</tr></thead>
              <tbody>${tableRows.join('')}</tbody>
            </table>
          </div>
        `);
        i = r - 1;
        continue;
      }
    }

    // ── Headings ──
    if (/^######\s+/.test(line)) {
      if (inList) { output.push(`</${listType}>`); inList = false; }
      output.push(`<h6 class="md-h6">${applyInline(line.replace(/^######\s+/, ''))}</h6>`);
      continue;
    }
    if (/^#####\s+/.test(line)) {
      if (inList) { output.push(`</${listType}>`); inList = false; }
      output.push(`<h5 class="md-h5">${applyInline(line.replace(/^#####\s+/, ''))}</h5>`);
      continue;
    }
    if (/^####\s+/.test(line)) {
      if (inList) { output.push(`</${listType}>`); inList = false; }
      output.push(`<h4 class="md-h4">${applyInline(line.replace(/^####\s+/, ''))}</h4>`);
      continue;
    }
    if (/^###\s+/.test(line)) {
      if (inList) { output.push(`</${listType}>`); inList = false; }
      output.push(`<h3 class="md-h3">${applyInline(line.replace(/^###\s+/, ''))}</h3>`);
      continue;
    }
    if (/^##\s+/.test(line)) {
      if (inList) { output.push(`</${listType}>`); inList = false; }
      output.push(`<h2 class="md-h2">${applyInline(line.replace(/^##\s+/, ''))}</h2>`);
      continue;
    }
    if (/^#\s+/.test(line)) {
      if (inList) { output.push(`</${listType}>`); inList = false; }
      output.push(`<h1 class="md-h1">${applyInline(line.replace(/^#\s+/, ''))}</h1>`);
      continue;
    }

    // ── Horizontal Rule ──
    if (/^---+$/.test(line.trim()) || /^\*\*\*+$/.test(line.trim())) {
      if (inList) { output.push(`</${listType}>`); inList = false; }
      output.push('<hr class="md-hr" />');
      continue;
    }

    // ── Unordered list ──
    if (/^[\*\-]\s+/.test(line)) {
      if (!inList || listType !== 'ul') {
        if (inList) output.push(`</${listType}>`);
        output.push('<ul class="md-ul">');
        inList = true;
        listType = 'ul';
      }
      output.push(`<li>${applyInline(line.replace(/^[\*\-]\s+/, ''))}</li>`);
      continue;
    }

    // ── Ordered list ──
    if (/^\d+\.\s+/.test(line)) {
      if (!inList || listType !== 'ol') {
        if (inList) output.push(`</${listType}>`);
        output.push('<ol class="md-ol">');
        inList = true;
        listType = 'ol';
      }
      output.push(`<li>${applyInline(line.replace(/^\d+\.\s+/, ''))}</li>`);
      continue;
    }

    // ── Close list on blank/non-list line ──
    if (inList && line.trim() === '') {
      output.push(`</${listType}>`);
      inList = false;
      output.push('<br />');
      continue;
    }
    if (inList) {
      output.push(`</${listType}>`);
      inList = false;
    }

    // ── Blank line → paragraph break ──
    if (line.trim() === '') {
      output.push('<br />');
      continue;
    }

    // ── Regular paragraph line ──
    output.push(`<p class="md-p">${applyInline(line)}</p>`);
  }

  if (inList) output.push(`</${listType}>`);
  return output.join('\n');
}

// ─── Apply inline markdown (bold, italic, code, etc.) ─────────
function applyInline(text) {
  if (!text) return '';
  // Restore <br> tags
  text = text.replace(/&lt;br\s*\/?&gt;/gi, '<br />');
  // Bold+Italic ***text***
  text = text.replace(/\*\*\*(.+?)\*\*\*/g, '<strong><em>$1</em></strong>');
  // Bold **text**
  text = text.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
  // Italic *text*
  text = text.replace(/\*([^\*]+?)\*/g, '<em>$1</em>');
  // Bold __text__
  text = text.replace(/__(.+?)__/g, '<strong>$1</strong>');
  // Italic _text_
  text = text.replace(/_([^_]+?)_/g, '<em>$1</em>');
  // Inline code `text`
  text = text.replace(/`(.+?)`/g, '<code class="md-code">$1</code>');
  return text;
}

// ─── Character Bible Renderer ─────────────────────────────────
function renderCharacterBible(elementId, rawText) {
  const el = document.getElementById(elementId);
  if (!el) return;

  // Split on character blocks: lines starting with **NAME** or # NAME etc.
  // Characters are separated by lines like: **CHARACTER NAME** (bold all-caps or mixed)
  const blocks = [];
  const lines = rawText.split('\n');
  let currentBlock = [];

  for (const line of lines) {
    // Detect a new character heading: **WORD** at start of trimmed line
    // or ## heading that looks like a character name
    const isCharHeading = /^\*\*[A-Z][\w\s\'\-\.]+\*\*\s*$/.test(line.trim()) ||
                          /^#{1,3}\s+[A-Z]/.test(line.trim());

    if (isCharHeading && currentBlock.length > 0) {
      blocks.push(currentBlock.join('\n'));
      currentBlock = [line];
    } else {
      currentBlock.push(line);
    }
  }
  if (currentBlock.length > 0) blocks.push(currentBlock.join('\n'));

  // If we couldn't split meaningfully (only 1 block), just render markdown
  if (blocks.length <= 1) {
    el.innerHTML = `<div class="md-content">${renderMarkdown(rawText)}</div>`;
    return;
  }

  // Render each character as a card
  const charIcons = ['🧑', '👩', '👤', '🕵️', '🧓', '👨', '🧕', '🤵', '👸', '🦹'];
  let cardsHtml = '';
  let charIdx = 0;

  for (const block of blocks) {
    if (!block.trim()) continue;
    const rendered = renderMarkdown(block);
    const icon = charIcons[charIdx % charIcons.length];
    cardsHtml += `
      <div class="char-bible-card">
        <div class="char-bible-icon">${icon}</div>
        <div class="char-bible-content md-content">${rendered}</div>
      </div>`;
    charIdx++;
  }

  el.innerHTML = `<div class="char-bible-grid">${cardsHtml}</div>`;
}

// ─── Set Output in Workspace ──────────────────────────────────
function setOutput(elementId, content) {
  const el = document.getElementById(elementId);
  if (!el) return;
  el.innerHTML = `<div class="md-content">${renderMarkdown(content)}</div>`;
  el.style.color = 'var(--text-primary)';
}

// ─── Clear Field ──────────────────────────────────────────────
function clearField(id) {
  const el = document.getElementById(id);
  if (el) el.value = '';
}

// ─── Screenplay Part Merger (Ensures exactly ONE FADE OUT at end) ───
function cleanScreenplayTransitions(text) {
  if (!text) return '';
  const lines = text.trim().split('\n');
  const filteredLines = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const isFadeOut = /^\s*(?:FADE\s+OUT\.?|FADE\s+TO\s+BLACK\.?)\s*$/i.test(line);

    if (isFadeOut) {
      // Check if there are meaningful story lines after this line
      const hasSubsequentContent = lines.slice(i + 1).some(l => {
        const t = l.trim();
        return t && !/^\s*(?:FADE\s+OUT\.?|FADE\s+TO\s+BLACK\.?)\s*$/i.test(t);
      });

      if (hasSubsequentContent) {
        // Intermediate FADE OUT! Drop it so scene flows without duplicate fade out
        continue;
      }
    }
    filteredLines.push(line);
  }

  let result = filteredLines.join('\n').trim();

  // Ensure there is only ONE clean ending "FADE OUT."
  if (/(?:FADE\s+OUT\.?|FADE\s+TO\s+BLACK\.?)\s*$/i.test(result)) {
    result = result.replace(/(?:FADE\s+OUT\.?|FADE\s+TO\s+BLACK\.?)\s*$/i, 'FADE OUT.');
  } else {
    result += '\n\nFADE OUT.';
  }

  return result;
}

function mergeScreenplayParts(parts) {
  const validParts = parts
    .map(p => (typeof p === 'string' ? p.trim() : ''))
    .filter(Boolean);

  if (validParts.length === 0) return '';
  if (validParts.length === 1) return cleanScreenplayTransitions(validParts[0]);

  const cleanedParts = [];

  for (let i = 0; i < validParts.length; i++) {
    let part = validParts[i];

    // For any scene after the first, strip redundant leading "FADE IN:"
    if (i > 0) {
      part = part.replace(/^\s*(?:FADE\s+IN:?|FADE\s+IN)\s*\n+/i, '');
    }

    // For any scene before the last, strip trailing "FADE OUT."
    if (i < validParts.length - 1) {
      part = part.replace(/\n+\s*(?:FADE\s+OUT\.?|FADE\s+TO\s+BLACK\.?)\s*$/i, '');
    }

    cleanedParts.push(part.trim());
  }

  // Combine parts with standard scene separation
  const merged = cleanedParts.join('\n\n');

  // Strip intermediate "FADE OUT." lines that might be inside intermediate scenes
  return cleanScreenplayTransitions(merged);
}

// ─── Load Merged Screenplay Into Any Tab ───────────────────────
function loadMergedScriptInto(targetId) {
  const script = getGeneratedScreenplay();
  if (!script || script.includes('Your screenplay will appear here')) {
    showToast('No generated screenplay available yet. Please generate one first.', 'error');
    return;
  }
  const el = document.getElementById(targetId);
  if (el) {
    el.value = script;
    el.dispatchEvent(new Event('input'));
    showToast('📥 Loaded complete merged screenplay (single FADE OUT)!', 'success');
  }
}

// ─── Copy to Clipboard ────────────────────────────────────────
function copyOutput(id) {
  let text = '';
  if (id === 'screenplayOutput') {
    text = getGeneratedScreenplay();
  } else {
    const el = document.getElementById(id);
    if (el && !el.querySelector('.empty-state')) {
      text = el.dataset.rawScript || el.textContent;
    }
  }

  if (!text || !text.trim() || text.includes('Your screenplay will appear here')) {
    showToast('Nothing to copy yet.', 'error');
    return;
  }

  navigator.clipboard.writeText(text).then(() => {
    const isMerged = id === 'screenplayOutput' && document.querySelectorAll('.continued-scene-content').length > 0;
    showToast(isMerged ? '✅ Copied merged screenplay (single FADE OUT)!' : '✅ Copied to clipboard!', 'success');
  });
}

// ─── Download Output as Text File ─────────────────────────────
function downloadText(id, filename) {
  let text = '';
  if (id === 'screenplayOutput') {
    text = getGeneratedScreenplay();
  } else {
    const el = document.getElementById(id);
    if (el && !el.querySelector('.empty-state')) {
      text = el.dataset.rawScript || el.textContent;
    }
  }

  if (!text || !text.trim() || text.includes('Your screenplay will appear here')) {
    showToast('Nothing to download yet.', 'error');
    return;
  }

  const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
  const isMerged = id === 'screenplayOutput' && document.querySelectorAll('.continued-scene-content').length > 0;
  showToast(isMerged ? '⬇ Download started (merged screenplay)!' : '⬇ Download started!', 'success');
}

// ─── Merge All Continued Scenes into Main Editor ─────────────
function mergeAllScenesIntoEditor() {
  const full = getGeneratedScreenplay();
  if (!full || full.includes('Your screenplay will appear here')) {
    showToast('No scenes to merge.', 'info');
    return;
  }
  setOutput('screenplayOutput', full);
  currentScreenplay = full;
  clearContinuedScenes();
  showToast('🔗 All continued scenes merged! Preserved single FADE OUT.', 'success');
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
      clearContinuedScenes();
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

// ─── Continued Scene State & Directive Cache ──────────────────
let continuedSceneCount = 0;
let cachedAssistDirective = '';

function applyAssistDirective() {
  const input = document.getElementById('assistInput');
  const val = input ? input.value.trim() : '';
  if (!val) {
    showToast('Please enter an instruction or directive for the next scene.', 'error');
    return;
  }

  cachedAssistDirective = val;
  updateDirectiveUI();
  input.value = '';
  showToast(`🎯 Directive cached: "${val}". Click "Continue Scene" to generate with this direction!`, 'success');
}

function clearCachedDirective() {
  cachedAssistDirective = '';
  updateDirectiveUI();
  showToast('Directive cache cleared.', 'info');
}

function updateDirectiveUI() {
  const container = document.getElementById('directiveContainer');
  const textEl = document.getElementById('directiveVal');
  const continueBtn = document.getElementById('continueBtn');

  if (cachedAssistDirective) {
    if (container) container.style.display = 'block';
    if (textEl) textEl.textContent = `"${cachedAssistDirective}"`;
    if (continueBtn) {
      continueBtn.classList.add('has-directive');
      continueBtn.innerHTML = `<span class="btn-icon">⚡</span> Continue Scene <span class="badge-mini">with Directive</span>`;
    }
  } else {
    if (container) container.style.display = 'none';
    if (continueBtn) {
      continueBtn.classList.remove('has-directive');
      continueBtn.innerHTML = `<span class="btn-icon">✍️</span> Continue Scene`;
    }
  }
}

function clearContinuedScenes() {
  const container = document.getElementById('continuedScenesContainer');
  if (container) {
    container.innerHTML = '';
  }
  continuedSceneCount = 0;
  const mergeBtn = document.getElementById('mergeBtn');
  if (mergeBtn) mergeBtn.style.display = 'none';
  clearCachedDirective();
}

function removeContinuedScene(id) {
  const block = document.getElementById(`continuedSceneBlock_${id}`);
  if (block) {
    block.remove();
    showToast('🗑 Continued scene removed', 'info');
  }
  const remaining = document.querySelectorAll('.continued-scene-content');
  if (remaining.length === 0) {
    const mergeBtn = document.getElementById('mergeBtn');
    if (mergeBtn) mergeBtn.style.display = 'none';
  }
}

// ─── 3. Continue Scene ────────────────────────────────────────
async function continueScene() {
  const screenplay = getGeneratedScreenplay();
  if (!screenplay || screenplay.includes('Your screenplay will appear here')) {
    showToast('Please generate or provide a screenplay first.', 'error');
    return;
  }

  const language = document.getElementById('screenplay-lang').value;
  const btn = document.getElementById('continueBtn');
  if (btn) btn.disabled = true;

  const directiveToUse = cachedAssistDirective;
  const loadingMsg = directiveToUse 
    ? `Continuing screenplay following directive: "${directiveToUse}"…`
    : 'Continuing screenplay with next scene…';

  showLoading(loadingMsg);

  try {
    const data = await apiCall('/api/continue-scene', {
      api_key: 'env',
      screenplay: screenplay,
      language: language,
      directive: directiveToUse
    });
    if (data.success) {
      continuedSceneCount++;
      const sceneIndex = continuedSceneCount;
      const container = document.getElementById('continuedScenesContainer');

      const card = document.createElement('div');
      card.className = 'continued-scene-card';
      card.id = `continuedSceneBlock_${sceneIndex}`;

      const contentId = `continuedSceneContent_${sceneIndex}`;
      const directiveBadgeHtml = directiveToUse 
        ? `<span class="directive-applied-tag" title="Generated using cached directive">🎯 "${directiveToUse}"</span>`
        : '';

      card.innerHTML = `
        <div class="continued-scene-header">
          <div class="continued-scene-title">
            <span class="scene-badge">Extension #${sceneIndex}</span>
            <span class="scene-label">Continued Scene</span>
            ${directiveBadgeHtml}
          </div>
          <div class="action-row">
            <button class="btn-sm" onclick="copyOutput('${contentId}')">📋 Copy</button>
            <button class="btn-sm" onclick="downloadText('${contentId}', 'continued_scene_${sceneIndex}.txt')">⬇ Download</button>
            <button class="btn-sm btn-ghost" onclick="removeContinuedScene(${sceneIndex})" title="Remove this scene">✕</button>
          </div>
        </div>
        <div class="screenplay-output continued-scene-content" id="${contentId}"></div>
      `;

      container.appendChild(card);
      const contentEl = document.getElementById(contentId);
      if (contentEl) contentEl.textContent = data.result;

      // Update currentScreenplay
      currentScreenplay = mergeScreenplayParts([screenplay, data.result]);

      // Reveal Merge button
      const mergeBtn = document.getElementById('mergeBtn');
      if (mergeBtn) mergeBtn.style.display = 'inline-block';

      // Clear directive cache after successfully applying it
      clearCachedDirective();

      // Smooth scroll to the newly generated scene
      card.scrollIntoView({ behavior: 'smooth', block: 'nearest' });

      if (directiveToUse) {
        showToast(`✍️ Continued Scene #${sceneIndex} generated following cached directive!`, 'success');
      } else {
        showToast(`✍️ Continued Scene #${sceneIndex} added in separate block below!`, 'success');
      }
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

// ─── Character Extraction & Dialogue Parsing Helpers ─────────
function isCharacterCue(line) {
  if (!line || line.length > 30 || line.length < 2) return false;
  if (line.includes(':') && !/\(.*\)/.test(line)) return false;
  if (/^(INT\.|EXT\.|FADE|CUT|SCENE)/i.test(line)) return false;
  return /^[A-Z0-9\s\.\-\'\’]+(\s*\([A-Za-z0-9\s\.\'\-]+\))?$/.test(line);
}

function isSceneSlugline(line) {
  return /^(INT\.|EXT\.|INT\/EXT\.|I\/E\.)/i.test(line);
}

function extractCharactersFromScript(scriptText) {
  if (!scriptText) return [];
  const lines = scriptText.split('\n');
  const charSet = new Set();
  const slugKeywords = ['INT', 'EXT', 'FADE', 'CUT', 'SCENE', 'TITLE', 'SUPER', 'BACK', 'MONTAGE', 'SERIES'];

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (isCharacterCue(line)) {
      let name = line.replace(/\s*\([^)]*\)/g, '').trim().toUpperCase();
      const firstWord = name.split(/\s+/)[0];
      if (!slugKeywords.includes(firstWord) && name.length >= 2 && name.length <= 25 && !name.includes(':')) {
        charSet.add(name);
      }
    }
  }
  return Array.from(charSet).sort();
}

function extractDialoguesForCharacter(scriptText, charName) {
  if (!scriptText || !charName) return '';
  const lines = scriptText.split('\n');
  const target = charName.toUpperCase().trim();
  const results = [];

  if (target === 'ALL') {
    let currentSpeaker = '';
    let currentSpeech = [];

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) {
        if (currentSpeaker && currentSpeech.length > 0) {
          results.push(`${currentSpeaker}\n${currentSpeech.join('\n')}`);
          currentSpeaker = '';
          currentSpeech = [];
        }
        continue;
      }

      if (isCharacterCue(line)) {
        if (currentSpeaker && currentSpeech.length > 0) {
          results.push(`${currentSpeaker}\n${currentSpeech.join('\n')}`);
        }
        currentSpeaker = line;
        currentSpeech = [];
      } else if (currentSpeaker) {
        currentSpeech.push(line);
      }
    }
    if (currentSpeaker && currentSpeech.length > 0) {
      results.push(`${currentSpeaker}\n${currentSpeech.join('\n')}`);
    }
    return results.join('\n\n');
  }

  if (target === 'NARRATOR') {
    const actionLines = [];
    let insideDialogue = false;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) {
        insideDialogue = false;
        continue;
      }
      if (isSceneSlugline(line) || /^FADE\s+(IN|OUT)/i.test(line) || /^CUT\s+TO:/i.test(line)) {
        insideDialogue = false;
        continue;
      }
      if (isCharacterCue(line)) {
        insideDialogue = true;
        continue;
      }
      if (!insideDialogue) {
        actionLines.push(line);
      }
    }
    return actionLines.join('\n\n');
  }

  // Specific character (e.g. ARJUN, PRIYA)
  let capturing = false;
  let currentHeader = '';
  let currentSpeech = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) {
      if (capturing && currentSpeech.length > 0) {
        results.push(`${currentHeader}\n${currentSpeech.join('\n')}`);
        capturing = false;
        currentSpeech = [];
      }
      continue;
    }

    if (isCharacterCue(line)) {
      const speakerName = line.replace(/\s*\([^)]*\)/g, '').trim().toUpperCase();
      if (speakerName === target) {
        capturing = true;
        currentHeader = line;
        currentSpeech = [];
      } else {
        if (capturing && currentSpeech.length > 0) {
          results.push(`${currentHeader}\n${currentSpeech.join('\n')}`);
        }
        capturing = false;
        currentSpeech = [];
      }
    } else if (capturing) {
      if (isSceneSlugline(line) || /^CUT\s+TO:/i.test(line) || /^FADE\s+OUT/i.test(line)) {
        capturing = false;
      } else {
        currentSpeech.push(line);
      }
    }
  }

  if (capturing && currentSpeech.length > 0) {
    results.push(`${currentHeader}\n${currentSpeech.join('\n')}`);
  }

  return results.join('\n\n');
}

function populateCharacterDropdown() {
  const select = document.getElementById('charSelectLang');
  if (!select) return;

  const script = getGeneratedScreenplay() || SAMPLES.screenplay;
  const chars = extractCharactersFromScript(script);

  const prevVal = select.value;
  select.innerHTML = `
    <option value="">-- Select Character / Narrator --</option>
    <option value="ALL">👥 ALL CHARACTERS (Whole Script)</option>
    <option value="NARRATOR">🎙️ NARRATOR (Scene Action & Voiceover)</option>
  `;

  chars.forEach(c => {
    const opt = document.createElement('option');
    opt.value = c;
    opt.textContent = `👤 ${c}`;
    select.appendChild(opt);
  });

  if (prevVal && select.querySelector(`option[value="${prevVal}"]`)) {
    select.value = prevVal;
  }
}

async function onCharacterSelected(charName) {
  if (!charName) {
    const countBadge = document.getElementById('charDialogueCount');
    if (countBadge) countBadge.style.display = 'none';
    return;
  }

  const script = getGeneratedScreenplay() || SAMPLES.screenplay;
  const dialogues = extractDialoguesForCharacter(script, charName);
  const inputEl = document.getElementById('dialogueInput');
  const countBadge = document.getElementById('charDialogueCount');

  if (inputEl) {
    inputEl.value = dialogues;
    inputEl.dispatchEvent(new Event('input'));
  }

  if (countBadge) {
    const count = dialogues ? dialogues.split('\n\n').filter(Boolean).length : 0;
    countBadge.textContent = `${count} ${charName === 'NARRATOR' ? 'action blocks' : 'dialogue blocks'} found`;
    countBadge.style.display = 'inline-block';
  }

  if (dialogues) {
    showToast(`🔍 Loaded dialogues for ${charName}! Detecting & converting to standard language…`, 'info');
    await convertLanguage(true);
  } else {
    showToast(`No dialogues found for ${charName} in the screenplay.`, 'warning');
  }
}

// ─── 4. Language Convert (Standard / Tenglish / Hinglish) ──────
async function convertLanguage(isAuto = false) {
  const dialogue = document.getElementById('dialogueInput').value.trim();
  if (!dialogue) {
    showToast('Please select a character or enter dialogue to convert.', 'error');
    return;
  }

  const target_lang = document.getElementById('targetLang').value;
  const charSelect = document.getElementById('charSelectLang');
  const character_name = (charSelect && charSelect.value) ? charSelect.value : 'Character';
  const personalityEl = document.getElementById('charPersonality');
  const character_personality = personalityEl ? personalityEl.value.trim() : '';

  const btn = document.getElementById('langConvertBtn');
  if (btn) btn.disabled = true;

  const isStandardizing = target_lang.toLowerCase().includes('standard');
  const loadingText = isStandardizing
    ? `Detecting non-standard dialogues for ${character_name} & converting to ${target_lang}…`
    : `Converting dialogue for ${character_name} to authentic ${target_lang}…`;

  showLoading(loadingText);

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
      if (isStandardizing) {
        showToast(`✅ Non-standard dialogues identified & converted to ${target_lang}!`, 'success');
      } else {
        showToast(`🌐 Dialogue converted to ${target_lang}!`, 'success');
      }
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
      renderCharacterBible('bibleOutput', data.result);
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
  const parts = [];
  const el = document.getElementById('screenplayOutput');
  if (el) {
    const txt = el.textContent.trim();
    if (txt && !txt.includes('Your screenplay will appear here')) {
      parts.push(txt);
    }
  }

  // Collect all continued scene blocks
  const continuedBlocks = document.querySelectorAll('.continued-scene-content');
  continuedBlocks.forEach(block => {
    const txt = block.textContent.trim();
    if (txt) {
      parts.push(txt);
    }
  });

  if (parts.length > 0) {
    return mergeScreenplayParts(parts);
  }

  return currentScreenplay ? cleanScreenplayTransitions(currentScreenplay) : '';
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
    if (script && bibleInput) {
      bibleInput.value = script;
      showToast('📥 Loaded merged screenplay (single FADE OUT) into Character Bible!', 'success');
    } else {
      showToast('📖 Step 4: Character Intelligence & Bible', 'info');
    }
  } 
  else if (step === 'doctor') {
    showTab('doctor');
    const docInput = document.getElementById('doctorInput');
    const script = getGeneratedScreenplay();
    if (script && docInput) {
      docInput.value = script;
      showToast('📥 Loaded merged screenplay (single FADE OUT) into Script Doctor!', 'success');
    } else {
      showToast('🩺 Step 5: Script Doctor Diagnosis', 'info');
    }
  } 
  else if (step === 'coverage') {
    showTab('coverage');
    const covInput = document.getElementById('coverageInput');
    const script = getGeneratedScreenplay();
    if (script && covInput) {
      covInput.value = script;
      showToast('📥 Loaded merged screenplay (single FADE OUT) into Script Coverage!', 'success');
    } else {
      showToast('📊 Step 6: Script Coverage Report', 'info');
    }
  } 
  else if (step === 'final') {
    showFinalScreenplayModal();
  }
}

// ─── Hollywood Screenplay Formatter ───────────────────────────
function formatScreenplayToHtml(scriptText) {
  if (!scriptText) return '';
  const lines = scriptText.split('\n');
  const htmlParts = [];
  let inDialogueBlock = false;

  for (let i = 0; i < lines.length; i++) {
    const raw = lines[i];
    let line = raw.trim();

    // Strip markdown formatting like ** or ##
    line = line.replace(/^\*{2,3}|\*{2,3}$/g, '').replace(/^#{1,4}\s*/, '').trim();

    if (!line) {
      inDialogueBlock = false;
      htmlParts.push('<div class="sp-blank"></div>');
      continue;
    }

    // 1. Slugline / Scene Heading (INT., EXT., etc.)
    if (isSceneSlugline(line)) {
      inDialogueBlock = false;
      htmlParts.push(`<div class="sp-element sp-slugline">${escapeHtml(line)}</div>`);
      continue;
    }

    // 2. Transitions (CUT TO:, FADE OUT., etc.)
    if (/^(CUT\s+TO:|FADE\s+OUT\.?|DISSOLVE\s+TO:|SMASH\s+CUT\s+TO:|MATCH\s+CUT\s+TO:|JUMP\s+CUT\s+TO:|FADE\s+TO\s+BLACK\.?)$/i.test(line) ||
        (/^[A-Z\s]{3,20}\s+TO:$/.test(line) && !line.includes('.'))) {
      inDialogueBlock = false;
      htmlParts.push(`<div class="sp-element sp-transition">${escapeHtml(line)}</div>`);
      continue;
    }

    // Opening FADE IN:
    if (/^FADE\s+IN:?$/i.test(line)) {
      inDialogueBlock = false;
      htmlParts.push(`<div class="sp-element sp-fade-in">${escapeHtml(line)}</div>`);
      continue;
    }

    // 3. Character Cue (ARJUN, PRIYA (O.S.))
    const nextLine = (i + 1 < lines.length) ? lines[i + 1].trim() : '';
    const hasNextDialogue = nextLine && !isSceneSlugline(nextLine) && !/^(CUT|FADE|DISSOLVE)/i.test(nextLine);

    if (isCharacterCue(line) && hasNextDialogue) {
      inDialogueBlock = true;
      htmlParts.push(`<div class="sp-element sp-character">${escapeHtml(line)}</div>`);
      continue;
    }

    // 4. Parenthetical (whispering)
    if (/^\(.*\)$/.test(line)) {
      htmlParts.push(`<div class="sp-element sp-parenthetical">${escapeHtml(line)}</div>`);
      continue;
    }

    // 5. Dialogue (follows character cue or parenthetical)
    if (inDialogueBlock) {
      htmlParts.push(`<div class="sp-element sp-dialogue">${escapeHtml(line)}</div>`);
      continue;
    }

    // 6. Action / Scene Description
    inDialogueBlock = false;
    htmlParts.push(`<div class="sp-element sp-action">${escapeHtml(line)}</div>`);
  }

  return `<div class="screenplay-page"><div class="screenplay-page-inner">${htmlParts.join('')}</div></div>`;
}

function escapeHtml(str) {
  return (str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

let finalScreenplayViewMode = 'script';

function setScreenplayViewMode(mode) {
  finalScreenplayViewMode = mode;
  const target = document.getElementById('finalScriptContent');
  const btnScript = document.getElementById('btnScriptView');
  const btnPlain = document.getElementById('btnPlainView');

  if (btnScript && btnPlain) {
    if (mode === 'script') {
      btnScript.classList.add('active');
      btnPlain.classList.remove('active');
    } else {
      btnPlain.classList.add('active');
      btnScript.classList.remove('active');
    }
  }

  if (!target) return;
  const rawScript = target.dataset.rawScript || '';

  if (mode === 'script') {
    target.innerHTML = formatScreenplayToHtml(rawScript);
  } else {
    target.innerHTML = `<div class="screenplay-page"><pre class="plain-script-pre">${escapeHtml(rawScript)}</pre></div>`;
  }
}

// ─── Final Screenplay Master View Modal ───────────────────────
function showFinalScreenplayModal() {
  const modal = document.getElementById('finalModal');
  const target = document.getElementById('finalScriptContent');
  if (!modal || !target) return;

  let script = getGeneratedScreenplay();
  if (!script || !script.trim()) {
    script = SAMPLES['screenplay'];
    showToast('💡 Showing sample screenplay in Master View.', 'info');
  }

  target.dataset.rawScript = script;

  // Render in script aligned format by default
  finalScreenplayViewMode = 'script';
  const btnScript = document.getElementById('btnScriptView');
  const btnPlain = document.getElementById('btnPlainView');
  if (btnScript) btnScript.classList.add('active');
  if (btnPlain) btnPlain.classList.remove('active');

  target.innerHTML = formatScreenplayToHtml(script);

  // Calculate statistics
  const wordCount = script.trim().split(/\s+/).filter(Boolean).length;
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
  const finalEl = document.getElementById('finalScriptContent');
  const script = getGeneratedScreenplay() || (finalEl ? (finalEl.dataset.rawScript || finalEl.textContent) : '');
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
      if (e.key === 'Enter') applyAssistDirective();
    });
  }

  showTab('screenplay');
});
