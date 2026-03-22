import type { WindowType, CustomWindow } from '../types';
import type { WindowTracker } from './types';
export declare function createWindowTracker(window: WindowType | CustomWindow, now?: number): WindowTracker;
export type { WindowTracker } from './types';
export { HourlyWindow } from './hourly';
export { DailyWindow } from './daily';
export { MonthlyWindow } from './monthly';
export { CustomDurationWindow } from './custom';
//# sourceMappingURL=index.d.ts.map