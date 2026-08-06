'use strict';

const STORAGE_KEYS = Object.freeze({
  scriptUrl: 'egpHub.scriptUrl',
  accessKey: 'egpHub.accessKey',
  cache: 'egpHub.cache'
});

const ICONS = Object.freeze({
  down: 'assets/icons/chevron-down-svgrepo-com.svg',
  right: 'assets/icons/chevron-right-svgrepo-com.svg',
  copy: 'assets/icons/copy-svgrepo-com.svg',
  edit: 'assets/icons/edit-3-svgrepo-com.svg',
  trash: 'assets/icons/trash-xmark-svgrepo-com.svg'
});

const state = {
  entries: [],
  openQuestions: new Set(),
  openFollowups: new Set(),
  editingId: null,
  copyEntryId: null,
  loading: false
};

const els = {
  questionList: document.getElementById('questionList'),
  emptyState: document.getElementById('emptyState'),
  loadingState: document.getElementById('loadingState'),
  questionCount: document.getElementById('questionCount'),
  followupCount: document.getElementById('followupCount'),
  lastSyncedText: document.getElementById('lastSyncedText'),
  syncStatus: document.getElementById('syncStatus'),
  syncStatusText: document.getElementById('syncStatusText'),
  searchInput: document.getElementById('searchInput'),
  categoryFilter: document.getElementById('categoryFilter'),
  questionDialog: document.getElementById('questionDialog'),
  questionForm: document.getElementById('questionForm'),
  questionDialogTitle: document.getElementById('questionDialogTitle'),
  entryId: document.getElementById('entryId'),
  questionField: document.getElementById('questionField'),
  answerField: document.getElementById('answerField'),
  categoryField: document.getElementById('categoryField'),
  followupFields: document.getElementById('followupFields'),
  saveQuestionBtn: document.getElementById('saveQuestionBtn'),
  settingsDialog: document.getElementById('settingsDialog'),
  settingsForm: document.getElementById('settingsForm'),
  scriptUrlField: document.getElementById('scriptUrlField'),
  accessKeyField: document.getElementById('accessKeyField'),
  copyDialog: document.getElementById('copyDialog'),
  toast: document.getElementById('toast')
};

function getConnection() {
  return {
    scriptUrl: (localStorage.getItem(STORAGE_KEYS.scriptUrl) || '').trim(),
    accessKey: (localStorage.getItem(STORAGE_KEYS.accessKey) || '').trim()
  };
}

function hasConnection() {
  const { scriptUrl, accessKey } = getConnection();
  return Boolean(scriptUrl && accessKey);
}

function uid() {
  if (window.crypto?.randomUUID) return crypto.randomUUID();
  return `egp-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function normalizeEntry(raw) {
  const followups = Array.isArray(raw.followups)
    ? raw.followups
    : parseFollowups(raw.FollowUps_JSON || raw.followupsJson || '[]');

  return {
    id: String(raw.id || raw.ID || ''),
    question: String(raw.question || raw.Question || '').trim(),
    answer: String(raw.answer || raw.Answer || '').trim(),
    category: String(raw.category || raw.Category || 'General').trim() || 'General',
    followups: followups
      .map(item => ({
        id: String(item.id || uid()),
        question: String(item.question || item.Question || '').trim(),
        answer: String(item.answer || item.Answer || '').trim()
      }))
      .filter(item => item.question || item.answer),
    createdAt: String(raw.createdAt || raw.CreatedAt || ''),
    updatedAt: String(raw.updatedAt || raw.UpdatedAt || '')
  };
}

function parseFollowups(value) {
  if (Array.isArray(value)) return value;
  try {
    const parsed = JSON.parse(value || '[]');
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function saveCache() {
  localStorage.setItem(STORAGE_KEYS.cache, JSON.stringify(state.entries));
}

function loadCache() {
  try {
    const data = JSON.parse(localStorage.getItem(STORAGE_KEYS.cache) || '[]');
    return Array.isArray(data) ? data.map(normalizeEntry).filter(entry => entry.id) : [];
  } catch {
    return [];
  }
}

function setSyncStatus(mode, text) {
  els.syncStatus.className = `sync-status ${mode}`;
  els.syncStatusText.textContent = text;
}

function setLastSynced(date = null) {
  if (!date) {
    els.lastSyncedText.textContent = 'Never';
    return;
  }
  els.lastSyncedText.textContent = date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
}

async function apiRequest(action, payload = {}) {
  const { scriptUrl, accessKey } = getConnection();
  if (!scriptUrl || !accessKey) throw new Error('Connect Google Sheets in Settings first.');

  const response = await fetch(scriptUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain;charset=utf-8' },
    body: JSON.stringify({ action, key: accessKey, ...payload })
  });

  if (!response.ok) throw new Error(`Google Apps Script returned HTTP ${response.status}.`);

  const result = await response.json();
  if (!result.ok) throw new Error(result.error || 'Google Sheets request failed.');
  return result;
}

async function syncFromSheet({ quiet = false } = {}) {
  if (!hasConnection()) {
    state.entries = loadCache();
    setSyncStatus('setup', 'Setup required');
    render();
    return;
  }

  state.loading = true;
  setSyncStatus('saving', 'Syncing...');
  render();

  try {
    const result = await apiRequest('list');
    state.entries = (result.data || []).map(normalizeEntry).filter(entry => entry.id && entry.question);
    saveCache();
    setSyncStatus('synced', 'Synced');
    setLastSynced(new Date());
    if (!quiet) showToast('Latest questions loaded from Google Sheets.');
  } catch (error) {
    console.error(error);
    state.entries = loadCache();
    setSyncStatus('error', 'Offline');
    if (!quiet) showToast(`Could not sync: ${error.message}`);
  } finally {
    state.loading = false;
    render();
  }
}

function filteredEntries() {
  const query = els.searchInput.value.trim().toLowerCase();
  const category = els.categoryFilter.value;

  return state.entries
    .filter(entry => category === 'all' || entry.category === category)
    .filter(entry => {
      if (!query) return true;
      const haystack = [
        entry.question,
        entry.answer,
        entry.category,
        ...entry.followups.flatMap(item => [item.question, item.answer])
      ].join(' ').toLowerCase();
      return haystack.includes(query);
    })
    .sort((a, b) => {
      const aTime = Date.parse(a.updatedAt || a.createdAt || 0) || 0;
      const bTime = Date.parse(b.updatedAt || b.createdAt || 0) || 0;
      return bTime - aTime;
    });
}

function updateCategoryFilter() {
  const current = els.categoryFilter.value;
  const categories = [...new Set(state.entries.map(entry => entry.category).filter(Boolean))].sort((a, b) => a.localeCompare(b));
  els.categoryFilter.innerHTML = '<option value="all">All categories</option>' + categories
    .map(category => `<option value="${escapeAttr(category)}">${escapeHtml(category)}</option>`)
    .join('');
  if ([...els.categoryFilter.options].some(option => option.value === current)) {
    els.categoryFilter.value = current;
  }
}

function render() {
  updateCategoryFilter();

  const totalFollowups = state.entries.reduce((sum, entry) => sum + entry.followups.length, 0);
  els.questionCount.textContent = String(state.entries.length);
  els.followupCount.textContent = String(totalFollowups);

  els.loadingState.classList.toggle('hidden', !state.loading);
  if (state.loading) {
    els.questionList.innerHTML = '';
    els.emptyState.classList.add('hidden');
    return;
  }

  const entries = filteredEntries();
  els.emptyState.classList.toggle('hidden', entries.length > 0);
  els.questionList.innerHTML = entries.map(renderQuestionCard).join('');
  bindRenderedEvents();
}

function renderQuestionCard(entry) {
  const isOpen = state.openQuestions.has(entry.id);
  const followups = entry.followups.map((followup, index) => renderFollowup(entry.id, followup, index)).join('');

  return `
    <article class="question-card ${isOpen ? 'open' : ''}" data-entry-id="${escapeAttr(entry.id)}">
      <div class="question-row">
        <button class="question-toggle" type="button" data-toggle-question="${escapeAttr(entry.id)}" aria-expanded="${isOpen}">
          <img class="chevron" src="${isOpen ? ICONS.down : ICONS.right}" alt="" />
          <span class="question-meta">
            <span class="category-label">${escapeHtml(entry.category)}</span>
            <span class="question-title">${escapeHtml(entry.question)}</span>
          </span>
        </button>

        <div class="card-actions">
          <button class="card-icon-button" type="button" data-copy="${escapeAttr(entry.id)}" title="Copy" aria-label="Copy options">
            <img src="${ICONS.copy}" alt="" />
          </button>
          <button class="card-icon-button" type="button" data-edit="${escapeAttr(entry.id)}" title="Edit" aria-label="Edit question">
            <img src="${ICONS.edit}" alt="" />
          </button>
          <button class="card-icon-button danger" type="button" data-delete="${escapeAttr(entry.id)}" title="Delete" aria-label="Delete question">
            <img src="${ICONS.trash}" alt="" />
          </button>
        </div>
      </div>

      <div class="question-content">
        <div class="question-content-inner">
          <div class="question-body">
            <div class="answer-box">
              <p class="answer-label">Answer</p>
              <p class="answer-text">${escapeHtml(entry.answer)}</p>
            </div>

            ${entry.followups.length ? `
              <div class="followups-block">
                <div class="followups-heading">
                  <h4>Follow-up questions</h4>
                  <span>${entry.followups.length}</span>
                </div>
                <div class="followup-list">${followups}</div>
              </div>
            ` : ''}
          </div>
        </div>
      </div>
    </article>
  `;
}

function renderFollowup(entryId, followup, index) {
  const key = `${entryId}:${followup.id || index}`;
  const isOpen = state.openFollowups.has(key);
  return `
    <article class="followup-item ${isOpen ? 'open' : ''}">
      <button class="followup-question" type="button" data-toggle-followup="${escapeAttr(key)}" aria-expanded="${isOpen}">
        <img src="${isOpen ? ICONS.down : ICONS.right}" alt="" />
        <span>${escapeHtml(followup.question || 'Untitled follow-up')}</span>
      </button>
      <div class="followup-answer">
        <div><p>${escapeHtml(followup.answer || 'No answer added yet.')}</p></div>
      </div>
    </article>
  `;
}

function bindRenderedEvents() {
  document.querySelectorAll('[data-toggle-question]').forEach(button => {
    button.addEventListener('click', () => {
      const id = button.dataset.toggleQuestion;
      state.openQuestions.has(id) ? state.openQuestions.delete(id) : state.openQuestions.add(id);
      render();
    });
  });

  document.querySelectorAll('[data-toggle-followup]').forEach(button => {
    button.addEventListener('click', () => {
      const key = button.dataset.toggleFollowup;
      state.openFollowups.has(key) ? state.openFollowups.delete(key) : state.openFollowups.add(key);
      render();
    });
  });

  document.querySelectorAll('[data-copy]').forEach(button => {
    button.addEventListener('click', () => openCopyMenu(button.dataset.copy));
  });

  document.querySelectorAll('[data-edit]').forEach(button => {
    button.addEventListener('click', () => openEditDialog(button.dataset.edit));
  });

  document.querySelectorAll('[data-delete]').forEach(button => {
    button.addEventListener('click', () => deleteEntry(button.dataset.delete));
  });
}

function openNewDialog() {
  state.editingId = null;
  els.questionForm.reset();
  els.entryId.value = '';
  els.questionDialogTitle.textContent = 'New Question';
  els.followupFields.innerHTML = '';
  addFollowupField();
  els.questionDialog.showModal();
  requestAnimationFrame(() => els.questionField.focus());
}

function openEditDialog(id) {
  const entry = state.entries.find(item => item.id === id);
  if (!entry) return;

  state.editingId = id;
  els.entryId.value = entry.id;
  els.questionDialogTitle.textContent = 'Edit Question';
  els.questionField.value = entry.question;
  els.answerField.value = entry.answer;
  els.categoryField.value = entry.category;
  els.followupFields.innerHTML = '';

  if (entry.followups.length) {
    entry.followups.forEach(item => addFollowupField(item.question, item.answer, item.id));
  } else {
    addFollowupField();
  }

  els.questionDialog.showModal();
}

function addFollowupField(question = '', answer = '', id = '') {
  const wrapper = document.createElement('div');
  wrapper.className = 'followup-field';
  wrapper.dataset.followupId = id || uid();
  wrapper.innerHTML = `
    <textarea class="followup-question-field" placeholder="Follow-up question">${escapeHtml(question)}</textarea>
    <textarea class="followup-answer-field" placeholder="Prepared answer">${escapeHtml(answer)}</textarea>
    <button class="remove-followup" type="button" aria-label="Remove follow-up">×</button>
  `;
  wrapper.querySelector('.remove-followup').addEventListener('click', () => wrapper.remove());
  els.followupFields.appendChild(wrapper);
}

async function saveEntry(event) {
  event.preventDefault();

  const question = els.questionField.value.trim();
  const answer = els.answerField.value.trim();
  if (!question || !answer) return;

  const existing = state.entries.find(item => item.id === state.editingId);
  const now = new Date().toISOString();
  const followups = [...els.followupFields.querySelectorAll('.followup-field')]
    .map(wrapper => ({
      id: wrapper.dataset.followupId || uid(),
      question: wrapper.querySelector('.followup-question-field').value.trim(),
      answer: wrapper.querySelector('.followup-answer-field').value.trim()
    }))
    .filter(item => item.question || item.answer);

  const entry = {
    id: existing?.id || uid(),
    question,
    answer,
    category: els.categoryField.value.trim() || 'General',
    followups,
    createdAt: existing?.createdAt || now,
    updatedAt: now
  };

  try {
    setSyncStatus('saving', 'Saving...');
    els.saveQuestionBtn.disabled = true;
    els.saveQuestionBtn.textContent = 'Saving...';
    await apiRequest('upsert', { entry });
    els.questionDialog.close();
    await syncFromSheet({ quiet: true });
    setSyncStatus('synced', 'Autosaved & synced');
    showToast(existing ? 'Question updated everywhere.' : 'Question added everywhere.');
  } catch (error) {
    console.error(error);
    setSyncStatus('error', 'Save failed');
    showToast(`Save failed: ${error.message}`);
  } finally {
    els.saveQuestionBtn.disabled = false;
    els.saveQuestionBtn.textContent = 'Save Question';
  }
}

async function deleteEntry(id) {
  const entry = state.entries.find(item => item.id === id);
  if (!entry) return;

  const confirmed = window.confirm(`Delete “${entry.question}” from the shared Google Sheet?`);
  if (!confirmed) return;

  try {
    setSyncStatus('saving', 'Deleting...');
    await apiRequest('delete', { id });
    await syncFromSheet({ quiet: true });
    setSyncStatus('synced', 'Autosaved & synced');
    showToast('Question deleted everywhere.');
  } catch (error) {
    console.error(error);
    setSyncStatus('error', 'Delete failed');
    showToast(`Delete failed: ${error.message}`);
  }
}

function openCopyMenu(id) {
  state.copyEntryId = id;
  els.copyDialog.showModal();
}

async function performCopy(mode) {
  const entry = state.entries.find(item => item.id === state.copyEntryId);
  if (!entry) return;

  let text = entry.answer;
  if (mode === 'qa') {
    text = `${entry.question}\n\n${entry.answer}`;
  }
  if (mode === 'thread') {
    const followups = entry.followups.map((item, index) => `\n\nFollow-up ${index + 1}: ${item.question}\n${item.answer}`).join('');
    text = `${entry.question}\n\n${entry.answer}${followups}`;
  }

  try {
    await navigator.clipboard.writeText(text);
    showToast(mode === 'answer' ? 'Answer copied.' : mode === 'qa' ? 'Question and answer copied.' : 'Entire thread copied.');
  } catch {
    fallbackCopy(text);
    showToast('Copied.');
  } finally {
    els.copyDialog.close();
  }
}

function fallbackCopy(text) {
  const textarea = document.createElement('textarea');
  textarea.value = text;
  textarea.style.position = 'fixed';
  textarea.style.opacity = '0';
  document.body.appendChild(textarea);
  textarea.select();
  document.execCommand('copy');
  textarea.remove();
}

function openSettings() {
  const { scriptUrl, accessKey } = getConnection();
  els.scriptUrlField.value = scriptUrl;
  els.accessKeyField.value = accessKey;
  els.settingsDialog.showModal();
}

async function saveSettings(event) {
  event.preventDefault();
  const scriptUrl = els.scriptUrlField.value.trim();
  const accessKey = els.accessKeyField.value.trim();

  if (!scriptUrl || !accessKey) {
    showToast('Enter both the Apps Script URL and access key.');
    return;
  }

  localStorage.setItem(STORAGE_KEYS.scriptUrl, scriptUrl);
  localStorage.setItem(STORAGE_KEYS.accessKey, accessKey);
  els.settingsDialog.close();
  await syncFromSheet();
}

function disconnect() {
  localStorage.removeItem(STORAGE_KEYS.scriptUrl);
  localStorage.removeItem(STORAGE_KEYS.accessKey);
  state.entries = loadCache();
  setSyncStatus('setup', 'Setup required');
  setLastSynced(null);
  els.settingsDialog.close();
  render();
  showToast('Disconnected. Cached data remains view-only.');
}

function showToast(message) {
  els.toast.textContent = message;
  els.toast.classList.add('show');
  window.clearTimeout(showToast.timer);
  showToast.timer = window.setTimeout(() => els.toast.classList.remove('show'), 2600);
}

function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function escapeAttr(value) {
  return escapeHtml(value);
}

document.getElementById('newQuestionBtn').addEventListener('click', openNewDialog);
document.getElementById('refreshBtn').addEventListener('click', () => syncFromSheet());
document.getElementById('settingsBtn').addEventListener('click', openSettings);
document.getElementById('addFollowupBtn').addEventListener('click', () => addFollowupField());
document.getElementById('disconnectBtn').addEventListener('click', disconnect);
els.questionForm.addEventListener('submit', saveEntry);
els.settingsForm.addEventListener('submit', saveSettings);
els.searchInput.addEventListener('input', render);
els.categoryFilter.addEventListener('change', render);

document.querySelectorAll('[data-close]').forEach(button => {
  button.addEventListener('click', () => document.getElementById(button.dataset.close).close());
});

document.querySelectorAll('[data-copy-mode]').forEach(button => {
  button.addEventListener('click', () => performCopy(button.dataset.copyMode));
});

[els.questionDialog, els.settingsDialog, els.copyDialog].forEach(dialog => {
  dialog.addEventListener('click', event => {
    const rect = dialog.getBoundingClientRect();
    const outside = event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom;
    if (outside) dialog.close();
  });
});

state.entries = loadCache();
render();
syncFromSheet({ quiet: true });
