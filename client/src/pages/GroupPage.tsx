// One group: balances and settling up, adding expenses, the activity list, and its members.
import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { Link, useParams } from 'react-router-dom';
import { AppLayout } from '../components/AppLayout';
import { ActivityList } from '../components/group/ActivityList';
import { AddExpenseForm } from '../components/group/AddExpenseForm';
import { BalancesCard } from '../components/group/BalancesCard';
import { useAuth } from '../context/AuthContext';
import { request, type ExpensesResponse, type GroupDetail, type Member } from '../lib/api';

export function GroupPage() {
  const { id = '' } = useParams();
  const { user } = useAuth();
  const [group, setGroup] = useState<GroupDetail | null>(null);
  const [money, setMoney] = useState<ExpensesResponse | null>(null);
  const [loadError, setLoadError] = useState('');
  const [email, setEmail] = useState('');
  const [friendName, setFriendName] = useState('');
  const [error, setError] = useState('');
  const [adding, setAdding] = useState(false);

  // Expenses, balances and payments come from the server together, so after any change we just reload them.
  const loadMoney = useCallback(() => {
    request<ExpensesResponse>(`/api/groups/${id}/expenses`)
      .then(setMoney)
      .catch((err) => setLoadError((err as Error).message));
  }, [id]);

  useEffect(() => {
    request<{ group: GroupDetail }>(`/api/groups/${id}`)
      .then((data) => setGroup(data.group))
      .catch((err) => setLoadError((err as Error).message));
    loadMoney();
  }, [id, loadMoney]);

  async function handleAdd(e: FormEvent) {
    e.preventDefault();
    setError('');
    setAdding(true);
    try {
      const { member } = await request<{ member: Member }>(`/api/groups/${id}/members`, 'POST', {
        email,
        name: friendName || undefined,
      });
      setGroup((g) => g && { ...g, members: [...g.members, member] });
      setEmail('');
      setFriendName('');
      loadMoney(); // the new member appears in the balances
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setAdding(false);
    }
  }

  if (loadError) {
    return (
      <AppLayout>
        <p className="text-red-600">{loadError}</p>
        <Link to="/" className="mt-4 inline-block text-sm text-emerald-700 underline">
          ← Back to your groups
        </Link>
      </AppLayout>
    );
  }

  if (!group || !money) {
    return (
      <AppLayout>
        <p className="text-sm text-slate-500">Loading…</p>
      </AppLayout>
    );
  }

  function nameOf(userId: string): string {
    const name = group?.members.find((m) => m.id === userId)?.name ?? 'Someone';
    return userId === user?.id ? `${name} (you)` : name;
  }

  return (
    <AppLayout>
      <Link to="/" className="text-sm text-slate-500 hover:text-slate-900">
        ← All groups
      </Link>
      <h1 className="mb-6 mt-2 text-2xl font-bold">{group.name}</h1>

      <div className="space-y-6">
        <BalancesCard groupId={group.id} data={money} nameOf={nameOf} onChanged={loadMoney} />
        <AddExpenseForm groupId={group.id} members={group.members} onAdded={loadMoney} />
        <ActivityList groupId={group.id} expenses={money.expenses} settlements={money.settlements} nameOf={nameOf} onDeleted={loadMoney} />

        <section className="card">
          <h2 className="mb-3 font-semibold">Members ({group.members.length})</h2>
          <ul className="mb-5 divide-y divide-slate-100">
            {group.members.map((m) => (
              <li key={m.id} className="flex items-center justify-between py-2">
                <span>
                  {m.name}
                  {m.id === user?.id && <span className="text-slate-500"> (you)</span>}
                  {m.invited && <span className="ml-2 rounded-full bg-amber-100 px-2 py-0.5 text-xs text-amber-800">invited</span>}
                </span>
                <span className="text-sm text-slate-500">{m.email}</span>
              </li>
            ))}
          </ul>

          <form onSubmit={handleAdd}>
            <label className="mb-1 block text-sm font-medium">Add a friend</label>
            <div className="flex gap-2">
              <input className="input" type="email" placeholder="friend@example.com" value={email} onChange={(e) => setEmail(e.target.value)} required />
              <input className="input" placeholder="Name (optional)" value={friendName} onChange={(e) => setFriendName(e.target.value)} maxLength={50} />
              <button className="btn shrink-0" disabled={adding}>
                {adding ? 'Adding…' : 'Add'}
              </button>
            </div>
            {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
            <p className="mt-2 text-xs text-slate-500">
              No account yet? No problem. They'll show as invited, and when they sign up with this email they'll see the group and its expenses.
            </p>
          </form>
        </section>
      </div>
    </AppLayout>
  );
}
