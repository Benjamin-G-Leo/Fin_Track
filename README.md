# Fin Track

Local-first personal finance tracker in INR. React, TypeScript, Tailwind, Recharts, SheetJS.

```bash
npm install
npm run dev      # development
npm test         # unit tests
npm run build    # type-check and production build (offline-capable PWA)
npm run preview  # serve the production build
```

## Behaviour worth knowing

- First launch loads sample data. "Clear sample data" removes only the seeded records.
- Safe to spend = (this month's income − unpaid bills due by month end − savings target − personal
  expenses) ÷ days left including today. The target defaults to 20% of income.
- Data lives in `localStorage` under `fin_tracker_v1_*`. It is per browser **and per address**, so
  dev (`:5173`) and preview (`:4173`) have separate data. Export to Excel to back up or move it.
- Quick add: `450 swiggy hdfc upi yesterday`, `salary 1.25L sbi 1/11`, `1200 lunch cash #r` (`#r` = reimbursable).
- A transaction id is a hash of date, amount and merchant. Repeats you confirm get a `-2`, `-3` suffix.
- "Owed to Me" is reimbursable expenses minus reimbursable income for the same merchant.
- OpenRouter is optional. The key is stored unencrypted in this browser and is never exported.
- SheetJS is installed from its official CDN tarball, because the npm registry copy is outdated.
