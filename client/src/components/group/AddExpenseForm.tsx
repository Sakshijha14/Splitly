// Form to add an expense: what it was for, how much, who paid, and who it's split between.
import { useState, type FormEvent } from 'react';
import { useAuth } from '../../context/AuthContext';
import { request, type User } from '../../lib/api';

export function AddExpenseForm({ groupId, members, onAdded }: { groupId: string; members: User[]; onAdded(): void }) {
  const { user } = useAuth();
  const [description, setDescription] = useState('');
  const [amount, setAmount] = useState('');
  const [paidById, setPaidById] = useState(user?.id ?? '');
  // Who is NOT in the split. Storing the exclusions means friends added later are included by default.
  const [excluded, setExcluded] = useState<Set<string>>(new Set());
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const splitWith = members.filter((m) => !excluded.has(m.id)).map((m) => m.id);
  const amountNumber = Number(amount);
  const perPerson = amountNumber > 0 && splitWith.length > 0 ? amountNumber / splitWith.length : 0;

  function toggle(id: string) {
    setExcluded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError('');
    setSaving(true);
    try {
      await request(`/api/groups/${groupId}/expenses`, 'POST', { description, amount: amountNumber, paidById, splitWith });
      setDescription('');
      setAmount('');
      setExcluded(new Set());
      onAdded();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="card space-y-3">
      <h2 className="font-semibold">Add an expense</h2>
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
        <legend className="mb-1 text-sm">Split equally between</legend>
        <div className="flex flex-wrap gap-x-4 gap-y-1">
          {members.map((m) => (
            <label key={m.id} className="flex items-center gap-1.5 text-sm">
              <input type="checkbox" className="accent-emerald-600" checked={!excluded.has(m.id)} onChange={() => toggle(m.id)} />
              {m.id === user?.id ? 'You' : m.name}
            </label>
          ))}
        </div>
        {perPerson > 0 && <p className="mt-1 text-xs text-slate-500">About ₹{perPerson.toFixed(2)} each</p>}
      </fieldset>

      {error && <p className="text-sm text-red-600">{error}</p>}
      <button className="btn" disabled={saving || splitWith.length === 0}>
        {saving ? 'Adding…' : 'Add expense'}
      </button>
    </form>
  );
}
