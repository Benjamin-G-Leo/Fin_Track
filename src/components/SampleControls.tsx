import { RotateCcw, Trash2 } from 'lucide-react';
import { useStored } from '../lib/storage';
import { clearSample, loadSample, sampleManifest } from '../store';
import { Button } from './ui';

export default function SampleControls() {
  const sample = useStored(sampleManifest);
  const reset = () => {
    if (!sample || window.confirm('Reset the sample records to their original values? Entries you added yourself are kept.')) loadSample();
  };
  const clear = () => {
    if (window.confirm('Remove all sample records, including any edits you made to them? Entries you added yourself are kept.')) clearSample();
  };
  return (
    <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
      <span className="text-muted">{sample ? 'Sample data is loaded.' : 'No sample data loaded.'}</span>
      <span className="flex flex-wrap gap-2">
        <Button onClick={reset}><RotateCcw size={14} />{sample ? 'Reset sample data' : 'Load sample data'}</Button>
        {sample && <Button variant="danger" onClick={clear}><Trash2 size={14} />Clear sample data</Button>}
      </span>
    </div>
  );
}
