export type ExpenseCategory =
  | 'Food'
  | 'Transport'
  | 'Education'
  | 'Shopping'
  | 'Bills'
  | 'Entertainment'
  | 'Health'
  | 'Family'
  | 'Other';

export const EXPENSE_CATEGORIES: ExpenseCategory[] = [
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

export const BUDGET_CATEGORIES: (ExpenseCategory | 'Savings')[] = [
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

export type PaymentMethod =
  | 'Cash'
  | 'UPI'
  | 'Debit Card'
  | 'Credit Card'
  | 'Bank Transfer';

export const PAYMENT_METHODS: PaymentMethod[] = [
  'Cash',
  'UPI',
  'Debit Card',
  'Credit Card',
  'Bank Transfer',
];

export interface Expense {
  id: string;
  userId: number; // for MySQL compatibility
  amount: number;
  date: string; // YYYY-MM-DD
  category: ExpenseCategory;
  description: string;
  paymentMethod: PaymentMethod;
  note?: string;
  createdAt: string;
  updatedAt: string;
}

export interface MonthlyBudget {
  id: string;
  userId: number;
  month: string; // YYYY-MM
  income: number;
  categoryBudgets: Record<string, number>;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export interface SavingsGoal {
  id: string;
  userId: number;
  title: string;
  targetAmount: number;
  currentAmount: number;
  targetDate: string; // YYYY-MM-DD
  category?: string;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export interface UserSettings {
  currencySymbol: string;
  currencyCode: string;
  theme: 'light' | 'dark';
  alertNearLimitPercent: number; // e.g. 75
  enableNotifications: boolean;
}

export interface NotificationItem {
  id: string;
  type: 'warning' | 'alert' | 'success' | 'info';
  title: string;
  message: string;
  timestamp: string;
  read: boolean;
}

export interface ChatMessage {
  id: string;
  sender: 'user' | 'bot';
  text: string;
  timestamp: string;
  quickReplies?: string[];
  suggestedBudget?: {
    income: number;
    allocation: Record<string, number>;
  };
}
