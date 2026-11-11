import type { Theme, ThemePreference } from './types';
export function resolveTheme(preference: ThemePreference): Theme {
  return preference==='system'?(matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light'):preference;
}
export function cacheTheme(preference: ThemePreference, accent?: string) {
  try { localStorage.setItem('shixu-theme-v1',JSON.stringify({theme:preference,accent:accent||document.documentElement.style.getPropertyValue('--accent')})); } catch { /* persistence may be unavailable */ }
}
