/**
 * Breadcrumb APIs
 *
 * Functions for managing breadcrumbs - a trail of events before an error.
 */

// Breadcrumb management
export {
  addBreadcrumb,
  validateBreadcrumb,
  createBreadcrumb,
  createNavigationBreadcrumb,
  createHttpBreadcrumb,
  createUIBreadcrumb,
  createConsoleBreadcrumb,
  createQueryBreadcrumb,
  clearBreadcrumbs,
  getBreadcrumbs,
  getRecentBreadcrumbs,
  filterBreadcrumbsByType,
  filterBreadcrumbsByCategory,
  filterBreadcrumbsByLevel,
  mergeBreadcrumbs,
  DEFAULT_MAX_BREADCRUMBS,
  type BreadcrumbType,
  type BeforeBreadcrumbCallback,
  type AddBreadcrumbOptions,
} from './breadcrumb';

// Automatic breadcrumb collection
export {
  setupAutoBreadcrumbs,
  setupConsoleBreadcrumbs,
  setupClickBreadcrumbs,
  setupNavigationBreadcrumbs,
  setupFetchBreadcrumbs,
  setupXHRBreadcrumbs,
  instrumentConsole,
  instrumentDOM,
  instrumentHistory,
  instrumentFetch,
  instrumentXHR,
  instrumentForms,
  instrumentFocus,
  type AddBreadcrumbFn,
  type CleanupFn,
  type AutoBreadcrumbOptions,
} from './auto';
