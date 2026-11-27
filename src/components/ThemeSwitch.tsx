import { useEffect, useState } from 'react';
import { Monitor, Moon, Sun } from 'lucide-react';
import { applyTheme, readTheme, saveTheme, THEME_KEY, THEMES, type Theme } from '../lib/theme';

const ICONS = { System: Monitor, Light: Sun, Dark: Moon };

export default function ThemeSwitch() {
  const [theme, setTheme] = useState(readTheme);
  const Icon = ICONS[theme];

  // Follow a change made in another tab.
  useEffect(() => {
    const sync = (e: StorageEvent) => {
      if (e.key !== THEME_KEY) return;
      const next = readTheme();
      applyTheme(next); setTheme(next);
    };
    window.addEventListener('storage', sync);
    return () => window.removeEventListener('storage', sync);
  }, []);

  return (
    <label className="flex items-center gap-1.5 rounded-lg border border-line bg-surface px-2 py-1.5 text-sm font-medium">
      <Icon size={14} aria-hidden />
      <select aria-label="Theme" className="cursor-pointer bg-surface" value={theme}
        onChange={(e) => { const next = e.target.value as Theme; saveTheme(next); setTheme(next); }}>
        {THEMES.map((t) => <option key={t}>{t}</option>)}
      </select>
    </label>
  );
}
