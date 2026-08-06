const SCRIPT_URL_KEY = 'egpAnswerVaultScriptUrl';
const ACCESS_KEY_KEY = 'egpAnswerVaultAccessKey';
const CACHE_KEY = 'egpAnswerVaultOfflineCacheV2';

let entries = [];
let activeEditId = null;
let isLoading = false;

const els = {
  qaGrid: document.getElementById('qaGrid'),
  emptyState: document.getElementById('emptyState'),
  searchInput: document.getElementById('searchInput'),
  categoryFilter: document.getElementById('categoryFilter'),
  sortFilter: document.getElementById('sortFilter'),
  questionDialog: document.getElementById('questionDialog'),
  settingsDialog: document.getElementById('settingsDialog'),
  questionForm: document.getElementById('questionForm'),
  settingsForm: document.getElementById('settingsForm'),
  followupFields: document.getElementById('followupFields'),
  modalTitle: document.getElementById('modalTitle'),
  syncBadge: document.getElementById('syncBadge'),
  toast: document.getElementById('toast'),
  refreshBtn: document.getElementById('refreshBtn'),
  loadingState: document.getElementById('loadingState'),
  lastSynced: document.getElementById('lastSynced')
};

function scriptUrl() { return localStorage.getItem(SCRIPT_URL_KEY) || ''; }
function accessKey() { return localStorage.getItem(ACCESS_KEY_KEY) || ''; }
function uid() { return crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`; }
function escapeHtml(str = '') { return String(str).replace(/[&<>'"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#039;','"':'&quot;'}[c])); }
function formatDate(iso) {
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? 'Unknown' : new Intl.DateTimeFormat('en-US', {month:'short', day:'numeric', year:'numeric'}).format(date);
}
function loadCache() {
  try { return JSON.parse(localStorage.getItem(CACHE_KEY)) || []; } catch { return []; }
}
function saveCache() { localStorage.setItem(CACHE_KEY, JSON.stringify(entries)); }

function normalizeEntry(row) {
  if (row.id) return row;
  let followups = [];
  try { followups = JSON.parse(row.FollowUps_JSON || '[]'); } catch { followups = []; }
  return {
    id: String(row.ID || ''),
    question: String(row.Question || ''),
    answer: String(row.Answer || ''),
    category: String(row.Category || ''),
    tags: String(row.Tags || '').split(',').map(x => x.trim()).filter(Boolean),
    followups,
    createdAt: row.CreatedAt || new Date().toISOString(),
    updatedAt: row.UpdatedAt || row.CreatedAt || new Date().toISOString()
  };
}

function render() {
  const query = els.searchInput.value.trim().toLowerCase();
  const category = els.categoryFilter.value;
  const sort = els.sortFilter.value;
  let filtered = entries.filter(entry => {
    const haystack = [entry.question, entry.answer, entry.category, ...(entry.tags || []), ...(entry.followups || []).flatMap(f => [f.question, f.answer])].join(' ').toLowerCase();
    return (!query || haystack.includes(query)) && (category === 'all' || entry.category === category);
  });
  filtered.sort((a, b) => sort === 'az'
    ? a.question.localeCompare(b.question)
    : new Date(b[sort === 'created' ? 'createdAt' : 'updatedAt']) - new Date(a[sort === 'created' ? 'createdAt' : 'updatedAt']));

  els.qaGrid.innerHTML = filtered.map(entry => `
    <article class="qa-card">
      <div class="qa-card-head">
        <div>
          <div class="meta-row">
            ${entry.category ? `<span class="pill category">${escapeHtml(entry.category)}</span>` : ''}
            ${(entry.tags || []).map(tag => `<span class="pill">${escapeHtml(tag)}</span>`).join('')}
            <span class="pill">Updated ${formatDate(entry.updatedAt)}</span>
          </div>
          <h3>${escapeHtml(entry.question)}</h3>
        </div>
        <div class="card-actions">
          <button class="mini-btn" onclick="copyAnswer('${entry.id}')">Copy</button>
          <button class="mini-btn" onclick="editEntry('${entry.id}')">Edit</button>
          <button class="mini-btn danger" onclick="deleteEntry('${entry.id}')">Delete</button>
        </div>
      </div>
      <div class="answer-text">${escapeHtml(entry.answer)}</div>
      ${(entry.followups || []).length ? `<details class="followups"><summary>${entry.followups.length} prospective follow-up${entry.followups.length === 1 ? '' : 's'}</summary>${entry.followups.map(f => `<div class="followup-item"><strong>${escapeHtml(f.question)}</strong><p>${escapeHtml(f.answer)}</p></div>`).join('')}</details>` : ''}
    </article>`).join('');

  els.emptyState.classList.toggle('hidden', entries.length !== 0 || isLoading);
  els.qaGrid.classList.toggle('hidden', entries.length === 0 || isLoading);
  els.loadingState.classList.toggle('hidden', !isLoading);
  updateStats();
  rebuildCategories();
}

function rebuildCategories() {
  const current = els.categoryFilter.value;
  const cats = [...new Set(entries.map(e => e.category).filter(Boolean))].sort();
  els.categoryFilter.innerHTML = '<option value="all">All categories</option>' + cats.map(c => `<option value="${escapeHtml(c)}">${escapeHtml(c)}</option>`).join('');
  if ([...els.categoryFilter.options].some(o => o.value === current)) els.categoryFilter.value = current;
}

function updateStats() {
  document.getElementById('questionCount').textContent = entries.length;
  document.getElementById('followupCount').textContent = entries.reduce((n, e) => n + (e.followups || []).length, 0);
  document.getElementById('categoryCount').textContent = new Set(entries.map(e => e.category).filter(Boolean)).size;
  const connected = Boolean(scriptUrl());
  document.getElementById('backupStatus').textContent = connected ? 'Live source' : 'Not connected';
  els.syncBadge.textContent = isLoading ? 'Syncing…' : connected ? 'Sheets live' : 'Setup required';
  els.syncBadge.classList.toggle('connected', connected && !isLoading);
}

async function loadFromSheet({ quiet = false } = {}) {
  const url = scriptUrl();
  if (!url) {
    entries = loadCache();
    render();
    if (!quiet) els.settingsDialog.showModal();
    return;
  }
  isLoading = true;
  render();
  try {
    const params = new URLSearchParams({ action: 'list', key: accessKey(), t: Date.now().toString() });
    const response = await fetch(`${url}?${params.toString()}`, { cache: 'no-store' });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const result = await response.json();
    if (!result.ok) throw new Error(result.error || 'Could not load data');
    entries = (result.data || []).map(normalizeEntry).filter(e => e.id);
    saveCache();
    const now = new Date();
    els.lastSynced.textContent = `Last synced ${now.toLocaleTimeString([], {hour:'numeric', minute:'2-digit'})}`;
    if (!quiet) toast('Loaded latest data from Google Sheets');
  } catch (error) {
    console.error(error);
    entries = loadCache();
    els.lastSynced.textContent = 'Offline cache shown';
    toast('Could not reach Sheets — showing cached data');
  } finally {
    isLoading = false;
    render();
  }
}

async function requestSheet(action, payload = {}) {
  const url = scriptUrl();
  if (!url) throw new Error('Connect Google Sheets first');
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain;charset=utf-8' },
    body: JSON.stringify({ action, key: accessKey(), ...payload })
  });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  const result = await response.json();
  if (!result.ok) throw new Error(result.error || 'Sheets update failed');
  return result;
}

function openNew() {
  activeEditId = null;
  els.questionForm.reset();
  els.modalTitle.textContent = 'Add Question';
  els.followupFields.innerHTML = '';
  addFollowupField();
  els.questionDialog.showModal();
}

function addFollowupField(question = '', answer = '') {
  const row = document.createElement('div');
  row.className = 'followup-entry';
  row.innerHTML = `<textarea class="follow-q" placeholder="Likely follow-up question">${escapeHtml(question)}</textarea><textarea class="follow-a" placeholder="Prepared answer">${escapeHtml(answer)}</textarea><button type="button" class="remove-followup">✕</button>`;
  row.querySelector('.remove-followup').onclick = () => row.remove();
  els.followupFields.appendChild(row);
}

window.editEntry = function(id) {
  const e = entries.find(x => x.id === id);
  if (!e) return;
  activeEditId = id;
  document.getElementById('questionField').value = e.question;
  document.getElementById('answerField').value = e.answer;
  document.getElementById('categoryField').value = e.category || '';
  document.getElementById('tagsField').value = (e.tags || []).join(', ');
  els.followupFields.innerHTML = '';
  (e.followups || []).forEach(f => addFollowupField(f.question, f.answer));
  if (!(e.followups || []).length) addFollowupField();
  els.modalTitle.textContent = 'Edit Question';
  els.questionDialog.showModal();
};

window.copyAnswer = async function(id) {
  const e = entries.find(x => x.id === id);
  if (!e) return;
  await navigator.clipboard.writeText(e.answer);
  toast('Answer copied');
};

window.deleteEntry = async function(id) {
  if (!confirm('Delete this question from the shared Google Sheet? This affects every device.')) return;
  try {
    toast('Deleting…');
    await requestSheet('delete', { id });
    await loadFromSheet({ quiet: true });
    toast('Question deleted everywhere');
  } catch (error) {
    console.error(error);
    toast(`Delete failed: ${error.message}`);
  }
};

els.questionForm.addEventListener('submit', async event => {
  event.preventDefault();
  const now = new Date().toISOString();
  const followups = [...document.querySelectorAll('.followup-entry')]
    .map(row => ({ question: row.querySelector('.follow-q').value.trim(), answer: row.querySelector('.follow-a').value.trim() }))
    .filter(f => f.question || f.answer);
  const existing = entries.find(e => e.id === activeEditId);
  const entry = {
    id: activeEditId || uid(),
    question: document.getElementById('questionField').value.trim(),
    answer: document.getElementById('answerField').value.trim(),
    category: document.getElementById('categoryField').value.trim(),
    tags: document.getElementById('tagsField').value.split(',').map(x => x.trim()).filter(Boolean),
    followups,
    createdAt: existing?.createdAt || now,
    updatedAt: now
  };
  try {
    const submitBtn = els.questionForm.querySelector('[type="submit"]');
    submitBtn.disabled = true;
    submitBtn.textContent = 'Saving…';
    await requestSheet('upsert', { entry });
    els.questionDialog.close();
    await loadFromSheet({ quiet: true });
    toast('Saved to the shared vault');
  } catch (error) {
    console.error(error);
    toast(`Save failed: ${error.message}`);
  } finally {
    const submitBtn = els.questionForm.querySelector('[type="submit"]');
    submitBtn.disabled = false;
    submitBtn.textContent = 'Save to Vault';
  }
});

function toast(message) {
  els.toast.textContent = message;
  els.toast.classList.add('show');
  clearTimeout(window.__toastTimer);
  window.__toastTimer = setTimeout(() => els.toast.classList.remove('show'), 2800);
}

document.getElementById('newQuestionBtn').onclick = openNew;
document.getElementById('emptyAddBtn').onclick = openNew;
document.getElementById('addFollowupBtn').onclick = () => addFollowupField();
document.getElementById('closeDialogBtn').onclick = () => els.questionDialog.close();
document.getElementById('cancelBtn').onclick = () => els.questionDialog.close();
els.refreshBtn.onclick = () => loadFromSheet();
document.getElementById('settingsBtn').onclick = () => {
  document.getElementById('scriptUrlField').value = scriptUrl();
  document.getElementById('accessKeyField').value = accessKey();
  els.settingsDialog.showModal();
};
document.getElementById('closeSettingsBtn').onclick = () => els.settingsDialog.close();
document.getElementById('disconnectBtn').onclick = () => {
  localStorage.removeItem(SCRIPT_URL_KEY);
  localStorage.removeItem(ACCESS_KEY_KEY);
  entries = [];
  els.settingsDialog.close();
  render();
  toast('Google Sheets disconnected');
};
els.settingsForm.addEventListener('submit', async e => {
  e.preventDefault();
  const url = document.getElementById('scriptUrlField').value.trim();
  const key = document.getElementById('accessKeyField').value.trim();
  if (url) localStorage.setItem(SCRIPT_URL_KEY, url); else localStorage.removeItem(SCRIPT_URL_KEY);
  if (key) localStorage.setItem(ACCESS_KEY_KEY, key); else localStorage.removeItem(ACCESS_KEY_KEY);
  els.settingsDialog.close();
  await loadFromSheet();
});
['input', 'change'].forEach(evt => {
  els.searchInput.addEventListener(evt, render);
  els.categoryFilter.addEventListener(evt, render);
  els.sortFilter.addEventListener(evt, render);
});

render();
loadFromSheet({ quiet: true });
