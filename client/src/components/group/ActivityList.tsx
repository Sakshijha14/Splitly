// Everything that happened in the group, newest first: expenses and recorded payments, each deletable.
import { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { request, type Expense, type Settlement } from '../../lib/api';
import { formatMoney } from '../../lib/money';

interface Props {
  groupId: string;
  expenses: Expense[];
  settlements: Settlement[];
  nameOf(id: string): string;
  onDeleted(): void;
}

type Item = { kind: 'expense'; data: Expense } | { kind: 'payment'; data: Settlement };

function shortDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
}

export function ActivityList({ groupId, expenses, settlements, nameOf, onDeleted }: Props) {
  const { user } = useAuth();
  const [error, setError] = useState('');

  const items: Item[] = [
    ...expenses.map((data) => ({ kind: 'expense' as const, data })),
    ...settlements.map((data) => ({ kind: 'payment' as const, data })),
  ].sort((a, b) => b.data.createdAt.localeCompare(a.data.createdAt));

  async function handleDelete(item: Item) {
    const label = item.kind === 'expense' ? `"${item.data.description}"` : 'this payment';
    if (!confirm(`Delete ${label}?`)) return;
    setError('');
    try {
      const path = item.kind === 'expense' ? 'expenses' : 'settlements';
      await request(`/api/groups/${groupId}/${path}/${item.data.id}`, 'DELETE');
      onDeleted();
    } catch (err) {
      setError((err as Error).message);
    }
  }

  return (
    <section className="card">
      <h2 className="mb-3 font-semibold">Activity</h2>
      {error && <p className="mb-2 text-sm text-red-600">{error}</p>}
      {items.length === 0 && <p className="text-sm text-slate-500">No expenses yet.</p>}
      <ul className="divide-y divide-slate-100">
        {items.map((item) => (
          <li key={item.data.id} className="flex items-start justify-between gap-4 py-3">
            {item.kind === 'expense' ? <ExpenseRow e={item.data} myId={user?.id} nameOf={nameOf} /> : <PaymentRow s={item.data} nameOf={nameOf} />}
            <button onClick={() => handleDelete(item)} className="shrink-0 text-sm text-slate-400 hover:text-red-600">
              Delete
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}

const splitLabel = { equal: 'split equally', exact: 'split by amounts', percent: 'split by %' };

function ExpenseRow({ e, myId, nameOf }: { e: Expense; myId?: string; nameOf(id: string): string }) {
  const myShare = e.shares.find((s) => s.userId === myId)?.amount;
  const payer = e.paidById === myId ? 'You' : nameOf(e.paidById);
  return (
    <div>
      <p className="font-medium">{e.description}</p>
      <p className="text-sm text-slate-500">
        {payer} paid {formatMoney(e.amount)} · {splitLabel[e.splitType]} between {e.shares.length}
        {myShare !== undefined && ` · your share ${formatMoney(myShare)}`}
      </p>
      <p className="text-xs text-slate-400">{shortDate(e.createdAt)}</p>
    </div>
  );
}

function PaymentRow({ s, nameOf }: { s: Settlement; nameOf(id: string): string }) {
  return (
    <div>
      <p className="font-medium text-emerald-700">
        💰 {nameOf(s.fromId)} paid {nameOf(s.toId)} {formatMoney(s.amount)}
      </p>
      <p className="text-xs text-slate-400">{shortDate(s.createdAt)}</p>
    </div>
  );
}
