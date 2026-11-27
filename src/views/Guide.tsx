import type { ReactNode } from 'react';
import { Play } from 'lucide-react';
import { openTour, STEPS } from '../components/Tour';
import { Button, Card } from '../components/ui';

const Topic = ({ title, children }: { title: string; children: ReactNode }) => (
  <details className="rounded-xl border border-line bg-surface p-4 text-sm">
    <summary className="cursor-pointer text-base font-semibold">{title}</summary>
    <div className="mt-3 space-y-2 [&_ol]:list-decimal [&_ol]:pl-5 [&_ul]:list-disc [&_ul]:pl-5 [&_a]:underline">{children}</div>
  </details>
);

export default function Guide() {
  return (
    <div className="space-y-3">
      <Card title="Tutorial" action={<Button variant="primary" onClick={openTour}><Play size={14} />Replay tutorial</Button>}>
        <ol className="space-y-2 text-sm">
          {STEPS.map((s, i) => <li key={s.title}><strong>{i + 1}. {s.title}</strong><span className="block text-muted">{s.body}</span></li>)}
        </ol>
      </Card>

      <Card title="Getting started">
        <p className="text-sm">New here? Do these four things first:</p>
        <ol className="mt-2 list-decimal pl-5 text-sm">
          <li>Press <strong>Clear sample data</strong> when you have finished exploring.</li>
          <li>Add a transaction with Quick add, or <a className="underline" href="#data">import a bank statement</a>.</li>
          <li>Set limits on the <a className="underline" href="#budgets">Budgets</a> tab.</li>
          <li>Take a <strong>Full backup</strong> on the <a className="underline" href="#data">Import &amp; Export</a> tab.</li>
        </ol>
      </Card>

      <Topic title="Import a bank statement">
        <ol>
          <li>In your bank’s net banking, download the statement as <strong>Excel (.xls or .xlsx) or CSV</strong>. PDF files cannot be read.</li>
          <li>Open <a href="#data">Import &amp; Export</a> and press <strong>Choose statement</strong>.</li>
          <li>Check the column mapping. HDFC, ICICI and SBI layouts are suggested automatically; for other banks pick the Date, Narration, Debit and Credit columns yourself.</li>
          <li>Review the rows. Likely duplicates are left unticked. Fix any wrong type or category.</li>
          <li>Press <strong>Import</strong>.</li>
        </ol>
        <p>The file is read inside your browser and is not uploaded. Statements with one amount column and a Dr/Cr marker are not supported yet.</p>
      </Topic>

      <Topic title="Quick add and smart paste">
        <p>Type one line in Quick add, for example:</p>
        <ul>
          <li><code>450 lunch swiggy UPI</code></li>
          <li><code>salary 1.25L sbi 1/11</code> (dates are day first)</li>
          <li><code>300 uber yesterday</code></li>
          <li><code>1200 team lunch cash #r</code> (#r means someone will pay you back)</li>
        </ul>
        <p><strong>Smart paste</strong> on the <a href="#transactions">Transactions</a> tab reads bank and UPI SMS alerts you paste in.</p>
      </Topic>

      <Topic title="Understand the dashboard">
        <ul>
          <li><strong>Safe to spend:</strong> this month’s income, minus bills due, your savings target and what you have spent, divided by the days left. Add your income first.</li>
          <li><strong>50 / 30 / 20:</strong> aim for needs under 50% of income, wants under 30% and savings of at least 20%.</li>
          <li><strong>Owed to Me:</strong> reimbursable spending not yet repaid. Press <strong>Mark repaid</strong> when you get the money.</li>
          <li><strong>Transfers</strong>, such as ATM withdrawals and card bill payments, are not counted as spending.</li>
        </ul>
      </Topic>

      <Topic title="Budgets, bills, goals and rules">
        <ul>
          <li><a href="#budgets">Budgets</a>: a monthly limit for each category.</li>
          <li><a href="#bills">Bills</a>: recurring payments. Press <strong>Paid</strong> to record one and move its due date.</li>
          <li><a href="#goals">Goals</a>: save towards a target and see the amount needed each month.</li>
          <li><a href="#rules">Rules</a>: tell the app which category a merchant belongs to.</li>
        </ul>
      </Topic>

      <Topic title="Backups and moving to another device">
        <p>Your records live only in this browser. They do not sync.</p>
        <ul>
          <li><strong>Full backup</strong> saves your records, budgets, bills, goals and rules to an Excel file.</li>
          <li>On another device, use <strong>Restore from a Fin Track file</strong>.</li>
          <li>Your AI key and app settings are not included, and the file is not encrypted.</li>
        </ul>
      </Topic>

      <Topic title="Privacy, app lock and AI">
        <ul>
          <li><strong>App lock</strong> encrypts your data with a passphrase. A forgotten passphrase cannot be recovered, so back up first.</li>
          <li><strong>AI is optional</strong> and uses free models through your own OpenRouter key, added in <strong>AI settings</strong>.</li>
          <li>AI features send text to OpenRouter. Common identifiers are masked, but names can get through.</li>
          <li>Free models can be wrong or busy. Check results before saving.</li>
        </ul>
      </Topic>

      <p className="text-xs text-muted">Switch between light and dark with the theme menu at the top.</p>
      <p className="text-xs text-muted">Fin Track keeps records. It does not give financial advice.</p>
    </div>
  );
}
