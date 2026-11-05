import type { IconName } from '@/client/group-icon';

export type FrameIcon =
  | 'home' | 'budgets' | 'add' | 'bills' | 'activity' | 'mic' | 'scan' | 'type' | 'bell'
  | 'settings' | 'check' | 'alert' | 'calendar' | 'back' | 'prev' | 'next' | 'grow';

// 24 × 24 line icons, 2 px stroke, round ends. Each entry is the inner SVG markup (paths are static, never user data).
const PATHS: Record<IconName | FrameIcon, string> = {
  shield: '<path d="M12 3 5 6v5c0 4.5 3 8 7 10 4-2 7-5.5 7-10V6l-7-3Z"/><path d="m9 12 2 2 4-4"/>',
  pot: '<path d="M6 10h12l-1 8a3 3 0 0 1-3 2.5h-4A3 3 0 0 1 7 18l-1-8Z"/><path d="M5 10h14"/><path d="M9 6c0-1.5 1-1.5 1-3M14 6c0-1.5 1-1.5 1-3"/>',
  cake: '<path d="M4 20h16v-6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v6Z"/><path d="M8 12V9M12 12V9M16 12V9"/><path d="M8 6.5V6M12 6.5V6M16 6.5V6"/>',
  book: '<path d="M5 4h11a3 3 0 0 1 3 3v13H8a3 3 0 0 1-3-3V4Z"/><path d="M5 17a3 3 0 0 1 3-3h11"/>',
  plane: '<path d="m3 12 18-8-5 17-4-7-9-2Z"/><path d="m12 14 9-10"/>',
  car: '<path d="M5 16V11l2-5h10l2 5v5"/><path d="M3 16h18v3H3zM7 11h10"/><circle cx="7.5" cy="16" r=".5"/><circle cx="16.5" cy="16" r=".5"/>',
  wrench: '<path d="M14.5 6.5a4 4 0 0 0 4.9 4.9L11 19.8a2.1 2.1 0 0 1-3-3l8.4-8.4"/><path d="M14.5 6.5 17 4l3 3-2.5 2.5"/>',
  child: '<circle cx="12" cy="8" r="3.5"/><path d="M5 20c0-4 3-6.5 7-6.5s7 2.5 7 6.5"/>',
  food: '<path d="M6 3v8a2 2 0 0 0 2 2v8M10 3v8M8 3v6"/><path d="M17 3c-2 1.5-3 4-3 7h3v11"/>',
  house: '<path d="m3 11 9-7 9 7"/><path d="M5 10v10h14V10"/><path d="M10 20v-6h4v6"/>',
  bolt: '<path d="M13 3 5 14h6l-1 7 8-11h-6l1-7Z"/>',
  heart: '<path d="M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.5A4 4 0 0 1 19 10c0 5.6-7 10-7 10Z"/>',
  screen: '<rect x="3" y="5" width="18" height="12" rx="2"/><path d="M8 21h8M12 17v4"/>',
  person: '<circle cx="12" cy="8" r="4"/><path d="M4 21c0-4 3.6-7 8-7s8 3 8 7"/>',
  savings: '<path d="M5 11a7 6 0 0 1 14 0c0 3-1.5 4.5-3 5.5V19h-3v-1.5h-2V19H8v-2.5C6.5 15.5 5 14 5 11Z"/><path d="M19 10h2M12 5.2V4"/><circle cx="15" cy="10" r=".6"/>',
  tag: '<path d="M3 12V4h8l10 10-8 8L3 12Z"/><circle cx="7.5" cy="8.5" r="1.2"/>',
  home: '<path d="m3 11 9-7 9 7"/><path d="M5 10v10h14V10"/>',
  budgets: '<circle cx="12" cy="12" r="9"/><path d="M12 3v9l6.5 4.5"/>',
  add: '<path d="M12 5v14M5 12h14"/>',
  bills: '<rect x="4" y="3" width="16" height="18" rx="2"/><path d="M8 8h8M8 12h8M8 16h5"/>',
  activity: '<path d="M4 12h4l2-6 4 12 2-6h4"/>',
  mic: '<rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5 11a7 7 0 0 0 14 0M12 18v3"/>',
  scan: '<path d="M4 8V6a2 2 0 0 1 2-2h2M16 4h2a2 2 0 0 1 2 2v2M20 16v2a2 2 0 0 1-2 2h-2M8 20H6a2 2 0 0 1-2-2v-2"/><path d="M4 12h16"/>',
  type: '<rect x="3" y="6" width="18" height="12" rx="2"/><path d="M7 10h.01M11 10h.01M15 10h.01M8 14h8"/>',
  bell: '<path d="M6 16V11a6 6 0 0 1 12 0v5l1.5 2h-15L6 16Z"/><path d="M10 21h4"/>',
  settings: '<circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3M4.9 4.9 7 7M17 17l2.1 2.1M4.9 19.1 7 17M17 7l2.1-2.1"/>',
  check: '<path d="m5 12.5 4.5 4.5L19 7.5"/>',
  alert: '<path d="M12 4 2.5 20h19L12 4Z"/><path d="M12 10v4M12 17h.01"/>',
  calendar: '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4"/>',
  back: '<path d="m15 5-7 7 7 7"/>',
  prev: '<path d="m15 5-7 7 7 7"/>',
  next: '<path d="m9 5 7 7-7 7"/>',
  grow: '<path d="M4 17 10 11l4 4 6-7"/><path d="M15 8h5v5"/>',
};

export function Icon({ name, className }: { name: IconName | FrameIcon; className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      width="24"
      height="24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      className={className}
      dangerouslySetInnerHTML={{ __html: PATHS[name] }}
    />
  );
}
