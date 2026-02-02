/**
 * AI Agent Monitoring Module
 *
 * Provides comprehensive monitoring for AI/LLM operations including:
 * - Automatic client wrapping for OpenAI and Anthropic
 * - Manual span creation for agents and tools
 * - Token usage and cost tracking
 * - Streaming response support
 *
 * @see https://docs.sentry.io/platforms/javascript/ai-agent-monitoring-browser/
 *
 * @example Basic Usage
 * ```typescript
 * import { aiMonitoring } from '@universal-logger/ai';
 * import OpenAI from 'openai';
 *
 * // Wrap the OpenAI client
 * const openai = aiMonitoring.wrapOpenAI(new OpenAI({ apiKey: '...' }));
 *
 * // All calls are now automatically tracked
 * const response = await openai.chat.completions.create({
 *   model: 'gpt-4',
 *   messages: [{ role: 'user', content: 'Hello!' }]
 * });
 * ```
 *
 * @example Manual Agent Tracking
 * ```typescript
 * import { startAgentSpan, recordTokenUsage } from '@universal-logger/ai';
 *
 * const span = startAgentSpan('my-agent', { model: 'gpt-4' });
 * try {
 *   const result = await runMyAgent();
 *   recordTokenUsage({ input: 100, output: 50 }, span);
 *   span.setStatus('ok');
 * } catch (error) {
 *   span.setStatus({ code: 'error', message: error.message });
 *   throw error;
 * } finally {
 *   span.end();
 * }
 * ```
 *
 * @packageDocumentation
 */

// ============================================
// Main AI Monitoring API
// ============================================

export {
  aiMonitoring,
  getActiveAISpan,
  createAIMonitoring,
} from './monitoring';

// ============================================
// Span Creation Helpers
// ============================================

export {
  startAgentSpan,
  startToolSpan,
  startPipelineSpan,
  startPipelineStepSpan,
  recordTokenUsage,
  recordCost,
  recordModelInfo,
  recordFinishReason,
  startChatCompletionSpan,
  startEmbeddingSpan,
  finalizeStreamingSpan,
} from './spans';

// ============================================
// OpenAI Integration
// ============================================

export {
  wrapOpenAIClient,
  instrumentChatCompletion,
  instrumentEmbeddings,
} from './openai';

// ============================================
// Anthropic Integration
// ============================================

export {
  wrapAnthropicClient,
  instrumentAnthropicMessage,
  calculateAnthropicCost,
  parseAnthropicModel,
} from './anthropic';

// ============================================
// Type Exports
// ============================================

export type {
  // Core types
  AIMonitoring,
  AISpanAttributes,
  TokenUsage,

  // Span options
  AgentSpanOptions,
  ToolSpanOptions,
  AIPipelineOptions,

  // Wrapper options
  WrapOpenAIOptions,
  WrapAnthropicOptions,

  // OpenAI types
  ChatMessage,
  ChatCompletionResponse,
  CompletionUsage,
  EmbeddingsResponse,
  OpenAIStreamEvent,

  // Anthropic types
  AnthropicMessageResponse,
  AnthropicStreamEvent,

  // Utility types
  AIOperationType,
  AIProvider,
  FinishReason,
} from './types';
