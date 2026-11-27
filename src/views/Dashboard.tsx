import { BudgetChart, CumulativeChart, TrendChart } from '../components/Charts';
import SafeToSpend from '../components/SafeToSpend';
import SplitCard from '../components/SplitCard';
import Insights from '../components/Insights';
import QuickAdd from '../components/QuickAdd';
import { saveTransaction } from '../components/TransactionForm';
import { Button, Card, Empty } from '../components/ui';
import { budgetSplit, categoryVsBudget, cumulativeSpend, monthSummary, owedToMe, trend } from '../lib/analytics';
import { dateLabel, daysBetween, todayISO } from '../lib/dates';
import { formatINR } from '../lib/format';
import { useData } from '../store';

export default function Dashboard({ month }: { month: string }) {
  const { transactions, bills, budgets } = useData();
  const s = monthSummary(transactions, month);
  const owed = owedToMe(transactions);
  const today = todayISO();
  const upcoming = bills.filter((b) => daysBetween(today, b.nextDueDate) <= 30).sort((a, b) => a.nextDueDate.localeCompare(b.nextDueDate));
  const tiles = [
    ['Income', s.income], ['Expenses', s.expense], ['Invested', s.invested], ['Net cash flow', s.net], ['Owed to Me (all time)', owed.total],
  ] as const;

  return (
    <div className="space-y-4">
      <QuickAdd />
      <div className="grid gap-4 lg:grid-cols-2">
        <SafeToSpend month={month} />
        <SplitCard split={budgetSplit(transactions, month)} />
      </div>
      <h2 className="font-semibold">Cash flow</h2>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        {tiles.map(([label, value]) => (
          <Card key={label}>
            <p className="text-xs text-muted">{label}</p>
            <p className="mt-1 text-lg font-semibold break-words">{formatINR(value)}</p>
          </Card>
        ))}
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <BudgetChart data={categoryVsBudget(transactions, budgets, month)} />
        <CumulativeChart data={cumulativeSpend(transactions, month, today)} />
      </div>
      <Insights key={month} month={month} />
      <TrendChart data={trend(transactions, month)} />
      <div className="grid gap-4 lg:grid-cols-2">
        <Card title="Bills due in 30 days">
          {!upcoming.length ? <Empty>Nothing due.</Empty> : (
            <ul className="divide-y divide-line text-sm">
              {upcoming.map((b) => (
                <li key={b.id} className="flex justify-between gap-2 py-2">
                  <span>{b.name}<span className={`block text-xs ${b.nextDueDate < today ? 'text-danger' : 'text-muted'}`}>{b.nextDueDate < today ? 'Overdue · ' : ''}{dateLabel(b.nextDueDate)}</span></span>
                  <span className="tabular-nums">{formatINR(b.amount)}</span>
                </li>
              ))}
            </ul>
          )}
        </Card>
        <Card title="Owed to Me">
          {!owed.rows.length ? <Empty>Nobody owes you anything.</Empty> : (
            <ul className="divide-y divide-line text-sm">
              {owed.rows.map((r) => (
                <li key={r.merchant} className="flex items-center justify-between gap-2 py-2">
                  <span className="min-w-0 break-words">{r.merchant}</span>
                  <span className="flex items-center gap-2">
                    <span className="tabular-nums">{formatINR(r.amount)}</span>
                    <Button onClick={() => {
                      if (window.confirm(`Record ${formatINR(r.amount)} received for ${r.merchant}?`)) {
                        saveTransaction({ date: today, type: 'Income', amount: r.amount, category: 'Other', subCategory: 'Reimbursement', spendingNature: 'Savings', account: r.account, merchant: r.merchant, isReimbursable: true });
                      }
                    }}>Mark repaid</Button>
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </div>
  );
}
