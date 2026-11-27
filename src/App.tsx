import { useEffect, useState } from 'react';
import { ChevronLeft, ChevronRight, Database, LayoutDashboard, List, PiggyBank, Repeat, Tags, Target } from 'lucide-react';
import SampleControls from './components/SampleControls';
import { Button } from './components/ui';
import { monthKey, monthLabel, shiftMonth, todayISO } from './lib/dates';
import { useStorageError, useStored } from './lib/storage';
import { sampleManifest } from './store';
import Bills from './views/Bills';
import Budgets from './views/Budgets';
import Dashboard from './views/Dashboard';
import DataView from './views/Data';
import Goals from './views/Goals';
import Rules from './views/Rules';
import Transactions from './views/Transactions';

const TABS = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { id: 'transactions', label: 'Transactions', icon: List },
  { id: 'budgets', label: 'Budgets', icon: PiggyBank },
  { id: 'bills', label: 'Bills', icon: Repeat },
  { id: 'goals', label: 'Goals', icon: Target },
  { id: 'rules', label: 'Rules', icon: Tags },
  { id: 'data', label: 'Data', icon: Database },
] as const;
type TabId = (typeof TABS)[number]['id'];

const readTab = (): TabId => TABS.find((t) => `#${t.id}` === window.location.hash)?.id ?? 'dashboard';

export default function App() {
  const [tab, setTab] = useState<TabId>(readTab);
  const [month, setMonth] = useState(() => monthKey(todayISO()));
  const storageError = useStorageError();
  const sample = useStored(sampleManifest);
  const usesMonth = tab === 'dashboard' || tab === 'transactions' || tab === 'budgets';

  useEffect(() => {
    const onHash = () => setTab(readTab());
    window.addEventListener('hashchange', onHash);
    // Ask the browser not to evict our data under storage pressure.
    void navigator.storage?.persist?.();
    return () => window.removeEventListener('hashchange', onHash);
  }, []);

  return (
    <div className="mx-auto max-w-6xl px-4 py-4">
      <header className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-bold">₹ Fin Track</h1>
        {usesMonth && (
          <div className="flex items-center gap-2">
            <Button aria-label="Previous month" onClick={() => setMonth(shiftMonth(month, -1))}><ChevronLeft size={16} /></Button>
            <span className="w-20 text-center text-sm font-medium">{monthLabel(month)}</span>
            <Button aria-label="Next month" onClick={() => setMonth(shiftMonth(month, 1))}><ChevronRight size={16} /></Button>
          </div>
        )}
      </header>
      <nav className="mb-4 flex gap-1 overflow-x-auto border-b border-line" aria-label="Sections">
        {TABS.map(({ id, label, icon: Icon }) => (
          <a key={id} href={`#${id}`} aria-current={tab === id ? 'page' : undefined}
            className={`flex items-center gap-1.5 border-b-2 px-3 py-2 text-sm whitespace-nowrap ${tab === id ? 'border-accent font-semibold' : 'border-transparent text-muted'}`}>
            <Icon size={16} />{label}
          </a>
        ))}
      </nav>
      {storageError && <p role="alert" className="mb-4 rounded-lg border border-danger p-3 text-sm text-danger">{storageError}</p>}
      {sample && tab !== 'data' && <div className="mb-4 rounded-lg border border-line bg-surface p-3"><SampleControls /></div>}
      <main>
        {tab === 'dashboard' && <Dashboard month={month} />}
        {tab === 'transactions' && <Transactions month={month} />}
        {tab === 'budgets' && <Budgets month={month} />}
        {tab === 'bills' && <Bills />}
        {tab === 'goals' && <Goals />}
        {tab === 'rules' && <Rules />}
        {tab === 'data' && <DataView />}
      </main>
    </div>
  );
}
