// Every call to the server goes through request(), which attaches the login token
// and turns error responses into thrown Errors with the server's message.

// Empty in development (Vite forwards /api to the server). Set VITE_API_URL when deployed.
const BASE_URL = import.meta.env.VITE_API_URL ?? '';
const TOKEN_KEY = 'splitly_token';

export interface User {
  id: string;
  name: string;
  email: string;
}

export interface AuthResponse {
  token: string;
  user: User;
}

// A group member. invited = added by a friend but hasn't signed up yet.
export interface Member extends User {
  invited: boolean;
}

export interface GroupSummary {
  id: string;
  name: string;
  createdAt: string;
  memberCount: number;
}

export interface GroupDetail {
  id: string;
  name: string;
  createdById: string;
  createdAt: string;
  members: Member[];
}

// All money from the server is in paise (₹1 = 100 paise).
export interface Expense {
  id: string;
  description: string;
  amount: number;
  splitType: 'equal' | 'exact' | 'percent';
  paidById: string;
  createdAt: string;
  shares: { userId: string; amount: number }[];
}

export interface Payment {
  from: string;
  to: string;
  amount: number;
}

// A recorded payment, e.g. "J paid Sakshi ₹600".
export interface Settlement {
  id: string;
  fromId: string;
  toId: string;
  amount: number;
  createdAt: string;
}

export interface ExpensesResponse {
  expenses: Expense[];
  settlements: Settlement[];
  balances: { userId: string; amount: number }[]; // positive = is owed money, negative = owes
  payments: Payment[]; // the suggested way to settle up
}

export function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

export function saveToken(token: string) {
  localStorage.setItem(TOKEN_KEY, token);
}

export function clearToken() {
  localStorage.removeItem(TOKEN_KEY);
}

export async function request<T>(path: string, method = 'GET', body?: unknown): Promise<T> {
  const token = getToken();
  const res = await fetch(BASE_URL + path, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token && { Authorization: `Bearer ${token}` }),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error ?? 'Request failed');
  return data as T;
}
