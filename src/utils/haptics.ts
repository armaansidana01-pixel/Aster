import { SATDomainId } from '../types';

export type HapticEventType =
  | 'start_test'
  | 'welcome_dismiss'
  | 'intro_step'
  | 'tab_switch'
  | 'menu_toggle'
  | 'module_transition';

declare global {
  interface Window {
    __asterLastHaptic?: {
      event: HapticEventType;
      pattern: number | number[];
      timestamp: number;
    };
  }
}

/**
 * Pure helper returning tactile vibration duration/pattern (ms) for PWA interactions.
 */
export function getHapticPattern(event: HapticEventType): number | number[] {
  switch (event) {
    case 'start_test':
      return [18, 35, 28];
    case 'welcome_dismiss':
      return [14, 28, 22];
    case 'module_transition':
      return [16, 30, 20];
    case 'intro_step':
      return 14;
    case 'tab_switch':
      return 10;
    case 'menu_toggle':
      return 8;
    default:
      return 10;
  }
}

/**
 * Triggers Web Vibration API feedback on supported mobile/PWA devices.
 * Safe no-op when navigator.vibrate is unavailable.
 */
export function triggerHaptic(event: HapticEventType): boolean {
  const pattern = getHapticPattern(event);
  if (typeof window !== 'undefined') {
    window.__asterLastHaptic = {
      event,
      pattern,
      timestamp: Date.now(),
    };
  }
  try {
    if (
      typeof navigator !== 'undefined' &&
      typeof navigator.vibrate === 'function'
    ) {
      return navigator.vibrate(pattern);
    }
  } catch {
    // Ignore security/permission errors in restricted contexts
  }
  return false;
}

/**
 * Determines if a viewport width is within mobile breakpoint (< 768px).
 */
export function isMobileViewport(viewportWidth?: number): boolean {
  const width =
    typeof viewportWidth === 'number'
      ? viewportWidth
      : typeof window !== 'undefined'
      ? window.innerWidth
      : 1024;
  return width < 768;
}

/**
 * Pure helper computing initial collapsed/expanded menu states for TestStartScreen.
 * On mobile (< 768px), ALL menus start collapsed (expandedMode = null,
 * suggestedDropdownOpen = false, and all 8 SAT domain accordions = false).
 */
export function getInitialTestStartMenuState(
  isMobile: boolean,
  initialMode: 'practice' | 'mock' | 'drill' = 'practice'
): {
  expandedMode: 'practice' | 'mock' | 'drill' | null;
  suggestedDropdownOpen: boolean;
  expandedDomains: Record<SATDomainId, boolean>;
} {
  if (isMobile) {
    return {
      expandedMode: null,
      suggestedDropdownOpen: false,
      expandedDomains: {
        INI: false,
        CAS: false,
        EOI: false,
        SEC: false,
        ALG: false,
        ADV: false,
        PSD: false,
        GEO: false,
      },
    };
  }
  return {
    expandedMode: initialMode,
    suggestedDropdownOpen: true,
    expandedDomains: {
      INI: true,
      CAS: true,
      EOI: true,
      SEC: true,
      ALG: true,
      ADV: true,
      PSD: true,
      GEO: true,
    },
  };
}
