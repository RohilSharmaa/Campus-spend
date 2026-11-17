
/* ============================================================
   CAMPUSSPEND — MASTER APP.JS
   ============================================================ */

/* ---------- Storage Keys ---------- */
var EXPENSE_KEY   = 'cs_expenses_v1';
var BUDGET_KEY    = 'cs_budget_v1';
var ACCOUNT_KEY   = 'cs_account_v1';
var SETTINGS_KEY  = 'cs_settings_v1';
var LIMITS_KEY    = 'cs_limits_v1';
var PAGE_KEY      = 'cs_last_page';

/* ---------- State ---------- */
var expenses = [];
var monthlyBudget = 0;
var editingId = null;
var categoryChart = null;
var trendChart = null;
var currentType = 'expense';
var selectedCategory = null;

var CATEGORY_COLORS = {
  Shopping: '#ec4899',
  Food: '#f97316',
  Phone: '#06b6d4',
  Entertainment: '#a855f7',
  Education: '#8b5cf6',
  Beauty: '#f472b6',
  Sports: '#22c55e',
  Social: '#3b82f6',
  Transportation: '#0ea5e9',
  Clothing: '#14b8a6',
  Car: '#64748b',
  Alcohol: '#dc2626',
  Electronics: '#6366f1',
  Cigarettes: '#78716c',
  Travel: '#f59e0b',
  Health: '#10b981',
  Pets: '#d97706',
  Repairs: '#78716c',
  Housing: '#475569',
  Home: '#0891b2',
  Gifts: '#e879f9',
  Donations: '#f43f5e',
  Lottery: '#eab308',
  Snacks: '#fb923c',
  Kids: '#38bdf8',
  Vegetables: '#84cc16',
  Fruits: '#f97316',
  Other: '#64748b'
};

/* ---------- DOM Shortcut ---------- */
function $(id) { return document.getElementById(id); }

/* ============================================================
   STORAGE
   ============================================================ */
function loadData() {
  try { expenses = JSON.parse(localStorage.getItem(EXPENSE_KEY)) || []; }
  catch (e) { expenses = []; }
  monthlyBudget = Number(localStorage.getItem(BUDGET_KEY)) || 0;
}

function saveData() {
  localStorage.setItem(EXPENSE_KEY, JSON.stringify(expenses));
}

function saveBudget() {
  localStorage.setItem(BUDGET_KEY, String(monthlyBudget));
}

function loadJSON(key, fallback) {
  try { return JSON.parse(localStorage.getItem(key)) || fallback; }
  catch (e) { return fallback; }
}

function saveJSON(key, obj) {
  localStorage.setItem(key, JSON.stringify(obj));
}

/* ============================================================
   HELPERS
   ============================================================ */
function fmt(n) {
  var s = loadJSON(SETTINGS_KEY, {});
  var sym = s.currency || '₹';
  return sym + Number(n).toLocaleString('en-IN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
}

function todayISO() {
  var d = new Date();
  return d.getFullYear() + '-' +
    String(d.getMonth() + 1).padStart(2, '0') + '-' +
    String(d.getDate()).padStart(2, '0');
}

function monthKey(iso) { return iso.slice(0, 7); }

function monthLabel(key) {
  var p = key.split('-');
  var d = new Date(p[0], p[1] - 1, 1);
  return d.toLocaleString('en-US', { month: 'short', year: 'numeric' });
}

function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

function formatDate(iso) {
  var s = loadJSON(SETTINGS_KEY, {});
  var p = iso.split('-');
  if (s.dateFmt === 'dmy') return p[2] + '/' + p[1] + '/' + p[0];
  if (s.dateFmt === 'mdy') return p[1] + '/' + p[2] + '/' + p[0];
  return iso;
}

function escapeHtml(str) {
  return String(str).replace(/[&<>"']/g, function (c) {
    return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
  });
}

/* ============================================================
   NAVIGATION
   ============================================================ */
function openSidebar() {
  if ($('sidebar')) $('sidebar').classList.add('open');
  if ($('backdrop')) $('backdrop').classList.add('show');
  document.body.style.overflow = 'hidden';
}

function closeSidebar() {
  if ($('sidebar')) $('sidebar').classList.remove('open');
  if ($('backdrop')) $('backdrop').classList.remove('show');
  document.body.style.overflow = '';
}

function goToPage(name) {
  var pages = document.querySelectorAll('.page');
  for (var i = 0; i < pages.length; i++) pages[i].classList.remove('active');

  var target = $('page-' + name);
  if (target) target.classList.add('active');

  var navs = document.querySelectorAll('.nav-item');
  for (var j = 0; j < navs.length; j++) {
    if (navs[j].getAttribute('data-page') === name) navs[j].classList.add('active');
    else navs[j].classList.remove('active');
  }

  // Sync bottom nav active state
  var bnavs = document.querySelectorAll('.nav-btn');
  for (var k = 0; k < bnavs.length; k++) {
    if (bnavs[k].getAttribute('data-tab') === name) bnavs[k].classList.add('active');
    else bnavs[k].classList.remove('active');
  }

  try { localStorage.setItem(PAGE_KEY, name); } catch (e) {}

  closeSidebar();
  window.scrollTo(0, 0);

  // Re-render charts when overview becomes visible
  if (name === 'overview') {
    setTimeout(renderCharts, 120);
  }
  if (name === 'budget') {
    renderBudget();
    renderCategoryLimits();
  }
}

function scrollToFeatures() {
  var el = $('features');
  if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
}
window.scrollToFeatures = scrollToFeatures;
window.goToPage = goToPage;

/* ============================================================
   CRUD — Expenses
   ============================================================ */
function handleSubmit(e) {
  e.preventDefault();

  var payload = {
    amount: parseFloat($('amount').value),
    category: $('category').value,
    date: $('date').value,
    paymentMethod: $('payment').value,
    description: $('description').value.trim() || '—'
  };

  if (!payload.amount || payload.amount <= 0) return;

  if (editingId) {
    for (var i = 0; i < expenses.length; i++) {
      if (expenses[i].id === editingId) {
        expenses[i].amount = payload.amount;
        expenses[i].category = payload.category;
        expenses[i].date = payload.date;
        expenses[i].paymentMethod = payload.paymentMethod;
        expenses[i].description = payload.description;
        break;
      }
    }
    exitEditMode();
  } else {
    payload.id = uid();
    expenses.push(payload);
  }

  saveData();
  resetForm();
  renderAll();
  checkLimit(payload.category);
}

function deleteExpense(id) {
  if (!confirm('Delete this expense?')) return;
  expenses = expenses.filter(function (x) { return x.id !== id; });
  saveData();
  if (editingId === id) exitEditMode();
  renderAll();
}

function startEdit(id) {
  var exp = null;
  for (var i = 0; i < expenses.length; i++) {
    if (expenses[i].id === id) { exp = expenses[i]; break; }
  }
  if (!exp) return;

  editingId = id;
  if ($('amount')) $('amount').value = exp.amount;
  if ($('category')) $('category').value = exp.category;
  if ($('date')) $('date').value = exp.date;
  if ($('payment')) $('payment').value = exp.paymentMethod;
  if ($('description')) $('description').value = exp.description === '—' ? '' : exp.description;

  if ($('formTitle')) $('formTitle').textContent = 'Edit Expense';
  if ($('submitBtn')) $('submitBtn').textContent = 'Update Expense';
  if ($('cancelEditBtn')) $('cancelEditBtn').style.display = 'inline-block';

  goToPage('transactions');
}

function exitEditMode() {
  editingId = null;
  if ($('formTitle')) $('formTitle').textContent = 'Add Expense';
  if ($('submitBtn')) $('submitBtn').textContent = 'Add Expense';
  if ($('cancelEditBtn')) $('cancelEditBtn').style.display = 'none';
  resetForm();
}

function resetForm() {
  if ($('expenseForm')) $('expenseForm').reset();
  if ($('date')) $('date').value = todayISO();
}

function checkLimit(category) {
  var limits = loadJSON(LIMITS_KEY, {});
  if (!limits[category]) return;

  var mk = monthKey(todayISO());
  var spent = 0;
  for (var i = 0; i < expenses.length; i++) {
    if (expenses[i].category === category && monthKey(expenses[i].date) === mk) {
      spent += expenses[i].amount;
    }
  }

  if (spent > limits[category]) {
    setTimeout(function () {
      alert('⚠️ "' + category + '" limit cross!\nLimit: ' + fmt(limits[category]) +
            '\nSpent: ' + fmt(spent));
    }, 300);
  }
}

/* ============================================================
   FILTERING
   ============================================================ */
function getFiltered() {
  var cat = $('filterCategory') ? $('filterCategory').value : 'all';
  var mon = $('filterMonth') ? $('filterMonth').value : 'all';
  var q = $('searchInput') ? $('searchInput').value.trim().toLowerCase() : '';

  var rows = expenses.filter(function (e) {
    if (cat !== 'all' && e.category !== cat) return false;
    if (mon !== 'all' && monthKey(e.date) !== mon) return false;
    if (q && e.description.toLowerCase().indexOf(q) === -1) return false;
    return true;
  });

  rows.sort(function (a, b) {
    if (a.date < b.date) return 1;
    if (a.date > b.date) return -1;
    return 0;
  });

  return rows;
}

/* ============================================================
   RENDER: STATS
   ============================================================ */
function renderStats() {
  var total = 0;
  var byCat = {};
  var mk = monthKey(todayISO());
  var monthTotal = 0;

  for (var i = 0; i < expenses.length; i++) {
    var e = expenses[i];
    total += e.amount;
    byCat[e.category] = (byCat[e.category] || 0) + e.amount;
    if (monthKey(e.date) === mk) monthTotal += e.amount;
  }

  var top = '—', topAmt = 0;
  for (var k in byCat) {
    if (byCat[k] > topAmt) { topAmt = byCat[k]; top = k; }
  }

  if ($('totalSpent')) $('totalSpent').textContent = fmt(total);
  if ($('monthSpent')) $('monthSpent').textContent = fmt(monthTotal);
  if ($('topCategory')) $('topCategory').textContent = top;
  if ($('txnCount')) $('txnCount').textContent = expenses.length;

  renderBudget(monthTotal);
}

function renderBudget(monthTotal) {
  if (monthTotal === undefined) {
    monthTotal = 0;
    var mk = monthKey(todayISO());
    for (var i = 0; i < expenses.length; i++) {
      if (monthKey(expenses[i].date) === mk) monthTotal += expenses[i].amount;
    }
  }

  if ($('budgetInput')) $('budgetInput').value = monthlyBudget || '';

  var bar = $('budgetBar');
  var text = $('budgetText');
  if (!bar || !text) return;

  if (!monthlyBudget) {
    bar.style.width = '0%';
    text.textContent = 'No budget set.';
    return;
  }

  var pct = Math.min((monthTotal / monthlyBudget) * 100, 100);
  bar.style.width = pct + '%';
  bar.style.background = pct < 70 ? '#10b981' : pct < 100 ? '#f59e0b' : '#ef4444';

  var left = monthlyBudget - monthTotal;
  text.textContent = left >= 0
    ? fmt(monthTotal) + ' of ' + fmt(monthlyBudget) + ' used · ' + fmt(left) + ' left'
    : fmt(monthTotal) + ' of ' + fmt(monthlyBudget) + ' used · Over by ' + fmt(-left);
}

/* ============================================================
   RENDER: CHARTS
   ============================================================ */
function renderCharts() {
  if (typeof Chart === 'undefined') return;

  var catCanvas = $('categoryChart');
  var trendCanvas = $('trendChart');
  if (!catCanvas || !trendCanvas) return;

  // Skip if overview page is not visible
  var overview = $('page-overview');
  if (!overview || !overview.classList.contains('active')) return;

  // Skip if canvas has no size
  var rect = catCanvas.parentElement.getBoundingClientRect();
  if (rect.width < 10 || rect.height < 10) {
    setTimeout(renderCharts, 150);
    return;
  }

  // ---------- Doughnut ----------
  var byCat = {};
  for (var i = 0; i < expenses.length; i++) {
    var c = expenses[i].category;
    byCat[c] = (byCat[c] || 0) + expenses[i].amount;
  }

  var labels = Object.keys(byCat);
  var values = labels.map(function (k) { return byCat[k]; });
  var colors = labels.map(function (k) { return CATEGORY_COLORS[k] || '#94a3b8'; });

  try {
    if (categoryChart) { categoryChart.destroy(); categoryChart = null; }
    categoryChart = new Chart(catCanvas, {
      type: 'doughnut',
      data: {
        labels: labels.length ? labels : ['No data'],
        datasets: [{
          data: values.length ? values : [1],
          backgroundColor: colors.length ? colors : ['#e2e8f0'],
          borderWidth: 2,
          borderColor: '#fff'
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        cutout: '60%',
        animation: false,
        plugins: {
          legend: { position: 'right', labels: { boxWidth: 12, font: { size: 11 } } }
        }
      }
    });
  } catch (err) {
    console.warn('Doughnut chart skipped:', err.message);
  }

  // ---------- 6-month bar ----------
  var months = [];
  var now = new Date();
  for (var j = 5; j >= 0; j--) {
    var d = new Date(now.getFullYear(), now.getMonth() - j, 1);
    months.push(d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0'));
  }

  var monthTotals = months.map(function (m) {
    var sum = 0;
    for (var k = 0; k < expenses.length; k++) {
      if (monthKey(expenses[k].date) === m) sum += expenses[k].amount;
    }
    return sum;
  });

  try {
    if (trendChart) { trendChart.destroy(); trendChart = null; }
    trendChart = new Chart(trendCanvas, {
      type: 'bar',
      data: {
        labels: months.map(monthLabel),
        datasets: [{
          label: 'Spent',
          data: monthTotals,
          backgroundColor: '#4f46e5',
          borderRadius: 8,
          maxBarThickness: 52
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        animation: false,
        plugins: { legend: { display: false } },
        scales: {
          y: { beginAtZero: true, grid: { color: '#f1f5f9' } },
          x: { grid: { display: false } }
        }
      }
    });
  } catch (err) {
    console.warn('Trend chart skipped:', err.message);
  }
}

/* ============================================================
   RENDER: TABLE + FILTERS
   ============================================================ */
function renderTable() {
  var tbody = $('tableBody');
  if (!tbody) return;

  var rows = getFiltered();
  tbody.innerHTML = '';
  if ($('emptyState')) $('emptyState').style.display = rows.length ? 'none' : 'block';

  for (var i = 0; i < rows.length; i++) {
    var e = rows[i];
    var color = CATEGORY_COLORS[e.category] || '#64748b';
    var tr = document.createElement('tr');
    tr.innerHTML =
      '<td>' + formatDate(e.date) + '</td>' +
      '<td><span class="badge" style="background:' + color + '22;color:' + color + '">' +
        escapeHtml(e.category) + '</span></td>' +
      '<td>' + escapeHtml(e.description) + '</td>' +
      '<td>' + escapeHtml(e.paymentMethod) + '</td>' +
      '<td class="right amount">' + fmt(e.amount) + '</td>' +
      '<td class="right">' +
        '<button class="btn-ghost" style="padding:4px 10px;font-size:0.75rem;" ' +
          'data-edit="' + e.id + '">Edit</button> ' +
        '<button class="btn-danger" style="padding:4px 10px;font-size:0.75rem;" ' +
          'data-del="' + e.id + '">Delete</button>' +
      '</td>';
    tbody.appendChild(tr);
  }
}

function renderFilterOptions() {
  var catSel = $('filterCategory');
  var monSel = $('filterMonth');
  if (!catSel || !monSel) return;

  var curCat = catSel.value;
  var curMon = monSel.value;

  var cats = [], mons = [];
  for (var i = 0; i < expenses.length; i++) {
    if (cats.indexOf(expenses[i].category) === -1) cats.push(expenses[i].category);
    var mk = monthKey(expenses[i].date);
    if (mons.indexOf(mk) === -1) mons.push(mk);
  }
  cats.sort();
  mons.sort().reverse();

  var catHTML = '<option value="all">All Categories</option>';
  for (var a = 0; a < cats.length; a++) {
    catHTML += '<option value="' + escapeHtml(cats[a]) + '">' + escapeHtml(cats[a]) + '</option>';
  }
  catSel.innerHTML = catHTML;
  catSel.value = cats.indexOf(curCat) > -1 ? curCat : 'all';

  var monHTML = '<option value="all">All Months</option>';
  for (var b = 0; b < mons.length; b++) {
    monHTML += '<option value="' + mons[b] + '">' + monthLabel(mons[b]) + '</option>';
  }
  monSel.innerHTML = monHTML;
  monSel.value = mons.indexOf(curMon) > -1 ? curMon : 'all';
}

/* ============================================================
   EXPORT CSV
   ============================================================ */
function exportCSV() {
  var rows = getFiltered();
  if (!rows.length) { alert('Nothing to export.'); return; }

  var lines = ['Date,Category,Description,Payment,Amount'];
  for (var i = 0; i < rows.length; i++) {
    var e = rows[i];
    lines.push([
      e.date,
      e.category,
      '"' + String(e.description).replace(/"/g, '""') + '"',
      e.paymentMethod,
      e.amount
    ].join(','));
  }

  var blob = new Blob([lines.join('\n')], { type: 'text/csv' });
  var url = URL.createObjectURL(blob);
  var a = document.createElement('a');
  a.href = url;
  a.download = 'campusespend_' + todayISO() + '.csv';
  a.click();
  URL.revokeObjectURL(url);
}

/* ============================================================
   MASTER RENDER
   ============================================================ */
function renderAll() {
  renderStats();
  renderFilterOptions();
  renderTable();

  var overview = $('page-overview');
  if (overview && overview.classList.contains('active')) {
    setTimeout(renderCharts, 60);
  }
}

/* ============================================================
   CATEGORY LIMITS
   ============================================================ */
function renderCategoryLimits() {
  var wrap = $('catLimits');
  if (!wrap) return;

  var cats = Object.keys(CATEGORY_COLORS);
  var limits = loadJSON(LIMITS_KEY, {});

  var html = '';
  for (var i = 0; i < cats.length; i++) {
    var c = cats[i];
    var color = CATEGORY_COLORS[c];
    html +=
      '<div class="cat-limit-row">' +
        '<span class="badge" style="background:' + color + '22;color:' + color + '">' +
          c + '</span>' +
        '<input type="number" min="0" placeholder="No limit" ' +
          'data-cat="' + c + '" value="' + (limits[c] || '') + '">' +
      '</div>';
  }
  wrap.innerHTML = html;

  var inputs = wrap.querySelectorAll('input');
  for (var j = 0; j < inputs.length; j++) {
    inputs[j].addEventListener('change', function () {
      var val = Number(this.value);
      var lims = loadJSON(LIMITS_KEY, {});
      if (val > 0) lims[this.getAttribute('data-cat')] = val;
      else delete lims[this.getAttribute('data-cat')];
      saveJSON(LIMITS_KEY, lims);
    });
  }
}



/* ============================================================
   ACCOUNT
   ============================================================ */
function renderAccount() {
  var a = loadJSON(ACCOUNT_KEY, {});
  if ($('accName'))  $('accName').textContent  = a.name  || 'Student Name';
  if ($('accEmail')) $('accEmail').textContent = a.email || 'student@college.edu';
  if ($('accSince')) $('accSince').textContent = a.since ? 'Member since ' + a.since : 'Member since —';
  if ($('sidebarUser')) $('sidebarUser').textContent = a.name || 'Student';
  if ($('inpName'))    $('inpName').value    = a.name    || '';
  if ($('inpEmail'))   $('inpEmail').value   = a.email   || '';
  if ($('inpCollege')) $('inpCollege').value = a.college || '';
  if ($('inpPhone'))   $('inpPhone').value   = a.phone   || '';
}

function bindAccountForm() {
  if (!$('accountForm')) return;
  $('accountForm').addEventListener('submit', function (e) {
    e.preventDefault();
    var a = loadJSON(ACCOUNT_KEY, {});
    a.name    = $('inpName').value.trim();
    a.email   = $('inpEmail').value.trim();
    a.college = $('inpCollege').value.trim();
    a.phone   = $('inpPhone').value.trim();
    a.since   = a.since || todayISO();
    saveJSON(ACCOUNT_KEY, a);
    renderAccount();
    alert('Details saved ✓');
  });
}

/* ============================================================
   SETTINGS
   ============================================================ */
function applySettings() {
  var s = loadJSON(SETTINGS_KEY, {});
  if (s.dark) document.body.classList.add('dark');
  else document.body.classList.remove('dark');

  if ($('setCurrency')) $('setCurrency').value = s.currency || '₹';
  if ($('setDateFmt'))  $('setDateFmt').value  = s.dateFmt  || 'iso';
  if ($('setDark'))     $('setDark').checked   = !!s.dark;
}

function bindSettings() {
  if ($('setCurrency')) {
    $('setCurrency').addEventListener('change', function () {
      var s = loadJSON(SETTINGS_KEY, {});
      s.currency = this.value;
      saveJSON(SETTINGS_KEY, s);
      renderAll();
    });
  }

  if ($('setDateFmt')) {
    $('setDateFmt').addEventListener('change', function () {
      var s = loadJSON(SETTINGS_KEY, {});
      s.dateFmt = this.value;
      saveJSON(SETTINGS_KEY, s);
      renderTable();
    });
  }

  if ($('setDark')) {
    $('setDark').addEventListener('change', function () {
      var s = loadJSON(SETTINGS_KEY, {});
      s.dark = this.checked;
      saveJSON(SETTINGS_KEY, s);
      applySettings();
      renderCharts();
    });
  }

  if ($('backupBtn')) {
    $('backupBtn').addEventListener('click', function () {
      var data = {
        expenses: expenses,
        budget: monthlyBudget,
        account: loadJSON(ACCOUNT_KEY, {}),
        settings: loadJSON(SETTINGS_KEY, {}),
        limits: loadJSON(LIMITS_KEY, {}),
        exported: new Date().toISOString()
      };
      var blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      var url = URL.createObjectURL(blob);
      var a = document.createElement('a');
      a.href = url;
      a.download = 'campusespend_backup_' + todayISO() + '.json';
      a.click();
      URL.revokeObjectURL(url);
    });
  }

  if ($('restoreBtn') && $('restoreInput')) {
    $('restoreBtn').addEventListener('click', function () { $('restoreInput').click(); });
    $('restoreInput').addEventListener('change', function (e) {
      var file = e.target.files[0];
      if (!file) return;
      var reader = new FileReader();
      reader.onload = function (ev) {
        try {
          var d = JSON.parse(ev.target.result);
          if (d.expenses) { expenses = d.expenses; saveData(); }
          if (d.budget != null) { monthlyBudget = d.budget; saveBudget(); }
          if (d.account)  saveJSON(ACCOUNT_KEY, d.account);
          if (d.settings) saveJSON(SETTINGS_KEY, d.settings);
          if (d.limits)   saveJSON(LIMITS_KEY, d.limits);
          applySettings();
          renderAll();
          renderAccount();
          renderCategoryLimits();
          alert('Backup restored ✓');
        } catch (err) { alert('Invalid backup file.'); }
      };
      reader.readAsText(file);
    });
  }

  if ($('resetBtn')) {
    $('resetBtn').addEventListener('click', function () {
      if (!confirm('Sab data delete ho jayega. Sure?')) return;
      localStorage.clear();
      location.reload();
    });
  }
}

/* ============================================================
   ADD MODAL — Categories + Amount
   ============================================================ */
var CATEGORIES = [
  { name: 'Shopping',       icon: 'cart' },
  { name: 'Food',           icon: 'utensils' },
  { name: 'Phone',          icon: 'phone' },
  { name: 'Entertainment',  icon: 'gamepad' },
  { name: 'Education',      icon: 'gradcap' },
  { name: 'Beauty',         icon: 'scissors' },
  { name: 'Sports',         icon: 'runner' },
  { name: 'Social',         icon: 'users' },
  { name: 'Transportation', icon: 'bus' },
  { name: 'Clothing',       icon: 'shirt' },
  { name: 'Car',            icon: 'car' },
  { name: 'Alcohol',        icon: 'wine' },
  { name: 'Electronics',    icon: 'monitor' },
  { name: 'Cigarettes',     icon: 'cig' },
  { name: 'Travel',         icon: 'plane' },
  { name: 'Health',         icon: 'heart' },
  { name: 'Pets',           icon: 'paw' },
  { name: 'Repairs',        icon: 'wrench' },
  { name: 'Housing',        icon: 'house' },
  { name: 'Home',           icon: 'sofa' },
  { name: 'Gifts',          icon: 'gift' },
  { name: 'Donations',      icon: 'hands' },
  { name: 'Lottery',        icon: 'dice' },
  { name: 'Snacks',         icon: 'popcorn' },
  { name: 'Kids',           icon: 'baby' },
  { name: 'Vegetables',     icon: 'carrot' },
  { name: 'Fruits',         icon: 'apple' },
  { name: 'Settings',       icon: 'plus' }
];

var ICONS = {
  cart:      '<circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/><path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"/>',
  utensils:  '<path d="M3 2v7c0 1.1.9 2 2 2h4a2 2 0 0 0 2-2V2"/><path d="M7 2v20"/><path d="M21 15V2a5 5 0 0 0-5 5v6c0 1.1.9 2 2 2h3z"/><path d="M21 15v7"/>',
  phone:     '<rect x="7" y="2" width="10" height="20" rx="2"/>',
  gamepad:   '<line x1="6" y1="11" x2="10" y2="11"/><line x1="8" y1="9" x2="8" y2="13"/><line x1="15" y1="12" x2="15.01" y2="12"/><line x1="18" y1="10" x2="18.01" y2="10"/><path d="M17.32 5H6.68a4 4 0 0 0-3.978 3.59c-.006.052-.01.101-.017.152C2.604 9.416 2 14.456 2 16a3 3 0 0 0 3 3c1 0 1.5-.5 2-1l1.414-1.414A2 2 0 0 1 9.828 16h4.344a2 2 0 0 1 1.414.586L17 18c.5.5 1 1 2 1a3 3 0 0 0 3-3c0-1.545-.604-6.584-.685-7.258-.007-.05-.011-.1-.017-.151A4 4 0 0 0 17.32 5z"/>',
  gradcap:   '<path d="M22 10v6M2 10l10-5 10 5-10 5z"/><path d="M6 12v5c3 3 9 3 12 0v-5"/>',
  scissors:  '<circle cx="6" cy="6" r="3"/><circle cx="6" cy="18" r="3"/><line x1="20" y1="4" x2="8.12" y2="15.88"/><line x1="14.47" y1="14.48" x2="20" y2="20"/><line x1="8.12" y1="8.12" x2="12" y2="12"/>',
  runner:    '<circle cx="13" cy="4" r="1"/><path d="M4 17l5-3 2-4 3 3 4-2"/><path d="M16 21l-3-6"/>',
  users:     '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>',
  bus:       '<path d="M8 6v6M15 6v6M2 12h19.6M18 18h3s.5-1.7.8-2.8c.1-.4.2-.8.2-1.2 0-.4-.1-.8-.2-1.2l-1.4-5C20.1 6.8 19.1 6 18 6H4a2 2 0 0 0-2 2v10h3"/><circle cx="7" cy="18" r="2"/><path d="M9 18h5"/><circle cx="16" cy="18" r="2"/>',
  shirt:     '<path d="M20.38 3.46 16 2a4 4 0 0 1-8 0L3.62 3.46a2 2 0 0 0-1.34 2.23l.58 3.47a1 1 0 0 0 .99.84H6v10c0 1.1.9 2 2 2h8a2 2 0 0 0 2-2V10h2.15a1 1 0 0 0 .99-.84l.58-3.47a2 2 0 0 0-1.34-2.23z"/>',
  car:       '<path d="M19 17h2c.6 0 1-.4 1-1v-3c0-.9-.7-1.7-1.5-1.9C18.7 10.6 16 10 16 10s-1.3-1.4-2.2-2.3c-.5-.4-1.1-.7-1.8-.7H5c-.6 0-1.1.4-1.4.9l-1.4 2.9A3.7 3.7 0 0 0 2 12v4c0 .6.4 1 1 1h2"/><circle cx="7" cy="17" r="2"/><path d="M9 17h6"/><circle cx="17" cy="17" r="2"/>',
  wine:      '<path d="M8 22h8M12 11v11M19 3H5l1 7a6 6 0 0 0 12 0z"/>',
  monitor:   '<rect x="2" y="3" width="20" height="14" rx="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/>',
  cig:       '<path d="M18 12H2v4h16zM22 12v4M18 8c0-2.5-2-2.5-2-5M22 8c0-2.5-2-2.5-2-5"/>',
  plane:     '<path d="M17.8 19.2 16 11l3.5-3.5C21 6 21.5 4 21 3c-1-.5-3 0-4.5 1.5L13 8 4.8 6.2c-.5-.1-.9.1-1.1.5l-.3.5c-.2.5-.1 1 .3 1.3L9 12l-2 3H4l-1 1 3 2 2 3 1-1v-3l3-2 3.5 5.3c.3.4.8.5 1.3.3l.5-.2c.4-.3.6-.7.5-1.2z"/>',
  heart:     '<path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>',
  paw:       '<circle cx="11" cy="4" r="2"/><circle cx="18" cy="8" r="2"/><circle cx="20" cy="16" r="2"/><path d="M9 10a5 5 0 0 1 5 5v3.5a3.5 3.5 0 0 1-6.84 1.045Q6.52 17.48 4.46 16.84A3.5 3.5 0 0 1 5.5 10Z"/>',
  wrench:    '<path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/>',
  house:     '<path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/>',
  sofa:      '<path d="M20 9V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v3"/><path d="M2 11v5a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-5a2 2 0 0 0-4 0v2H6v-2a2 2 0 0 0-4 0z"/><path d="M4 18v2M20 18v2"/>',
  gift:      '<polyline points="20 12 20 22 4 22 4 12"/><rect x="2" y="7" width="20" height="5"/><line x1="12" y1="22" x2="12" y2="7"/><path d="M12 7H7.5a2.5 2.5 0 0 1 0-5C11 2 12 7 12 7z"/><path d="M12 7h4.5a2.5 2.5 0 0 0 0-5C13 2 12 7 12 7z"/>',
  hands:     '<path d="M11 14h2a2 2 0 1 0 0-4h-3c-.6 0-1.1.2-1.4.6L3 16"/><path d="m7 20 1.6-1.4c.3-.4.8-.6 1.4-.6h4c1.1 0 2.1-.4 2.8-1.2l4.6-4.4a2 2 0 0 0-2.75-2.91l-4.2 3.9"/><path d="m2 15 6 6"/>',
  dice:      '<rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8" cy="8" r="1"/><circle cx="16" cy="8" r="1"/><circle cx="12" cy="12" r="1"/><circle cx="8" cy="16" r="1"/><circle cx="16" cy="16" r="1"/>',
  popcorn:   '<path d="M18 8a2 2 0 0 0 0-4 2 2 0 0 0-2-2 2 2 0 0 0-4 0 2 2 0 0 0-4 0 2 2 0 0 0-2 2 2 2 0 0 0 0 4v10a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2z"/><path d="M6 8h12"/>',
  baby:      '<path d="M9 12h.01M15 12h.01M10 16c.5.3 1.2.5 2 .5s1.5-.2 2-.5"/><circle cx="12" cy="12" r="10"/>',
  carrot:    '<path d="M2.27 21.7s9.87-3.5 12.73-6.36a4.5 4.5 0 0 0-6.36-6.37C5.77 11.84 2.27 21.7 2.27 21.7z"/><path d="M8.64 15.36 5 19"/>',
  apple:     '<path d="M12 20.94c1.5 0 2.75 1.06 4 1.06 3 0 6-8 6-12.22A4.91 4.91 0 0 0 17 5c-2.22 0-4 1.44-5 2-1-.56-2.78-2-5-2a4.9 4.9 0 0 0-5 4.78C2 14 5 22 8 22c1.25 0 2.5-1.06 4-1.06z"/><path d="M10 2c1 .5 2 2 2 5"/>',
  plus:      '<line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>'
};

function svgIcon(paths) {
  return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" ' +
         'stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' +
         paths + '</svg>';
}

function renderCategoryGrid() {
  var grid = $('catGrid');
  if (!grid) return;

  var html = '';
  for (var i = 0; i < CATEGORIES.length; i++) {
    var c = CATEGORIES[i];
    html += '<button type="button" class="cat-item" data-cat="' + c.name + '">' +
              '<div class="cat-icon">' + svgIcon(ICONS[c.icon] || ICONS.plus) + '</div>' +
              '<div class="cat-name">' + c.name + '</div>' +
            '</button>';
  }
  grid.innerHTML = html;

  var items = grid.querySelectorAll('.cat-item');
  for (var j = 0; j < items.length; j++) {
    items[j].addEventListener('click', function () {
      var cat = this.getAttribute('data-cat');
      if (cat === 'Settings') {
        closeAddModal();
        goToPage('settings');
        return;
      }
      selectedCategory = cat;
      if ($('amountForm')) $('amountForm').classList.add('show');
      if ($('txnAmount')) $('txnAmount').focus();
    });
  }
}

function openAddModal() {
  if (!$('addModal')) return;
  $('addModal').classList.add('open');
  document.body.style.overflow = 'hidden';
  selectedCategory = null;
  if ($('amountForm')) $('amountForm').classList.remove('show');
  if ($('txnAmount')) $('txnAmount').value = '';
  if ($('txnNote')) $('txnNote').value = '';

  // Reset type tabs
  var tabs = document.querySelectorAll('.type-tab');
  for (var i = 0; i < tabs.length; i++) {
    if (tabs[i].getAttribute('data-type') === 'expense') tabs[i].classList.add('active');
    else tabs[i].classList.remove('active');
  }
  currentType = 'expense';
}

function closeAddModal() {
  if (!$('addModal')) return;
  $('addModal').classList.remove('open');
  document.body.style.overflow = '';
}

function saveTransaction() {
  var amtInput = $('txnAmount');
  if (!amtInput) return;

  var amt = parseFloat(amtInput.value);
  if (!amt || amt <= 0) {
    alert('Amount daalo');
    amtInput.focus();
    return;
  }
  if (!selectedCategory) {
    alert('Category select karo');
    return;
  }

  var note = ($('txnNote') && $('txnNote').value.trim()) || selectedCategory;

  var txn = {
    id: uid(),
    amount: amt,
    category: selectedCategory,
    type: currentType,
    date: todayISO(),
    paymentMethod: 'Cash',
    description: note
  };

  expenses.push(txn);
  saveData();
  renderAll();
  checkLimit(txn.category);
  closeAddModal();

  // Small confirmation
  var toast = document.createElement('div');
  toast.style.cssText =
    'position:fixed;bottom:90px;left:50%;transform:translateX(-50%);' +
    'background:#10b981;color:#fff;padding:12px 22px;border-radius:10px;' +
    'font-size:14px;font-weight:600;z-index:999;box-shadow:0 4px 18px rgba(0,0,0,0.2);';
  toast.textContent = '✓ ' + selectedCategory + ' — ' + fmt(amt);
  document.body.appendChild(toast);
  setTimeout(function () { toast.remove(); }, 1800);
}

/* ============================================================
   NAV BINDING
   ============================================================ */
function bindNavigation() {
  if ($('menuBtn'))      $('menuBtn').addEventListener('click', openSidebar);
  if ($('closeMenuBtn')) $('closeMenuBtn').addEventListener('click', closeSidebar);
  if ($('backdrop'))     $('backdrop').addEventListener('click', closeSidebar);

  // Sidebar nav items
  var navs = document.querySelectorAll('.nav-item');
  for (var i = 0; i < navs.length; i++) {
    (function (btn) {
      btn.addEventListener('click', function () {
        goToPage(btn.getAttribute('data-page'));
      });
    })(navs[i]);
  }

  // Bottom nav buttons
  var bnavs = document.querySelectorAll('.nav-btn');
  for (var j = 0; j < bnavs.length; j++) {
    (function (btn) {
      btn.addEventListener('click', function () {
        var tab = btn.getAttribute('data-tab');
        if (tab) goToPage(tab);
      });
    })(bnavs[j]);
  }

  // + button in bottom nav
  if ($('navAddBtn')) $('navAddBtn').addEventListener('click', openAddModal);

  // Modal cancel
  if ($('cancelAddBtn')) $('cancelAddBtn').addEventListener('click', closeAddModal);

  // Type tabs
  var tabs = document.querySelectorAll('.type-tab');
  for (var k = 0; k < tabs.length; k++) {
    (function (tab) {
      tab.addEventListener('click', function () {
        for (var m = 0; m < tabs.length; m++) tabs[m].classList.remove('active');
        tab.classList.add('active');
        currentType = tab.getAttribute('data-type');
      });
    })(tabs[k]);
  }

  // Save txn button
  if ($('saveTxnBtn')) $('saveTxnBtn').addEventListener('click', saveTransaction);

  // Enter on amount saves
  if ($('txnAmount')) {
    $('txnAmount').addEventListener('keydown', function (e) {
      if (e.key === 'Enter') { e.preventDefault(); saveTransaction(); }
    });
  }

  // Esc closes modal / sidebar
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') {
      closeSidebar();
      closeAddModal();
    }
  });
}

/* ============================================================
   SERVICE WORKER CLEANUP (dev helper)
   ============================================================ */
function cleanupServiceWorkers() {
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.getRegistrations().then(function (regs) {
      if (regs.length) {
        console.log('⚠️ Service Workers found. Unregistering for dev…');
        regs.forEach(function (r) { r.unregister(); });
      }
    });
  }
}
/* ============================================================
   QUICK ADD (UPDATED: Fix "Added" bug, Add Scroll & Customise)
   ============================================================ */
var DEFAULT_QUICK_PRESETS = [
  { label: 'Chai ₹10',  amt: 10, cat: 'Snacks',         desc: 'Chai' },
  { label: 'Lunch ₹60', amt: 60, cat: 'Food',           desc: 'Lunch' },
  { label: 'Auto ₹30',  amt: 30, cat: 'Transportation', desc: 'Auto' },
  { label: 'Xerox ₹5',  amt: 5,  cat: 'Education',      desc: 'Xerox' },
  { label: 'Metro ₹25', amt: 25, cat: 'Transportation', desc: 'Metro' },
  { label: 'Water ₹20', amt: 20, cat: 'Food',           desc: 'Water' }
];

function renderQuickGrid() {
  var grid = $('quickGrid');
  if (!grid) return;

  var presets = DEFAULT_QUICK_PRESETS;
  try {
    var saved = JSON.parse(localStorage.getItem('cs_quick_presets'));
    if (saved && saved.length) presets = saved;
  } catch (e) {}

  var html = '';
  for (var i = 0; i < presets.length; i++) {
    var p = presets[i];
    html += '<button type="button" class="quick-btn" ' +
              'data-amt="' + p.amt + '" ' +
              'data-cat="' + escapeHtml(p.cat) + '" ' +
              'data-desc="' + escapeHtml(p.desc) + '">' +
              escapeHtml(p.label) +
            '</button>';
  }
  grid.innerHTML = html;

  bindQuickAdd();
  setTimeout(checkQuickScroll, 100);
}

function bindQuickAdd() {
  var btns = document.querySelectorAll('.quick-btn');
  for (var i = 0; i < btns.length; i++) {
    (function (btn) {
      btn.addEventListener('click', function () {
        var e = {
          id: uid(),
          amount: Number(btn.getAttribute('data-amt')),
          category: btn.getAttribute('data-cat'),
          date: todayISO(),
          paymentMethod: 'Cash',
          description: btn.getAttribute('data-desc')
        };
        expenses.push(e);
        saveData();
        renderAll();
        checkLimit(e.category);

        // FIX: Sirf toast dikhao, button text change mat karo
        toast('✅ Added ' + e.description + ' ' + fmt(e.amount));
      });
    })(btns[i]);
  }
}

function checkQuickScroll() {
  var grid = $('quickGrid');
  var btn = $('scrollQuickBtn');
  if (!grid || !btn) return;

  if (grid.scrollWidth > grid.clientWidth) {
    btn.style.display = 'flex';
  } else {
    btn.style.display = 'none';
  }
}

function initQuickAddUI() {
  var grid = $('quickGrid');
  var scrollBtn = $('scrollQuickBtn');
  var editBtn = $('editQuickBtn');

  if (scrollBtn && grid) {
    scrollBtn.addEventListener('click', function() {
      grid.scrollBy({ left: 200, behavior: 'smooth' });
    });
  }

  if (editBtn) {
    editBtn.addEventListener('click', function() {
      var newLabel = prompt("Naya Quick Add Button ka Label likho (e.g., 'Cold Drink ₹20'):");
      if (!newLabel) return;
      var newAmt = prompt("Amount likho (sirf number):");
      if (!newAmt || isNaN(newAmt)) return;
      
      var presets = [];
      try { presets = JSON.parse(localStorage.getItem('cs_quick_presets')) || DEFAULT_QUICK_PRESETS; } catch(e) { presets = DEFAULT_QUICK_PRESETS; }
      
      presets.push({ label: newLabel, amt: Number(newAmt), cat: 'Other', desc: newLabel.split(' ')[0] });
      localStorage.setItem('cs_quick_presets', JSON.stringify(presets));
      renderQuickGrid();
      toast('✅ Custom button added!');
    });
  }
}
/* ============================================================
   SMS UI WIRING
   ============================================================ */
var SMS_CAT_MAP = {
  // SMS parser categories  →  form select categories
  Food:          'Food',
  Transport:     'Transportation',
  Books:         'Education',
  Stationery:    'Education',
  Hostel:        'Housing',
  Tuition:       'Education',
  Entertainment: 'Entertainment',
  Medical:       'Health',
  Other:         'Other'
};

function initSmsUI() {
  var parseBtn = $('parseSmsBtn');
  if (parseBtn) {
    parseBtn.addEventListener('click', function () {
      var smsEl = $('smsInput');
      var sms = (smsEl && smsEl.value || '').trim();
      if (!sms) return;

      var parsed = parseSmsText(sms);
      if (!parsed) {
        alert('❌ Ye debit SMS nahi lag rahi. Doosri try karo.');
        return;
      }

      // Map SMS category → form category
      var mappedCat = SMS_CAT_MAP[parsed.category] || 'Other';

      // Fill form
      if ($('amount'))      $('amount').value      = parsed.amount;
      if ($('category'))    $('category').value    = mappedCat;
      if ($('date'))        $('date').value        = parsed.date;
      if ($('payment'))     $('payment').value     = 'UPI';
      if ($('description')) $('description').value = parsed.merchant;
      if (smsEl)            smsEl.value            = '';

      if (editingId) exitEditMode();
      toast('✅ Auto-filled: ' + fmt(parsed.amount) + ' · ' + parsed.merchant + ' (' + mappedCat + ')');

      // Switch to transactions page to show filled form
      goToPage('transactions');
    });
  }

  // Android-only features
  if (isAndroid()) {
    if ($('smsActions')) $('smsActions').hidden = false;
    if ($('scanSmsBtn')) {
      $('scanSmsBtn').addEventListener('click', scanHistoricalSms);
    }
    // Catch SMS that arrived while app was closed
    syncPendingSms();
  }
} 

/* ============================================================
   INIT
   ============================================================ */
function init() {
  loadData();
  applySettings();
  renderAccount();
    initQuickAddUI();
  renderCategoryLimits();
    initCsvImport();
  renderCategoryGrid();
  renderQuickGrid();       // ✅ NEW — populate quick buttons
  bindNavigation();
  // bindQuickAdd();       // ❌ REMOVE — renderQuickGrid calls it internally
  bindAccountForm();
  bindSettings();

  initSmsUI();             // ✅ NEW — wire SMS paste + scan buttons

  // ... rest of init stays the same ...

  if ($('date')) $('date').value = todayISO();

  if ($('expenseForm')) $('expenseForm').addEventListener('submit', handleSubmit);
  if ($('cancelEditBtn')) $('cancelEditBtn').addEventListener('click', exitEditMode);

  if ($('tableBody')) {
    $('tableBody').addEventListener('click', function (e) {
      var t = e.target;
      if (t.hasAttribute('data-edit')) startEdit(t.getAttribute('data-edit'));
      if (t.hasAttribute('data-del'))  deleteExpense(t.getAttribute('data-del'));
    });
  }

  if ($('filterCategory')) $('filterCategory').addEventListener('change', renderTable);
  if ($('filterMonth'))    $('filterMonth').addEventListener('change', renderTable);
  if ($('searchInput'))    $('searchInput').addEventListener('input', renderTable);

  if ($('saveBudgetBtn')) {
    $('saveBudgetBtn').addEventListener('click', function () {
      var val = Number($('budgetInput').value);
      monthlyBudget = val > 0 ? val : 0;
      saveBudget();
      renderStats();
      alert('Budget saved ✓');
    });
  }

  if ($('exportBtn')) $('exportBtn').addEventListener('click', exportCSV);
  if ($('clearBtn')) {
    $('clearBtn').addEventListener('click', function () {
      if (!confirm('Delete ALL records? This cannot be undone.')) return;
      expenses = [];
      saveData();
      exitEditMode();
      renderAll();
    });
  }

  renderAll();

  // Restore last visited page (default: information)
  var lastPage = 'information';
  try { lastPage = localStorage.getItem(PAGE_KEY) || 'information'; } catch (e) {}
  goToPage(lastPage);

  // Dev helper
  cleanupServiceWorkers();

  console.log('✅ CampusSpend loaded successfully');
}

document.addEventListener('DOMContentLoaded', init);

/* ============================================================
   SMS PARSING (works in web + Android WebView)
   ============================================================ */
function parseSmsText(sms) {
  const lower = sms.toLowerCase();
  const debitKw  = ['debited','debit','paid','spent','sent','withdrawn','withdrew','purchase'];
  const creditKw = ['credited','credit','received','refund','cashback','reversal'];

  const isDebit = debitKw.some(k => lower.includes(k))
               && !creditKw.some(k => lower.includes(k));
  if (!isDebit) return null;

  // ---- Amount ----
  const amountPatterns = [
    /(?:Rs\.?|INR|₹)\s*([\d,]+(?:\.\d{1,2})?)/i,
    /([\d,]+(?:\.\d{1,2})?)\s*(?:Rs\.?|INR)/i
  ];
  let amount = null;
  for (const p of amountPatterns) {
    const m = sms.match(p);
    if (m) { amount = parseFloat(m[1].replace(/,/g, '')); break; }
  }
  if (!amount || amount <= 0 || amount > 1000000) return null;

  // ---- Merchant ----
  const merchantPatterns = [
    /(?:to|towards|at|paid to)\s+([A-Za-z0-9\s.\-&@_]+?)(?:\s+on|\s+via|\s+ref|\s+using|[.,]|$)/i,
    /VPA\s+([a-zA-Z0-9.\-@_]+)/i,
    /Info[:\s]+([A-Za-z0-9\s.\-&@_]+?)(?:\s+Ref|\s+on|$)/i
  ];
  let merchant = 'Unknown Merchant';
  for (const p of merchantPatterns) {
    const m = sms.match(p);
    if (m && m[1] && m[1].trim().length > 1) {
      merchant = m[1].trim().replace(/\.$/, '').slice(0, 60);
      break;
    }
  }

  const date     = extractDateFromSms(sms);
  const category = guessCategory(merchant);

  return { amount, merchant, category, date, raw: sms };
}

function extractDateFromSms(sms) {
  const patterns = [
    /(\d{2})-(\d{2})-(\d{2,4})/,
    /(\d{2})\/(\d{2})\/(\d{2,4})/,
    /(\d{2})-([A-Za-z]{3})-(\d{2,4})/,
    /(\d{2})([A-Za-z]{3})(\d{2,4})/
  ];
  const months = {jan:'01',feb:'02',mar:'03',apr:'04',may:'05',jun:'06',
                  jul:'07',aug:'08',sep:'09',oct:'10',nov:'11',dec:'12'};

  for (const p of patterns) {
    const m = sms.match(p);
    if (!m) continue;
    const d = m[1].padStart(2, '0');
    let mo = m[2], y = m[3];
    if (isNaN(parseInt(mo))) mo = months[mo.toLowerCase().slice(0, 3)] || '01';
    else mo = mo.padStart(2, '0');
    if (y.length === 2) y = '20' + y;
    return `${y}-${mo}-${d}`;
  }
  return new Date().toISOString().slice(0, 10);
}

function guessCategory(merchant) {
  const rules = {
    Food: ['swiggy','zomato','canteen','restaurant','cafe','dominos','pizza','kfc',
           'mcdonald','chai','tea','coffee','mess','dhaba','bakery','haldiram'],
    Transport: ['uber','ola','rapido','auto','cab','metro','bus','train','irctc',
                'petrol','fuel','indian oil','bharat petroleum','hp pay','toll'],
    Books: ['amazon','flipkart','book','library','kindle','crossword','scholar'],
    Stationery: ['xerox','print','stationery','pen','notebook','copier','repro'],
    Hostel: ['hostel','rent','pg ','accommodation','mess fee'],
    Tuition: ['tuition','college','university','fee','exam','admission','semester'],
    Entertainment: ['netflix','prime','hotstar','spotify','movie','pvr','inox',
                    'game','steam','bookmyshow'],
    Medical: ['pharmacy','medical','hospital','clinic','apollo','medplus','doctor','1mg']
  };
  const m = merchant.toLowerCase();
  for (const [cat, keys] of Object.entries(rules)) {
    if (keys.some(k => m.includes(k))) return cat;
  }
  return 'Other';
}

/* ============================================================
   ANDROID BRIDGE INTEGRATION
   ============================================================ */
function isAndroid() {
  return typeof window.AndroidBridge !== 'undefined';
}

function syncPendingSms() {
  if (!isAndroid()) return;
  try {
    const json  = window.AndroidBridge.getPendingSms();
    const items = JSON.parse(json || '[]');
    if (!items.length) return;

    let added = 0;
    for (const item of items) {
      if (!item.amount || item.amount <= 0) continue;
      const dup = expenses.some(e =>
        Math.abs(e.amount - item.amount) < 0.01 &&
        e.date === item.date &&
        e.description === item.merchant
      );
      if (dup) continue;

      expenses.push({
        id: uid(),
        amount: item.amount,
        category: item.category || 'Other',
        date: item.date,
        paymentMethod: 'UPI',
        description: item.merchant || 'SMS import'
      });
      added++;
    }
    if (added > 0) {
      saveData();
      renderAll();
      toast(`✅ ${added} expense(s) auto-added from SMS`);
    }
  } catch (err) {
    console.error('SMS sync error:', err);
  }
}

function scanHistoricalSms() {
  if (!isAndroid()) {
    toast('SMS scanning works only in the Android app.');
    return;
  }
  if (!confirm('Scan recent SMS for bank transactions? (up to 500 most recent)')) return;

  try {
    const json  = window.AndroidBridge.scanHistoricalSms();
    const items = JSON.parse(json || '[]');
    if (!items.length) { toast('No bank transactions found.'); return; }

    let added = 0;
    for (const item of items) {
      const dup = expenses.some(e =>
        Math.abs(e.amount - item.amount) < 0.01 &&
        e.date === item.date &&
        e.description === item.merchant
      );
      if (dup) continue;
      expenses.push({
        id: uid(),
        amount: item.amount,
        category: item.category || 'Other',
        date: item.date,
        paymentMethod: 'UPI',
        description: item.merchant || 'SMS import'
      });
      added++;
    }
    saveData();
    renderAll();
    toast(`✅ ${added} expense(s) imported from SMS history`);
  } catch (err) {
    console.error('Historical scan error:', err);
  }
}

// Android calls this in onResume()
window.onAndroidResume = function () { syncPendingSms(); };

/* Toast */
function toast(msg) {
  const el = document.createElement('div');
  el.className = 'toast';
  el.textContent = msg;
  document.body.appendChild(el);
  requestAnimationFrame(() => el.classList.add('show'));
  setTimeout(() => {
    el.classList.remove('show');
    setTimeout(() => el.remove(), 300);
  }, 3200);
}

/* ============================================================
   CSV IMPORT LOGIC (Drop & Browse)
   ============================================================ */
function initCsvImport() {
  var dropZone = document.getElementById('dropZone');
  var fileInput = document.getElementById('csvFile');
  if (!dropZone || !fileInput) return;

  // 1. Click to browse
  dropZone.addEventListener('click', function() {
    fileInput.click();
  });

  // 2. File selected via Browse
  fileInput.addEventListener('change', function(e) {
    if (e.target.files.length > 0) {
      processCsvFile(e.target.files[0]);
    }
  });

  // 3. Drag and Drop functionality
  dropZone.addEventListener('dragover', function(e) {
    e.preventDefault();
    dropZone.style.borderColor = 'var(--primary)';
    dropZone.style.background = 'var(--primary-light)';
  });

  dropZone.addEventListener('dragleave', function(e) {
    e.preventDefault();
    dropZone.style.borderColor = '#cbd5e1';
    dropZone.style.background = '#f8fafc';
  });

  dropZone.addEventListener('drop', function(e) {
    e.preventDefault();
    dropZone.style.borderColor = '#cbd5e1';
    dropZone.style.background = '#f8fafc';
    if (e.dataTransfer.files.length > 0) {
      processCsvFile(e.dataTransfer.files[0]);
    }
  });
}

function processCsvFile(file) {
  if (!file.name.endsWith('.csv')) {
    alert('Bhai sirf .csv file daalo!');
    return;
  }
  
  var reader = new FileReader();
  reader.onload = function(e) {
    var text = e.target.result;
    var lines = text.split('\n');
    var addedCount = 0;

    for (var i = 0; i < lines.length; i++) {
      var line = lines[i].trim();
      if (!line) continue;
      
      var lowerLine = line.toLowerCase();
      // Header line skip karo
      if (i === 0 && (lowerLine.includes('date') || lowerLine.includes('amount'))) continue;

      // CSV ko comma se tod do
      var parts = line.split(',');
      if (parts.length >= 2) {
        var date = parts[0].trim().replace(/"/g, '');
        // Amount me se koi bhi symbol hata kar sirf number rakho
        var amount = parseFloat(parts[1].trim().replace(/[^0-9.]/g, '')); 
        var desc = parts[2] ? parts[2].trim().replace(/"/g, '') : 'Imported Record';

        if (!isNaN(amount) && amount > 0) {
          // Expense add karo
          expenses.push({
            id: uid(),
            amount: amount,
            category: 'Other', 
            date: date || todayISO(),
            paymentMethod: 'CSV Import',
            description: desc
          });
          addedCount++;
        }
      }
    }

    if (addedCount > 0) {
      saveData();
      renderAll();
      toast('✅ ' + addedCount + ' records import ho gaye!');
    } else {
      alert('Format galat hai. CSV me (Date, Amount, Description) hone chahiye.');
    }
  };
  reader.readAsText(file);
}