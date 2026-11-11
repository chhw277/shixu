import type { ReactNode } from 'react';
import { useLiquidTheme } from './useLiquidTheme';
import type { LiquidThemeOptions } from './types';
import './liquid.css';
/** root must cover the viewport; its application state stays mounted throughout the reveal. */
export function LiquidThemeToggle({children,...options}:LiquidThemeOptions & {children?:ReactNode}) {
  const {requestTheme}=useLiquidTheme(options);
  return <button type="button" data-theme-toggle aria-label="切换主题"
    onClick={event=>requestTheme(options.theme==='light'?'dark':'light',event.currentTarget)}>
    {children??(options.theme==='light'?'切换深色':'切换浅色')}
  </button>;
}
