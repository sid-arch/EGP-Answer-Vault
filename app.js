const STORAGE_KEY = 'egpAnswerVaultEntriesV1';
const SCRIPT_URL_KEY = 'egpAnswerVaultScriptUrl';

let entries = loadEntries();
let activeEditId = null;

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
  toast: document.getElementById('toast')
};

function loadEntries() {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY)) || []; }
  catch { return []; }
}
function saveLocal() { localStorage.setItem(STORAGE_KEY, JSON.stringify(entries)); }
function scriptUrl() { return localStorage.getItem(SCRIPT_URL_KEY) || ''; }

function uid() { return crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`; }
function escapeHtml(str='') { return str.replace(/[&<>'"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#039;','"':'&quot;'}[c])); }
function formatDate(iso) { return new Intl.DateTimeFormat('en-US',{month:'short',day:'numeric',year:'numeric'}).format(new Date(iso)); }

function render() {
  const query = els.searchInput.value.trim().toLowerCase();
  const category = els.categoryFilter.value;
  const sort = els.sortFilter.value;
  let filtered = entries.filter(entry => {
    const haystack = [entry.question, entry.answer, entry.category, ...(entry.tags||[]), ...(entry.followups||[]).flatMap(f=>[f.question,f.answer])].join(' ').toLowerCase();
    return (!query || haystack.includes(query)) && (category === 'all' || entry.category === category);
  });
  filtered.sort((a,b) => sort === 'az' ? a.question.localeCompare(b.question) : new Date(b[sort==='created'?'createdAt':'updatedAt']) - new Date(a[sort==='created'?'createdAt':'updatedAt']));

  els.qaGrid.innerHTML = filtered.map(entry => `
    <article class="qa-card">
      <div class="qa-card-head">
        <div>
          <div class="meta-row">
            ${entry.category ? `<span class="pill category">${escapeHtml(entry.category)}</span>` : ''}
            ${(entry.tags||[]).map(tag=>`<span class="pill">${escapeHtml(tag)}</span>`).join('')}
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
      ${(entry.followups||[]).length ? `<details class="followups"><summary>${entry.followups.length} prospective follow-up${entry.followups.length===1?'':'s'}</summary>${entry.followups.map(f=>`<div class="followup-item"><strong>${escapeHtml(f.question)}</strong><p>${escapeHtml(f.answer)}</p></div>`).join('')}</details>`:''}
    </article>`).join('');

  els.emptyState.classList.toggle('hidden', entries.length !== 0);
  els.qaGrid.classList.toggle('hidden', entries.length === 0);
  updateStats();
  rebuildCategories();
}

function rebuildCategories() {
  const current = els.categoryFilter.value;
  const cats = [...new Set(entries.map(e=>e.category).filter(Boolean))].sort();
  els.categoryFilter.innerHTML = '<option value="all">All categories</option>' + cats.map(c=>`<option value="${escapeHtml(c)}">${escapeHtml(c)}</option>`).join('');
  if ([...els.categoryFilter.options].some(o=>o.value===current)) els.categoryFilter.value=current;
}
function updateStats(){
  document.getElementById('questionCount').textContent=entries.length;
  document.getElementById('followupCount').textContent=entries.reduce((n,e)=>n+(e.followups||[]).length,0);
  document.getElementById('categoryCount').textContent=new Set(entries.map(e=>e.category).filter(Boolean)).size;
  document.getElementById('backupStatus').textContent=scriptUrl()?'Connected':'Not connected';
  els.syncBadge.textContent=scriptUrl()?'Sheets connected':'Local mode';
  els.syncBadge.classList.toggle('connected',!!scriptUrl());
}

function openNew(){ activeEditId=null; els.questionForm.reset(); els.modalTitle.textContent='Add Question'; els.followupFields.innerHTML=''; addFollowupField(); els.questionDialog.showModal(); }
function addFollowupField(question='',answer=''){
  const row=document.createElement('div'); row.className='followup-entry';
  row.innerHTML=`<textarea class="follow-q" placeholder="Likely follow-up question">${escapeHtml(question)}</textarea><textarea class="follow-a" placeholder="Prepared answer">${escapeHtml(answer)}</textarea><button type="button" class="remove-followup">✕</button>`;
  row.querySelector('.remove-followup').onclick=()=>row.remove(); els.followupFields.appendChild(row);
}
window.editEntry=function(id){
  const e=entries.find(x=>x.id===id); if(!e)return; activeEditId=id;
  document.getElementById('questionField').value=e.question; document.getElementById('answerField').value=e.answer;
  document.getElementById('categoryField').value=e.category||''; document.getElementById('tagsField').value=(e.tags||[]).join(', ');
  els.followupFields.innerHTML=''; (e.followups||[]).forEach(f=>addFollowupField(f.question,f.answer)); if(!(e.followups||[]).length)addFollowupField();
  els.modalTitle.textContent='Edit Question'; els.questionDialog.showModal();
}
window.copyAnswer=async function(id){ const e=entries.find(x=>x.id===id); await navigator.clipboard.writeText(e.answer); toast('Answer copied'); }
window.deleteEntry=async function(id){
  if(!confirm('Delete this question from the vault?')) return;
  entries=entries.filter(x=>x.id!==id); saveLocal(); render(); toast('Question deleted');
  await syncToSheet('delete',{id});
}

els.questionForm.addEventListener('submit', async (event)=>{
  event.preventDefault();
  const now=new Date().toISOString();
  const followups=[...document.querySelectorAll('.followup-entry')].map(row=>({question:row.querySelector('.follow-q').value.trim(),answer:row.querySelector('.follow-a').value.trim()})).filter(f=>f.question||f.answer);
  const existing=entries.find(e=>e.id===activeEditId);
  const entry={id:activeEditId||uid(),question:document.getElementById('questionField').value.trim(),answer:document.getElementById('answerField').value.trim(),category:document.getElementById('categoryField').value.trim(),tags:document.getElementById('tagsField').value.split(',').map(x=>x.trim()).filter(Boolean),followups,createdAt:existing?.createdAt||now,updatedAt:now};
  if(existing) entries=entries.map(e=>e.id===activeEditId?entry:e); else entries.unshift(entry);
  saveLocal(); render(); els.questionDialog.close(); toast('Saved to Answer Vault');
  await syncToSheet('upsert',{entry});
});

async function syncToSheet(action,payload){
  const url=scriptUrl(); if(!url)return;
  try{
    await fetch(url,{method:'POST',mode:'no-cors',headers:{'Content-Type':'text/plain;charset=utf-8'},body:JSON.stringify({action,...payload})});
    toast('Saved locally + backed up');
  }catch(err){ console.error(err); toast('Saved locally; Sheets backup failed'); }
}
function toast(message){ els.toast.textContent=message; els.toast.classList.add('show'); setTimeout(()=>els.toast.classList.remove('show'),2400); }

document.getElementById('newQuestionBtn').onclick=openNew; document.getElementById('emptyAddBtn').onclick=openNew;
document.getElementById('addFollowupBtn').onclick=()=>addFollowupField();
document.getElementById('closeDialogBtn').onclick=()=>els.questionDialog.close(); document.getElementById('cancelBtn').onclick=()=>els.questionDialog.close();
document.getElementById('settingsBtn').onclick=()=>{document.getElementById('scriptUrlField').value=scriptUrl();els.settingsDialog.showModal();};
document.getElementById('closeSettingsBtn').onclick=()=>els.settingsDialog.close();
document.getElementById('disconnectBtn').onclick=()=>{localStorage.removeItem(SCRIPT_URL_KEY);els.settingsDialog.close();render();toast('Google Sheets disconnected');};
els.settingsForm.addEventListener('submit',(e)=>{e.preventDefault();const url=document.getElementById('scriptUrlField').value.trim(); if(url)localStorage.setItem(SCRIPT_URL_KEY,url); else localStorage.removeItem(SCRIPT_URL_KEY); els.settingsDialog.close();render();toast(url?'Google Sheets connected':'Connection removed');});
['input','change'].forEach(evt=>{els.searchInput.addEventListener(evt,render);els.categoryFilter.addEventListener(evt,render);els.sortFilter.addEventListener(evt,render);});

render();
