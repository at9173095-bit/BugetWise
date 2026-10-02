/**
 * BudgetWise - Modern Personal Daily & Monthly Budget Management Web Application
 * Tagline: "Understand your money. Control your spending. Build your future."
 * 
 * Architecture:
 * - Pure Frontend: HTML + CSS + Vanilla JavaScript (TypeScript modular architecture)
 * - Browser Storage: localStorage for persistent client data
 * - Future Backend Compatibility: MySQL-ready schema (userId, createdAt, updatedAt)
 * 
 * Core Modules:
 * - src/storage.ts:
 *   - saveExpense(expense)
 *   - getExpenses()
 *   - deleteExpense(id)
 *   - updateExpense(id, expense)
 *   - saveBudget(budget)
 *   - getBudget(month)
 *   - calculateMonthlyTotal(month)
 *   - calculateCategoryTotal(month, category)
 *   - calculateRemainingBudget(month)
 *   - calculateSavings(month)
 *   - updateDashboard()
 * - src/charts.ts: Pure SVG responsive rendering (Line, Doughnut, Comparison Bar, Multi-Month)
 * - src/aiAssistant.ts: AI Prototype Chatbot, 4-step Budget Wizard & dynamic data insights
 * - src/main.ts: Application event binding, navigation, modals, and export/import
 */

console.log('BudgetWise initialized. All modules loaded.');
