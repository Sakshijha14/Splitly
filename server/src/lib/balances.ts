// The money math. Every amount here is in paise (whole numbers), so nothing gets lost to rounding.

/**
 * Splits a total equally between people. When it doesn't divide evenly, the first few people pay
 * one extra paisa each, so the shares always add up to exactly the total.
 * Example: 1000 paise between 3 people -> [334, 333, 333].
 */
export function splitEqually(total: number, userIds: string[]): { userId: string; amount: number }[] {
  const base = Math.floor(total / userIds.length);
  const leftover = total - base * userIds.length;
  return userIds.map((userId, i) => ({ userId, amount: base + (i < leftover ? 1 : 0) }));
}

interface ExpenseForBalance {
  amount: number;
  paidById: string;
  shares: { userId: string; amount: number }[];
}

interface SettlementForBalance {
  fromId: string;
  toId: string;
  amount: number;
}

/**
 * Each person's net balance: what they paid minus what they owe.
 * Positive = the group owes them money. Negative = they owe the group. All balances add up to 0.
 * A settlement counts like a tiny expense: the payer paid it, and the receiver owes all of it.
 */
export function netBalances(memberIds: string[], expenses: ExpenseForBalance[], settlements: SettlementForBalance[] = []): Map<string, number> {
  const net = new Map(memberIds.map((id) => [id, 0]));
  const add = (id: string, amount: number) => net.set(id, (net.get(id) ?? 0) + amount);
  for (const e of expenses) {
    add(e.paidById, e.amount);
    for (const s of e.shares) add(s.userId, -s.amount);
  }
  for (const s of settlements) {
    add(s.fromId, s.amount);
    add(s.toId, -s.amount);
  }
  return net;
}

export interface Payment {
  from: string; // user id of the person who pays
  to: string;
  amount: number;
}

/**
 * Turns balances into a short list of payments that settles everyone up.
 * Greedy: the person who owes the most pays the person who is owed the most, as much as possible,
 * then repeat. Each payment fully settles at least one person, so there are at most (people - 1) payments.
 */
export function settleUp(balances: Map<string, number>): Payment[] {
  const owed = [...balances].filter(([, b]) => b > 0).map(([id, b]) => ({ id, left: b }));
  const owing = [...balances].filter(([, b]) => b < 0).map(([id, b]) => ({ id, left: -b }));
  owed.sort((a, b) => b.left - a.left);
  owing.sort((a, b) => b.left - a.left);

  const payments: Payment[] = [];
  let i = 0;
  let j = 0;
  while (i < owing.length && j < owed.length) {
    const amount = Math.min(owing[i].left, owed[j].left);
    payments.push({ from: owing[i].id, to: owed[j].id, amount });
    owing[i].left -= amount;
    owed[j].left -= amount;
    if (owing[i].left === 0) i++;
    if (owed[j].left === 0) j++;
  }
  return payments;
}
