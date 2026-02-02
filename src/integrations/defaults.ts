/**
 * Default Integrations
 *
 * Provides the default set of integrations for browser environments.
 */

import type { Integration } from './types.js';
import { browserIntegration } from './browser.js';
import { httpIntegration } from './http.js';
import { breadcrumbsIntegration } from './breadcrumbs.js';
import { tryCatchIntegration } from './trycatch.js';

/**
 * Get the default integrations for browser environments
 *
 * @returns Array of default integrations
 */
export function getDefaultIntegrations(): Integration[] {
  const integrations: Integration[] = [];

  // Browser integration - captures unhandled errors and rejections
  integrations.push(browserIntegration());

  // HTTP integration - instruments fetch and XHR
  integrations.push(httpIntegration());

  // Breadcrumbs integration - captures console, DOM, navigation events
  integrations.push(breadcrumbsIntegration());

  // TryCatch integration - wraps timers and event listeners
  integrations.push(tryCatchIntegration());

  return integrations;
}

/**
 * Get default integrations with custom options
 */
export function getDefaultIntegrationsWithOptions(options: {
  browser?: Parameters<typeof browserIntegration>[0];
  http?: Parameters<typeof httpIntegration>[0];
  breadcrumbs?: Parameters<typeof breadcrumbsIntegration>[0];
  tryCatch?: Parameters<typeof tryCatchIntegration>[0];
  /** Disable specific integrations */
  disabled?: ('browser' | 'http' | 'breadcrumbs' | 'trycatch')[];
}): Integration[] {
  const {
    browser,
    http,
    breadcrumbs,
    tryCatch,
    disabled = [],
  } = options;

  const integrations: Integration[] = [];

  if (!disabled.includes('browser')) {
    integrations.push(browserIntegration(browser));
  }

  if (!disabled.includes('http')) {
    integrations.push(httpIntegration(http));
  }

  if (!disabled.includes('breadcrumbs')) {
    integrations.push(breadcrumbsIntegration(breadcrumbs));
  }

  if (!disabled.includes('trycatch')) {
    integrations.push(tryCatchIntegration(tryCatch));
  }

  return integrations;
}

/**
 * Filter an integration array by name
 *
 * @param integrations Array of integrations
 * @param names Names of integrations to keep
 * @returns Filtered integrations
 */
export function filterIntegrations(
  integrations: Integration[],
  names: string[]
): Integration[] {
  return integrations.filter((i) => names.includes(i.name));
}

/**
 * Remove integrations by name
 *
 * @param integrations Array of integrations
 * @param names Names of integrations to remove
 * @returns Integrations without the named ones
 */
export function removeIntegrations(
  integrations: Integration[],
  names: string[]
): Integration[] {
  return integrations.filter((i) => !names.includes(i.name));
}

/**
 * Add integrations, replacing any with the same name
 *
 * @param integrations Base array of integrations
 * @param newIntegrations Integrations to add
 * @returns Combined integrations
 */
export function addIntegrations(
  integrations: Integration[],
  newIntegrations: Integration[]
): Integration[] {
  const nameSet = new Set(newIntegrations.map((i) => i.name));
  const filtered = integrations.filter((i) => !nameSet.has(i.name));
  return [...filtered, ...newIntegrations];
}

/**
 * Merge integration arrays, with later arrays taking precedence
 *
 * @param arrays Arrays of integrations
 * @returns Merged integrations
 */
export function mergeIntegrations(...arrays: Integration[][]): Integration[] {
  const byName = new Map<string, Integration>();

  for (const arr of arrays) {
    for (const integration of arr) {
      byName.set(integration.name, integration);
    }
  }

  return Array.from(byName.values());
}

/**
 * Check if an integration is in the array
 *
 * @param integrations Array of integrations
 * @param name Name to check
 * @returns True if found
 */
export function hasIntegration(integrations: Integration[], name: string): boolean {
  return integrations.some((i) => i.name === name);
}

/**
 * Get an integration by name
 *
 * @param integrations Array of integrations
 * @param name Name to find
 * @returns The integration or undefined
 */
export function getIntegration(
  integrations: Integration[],
  name: string
): Integration | undefined {
  return integrations.find((i) => i.name === name);
}
