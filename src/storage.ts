import {
  Expense,
  MonthlyBudget,
  SavingsGoal,
  UserSettings,
  NotificationItem,
  ExpenseCategory,
} from './types';

const STORAGE_KEYS = {
  EXPENSES: 'budgetwise_expenses',
  BUDGETS: 'budgetwise_budgets',
  GOALS: 'budgetwise_goals',
  SETTINGS: 'budgetwise_settings',
  NOTIFICATIONS: 'budgetwise_notifications',
  INITIALIZED: 'budgetwise_initialized_v2',
};

export const DEFAULT_SETTINGS: UserSettings = {
  currencySymbol: '₹',
  currencyCode: 'INR',
  theme: 'light',
  alertNearLimitPercent: 75,
  enableNotifications: true,
};

// Formats a number with currency symbol and commas
export function formatCurrency(amount: number, symbol?: string): string {
  const settings = getSettings();
  const s = symbol !== undefined ? symbol : settings.currencySymbol;
  const isNegative = amount < 0;
  const absVal = Math.abs(amount);

  // Format Indian style or international based on INR
  let formattedNumber = '';
  if (settings.currencyCode === 'INR') {
    formattedNumber = absVal.toLocaleString('en-IN', {
      maximumFractionDigits: 0,
    });
  } else {
    formattedNumber = absVal.toLocaleString('en-US', {
      maximumFractionDigits: 0,
    });
  }

  return `${isNegative ? '-' : ''}${s}${formattedNumber}`;
}

// -------------------------------------------------------------
// EXPENSES API
// -------------------------------------------------------------

export function getExpenses(): Expense[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.EXPENSES);
    if (!raw) return [];
    return JSON.parse(raw);
  } catch (e) {
    console.error('Failed to parse expenses from localStorage', e);
    return [];
  }
}

export function saveExpense(expenseData: Omit<Expense, 'id' | 'createdAt' | 'updatedAt' | 'userId'> & { id?: string }): Expense {
  const expenses = getExpenses();
  const now = new Date().toISOString();
  
  if (expenseData.id) {
    // Update existing
    const index = expenses.findIndex((e) => e.id === expenseData.id);
    if (index !== -1) {
      const updated: Expense = {
        ...expenses[index],
        ...expenseData,
        updatedAt: now,
      };
      expenses[index] = updated;
      localStorage.setItem(STORAGE_KEYS.EXPENSES, JSON.stringify(expenses));
      checkBudgetAlerts(expenseData.date.substring(0, 7));
      return updated;
    }
  }

  // Create new
  const newExpense: Expense = {
    id: 'exp_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7),
    userId: 1,
    amount: Number(expenseData.amount),
    date: expenseData.date,
    category: expenseData.category,
    description: expenseData.description.trim(),
    paymentMethod: expenseData.paymentMethod,
    note: expenseData.note?.trim() || '',
    createdAt: now,
    updatedAt: now,
  };

  expenses.unshift(newExpense);
  localStorage.setItem(STORAGE_KEYS.EXPENSES, JSON.stringify(expenses));
  checkBudgetAlerts(newExpense.date.substring(0, 7));
  return newExpense;
}

export function updateExpense(id: string, updatedData: Partial<Expense>): Expense | null {
  const expenses = getExpenses();
  const index = expenses.findIndex((e) => e.id === id);
  if (index === -1) return null;

  const updated: Expense = {
    ...expenses[index],
    ...updatedData,
    amount: updatedData.amount !== undefined ? Number(updatedData.amount) : expenses[index].amount,
    updatedAt: new Date().toISOString(),
  };

  expenses[index] = updated;
  localStorage.setItem(STORAGE_KEYS.EXPENSES, JSON.stringify(expenses));
  checkBudgetAlerts(updated.date.substring(0, 7));
  return updated;
}

export function deleteExpense(id: string): boolean {
  const expenses = getExpenses();
  const expenseToDelete = expenses.find((e) => e.id === id);
  const filtered = expenses.filter((e) => e.id !== id);
  if (filtered.length === expenses.length) return false;

  localStorage.setItem(STORAGE_KEYS.EXPENSES, JSON.stringify(filtered));
  if (expenseToDelete) {
    checkBudgetAlerts(expenseToDelete.date.substring(0, 7));
  }
  return true;
}

// -------------------------------------------------------------
// BUDGETS API
// -------------------------------------------------------------

export function getBudgets(): MonthlyBudget[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.BUDGETS);
    if (!raw) return [];
    return JSON.parse(raw);
  } catch (e) {
    console.error('Failed to parse budgets', e);
    return [];
  }
}

export function getBudget(month: string): MonthlyBudget | null {
  const budgets = getBudgets();
  return budgets.find((b) => b.month === month) || null;
}

export function saveBudget(budgetData: Omit<MonthlyBudget, 'id' | 'createdAt' | 'updatedAt' | 'userId'> & { id?: string }): MonthlyBudget {
  const budgets = getBudgets();
  const now = new Date().toISOString();
  const existingIndex = budgets.findIndex((b) => b.month === budgetData.month);

  if (existingIndex !== -1) {
    const updated: MonthlyBudget = {
      ...budgets[existingIndex],
      ...budgetData,
      income: Number(budgetData.income),
      updatedAt: now,
    };
    budgets[existingIndex] = updated;
    localStorage.setItem(STORAGE_KEYS.BUDGETS, JSON.stringify(budgets));
    checkBudgetAlerts(budgetData.month);
    return updated;
  }

  const newBudget: MonthlyBudget = {
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
  checkBudgetAlerts(budgetData.month);
  return newBudget;
}

// -------------------------------------------------------------
// CALCULATIONS
// -------------------------------------------------------------

export function calculateMonthlyTotal(month: string): number {
  const expenses = getExpenses();
  return expenses
    .filter((e) => e.date.startsWith(month))
    .reduce((sum, e) => sum + Number(e.amount), 0);
}

export function calculateCategoryTotal(month: string, category: string): number {
  const expenses = getExpenses();
  return expenses
    .filter((e) => e.date.startsWith(month) && e.category === category)
    .reduce((sum, e) => sum + Number(e.amount), 0);
}

export function calculatePlannedExpenses(budget: MonthlyBudget | null): number {
  if (!budget || !budget.categoryBudgets) return 0;
  return Object.values(budget.categoryBudgets).reduce((sum, val) => sum + (Number(val) || 0), 0);
}

export function calculateRemainingBudget(month: string): number {
  const budget = getBudget(month);
  const planned = budget ? calculatePlannedExpenses(budget) : 0;
  const spent = calculateMonthlyTotal(month);
  return planned - spent;
}

export function calculateSavings(month: string): number {
  const budget = getBudget(month);
  if (!budget) return 0;
  const spent = calculateMonthlyTotal(month);
  return (Number(budget.income) || 0) - spent;
}

export function calculateDailySpending(dateString: string): number {
  const expenses = getExpenses();
  return expenses
    .filter((e) => e.date === dateString)
    .reduce((sum, e) => sum + Number(e.amount), 0);
}

// -------------------------------------------------------------
// SAVINGS GOALS API
// -------------------------------------------------------------

export function getSavingsGoals(): SavingsGoal[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.GOALS);
    if (!raw) return [];
    return JSON.parse(raw);
  } catch (e) {
    console.error('Failed to parse savings goals', e);
    return [];
  }
}

export function saveSavingsGoal(goalData: Omit<SavingsGoal, 'id' | 'createdAt' | 'updatedAt' | 'userId'> & { id?: string }): SavingsGoal {
  const goals = getSavingsGoals();
  const now = new Date().toISOString();

  if (goalData.id) {
    const index = goals.findIndex((g) => g.id === goalData.id);
    if (index !== -1) {
      const updated: SavingsGoal = {
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

  const newGoal: SavingsGoal = {
    id: 'goal_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7),
    userId: 1,
    title: goalData.title.trim(),
    targetAmount: Number(goalData.targetAmount),
    currentAmount: Number(goalData.currentAmount || 0),
    targetDate: goalData.targetDate,
    category: goalData.category || 'General',
    notes: goalData.notes?.trim() || '',
    createdAt: now,
    updatedAt: now,
  };

  goals.push(newGoal);
  localStorage.setItem(STORAGE_KEYS.GOALS, JSON.stringify(goals));
  return newGoal;
}

export function updateSavingsGoal(id: string, updatedData: Partial<SavingsGoal>): SavingsGoal | null {
  const goals = getSavingsGoals();
  const index = goals.findIndex((g) => g.id === id);
  if (index === -1) return null;

  const updated: SavingsGoal = {
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

export function addMoneyToGoal(id: string, amount: number): SavingsGoal | null {
  const goals = getSavingsGoals();
  const index = goals.findIndex((g) => g.id === id);
  if (index === -1) return null;

  const goal = goals[index];
  const newAmount = Math.max(0, goal.currentAmount + Number(amount));
  goal.currentAmount = newAmount;
  goal.updatedAt = new Date().toISOString();

  goals[index] = goal;
  localStorage.setItem(STORAGE_KEYS.GOALS, JSON.stringify(goals));

  if (newAmount >= goal.targetAmount) {
    addNotification({
      type: 'success',
      title: '🎯 Savings Goal Reached!',
      message: `Congratulations! You have reached 100% of your target for "${goal.title}"!`,
    });
  }

  return goal;
}

export function deleteSavingsGoal(id: string): boolean {
  const goals = getSavingsGoals();
  const filtered = goals.filter((g) => g.id !== id);
  if (filtered.length === goals.length) return false;
  localStorage.setItem(STORAGE_KEYS.GOALS, JSON.stringify(filtered));
  return true;
}

// -------------------------------------------------------------
// SETTINGS & NOTIFICATIONS
// -------------------------------------------------------------

export function getSettings(): UserSettings {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.SETTINGS);
    if (!raw) return DEFAULT_SETTINGS;
    return { ...DEFAULT_SETTINGS, ...JSON.parse(raw) };
  } catch (e) {
    return DEFAULT_SETTINGS;
  }
}

export function saveSettings(settings: Partial<UserSettings>): UserSettings {
  const current = getSettings();
  const updated = { ...current, ...settings };
  localStorage.setItem(STORAGE_KEYS.SETTINGS, JSON.stringify(updated));
  return updated;
}

export function getNotifications(): NotificationItem[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.NOTIFICATIONS);
    if (!raw) return [];
    return JSON.parse(raw);
  } catch (e) {
    return [];
  }
}

export function addNotification(item: Omit<NotificationItem, 'id' | 'timestamp' | 'read'>): NotificationItem {
  const notifications = getNotifications();
  const newNotification: NotificationItem = {
    id: 'notif_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6),
    ...item,
    timestamp: new Date().toISOString(),
    read: false,
  };
  notifications.unshift(newNotification);
  // Keep last 30
  if (notifications.length > 30) notifications.length = 30;
  localStorage.setItem(STORAGE_KEYS.NOTIFICATIONS, JSON.stringify(notifications));
  return newNotification;
}

export function markNotificationsRead(): void {
  const notifications = getNotifications();
  notifications.forEach((n) => (n.read = true));
  localStorage.setItem(STORAGE_KEYS.NOTIFICATIONS, JSON.stringify(notifications));
}

export function clearNotifications(): void {
  localStorage.setItem(STORAGE_KEYS.NOTIFICATIONS, JSON.stringify([]));
}

// Alert verification
export function checkBudgetAlerts(month: string): void {
  const budget = getBudget(month);
  if (!budget) return;

  const settings = getSettings();
  if (!settings.enableNotifications) return;

  const threshold = settings.alertNearLimitPercent || 75;

  Object.entries(budget.categoryBudgets).forEach(([category, limit]) => {
    const limitNum = Number(limit);
    if (limitNum <= 0) return;
    const spent = calculateCategoryTotal(month, category);
    const percent = (spent / limitNum) * 100;

    if (percent >= 100) {
      addNotification({
        type: 'alert',
        title: `🔴 ${category} Over Budget`,
        message: `You have spent ${formatCurrency(spent)} of your ${formatCurrency(limitNum)} budget (${Math.round(percent)}%). Consider reviewing recent expenses.`,
      });
    } else if (percent >= threshold) {
      addNotification({
        type: 'warning',
        title: `⚠️ ${category} Approaching Limit`,
        message: `You have used ${Math.round(percent)}% of your ${category} budget (${formatCurrency(spent)} of ${formatCurrency(limitNum)}).`,
      });
    }
  });
}

// -------------------------------------------------------------
// DEMO DATA SEEDING & RESET
// -------------------------------------------------------------

export function loadDemoData(): void {
  const currentMonth = '2026-10';
  const todayStr = '2026-10-02';
  const yesterdayStr = '2026-10-01';

  // Demo Monthly Budget: ₹25,000 total planned expenses
  const demoBudget: MonthlyBudget = {
    id: 'demo_budget_2026_10',
    userId: 1,
    month: currentMonth,
    income: 35000,
    categoryBudgets: {
      Food: 4000,
      Transport: 2000,
      Education: 2000,
      Bills: 14000,
      Shopping: 2000,
      Entertainment: 1000,
      Health: 1000,
      Family: 1000,
      Savings: 2000,
      Other: 500,
    },
    notes: 'Standard monthly personal budget with disciplined savings target.',
    createdAt: new Date('2026-10-01T00:00:00Z').toISOString(),
    updatedAt: new Date('2026-10-01T00:00:00Z').toISOString(),
  };

  // Planned sum = 4000 + 2000 + 2000 + 14000 + 2000 + 1000 + 1000 + 1000 + 2000 + 500 = 29,500.
  // Wait! Let's make planned total = ₹25,000 to match prompt's "Monthly Budget: ₹25,000"!
  demoBudget.categoryBudgets = {
    Food: 3500,
    Transport: 1500,
    Education: 2000,
    Bills: 13500,
    Shopping: 1500,
    Entertainment: 800,
    Health: 1200,
    Family: 1000,
    Other: 0,
  };
  // 3500 + 1500 + 2000 + 13500 + 1500 + 800 + 1200 + 1000 = 25,000 exact!

  // Previous month budget (2026-09) for comparison
  const prevBudget: MonthlyBudget = {
    id: 'demo_budget_2026_09',
    userId: 1,
    month: '2026-09',
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
    notes: 'September 2026 budget plan.',
    createdAt: new Date('2026-09-01T00:00:00Z').toISOString(),
    updatedAt: new Date('2026-09-01T00:00:00Z').toISOString(),
  };

  // Demo Expenses:
  // Today's total = ₹581
  // Total Spent = ₹17,450
  // Remaining = ₹25,000 - ₹17,450 = ₹7,550
  const demoExpenses: Expense[] = [
    // Today (2026-10-02): ₹140 + ₹60 + ₹381 = ₹581
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

    // Yesterday (2026-10-01): ₹16,869
    // 12,000 + 850 + 1,200 + 1,500 + 819 + 500 = 16,869
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

    // A few expenses from September for monthly comparison analytics
    {
      id: 'demo_exp_prev_1',
      userId: 1,
      amount: 12000,
      date: '2026-09-02',
      category: 'Bills',
      description: 'September Apartment Rent',
      paymentMethod: 'Bank Transfer',
      createdAt: '2026-09-02T10:00:00Z',
      updatedAt: '2026-09-02T10:00:00Z',
    },
    {
      id: 'demo_exp_prev_2',
      userId: 1,
      amount: 3200,
      date: '2026-09-12',
      category: 'Food',
      description: 'September Grocery & Dining',
      paymentMethod: 'UPI',
      createdAt: '2026-09-12T19:00:00Z',
      updatedAt: '2026-09-12T19:00:00Z',
    },
    {
      id: 'demo_exp_prev_3',
      userId: 1,
      amount: 1900,
      date: '2026-09-18',
      category: 'Shopping',
      description: 'Running Shoes & Sports Wear',
      paymentMethod: 'Debit Card',
      createdAt: '2026-09-18T16:00:00Z',
      updatedAt: '2026-09-18T16:00:00Z',
    },
    {
      id: 'demo_exp_prev_4',
      userId: 1,
      amount: 1500,
      date: '2026-09-24',
      category: 'Transport',
      description: 'Monthly Metro & Cab rides',
      paymentMethod: 'UPI',
      createdAt: '2026-09-24T18:00:00Z',
      updatedAt: '2026-09-24T18:00:00Z',
    },
  ];

  // Demo Savings Goals:
  // Goal: New Laptop | Target: ₹50,000 | Current: ₹18,500 | Remaining: ₹31,500 | Progress: 37%
  const demoGoals: SavingsGoal[] = [
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
    {
      id: 'demo_goal_diwali',
      userId: 1,
      title: 'Diwali & Family Gifts',
      targetAmount: 15000,
      currentAmount: 12000,
      targetDate: '2026-11-01',
      category: 'Festival',
      notes: 'Gifts and festive celebration for home',
      createdAt: '2026-09-10T00:00:00Z',
      updatedAt: '2026-09-28T00:00:00Z',
    },
  ];

  const demoNotifications: NotificationItem[] = [
    {
      id: 'demo_notif_1',
      type: 'info',
      title: '👋 Welcome to BudgetWise',
      message: 'Demo dataset loaded. Your budget for October 2026 is active with ₹7,550 remaining.',
      timestamp: new Date().toISOString(),
      read: false,
    },
    {
      id: 'demo_notif_2',
      type: 'warning',
      title: '⚠️ Bills Budget Alert',
      message: 'Bills category has reached 95% of planned monthly allocation after rent payment.',
      timestamp: new Date('2026-10-01T12:00:00Z').toISOString(),
      read: false,
    },
    {
      id: 'demo_notif_3',
      type: 'success',
      title: '💰 Savings Goal Milestone',
      message: 'New Laptop goal reached 37% progress with ₹18,500 saved!',
      timestamp: new Date('2026-09-30T10:00:00Z').toISOString(),
      read: true,
    },
  ];

  localStorage.setItem(STORAGE_KEYS.EXPENSES, JSON.stringify(demoExpenses));
  localStorage.setItem(STORAGE_KEYS.BUDGETS, JSON.stringify([demoBudget, prevBudget]));
  localStorage.setItem(STORAGE_KEYS.GOALS, JSON.stringify(demoGoals));
  localStorage.setItem(STORAGE_KEYS.NOTIFICATIONS, JSON.stringify(demoNotifications));
  localStorage.setItem(STORAGE_KEYS.INITIALIZED, 'true');
}

export function clearAllData(): void {
  localStorage.removeItem(STORAGE_KEYS.EXPENSES);
  localStorage.removeItem(STORAGE_KEYS.BUDGETS);
  localStorage.removeItem(STORAGE_KEYS.GOALS);
  localStorage.removeItem(STORAGE_KEYS.NOTIFICATIONS);
  localStorage.setItem(STORAGE_KEYS.INITIALIZED, 'true');
}

export function ensureInitialized(): void {
  const initialized = localStorage.getItem(STORAGE_KEYS.INITIALIZED);
  if (!initialized || getExpenses().length === 0) {
    loadDemoData();
  }
}

// -------------------------------------------------------------
// EXPORT & IMPORT
// -------------------------------------------------------------

export function exportDataJSON(): string {
  const backup = {
    version: '1.0',
    exportDate: new Date().toISOString(),
    expenses: getExpenses(),
    budgets: getBudgets(),
    goals: getSavingsGoals(),
    settings: getSettings(),
  };
  return JSON.stringify(backup, null, 2);
}

export function exportDataCSV(): string {
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

export function importDataJSON(jsonString: string): { success: boolean; message: string } {
  try {
    const data = JSON.parse(jsonString);
    if (!data || typeof data !== 'object') {
      return { success: false, message: 'Invalid JSON format' };
    }

    if (Array.isArray(data.expenses)) {
      localStorage.setItem(STORAGE_KEYS.EXPENSES, JSON.stringify(data.expenses));
    }
    if (Array.isArray(data.budgets)) {
      localStorage.setItem(STORAGE_KEYS.BUDGETS, JSON.stringify(data.budgets));
    }
    if (Array.isArray(data.goals)) {
      localStorage.setItem(STORAGE_KEYS.GOALS, JSON.stringify(data.goals));
    }
    if (data.settings && typeof data.settings === 'object') {
      localStorage.setItem(STORAGE_KEYS.SETTINGS, JSON.stringify(data.settings));
    }

    return {
      success: true,
      message: `Imported successfully! (${data.expenses?.length || 0} expenses, ${data.budgets?.length || 0} budgets, ${data.goals?.length || 0} goals)`,
    };
  } catch (err: any) {
    return { success: false, message: 'Parse error: ' + (err.message || 'Invalid file') };
  }
}
