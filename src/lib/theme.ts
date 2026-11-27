export const THEMES = ['System', 'Light', 'Dark'] as const;
export type Theme = (typeof THEMES)[number];

/** A display preference, not personal data: it stays unencrypted so the lock screen can use it. */
export const THEME_KEY = 'fin_tracker_v1_theme';

export function readTheme(): Theme {
  try {
    const saved = localStorage.getItem(THEME_KEY);
    return THEMES.find((t) => t === saved) ?? 'System';
  } catch { return 'System'; }
}

/** "System" removes the attribute, so the device setting decides. */
export function applyTheme(theme: Theme): void {
  if (theme === 'System') delete document.documentElement.dataset.theme;
  else document.documentElement.dataset.theme = theme.toLowerCase();
}

export function saveTheme(theme: Theme): void {
  applyTheme(theme);
  try { localStorage.setItem(THEME_KEY, theme); } catch { /* applies for this visit only */ }
}
