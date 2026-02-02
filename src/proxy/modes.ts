/**
 * Logger Mode Management
 *
 * Defines the operating modes for the Universal Logger.
 */

/**
 * Available logger modes.
 *
 * - 'standalone': Local logging only, no Sentry integration
 * - 'sentry-proxy': Intercept Sentry calls, log locally only
 * - 'sentry-dual': Log locally AND forward to Sentry
 */
export type LoggerMode = 'standalone' | 'sentry-proxy' | 'sentry-dual';

/**
 * Configuration for each logger mode.
 */
export interface ModeConfig {
  /**
   * The mode name.
   */
  mode: LoggerMode;

  /**
   * Whether to capture events locally.
   */
  captureLocally: boolean;

  /**
   * Whether to forward events to Sentry.
   */
  forwardToSentry: boolean;

  /**
   * Whether to intercept the global Sentry object.
   */
  interceptSentry: boolean;

  /**
   * Description of the mode for debugging.
   */
  description: string;
}

/**
 * Mode configurations for each available mode.
 */
const MODE_CONFIGS: Record<LoggerMode, ModeConfig> = {
  standalone: {
    mode: 'standalone',
    captureLocally: true,
    forwardToSentry: false,
    interceptSentry: false,
    description: 'Local logging only, no Sentry integration',
  },

  'sentry-proxy': {
    mode: 'sentry-proxy',
    captureLocally: true,
    forwardToSentry: false,
    interceptSentry: true,
    description: 'Intercept Sentry calls and log locally only',
  },

  'sentry-dual': {
    mode: 'sentry-dual',
    captureLocally: true,
    forwardToSentry: true,
    interceptSentry: true,
    description: 'Log locally AND forward to Sentry',
  },
};

/**
 * Get the configuration for a logger mode.
 *
 * @param mode - The mode to get configuration for
 * @returns Mode configuration
 *
 * @example
 * ```typescript
 * const config = getModeConfig('sentry-dual');
 * // {
 * //   mode: 'sentry-dual',
 * //   captureLocally: true,
 * //   forwardToSentry: true,
 * //   interceptSentry: true,
 * //   description: 'Log locally AND forward to Sentry'
 * // }
 * ```
 */
export function getModeConfig(mode: LoggerMode): ModeConfig {
  const config = MODE_CONFIGS[mode];

  if (!config) {
    // Default to standalone if unknown mode
    console.warn(`[Universal Logger] Unknown mode: ${mode}, defaulting to 'standalone'`);
    return MODE_CONFIGS.standalone;
  }

  return config;
}

/**
 * Check if a mode is valid.
 *
 * @param mode - The mode to check
 * @returns True if the mode is valid
 */
export function isValidMode(mode: string): mode is LoggerMode {
  return mode === 'standalone' || mode === 'sentry-proxy' || mode === 'sentry-dual';
}

/**
 * Get all available modes.
 *
 * @returns Array of available mode names
 */
export function getAvailableModes(): LoggerMode[] {
  return Object.keys(MODE_CONFIGS) as LoggerMode[];
}

/**
 * Get all mode configurations.
 *
 * @returns Record of all mode configurations
 */
export function getAllModeConfigs(): Record<LoggerMode, ModeConfig> {
  return { ...MODE_CONFIGS };
}

/**
 * Determine the best mode based on options.
 *
 * @param hasDsn - Whether a DSN is configured
 * @param wantsLocalOnly - Whether user only wants local logging
 * @param wantsIntercept - Whether user wants to intercept global Sentry
 * @returns Recommended mode
 */
export function recommendMode(
  hasDsn: boolean,
  wantsLocalOnly: boolean,
  wantsIntercept: boolean
): LoggerMode {
  // If no DSN and no interception needed, use standalone
  if (!hasDsn && !wantsIntercept) {
    return 'standalone';
  }

  // If they want to intercept but only log locally
  if (wantsIntercept && (wantsLocalOnly || !hasDsn)) {
    return 'sentry-proxy';
  }

  // If they have DSN and want both local and remote
  if (hasDsn && wantsIntercept) {
    return 'sentry-dual';
  }

  // Default to standalone
  return 'standalone';
}

/**
 * Mode state for runtime tracking.
 */
export interface ModeState {
  /**
   * Current mode.
   */
  currentMode: LoggerMode;

  /**
   * Whether the mode is active.
   */
  isActive: boolean;

  /**
   * Whether Sentry interception is active.
   */
  isIntercepting: boolean;

  /**
   * When the mode was set.
   */
  activatedAt?: number;

  /**
   * Original Sentry object reference (if intercepting).
   */
  originalSentry?: unknown;
}

/**
 * Create initial mode state.
 *
 * @param mode - Initial mode
 * @returns Mode state
 */
export function createModeState(mode: LoggerMode): ModeState {
  return {
    currentMode: mode,
    isActive: false,
    isIntercepting: false,
    activatedAt: undefined,
    originalSentry: undefined,
  };
}

/**
 * Update mode state when activating.
 *
 * @param state - Current state
 * @param config - Mode configuration
 * @param originalSentry - Reference to original Sentry object
 * @returns Updated state
 */
export function activateModeState(
  state: ModeState,
  config: ModeConfig,
  originalSentry?: unknown
): ModeState {
  return {
    currentMode: config.mode,
    isActive: true,
    isIntercepting: config.interceptSentry,
    activatedAt: Date.now(),
    originalSentry,
  };
}

/**
 * Update mode state when deactivating.
 *
 * @param state - Current state
 * @returns Updated state
 */
export function deactivateModeState(state: ModeState): ModeState {
  return {
    ...state,
    isActive: false,
    isIntercepting: false,
  };
}
