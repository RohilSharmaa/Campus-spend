/* ============================================================
   CampusSpend — core logic
   ============================================================ */
(() => {
'use strict';

const KEYS = {
  expenses: 'campus_expenses_v2',
  budget:   'campus_budget_v2',
  recurring:'campus_recurring_v2'
};

const CATEGORIES = ['Food','Transport','Books','Stationery','Hostel','Tuition','Entertainment','Medical','Subscriptions','Other'];

const CATEGORY_COLORS = {
  Food:'#5b5ce2', Transport:'#12a594', Books:'#f4b85a', Stationery:'#e56878',
  Hostel:'#7a63e8', Tuition:'#35a7d5', Entertainment:'#ef7c37', Medical:'#39a96b',
  Subscriptions:'#8f73d9', Other:'#98a1b1'
};

let state = {
  expenses: [],
  budget: 0,
  recurring: [],
  editId: null,
  filters: { q:'', category:'all', month:'all', payment:'all' }
};

const $  = s => document.querySelector(s);
const $$ = s => [...document.querySelectorAll(s)];

const money = n => '₹' + Number(n||0).toLocaleString('en-IN',{minimumFractionDigits:2,maximumFractionDigits:2});
const isoToday = () => new Date().toISOString().slice(0,10);
const monthKey = d => String(d).slice(0,7);
const monthName = k => {
  const [y,m] = k.split('-');
  return new Date(Number(y), Number(m)-1, 1).toLocaleString('en-IN',{month:'short',year:'numeric'});
};
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2,8);

/* ---------- Toast ---------- */
function toast(msg){
  const el = $('#toast');
  el.textContent = msg;
  el.classList.add('show');
  clearTimeout(toast.t);
  toast.t = setTimeout(() => el.classList.remove('show'), 2400);
}

/* ---------- Storage ---------- */
function read(key, fallback){
  try { return JSON.parse(localStorage.getItem(key)) ?? fallback; }
  catch { return fallback; }
}
function persist(){
  localStorage.setItem(KEYS.expenses,  JSON.stringify(state.expenses));
  localStorage.setItem(KEYS.budget,    String(state.budget));
  localStorage.setItem(KEYS.recurring, JSON.stringify(state.recurring));
}
function load(){
  state.expenses  = read(KEYS.expenses, []);
  state.budget    = Number(localStorage.getItem(KEYS.budget) || 0);
  state.recurring = read(KEYS.recurring, []);
  processRecurring();
}

/* ---------- Helpers ---------- */
const escapeHtml = s => String(s??'').replace(/[&<>"']/g, c =>
  ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

const openModal  = id => $('#'+id).classList.add('open');
const closeModal = id => $('#'+id).classList.remove('open');

const todayExpenses = () => {
  const k = monthKey(isoToday());
  return state.expenses.filter(e => monthKey(e.date) === k);
};

function getFiltered(){
  const q = state.filters.q.toLowerCase();
  return [...state.expenses]
    .filter(e => state.filters.category === 'all' || e.category === state.filters.category)
    .filter(e => state.filters.month === 'all'    || monthKey(e.date) === state.filters.month)
    .filter(e => state.filters.payment === 'all'  || e.paymentMethod === state.filters.payment)
    .filter(e => !q
      || String(e.description).toLowerCase().includes(q)
      || String(e.paymentMethod).toLowerCase().includes(q)
      || String(e.category).toLowerCase().includes(q))
    .sort((a,b) => b.date.localeCompare(a.date) || b.id.localeCompare(a.id));
}

function totals(){
  const all = state.expenses.reduce((s,e) => s + Number(e.amount), 0);
  const mon = todayExpenses().reduce((s,e) => s + Number(e.amount), 0);
  const cats = {};
  state.expenses.forEach(e => cats[e.category] = (cats[e.category] || 0) + Number(e.amount));
  const top = Object.entries(cats).sort((a,b) => b[1] - a[1])[0];
  return { all, mon, cats, top };
}

function fillCategorySelects(){
  const opts = CATEGORIES.map(c => `<option>${c}</option>`).join('');
  $('#fCategory').innerHTML = opts;
  $('#rCategory').innerHTML = opts;
}

/* ---------- Render: filters ---------- */
function renderFilters(){
  const cats   = [...new Set(state.expenses.map(e => e.category))].sort();
  const months = [...new Set(state.expenses.map(e => monthKey(e.date)))].sort().reverse();
  const c = $('#categoryFilter');
  const m = $('#monthFilter');
  c.innerHTML = '<option value="all">All categories</option>' + cats.map(x => `<option>${escapeHtml(x)}</option>`).join('');
  m.innerHTML = '<option value="all">All months</option>'     + months.map(x => `<option value="${x}">${monthName(x)}</option>`).join('');
  c.value = cats.includes(state.filters.category) ? state.filters.category : 'all';
  m.value = months.includes(state.filters.month)  ? state.filters.month    : 'all';
  $('#paymentFilter').value = state.filters.payment;
  $('#searchInput').value   = state.filters.q;
}

/* ---------- Render: stats ---------- */
function renderStats(){
  const t = totals();
  $('#statTotal').textContent = money(t.all);
  $('#statMonth').textContent = money(t.mon);
  $('#statCount').textContent = state.expenses.length;
  $('#statTop').textContent   = t.top ? t.top[0] : '—';
  $('#statTopSub').textContent = t.top ? money(t.top[1]) + ' total' : 'No records';
  $('#statMonthSub').textContent = monthName(monthKey(isoToday()));
  $('#budgetPill').textContent = 'Budget: ' + money(state.budget);

  const pct = state.budget ? Math.min(100, t.mon / state.budget * 100) : 0;
  $('#budgetFill').style.width = pct + '%';
  $('#budgetFill').style.background =
    pct >= 100 ? 'var(--danger)' : pct >= 80 ? 'var(--warning)' : 'var(--green)';
  $('#budgetUsed').textContent = money(t.mon) + ' used';
  $('#budgetRemaining').textContent = state.budget
    ? ((state.budget - t.mon >= 0)
        ? money(state.budget - t.mon) + ' remaining'
        : money(t.mon - state.budget) + ' over budget')
    : 'No budget set';
  $('#budgetText').textContent = state.budget
    ? 'Used ' + pct.toFixed(0) + '% of ' + money(state.budget)
    : 'Set a budget for the current month.';
  $('#budgetInput').value = state.budget || '';
  $('#donutTotal').textContent = money(t.all);
}

/* ---------- Render: table ---------- */
function renderTable(){
  const rows = getFiltered();
  const body = $('#expenseBody');
  body.innerHTML = '';
  $('#recordsCount').textContent = rows.length + ' record' + (rows.length === 1 ? '' : 's');
  $('#emptyState').classList.toggle('hidden', rows.length > 0);

  rows.forEach(e => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td data-label="Date">${escapeHtml(e.date)}</td>
      <td data-label="Category"><span class="badge-cat">${escapeHtml(e.category)}</span></td>
      <td data-label="Description">${escapeHtml(e.description || '—')}</td>
      <td data-label="Payment">${escapeHtml(e.paymentMethod || '—')}</td>
      <td data-label="Amount"><strong>${money(e.amount)}</strong></td>
      <td data-label="Actions">
        <div class="actions-cell">
          <button class="btn btn-secondary btn-sm" data-edit="${e.id}">Edit</button>
          <button class="btn btn-danger btn-sm" data-del="${e.id}">Delete</button>
        </div>
      </td>`;
    body.appendChild(tr);
  });
}

/* ---------- Charts ---------- */
function roundRect(ctx, x, y, w, h, r){
  if (h <= 0) return;
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y,     x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x,     y + h, r);
  ctx.arcTo(x,     y + h, x,     y,     r);
  ctx.arcTo(x,     y,     x + w, y,     r);
  ctx.closePath();
  ctx.fill();
}

function drawTrend(){
  const canvas = $('#trendCanvas');
  const ctx = canvas.getContext('2d');
  const rect = canvas.getBoundingClientRect();
  const dpr = devicePixelRatio || 1;
  canvas.width  = rect.width  * dpr;
  canvas.height = rect.height * dpr;
  ctx.scale(dpr, dpr);
  const w = rect.width, h = rect.height;
  ctx.clearRect(0, 0, w, h);

  const now = new Date();
  const months = [];
  for (let i = 5; i >= 0; i--){
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    months.push(`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`);
  }
  const vals = months.map(m =>
    state.expenses.filter(e => monthKey(e.date) === m).reduce((s,e) => s + Number(e.amount), 0)
  );
  const max = Math.max(...vals, 1);

  ctx.strokeStyle = '#eef0f4';
  ctx.lineWidth = 1;
  for (let i = 0; i < 4; i++){
    const y = 20 + i * (h - 48) / 3;
    ctx.beginPath();
    ctx.moveTo(10, y);
    ctx.lineTo(w - 8, y);
    ctx.stroke();
  }

  const gap = 9;
  const bw = (w - 40 - gap * 5) / 6;
  vals.forEach((v, i) => {
    const bh = Math.max(3, (h - 66) * v / max);
    const x = 16 + i * (bw + gap);
    const y = h - 35 - bh;
    const g = ctx.createLinearGradient(0, y, 0, h - 35);
    g.addColorStop(0, '#7779f0');
    g.addColorStop(1, '#5b5ce2');
    ctx.fillStyle = g;
    roundRect(ctx, x, y, bw, bh, 7);

    const label = new Date(Number(months[i].slice(0,4)), Number(months[i].slice(5,7))-1, 1)
      .toLocaleString('en-IN', { month:'short' });
    ctx.fillStyle = '#9aa1ae';
    ctx.font = '10px Inter, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(label, x + bw/2, h - 14);

    if (v){
      ctx.fillStyle = '#4d5667';
      ctx.font = '9px Inter, sans-serif';
      ctx.fillText('₹' + Math.round(v/1000) + 'k', x + bw/2, y - 6);
    }
  });
}

function drawDonut(){
  const canvas = $('#donutCanvas');
  const ctx = canvas.getContext('2d');
  const rect = canvas.getBoundingClientRect();
  const dpr = devicePixelRatio || 1;
  canvas.width  = rect.width  * dpr;
  canvas.height = rect.height * dpr;
  ctx.scale(dpr, dpr);
  const w = rect.width, h = rect.height;
  ctx.clearRect(0, 0, w, h);

  const { cats } = totals();
  const data = Object.entries(cats).sort((a,b) => b[1] - a[1]);
  const cx = w/2, cy = h/2, r = Math.min(w,h)/2 - 22, inner = r * .58;
  const total = data.reduce((s,x) => s + x[1], 0) || 1;

  let start = -Math.PI/2;
  data.forEach(([name, val]) => {
    const angle = (val / total) * Math.PI * 2;
    ctx.beginPath();
    ctx.arc(cx, cy, r, start, start + angle);
    ctx.lineWidth = r - inner;
    ctx.strokeStyle = CATEGORY_COLORS[name] || '#98a1b1';
    ctx.stroke();
    start += angle;
  });

  ctx.fillStyle = '#101828';
  ctx.font = 'bold 18px Inter, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(money(total).replace('.00',''), cx, cy + 2);
  ctx.fillStyle = '#9aa1ae';
  ctx.font = '10px Inter, sans-serif';
  ctx.fillText('total', cx, cy + 18);
}

/* ---------- Render: analytics + recurring ---------- */
function renderAnalytics(){
  const { cats } = totals();
  const sorted = Object.entries(cats).sort((a,b) => b[1] - a[1]);
  const holder = $('#analyticsSummary');
  holder.innerHTML = `
    <div class="app-card">
      <h3 style="font-size:12px">Category totals</h3>
      <div style="display:grid;gap:7px;margin-top:10px">
        ${sorted.length
          ? sorted.map(([k,v]) => `<div style="display:flex;justify-content:space-between;font-size:10px"><span>${escapeHtml(k)}</span><b>${money(v)}</b></div>`).join('')
          : '<span class="muted" style="font-size:10px">No expense data yet.</span>'}
      </div>
    </div>
    <div class="app-card">
      <h3 style="font-size:12px">Current month</h3>
      <div style="font-size:25px;font-weight:900;margin-top:7px">${money(todayExpenses().reduce((s,e) => s + e.amount, 0))}</div>
      <div style="font-size:9px;color:#9299a8;margin-top:2px">${todayExpenses().length} transaction(s)</div>
    </div>`;
}

function renderRecurring(){
  const el = $('#recurringList');
  if (!state.recurring.length){
    el.innerHTML = '<div class="empty-state">No recurring expenses yet. Add hostel, subscription, rent, tuition or another repeat expense.</div>';
    return;
  }
  el.innerHTML = state.recurring.map(r => `
    <div class="recurring-row">
      <div>
        <b>${escapeHtml(r.description)}</b>
        <small>${money(r.amount)} · ${escapeHtml(r.category)} · ${r.frequency} · next ${escapeHtml(r.nextDate)}</small>
      </div>
      <div class="r-right">
        <input class="switch" type="checkbox" data-toggle-rec="${r.id}" ${r.active ? 'checked' : ''}>
        <button class="btn btn-danger btn-sm" data-del-rec="${r.id}">Delete</button>
      </div>
    </div>`).join('');
}

function renderAll(){
  renderFilters();
  renderStats();
  renderTable();
  drawTrend();
  drawDonut();
  renderAnalytics();
  renderRecurring();
}

/* ---------- CRUD ---------- */
function addExpense(data){
  state.expenses.push({
    id: uid(),
    amount: Number(data.amount),
    category: data.category,
    date: data.date,
    paymentMethod: data.paymentMethod,
    description: data.description || '—',
    source: data.source || 'manual'
  });
  persist();
  renderAll();
}

function updateExpense(id, data){
  const x = state.expenses.find(e => e.id === id);
  if (!x) return;
  Object.assign(x, {
    amount: Number(data.amount),
    category: data.category,
    date: data.date,
    paymentMethod: data.paymentMethod,
    description: data.description || '—'
  });
  persist();
  renderAll();
}

function startEdit(id){
  const e = state.expenses.find(x => x.id === id);
  if (!e) return;
  state.editId = id;
  $('#expenseModalTitle').textContent = 'Edit Expense';
  $('#fAmount').value = e.amount;
  $('#fCategory').value = e.category;
  $('#fDate').value = e.date;
  $('#fPayment').value = e.paymentMethod;
  $('#fDescription').value = e.description === '—' ? '' : e.description;
  openModal('expenseModal');
}

function deleteExpense(id){
  if (!confirm('Delete this expense?')) return;
  state.expenses = state.expenses.filter(e => e.id !== id);
  persist();
  renderAll();
  toast('Expense deleted');
}

/* ---------- Recurring ---------- */
function processRecurring(){
  const today = isoToday();
  let changed = false;
  state.recurring.forEach(r => {
    if (!r.active) return;
    let guard = 0;
    while (r.nextDate <= today && guard < 36){
      const duplicate = state.expenses.some(e => e.recurringId === r.id && e.date === r.nextDate);
      if (!duplicate){
        state.expenses.push({
          id: uid(),
          amount: Number(r.amount),
          category: r.category,
          date: r.nextDate,
          paymentMethod: r.paymentMethod,
          description: r.description,
          source: 'recurring',
          recurringId: r.id
        });
      }
      const d = new Date(r.nextDate + 'T00:00:00');
      if (r.frequency === 'weekly') d.setDate(d.getDate() + 7);
      else                          d.setMonth(d.getMonth() + 1);
      r.nextDate = d.toISOString().slice(0,10);
      guard++;
      changed = true;
    }
  });
  if (changed) persist();
}

function nextDate(date, frequency){
  const d = new Date(date + 'T00:00:00');
  if (frequency === 'weekly') d.setDate(d.getDate() + 7);
  else                        d.setMonth(d.getMonth() + 1);
  return d.toISOString().slice(0,10);
}

/* ---------- Demo data ---------- */
function loadDemo(){
  if (state.expenses.length && !confirm('Replace current expenses with demo data?')) return;
  const days = [0,1,2,4,7,11,14,18,21,26].map(x => {
    const z = new Date();
    z.setDate(z.getDate() - x);
    return z.toISOString().slice(0,10);
  });
  const sample = [
    ['Canteen lunch','Food',80,'UPI'],
    ['Metro recharge','Transport',300,'Card'],
    ['Notebook','Books',220,'UPI'],
    ['Xerox','Stationery',60,'Cash'],
    ['Hostel mess','Hostel',1200,'UPI'],
    ['Movie','Entertainment',350,'UPI'],
    ['Paracetamol','Medical',90,'Cash'],
    ['Coffee','Food',140,'UPI'],
    ['Online course','Tuition',800,'Card'],
    ['Music subscription','Subscriptions',129,'Card']
  ];
  state.expenses = sample.map((s,i) => ({
    id: uid() + i,
    description: s[0], category: s[1], amount: s[2],
    paymentMethod: s[3], date: days[i], source: 'demo'
  }));
  if (!state.budget) state.budget = 5000;
  persist();
  renderAll();
  toast('Demo data loaded');
}

/* ---------- Export / Import ---------- */
function csvEscape(v){ return '"' + String(v??'').replace(/"/g,'""') + '"'; }

function exportCsv(){
  const rows = getFiltered();
  if (!rows.length) return toast('Nothing to export');
  const out = [
    ['Date','Category','Description','Payment Method','Amount'],
    ...rows.map(e => [e.date, e.category, e.description, e.paymentMethod, e.amount])
  ].map(r => r.map(csvEscape).join(',')).join('\n');

  const blob = new Blob([out], { type: 'text/csv;charset=utf-8' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href = url;
  a.download = 'campusspend_expenses_' + isoToday() + '.csv';
  a.click();
  URL.revokeObjectURL(url);
  toast('CSV exported');
}

function parseCsv(text){
  const rows = [];
  let row = [], cell = '', quoted = false;
  for (let i = 0; i < text.length; i++){
    const ch = text[i], next = text[i+1];
    if (ch === '"' && quoted && next === '"'){ cell += '"'; i++; continue; }
    if (ch === '"'){ quoted = !quoted; continue; }
    if (ch === ',' && !quoted){ row.push(cell); cell = ''; continue; }
    if ((ch === '\n' || ch === '\r') && !quoted){
      if (ch === '\r' && next === '\n') i++;
      row.push(cell);
      cell = '';
      if (row.some(x => x.trim() !== '')) rows.push(row);
      row = [];
      continue;
    }
    cell += ch;
  }
  if (cell !== '' || row.length){ row.push(cell); rows.push(row); }
  return rows;
}

function findHeader(headers, terms){
  const lower = headers.map(x => x.toLowerCase().trim());
  for (const term of terms){
    const idx = lower.findIndex(h => h === term || h.includes(term));
    if (idx >= 0) return idx;
  }
  return -1;
}

function guessCategory(text){
  const s = text.toLowerCase();
  if (/swiggy|zomato|canteen|food|restaurant|coffee|cafe|pizza|snack/.test(s)) return 'Food';
  if (/uber|ola|metro|bus|auto|rapido|travel|cab/.test(s)) return 'Transport';
  if (/book|amazon|flipkart|novel|textbook/.test(s)) return 'Books';
  if (/xerox|print|stationery|pen|notebook/.test(s)) return 'Stationery';
  if (/hostel|mess|rent|pg/.test(s)) return 'Hostel';
  if (/course|tuition|college|fee|exam/.test(s)) return 'Tuition';
  if (/movie|netflix|spotify|game|concert/.test(s)) return /spotify|netflix/.test(s) ? 'Subscriptions' : 'Entertainment';
  if (/pharmacy|medical|doctor|medicine/.test(s)) return 'Medical';
  if (/subscription|prime|youtube premium/.test(s)) return 'Subscriptions';
  return 'Other';
}

function parseDateValue(v){
  const raw = String(v||'').trim();
  if (!raw) return '';
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw;
  let m = raw.match(/^(\d{1,2})[\/-](\d{1,2})[\/-](\d{2,4})$/);
  if (m){
    let y = Number(m[3]);
    if (y < 100) y += 2000;
    return `${y}-${String(m[2]).padStart(2,'0')}-${String(m[1]).padStart(2,'0')}`;
  }
  const d = new Date(raw);
  return isNaN(d) ? '' : d.toISOString().slice(0,10);
}

async function importCsv(file){
  const text = await file.text();
  const rows = parseCsv(text);
  if (rows.length < 2) throw new Error('CSV is empty');

  const headers = rows[0];
  const dateIdx   = findHeader(headers, ['date','transaction date','time']);
  const amountIdx = findHeader(headers, ['amount','debit','withdrawal','paid']);
  const descIdx   = findHeader(headers, ['description','merchant','details','narration','name']);
  const catIdx    = findHeader(headers, ['category','type']);
  const payIdx    = findHeader(headers, ['payment method','payment','mode','method']);
  if (amountIdx < 0) throw new Error('Could not find an Amount column');

  let imported = 0, duplicates = 0;
  for (let i = 1; i < rows.length; i++){
    const r = rows[i];
    if (!r.length) continue;
    const date = parseDateValue(dateIdx >= 0 ? r[dateIdx] : '') || isoToday();
    const amountText = String(r[amountIdx]||'').replace(/[^0-9.\-]/g,'');
    const amount = Math.abs(Number(amountText));
    if (!amount) continue;

    const description = descIdx >= 0 ? String(r[descIdx]||'').trim() : 'Imported transaction';
    const category    = catIdx >= 0 && String(r[catIdx]||'').trim()
      ? String(r[catIdx]).trim() : guessCategory(description);
    const payment = payIdx >= 0 && String(r[payIdx]||'').trim()
      ? String(r[payIdx]).trim() : 'UPI';

    const duplicate = state.expenses.some(e =>
      e.date === date &&
      Math.abs(Number(e.amount) - amount) < 0.001 &&
      String(e.description).toLowerCase() === description.toLowerCase()
    );
    if (duplicate){ duplicates++; continue; }

    state.expenses.push({
      id: uid(),
      amount,
      category: CATEGORIES.includes(category) ? category : 'Other',
      date,
      paymentMethod: ['Cash','UPI','Card','Net Banking'].includes(payment) ? payment : 'UPI',
      description: description || 'Imported transaction',
      source: 'csv'
    });
    imported++;
  }
  persist();
  renderAll();
  return { imported, duplicates };
}

/* ============================================================
   VIEW CONTROL
   ============================================================ */
function showApp(){
  window.scrollTo(0,0);
  $('#landingView').classList.add('hidden');
  $('#appView').classList.remove('hidden');
  renderAll();
}
function showLanding(){
  window.scrollTo(0,0);
  $('#appView').classList.add('hidden');
  $('#landingView').classList.remove('hidden');
}

/* ============================================================
   EVENTS
   ============================================================ */
$$('[data-open-app]').forEach(b => b.addEventListener('click', showApp));
$('#backHomeBtn').addEventListener('click', showLanding);
$('#mobileBackBtn').addEventListener('click', () => {
  if (confirm('Landing page par jaana hai? Data safe rahega.')) {
    showLanding();
  }
});

/* Navigation (sidebar + mobile bottom nav — synced) */
$$('[data-go]').forEach(btn => btn.addEventListener('click', () => {
  const id = btn.dataset.go;
  $$('[data-go]').forEach(x => x.classList.toggle('active', x.dataset.go === id));
  const el = $('#' + id);
  if (el) el.scrollIntoView({ behavior:'smooth', block:'start' });
}));

/* Modals */
$$('.modal-close').forEach(b => b.addEventListener('click', () => closeModal(b.dataset.close)));
$$('.modal').forEach(m => m.addEventListener('click', e => {
  if (e.target === m) m.classList.remove('open');
}));

/* Add expense */
$('#addExpenseBtn').addEventListener('click', () => {
  state.editId = null;
  $('#expenseModalTitle').textContent = 'Add Expense';
  $('#expenseForm').reset();
  $('#fDate').value = isoToday();
  $('#fCategory').value = 'Food';
  openModal('expenseModal');
});
$('#expenseForm').addEventListener('submit', e => {
  e.preventDefault();
  const data = {
    amount: $('#fAmount').value,
    category: $('#fCategory').value,
    date: $('#fDate').value,
    paymentMethod: $('#fPayment').value,
    description: $('#fDescription').value.trim()
  };
  if (state.editId) updateExpense(state.editId, data);
  else              addExpense(data);
  state.editId = null;
  closeModal('expenseModal');
  toast('Expense saved');
});

/* Budget */
$('#setBudgetBtn').addEventListener('click', () => openModal('budgetModal'));
$('#saveBudgetBtn').addEventListener('click', () => {
  state.budget = Math.max(0, Number($('#budgetInput').value) || 0);
  persist();
  closeModal('budgetModal');
  renderAll();
  toast('Budget updated');
});

/* Recurring */
$('#addRecurringBtn').addEventListener('click', () => {
  $('#recurringForm').reset();
  $('#rDate').value = isoToday();
  $('#rCategory').value = 'Hostel';
  openModal('recurringModal');
});
$('#recurringForm').addEventListener('submit', e => {
  e.preventDefault();
  state.recurring.push({
    id: uid(),
    amount: Number($('#rAmount').value),
    category: $('#rCategory').value,
    description: $('#rDescription').value.trim(),
    frequency: $('#rFrequency').value,
    nextDate: $('#rDate').value,
    paymentMethod: $('#rPayment').value,
    active: true
  });
  persist();
  processRecurring();
  renderAll();
  closeModal('recurringModal');
  toast('Recurring expense created');
});

/* Table + recurring actions */
$('#expenseBody').addEventListener('click', e => {
  const edit = e.target.dataset.edit;
  const del  = e.target.dataset.del;
  if (edit) startEdit(edit);
  if (del)  deleteExpense(del);
});
$('#recurringList').addEventListener('click', e => {
  const del = e.target.dataset.delRec;
  const tog = e.target.dataset.toggleRec;
  if (del){
    state.recurring = state.recurring.filter(r => r.id !== del);
    persist();
    renderRecurring();
    toast('Recurring rule deleted');
  }
  if (tog){
    const r = state.recurring.find(x => x.id === tog);
    if (r){ r.active = e.target.checked; persist(); toast(r.active ? 'Recurring enabled' : 'Recurring paused'); }
  }
});

/* Quick add */
$$('[data-quick]').forEach(b => b.addEventListener('click', () => {
  const [description, category, amount] = b.dataset.quick.split('|');
  addExpense({ description, category, amount, date: isoToday(), paymentMethod: 'UPI' });
  toast(description + ' added');
}));

/* Filters */
$('#searchInput').addEventListener('input', e => { state.filters.q = e.target.value; renderTable(); });
$('#categoryFilter').addEventListener('change', e => { state.filters.category = e.target.value; renderTable(); });
$('#monthFilter').addEventListener('change', e => { state.filters.month = e.target.value; renderTable(); });
$('#paymentFilter').addEventListener('change', e => { state.filters.payment = e.target.value; renderTable(); });
$('#clearFiltersBtn').addEventListener('click', () => {
  state.filters = { q:'', category:'all', month:'all', payment:'all' };
  renderFilters();
  renderTable();
});

/* Import / export */
$('#importBtn').addEventListener('click', () => openModal('importModal'));
$('#exportBtn').addEventListener('click', exportCsv);
$('#processCsvBtn').addEventListener('click', async () => {
  const file = $('#csvFile').files[0];
  if (!file) return toast('Choose a CSV file first');
  try {
    const r = await importCsv(file);
    closeModal('importModal');
    $('#csvFile').value = '';
    toast(`Imported ${r.imported} record(s), skipped ${r.duplicates} duplicate(s)`);
  } catch (err){
    toast(err.message || 'Import failed');
  }
});
$('#demoDataBtn').addEventListener('click', loadDemo);

/* Extra */
$('#resetDemoChart').addEventListener('click', () => {
  drawTrend();
  drawDonut();
  toast('Charts refreshed');
});

/* Keyboard */
document.addEventListener('keydown', e => {
  if (e.key === 'Escape') $$('.modal.open').forEach(m => m.classList.remove('open'));
});

/* Resize */
window.addEventListener('resize', () => {
  if (!$('#appView').classList.contains('hidden')){
    drawTrend();
    drawDonut();
  }
});

/* ============================================================
   MOBILE: FAB + PWA + Service Worker
   ============================================================ */
$('#mobileFab').addEventListener('click', () => {
  state.editId = null;
  $('#expenseModalTitle').textContent = 'Add Expense';
  $('#expenseForm').reset();
  $('#fDate').value = isoToday();
  $('#fCategory').value = 'Food';
  openModal('expenseModal');
});

if ('serviceWorker' in navigator){
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('sw.js').catch(() => {});
  });
}

let deferredPrompt = null;
window.addEventListener('beforeinstallprompt', e => {
  e.preventDefault();
  deferredPrompt = e;

  const btn = document.createElement('button');
  btn.id = 'pwaInstallBtn';
  btn.className = 'btn btn-success btn-sm';
  btn.textContent = '📲 Install App';
  btn.style.position = 'fixed';
  btn.style.left = '16px';
  btn.style.bottom = 'calc(84px + env(safe-area-inset-bottom))';
  btn.style.zIndex = '82';
  btn.style.boxShadow = '0 10px 24px rgba(18,165,148,.35)';

  btn.addEventListener('click', async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    await deferredPrompt.userChoice;
    deferredPrompt = null;
    btn.remove();
  });

  document.body.appendChild(btn);
});

/* ---------- Init ---------- */
fillCategorySelects();
load();
renderAll();

})();