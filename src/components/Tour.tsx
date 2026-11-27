import { useEffect, useRef, useState } from 'react';
import { useStored } from '../lib/storage';
import { guideSeen } from '../store';
import { Button } from './ui';

const STEPS = [
  { title: 'Welcome to Fin Track', body: 'A private money tracker. Your records stay in this browser: no account and no server. You are looking at sample data, which you can clear at any time.' },
  { title: 'Add spending in one line', body: 'In Quick add, type something like “450 lunch swiggy UPI” and press Add. A preview shows how it will be saved.' },
  { title: 'Bring in your bank statement', body: 'Press “Import statement” and choose an Excel or CSV file from your bank. You review every row before anything is saved.' },
  { title: 'See where you stand', body: 'The Dashboard shows what is safe to spend each day, your budgets and who owes you money.' },
  { title: 'Keep a backup', body: 'Clearing browser data deletes your records, so use “Full backup” on the Import & Export tab now and then. The Guide tab explains everything else.' },
];

const OPEN = 'fin-track:tour';
export const openTour = () => window.dispatchEvent(new Event(OPEN));

/** Opens by itself on a first visit, and again whenever the Guide asks for it. */
export default function Tour() {
  const seen = useStored(guideSeen);
  const dialog = useRef<HTMLDialogElement>(null);
  const [step, setStep] = useState(0);

  useEffect(() => {
    const open = () => { setStep(0); if (!dialog.current?.open) dialog.current?.showModal(); };
    window.addEventListener(OPEN, open);
    if (!guideSeen.get()) open();
    return () => window.removeEventListener(OPEN, open);
  }, []);

  const finish = () => dialog.current?.close();
  const current = STEPS[step]!;
  return (
    // onClose also covers the Escape key.
    <dialog ref={dialog} aria-labelledby="tour-title" onClose={() => { if (!seen) guideSeen.set(true); }}
      className="m-auto w-[min(26rem,calc(100%-2rem))] rounded-xl border border-line bg-surface p-5 text-ink backdrop:bg-black/50">
      <p className="text-xs text-muted">Step {step + 1} of {STEPS.length}</p>
      <h2 id="tour-title" className="mt-1 text-lg font-semibold">{current.title}</h2>
      <p className="mt-2 min-h-24 text-sm">{current.body}</p>
      <div className="mt-3 flex items-center justify-between gap-2">
        <Button onClick={finish}>Skip</Button>
        <span className="flex gap-2">
          {step > 0 && <Button onClick={() => setStep(step - 1)}>Back</Button>}
          <Button variant="primary" onClick={() => (step === STEPS.length - 1 ? finish() : setStep(step + 1))}>
            {step === STEPS.length - 1 ? 'Done' : 'Next'}
          </Button>
        </span>
      </div>
    </dialog>
  );
}
