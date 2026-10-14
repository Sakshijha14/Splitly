// Form to add an expense (or edit one): what it was for, how much, who paid, and how it's split
// (equally, by exact amounts, or by percentages).
import { useState, type FormEvent } from 'react';
import { useAuth } from '../../context/AuthContext';
import { request, type Expense, type Member } from '../../lib/api';

type SplitType = 'equal' | 'exact' | 'percent';

const tabs: { type: SplitType; label: string }[] = [
  { type: 'equal', label: 'Equally' },
  { type: 'exact', label: 'Exact amounts' },
  { type: 'percent', label: 'Percentages' },
];

/** Adds in whole hundredths so 33.33 + 33.33 + 33.34 is exactly 100, not 99.99999999999999. */
function sumOf(values: string[]): number {
  return values.reduce((total, v) => total + Math.round((Number(v) || 0) * 100), 0) / 100;
}

/** Turns a saved expense's shares back into what would have been typed in the boxes. */
function typedValues(e: Expense): Record<string, string> {
  if (e.splitType === 'equal') return {};
  return Object.fromEntries(
    e.shares.map((s) => [
      s.userId,
      e.splitType === 'exact'
        ? String(s.amount / 100)
        : // Older percent expenses didn't store the percentage, so work it out from the amount.
          String(s.percent !== null ? s.percent / 100 : Math.round((s.amount / e.amount) * 10000) / 100),
    ]),
  );
}

interface Props {
  groupId: string;
  members: Member[];
  editing?: Expense; // when set, the form edits this expense instead of adding a new one
  onSaved(): void;
  onCancel?(): void;
}

export function AddExpenseForm({ groupId, members, editing, onSaved, onCancel }: Props) {
  const { user } = useAuth();
  const [description, setDescription] = useState(editing?.description ?? '');
  const [amount, setAmount] = useState(editing ? String(editing.amount / 100) : '');
  const [paidById, setPaidById] = useState(editing?.paidById ?? user?.id ?? '');
  const [splitType, setSplitType] = useState<SplitType>(editing?.splitType ?? 'equal');
  // Who is NOT in an equal split. Storing the exclusions means friends added later are included by default.
  const [excluded, setExcluded] = useState<Set<string>>(() =>
    editing?.splitType === 'equal' ? new Set(members.filter((m) => !editing.shares.some((s) => s.userId === m.id)).map((m) => m.id)) : new Set(),
  );
  // What's typed next to each person for exact amounts or percentages. Blank = not in the split.
  const [values, setValues] = useState<Record<string, string>>(() => (editing ? typedValues(editing) : {}));
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const total = Number(amount) || 0;
  const equalIds = members.filter((m) => !excluded.has(m.id)).map((m) => m.id);
  const filled = members.filter((m) => Number(values[m.id]) > 0);
  const entered = sumOf(filled.map((m) => values[m.id]));
  const target = splitType === 'percent' ? 100 : total;
  const remaining = Math.round((target - entered) * 100) / 100;

  function toggle(id: string) {
    setExcluded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function switchTo(type: SplitType) {
    setSplitType(type);
    setValues({});
    setError('');
  }

  function buildSplit() {
    if (splitType === 'equal') return { type: 'equal', userIds: equalIds };
    if (splitType === 'exact') return { type: 'exact', shares: filled.map((m) => ({ userId: m.id, amount: Number(values[m.id]) })) };
    return { type: 'percent', shares: filled.map((m) => ({ userId: m.id, percent: Number(values[m.id]) })) };
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError('');
    setSaving(true);
    try {
      const body = { description, amount: total, paidById, split: buildSplit() };
      if (editing) {
        await request(`/api/groups/${groupId}/expenses/${editing.id}`, 'PUT', body);
      } else {
        await request(`/api/groups/${groupId}/expenses`, 'POST', body);
        setDescription('');
        setAmount('');
        setExcluded(new Set());
        setValues({});
      }
      onSaved();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSaving(false);
    }
  }

  const nameOf = (m: Member) => (m.id === user?.id ? 'You' : m.name);
  const canSubmit = splitType === 'equal' ? equalIds.length > 0 : filled.length > 0 && remaining === 0;

  return (
    <form onSubmit={handleSubmit} className={`card space-y-3 ${editing ? 'border-emerald-600 ring-1 ring-emerald-600' : ''}`}>
      <h2 className="font-semibold">{editing ? 'Edit expense' : 'Add an expense'}</h2>
      <div className="flex gap-2">
        <input className="input" placeholder="What was it for? e.g. Dinner" value={description} onChange={(e) => setDescription(e.target.value)} maxLength={100} required />
        <div className="relative w-36 shrink-0">
          <span className="pointer-events-none absolute left-3 top-2 text-sm text-slate-500">₹</span>
          <input className="input pl-7" type="number" inputMode="decimal" min="0.01" step="0.01" placeholder="0.00" value={amount} onChange={(e) => setAmount(e.target.value)} required />
        </div>
      </div>

      <label className="flex items-center gap-2 text-sm">
        Paid by
        <select className="input w-auto" value={paidById} onChange={(e) => setPaidById(e.target.value)}>
          {members.map((m) => (
            <option key={m.id} value={m.id}>
              {m.id === user?.id ? 'you' : m.name}
            </option>
          ))}
        </select>
      </label>

      <fieldset>
        <legend className="mb-2 text-sm">Split</legend>
        <div className="mb-3 inline-flex rounded-lg border border-slate-300 p-0.5 text-sm">
          {tabs.map((t) => (
            <button
              key={t.type}
              type="button"
              onClick={() => switchTo(t.type)}
              className={`rounded-md px-3 py-1 ${splitType === t.type ? 'bg-emerald-600 text-white' : 'text-slate-600 hover:text-slate-900'}`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {splitType === 'equal' ? (
          <>
            <div className="flex flex-wrap gap-x-4 gap-y-1">
              {members.map((m) => (
                <label key={m.id} className="flex items-center gap-1.5 text-sm">
                  <input type="checkbox" className="accent-emerald-600" checked={!excluded.has(m.id)} onChange={() => toggle(m.id)} />
                  {nameOf(m)}
                </label>
              ))}
            </div>
            {total > 0 && equalIds.length > 0 && <p className="mt-1 text-xs text-slate-500">About ₹{(total / equalIds.length).toFixed(2)} each</p>}
          </>
        ) : (
          <>
            <ul className="space-y-1.5">
              {members.map((m) => (
                <li key={m.id} className="flex items-center justify-between gap-3 text-sm">
                  <span>{nameOf(m)}</span>
                  <div className="relative w-32">
                    {splitType === 'exact' && <span className="pointer-events-none absolute left-3 top-2 text-sm text-slate-500">₹</span>}
                    <input
                      className={`input ${splitType === 'exact' ? 'pl-7' : 'pr-7'}`}
                      type="number"
                      inputMode="decimal"
                      min="0"
                      step="0.01"
                      placeholder="0"
                      value={values[m.id] ?? ''}
                      onChange={(e) => setValues((v) => ({ ...v, [m.id]: e.target.value }))}
                    />
                    {splitType === 'percent' && <span className="pointer-events-none absolute right-3 top-2 text-sm text-slate-500">%</span>}
                  </div>
                </li>
              ))}
            </ul>
            <p className={`mt-2 text-xs ${remaining === 0 ? 'text-emerald-700' : 'text-slate-500'}`}>
              {splitType === 'exact'
                ? remaining === 0
                  ? '✓ Adds up to the total'
                  : remaining > 0
                    ? `₹${remaining.toFixed(2)} left to assign`
                    : `₹${(-remaining).toFixed(2)} too much`
                : remaining === 0
                  ? '✓ Adds up to 100%'
                  : remaining > 0
                    ? `${remaining}% left to assign`
                    : `${-remaining}% too much`}
            </p>
          </>
        )}
      </fieldset>

      {error && <p className="text-sm text-red-600">{error}</p>}
      <div className="flex items-center gap-3">
        <button className="btn" disabled={saving || !canSubmit}>
          {saving ? 'Saving…' : editing ? 'Save changes' : 'Add expense'}
        </button>
        {onCancel && (
          <button type="button" onClick={onCancel} className="text-sm text-slate-500 hover:text-slate-900">
            Cancel
          </button>
        )}
      </div>
    </form>
  );
}
