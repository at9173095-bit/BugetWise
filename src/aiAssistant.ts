import {
  ChatMessage,
  EXPENSE_CATEGORIES,
} from './types';
import {
  getExpenses,
  getBudget,
  calculateMonthlyTotal,
  calculatePlannedExpenses,
  formatCurrency,
  saveBudget,
  getSettings,
} from './storage';

export interface BudgetWizardState {
  active: boolean;
  step: number;
  income: number;
  fixedExpenses: number;
  majorCategories: string[];
  savingsTarget: number;
}

let wizardState: BudgetWizardState = {
  active: false,
  step: 0,
  income: 0,
  fixedExpenses: 0,
  majorCategories: [],
  savingsTarget: 0,
};

export function getWizardState(): BudgetWizardState {
  return { ...wizardState };
}

export function resetWizardState(): void {
  wizardState = {
    active: false,
    step: 0,
    income: 0,
    fixedExpenses: 0,
    majorCategories: [],
    savingsTarget: 0,
  };
}

/**
 * Generate Smart Budget Insights from real localStorage data
 */
export function generateSmartInsights(month: string): string[] {
  const expenses = getExpenses().filter((e) => e.date.startsWith(month));
  const budget = getBudget(month);
  const insights: string[] = [];

  if (expenses.length === 0) {
    insights.push('💡 Start logging your daily expenses to unlock smart AI spending insights.');
    return insights;
  }

  // Category totals
  const catTotals: Record<string, number> = {};
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

  // Daily average
  const uniqueDays = new Set(expenses.map((e) => e.date)).size;
  const totalSpent = calculateMonthlyTotal(month);
  const dailyAvg = uniqueDays > 0 ? Math.round(totalSpent / uniqueDays) : 0;
  insights.push(`🗓️ Your average daily spending across active days is <strong>${formatCurrency(dailyAvg)}</strong>.`);

  // Budget status
  if (budget) {
    const planned = calculatePlannedExpenses(budget);
    const remaining = planned - totalSpent;
    if (remaining >= 0) {
      insights.push(
        `✅ You have <strong>${formatCurrency(remaining)}</strong> remaining this month and are currently within your planned budget.`
      );
    } else {
      insights.push(
        `⚠️ Your expenses exceed your planned monthly budget by <strong>${formatCurrency(Math.abs(remaining))}</strong>.`
      );
    }

    // Category alert check
    let highPctCat: { category: string; pct: number } | null = null;
    Object.entries(budget.categoryBudgets).forEach(([cat, limit]) => {
      const spent = catTotals[cat] || 0;
      const limitNum = Number(limit);
      if (limitNum > 0) {
        const pct = Math.round((spent / limitNum) * 100);
        if (pct >= 80 && pct <= 150) {
          if (!highPctCat || pct > highPctCat.pct) {
            highPctCat = { category: cat, pct };
          }
        }
      }
    });

    if (highPctCat) {
      insights.push(
        `⚡ High utilization: You have used <strong>${(highPctCat as any).pct}%</strong> of your <strong>${(highPctCat as any).category}</strong> budget.`
      );
    }
  } else {
    insights.push(`💡 No monthly budget set for ${month} yet. Create one in the Budget tab to enable limit tracking.`);
  }

  return insights;
}

/**
 * AI Assistant Chatbot Core Logic (Frontend Prototype)
 * Ready to be swapped with backend / LLM API endpoint later.
 */
export function handleUserChatMessage(
  userText: string,
  currentMonth: string
): { response: string; quickReplies?: string[]; suggestedBudget?: { income: number; allocation: Record<string, number> } } {
  const text = userText.trim().toLowerCase();
  const settings = getSettings();

  // Check if wizard is currently running
  if (wizardState.active) {
    return processBudgetWizardStep(userText, currentMonth);
  }

  // 1. "How much have I spent this month?"
  if (
    text.includes('spent this month') ||
    text.includes('how much have i spent') ||
    text.includes('total spend') ||
    text.includes('total expense')
  ) {
    const total = calculateMonthlyTotal(currentMonth);
    const expenses = getExpenses().filter((e) => e.date.startsWith(currentMonth));
    const count = expenses.length;
    return {
      response: `You have spent **${formatCurrency(total)}** across **${count} transactions** in ${currentMonth}.
      
Would you like to see a breakdown by category or review today's spending?`,
      quickReplies: ['Where am I spending the most?', "Today's spending", 'How much budget is remaining?'],
    };
  }

  // 2. "Where am I spending the most?"
  if (
    text.includes('spending the most') ||
    text.includes('highest spending') ||
    text.includes('top category') ||
    text.includes('biggest expense')
  ) {
    const expenses = getExpenses().filter((e) => e.date.startsWith(currentMonth));
    if (expenses.length === 0) {
      return {
        response: `You haven't logged any expenses for ${currentMonth} yet! Click "+ Add Expense" to start.`,
      };
    }

    const catTotals: Record<string, number> = {};
    expenses.forEach((e) => {
      catTotals[e.category] = (catTotals[e.category] || 0) + Number(e.amount);
    });

    const sorted = Object.entries(catTotals).sort((a, b) => b[1] - a[1]);
    const top = sorted[0];
    const second = sorted.length > 1 ? sorted[1] : null;
    const total = calculateMonthlyTotal(currentMonth);
    const topPct = Math.round((top[1] / total) * 100);

    let msg = `Your highest spending category this month is **${top[0]}** with **${formatCurrency(top[1])}**, representing **${topPct}%** of your total expenses.`;
    if (second) {
      const secondPct = Math.round((second[1] / total) * 100);
      msg += `\n\nFollowed by **${second[0]}** at **${formatCurrency(second[1])}** (${secondPct}%).`;
    }

    return {
      response: msg,
      quickReplies: ['How much budget is remaining?', 'Analyze my spending', 'Help me create a monthly budget'],
    };
  }

  // 3. "How much budget is remaining?"
  if (
    text.includes('budget is remaining') ||
    text.includes('remaining budget') ||
    text.includes('how much left') ||
    text.includes('remaining money')
  ) {
    const budget = getBudget(currentMonth);
    const totalSpent = calculateMonthlyTotal(currentMonth);

    if (!budget) {
      return {
        response: `You haven't created a budget for ${currentMonth} yet! Total spent so far is **${formatCurrency(totalSpent)}**.\n\nShall we create a budget now?`,
        quickReplies: ['Help me create a monthly budget', 'View Expenses'],
      };
    }

    const planned = calculatePlannedExpenses(budget);
    const remaining = planned - totalSpent;
    const pctUsed = planned > 0 ? Math.round((totalSpent / planned) * 100) : 0;

    // Remaining days in month
    const now = new Date();
    const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
    const daysLeft = Math.max(1, daysInMonth - now.getDate());
    const dailyAllowance = remaining > 0 ? Math.round(remaining / daysLeft) : 0;

    let msg = `Here is your budget health for ${currentMonth}:\n\n` +
      `• Planned Budget: **${formatCurrency(planned)}**\n` +
      `• Total Spent: **${formatCurrency(totalSpent)}** (${pctUsed}% used)\n` +
      `• Remaining: **${formatCurrency(remaining)}**\n\n`;

    if (remaining > 0) {
      msg += `With **${daysLeft} days** left in the month, you can safely spend about **${formatCurrency(dailyAllowance)} per day** to stay on track.`;
    } else {
      msg += `⚠️ You are currently **${formatCurrency(Math.abs(remaining))}** over your planned allocation. Consider trimming non-essential shopping or entertainment.`;
    }

    return {
      response: msg,
      quickReplies: ['Analyze my spending', 'Where am I spending the most?'],
    };
  }

  // 4. "Analyze my spending"
  if (
    text.includes('analyze my spending') ||
    text.includes('spending analysis') ||
    text.includes('financial health') ||
    text.includes('analyze')
  ) {
    const expenses = getExpenses().filter((e) => e.date.startsWith(currentMonth));
    const budget = getBudget(currentMonth);
    const totalSpent = calculateMonthlyTotal(currentMonth);

    if (expenses.length === 0) {
      return {
        response: `I need a few logged transactions to analyze your spending. Try adding today's expenses first!`,
      };
    }

    // Payment methods breakdown
    const methods: Record<string, number> = {};
    expenses.forEach((e) => {
      methods[e.paymentMethod] = (methods[e.paymentMethod] || 0) + Number(e.amount);
    });
    const topMethod = Object.entries(methods).sort((a, b) => b[1] - a[1])[0];

    const planned = budget ? calculatePlannedExpenses(budget) : 0;
    const burnRatePct = planned > 0 ? Math.round((totalSpent / planned) * 100) : null;

    let response = `📈 **Spending Analysis for ${currentMonth}:**\n\n` +
      `1. **Total Outflow:** ${formatCurrency(totalSpent)} across ${expenses.length} transactions.\n` +
      `2. **Preferred Payment Method:** ${topMethod ? topMethod[0] + ' (' + formatCurrency(topMethod[1]) + ')' : 'None'}.\n`;

    if (burnRatePct !== null) {
      response += `3. **Budget Burn Rate:** ${burnRatePct}% of planned limit used.\n`;
    }

    if (budget && budget.income > 0) {
      const savingsRate = Math.round(((budget.income - totalSpent) / budget.income) * 100);
      response += `4. **Estimated Savings Rate:** ${Math.max(0, savingsRate)}% of monthly income (${formatCurrency(budget.income)}).\n`;
    }

    response += `\n*Recommendation:* Review recurring subscriptions and keep daily discretionary spending under control.`;

    return {
      response,
      quickReplies: ['Where am I spending the most?', 'How much budget is remaining?', 'Help me create a monthly budget'],
    };
  }

  // 5. "Help me create a monthly budget" -> Start Wizard!
  if (
    text.includes('create a monthly budget') ||
    text.includes('create budget') ||
    text.includes('help me budget') ||
    text.includes('set up budget') ||
    text.includes('budget wizard')
  ) {
    wizardState = {
      active: true,
      step: 1,
      income: 0,
      fixedExpenses: 0,
      majorCategories: [],
      savingsTarget: 0,
    };

    return {
      response: `👋 I'll help you build a personalized, balanced monthly budget using proven financial principles (50/30/20 rule adjusted for you).\n\n**Step 1 of 4:** What is your estimated **monthly income**? (e.g. ₹25,000, 35000, 50000)`,
      quickReplies: ['₹25,000', '₹35,000', '₹50,000', '₹75,000'],
    };
  }

  // 6. Generic financial wisdom / greeting
  if (text.includes('hello') || text.includes('hi') || text.includes('hey')) {
    return {
      response: `Hello! I am your **BudgetWise AI Assistant** 🤖. I can analyze your spending patterns, track limits, or help you craft a monthly budget.\n\nWhat would you like to explore today?`,
      quickReplies: [
        'How much have I spent this month?',
        'Where am I spending the most?',
        'How much budget is remaining?',
        'Help me create a monthly budget',
        'Analyze my spending',
      ],
    };
  }

  // Default response with suggested actions
  return {
    response: `I'm here to help you master your finances! You can ask me questions about your actual spending, or choose one of the options below:`,
    quickReplies: [
      'How much have I spent this month?',
      'Where am I spending the most?',
      'How much budget is remaining?',
      'Help me create a monthly budget',
      'Analyze my spending',
    ],
  };
}

/**
 * Processes the 4-step Interactive AI Budget Wizard
 */
function processBudgetWizardStep(
  userInput: string,
  currentMonth: string
): { response: string; quickReplies?: string[]; suggestedBudget?: { income: number; allocation: Record<string, number> } } {
  const cleanedNum = Number(userInput.replace(/[^0-9]/g, ''));

  // STEP 1: Monthly Income
  if (wizardState.step === 1) {
    if (!cleanedNum || cleanedNum < 1000) {
      return {
        response: `Please enter a valid monthly income number (e.g. 25000 or ₹35,000).`,
        quickReplies: ['₹25,000', '₹35,000', '₹50,000'],
      };
    }
    wizardState.income = cleanedNum;
    wizardState.step = 2;

    const estRent = Math.round(cleanedNum * 0.35);
    return {
      response: `Got it: Monthly Income is **${formatCurrency(wizardState.income)}**.\n\n**Step 2 of 4:** Approximately what are your **fixed monthly obligations** (Rent, maintenance, electricity, broadband, EMI)?`,
      quickReplies: [`${formatCurrency(estRent)}`, `${formatCurrency(Math.round(cleanedNum * 0.25))}`, '₹12,000'],
    };
  }

  // STEP 2: Fixed Expenses
  if (wizardState.step === 2) {
    wizardState.fixedExpenses = cleanedNum || Math.round(wizardState.income * 0.35);
    wizardState.step = 3;

    return {
      response: `Noted: Fixed obligations estimated at **${formatCurrency(wizardState.fixedExpenses)}**.\n\n**Step 3 of 4:** What are your primary variable spending areas? (Select one or type multiple)`,
      quickReplies: ['Food & Groceries', 'Transport & Fuel', 'Shopping & Dining', 'Education & Self-learning'],
    };
  }

  // STEP 3: Major Categories
  if (wizardState.step === 3) {
    wizardState.majorCategories.push(userInput);
    wizardState.step = 4;

    const suggestedSavings = Math.round(wizardState.income * 0.2);
    return {
      response: `Great! **Step 4 of 4:** How much would you like to set aside as **Savings** each month? (e.g. 20% would be ${formatCurrency(suggestedSavings)})`,
      quickReplies: [`${formatCurrency(suggestedSavings)} (20%)`, `${formatCurrency(Math.round(wizardState.income * 0.15))} (15%)`, `${formatCurrency(Math.round(wizardState.income * 0.25))} (25%)`],
    };
  }

  // STEP 4: Savings Target & Budget Generation
  if (wizardState.step === 4) {
    wizardState.savingsTarget = cleanedNum || Math.round(wizardState.income * 0.2);

    const income = wizardState.income;
    const savings = wizardState.savingsTarget;
    const bills = Math.min(wizardState.fixedExpenses, Math.round(income * 0.5));
    const remainingForLiving = Math.max(0, income - savings - bills);

    // Balanced proportional distribution matching prompt example
    // Food 16%, Transport 10%, Education 8%, Shopping 8%, Entertainment 6%, Health 4%, Family 5%, Other 3%
    const food = Math.round(remainingForLiving * 0.35);
    const transport = Math.round(remainingForLiving * 0.18);
    const shopping = Math.round(remainingForLiving * 0.14);
    const education = Math.round(remainingForLiving * 0.12);
    const entertainment = Math.round(remainingForLiving * 0.08);
    const health = Math.round(remainingForLiving * 0.07);
    const family = Math.round(remainingForLiving * 0.06);

    const allocation: Record<string, number> = {
      Food: food,
      Transport: transport,
      Bills: bills,
      Education: education,
      Shopping: shopping,
      Entertainment: entertainment,
      Health: health,
      Family: family,
      Savings: savings,
      Other: Math.max(0, remainingForLiving - (food + transport + shopping + education + entertainment + health + family)),
    };

    const plannedTotal = Object.values(allocation).reduce((a, b) => a + b, 0);

    const response = `🎉 **Suggested Monthly Budget Created!**\n\n` +
      `**Monthly Income:** ${formatCurrency(income)}\n` +
      `**Total Planned Expenses & Savings:** ${formatCurrency(plannedTotal)}\n\n` +
      `**Suggested Category Allocation:**\n` +
      `• Food: ${formatCurrency(allocation.Food)}\n` +
      `• Transport: ${formatCurrency(allocation.Transport)}\n` +
      `• Bills & Rent: ${formatCurrency(allocation.Bills)}\n` +
      `• Education: ${formatCurrency(allocation.Education)}\n` +
      `• Shopping: ${formatCurrency(allocation.Shopping)}\n` +
      `• Entertainment: ${formatCurrency(allocation.Entertainment)}\n` +
      `• Health: ${formatCurrency(allocation.Health)}\n` +
      `• Savings: ${formatCurrency(allocation.Savings)}\n` +
      `• Family: ${formatCurrency(allocation.Family)}\n` +
      `• Other: ${formatCurrency(allocation.Other)}\n\n` +
      `*Notice: Presenting this strictly as a budgeting suggestion, not financial advice.*`;

    // Reset wizard
    const generatedProposal = { income, allocation };
    resetWizardState();

    return {
      response,
      quickReplies: ['Apply this Budget to my Account', 'Start Over', 'How much have I spent this month?'],
      suggestedBudget: generatedProposal,
    };
  }

  resetWizardState();
  return {
    response: `Wizard reset. Feel free to ask any question or start a new budget plan.`,
  };
}
