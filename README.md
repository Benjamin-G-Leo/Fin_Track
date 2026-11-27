# Fin Track

Local-first personal finance tracker in INR. React, TypeScript, Tailwind, Recharts, SheetJS.

```bash
npm install
npm run dev      # development
npm test         # unit tests
npm run build    # type-check and production build (offline-capable PWA)
npm run preview  # serve the production build
```

## Security notes

- Security headers, including a Content Security Policy, are in `vercel.json` and also applied by
  `npm run preview`. Add any new external host to `connect-src`.
- Data and the API key are unencrypted unless you turn on the app lock (Data tab): AES-256-GCM with a
  PBKDF2 passphrase, locking after 10 idle minutes. A lost passphrase cannot be recovered. The lock
  cannot stop a malicious extension while the app is unlocked, and exported files are not encrypted.
- AI requests ask for providers that do not store prompts. Add your own names under "Always hide".
  Use a spending-limited key.
- Imports are limited to 10 MB and 50,000 rows.

## Behaviour worth knowing

- Export .xlsx writes Transactions, Monthly Summary, Recurring Bills and Savings Goals. "Full backup"
  adds Budgets and Keyword Rules.
- Bank statement import (Data tab) has HDFC, ICICI and SBI column presets, and you can save your own.
  Rows matching an existing date, amount and merchant are flagged and left unticked.
- First launch loads sample data. "Clear sample data" removes only the seeded records.
- Safe to spend = (this month's income − unpaid bills due by month end − savings target − personal
  expenses) ÷ days left including today. The target defaults to 20% of income.
- Data lives in `localStorage` under `fin_tracker_v1_*`. It is per browser **and per address**, so
  dev (`:5173`) and preview (`:4173`) have separate data. Export to Excel to back up or move it.
- Quick add: `450 swiggy hdfc upi yesterday`, `salary 1.25L sbi 1/11`, `1200 lunch cash #r` (`#r` = reimbursable).
- A transaction id is a hash of date, amount and merchant. Repeats you confirm get a `-2`, `-3` suffix.
- "Owed to Me" is reimbursable expenses minus reimbursable income for the same merchant.
- OpenRouter is optional (header: AI settings). The key is stored unencrypted in this browser and is
  never exported. Typed, SMS and statement text is pattern-masked before sending (payee names can remain); monthly insights send only
  category totals and budget limits.
- SheetJS is installed from its official CDN tarball, because the npm registry copy is outdated.
