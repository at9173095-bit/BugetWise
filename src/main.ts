import './index.css';
import {
  EXPENSE_CATEGORIES,
  PAYMENT_METHODS,
  BUDGET_CATEGORIES,
  Expense,
  MonthlyBudget,
  SavingsGoal,
  UserSettings,
  ChatMessage,
  ExpenseCategory,
  PaymentMethod,
} from './types';
import {
  ensureInitialized,
  getExpenses,
  saveExpense,
  updateExpense,
  deleteExpense,
  getBudget,
  getBudgets,
  saveBudget,
  calculateMonthlyTotal,
  calculateCategoryTotal,
  calculatePlannedExpenses,
  calculateRemainingBudget,
  calculateSavings,
  calculateDailySpending,
  getSavingsGoals,
  saveSavingsGoal,
  updateSavingsGoal,
  deleteSavingsGoal,
  addMoneyToGoal,
  getSettings,
  saveSettings,
  getNotifications,
  markNotificationsRead,
  formatCurrency,
  loadDemoData,
  clearAllData,
  exportDataJSON,
  exportDataCSV,
  importDataJSON,
} from './storage';
import {
  renderDailyLineChart,
  renderCategoryDoughnutChart,
  renderBudgetVsActualChart,
  renderMonthlyComparisonChart,
  getCategoryColor,
} from './charts';
import {
  handleUserChatMessage,
  generateSmartInsights,
  resetWizardState,
} from './aiAssistant';

// Global state
let currentView = 'dashboard';
let currentMonth = '2026-10'; // Matching prompt baseline
let selectedDailyDate = '2026-10-02';
let chatHistory: ChatMessage[] = [];

// Initialize demo data if not yet present
ensureInitialized();

// Apply user theme on load
function initTheme(): void {
  const settings = getSettings();
  if (settings.theme === 'dark') {
    document.documentElement.classList.add('dark');
  } else {
    document.documentElement.classList.remove('dark');
  }
}

// Show a clean toast notification
function showToast(message: string, type: 'success' | 'error' | 'info' = 'success'): void {
  const container = document.getElementById('toast-container');
  if (!container) return;

  const toast = document.createElement('div');
  const bgClass =
    type === 'success'
      ? 'bg-emerald-600 text-white'
      : type === 'error'
      ? 'bg-rose-600 text-white'
      : 'bg-slate-800 text-white';

  toast.className = `${bgClass} px-4 py-2.5 rounded-xl shadow-lg text-xs font-semibold flex items-center gap-2 pointer-events-auto transform transition-all duration-200 animate-slide-up`;
  toast.innerHTML = `
    <span>${type === 'success' ? '✓' : type === 'error' ? '✕' : 'ℹ'}</span>
    <span>${message}</span>
  `;

  container.appendChild(toast);
  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateY(-10px)';
    setTimeout(() => toast.remove(), 200);
  }, 3000);
}

// -----------------------------------------------------------------
// VIEW NAVIGATION
// -----------------------------------------------------------------
function switchView(viewName: string): void {
  currentView = viewName;

  // Hide all views
  const views = [
    'dashboard',
    'expenses',
    'budget',
    'daily',
    'analytics',
    'goals',
    'assistant',
    'settings',
  ];

  views.forEach((v) => {
    const el = document.getElementById(`view-${v}`);
    if (el) {
      if (v === viewName) {
        el.classList.remove('hidden');
      } else {
        el.classList.add('hidden');
      }
    }
  });

  // Update nav active states
  document.querySelectorAll('.nav-item').forEach((item) => {
    const navTarget = item.getAttribute('data-nav');
    if (navTarget === viewName) {
      item.className =
        'nav-item w-full flex items-center gap-3 px-3.5 py-2.5 rounded-lg text-sm font-medium transition-colors text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40';
    } else {
      item.className =
        'nav-item w-full flex items-center gap-3 px-3.5 py-2.5 rounded-lg text-sm font-medium transition-colors text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-white';
    }
  });

  // Update header title
  const headerTitle = document.getElementById('current-view-title');
  if (headerTitle) {
    headerTitle.textContent =
      viewName === 'goals'
        ? 'Savings Goals'
        : viewName === 'daily'
        ? 'Daily Spending'
        : viewName === 'budget'
        ? 'Monthly Budget'
        : viewName === 'assistant'
        ? 'AI Budget Assistant'
        : viewName.charAt(0).toUpperCase() + viewName.slice(1);
  }

  // Refresh target view data
  refreshCurrentView();

  // Close mobile sidebar if open
  closeMobileSidebar();
}

function refreshCurrentView(): void {
  updateDashboard();
  if (currentView === 'expenses') renderExpensesTable();
  if (currentView === 'budget') renderBudgetSection();
  if (currentView === 'daily') renderDailySection();
  if (currentView === 'analytics') renderAnalyticsSection();
  if (currentView === 'goals') renderSavingsGoalsSection();
  if (currentView === 'assistant') renderFullAssistantMessages();
  if (currentView === 'settings') renderSettingsSection();
  renderNotificationsPopover();
}

// -----------------------------------------------------------------
// SECTION 2: DASHBOARD LOGIC
// -----------------------------------------------------------------
export function updateDashboard(): void {
  const budget = getBudget(currentMonth);
  const totalPlanned = budget ? calculatePlannedExpenses(budget) : 25000;
  const totalSpent = calculateMonthlyTotal(currentMonth);
  const remaining = totalPlanned - totalSpent;
  const todaySpent = calculateDailySpending('2026-10-02');
  const savings = budget ? Number(budget.income) - totalSpent : remaining;

  // Stat Elements
  const elBudget = document.getElementById('stat-monthly-budget');
  const elSpent = document.getElementById('stat-total-spent');
  const elSpentPct = document.getElementById('stat-spent-pct');
  const elRemaining = document.getElementById('stat-remaining');
  const elRemainingStatus = document.getElementById('stat-remaining-status');
  const elTodaySpent = document.getElementById('stat-today-spent');
  const elTodayTxns = document.getElementById('stat-today-txns');
  const elSavings = document.getElementById('stat-savings');

  if (elBudget) elBudget.textContent = formatCurrency(totalPlanned);
  if (elSpent) elSpent.textContent = formatCurrency(totalSpent);

  const spentPct = totalPlanned > 0 ? (totalSpent / totalPlanned) * 100 : 0;
  if (elSpentPct) elSpentPct.textContent = `${Math.round(spentPct)}% of monthly budget`;

  if (elRemaining) elRemaining.textContent = formatCurrency(remaining);

  // Status label
  let statusText = 'Safe · On Track';
  let statusClass = 'text-emerald-600 dark:text-emerald-400';
  let badgeBg = 'bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-400';
  let barBg = 'bg-emerald-500';

  if (spentPct >= 100) {
    statusText = 'Over Budget';
    statusClass = 'text-rose-600 dark:text-rose-400';
    badgeBg = 'bg-rose-100 dark:bg-rose-950 text-rose-700 dark:text-rose-400';
    barBg = 'bg-rose-500';
  } else if (spentPct >= 75) {
    statusText = 'Near Limit';
    statusClass = 'text-amber-600 dark:text-amber-400';
    badgeBg = 'bg-amber-100 dark:bg-amber-950 text-amber-700 dark:text-amber-400';
    barBg = 'bg-amber-500';
  }

  if (elRemainingStatus) {
    elRemainingStatus.textContent = statusText;
    elRemainingStatus.className = `text-[11px] font-semibold mt-1 ${statusClass}`;
  }

  if (elTodaySpent) elTodaySpent.textContent = formatCurrency(todaySpent);

  const todayTxnsCount = getExpenses().filter((e) => e.date === '2026-10-02').length;
  if (elTodayTxns) elTodayTxns.textContent = `${todayTxnsCount} transactions today`;

  if (elSavings) elSavings.textContent = formatCurrency(savings);

  // Budget Progress Bar
  const dashBar = document.getElementById('dash-budget-progress-bar');
  const dashPctText = document.getElementById('dash-budget-pct-text');
  const dashBadge = document.getElementById('dash-budget-status-badge');
  const dashSpentInline = document.getElementById('dash-spent-inline');
  const dashRemainingInline = document.getElementById('dash-remaining-inline');
  const dashBudgetInline = document.getElementById('dash-budget-inline');

  const clampedWidth = Math.min(100, Math.max(0, spentPct));
  if (dashBar) {
    dashBar.style.width = `${clampedWidth}%`;
    dashBar.className = `${barBg} h-full rounded-full transition-all duration-300`;
  }
  if (dashPctText) dashPctText.textContent = `${spentPct.toFixed(1)}% Used`;
  if (dashBadge) {
    dashBadge.textContent = statusText;
    dashBadge.className = `ml-2 text-xs font-semibold px-2 py-0.5 rounded ${badgeBg}`;
  }
  if (dashSpentInline) dashSpentInline.textContent = formatCurrency(totalSpent);
  if (dashRemainingInline) dashRemainingInline.textContent = formatCurrency(remaining);
  if (dashBudgetInline) dashBudgetInline.textContent = formatCurrency(totalPlanned);

  // Sidebar mini-widget sync
  const sideBar = document.getElementById('sidebar-progress-bar');
  const sideStatus = document.getElementById('sidebar-budget-status');
  const sideRemaining = document.getElementById('sidebar-remaining-val');
  if (sideBar) {
    sideBar.style.width = `${clampedWidth}%`;
    sideBar.className = `${barBg} h-full rounded-full transition-all duration-300`;
  }
  if (sideStatus) {
    sideStatus.textContent = statusText;
    sideStatus.className = `font-semibold ${statusClass}`;
  }
  if (sideRemaining) sideRemaining.textContent = formatCurrency(remaining);

  // Smart insight line on dashboard
  const insightLine = document.getElementById('dashboard-smart-insight-line');
  if (insightLine) {
    const insights = generateSmartInsights(currentMonth);
    insightLine.innerHTML = insights[0] || '<span>💡 Track daily expenses for smart insights.</span>';
  }

  // Dashboard Charts
  renderDashboardCharts();

  // Recent Transactions on Dashboard
  renderDashboardRecentTransactions();

  // Goals mini snapshot
  renderDashboardGoals();
}

function renderDashboardCharts(): void {
  // 1. Daily trend chart
  const dailyContainer = document.getElementById('dash-daily-chart-container');
  if (dailyContainer) {
    const expenses = getExpenses().filter((e) => e.date.startsWith(currentMonth));
    // Aggregate by day of current month (e.g. 1 to 14)
    const daysMap: Record<string, number> = {};
    for (let day = 1; day <= 10; day++) {
      const dStr = `${currentMonth}-${day.toString().padStart(2, '0')}`;
      daysMap[dStr] = 0;
    }
    expenses.forEach((e) => {
      if (daysMap[e.date] !== undefined) {
        daysMap[e.date] += Number(e.amount);
      } else {
        daysMap[e.date] = Number(e.amount);
      }
    });

    const chartData = Object.entries(daysMap)
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([date, amount]) => ({
        date,
        label: date.substring(8),
        amount,
      }));

    renderDailyLineChart(dailyContainer, chartData);
  }

  // 2. Category Doughnut
  const categoryContainer = document.getElementById('dash-category-chart-container');
  if (categoryContainer) {
    const catData = EXPENSE_CATEGORIES.map((cat) => ({
      category: cat,
      amount: calculateCategoryTotal(currentMonth, cat),
    }));
    renderCategoryDoughnutChart(categoryContainer, catData);
  }
}

function renderDashboardRecentTransactions(): void {
  const tbody = document.getElementById('dash-recent-txns-tbody');
  if (!tbody) return;

  const expenses = getExpenses()
    .filter((e) => e.date.startsWith(currentMonth))
    .slice(0, 5);

  if (expenses.length === 0) {
    tbody.innerHTML = `<tr><td colspan="6" class="py-6 text-center text-slate-400">No expenses recorded yet. Click "Add Expense" to log your first transaction.</td></tr>`;
    return;
  }

  tbody.innerHTML = expenses
    .map(
      (e) => `
      <tr class="hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors">
        <td class="py-2.5 px-3 text-slate-500 whitespace-nowrap font-mono">${e.date}</td>
        <td class="py-2.5 px-3 font-medium text-slate-900 dark:text-white">${escapeHtml(e.description)}</td>
        <td class="py-2.5 px-3">
          <span class="inline-flex items-center gap-1.5 text-slate-700 dark:text-slate-300">
            <span class="w-2 h-2 rounded-full" style="background-color: ${getCategoryColor(e.category)}"></span>
            ${e.category}
          </span>
        </td>
        <td class="py-2.5 px-3 text-slate-500 whitespace-nowrap">${e.paymentMethod}</td>
        <td class="py-2.5 px-3 text-right font-bold text-slate-900 dark:text-white tabular-nums font-mono">${formatCurrency(e.amount)}</td>
        <td class="py-2.5 px-3 text-right whitespace-nowrap">
          <button data-action="edit-expense" data-id="${e.id}" class="text-slate-400 hover:text-emerald-600 mr-2 p-1" title="Edit">
            <svg class="w-3.5 h-3.5 inline" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/></svg>
          </button>
          <button data-action="delete-expense" data-id="${e.id}" class="text-slate-400 hover:text-rose-600 p-1" title="Delete">
            <svg class="w-3.5 h-3.5 inline" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>
          </button>
        </td>
      </tr>
    `
    )
    .join('');
}

function renderDashboardGoals(): void {
  const container = document.getElementById('dash-goals-list');
  if (!container) return;

  const goals = getSavingsGoals().slice(0, 3);
  if (goals.length === 0) {
    container.innerHTML = `<div class="text-center py-6 text-slate-400 text-xs">No savings goals yet. Create one to build wealth.</div>`;
    return;
  }

  container.innerHTML = goals
    .map((g) => {
      const pct = Math.min(100, Math.round((g.currentAmount / g.targetAmount) * 100));
      return `
      <div class="p-3 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-100 dark:border-slate-800">
        <div class="flex items-center justify-between text-xs mb-1">
          <span class="font-bold text-slate-800 dark:text-slate-200 truncate max-w-[140px]">${escapeHtml(g.title)}</span>
          <span class="font-bold text-emerald-600 dark:text-emerald-400 tabular-nums">${pct}%</span>
        </div>
        <div class="w-full bg-slate-200 dark:bg-slate-700 h-1.5 rounded-full overflow-hidden mb-2">
          <div class="bg-emerald-500 h-full rounded-full transition-all" style="width: ${pct}%"></div>
        </div>
        <div class="flex items-center justify-between text-[11px] text-slate-500 tabular-nums font-mono">
          <span>${formatCurrency(g.currentAmount)}</span>
          <span class="text-slate-400">of ${formatCurrency(g.targetAmount)}</span>
        </div>
      </div>
    `;
    })
    .join('');
}

// -----------------------------------------------------------------
// SECTION 4: TRANSACTIONS & EXPENSES VIEW
// -----------------------------------------------------------------
function renderExpensesTable(): void {
  const tbody = document.getElementById('txns-full-tbody');
  const emptyState = document.getElementById('txns-empty-state');
  const countEl = document.getElementById('txns-filtered-count');
  const totalEl = document.getElementById('txns-filtered-total');

  if (!tbody) return;

  const searchInput = (document.getElementById('txn-search') as HTMLInputElement)?.value.toLowerCase() || '';
  const catFilter = (document.getElementById('txn-filter-category') as HTMLSelectElement)?.value || '';
  const methodFilter = (document.getElementById('txn-filter-method') as HTMLSelectElement)?.value || '';
  const sortBy = (document.getElementById('txn-sort-by') as HTMLSelectElement)?.value || 'date-desc';

  let expenses = getExpenses();

  // Search filter
  if (searchInput) {
    expenses = expenses.filter(
      (e) =>
        e.description.toLowerCase().includes(searchInput) ||
        e.category.toLowerCase().includes(searchInput) ||
        (e.note && e.note.toLowerCase().includes(searchInput))
    );
  }

  // Category filter
  if (catFilter) {
    expenses = expenses.filter((e) => e.category === catFilter);
  }

  // Method filter
  if (methodFilter) {
    expenses = expenses.filter((e) => e.paymentMethod === methodFilter);
  }

  // Sorting
  expenses.sort((a, b) => {
    if (sortBy === 'date-desc') return b.date.localeCompare(a.date) || b.id.localeCompare(a.id);
    if (sortBy === 'date-asc') return a.date.localeCompare(b.date) || a.id.localeCompare(b.id);
    if (sortBy === 'amount-desc') return Number(b.amount) - Number(a.amount);
    if (sortBy === 'amount-asc') return Number(a.amount) - Number(b.amount);
    return 0;
  });

  const totalFiltered = expenses.reduce((sum, e) => sum + Number(e.amount), 0);
  if (countEl) countEl.textContent = expenses.length.toString();
  if (totalEl) totalEl.textContent = formatCurrency(totalFiltered);

  if (expenses.length === 0) {
    tbody.innerHTML = '';
    if (emptyState) emptyState.classList.remove('hidden');
    return;
  }

  if (emptyState) emptyState.classList.add('hidden');

  tbody.innerHTML = expenses
    .map(
      (e) => `
    <tr class="hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors">
      <td class="py-3 px-4 text-slate-500 whitespace-nowrap font-mono">${e.date}</td>
      <td class="py-3 px-4">
        <div class="font-medium text-slate-900 dark:text-white">${escapeHtml(e.description)}</div>
        ${e.note ? `<div class="text-[11px] text-slate-400 mt-0.5 truncate max-w-xs">${escapeHtml(e.note)}</div>` : ''}
      </td>
      <td class="py-3 px-4">
        <span class="inline-flex items-center gap-1.5 text-slate-700 dark:text-slate-300">
          <span class="w-2.5 h-2.5 rounded-full" style="background-color: ${getCategoryColor(e.category)}"></span>
          ${e.category}
        </span>
      </td>
      <td class="py-3 px-4 text-slate-500 whitespace-nowrap">${e.paymentMethod}</td>
      <td class="py-3 px-4 text-right font-bold text-slate-900 dark:text-white tabular-nums font-mono">${formatCurrency(e.amount)}</td>
      <td class="py-3 px-4 text-right whitespace-nowrap">
        <button data-action="edit-expense" data-id="${e.id}" class="text-slate-400 hover:text-emerald-600 mr-3 p-1 inline-flex items-center gap-1 text-xs">
          <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/></svg>
          Edit
        </button>
        <button data-action="delete-expense" data-id="${e.id}" class="text-slate-400 hover:text-rose-600 p-1 inline-flex items-center gap-1 text-xs">
          <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>
          Delete
        </button>
      </td>
    </tr>
  `
    )
    .join('');
}

// -----------------------------------------------------------------
// SECTION 5 & 6: MONTHLY BUDGET CREATION & TRACKING
// -----------------------------------------------------------------
function renderBudgetSection(): void {
  const budget = getBudget(currentMonth);
  const incomeInput = document.getElementById('budget-income-input') as HTMLInputElement;
  const plannedValEl = document.getElementById('budget-total-planned-val');
  const plannedPctEl = document.getElementById('budget-planned-pct');
  const remainingValEl = document.getElementById('budget-remaining-income-val');
  const remainingStatusEl = document.getElementById('budget-remaining-status');
  const warningBanner = document.getElementById('budget-over-income-warning');
  const warningText = document.getElementById('budget-over-income-text');
  const tbody = document.getElementById('budget-tracking-tbody');

  if (!tbody) return;

  const income = budget ? Number(budget.income) : 35000;
  if (incomeInput) incomeInput.value = income.toString();

  const categoryBudgets: Record<string, number> = budget?.categoryBudgets || {
    Food: 3500,
    Transport: 1500,
    Education: 2000,
    Bills: 13500,
    Shopping: 1500,
    Entertainment: 800,
    Health: 1200,
    Family: 1000,
    Savings: 2000,
    Other: 0,
  };

  const totalPlanned = Object.values(categoryBudgets).reduce((sum, v) => sum + (Number(v) || 0), 0);
  const remainingIncome = income - totalPlanned;
  const plannedPct = income > 0 ? (totalPlanned / income) * 100 : 0;

  if (plannedValEl) plannedValEl.textContent = formatCurrency(totalPlanned);
  if (plannedPctEl) plannedPctEl.textContent = `${plannedPct.toFixed(1)}% of income`;

  if (remainingValEl) {
    remainingValEl.textContent = formatCurrency(remainingIncome);
    if (remainingIncome >= 0) {
      remainingValEl.className = 'text-lg font-bold text-emerald-600 dark:text-emerald-400 tabular-nums font-mono mt-0.5';
    } else {
      remainingValEl.className = 'text-lg font-bold text-rose-600 dark:text-rose-400 tabular-nums font-mono mt-0.5';
    }
  }

  // Section 5: Warning if planned expenses exceed income
  if (totalPlanned > income) {
    const diff = totalPlanned - income;
    if (warningBanner && warningText) {
      warningBanner.classList.remove('hidden');
      warningText.textContent = `“Your planned expenses exceed your monthly income by ${formatCurrency(diff)}.”`;
    }
    if (remainingStatusEl) {
      remainingStatusEl.textContent = 'Deficit: Planned exceeds income';
      remainingStatusEl.className = 'text-[11px] text-rose-600 dark:text-rose-400 font-semibold';
    }
  } else {
    if (warningBanner) warningBanner.classList.add('hidden');
    if (remainingStatusEl) {
      remainingStatusEl.textContent = 'Balanced budget';
      remainingStatusEl.className = 'text-[11px] text-emerald-600 dark:text-emerald-400 font-semibold';
    }
  }

  // Category rows
  tbody.innerHTML = BUDGET_CATEGORIES.map((cat) => {
    const planned = categoryBudgets[cat] !== undefined ? categoryBudgets[cat] : 0;
    const spent = cat === 'Savings' ? 0 : calculateCategoryTotal(currentMonth, cat);
    const rem = planned - spent;
    const pct = planned > 0 ? (spent / planned) * 100 : 0;

    let status = 'Safe';
    let statusClass = 'bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-400';
    let barColor = 'bg-emerald-500';

    if (cat !== 'Savings') {
      if (pct >= 100) {
        status = 'Over Budget';
        statusClass = 'bg-rose-100 dark:bg-rose-950 text-rose-700 dark:text-rose-400';
        barColor = 'bg-rose-500';
      } else if (pct >= 75) {
        status = 'Near Limit';
        statusClass = 'bg-amber-100 dark:bg-amber-950 text-amber-700 dark:text-amber-400';
        barColor = 'bg-amber-500';
      }
    } else {
      status = 'Planned Goal';
      statusClass = 'bg-indigo-100 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-400';
      barColor = 'bg-indigo-500';
    }

    return `
      <tr class="hover:bg-slate-50/60 dark:hover:bg-slate-800/30 transition-colors">
        <td class="py-3 px-4">
          <div class="flex items-center gap-2">
            <span class="w-3 h-3 rounded-full shrink-0" style="background-color: ${getCategoryColor(cat)}"></span>
            <span class="font-bold text-slate-800 dark:text-slate-200">${cat}</span>
          </div>
        </td>
        <td class="py-3 px-4">
          <div class="relative max-w-[120px]">
            <span class="absolute left-2.5 top-1.5 text-xs text-slate-400 font-mono">₹</span>
            <input type="number" data-category="${cat}" value="${planned}" min="0" step="100" class="budget-cat-input w-full text-xs font-semibold pl-6 pr-2 py-1.5 rounded-lg bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white tabular-nums font-mono focus:ring-1 focus:ring-emerald-500" />
          </div>
        </td>
        <td class="py-3 px-4 text-right font-semibold text-slate-700 dark:text-slate-300 tabular-nums font-mono">${formatCurrency(spent)}</td>
        <td class="py-3 px-4 text-right font-bold ${rem < 0 ? 'text-rose-600' : 'text-emerald-600 dark:text-emerald-400'} tabular-nums font-mono">${formatCurrency(rem)}</td>
        <td class="py-3 px-4">
          <div class="flex items-center gap-2">
            <div class="flex-1 bg-slate-100 dark:bg-slate-800 h-2 rounded-full overflow-hidden">
              <div class="${barColor} h-full rounded-full transition-all" style="width: ${Math.min(100, Math.max(0, pct))}%"></div>
            </div>
            <span class="text-[11px] text-slate-400 tabular-nums w-8 text-right">${Math.round(pct)}%</span>
          </div>
        </td>
        <td class="py-3 px-4 text-center">
          <span class="text-[11px] font-semibold px-2 py-0.5 rounded ${statusClass} whitespace-nowrap">
            ${status}
          </span>
        </td>
      </tr>
    `;
  }).join('');

  // Attach live calculation to inputs
  document.querySelectorAll('.budget-cat-input').forEach((input) => {
    input.addEventListener('input', () => {
      recalcBudgetHeader();
    });
  });
}

function recalcBudgetHeader(): void {
  const incomeInput = document.getElementById('budget-income-input') as HTMLInputElement;
  const income = Number(incomeInput?.value) || 0;

  let totalPlanned = 0;
  document.querySelectorAll('.budget-cat-input').forEach((input) => {
    totalPlanned += Number((input as HTMLInputElement).value) || 0;
  });

  const plannedValEl = document.getElementById('budget-total-planned-val');
  const remainingValEl = document.getElementById('budget-remaining-income-val');
  const warningBanner = document.getElementById('budget-over-income-warning');
  const warningText = document.getElementById('budget-over-income-text');

  if (plannedValEl) plannedValEl.textContent = formatCurrency(totalPlanned);

  const diff = income - totalPlanned;
  if (remainingValEl) {
    remainingValEl.textContent = formatCurrency(diff);
    remainingValEl.className = diff >= 0 ? 'text-lg font-bold text-emerald-600 tabular-nums font-mono mt-0.5' : 'text-lg font-bold text-rose-600 tabular-nums font-mono mt-0.5';
  }

  if (totalPlanned > income) {
    if (warningBanner && warningText) {
      warningBanner.classList.remove('hidden');
      warningText.textContent = `“Your planned expenses exceed your monthly income by ${formatCurrency(Math.abs(diff))}.”`;
    }
  } else {
    if (warningBanner) warningBanner.classList.add('hidden');
  }
}

// -----------------------------------------------------------------
// SECTION 7: DAILY SPENDING
// -----------------------------------------------------------------
function renderDailySection(): void {
  const dateInput = document.getElementById('daily-picker-input') as HTMLInputElement;
  if (dateInput && !dateInput.value) dateInput.value = selectedDailyDate;
  const targetDate = dateInput ? dateInput.value : selectedDailyDate;

  // Selected date stats
  const selectedSpent = calculateDailySpending(targetDate);
  const yesterdayDate = getPreviousDay(targetDate);
  const yesterdaySpent = calculateDailySpending(yesterdayDate);

  // Month-wide daily stats
  const expenses = getExpenses().filter((e) => e.date.startsWith(targetDate.substring(0, 7)));
  const dayGroups: Record<string, number> = {};
  expenses.forEach((e) => {
    dayGroups[e.date] = (dayGroups[e.date] || 0) + Number(e.amount);
  });

  const activeDays = Object.keys(dayGroups).length;
  const totalMonthSpent = Object.values(dayGroups).reduce((a, b) => a + b, 0);
  const avgDaily = activeDays > 0 ? Math.round(totalMonthSpent / activeDays) : 0;

  // Highest day
  let highestDate = 'None';
  let highestVal = 0;
  Object.entries(dayGroups).forEach(([date, amt]) => {
    if (amt > highestVal) {
      highestVal = amt;
      highestDate = date;
    }
  });

  const txnsOnSelected = expenses.filter((e) => e.date === targetDate);

  // DOM Elements
  const elSelected = document.getElementById('daily-selected-total');
  const elSelectedDate = document.getElementById('daily-selected-date-label');
  const elYesterday = document.getElementById('daily-yesterday-total');
  const elAvg = document.getElementById('daily-avg-total');
  const elHighestVal = document.getElementById('daily-highest-val');
  const elHighestDate = document.getElementById('daily-highest-date');
  const elTxnCount = document.getElementById('daily-txns-count');
  const elSectionTitle = document.getElementById('daily-txns-section-title');
  const tbody = document.getElementById('daily-txns-tbody');

  if (elSelected) elSelected.textContent = formatCurrency(selectedSpent);
  if (elSelectedDate) elSelectedDate.textContent = formatDateLabel(targetDate);
  if (elYesterday) elYesterday.textContent = formatCurrency(yesterdaySpent);
  if (elAvg) elAvg.textContent = formatCurrency(avgDaily);
  if (elHighestVal) elHighestVal.textContent = formatCurrency(highestVal);
  if (elHighestDate) elHighestDate.textContent = highestDate;
  if (elTxnCount) elTxnCount.textContent = txnsOnSelected.length.toString();
  if (elSectionTitle) elSectionTitle.textContent = `Expenses on ${formatDateLabel(targetDate)}`;

  // Daily Chart
  const chartContainer = document.getElementById('daily-view-chart-container');
  if (chartContainer) {
    const chartData = Object.entries(dayGroups)
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([date, amount]) => ({
        date,
        label: date.substring(8),
        amount,
      }));
    renderDailyLineChart(chartContainer, chartData);
  }

  // Transactions list for selected day
  if (tbody) {
    if (txnsOnSelected.length === 0) {
      tbody.innerHTML = `<tr><td colspan="5" class="py-6 text-center text-slate-400">No expenses recorded on ${formatDateLabel(targetDate)}.</td></tr>`;
    } else {
      tbody.innerHTML = txnsOnSelected
        .map(
          (e) => `
        <tr class="hover:bg-slate-50/60 dark:hover:bg-slate-800/40 transition-colors">
          <td class="py-2.5 px-3 font-medium text-slate-900 dark:text-white">${escapeHtml(e.description)}</td>
          <td class="py-2.5 px-3">
            <span class="inline-flex items-center gap-1.5 text-slate-700 dark:text-slate-300">
              <span class="w-2 h-2 rounded-full" style="background-color: ${getCategoryColor(e.category)}"></span>
              ${e.category}
            </span>
          </td>
          <td class="py-2.5 px-3 text-slate-500">${e.paymentMethod}</td>
          <td class="py-2.5 px-3 text-right font-bold text-slate-900 dark:text-white tabular-nums font-mono">${formatCurrency(e.amount)}</td>
          <td class="py-2.5 px-3 text-right whitespace-nowrap">
            <button data-action="edit-expense" data-id="${e.id}" class="text-slate-400 hover:text-emerald-600 mr-2 p-1" title="Edit">
              <svg class="w-3.5 h-3.5 inline" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/></svg>
            </button>
            <button data-action="delete-expense" data-id="${e.id}" class="text-slate-400 hover:text-rose-600 p-1" title="Delete">
              <svg class="w-3.5 h-3.5 inline" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>
            </button>
          </td>
        </tr>
      `
        )
        .join('');
    }
  }
}

// -----------------------------------------------------------------
// SECTION 8: MONTHLY ANALYTICS (4 CHARTS)
// -----------------------------------------------------------------
function renderAnalyticsSection(): void {
  const budget = getBudget(currentMonth);
  const income = budget ? Number(budget.income) : 35000;
  const expensesTotal = calculateMonthlyTotal(currentMonth);
  const remaining = income - expensesTotal;
  const plannedBudget = budget ? calculatePlannedExpenses(budget) : 25000;
  const utilization = plannedBudget > 0 ? (expensesTotal / plannedBudget) * 100 : 0;

  // Cat totals
  const expenses = getExpenses().filter((e) => e.date.startsWith(currentMonth));
  const catTotals: Record<string, number> = {};
  expenses.forEach((e) => {
    catTotals[e.category] = (catTotals[e.category] || 0) + Number(e.amount);
  });

  const sortedCats = Object.entries(catTotals).sort((a, b) => b[1] - a[1]);
  const highest = sortedCats[0];
  const lowest = sortedCats.length > 0 ? sortedCats[sortedCats.length - 1] : null;

  const activeDays = new Set(expenses.map((e) => e.date)).size;
  const avgDaily = activeDays > 0 ? Math.round(expensesTotal / activeDays) : 0;

  // Metrics DOM
  const elInc = document.getElementById('analytics-income');
  const elExp = document.getElementById('analytics-expenses');
  const elRem = document.getElementById('analytics-remaining');
  const elUtz = document.getElementById('analytics-utilization');
  const elHigh = document.getElementById('analytics-highest-cat');
  const elLow = document.getElementById('analytics-lowest-cat');
  const elAvg = document.getElementById('analytics-avg-daily');

  if (elInc) elInc.textContent = formatCurrency(income);
  if (elExp) elExp.textContent = formatCurrency(expensesTotal);
  if (elRem) elRem.textContent = formatCurrency(remaining);
  if (elUtz) elUtz.textContent = `${utilization.toFixed(1)}%`;
  if (elHigh) elHigh.textContent = highest ? `${highest[0]} (${formatCurrency(highest[1])})` : 'None';
  if (elLow) elLow.textContent = lowest ? `${lowest[0]} (${formatCurrency(lowest[1])})` : 'None';
  if (elAvg) elAvg.textContent = formatCurrency(avgDaily);

  // Chart 1: Daily spending line chart
  const c1 = document.getElementById('analytics-chart-1');
  if (c1) {
    const dayGroups: Record<string, number> = {};
    for (let day = 1; day <= 10; day++) {
      const dStr = `${currentMonth}-${day.toString().padStart(2, '0')}`;
      dayGroups[dStr] = 0;
    }
    expenses.forEach((e) => {
      dayGroups[e.date] = (dayGroups[e.date] || 0) + Number(e.amount);
    });
    const c1Data = Object.entries(dayGroups)
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([date, amount]) => ({
        date,
        label: date.substring(8),
        amount,
      }));
    renderDailyLineChart(c1, c1Data);
  }

  // Chart 2: Category spending doughnut chart
  const c2 = document.getElementById('analytics-chart-2');
  if (c2) {
    const c2Data = EXPENSE_CATEGORIES.map((cat) => ({
      category: cat,
      amount: calculateCategoryTotal(currentMonth, cat),
    }));
    renderCategoryDoughnutChart(c2, c2Data);
  }

  // Chart 3: Budget vs actual spending bar chart
  const c3 = document.getElementById('analytics-chart-3');
  if (c3) {
    const catBudgets = budget?.categoryBudgets || {};
    const c3Data = EXPENSE_CATEGORIES.map((cat) => ({
      category: cat,
      planned: catBudgets[cat] || 0,
      spent: calculateCategoryTotal(currentMonth, cat),
    })).filter((d) => d.planned > 0 || d.spent > 0);
    renderBudgetVsActualChart(c3, c3Data);
  }

  // Chart 4: Monthly spending comparison
  const c4 = document.getElementById('analytics-chart-4');
  if (c4) {
    const budgets = getBudgets();
    const monthsData = budgets.slice(0, 3).map((b) => {
      const exp = calculateMonthlyTotal(b.month);
      const inc = Number(b.income) || 35000;
      return {
        monthLabel: b.month === '2026-10' ? 'Oct 2026' : b.month === '2026-09' ? 'Sep 2026' : b.month,
        income: inc,
        expenses: exp,
        savings: inc - exp,
      };
    });
    renderMonthlyComparisonChart(c4, monthsData);
  }

  // Smart Insights Feed (Section 12)
  const insightsFeed = document.getElementById('analytics-insights-feed');
  if (insightsFeed) {
    const insights = generateSmartInsights(currentMonth);
    insightsFeed.innerHTML = insights
      .map(
        (ins) => `
      <div class="p-3 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-100 dark:border-slate-800 text-xs text-slate-700 dark:text-slate-300">
        ${ins}
      </div>
    `
      )
      .join('');
  }
}

// -----------------------------------------------------------------
// SECTION 9: SAVINGS GOALS
// -----------------------------------------------------------------
function renderSavingsGoalsSection(): void {
  const container = document.getElementById('goals-cards-grid');
  if (!container) return;

  const goals = getSavingsGoals();

  if (goals.length === 0) {
    container.innerHTML = `
      <div class="col-span-full p-12 text-center bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800">
        <div class="text-3xl mb-2">🎯</div>
        <h3 class="text-sm font-bold text-slate-900 dark:text-white">No Savings Goals Yet</h3>
        <p class="text-xs text-slate-500 mt-1 max-w-sm mx-auto">Set a milestone like "New Laptop", "Emergency Fund", or "Vacation" to track your progress.</p>
        <button id="empty-create-goal-btn" class="mt-4 px-4 py-2 bg-emerald-600 text-white rounded-lg text-xs font-semibold hover:bg-emerald-700">Create Your First Goal</button>
      </div>
    `;
    const btn = document.getElementById('empty-create-goal-btn');
    if (btn) btn.addEventListener('click', () => openCreateGoalModal());
    return;
  }

  container.innerHTML = goals
    .map((g) => {
      const remaining = Math.max(0, g.targetAmount - g.currentAmount);
      const pct = Math.min(100, Math.round((g.currentAmount / g.targetAmount) * 100));
      const isComplete = pct >= 100;

      return `
      <div class="bg-white dark:bg-slate-900 p-5 rounded-2xl border ${isComplete ? 'border-emerald-500/40' : 'border-slate-200 dark:border-slate-800'} shadow-xs flex flex-col justify-between space-y-4">
        <div>
          <div class="flex items-center justify-between">
            <span class="text-xs font-semibold px-2 py-0.5 rounded ${isComplete ? 'bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-400' : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400'}">
              ${isComplete ? '✓ Goal Achieved' : g.category || 'General'}
            </span>
            <div class="flex items-center gap-1">
              <button data-action="edit-goal" data-id="${g.id}" class="text-slate-400 hover:text-slate-600 p-1" title="Edit">
                <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/></svg>
              </button>
              <button data-action="delete-goal" data-id="${g.id}" class="text-slate-400 hover:text-rose-600 p-1" title="Delete">
                <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>
              </button>
            </div>
          </div>

          <h3 class="text-base font-bold text-slate-900 dark:text-white mt-2">${escapeHtml(g.title)}</h3>
          ${g.notes ? `<p class="text-xs text-slate-400 mt-0.5 line-clamp-1">${escapeHtml(g.notes)}</p>` : ''}
        </div>

        <div>
          <!-- Progress Bar -->
          <div class="flex items-center justify-between text-xs mb-1.5">
            <span class="text-slate-500">Progress</span>
            <span class="font-bold text-slate-900 dark:text-white tabular-nums">${pct}%</span>
          </div>
          <div class="w-full bg-slate-100 dark:bg-slate-800 h-2.5 rounded-full overflow-hidden mb-3">
            <div class="bg-emerald-500 h-full rounded-full transition-all duration-300" style="width: ${pct}%"></div>
          </div>

          <!-- Target & Remaining -->
          <div class="grid grid-cols-3 gap-2 text-[11px] pt-2 border-t border-slate-100 dark:border-slate-800">
            <div>
              <span class="text-slate-400 block">Target</span>
              <span class="font-bold text-slate-800 dark:text-slate-200 tabular-nums font-mono">${formatCurrency(g.targetAmount)}</span>
            </div>
            <div>
              <span class="text-slate-400 block">Current</span>
              <span class="font-bold text-emerald-600 dark:text-emerald-400 tabular-nums font-mono">${formatCurrency(g.currentAmount)}</span>
            </div>
            <div class="text-right">
              <span class="text-slate-400 block">Remaining</span>
              <span class="font-bold text-slate-800 dark:text-slate-200 tabular-nums font-mono">${formatCurrency(remaining)}</span>
            </div>
          </div>
        </div>

        <button data-action="add-funds" data-id="${g.id}" data-title="${escapeHtml(g.title)}" class="w-full py-2 bg-emerald-50 dark:bg-emerald-950/50 hover:bg-emerald-100 text-emerald-700 dark:text-emerald-300 rounded-lg text-xs font-semibold transition border border-emerald-200 dark:border-emerald-800/60 flex items-center justify-center gap-1.5">
          <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4"/></svg>
          Add Money
        </button>
      </div>
    `;
    })
    .join('');
}

// -----------------------------------------------------------------
// SECTIONS 10 & 11: AI BUDGET ASSISTANT (CHATBOT & WIZARD)
// -----------------------------------------------------------------
function initChatbot(): void {
  // Initial greetings if chat history empty
  if (chatHistory.length === 0) {
    chatHistory.push({
      id: 'msg_welcome',
      sender: 'bot',
      text: `Hello! I am your **BudgetWise AI Assistant** 🤖.\n\nI can analyze your spending patterns, track limits, or help you craft a monthly budget.\n\nWhat would you like to explore today?`,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      quickReplies: [
        'How much have I spent this month?',
        'Where am I spending the most?',
        'How much budget is remaining?',
        'Help me create a monthly budget',
        'Analyze my spending',
      ],
    });
  }

  renderDrawerChat();
  renderFullAssistantMessages();
}

function sendUserMessage(text: string): void {
  if (!text.trim()) return;

  const userMsg: ChatMessage = {
    id: 'user_' + Date.now(),
    sender: 'user',
    text: text.trim(),
    timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
  };
  chatHistory.push(userMsg);
  renderDrawerChat();
  renderFullAssistantMessages();

  // Process through AI Assistant logic
  setTimeout(() => {
    // Check if user clicked apply budget
    if (text === 'Apply this Budget to my Account') {
      const lastProposal = [...chatHistory].reverse().find((m) => m.suggestedBudget);
      if (lastProposal && lastProposal.suggestedBudget) {
        saveBudget({
          month: currentMonth,
          income: lastProposal.suggestedBudget.income,
          categoryBudgets: lastProposal.suggestedBudget.allocation,
          notes: 'Generated and applied via BudgetWise AI Budget Assistant',
        });
        updateDashboard();
        if (currentView === 'budget') renderBudgetSection();

        chatHistory.push({
          id: 'bot_' + Date.now(),
          sender: 'bot',
          text: `✅ **Success!** Your AI-suggested budget has been saved and applied to **${currentMonth}**.\n\nYou can inspect live tracking under the **Monthly Budget** tab anytime!`,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          quickReplies: ['How much budget is remaining?', 'Analyze my spending'],
        });
        renderDrawerChat();
        renderFullAssistantMessages();
        showToast('AI Budget successfully applied to your account!', 'success');
        return;
      }
    }

    const result = handleUserChatMessage(text, currentMonth);
    const botMsg: ChatMessage = {
      id: 'bot_' + Date.now(),
      sender: 'bot',
      text: result.response,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      quickReplies: result.quickReplies,
      suggestedBudget: result.suggestedBudget,
    };
    chatHistory.push(botMsg);
    renderDrawerChat();
    renderFullAssistantMessages();
  }, 400);
}

function renderDrawerChat(): void {
  const container = document.getElementById('drawer-chat-messages');
  const chipsContainer = document.getElementById('drawer-prompt-chips');
  if (!container) return;

  container.innerHTML = chatHistory
    .map((msg) => {
      const isBot = msg.sender === 'bot';
      return `
      <div class="flex items-start gap-2.5 ${isBot ? '' : 'flex-row-reverse'}">
        <div class="w-7 h-7 rounded-full flex items-center justify-center shrink-0 ${isBot ? 'bg-emerald-100 dark:bg-emerald-950 text-emerald-600 text-xs' : 'bg-slate-700 text-white text-xs font-bold'}">
          ${isBot ? '🤖' : 'You'}
        </div>
        <div class="max-w-[85%] rounded-2xl px-3.5 py-2.5 ${isBot ? 'bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200' : 'bg-emerald-600 text-white'} text-xs leading-relaxed space-y-1">
          <div>${formatMarkdown(msg.text)}</div>
          ${
            msg.suggestedBudget
              ? `
            <div class="mt-2.5 pt-2 border-t border-slate-200 dark:border-slate-700">
              <button data-action="apply-budget-chat" class="w-full py-1.5 bg-emerald-600 text-white rounded-lg font-semibold hover:bg-emerald-700 text-xs shadow-xs transition">
                ✓ Apply this Budget to my Account
              </button>
            </div>
          `
              : ''
          }
          <div class="text-[10px] text-right ${isBot ? 'text-slate-400' : 'text-emerald-100'} mt-1">${msg.timestamp}</div>
        </div>
      </div>
    `;
    })
    .join('');

  container.scrollTop = container.scrollHeight;

  // Render quick chips from last bot message
  if (chipsContainer) {
    const lastBotMsg = [...chatHistory].reverse().find((m) => m.sender === 'bot' && m.quickReplies);
    if (lastBotMsg && lastBotMsg.quickReplies && lastBotMsg.quickReplies.length > 0) {
      chipsContainer.innerHTML = lastBotMsg.quickReplies
        .map(
          (chip) => `
        <button data-chip="${escapeHtml(chip)}" class="chat-chip px-2.5 py-1 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-full text-[11px] text-slate-700 dark:text-slate-300 hover:bg-slate-100 transition whitespace-nowrap">
          ${chip}
        </button>
      `
        )
        .join('');
    } else {
      chipsContainer.innerHTML = '';
    }
  }
}

function renderFullAssistantMessages(): void {
  const container = document.getElementById('view-assistant-messages');
  const chipsContainer = document.getElementById('view-assistant-chips');
  if (!container) return;

  container.innerHTML = chatHistory
    .map((msg) => {
      const isBot = msg.sender === 'bot';
      return `
      <div class="flex items-start gap-3 ${isBot ? '' : 'flex-row-reverse'}">
        <div class="w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${isBot ? 'bg-emerald-100 dark:bg-emerald-950 text-emerald-600 text-sm' : 'bg-slate-700 text-white text-xs font-bold'}">
          ${isBot ? '🤖' : 'You'}
        </div>
        <div class="max-w-[80%] rounded-2xl px-4 py-3 ${isBot ? 'bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200' : 'bg-emerald-600 text-white'} text-xs leading-relaxed space-y-1">
          <div>${formatMarkdown(msg.text)}</div>
          ${
            msg.suggestedBudget
              ? `
            <div class="mt-3 pt-2.5 border-t border-slate-200 dark:border-slate-700">
              <button data-action="apply-budget-chat" class="px-4 py-2 bg-emerald-600 text-white rounded-lg font-semibold hover:bg-emerald-700 text-xs shadow-xs transition">
                ✓ Apply this Budget to my Account
              </button>
            </div>
          `
              : ''
          }
          <div class="text-[10px] text-right ${isBot ? 'text-slate-400' : 'text-emerald-100'} mt-1">${msg.timestamp}</div>
        </div>
      </div>
    `;
    })
    .join('');

  container.scrollTop = container.scrollHeight;

  if (chipsContainer) {
    const lastBotMsg = [...chatHistory].reverse().find((m) => m.sender === 'bot' && m.quickReplies);
    if (lastBotMsg && lastBotMsg.quickReplies && lastBotMsg.quickReplies.length > 0) {
      chipsContainer.innerHTML = lastBotMsg.quickReplies
        .map(
          (chip) => `
        <button data-chip="${escapeHtml(chip)}" class="chat-chip px-3 py-1 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-full text-xs text-slate-700 dark:text-slate-300 hover:bg-slate-100 transition whitespace-nowrap">
          ${chip}
        </button>
      `
        )
        .join('');
    } else {
      chipsContainer.innerHTML = '';
    }
  }
}

// -----------------------------------------------------------------
// NOTIFICATIONS POPOVER
// -----------------------------------------------------------------
function renderNotificationsPopover(): void {
  const listEl = document.getElementById('notifications-list');
  const badge = document.getElementById('notif-badge');
  if (!listEl) return;

  const notifs = getNotifications();
  const unreadCount = notifs.filter((n) => !n.read).length;

  if (badge) {
    if (unreadCount > 0) {
      badge.classList.remove('hidden');
    } else {
      badge.classList.add('hidden');
    }
  }

  if (notifs.length === 0) {
    listEl.innerHTML = `<div class="p-6 text-center text-slate-400 text-xs">No alerts or notifications</div>`;
    return;
  }

  listEl.innerHTML = notifs
    .map(
      (n) => `
    <div class="p-3.5 hover:bg-slate-50 dark:hover:bg-slate-800/60 transition-colors ${n.read ? 'opacity-70' : 'font-medium'}">
      <div class="flex items-center justify-between text-xs mb-1">
        <span class="font-bold text-slate-900 dark:text-white">${escapeHtml(n.title)}</span>
        <span class="text-[10px] text-slate-400 font-mono">${formatDateLabel(n.timestamp.substring(0, 10))}</span>
      </div>
      <p class="text-xs text-slate-600 dark:text-slate-300 leading-normal">${escapeHtml(n.message)}</p>
    </div>
  `
    )
    .join('');
}

// -----------------------------------------------------------------
// SETTINGS VIEW
// -----------------------------------------------------------------
function renderSettingsSection(): void {
  const settings = getSettings();
  const currencySelect = document.getElementById('settings-currency-select') as HTMLSelectElement;
  const alertsCheckbox = document.getElementById('settings-alerts-checkbox') as HTMLInputElement;

  if (currencySelect) currencySelect.value = settings.currencyCode;
  if (alertsCheckbox) alertsCheckbox.checked = settings.enableNotifications;
}

// -----------------------------------------------------------------
// MODAL CONTROLS
// -----------------------------------------------------------------
function openAddExpenseModal(presetDate?: string): void {
  const modal = document.getElementById('expense-modal');
  const title = document.getElementById('expense-modal-title');
  const form = document.getElementById('expense-form') as HTMLFormElement;
  const editIdInput = document.getElementById('expense-edit-id') as HTMLInputElement;
  const dateInput = document.getElementById('expense-date-input') as HTMLInputElement;

  if (!modal || !form) return;

  form.reset();
  if (editIdInput) editIdInput.value = '';
  if (title) title.textContent = 'Add New Expense';

  // Set default date to preset or today
  if (dateInput) {
    dateInput.value = presetDate || '2026-10-02';
  }

  modal.classList.remove('hidden');
}

function openEditExpenseModal(expenseId: string): void {
  const expense = getExpenses().find((e) => e.id === expenseId);
  if (!expense) return;

  const modal = document.getElementById('expense-modal');
  const title = document.getElementById('expense-modal-title');
  const editIdInput = document.getElementById('expense-edit-id') as HTMLInputElement;
  const amountInput = document.getElementById('expense-amount-input') as HTMLInputElement;
  const descInput = document.getElementById('expense-desc-input') as HTMLInputElement;
  const catSelect = document.getElementById('expense-category-select') as HTMLSelectElement;
  const methodSelect = document.getElementById('expense-method-select') as HTMLSelectElement;
  const dateInput = document.getElementById('expense-date-input') as HTMLInputElement;
  const noteInput = document.getElementById('expense-note-input') as HTMLTextAreaElement;

  if (!modal) return;

  if (title) title.textContent = 'Edit Expense';
  if (editIdInput) editIdInput.value = expense.id;
  if (amountInput) amountInput.value = expense.amount.toString();
  if (descInput) descInput.value = expense.description;
  if (catSelect) catSelect.value = expense.category;
  if (methodSelect) methodSelect.value = expense.paymentMethod;
  if (dateInput) dateInput.value = expense.date;
  if (noteInput) noteInput.value = expense.note || '';

  modal.classList.remove('hidden');
}

function closeExpenseModal(): void {
  const modal = document.getElementById('expense-modal');
  if (modal) modal.classList.add('hidden');
}

function openCreateGoalModal(goalId?: string): void {
  const modal = document.getElementById('goal-modal');
  const title = document.getElementById('goal-modal-title');
  const form = document.getElementById('goal-form') as HTMLFormElement;
  const editId = document.getElementById('goal-edit-id') as HTMLInputElement;
  const titleInput = document.getElementById('goal-title-input') as HTMLInputElement;
  const targetInput = document.getElementById('goal-target-input') as HTMLInputElement;
  const currentInput = document.getElementById('goal-current-input') as HTMLInputElement;
  const dateInput = document.getElementById('goal-date-input') as HTMLInputElement;
  const notesInput = document.getElementById('goal-notes-input') as HTMLInputElement;

  if (!modal || !form) return;

  form.reset();

  if (goalId) {
    const goal = getSavingsGoals().find((g) => g.id === goalId);
    if (goal) {
      if (title) title.textContent = 'Edit Savings Goal';
      if (editId) editId.value = goal.id;
      if (titleInput) titleInput.value = goal.title;
      if (targetInput) targetInput.value = goal.targetAmount.toString();
      if (currentInput) currentInput.value = goal.currentAmount.toString();
      if (dateInput) dateInput.value = goal.targetDate;
      if (notesInput) notesInput.value = goal.notes || '';
    }
  } else {
    if (title) title.textContent = 'Create Savings Goal';
    if (editId) editId.value = '';
    if (dateInput) dateInput.value = '2026-12-31';
  }

  modal.classList.remove('hidden');
}

function closeGoalModal(): void {
  const modal = document.getElementById('goal-modal');
  if (modal) modal.classList.add('hidden');
}

function openAddMoneyModal(goalId: string, goalTitle: string): void {
  const modal = document.getElementById('add-money-modal');
  const goalIdInput = document.getElementById('add-money-goal-id') as HTMLInputElement;
  const titleEl = document.getElementById('add-money-goal-title');
  const amountInput = document.getElementById('add-money-amount-input') as HTMLInputElement;

  if (!modal) return;
  if (goalIdInput) goalIdInput.value = goalId;
  if (titleEl) titleEl.textContent = `Goal: ${goalTitle}`;
  if (amountInput) amountInput.value = '';

  modal.classList.remove('hidden');
}

function closeAddMoneyModal(): void {
  const modal = document.getElementById('add-money-modal');
  if (modal) modal.classList.add('hidden');
}

// -----------------------------------------------------------------
// MOBILE SIDEBAR
// -----------------------------------------------------------------
function toggleMobileSidebar(): void {
  const sidebar = document.getElementById('app-sidebar');
  const backdrop = document.getElementById('sidebar-backdrop');
  if (!sidebar) return;

  const isClosed = sidebar.classList.contains('-translate-x-full');
  if (isClosed) {
    sidebar.classList.remove('-translate-x-full');
    if (backdrop) backdrop.classList.remove('hidden');
  } else {
    sidebar.classList.add('-translate-x-full');
    if (backdrop) backdrop.classList.add('hidden');
  }
}

function closeMobileSidebar(): void {
  const sidebar = document.getElementById('app-sidebar');
  const backdrop = document.getElementById('sidebar-backdrop');
  if (sidebar) sidebar.classList.add('-translate-x-full');
  if (backdrop) backdrop.classList.add('hidden');
}

// -----------------------------------------------------------------
// AI CHAT DRAWER CONTROLS
// -----------------------------------------------------------------
function openAIChatDrawer(): void {
  const drawer = document.getElementById('ai-chat-drawer');
  if (drawer) {
    drawer.classList.remove('translate-x-full');
    const input = document.getElementById('drawer-chat-input');
    if (input) (input as HTMLInputElement).focus();
  }
}

function closeAIChatDrawer(): void {
  const drawer = document.getElementById('ai-chat-drawer');
  if (drawer) drawer.classList.add('translate-x-full');
}

// -----------------------------------------------------------------
// EVENT LISTENERS BINDING
// -----------------------------------------------------------------
function setupEventListeners(): void {
  // Navigation items
  document.querySelectorAll('[data-nav]').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      const target = (e.currentTarget as HTMLElement).getAttribute('data-nav');
      if (target) switchView(target);
    });
  });

  // Mobile menu
  document.getElementById('mobile-menu-btn')?.addEventListener('click', toggleMobileSidebar);
  document.getElementById('close-sidebar-btn')?.addEventListener('click', closeMobileSidebar);
  document.getElementById('sidebar-backdrop')?.addEventListener('click', closeMobileSidebar);

  // Month selector
  document.getElementById('global-month-select')?.addEventListener('change', (e) => {
    currentMonth = (e.target as HTMLSelectElement).value;
    refreshCurrentView();
  });

  // Header Add Expense
  document.getElementById('header-add-expense-btn')?.addEventListener('click', () => openAddExpenseModal());
  document.getElementById('mobile-add-expense-btn')?.addEventListener('click', () => openAddExpenseModal());
  document.getElementById('dash-quick-add-btn')?.addEventListener('click', () => openAddExpenseModal());
  document.getElementById('expenses-add-btn')?.addEventListener('click', () => openAddExpenseModal());
  document.getElementById('empty-state-add-btn')?.addEventListener('click', () => openAddExpenseModal());
  document.getElementById('daily-add-for-date-btn')?.addEventListener('click', () => {
    const dateInput = document.getElementById('daily-picker-input') as HTMLInputElement;
    openAddExpenseModal(dateInput?.value || selectedDailyDate);
  });

  // Close Expense Modal
  document.getElementById('close-expense-modal-btn')?.addEventListener('click', closeExpenseModal);
  document.getElementById('expense-cancel-btn')?.addEventListener('click', closeExpenseModal);
  document.getElementById('expense-modal-backdrop')?.addEventListener('click', closeExpenseModal);

  // Expense Form Submit
  document.getElementById('expense-form')?.addEventListener('submit', (e) => {
    e.preventDefault();
    const editId = (document.getElementById('expense-edit-id') as HTMLInputElement).value;
    const amount = Number((document.getElementById('expense-amount-input') as HTMLInputElement).value);
    const desc = (document.getElementById('expense-desc-input') as HTMLInputElement).value;
    const category = (document.getElementById('expense-category-select') as HTMLSelectElement).value as ExpenseCategory;
    const method = (document.getElementById('expense-method-select') as HTMLSelectElement).value as PaymentMethod;
    const date = (document.getElementById('expense-date-input') as HTMLInputElement).value;
    const note = (document.getElementById('expense-note-input') as HTMLTextAreaElement).value;

    if (!amount || amount <= 0) {
      showToast('Please enter a valid expense amount.', 'error');
      return;
    }

    if (editId) {
      updateExpense(editId, {
        amount,
        description: desc,
        category,
        paymentMethod: method,
        date,
        note,
      });
      showToast('Expense updated successfully.', 'success');
    } else {
      saveExpense({
        amount,
        description: desc,
        category,
        paymentMethod: method,
        date,
        note,
      });
      showToast('Expense logged successfully.', 'success');
    }

    closeExpenseModal();
    refreshCurrentView();
  });

  // Table action clicks (Edit / Delete)
  document.addEventListener('click', (e) => {
    const target = (e.target as HTMLElement).closest('[data-action]');
    if (!target) return;

    const action = target.getAttribute('data-action');
    const id = target.getAttribute('data-id');

    if (action === 'edit-expense' && id) {
      openEditExpenseModal(id);
    } else if (action === 'delete-expense' && id) {
      if (confirm('Are you sure you want to delete this expense?')) {
        deleteExpense(id);
        showToast('Expense deleted.', 'info');
        refreshCurrentView();
      }
    } else if (action === 'edit-goal' && id) {
      openCreateGoalModal(id);
    } else if (action === 'delete-goal' && id) {
      if (confirm('Are you sure you want to delete this savings goal?')) {
        deleteSavingsGoal(id);
        showToast('Goal deleted.', 'info');
        renderSavingsGoalsSection();
      }
    } else if (action === 'add-funds' && id) {
      const title = target.getAttribute('data-title') || 'Savings Goal';
      openAddMoneyModal(id, title);
    } else if (action === 'apply-budget-chat') {
      sendUserMessage('Apply this Budget to my Account');
    }
  });

  // Filter & Search Inputs
  ['txn-search', 'txn-filter-category', 'txn-filter-method', 'txn-sort-by'].forEach((id) => {
    document.getElementById(id)?.addEventListener('input', () => {
      renderExpensesTable();
    });
  });

  // Expenses Export CSV
  document.getElementById('expenses-export-csv-btn')?.addEventListener('click', () => {
    downloadFile('budgetwise-expenses.csv', exportDataCSV(), 'text/csv');
    showToast('Expenses CSV exported.', 'success');
  });

  // Daily Date Picker
  document.getElementById('daily-picker-input')?.addEventListener('change', (e) => {
    selectedDailyDate = (e.target as HTMLSelectElement).value;
    renderDailySection();
  });

  // Budget Section: Save Budget Button
  document.getElementById('save-budget-btn')?.addEventListener('click', () => {
    const income = Number((document.getElementById('budget-income-input') as HTMLInputElement)?.value) || 0;
    const catBudgets: Record<string, number> = {};

    document.querySelectorAll('.budget-cat-input').forEach((input) => {
      const cat = input.getAttribute('data-category');
      if (cat) {
        catBudgets[cat] = Number((input as HTMLInputElement).value) || 0;
      }
    });

    saveBudget({
      month: currentMonth,
      income,
      categoryBudgets: catBudgets,
    });

    showToast('Monthly budget saved successfully.', 'success');
    refreshCurrentView();
  });

  // Budget Section: Reset Budget
  document.getElementById('budget-reset-btn')?.addEventListener('click', () => {
    if (confirm('Reset budget allocations for this month to zero?')) {
      const zeroBudgets: Record<string, number> = {};
      BUDGET_CATEGORIES.forEach((c) => (zeroBudgets[c] = 0));
      saveBudget({
        month: currentMonth,
        income: 0,
        categoryBudgets: zeroBudgets,
      });
      showToast('Budget allocations reset.', 'info');
      refreshCurrentView();
    }
  });

  // Budget Section: Duplicate Previous Month
  document.getElementById('budget-duplicate-btn')?.addEventListener('click', () => {
    const prevMonth = currentMonth === '2026-10' ? '2026-09' : '2026-10';
    const prevBudget = getBudget(prevMonth);
    if (!prevBudget) {
      showToast(`No previous budget found for ${prevMonth}.`, 'error');
      return;
    }

    saveBudget({
      month: currentMonth,
      income: prevBudget.income,
      categoryBudgets: { ...prevBudget.categoryBudgets },
      notes: `Duplicated from ${prevMonth}`,
    });

    showToast(`Budget duplicated from ${prevMonth}!`, 'success');
    refreshCurrentView();
  });

  // Savings Goals: Create Goal Button
  document.getElementById('goals-create-btn')?.addEventListener('click', () => openCreateGoalModal());
  document.getElementById('close-goal-modal-btn')?.addEventListener('click', closeGoalModal);
  document.getElementById('goal-cancel-btn')?.addEventListener('click', closeGoalModal);
  document.getElementById('goal-modal-backdrop')?.addEventListener('click', closeGoalModal);

  // Goal Form Submit
  document.getElementById('goal-form')?.addEventListener('submit', (e) => {
    e.preventDefault();
    const editId = (document.getElementById('goal-edit-id') as HTMLInputElement).value;
    const title = (document.getElementById('goal-title-input') as HTMLInputElement).value;
    const target = Number((document.getElementById('goal-target-input') as HTMLInputElement).value);
    const current = Number((document.getElementById('goal-current-input') as HTMLInputElement).value) || 0;
    const date = (document.getElementById('goal-date-input') as HTMLInputElement).value;
    const notes = (document.getElementById('goal-notes-input') as HTMLInputElement).value;

    if (!title || !target || target <= 0) {
      showToast('Please provide a goal title and target amount.', 'error');
      return;
    }

    if (editId) {
      updateSavingsGoal(editId, {
        title,
        targetAmount: target,
        currentAmount: current,
        targetDate: date,
        notes,
      });
      showToast('Goal updated.', 'success');
    } else {
      saveSavingsGoal({
        title,
        targetAmount: target,
        currentAmount: current,
        targetDate: date,
        notes,
      });
      showToast('Savings goal created!', 'success');
    }

    closeGoalModal();
    renderSavingsGoalsSection();
    updateDashboard();
  });

  // Add Money Modal Submit
  document.getElementById('close-add-money-btn')?.addEventListener('click', closeAddMoneyModal);
  document.getElementById('add-money-cancel-btn')?.addEventListener('click', closeAddMoneyModal);
  document.getElementById('add-money-backdrop')?.addEventListener('click', closeAddMoneyModal);

  document.getElementById('add-money-form')?.addEventListener('submit', (e) => {
    e.preventDefault();
    const goalId = (document.getElementById('add-money-goal-id') as HTMLInputElement).value;
    const amount = Number((document.getElementById('add-money-amount-input') as HTMLInputElement).value);

    if (!amount || amount <= 0) {
      showToast('Please enter an amount to deposit.', 'error');
      return;
    }

    addMoneyToGoal(goalId, amount);
    showToast(`Added ${formatCurrency(amount)} to your goal!`, 'success');
    closeAddMoneyModal();
    renderSavingsGoalsSection();
    updateDashboard();
  });

  // Floating AI Assistant Button
  document.getElementById('floating-ai-btn')?.addEventListener('click', openAIChatDrawer);
  document.getElementById('dash-open-ai-btn')?.addEventListener('click', openAIChatDrawer);
  document.getElementById('close-ai-drawer-btn')?.addEventListener('click', closeAIChatDrawer);

  // Chat forms (drawer + full view)
  document.getElementById('drawer-chat-form')?.addEventListener('submit', (e) => {
    e.preventDefault();
    const input = document.getElementById('drawer-chat-input') as HTMLInputElement;
    if (input && input.value) {
      sendUserMessage(input.value);
      input.value = '';
    }
  });

  document.getElementById('view-assistant-form')?.addEventListener('submit', (e) => {
    e.preventDefault();
    const input = document.getElementById('view-assistant-input') as HTMLInputElement;
    if (input && input.value) {
      sendUserMessage(input.value);
      input.value = '';
    }
  });

  // Chat Chips click
  document.addEventListener('click', (e) => {
    const chipBtn = (e.target as HTMLElement).closest('[data-chip]');
    if (chipBtn) {
      const chipText = chipBtn.getAttribute('data-chip');
      if (chipText) sendUserMessage(chipText);
    }
  });

  // Clear assistant chat
  document.getElementById('view-assistant-clear-btn')?.addEventListener('click', () => {
    chatHistory = [];
    resetWizardState();
    initChatbot();
    showToast('Chat history cleared.', 'info');
  });

  // Notifications Popover
  const notifBtn = document.getElementById('notifications-btn');
  const notifPopover = document.getElementById('notifications-popover');
  if (notifBtn && notifPopover) {
    notifBtn.addEventListener('click', () => {
      notifPopover.classList.toggle('hidden');
    });

    document.addEventListener('click', (e) => {
      if (!notifBtn.contains(e.target as Node) && !notifPopover.contains(e.target as Node)) {
        notifPopover.classList.add('hidden');
      }
    });
  }

  document.getElementById('mark-notifs-read-btn')?.addEventListener('click', () => {
    markNotificationsRead();
    renderNotificationsPopover();
    showToast('All notifications marked as read.', 'info');
  });

  // Theme Toggles
  const toggleTheme = () => {
    const current = getSettings().theme;
    const nextTheme = current === 'dark' ? 'light' : 'dark';
    saveSettings({ theme: nextTheme });
    initTheme();
    renderAnalyticsSection();
  };

  document.getElementById('theme-toggle-btn')?.addEventListener('click', toggleTheme);
  document.getElementById('mobile-theme-toggle')?.addEventListener('click', toggleTheme);

  document.getElementById('settings-theme-light-btn')?.addEventListener('click', () => {
    saveSettings({ theme: 'light' });
    initTheme();
    renderAnalyticsSection();
  });

  document.getElementById('settings-theme-dark-btn')?.addEventListener('click', () => {
    saveSettings({ theme: 'dark' });
    initTheme();
    renderAnalyticsSection();
  });

  // Settings: Currency selector
  document.getElementById('settings-currency-select')?.addEventListener('change', (e) => {
    const code = (e.target as HTMLSelectElement).value;
    let symbol = '₹';
    if (code === 'USD' || code === 'CAD' || code === 'AUD') symbol = '$';
    else if (code === 'EUR') symbol = '€';
    else if (code === 'GBP') symbol = '£';
    else if (code === 'JPY') symbol = '¥';

    saveSettings({ currencyCode: code, currencySymbol: symbol });
    showToast(`Currency updated to ${code} (${symbol})`, 'success');
    refreshCurrentView();
  });

  // Settings: Notifications checkbox
  document.getElementById('settings-alerts-checkbox')?.addEventListener('change', (e) => {
    const checked = (e.target as HTMLInputElement).checked;
    saveSettings({ enableNotifications: checked });
    showToast(`In-app budget alerts ${checked ? 'enabled' : 'disabled'}.`, 'info');
  });

  // Settings: Load Demo Data
  document.getElementById('settings-load-demo-btn')?.addEventListener('click', () => {
    if (confirm('Reset your data and load the realistic sample demo transactions (₹25,000 budget, ₹17,450 spent)?')) {
      loadDemoData();
      showToast('Demo data loaded successfully!', 'success');
      refreshCurrentView();
    }
  });

  // Settings: Clear All Data
  document.getElementById('settings-clear-all-btn')?.addEventListener('click', () => {
    if (confirm('Are you sure you want to clear ALL data? This will wipe your expenses, budgets, and goals.')) {
      clearAllData();
      showToast('All data has been cleared.', 'info');
      refreshCurrentView();
    }
  });

  // Settings: Export JSON & CSV
  document.getElementById('settings-export-json-btn')?.addEventListener('click', () => {
    downloadFile('budgetwise-backup.json', exportDataJSON(), 'application/json');
    showToast('JSON backup exported successfully.', 'success');
  });

  document.getElementById('settings-export-csv-btn')?.addEventListener('click', () => {
    downloadFile('budgetwise-expenses.csv', exportDataCSV(), 'text/csv');
    showToast('CSV ledger exported successfully.', 'success');
  });

  // Settings: Import JSON
  const importInput = document.getElementById('settings-import-file-input') as HTMLInputElement;
  document.getElementById('settings-import-json-btn')?.addEventListener('click', () => {
    importInput?.click();
  });

  importInput?.addEventListener('change', (e) => {
    const file = (e.target as HTMLInputElement).files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      const res = importDataJSON(content);
      if (res.success) {
        showToast(res.message, 'success');
        refreshCurrentView();
      } else {
        showToast(res.message, 'error');
      }
    };
    reader.readAsText(file);
  });

  // Keyboard shortcut: Escape closes modals & drawer
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      closeExpenseModal();
      closeGoalModal();
      closeAddMoneyModal();
      closeAIChatDrawer();
      closeMobileSidebar();
    }
  });
}

// -----------------------------------------------------------------
// UTILITIES
// -----------------------------------------------------------------
function escapeHtml(str: string): string {
  if (!str) return '';
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function formatMarkdown(text: string): string {
  let res = escapeHtml(text);
  // Bold **text**
  res = res.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
  // Newlines
  res = res.replace(/\n/g, '<br/>');
  return res;
}

function formatDateLabel(dateStr: string): string {
  try {
    const parts = dateStr.split('-');
    if (parts.length !== 3) return dateStr;
    const d = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  } catch (e) {
    return dateStr;
  }
}

function getPreviousDay(dateStr: string): string {
  try {
    const parts = dateStr.split('-');
    const d = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
    d.setDate(d.getDate() - 1);
    const yr = d.getFullYear();
    const mo = (d.getMonth() + 1).toString().padStart(2, '0');
    const day = d.getDate().toString().padStart(2, '0');
    return `${yr}-${mo}-${day}`;
  } catch (e) {
    return '2026-10-01';
  }
}

function downloadFile(filename: string, content: string, mimeType: string): void {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// -----------------------------------------------------------------
// INITIALIZATION
// -----------------------------------------------------------------
initTheme();
setupEventListeners();
initChatbot();
switchView('dashboard');
