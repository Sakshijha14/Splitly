// Who is owed and who owes, plus the suggested payments that settle everyone up.
import { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { request, type ExpensesResponse, type Payment } from '../../lib/api';
import { formatMoney } from '../../lib/money';

interface Props {
  groupId: string;
  data: ExpensesResponse;
  nameOf(id: string): string;
  onChanged(): void;
}

export function BalancesCard({ groupId, data, nameOf, onChanged }: Props) {
  const { user } = useAuth();
  const [saving, setSaving] = useState<string | null>(null); // which payment is being recorded
  const [error, setError] = useState('');
  const myBalance = data.balances.find((b) => b.userId === user?.id)?.amount ?? 0;

  async function markPaid(p: Payment) {
    if (!confirm(`Record that ${nameOf(p.from)} paid ${nameOf(p.to)} ${formatMoney(p.amount)}?`)) return;
    setError('');
    setSaving(p.from + p.to);
    try {
      await request(`/api/groups/${groupId}/settlements`, 'POST', { fromId: p.from, toId: p.to, amount: p.amount / 100 });
      onChanged();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSaving(null);
    }
  }

  return (
    <section className="card">
      <h2 className="mb-1 font-semibold">Balances</h2>
      <p className={`mb-4 text-lg font-medium ${myBalance > 0 ? 'text-emerald-700' : myBalance < 0 ? 'text-red-600' : 'text-slate-500'}`}>
        {myBalance > 0 ? `You are owed ${formatMoney(myBalance)}` : myBalance < 0 ? `You owe ${formatMoney(-myBalance)}` : "You're all settled up"}
      </p>

      {data.payments.length > 0 && (
        <>
          <h3 className="mb-2 text-sm font-medium text-slate-500">To settle up</h3>
          <ul className="mb-4 space-y-2">
            {data.payments.map((p) => (
              <li key={p.from + p.to} className="flex items-center justify-between gap-3 text-sm">
                <span>
                  <b>{nameOf(p.from)}</b> pays <b>{nameOf(p.to)}</b> <span className="font-medium text-emerald-700">{formatMoney(p.amount)}</span>
                </span>
                <button
                  onClick={() => markPaid(p)}
                  disabled={saving !== null}
                  className="shrink-0 rounded-lg border border-emerald-600 px-3 py-1 text-xs font-medium text-emerald-700 hover:bg-emerald-50 disabled:opacity-60"
                >
                  {saving === p.from + p.to ? 'Saving…' : 'Mark as paid'}
                </button>
              </li>
            ))}
          </ul>
          {error && <p className="mb-4 text-sm text-red-600">{error}</p>}
        </>
      )}

      <h3 className="mb-2 text-sm font-medium text-slate-500">Everyone</h3>
      <ul className="divide-y divide-slate-100">
        {data.balances.map((b) => (
          <li key={b.userId} className="flex justify-between py-1.5 text-sm">
            <span>{nameOf(b.userId)}</span>
            <span className={b.amount > 0 ? 'text-emerald-700' : b.amount < 0 ? 'text-red-600' : 'text-slate-500'}>
              {b.amount > 0 ? `gets back ${formatMoney(b.amount)}` : b.amount < 0 ? `owes ${formatMoney(-b.amount)}` : 'settled'}
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}
