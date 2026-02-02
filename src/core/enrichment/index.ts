/**
 * Enrichment APIs
 *
 * Functions for enriching events with contextual data.
 */

// Tag management
export {
  TAG_KEY_MAX_LENGTH,
  TAG_VALUE_MAX_LENGTH,
  TAG_KEY_PATTERN,
  validateTagKey,
  validateTagValue,
  isReservedTag,
  sanitizeTag,
  setTag,
  setTags,
  removeTag,
  clearTags,
  getTag,
  getTags,
  mergeTags,
  serializeTags,
} from './tags';

// Context management
export {
  setContext,
  normalizeContext,
  getContext,
  getContexts,
  clearContexts,
  mergeContexts,
  setBrowserContext,
  setDeviceContext,
  setOSContext,
} from './context';

// Extra data management
export {
  setExtra,
  setExtras,
  normalizeExtra,
  removeExtra,
  clearExtras,
  getExtra,
  getExtras,
  mergeExtras,
} from './extra';

// User management
export {
  AUTO_IP_ADDRESS,
  setUser,
  getUser,
  clearUser,
  updateUser,
  setUserId,
  setUserEmail,
  setUserIpAddress,
  setAutoIpAddress,
  resolveUserIpAddress,
  mergeUsers,
  hasUserIdentity,
  anonymizeUser,
} from './user';
