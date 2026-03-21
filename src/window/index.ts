import type { WindowType, CustomWindow } from '../types';
import type { WindowTracker } from './types';
import { HourlyWindow } from './hourly';
import { DailyWindow } from './daily';
import { MonthlyWindow } from './monthly';
import { CustomDurationWindow } from './custom';

export function createWindowTracker(window: WindowType | CustomWindow, now?: number): WindowTracker {
  switch (typeof window === 'string' ? window : window.type) {
    case 'hourly': return new HourlyWindow(now);
    case 'daily': return new DailyWindow(now);
    case 'monthly': return new MonthlyWindow(now);
    case 'custom': return new CustomDurationWindow((window as CustomWindow).durationMs, now);
    default: throw new TypeError(`Invalid window type: ${window}`);
  }
}

export type { WindowTracker } from './types';
export { HourlyWindow } from './hourly';
export { DailyWindow } from './daily';
export { MonthlyWindow } from './monthly';
export { CustomDurationWindow } from './custom';
