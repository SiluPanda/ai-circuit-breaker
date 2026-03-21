export interface WindowTracker {
  getWindowStart(): string;  // ISO 8601
  getWindowEnd(): string;    // ISO 8601
  isExpired(now?: number): boolean;
  reset(now?: number): void;
  getResetsIn(now?: number): number;  // ms until window end
}
