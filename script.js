/**
 * BudgetWise - Modern Personal Daily & Monthly Budget Management Web Application
 * Standalone Vanilla JavaScript Implementation (GitHub & Static Host Compatible)
 */

(function () {
  if (window.__BUDGETWISE_LOADED__) return;
  window.__BUDGETWISE_LOADED__ = true;

  // Constants
  const EXPENSE_CATEGORIES = [
    'Food',
    'Transport',
    'Education',
    'Shopping',
    'Bills',
    'Entertainment',
    'Health',
    'Family',
    'Other',
  ];

  const BUDGET_CATEGORIES = [
    'Food',
    'Transport',
    'Education',
    'Bills',
    'Shopping',
    'Entertainment',
    'Health',
    'Family',
    'Savings',
    'Other',
  ];

  const CATEGORY_COLORS = {
    Food: '#10B981',
    Transport: '#3B82F6',
    Education: '#8B5CF6',
    Bills: '#F59E0B',
    Shopping: '#EC4899',
    Entertainment: '#6366F1',
    Health: '#EF4444',
    Family: '#14B8A6',
    Savings: '#059669',
    Other: '#6B7280',
  };

  function getCategoryColor(category) {
    return CATEGORY_COLORS[category] || '#64748B';
  }

  const STORAGE_KEYS = {
    EXPENSES: 'budgetwise_expenses',
    BUDGETS: 'budgetwise_budgets',
    GOALS: 'budgetwise_goals',
    SETTINGS: 'budgetwise_settings',
    NOTIFICATIONS: 'budgetwise_notifications',
    INITIALIZED: 'budgetwise_initialized_v2',
  };

  const DEFAULT_SETTINGS = {
    currencySymbol: '₹',
    currencyCode: 'INR',
    theme: 'light',
    alertNearLimitPercent: 75,
    enableNotifications: true,
  };

  // State
  let currentView = 'dashboard';
  let currentMonth = '2026-10';
  let selectedDailyDate = '2026-10-02';
  let chatHistory = [];
  let wizardState = {
    active: false,
    step: 0,
    income: 0,
    fixedExpenses: 0,
    majorCategories: [],
    savingsTarget: 0,
  };

  // -------------------------------------------------------------
  // STORAGE & DATA API
  // -------------------------------------------------------------
  function getSettings() {
    try {
      const raw = localStorage.getItem(STORAGE_KEYS.SETTINGS);
      return raw ? { ...DEFAULT_SETTINGS, ...JSON.parse(raw) } : DEFAULT_SETTINGS;
    } catch (e) {
      return DEFAULT_SETTINGS;
    }
  }

  function saveSettings(settings) {
    const current = getSettings();
    const updated = { ...current, ...settings };
    localStorage.setItem(STORAGE_KEYS.SETTINGS, JSON.stringify(updated));
    return updated;
  }

  function formatCurrency(amount, symbol) {
    const settings = getSettings();
    const s = symbol !== undefined ? symbol : settings.currencySymbol;
    const isNegative = amount < 0;
    const absVal = Math.abs(amount);

    let formatted = '';
    if (settings.currencyCode === 'INR') {
      formatted = absVal.toLocaleString('en-IN', { maximumFractionDigits: 0 });
    } else {
      formatted = absVal.toLocaleString('en-US', { maximumFractionDigits: 0 });
    }
    return `${isNegative ? '-' : ''}${s}${formatted}`;
  }

  function getExpenses() {
    try {
      const raw = localStorage.getItem(STORAGE_KEYS.EXPENSES);
      return raw ? JSON.parse(raw) : [];
    } catch (e) {
      return [];
    }
  }

  function saveExpense(expenseData) {
    const expenses = getExpenses();
    const now = new Date().toISOString();

    if (expenseData.id) {
      const index = expenses.findIndex((e) => e.id === expenseData.id);
      if (index !== -1) {
        const updated = { ...expenses[index], ...expenseData, updatedAt: now };
        expenses[index] = updated;
        localStorage.setItem(STORAGE_KEYS.EXPENSES, JSON.stringify(expenses));
        return updated;
      }
    }

    const newExpense = {
      id: 'exp_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7),
      userId: 1,
      amount: Number(expenseData.amount),
      date: expenseData.date,
      category: expenseData.category,
      description: expenseData.description.trim(),
      paymentMethod: expenseData.paymentMethod,
      note: expenseData.note ? expenseData.note.trim() : '',
      createdAt: now,
      updatedAt: now,
    };

    expenses.unshift(newExpense);
    localStorage.setItem(STORAGE_KEYS.EXPENSES, JSON.stringify(expenses));
    return newExpense;
  }

  function updateExpense(id, updatedData) {
    const expenses = getExpenses();
    const index = expenses.findIndex((e) => e.id === id);
    if (index === -1) return null;

    const updated = {
      ...expenses[index],
      ...updatedData,
      amount: updatedData.amount !== undefined ? Number(updatedData.amount) : expenses[index].amount,
      updatedAt: new Date().toISOString(),
    };
    expenses[index] = updated;
    localStorage.setItem(STORAGE_KEYS.EXPENSES, JSON.stringify(expenses));
    return updated;
  }

  function deleteExpense(id) {
    const expenses = getExpenses();
    const filtered = expenses.filter((e) => e.id !== id);
    if (filtered.length === expenses.length) return false;
    localStorage.setItem(STORAGE_KEYS.EXPENSES, JSON.stringify(filtered));
    return true;
  }

  function getBudgets() {
    try {
      const raw = localStorage.getItem(STORAGE_KEYS.BUDGETS);
      return raw ? JSON.parse(raw) : [];
    } catch (e) {
      return [];
    }
  }

  function getBudget(month) {
    const budgets = getBudgets();
    return budgets.find((b) => b.month === month) || null;
  }

  function saveBudget(budgetData) {
    const budgets = getBudgets();
    const now = new Date().toISOString();
    const existingIndex = budgets.findIndex((b) => b.month === budgetData.month);

    if (existingIndex !== -1) {
      const updated = {
        ...budgets[existingIndex],
        ...budgetData,
        income: Number(budgetData.income),
        updatedAt: now,
      };
      budgets[existingIndex] = updated;
      localStorage.setItem(STORAGE_KEYS.BUDGETS, JSON.stringify(budgets));
      return updated;
    }

    const newBudget = {
      id: 'bgt_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7),
      userId: 1,
      month: budgetData.month,
      income: Number(budgetData.income),
      categoryBudgets: budgetData.categoryBudgets,
      notes: budgetData.notes || '',
      createdAt: now,
      updatedAt: now,
    };
    budgets.push(newBudget);
    localStorage.setItem(STORAGE_KEYS.BUDGETS, JSON.stringify(budgets));
    return newBudget;
  }

  function calculateMonthlyTotal(month) {
    const expenses = getExpenses();
    return expenses
      .filter((e) => e.date.startsWith(month))
      .reduce((sum, e) => sum + Number(e.amount), 0);
  }

  function calculateCategoryTotal(month, category) {
    const expenses = getExpenses();
    return expenses
      .filter((e) => e.date.startsWith(month) && e.category === category)
      .reduce((sum, e) => sum + Number(e.amount), 0);
  }

  function calculatePlannedExpenses(budget) {
    if (!budget || !budget.categoryBudgets) return 0;
    return Object.values(budget.categoryBudgets).reduce((sum, val) => sum + (Number(val) || 0), 0);
  }

  function calculateDailySpending(dateString) {
    const expenses = getExpenses();
    return expenses
      .filter((e) => e.date === dateString)
      .reduce((sum, e) => sum + Number(e.amount), 0);
  }

  function getSavingsGoals() {
    try {
      const raw = localStorage.getItem(STORAGE_KEYS.GOALS);
      return raw ? JSON.parse(raw) : [];
    } catch (e) {
      return [];
    }
  }

  function saveSavingsGoal(goalData) {
    const goals = getSavingsGoals();
    const now = new Date().toISOString();

    if (goalData.id) {
      const index = goals.findIndex((g) => g.id === goalData.id);
      if (index !== -1) {
        const updated = {
          ...goals[index],
          ...goalData,
          targetAmount: Number(goalData.targetAmount),
          currentAmount: Number(goalData.currentAmount),
          updatedAt: now,
        };
        goals[index] = updated;
        localStorage.setItem(STORAGE_KEYS.GOALS, JSON.stringify(goals));
        return updated;
      }
    }

    const newGoal = {
      id: 'goal_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7),
      userId: 1,
      title: goalData.title.trim(),
      targetAmount: Number(goalData.targetAmount),
      currentAmount: Number(goalData.currentAmount || 0),
      targetDate: goalData.targetDate,
      category: goalData.category || 'General',
      notes: goalData.notes ? goalData.notes.trim() : '',
      createdAt: now,
      updatedAt: now,
    };
    goals.push(newGoal);
    localStorage.setItem(STORAGE_KEYS.GOALS, JSON.stringify(goals));
    return newGoal;
  }

  function updateSavingsGoal(id, updatedData) {
    const goals = getSavingsGoals();
    const index = goals.findIndex((g) => g.id === id);
    if (index === -1) return null;

    const updated = {
      ...goals[index],
      ...updatedData,
      targetAmount: updatedData.targetAmount !== undefined ? Number(updatedData.targetAmount) : goals[index].targetAmount,
      currentAmount: updatedData.currentAmount !== undefined ? Number(updatedData.currentAmount) : goals[index].currentAmount,
      updatedAt: new Date().toISOString(),
    };
    goals[index] = updated;
    localStorage.setItem(STORAGE_KEYS.GOALS, JSON.stringify(goals));
    return updated;
  }

  function addMoneyToGoal(id, amount) {
    const goals = getSavingsGoals();
    const index = goals.findIndex((g) => g.id === id);
    if (index === -1) return null;

    const goal = goals[index];
    const newAmount = Math.max(0, goal.currentAmount + Number(amount));
    goal.currentAmount = newAmount;
    goal.updatedAt = new Date().toISOString();
    goals[index] = goal;
    localStorage.setItem(STORAGE_KEYS.GOALS, JSON.stringify(goals));
    return goal;
  }

  function deleteSavingsGoal(id) {
    const goals = getSavingsGoals();
    const filtered = goals.filter((g) => g.id !== id);
    if (filtered.length === goals.length) return false;
    localStorage.setItem(STORAGE_KEYS.GOALS, JSON.stringify(filtered));
    return true;
  }

  function getNotifications() {
    try {
      const raw = localStorage.getItem(STORAGE_KEYS.NOTIFICATIONS);
      return raw ? JSON.parse(raw) : [];
    } catch (e) {
      return [];
    }
  }

  function markNotificationsRead() {
    const notifications = getNotifications();
    notifications.forEach((n) => (n.read = true));
    localStorage.setItem(STORAGE_KEYS.NOTIFICATIONS, JSON.stringify(notifications));
  }

  function loadDemoData() {
    const currentMonth = '2026-10';
    const todayStr = '2026-10-02';
    const yesterdayStr = '2026-10-01';

    const demoBudget = {
      id: 'demo_budget_2026_10',
      userId: 1,
      month: currentMonth,
      income: 35000,
      categoryBudgets: {
        Food: 3500,
        Transport: 1500,
        Education: 2000,
        Bills: 13500,
        Shopping: 1500,
        Entertainment: 800,
        Health: 1200,
        Family: 1000,
        Other: 0,
      },
      notes: 'Standard monthly personal budget with disciplined savings target.',
      createdAt: '2026-10-01T00:00:00Z',
      updatedAt: '2026-10-01T00:00:00Z',
    };

    const prevBudget = {
      id: 'demo_budget_2026_09',
      userId: 1,
      month: '2026-09',
      income: 35000,
      categoryBudgets: { ...demoBudget.categoryBudgets },
      notes: 'September 2026 budget plan.',
      createdAt: '2026-09-01T00:00:00Z',
      updatedAt: '2026-09-01T00:00:00Z',
    };

    // Exactly matching prompt numbers:
    // Today: ₹581
    // Total Spent: ₹17,450
    // Remaining: ₹7,550
    const demoExpenses = [
      {
        id: 'demo_exp_1',
        userId: 1,
        amount: 140,
        date: todayStr,
        category: 'Food',
        description: 'Morning Breakfast & Filter Coffee',
        paymentMethod: 'UPI',
        note: 'South Indian breakfast combo',
        createdAt: '2026-10-02T08:30:00Z',
        updatedAt: '2026-10-02T08:30:00Z',
      },
      {
        id: 'demo_exp_2',
        userId: 1,
        amount: 60,
        date: todayStr,
        category: 'Transport',
        description: 'Metro Card Smart Recharge',
        paymentMethod: 'UPI',
        note: 'Daily office commute',
        createdAt: '2026-10-02T09:15:00Z',
        updatedAt: '2026-10-02T09:15:00Z',
      },
      {
        id: 'demo_exp_3',
        userId: 1,
        amount: 381,
        date: todayStr,
        category: 'Food',
        description: 'Fresh Fruits & Vegetables (Local Mandi)',
        paymentMethod: 'Cash',
        note: 'Weekly essentials and milk',
        createdAt: '2026-10-02T17:45:00Z',
        updatedAt: '2026-10-02T17:45:00Z',
      },
      {
        id: 'demo_exp_4',
        userId: 1,
        amount: 12000,
        date: yesterdayStr,
        category: 'Bills',
        description: 'Apartment Monthly Rent & Maintenance',
        paymentMethod: 'Bank Transfer',
        note: 'Direct RTGS transfer to landlord',
        createdAt: '2026-10-01T10:00:00Z',
        updatedAt: '2026-10-01T10:00:00Z',
      },
      {
        id: 'demo_exp_5',
        userId: 1,
        amount: 850,
        date: yesterdayStr,
        category: 'Bills',
        description: 'High-speed Fiber Broadband Bill',
        paymentMethod: 'UPI',
        note: 'Airtel Xstream bill payment',
        createdAt: '2026-10-01T11:20:00Z',
        updatedAt: '2026-10-01T11:20:00Z',
      },
      {
        id: 'demo_exp_6',
        userId: 1,
        amount: 1200,
        date: yesterdayStr,
        category: 'Food',
        description: 'Grocery Staples & Kitchen Supplies',
        paymentMethod: 'Debit Card',
        note: 'D-Mart supermarket visit',
        createdAt: '2026-10-01T15:30:00Z',
        updatedAt: '2026-10-01T15:30:00Z',
      },
      {
        id: 'demo_exp_7',
        userId: 1,
        amount: 1500,
        date: yesterdayStr,
        category: 'Education',
        description: 'Online Certification & Coding Workshop',
        paymentMethod: 'Credit Card',
        note: 'Advanced Web Architecture module',
        createdAt: '2026-10-01T18:10:00Z',
        updatedAt: '2026-10-01T18:10:00Z',
      },
      {
        id: 'demo_exp_8',
        userId: 1,
        amount: 819,
        date: yesterdayStr,
        category: 'Health',
        description: 'Prescription Vitamins & First-aid Kit',
        paymentMethod: 'UPI',
        note: 'Apollo Pharmacy order',
        createdAt: '2026-10-01T19:40:00Z',
        updatedAt: '2026-10-01T19:40:00Z',
      },
      {
        id: 'demo_exp_9',
        userId: 1,
        amount: 500,
        date: yesterdayStr,
        category: 'Transport',
        description: 'Fuel Refill for Two-Wheeler',
        paymentMethod: 'UPI',
        note: 'Indian Oil petrol pump',
        createdAt: '2026-10-01T20:15:00Z',
        updatedAt: '2026-10-01T20:15:00Z',
      },
    ];

    const demoGoals = [
      {
        id: 'demo_goal_laptop',
        userId: 1,
        title: 'New Laptop',
        targetAmount: 50000,
        currentAmount: 18500,
        targetDate: '2026-12-31',
        category: 'Electronics',
        notes: 'M3 MacBook or ThinkPad for engineering work',
        createdAt: '2026-09-01T00:00:00Z',
        updatedAt: '2026-10-01T00:00:00Z',
      },
      {
        id: 'demo_goal_emergency',
        userId: 1,
        title: 'Emergency Safety Cushion',
        targetAmount: 60000,
        currentAmount: 28000,
        targetDate: '2027-03-31',
        category: 'Safety',
        notes: '3 months of essential living expenses',
        createdAt: '2026-08-15T00:00:00Z',
        updatedAt: '2026-09-20T00:00:00Z',
      },
    ];

    const demoNotifications = [
      {
        id: 'demo_notif_1',
        type: 'info',
        title: '👋 Welcome to BudgetWise',
        message: 'Demo dataset loaded. Your budget for October 2026 is active with ₹7,550 remaining.',
        timestamp: new Date().toISOString(),
        read: false,
      },
    ];

    localStorage.setItem(STORAGE_KEYS.EXPENSES, JSON.stringify(demoExpenses));
    localStorage.setItem(STORAGE_KEYS.BUDGETS, JSON.stringify([demoBudget, prevBudget]));
    localStorage.setItem(STORAGE_KEYS.GOALS, JSON.stringify(demoGoals));
    localStorage.setItem(STORAGE_KEYS.NOTIFICATIONS, JSON.stringify(demoNotifications));
    localStorage.setItem(STORAGE_KEYS.INITIALIZED, 'true');
  }

  function clearAllData() {
    localStorage.removeItem(STORAGE_KEYS.EXPENSES);
    localStorage.removeItem(STORAGE_KEYS.BUDGETS);
    localStorage.removeItem(STORAGE_KEYS.GOALS);
    localStorage.removeItem(STORAGE_KEYS.NOTIFICATIONS);
    localStorage.setItem(STORAGE_KEYS.INITIALIZED, 'true');
  }

  function ensureInitialized() {
    const initialized = localStorage.getItem(STORAGE_KEYS.INITIALIZED);
    if (!initialized || getExpenses().length === 0) {
      loadDemoData();
    }
  }

  function exportDataJSON() {
    return JSON.stringify(
      {
        version: '1.0',
        exportDate: new Date().toISOString(),
        expenses: getExpenses(),
        budgets: getBudgets(),
        goals: getSavingsGoals(),
        settings: getSettings(),
      },
      null,
      2
    );
  }

  function exportDataCSV() {
    const expenses = getExpenses();
    const headers = ['ID', 'Date', 'Description', 'Category', 'Payment Method', 'Amount', 'Note'];
    const rows = expenses.map((e) => [
      e.id,
      e.date,
      `"${(e.description || '').replace(/"/g, '""')}"`,
      e.category,
      e.paymentMethod,
      e.amount,
      `"${(e.note || '').replace(/"/g, '""')}"`,
    ]);
    return [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
  }

  function importDataJSON(jsonString) {
    try {
      const data = JSON.parse(jsonString);
      if (!data || typeof data !== 'object') return { success: false, message: 'Invalid JSON format' };
      if (Array.isArray(data.expenses)) localStorage.setItem(STORAGE_KEYS.EXPENSES, JSON.stringify(data.expenses));
      if (Array.isArray(data.budgets)) localStorage.setItem(STORAGE_KEYS.BUDGETS, JSON.stringify(data.budgets));
      if (Array.isArray(data.goals)) localStorage.setItem(STORAGE_KEYS.GOALS, JSON.stringify(data.goals));
      if (data.settings) localStorage.setItem(STORAGE_KEYS.SETTINGS, JSON.stringify(data.settings));
      return { success: true, message: 'Data imported successfully!' };
    } catch (err) {
      return { success: false, message: 'Parse error: ' + (err.message || 'Invalid file') };
    }
  }

  // -------------------------------------------------------------
  // CHARTS (SVG RENDERING)
  // -------------------------------------------------------------
  function renderDailyLineChart(container, data) {
    container.innerHTML = '';
    if (!data || data.length === 0) {
      container.innerHTML = '<div class="flex items-center justify-center h-full text-slate-400 text-sm">No daily spending recorded</div>';
      return;
    }
    const width = container.clientWidth || 500;
    const height = 240;
    const padding = { top: 20, right: 25, bottom: 40, left: 55 };
    const innerWidth = width - padding.left - padding.right;
    const innerHeight = height - padding.top - padding.bottom;
    const maxAmount = Math.max(...data.map((d) => d.amount), 500);
    const niceMax = Math.ceil(maxAmount / 100) * 100;

    let gridLinesSvg = '';
    for (let i = 0; i <= 4; i++) {
      const yVal = (niceMax / 4) * i;
      const yPos = padding.top + innerHeight - (yVal / niceMax) * innerHeight;
      gridLinesSvg += `
        <line x1="${padding.left}" y1="${yPos}" x2="${width - padding.right}" y2="${yPos}" stroke="currentColor" stroke-opacity="0.1" stroke-dasharray="3,3" />
        <text x="${padding.left - 8}" y="${yPos + 4}" font-size="10" text-anchor="end" class="fill-slate-400 font-mono">${formatCurrency(yVal)}</text>
      `;
    }

    const points = data.map((d, index) => {
      const x = padding.left + (index / Math.max(data.length - 1, 1)) * innerWidth;
      const y = padding.top + innerHeight - (d.amount / niceMax) * innerHeight;
      return { x, y, ...d };
    });

    let pathD = '';
    points.forEach((p, idx) => {
      if (idx === 0) pathD += `M ${p.x} ${p.y}`;
      else {
        const prev = points[idx - 1];
        const cx = prev.x + (p.x - prev.x) / 2;
        pathD += ` C ${cx} ${prev.y}, ${cx} ${p.y}, ${p.x} ${p.y}`;
      }
    });

    const areaD = `${pathD} L ${points[points.length - 1].x} ${padding.top + innerHeight} L ${points[0].x} ${padding.top + innerHeight} Z`;

    let interactiveNodes = '';
    points.forEach((p, i) => {
      const showLabel = data.length <= 10 || i % Math.ceil(data.length / 7) === 0 || i === data.length - 1;
      interactiveNodes += `
        <g class="chart-point" data-date="${p.date}" data-amount="${p.amount}" data-label="${p.label}">
          <circle cx="${p.x}" cy="${p.y}" r="4" class="fill-emerald-500 stroke-white dark:stroke-slate-900 stroke-2 cursor-pointer" />
          ${showLabel ? `<text x="${p.x}" y="${height - 12}" font-size="10" text-anchor="middle" class="fill-slate-400 select-none">${p.label}</text>` : ''}
        </g>
      `;
    });

    container.innerHTML = `
      <svg viewBox="0 0 ${width} ${height}" class="w-full h-full overflow-visible" preserveAspectRatio="none">
        <defs>
          <linearGradient id="lineGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stop-color="#10B981" stop-opacity="0.25" />
            <stop offset="100%" stop-color="#10B981" stop-opacity="0.0" />
          </linearGradient>
        </defs>
        ${gridLinesSvg}
        <path d="${areaD}" fill="url(#lineGrad)" />
        <path d="${pathD}" fill="none" stroke="#10B981" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" />
        ${interactiveNodes}
      </svg>
    `;
  }

  function renderCategoryDoughnutChart(container, data) {
    container.innerHTML = '';
    const filteredData = data.filter((d) => d.amount > 0);
    const total = filteredData.reduce((sum, d) => sum + d.amount, 0);

    if (total === 0 || filteredData.length === 0) {
      container.innerHTML = '<div class="flex items-center justify-center h-48 text-slate-400 text-sm">No expenses in this month yet</div>';
      return;
    }

    const size = 200;
    const center = size / 2;
    const radius = 80;
    const strokeWidth = 28;
    let cumulativeAngle = 0;
    let slicesSvg = '';

    filteredData.forEach((item) => {
      const fraction = item.amount / total;
      const sweepAngle = fraction * 360;
      const startAngle = cumulativeAngle;
      const endAngle = cumulativeAngle + sweepAngle;
      cumulativeAngle += sweepAngle;

      const startRad = ((startAngle - 90) * Math.PI) / 180;
      const endRad = ((endAngle - 90) * Math.PI) / 180;
      const x1 = center + radius * Math.cos(startRad);
      const y1 = center + radius * Math.sin(startRad);
      const x2 = center + radius * Math.cos(endRad);
      const y2 = center + radius * Math.sin(endRad);
      const largeArcFlag = sweepAngle > 180 ? 1 : 0;
      const color = getCategoryColor(item.category);

      let pathD = '';
      if (fraction >= 0.999) {
        pathD = `M ${center} ${center - radius} A ${radius} ${radius} 0 1 1 ${center - 0.01} ${center - radius}`;
      } else {
        pathD = `M ${x1} ${y1} A ${radius} ${radius} 0 ${largeArcFlag} 1 ${x2} ${y2}`;
      }

      slicesSvg += `<path d="${pathD}" fill="none" stroke="${color}" stroke-width="${strokeWidth}" class="hover:opacity-85 cursor-pointer"></path>`;
    });

    const legendHtml = filteredData
      .sort((a, b) => b.amount - a.amount)
      .slice(0, 6)
      .map((item) => {
        const pct = Math.round((item.amount / total) * 100);
        const color = getCategoryColor(item.category);
        return `
        <div class="flex items-center justify-between text-xs py-1">
          <div class="flex items-center gap-1.5 min-w-0">
            <span class="w-2.5 h-2.5 rounded-full shrink-0" style="background-color: ${color}"></span>
            <span class="text-slate-700 dark:text-slate-300 truncate">${item.category}</span>
          </div>
          <div class="flex items-center gap-2 tabular-nums">
            <span class="font-medium text-slate-900 dark:text-slate-100">${formatCurrency(item.amount)}</span>
            <span class="text-slate-400 text-[11px]">${pct}%</span>
          </div>
        </div>`;
      })
      .join('');

    container.innerHTML = `
      <div class="flex flex-col sm:flex-row items-center gap-6 justify-center">
        <div class="relative w-[${size}px] h-[${size}px] shrink-0">
          <svg viewBox="0 0 ${size} ${size}" class="w-full h-full">${slicesSvg}</svg>
          <div class="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
            <span class="text-[11px] uppercase tracking-wider text-slate-400 font-medium">Total Spent</span>
            <span class="text-base font-bold text-slate-900 dark:text-white tabular-nums font-mono">${formatCurrency(total)}</span>
          </div>
        </div>
        <div class="flex-1 w-full max-w-xs space-y-1">${legendHtml}</div>
      </div>
    `;
  }

  function renderBudgetVsActualChart(container, data) {
    container.innerHTML = '';
    if (!data || data.length === 0) {
      container.innerHTML = '<div class="flex items-center justify-center h-48 text-slate-400 text-sm">No budget categories defined</div>';
      return;
    }
    const height = 240;
    const padding = { top: 20, right: 20, bottom: 40, left: 50 };
    const width = container.clientWidth || 500;
    const innerWidth = width - padding.left - padding.right;
    const innerHeight = height - padding.top - padding.bottom;
    const maxVal = Math.max(...data.map((d) => Math.max(d.planned, d.spent)), 1000);
    const niceMax = Math.ceil(maxVal / 1000) * 1000;

    let gridSvg = '';
    for (let i = 0; i <= 4; i++) {
      const yVal = (niceMax / 4) * i;
      const yPos = padding.top + innerHeight - (yVal / niceMax) * innerHeight;
      gridSvg += `
        <line x1="${padding.left}" y1="${yPos}" x2="${width - padding.right}" y2="${yPos}" stroke="currentColor" stroke-opacity="0.1" stroke-dasharray="2,2" />
        <text x="${padding.left - 6}" y="${yPos + 4}" font-size="10" text-anchor="end" class="fill-slate-400 font-mono">${formatCurrency(yVal)}</text>
      `;
    }

    const groupWidth = innerWidth / data.length;
    const barWidth = Math.min(18, groupWidth * 0.35);
    let barsSvg = '';

    data.forEach((d, i) => {
      const groupX = padding.left + i * groupWidth + (groupWidth - barWidth * 2 - 4) / 2;
      const plannedH = (d.planned / niceMax) * innerHeight;
      const spentH = (d.spent / niceMax) * innerHeight;
      const plannedY = padding.top + innerHeight - plannedH;
      const spentY = padding.top + innerHeight - spentH;

      let spentColor = '#10B981';
      if (d.planned > 0) {
        const pct = (d.spent / d.planned) * 100;
        if (pct >= 100) spentColor = '#EF4444';
        else if (pct >= 75) spentColor = '#F59E0B';
      }

      const shortCat = d.category.length > 6 ? d.category.substring(0, 5) + '…' : d.category;
      barsSvg += `
        <rect x="${groupX}" y="${plannedY}" width="${barWidth}" height="${plannedH}" rx="3" class="fill-slate-300 dark:fill-slate-600">
          <title>Planned: ${formatCurrency(d.planned)}</title>
        </rect>
        <rect x="${groupX + barWidth + 4}" y="${spentY}" width="${barWidth}" height="${spentH}" rx="3" fill="${spentColor}">
          <title>Spent: ${formatCurrency(d.spent)}</title>
        </rect>
        <text x="${groupX + barWidth + 2}" y="${height - 15}" font-size="10" text-anchor="middle" class="fill-slate-400">${shortCat}</text>
      `;
    });

    container.innerHTML = `
      <div class="flex items-center justify-end gap-4 mb-2 text-xs">
        <div class="flex items-center gap-1.5"><span class="w-3 h-3 rounded bg-slate-300 dark:bg-slate-600"></span><span class="text-slate-500">Planned Budget</span></div>
        <div class="flex items-center gap-1.5"><span class="w-3 h-3 rounded bg-emerald-500"></span><span class="text-slate-500">Actual Spending</span></div>
      </div>
      <svg viewBox="0 0 ${width} ${height}" class="w-full h-[220px] overflow-visible">${gridSvg}${barsSvg}</svg>
    `;
  }

  function renderMonthlyComparisonChart(container, monthsData) {
    container.innerHTML = '';
    if (!monthsData || monthsData.length === 0) return;
    const height = 240;
    const padding = { top: 20, right: 20, bottom: 40, left: 55 };
    const width = container.clientWidth || 500;
    const innerWidth = width - padding.left - padding.right;
    const innerHeight = height - padding.top - padding.bottom;
    const maxVal = Math.max(...monthsData.map((d) => Math.max(d.income, d.expenses, d.savings)), 5000);
    const niceMax = Math.ceil(maxVal / 5000) * 5000;

    let gridSvg = '';
    for (let i = 0; i <= 4; i++) {
      const yVal = (niceMax / 4) * i;
      const yPos = padding.top + innerHeight - (yVal / niceMax) * innerHeight;
      gridSvg += `
        <line x1="${padding.left}" y1="${yPos}" x2="${width - padding.right}" y2="${yPos}" stroke="currentColor" stroke-opacity="0.1" stroke-dasharray="2,2" />
        <text x="${padding.left - 6}" y="${yPos + 4}" font-size="10" text-anchor="end" class="fill-slate-400 font-mono">${formatCurrency(yVal)}</text>
      `;
    }

    const groupWidth = innerWidth / monthsData.length;
    const barWidth = Math.min(22, (groupWidth - 20) / 3);
    let barsSvg = '';

    monthsData.forEach((m, idx) => {
      const groupCenter = padding.left + idx * groupWidth + groupWidth / 2;
      const startX = groupCenter - (barWidth * 3 + 8) / 2;
      const incH = (m.income / niceMax) * innerHeight;
      const expH = (m.expenses / niceMax) * innerHeight;
      const savH = (Math.max(0, m.savings) / niceMax) * innerHeight;

      barsSvg += `
        <rect x="${startX}" y="${padding.top + innerHeight - incH}" width="${barWidth}" height="${incH}" rx="3" class="fill-indigo-500"></rect>
        <rect x="${startX + barWidth + 4}" y="${padding.top + innerHeight - expH}" width="${barWidth}" height="${expH}" rx="3" class="fill-rose-500"></rect>
        <rect x="${startX + (barWidth + 4) * 2}" y="${padding.top + innerHeight - savH}" width="${barWidth}" height="${savH}" rx="3" class="fill-emerald-500"></rect>
        <text x="${groupCenter}" y="${height - 12}" font-size="11" text-anchor="middle" class="fill-slate-400 font-medium">${m.monthLabel}</text>
      `;
    });

    container.innerHTML = `
      <div class="flex items-center justify-end gap-4 mb-2 text-xs">
        <div class="flex items-center gap-1.5"><span class="w-3 h-3 rounded bg-indigo-500"></span><span class="text-slate-500">Income</span></div>
        <div class="flex items-center gap-1.5"><span class="w-3 h-3 rounded bg-rose-500"></span><span class="text-slate-500">Expenses</span></div>
        <div class="flex items-center gap-1.5"><span class="w-3 h-3 rounded bg-emerald-500"></span><span class="text-slate-500">Savings</span></div>
      </div>
      <svg viewBox="0 0 ${width} ${height}" class="w-full h-[220px] overflow-visible">${gridSvg}${barsSvg}</svg>
    `;
  }

  // -------------------------------------------------------------
  // AI ASSISTANT LOGIC
  // -------------------------------------------------------------
  function generateSmartInsights(month) {
    const expenses = getExpenses().filter((e) => e.date.startsWith(month));
    const budget = getBudget(month);
    const insights = [];

    if (expenses.length === 0) {
      insights.push('💡 Start logging your daily expenses to unlock smart AI spending insights.');
      return insights;
    }

    const catTotals = {};
    expenses.forEach((e) => {
      catTotals[e.category] = (catTotals[e.category] || 0) + Number(e.amount);
    });

    const sortedCats = Object.entries(catTotals).sort((a, b) => b[1] - a[1]);
    if (sortedCats.length > 0) {
      const highest = sortedCats[0];
      const totalSpent = calculateMonthlyTotal(month);
      const pct = totalSpent > 0 ? Math.round((highest[1] / totalSpent) * 100) : 0;
      insights.push(
        `📊 <strong>${highest[0]}</strong> is currently your highest spending category at <strong>${formatCurrency(highest[1])}</strong> (${pct}% of total spent).`
      );
    }

    const uniqueDays = new Set(expenses.map((e) => e.date)).size;
    const totalSpent = calculateMonthlyTotal(month);
    const dailyAvg = uniqueDays > 0 ? Math.round(totalSpent / uniqueDays) : 0;
    insights.push(`🗓️ Your average daily spending across active days is <strong>${formatCurrency(dailyAvg)}</strong>.`);

    if (budget) {
      const planned = calculatePlannedExpenses(budget);
      const remaining = planned - totalSpent;
      if (remaining >= 0) {
        insights.push(`✅ You have <strong>${formatCurrency(remaining)}</strong> remaining this month and are currently within your planned budget.`);
      } else {
        insights.push(`⚠️ Your expenses exceed your planned monthly budget by <strong>${formatCurrency(Math.abs(remaining))}</strong>.`);
      }
    }
    return insights;
  }

  function handleUserChatMessage(userText, currentMonth) {
    const text = userText.trim().toLowerCase();

    if (wizardState.active) {
      const cleanedNum = Number(userText.replace(/[^0-9]/g, ''));
      if (wizardState.step === 1) {
        if (!cleanedNum || cleanedNum < 1000) {
          return { response: 'Please enter a valid monthly income number (e.g. ₹35,000).', quickReplies: ['₹25,000', '₹35,000', '₹50,000'] };
        }
        wizardState.income = cleanedNum;
        wizardState.step = 2;
        return {
          response: `Got it: Monthly Income is **${formatCurrency(wizardState.income)}**.\n\n**Step 2 of 4:** What are your fixed obligations (Rent, maintenance, bills, EMI)?`,
          quickReplies: [`${formatCurrency(Math.round(cleanedNum * 0.35))}`, '₹12,000'],
        };
      }
      if (wizardState.step === 2) {
        wizardState.fixedExpenses = cleanedNum || Math.round(wizardState.income * 0.35);
        wizardState.step = 3;
        return {
          response: `Noted: Fixed obligations estimated at **${formatCurrency(wizardState.fixedExpenses)}**.\n\n**Step 3 of 4:** What are your primary variable spending areas?`,
          quickReplies: ['Food & Groceries', 'Transport & Fuel', 'Shopping & Dining'],
        };
      }
      if (wizardState.step === 3) {
        wizardState.majorCategories.push(userText);
        wizardState.step = 4;
        const suggestedSavings = Math.round(wizardState.income * 0.2);
        return {
          response: `Great! **Step 4 of 4:** How much would you like to set aside as **Savings** each month?`,
          quickReplies: [`${formatCurrency(suggestedSavings)} (20%)`, `${formatCurrency(Math.round(wizardState.income * 0.15))} (15%)`],
        };
      }
      if (wizardState.step === 4) {
        const income = wizardState.income;
        const savings = cleanedNum || Math.round(income * 0.2);
        const bills = Math.min(wizardState.fixedExpenses, Math.round(income * 0.5));
        const rem = Math.max(0, income - savings - bills);

        const allocation = {
          Food: Math.round(rem * 0.35),
          Transport: Math.round(rem * 0.18),
          Bills: bills,
          Education: Math.round(rem * 0.12),
          Shopping: Math.round(rem * 0.14),
          Entertainment: Math.round(rem * 0.08),
          Health: Math.round(rem * 0.07),
          Family: Math.round(rem * 0.06),
          Savings: savings,
          Other: 0,
        };

        wizardState = { active: false, step: 0, income: 0, fixedExpenses: 0, majorCategories: [], savingsTarget: 0 };
        return {
          response: `🎉 **Suggested Monthly Budget Created!**\n\n• Income: ${formatCurrency(income)}\n• Food: ${formatCurrency(allocation.Food)}\n• Transport: ${formatCurrency(allocation.Transport)}\n• Bills & Rent: ${formatCurrency(allocation.Bills)}\n• Savings: ${formatCurrency(allocation.Savings)}\n\n*Notice: Budgeting suggestion only, not financial advice.*`,
          quickReplies: ['Apply this Budget to my Account', 'How much have I spent this month?'],
          suggestedBudget: { income, allocation },
        };
      }
    }

    if (text.includes('spent this month') || text.includes('how much have i spent')) {
      const total = calculateMonthlyTotal(currentMonth);
      return {
        response: `You have spent **${formatCurrency(total)}** in ${currentMonth}.`,
        quickReplies: ['Where am I spending the most?', 'How much budget is remaining?'],
      };
    }

    if (text.includes('spending the most') || text.includes('highest spending')) {
      const expenses = getExpenses().filter((e) => e.date.startsWith(currentMonth));
      const catTotals = {};
      expenses.forEach((e) => (catTotals[e.category] = (catTotals[e.category] || 0) + Number(e.amount)));
      const sorted = Object.entries(catTotals).sort((a, b) => b[1] - a[1]);
      const top = sorted[0];
      return {
        response: top ? `Your highest spending category is **${top[0]}** with **${formatCurrency(top[1])}**.` : 'No expenses logged yet!',
        quickReplies: ['How much budget is remaining?', 'Help me create a monthly budget'],
      };
    }

    if (text.includes('budget is remaining') || text.includes('remaining budget')) {
      const budget = getBudget(currentMonth);
      const spent = calculateMonthlyTotal(currentMonth);
      const planned = budget ? calculatePlannedExpenses(budget) : 25000;
      const rem = planned - spent;
      return {
        response: `Planned: **${formatCurrency(planned)}**\nSpent: **${formatCurrency(spent)}**\nRemaining: **${formatCurrency(rem)}**.`,
        quickReplies: ['Where am I spending the most?', 'Analyze my spending'],
      };
    }

    if (text.includes('create a monthly budget') || text.includes('create budget')) {
      wizardState = { active: true, step: 1, income: 0, fixedExpenses: 0, majorCategories: [], savingsTarget: 0 };
      return {
        response: `👋 Let's build your personalized monthly budget!\n\n**Step 1 of 4:** What is your estimated **monthly income**?`,
        quickReplies: ['₹25,000', '₹35,000', '₹50,000'],
      };
    }

    return {
      response: `I am your BudgetWise AI Assistant! Ask me about your spending or choose below:`,
      quickReplies: ['How much have I spent this month?', 'Where am I spending the most?', 'How much budget is remaining?', 'Help me create a monthly budget'],
    };
  }

  // -------------------------------------------------------------
  // UI RENDERERS
  // -------------------------------------------------------------
  function showToast(message, type) {
    const container = document.getElementById('toast-container');
    if (!container) return;
    const toast = document.createElement('div');
    const bg = type === 'error' ? 'bg-rose-600' : 'bg-emerald-600';
    toast.className = `${bg} text-white px-4 py-2.5 rounded-xl shadow-lg text-xs font-semibold flex items-center gap-2 animate-slide-up`;
    toast.innerHTML = `<span>${type === 'error' ? '✕' : '✓'}</span><span>${message}</span>`;
    container.appendChild(toast);
    setTimeout(() => toast.remove(), 3000);
  }

  function updateDashboard() {
    const budget = getBudget(currentMonth);
    const totalPlanned = budget ? calculatePlannedExpenses(budget) : 25000;
    const totalSpent = calculateMonthlyTotal(currentMonth);
    const remaining = totalPlanned - totalSpent;
    const todaySpent = calculateDailySpending('2026-10-02');
    const savings = budget ? Number(budget.income) - totalSpent : remaining;

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
    const pct = totalPlanned > 0 ? (totalSpent / totalPlanned) * 100 : 0;
    if (elSpentPct) elSpentPct.textContent = `${Math.round(pct)}% of monthly budget`;
    if (elRemaining) elRemaining.textContent = formatCurrency(remaining);

    let status = pct >= 100 ? 'Over Budget' : pct >= 75 ? 'Near Limit' : 'Safe · On Track';
    let statusClass = pct >= 100 ? 'text-rose-600' : pct >= 75 ? 'text-amber-600' : 'text-emerald-600';
    let barColor = pct >= 100 ? 'bg-rose-500' : pct >= 75 ? 'bg-amber-500' : 'bg-emerald-500';

    if (elRemainingStatus) {
      elRemainingStatus.textContent = status;
      elRemainingStatus.className = `text-[11px] font-semibold mt-1 ${statusClass}`;
    }

    if (elTodaySpent) elTodaySpent.textContent = formatCurrency(todaySpent);
    const count = getExpenses().filter((e) => e.date === '2026-10-02').length;
    if (elTodayTxns) elTodayTxns.textContent = `${count} transactions today`;
    if (elSavings) elSavings.textContent = formatCurrency(savings);

    // Progress bar
    const bar = document.getElementById('dash-budget-progress-bar');
    const pctText = document.getElementById('dash-budget-pct-text');
    const spentInline = document.getElementById('dash-spent-inline');
    const remInline = document.getElementById('dash-remaining-inline');
    const bgtInline = document.getElementById('dash-budget-inline');

    if (bar) {
      bar.style.width = `${Math.min(100, Math.max(0, pct))}%`;
      bar.className = `${barColor} h-full rounded-full transition-all duration-300`;
    }
    if (pctText) pctText.textContent = `${pct.toFixed(1)}% Used`;
    if (spentInline) spentInline.textContent = formatCurrency(totalSpent);
    if (remInline) remInline.textContent = formatCurrency(remaining);
    if (bgtInline) bgtInline.textContent = formatCurrency(totalPlanned);

    // Sidebar
    const sBar = document.getElementById('sidebar-progress-bar');
    const sStatus = document.getElementById('sidebar-budget-status');
    const sRem = document.getElementById('sidebar-remaining-val');
    if (sBar) {
      sBar.style.width = `${Math.min(100, Math.max(0, pct))}%`;
      sBar.className = `${barColor} h-full rounded-full transition-all`;
    }
    if (sStatus) sStatus.textContent = status;
    if (sRem) sRem.textContent = formatCurrency(remaining);

    // Charts
    const dailyContainer = document.getElementById('dash-daily-chart-container');
    if (dailyContainer) {
      const expenses = getExpenses().filter((e) => e.date.startsWith(currentMonth));
      const daysMap = {};
      for (let day = 1; day <= 10; day++) {
        daysMap[`${currentMonth}-${day.toString().padStart(2, '0')}`] = 0;
      }
      expenses.forEach((e) => {
        daysMap[e.date] = (daysMap[e.date] || 0) + Number(e.amount);
      });
      const cData = Object.entries(daysMap)
        .sort((a, b) => a[0].localeCompare(b[0]))
        .map(([date, amount]) => ({ date, label: date.substring(8), amount }));
      renderDailyLineChart(dailyContainer, cData);
    }

    const catContainer = document.getElementById('dash-category-chart-container');
    if (catContainer) {
      const cData = EXPENSE_CATEGORIES.map((cat) => ({
        category: cat,
        amount: calculateCategoryTotal(currentMonth, cat),
      }));
      renderCategoryDoughnutChart(catContainer, cData);
    }

    // Recent txns table
    const tbody = document.getElementById('dash-recent-txns-tbody');
    if (tbody) {
      const recent = getExpenses().filter((e) => e.date.startsWith(currentMonth)).slice(0, 5);
      tbody.innerHTML = recent
        .map(
          (e) => `
        <tr class="hover:bg-slate-50 dark:hover:bg-slate-800/40">
          <td class="py-2.5 px-3 text-slate-500 font-mono">${e.date}</td>
          <td class="py-2.5 px-3 font-medium text-slate-900 dark:text-white">${e.description}</td>
          <td class="py-2.5 px-3"><span class="inline-flex items-center gap-1.5"><span class="w-2 h-2 rounded-full" style="background-color: ${getCategoryColor(e.category)}"></span>${e.category}</span></td>
          <td class="py-2.5 px-3 text-slate-500">${e.paymentMethod}</td>
          <td class="py-2.5 px-3 text-right font-bold tabular-nums font-mono">${formatCurrency(e.amount)}</td>
          <td class="py-2.5 px-3 text-right">
            <button data-action="delete-expense" data-id="${e.id}" class="text-slate-400 hover:text-rose-600 p-1">Delete</button>
          </td>
        </tr>`
        )
        .join('');
    }

    // Goals mini
    const goalsContainer = document.getElementById('dash-goals-list');
    if (goalsContainer) {
      const goals = getSavingsGoals().slice(0, 3);
      goalsContainer.innerHTML = goals
        .map((g) => {
          const gPct = Math.min(100, Math.round((g.currentAmount / g.targetAmount) * 100));
          return `
          <div class="p-3 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-100 dark:border-slate-800">
            <div class="flex items-center justify-between text-xs mb-1">
              <span class="font-bold truncate">${g.title}</span>
              <span class="font-bold text-emerald-600">${gPct}%</span>
            </div>
            <div class="w-full bg-slate-200 dark:bg-slate-700 h-1.5 rounded-full overflow-hidden mb-2">
              <div class="bg-emerald-500 h-full rounded-full" style="width: ${gPct}%"></div>
            </div>
            <div class="flex items-center justify-between text-[11px] text-slate-500 font-mono">
              <span>${formatCurrency(g.currentAmount)}</span>
              <span>of ${formatCurrency(g.targetAmount)}</span>
            </div>
          </div>`;
        })
        .join('');
    }

    const insightLine = document.getElementById('dashboard-smart-insight-line');
    if (insightLine) {
      const ins = generateSmartInsights(currentMonth);
      insightLine.innerHTML = ins[0] || '<span>💡 Track daily expenses for smart insights.</span>';
    }
  }

  // View switcher
  function switchView(viewName) {
    currentView = viewName;
    const views = ['dashboard', 'expenses', 'budget', 'daily', 'analytics', 'goals', 'assistant', 'settings'];
    views.forEach((v) => {
      const el = document.getElementById(`view-${v}`);
      if (el) el.classList.toggle('hidden', v !== viewName);
    });

    document.querySelectorAll('.nav-item').forEach((item) => {
      const target = item.getAttribute('data-nav');
      if (target === viewName) {
        item.className = 'nav-item w-full flex items-center gap-3 px-3.5 py-2.5 rounded-lg text-sm font-medium transition-colors text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40';
      } else {
        item.className = 'nav-item w-full flex items-center gap-3 px-3.5 py-2.5 rounded-lg text-sm font-medium transition-colors text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-white';
      }
    });

    const titleEl = document.getElementById('current-view-title');
    if (titleEl) {
      titleEl.textContent =
        viewName === 'goals' ? 'Savings Goals' : viewName === 'daily' ? 'Daily Spending' : viewName === 'budget' ? 'Monthly Budget' : viewName.charAt(0).toUpperCase() + viewName.slice(1);
    }

    updateDashboard();
    if (viewName === 'expenses') renderExpenses();
    if (viewName === 'budget') renderBudget();
    if (viewName === 'daily') renderDaily();
    if (viewName === 'analytics') renderAnalytics();
    if (viewName === 'goals') renderGoals();
  }

  function renderExpenses() {
    const tbody = document.getElementById('txns-full-tbody');
    if (!tbody) return;
    const expenses = getExpenses();
    tbody.innerHTML = expenses
      .map(
        (e) => `
      <tr class="hover:bg-slate-50 dark:hover:bg-slate-800/40">
        <td class="py-3 px-4 font-mono text-slate-500">${e.date}</td>
        <td class="py-3 px-4 font-medium text-slate-900 dark:text-white">${e.description}</td>
        <td class="py-3 px-4"><span class="inline-flex items-center gap-1.5"><span class="w-2.5 h-2.5 rounded-full" style="background-color: ${getCategoryColor(e.category)}"></span>${e.category}</span></td>
        <td class="py-3 px-4 text-slate-500">${e.paymentMethod}</td>
        <td class="py-3 px-4 text-right font-bold font-mono">${formatCurrency(e.amount)}</td>
        <td class="py-3 px-4 text-right">
          <button data-action="delete-expense" data-id="${e.id}" class="text-rose-600 hover:underline text-xs">Delete</button>
        </td>
      </tr>`
      )
      .join('');
  }

  function renderBudget() {
    const budget = getBudget(currentMonth);
    const tbody = document.getElementById('budget-tracking-tbody');
    if (!tbody) return;
    const catBudgets = budget?.categoryBudgets || {};

    tbody.innerHTML = BUDGET_CATEGORIES.map((cat) => {
      const planned = catBudgets[cat] || 0;
      const spent = cat === 'Savings' ? 0 : calculateCategoryTotal(currentMonth, cat);
      const rem = planned - spent;
      const pct = planned > 0 ? (spent / planned) * 100 : 0;
      let status = pct >= 100 ? 'Over Budget' : pct >= 75 ? 'Near Limit' : 'Safe';
      let statusClass = pct >= 100 ? 'bg-rose-100 text-rose-700' : pct >= 75 ? 'bg-amber-100 text-amber-700' : 'bg-emerald-100 text-emerald-700';

      return `
        <tr class="hover:bg-slate-50 dark:hover:bg-slate-800/40">
          <td class="py-3 px-4 font-bold">${cat}</td>
          <td class="py-3 px-4 font-mono font-semibold">${formatCurrency(planned)}</td>
          <td class="py-3 px-4 text-right font-mono font-semibold">${formatCurrency(spent)}</td>
          <td class="py-3 px-4 text-right font-mono font-bold ${rem < 0 ? 'text-rose-600' : 'text-emerald-600'}">${formatCurrency(rem)}</td>
          <td class="py-3 px-4">
            <div class="w-full bg-slate-100 dark:bg-slate-800 h-2 rounded-full overflow-hidden">
              <div class="bg-emerald-500 h-full" style="width: ${Math.min(100, pct)}%"></div>
            </div>
          </td>
          <td class="py-3 px-4 text-center"><span class="text-xs px-2 py-0.5 rounded font-semibold ${statusClass}">${status}</span></td>
        </tr>`;
    }).join('');
  }

  function renderDaily() {
    const expenses = getExpenses().filter((e) => e.date === selectedDailyDate);
    const tbody = document.getElementById('daily-txns-tbody');
    if (tbody) {
      tbody.innerHTML = expenses
        .map(
          (e) => `
        <tr class="hover:bg-slate-50 dark:hover:bg-slate-800/40">
          <td class="py-2.5 px-3 font-medium">${e.description}</td>
          <td class="py-2.5 px-3">${e.category}</td>
          <td class="py-2.5 px-3 text-slate-500">${e.paymentMethod}</td>
          <td class="py-2.5 px-3 text-right font-bold font-mono">${formatCurrency(e.amount)}</td>
          <td class="py-2.5 px-3 text-right"><button data-action="delete-expense" data-id="${e.id}" class="text-rose-600 hover:underline">Delete</button></td>
        </tr>`
        )
        .join('');
    }
  }

  function renderAnalytics() {
    const c1 = document.getElementById('analytics-chart-1');
    const c2 = document.getElementById('analytics-chart-2');
    const c3 = document.getElementById('analytics-chart-3');
    const c4 = document.getElementById('analytics-chart-4');

    if (c1) {
      const expenses = getExpenses().filter((e) => e.date.startsWith(currentMonth));
      const dayGroups = {};
      for (let day = 1; day <= 10; day++) {
        dayGroups[`${currentMonth}-${day.toString().padStart(2, '0')}`] = 0;
      }
      expenses.forEach((e) => (dayGroups[e.date] = (dayGroups[e.date] || 0) + Number(e.amount)));
      const data = Object.entries(dayGroups).map(([date, amount]) => ({ date, label: date.substring(8), amount }));
      renderDailyLineChart(c1, data);
    }
    if (c2) {
      const data = EXPENSE_CATEGORIES.map((cat) => ({ category: cat, amount: calculateCategoryTotal(currentMonth, cat) }));
      renderCategoryDoughnutChart(c2, data);
    }
    if (c3) {
      const budget = getBudget(currentMonth);
      const catBudgets = budget?.categoryBudgets || {};
      const data = EXPENSE_CATEGORIES.map((cat) => ({
        category: cat,
        planned: catBudgets[cat] || 0,
        spent: calculateCategoryTotal(currentMonth, cat),
      }));
      renderBudgetVsActualChart(c3, data);
    }
    if (c4) {
      const budgets = getBudgets();
      const data = budgets.map((b) => {
        const exp = calculateMonthlyTotal(b.month);
        const inc = b.income || 35000;
        return { monthLabel: b.month, income: inc, expenses: exp, savings: inc - exp };
      });
      renderMonthlyComparisonChart(c4, data);
    }
  }

  function renderGoals() {
    const container = document.getElementById('goals-cards-grid');
    if (!container) return;
    const goals = getSavingsGoals();
    container.innerHTML = goals
      .map((g) => {
        const pct = Math.min(100, Math.round((g.currentAmount / g.targetAmount) * 100));
        return `
        <div class="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs space-y-4">
          <div class="flex items-center justify-between">
            <span class="text-xs font-semibold px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800">${g.category || 'General'}</span>
            <button data-action="delete-goal" data-id="${g.id}" class="text-slate-400 hover:text-rose-600">Delete</button>
          </div>
          <h3 class="text-base font-bold">${g.title}</h3>
          <div>
            <div class="flex justify-between text-xs mb-1"><span>Progress</span><span class="font-bold">${pct}%</span></div>
            <div class="w-full bg-slate-100 dark:bg-slate-800 h-2 rounded-full overflow-hidden">
              <div class="bg-emerald-500 h-full" style="width: ${pct}%"></div>
            </div>
            <div class="flex justify-between text-xs mt-2 font-mono">
              <span>${formatCurrency(g.currentAmount)}</span>
              <span>of ${formatCurrency(g.targetAmount)}</span>
            </div>
          </div>
        </div>`;
      })
      .join('');
  }

  // -------------------------------------------------------------
  // EVENT LISTENERS
  // -------------------------------------------------------------
  function setupEvents() {
    document.querySelectorAll('[data-nav]').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        const target = e.currentTarget.getAttribute('data-nav');
        if (target) switchView(target);
      });
    });

    // Theme toggle
    const toggleTheme = () => {
      const cur = getSettings().theme;
      const next = cur === 'dark' ? 'light' : 'dark';
      saveSettings({ theme: next });
      document.documentElement.classList.toggle('dark', next === 'dark');
    };
    document.getElementById('theme-toggle-btn')?.addEventListener('click', toggleTheme);
    document.getElementById('mobile-theme-toggle')?.addEventListener('click', toggleTheme);

    // Delete actions
    document.addEventListener('click', (e) => {
      const btn = e.target.closest('[data-action="delete-expense"]');
      if (btn) {
        const id = btn.getAttribute('data-id');
        if (confirm('Delete this expense?')) {
          deleteExpense(id);
          showToast('Expense deleted', 'success');
          updateDashboard();
          if (currentView === 'expenses') renderExpenses();
        }
      }
    });

    // Chat Drawer
    const floatingBtn = document.getElementById('floating-ai-btn');
    const drawer = document.getElementById('ai-chat-drawer');
    const closeBtn = document.getElementById('close-ai-drawer-btn');
    floatingBtn?.addEventListener('click', () => drawer?.classList.remove('translate-x-full'));
    closeBtn?.addEventListener('click', () => drawer?.classList.add('translate-x-full'));

    document.getElementById('drawer-chat-form')?.addEventListener('submit', (e) => {
      e.preventDefault();
      const input = document.getElementById('drawer-chat-input');
      if (input && input.value) {
        const val = input.value;
        input.value = '';
        const res = handleUserChatMessage(val, currentMonth);
        const container = document.getElementById('drawer-chat-messages');
        if (container) {
          container.innerHTML += `
            <div class="text-right"><span class="bg-emerald-600 text-white px-3 py-1.5 rounded-xl inline-block text-xs">${val}</span></div>
            <div class="text-left"><span class="bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200 px-3 py-1.5 rounded-xl inline-block text-xs leading-relaxed">${res.response.replace(/\n/g, '<br/>')}</span></div>
          `;
          container.scrollTop = container.scrollHeight;
        }
      }
    });
  }

  // Init
  ensureInitialized();
  const settings = getSettings();
  if (settings.theme === 'dark') document.documentElement.classList.add('dark');
  setupEvents();
  updateDashboard();
})();
