export type Theme = 'light' | 'dark';
export type ThemePreference = Theme | 'system';
export type LiquidPhase = 'pour' | 'impact' | 'rise' | 'complete';
export type StopReason = 'complete' | 'interrupted' | 'unmount';
export interface LiquidFrame {
  progress: number;
  phase: LiquidPhase;
  target: Theme;
  reducedMotion: boolean;
}
/** begin must be invoked synchronously inside a user gesture. No audio is required. */
export interface LiquidSoundAdapter {
  begin(target: Theme, reducedMotion: boolean): void;
  update(frame: LiquidFrame): void;
  stop(reason: StopReason): void;
  setVolume?(volume: number): void;
}
export interface LiquidThemeOptions {
  /** Controlled resolved theme. The caller commits this value in onThemeChange. */
  theme: Theme;
  onThemeChange: (theme: Theme) => void;
  root: () => HTMLElement | null;
  duration?: number;
  sound?: LiquidSoundAdapter;
}
export interface SoundSettings { enabled: boolean; volume: number }
