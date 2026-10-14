// Home page: your groups, plus a form to create a new one.
import { useEffect, useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { AppLayout } from '../components/AppLayout';
import { request, type GroupSummary } from '../lib/api';

export function Home() {
  const navigate = useNavigate();
  const [groups, setGroups] = useState<GroupSummary[] | null>(null); // null while loading
  const [loadError, setLoadError] = useState('');
  const [name, setName] = useState('');
  const [error, setError] = useState('');
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    request<{ groups: GroupSummary[] }>('/api/groups')
      .then((data) => setGroups(data.groups))
      .catch((err) => setLoadError((err as Error).message));
  }, []);

  async function handleCreate(e: FormEvent) {
    e.preventDefault();
    setError('');
    setCreating(true);
    try {
      const { group } = await request<{ group: GroupSummary }>('/api/groups', 'POST', { name });
      navigate(`/groups/${group.id}`); // go straight to the new group to add friends
    } catch (err) {
      setError((err as Error).message);
      setCreating(false);
    }
  }

  return (
    <AppLayout>
      <form onSubmit={handleCreate} className="card mb-6">
        <h2 className="mb-3 font-semibold">New group</h2>
        <div className="flex gap-2">
          <input className="input" placeholder="e.g. Goa Trip, Flatmates" value={name} onChange={(e) => setName(e.target.value)} maxLength={60} required />
          <button className="btn shrink-0" disabled={creating}>
            {creating ? 'Creating…' : 'Create'}
          </button>
        </div>
        {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
      </form>

      <h2 className="mb-3 font-semibold">Your groups</h2>
      {loadError && <p className="text-sm text-red-600">{loadError}</p>}
      {!groups && !loadError && <p className="text-sm text-slate-500">Loading…</p>}
      {groups?.length === 0 && <p className="text-sm text-slate-500">No groups yet. Create one above to get started.</p>}
      <ul className="space-y-2">
        {groups?.map((g) => (
          <li key={g.id}>
            <Link to={`/groups/${g.id}`} className="card flex items-center justify-between p-4! hover:border-emerald-600">
              <span className="font-medium">{g.name}</span>
              <span className="text-sm text-slate-500">
                {g.memberCount} {g.memberCount === 1 ? 'member' : 'members'}
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </AppLayout>
  );
}
