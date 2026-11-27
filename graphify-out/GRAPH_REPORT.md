# Graph Report - Fin_Track  (2026-11-27)

## Corpus Check
- cluster-only mode — file stats not available

## Summary
- 408 nodes · 1586 edges · 10 communities
- Extraction: 99% EXTRACTED · 1% INFERRED · 0% AMBIGUOUS · INFERRED: 22 edges (avg confidence: 0.85)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `71fcf8d8`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- Bank Statement Import and Parsing
- UI Components and Views
- Analytics, Dates and Sample Data
- Build and Deploy Config
- App Shell and Store
- Storage and Encryption
- AI Client and Privacy Masking
- README
- TypeScript Config
- Excel Import and Export

## God Nodes (most connected - your core abstractions)
1. `Button()` - 42 edges
2. `Card()` - 36 edges
3. `useData()` - 28 edges
4. `formatINR()` - 25 edges
5. `Dashboard()` - 25 edges
6. `todayISO()` - 24 edges
7. `react` - 23 edges
8. `App()` - 21 edges
9. `useStored()` - 21 edges
10. `StatementImporter()` - 20 edges

## Surprising Connections (you probably didn't know these)
- `DataView()` --indirect_call--> `mergeTransactions()`  [INFERRED]
  src/views/Data.tsx → src/lib/ids.ts
- `ImportResult` --references--> `TransactionDraft`  [EXTRACTED]
  src/lib/excel.ts → src/types.ts
- `PreviewTable()` --calls--> `Select()`  [EXTRACTED]
  src/components/PreviewTable.tsx → src/components/ui.tsx
- `PreviewTable()` --calls--> `dateLabel()`  [EXTRACTED]
  src/components/PreviewTable.tsx → src/lib/dates.ts
- `PreviewTable()` --calls--> `formatINR()`  [EXTRACTED]
  src/components/PreviewTable.tsx → src/lib/format.ts

## Import Cycles
- None detected.

## Communities (10 total, 0 thin omitted)

### Community 0 - "Bank Statement Import and Parsing"
Cohesion: 0.11
Nodes (44): PreviewTable(), SmartPaste(), LABELS, StatementImporter(), quick(), aiBatch(), BatchResult, MONTHS (+36 more)

### Community 1 - "UI Components and Views"
Cohesion: 0.12
Nodes (64): lucide-react, react, App(), readTab(), TabId, TABS, BudgetChart(), ChartCard() (+56 more)

### Community 2 - "Analytics, Dates and Sample Data"
Cohesion: 0.14
Nodes (37): breakdown(), budgetSplit(), byCategory(), byNature(), cumulativeSpend(), fundPlan(), monthEnd(), monthSummary() (+29 more)

### Community 3 - "Build and Deploy Config"
Cohesion: 0.05
Nodes (42): dependencies, lucide-react, @noble/ciphers, react, react-dom, recharts, xlsx, devDependencies (+34 more)

### Community 4 - "App Shell and Store"
Cohesion: 0.11
Nodes (24): DEFAULT_RULES, escape(), removeSample(), SampleManifest, Salvaged, billDays, clearSample(), commit() (+16 more)

### Community 5 - "Storage and Encryption"
Cohesion: 0.08
Nodes (44): react-dom, AppLock(), ICONS, ThemeSwitch(), Unlock(), exportCsv(), exportExcel(), importExcel() (+36 more)

### Community 6 - "AI Client and Privacy Masking"
Cohesion: 0.15
Nodes (20): Insights(), openAiSettings(), BANKS, detectAccount(), KINDS, wordRe(), categoryVsBudget(), aiInsights() (+12 more)

### Community 7 - "README"
Cohesion: 0.08
Nodes (24): Bank statements (Import & Export tab), Code map, Contents, Data model, Deployment, Development, Export and backup (Import & Export tab), ₹ Fin Track (+16 more)

### Community 8 - "TypeScript Config"
Cohesion: 0.12
Nodes (15): compilerOptions, isolatedModules, jsx, lib, module, moduleResolution, noEmit, noUncheckedIndexedAccess (+7 more)

### Community 9 - "Excel Import and Export"
Cohesion: 0.12
Nodes (38): applyImport(), buildWorkbook(), checkRows(), FileLimit, ImportResult, isKnown(), keyed(), makeSheet() (+30 more)

## Knowledge Gaps
- **4 isolated node(s):** `tailwindcss`, `@types/react`, `@types/react-dom`, `typescript`
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 104 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `react` connect `UI Components and Views` to `Bank Statement Import and Parsing`, `Build and Deploy Config`, `Storage and Encryption`, `AI Client and Privacy Masking`?**
  _High betweenness centrality (0.072) - this node is a cross-community bridge._
- **What connects `tailwindcss`, `@types/react`, `@types/react-dom` to the rest of the system?**
  _4 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Bank Statement Import and Parsing` be split into smaller, more focused modules?**
  _Cohesion score 0.10633484162895927 - nodes in this community are weakly interconnected._
- **Why does `lucide-react` connect `UI Components and Views` to `Bank Statement Import and Parsing`, `Build and Deploy Config`, `Storage and Encryption`, `AI Client and Privacy Masking`?**
  _High betweenness centrality (0.047) - this node is a cross-community bridge._
- **Should `UI Components and Views` be split into smaller, more focused modules?**
  _Cohesion score 0.11743450767841011 - nodes in this community are weakly interconnected._
- **Should `Analytics, Dates and Sample Data` be split into smaller, more focused modules?**
  _Cohesion score 0.1362126245847176 - nodes in this community are weakly interconnected._
- **Should `Build and Deploy Config` be split into smaller, more focused modules?**
  _Cohesion score 0.047474747474747475 - nodes in this community are weakly interconnected._