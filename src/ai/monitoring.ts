/**
 * AI Monitoring Core Module
 *
 * Provides the main AIMonitoring implementation for tracking
 * AI/LLM operations including model calls, token usage, and latency.
 */

import { Span } from '../tracing/span';
import { getActiveSpan } from '../tracing/context';
import type {
  AIMonitoring,
  AgentSpanOptions,
  ToolSpanOptions,
  TokenUsage,
  AIPipelineOptions,
  WrapOpenAIOptions,
  WrapAnthropicOptions,
} from './types';
import {
  startAgentSpan,
  startToolSpan,
  startPipelineSpan,
  recordTokenUsage,
  recordCost,
} from './spans';
import { wrapOpenAIClient } from './openai';
import { wrapAnthropicClient } from './anthropic';

/**
 * AI Monitoring implementation
 *
 * Provides methods for tracking AI operations, wrapping AI clients,
 * and recording metrics like token usage and costs.
 *
 * @example
 * ```typescript
 * import { aiMonitoring } from '@universal-logger/ai';
 *
 * // Wrap OpenAI client
 * const openai = aiMonitoring.wrapOpenAI(new OpenAI({ apiKey: '...' }));
 *
 * // Wrap Anthropic client
 * const anthropic = aiMonitoring.wrapAnthropic(new Anthropic({ apiKey: '...' }));
 *
 * // Manual agent tracking
 * const span = aiMonitoring.startAgentSpan('my-agent', { model: 'gpt-4' });
 * try {
 *   const result = await runAgent();
 *   aiMonitoring.recordTokenUsage({ input: 100, output: 50 });
 *   span.setStatus('ok');
 * } finally {
 *   span.end();
 * }
 * ```
 */
class AIMonitoringImpl implements AIMonitoring {
  /**
   * Default options for OpenAI wrapping
   * @internal
   */
  protected _openAIOptions: WrapOpenAIOptions = {
    capturePrompts: false,
    captureResponses: false,
  };

  /**
   * Default options for Anthropic wrapping
   * @internal
   */
  protected _anthropicOptions: WrapAnthropicOptions = {
    capturePrompts: false,
    captureResponses: false,
  };

  /**
   * Wrap an OpenAI client to automatically track completions
   *
   * This wraps the OpenAI client's methods to automatically create
   * spans for chat completions, completions, and embeddings.
   *
   * @param client - The OpenAI client instance
   * @param options - Wrapping options
   * @returns The wrapped client (same type as input)
   *
   * @example
   * ```typescript
   * import OpenAI from 'openai';
   *
   * const openai = aiMonitoring.wrapOpenAI(
   *   new OpenAI({ apiKey: process.env.OPENAI_API_KEY }),
   *   { capturePrompts: true }
   * );
   *
   * // All calls are now automatically tracked
   * const response = await openai.chat.completions.create({
   *   model: 'gpt-4',
   *   messages: [{ role: 'user', content: 'Hello' }]
   * });
   * ```
   */
  wrapOpenAI<T>(client: T, options?: WrapOpenAIOptions): T {
    const mergedOptions = { ...this._openAIOptions, ...options };
    return wrapOpenAIClient(client, mergedOptions);
  }

  /**
   * Wrap an Anthropic client to automatically track messages
   *
   * This wraps the Anthropic client's methods to automatically create
   * spans for message completions.
   *
   * @param client - The Anthropic client instance
   * @param options - Wrapping options
   * @returns The wrapped client (same type as input)
   *
   * @example
   * ```typescript
   * import Anthropic from '@anthropic-ai/sdk';
   *
   * const anthropic = aiMonitoring.wrapAnthropic(
   *   new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY }),
   *   { capturePrompts: true }
   * );
   *
   * // All calls are now automatically tracked
   * const response = await anthropic.messages.create({
   *   model: 'claude-3-opus-20240229',
   *   max_tokens: 1024,
   *   messages: [{ role: 'user', content: 'Hello' }]
   * });
   * ```
   */
  wrapAnthropic<T>(client: T, options?: WrapAnthropicOptions): T {
    const mergedOptions = { ...this._anthropicOptions, ...options };
    return wrapAnthropicClient(client, mergedOptions);
  }

  /**
   * Start an agent invocation span
   *
   * Use this to track agent executions that may involve multiple
   * AI calls, tool executions, and other operations.
   *
   * @param name - Name of the agent
   * @param options - Agent span options
   * @returns The created span
   *
   * @example
   * ```typescript
   * const span = aiMonitoring.startAgentSpan('research-agent', {
   *   model: 'gpt-4',
   *   provider: 'openai',
   *   metadata: { task: 'summarize' }
   * });
   *
   * try {
   *   const result = await agent.execute(task);
   *   span.setStatus('ok');
   *   return result;
   * } catch (error) {
   *   span.setStatus({ code: 'error', message: error.message });
   *   throw error;
   * } finally {
   *   span.end();
   * }
   * ```
   */
  startAgentSpan(name: string, options?: Partial<AgentSpanOptions>): Span {
    return startAgentSpan(name, options);
  }

  /**
   * Start a tool execution span
   *
   * Use this to track individual tool/function calls made by an agent.
   *
   * @param name - Name of the tool
   * @param options - Tool span options
   * @returns The created span
   *
   * @example
   * ```typescript
   * const span = aiMonitoring.startToolSpan('web-search', {
   *   description: 'Search the web for information',
   *   input: { query: 'latest news' }
   * });
   *
   * try {
   *   const results = await webSearch(query);
   *   span.setStatus('ok');
   *   return results;
   * } finally {
   *   span.end();
   * }
   * ```
   */
  startToolSpan(name: string, options?: Partial<ToolSpanOptions>): Span {
    return startToolSpan(name, options);
  }

  /**
   * Record token usage on the current or specified span
   *
   * @param usage - Token usage information
   * @param span - Optional span to record on (defaults to active span)
   *
   * @example
   * ```typescript
   * aiMonitoring.recordTokenUsage({
   *   input: 150,
   *   output: 75,
   *   total: 225
   * });
   * ```
   */
  recordTokenUsage(usage: TokenUsage, span?: Span): void {
    recordTokenUsage(usage, span);
  }

  /**
   * Start a pipeline span for tracking multi-step AI workflows
   *
   * @param options - Pipeline options
   * @returns The created span
   *
   * @example
   * ```typescript
   * const pipelineSpan = aiMonitoring.startPipelineSpan({
   *   name: 'document-processing',
   *   pipelineId: 'doc-' + Date.now(),
   *   version: '2.0.0'
   * });
   * ```
   */
  startPipelineSpan(options: AIPipelineOptions): Span {
    return startPipelineSpan(options);
  }

  /**
   * Record cost information
   *
   * @param costUsd - Cost in USD
   * @param span - Optional span to record on (defaults to active span)
   *
   * @example
   * ```typescript
   * aiMonitoring.recordCost(0.0045);
   * ```
   */
  recordCost(costUsd: number, span?: Span): void {
    recordCost(costUsd, span);
  }

  /**
   * Configure default options for OpenAI wrapping
   *
   * @param options - Default options
   */
  setOpenAIDefaults(options: Partial<WrapOpenAIOptions>): void {
    this._openAIOptions = { ...this._openAIOptions, ...options };
  }

  /**
   * Configure default options for Anthropic wrapping
   *
   * @param options - Default options
   */
  setAnthropicDefaults(options: Partial<WrapAnthropicOptions>): void {
    this._anthropicOptions = { ...this._anthropicOptions, ...options };
  }
}

/**
 * Singleton AI monitoring instance
 */
export const aiMonitoring: AIMonitoring & {
  setOpenAIDefaults(options: Partial<WrapOpenAIOptions>): void;
  setAnthropicDefaults(options: Partial<WrapAnthropicOptions>): void;
} = new AIMonitoringImpl();

/**
 * Get the current active AI span, if any
 *
 * Utility function to get the current span when inside an AI operation.
 */
export function getActiveAISpan(): Span | undefined {
  const span = getActiveSpan();
  if (span && span.op?.startsWith('ai.')) {
    return span;
  }
  return undefined;
}

/**
 * Create a scoped AI monitoring context
 *
 * Useful for creating isolated monitoring contexts for different
 * parts of an application.
 *
 * @param options - Default options for the context
 * @returns A new AIMonitoring instance
 */
export function createAIMonitoring(options?: {
  openAI?: Partial<WrapOpenAIOptions>;
  anthropic?: Partial<WrapAnthropicOptions>;
}): AIMonitoring {
  const monitoring = new AIMonitoringImpl();

  if (options?.openAI) {
    monitoring.setOpenAIDefaults(options.openAI);
  }

  if (options?.anthropic) {
    monitoring.setAnthropicDefaults(options.anthropic);
  }

  return monitoring;
}

// Re-export types
export type { AIMonitoring };
