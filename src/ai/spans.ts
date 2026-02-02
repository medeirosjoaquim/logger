/**
 * AI Span Creation Helpers
 *
 * Provides functions for creating AI-specific spans including
 * agent invocations and tool executions.
 */

import { Span } from '../tracing/span';
import { getActiveSpan } from '../tracing/context';
import { generateTraceId } from '../tracing/idGenerator';
import type {
  AgentSpanOptions,
  ToolSpanOptions,
  AISpanAttributes,
  TokenUsage,
  AIPipelineOptions,
  AIOperationType,
} from './types';

/**
 * Get current timestamp in seconds with millisecond precision
 */
function timestampInSeconds(): number {
  return Date.now() / 1000;
}

/**
 * Create an agent invocation span
 *
 * Agent spans track the invocation of an AI agent, including
 * the model used, token consumption, and latency.
 *
 * @param name - Name of the agent invocation
 * @param options - Additional options for the span
 * @returns The created span
 *
 * @example
 * ```typescript
 * const span = startAgentSpan('process-user-query', {
 *   model: 'gpt-4',
 *   metadata: { userId: '123' }
 * });
 *
 * try {
 *   const result = await agent.run(query);
 *   span.setStatus('ok');
 * } catch (error) {
 *   span.setStatus({ code: 'error', message: error.message });
 * } finally {
 *   span.end();
 * }
 * ```
 */
export function startAgentSpan(
  name: string,
  options: Partial<AgentSpanOptions> = {}
): Span {
  const activeSpan = options.parentSpan || getActiveSpan();
  const op: AIOperationType = 'ai.agent.invoke';

  // Build attributes
  const attributes: Partial<AISpanAttributes> = {
    ...options.attributes,
  };

  if (options.model) {
    attributes['ai.model'] = options.model;
  }

  if (options.provider) {
    attributes['ai.provider'] = options.provider;
  }

  if (name) {
    attributes['ai.agent_name'] = name;
  }

  // Create the span
  const span = new Span({
    name: `${op} ${name}`,
    op,
    traceId: activeSpan?.traceId || generateTraceId(),
    parentSpanId: activeSpan?.spanId,
    attributes: attributes as Record<string, string | number | boolean | string[] | number[] | boolean[] | undefined>,
    sampled: activeSpan?.sampled,
    origin: 'auto.ai.agent',
  });

  // Add metadata as data if provided
  if (options.metadata) {
    for (const [key, value] of Object.entries(options.metadata)) {
      if (value !== undefined && value !== null) {
        span.setData(`ai.metadata.${key}`, value);
      }
    }
  }

  return span;
}

/**
 * Create a tool execution span
 *
 * Tool spans track individual tool/function calls made by an AI agent,
 * such as function calling, code execution, or API calls.
 *
 * @param name - Name of the tool being executed
 * @param options - Additional options for the span
 * @returns The created span
 *
 * @example
 * ```typescript
 * const span = startToolSpan('search-database', {
 *   description: 'Search for user records',
 *   input: { query: 'active users' }
 * });
 *
 * try {
 *   const result = await searchTool.execute(params);
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
export function startToolSpan(
  name: string,
  options: Partial<ToolSpanOptions> = {}
): Span {
  const activeSpan = options.parentSpan || getActiveSpan();
  const op: AIOperationType = 'ai.tool.execute';

  // Build attributes
  const attributes: Partial<AISpanAttributes> = {
    'ai.tool_name': name,
    ...options.attributes,
  };

  // Create the span
  const span = new Span({
    name: `${op} ${name}`,
    op,
    traceId: activeSpan?.traceId || generateTraceId(),
    parentSpanId: activeSpan?.spanId,
    attributes: attributes as Record<string, string | number | boolean | string[] | number[] | boolean[] | undefined>,
    sampled: activeSpan?.sampled,
    origin: 'auto.ai.tool',
  });

  // Add description if provided
  if (options.description) {
    span.setData('ai.tool_description', options.description);
  }

  // Add input if provided (sanitize for privacy)
  if (options.input) {
    // Only store input keys, not values (for privacy)
    span.setData('ai.tool_input_keys', Object.keys(options.input));
  }

  return span;
}

/**
 * Create a pipeline span for multi-step AI workflows
 *
 * Pipeline spans track end-to-end AI workflows that may involve
 * multiple model calls, tool executions, and processing steps.
 *
 * @param options - Pipeline options
 * @returns The created span
 *
 * @example
 * ```typescript
 * const pipelineSpan = startPipelineSpan({
 *   name: 'document-analysis',
 *   pipelineId: 'doc-123',
 *   version: '1.0.0'
 * });
 *
 * try {
 *   // Step 1: Extract text
 *   const extractSpan = startPipelineStepSpan('extract-text', pipelineSpan);
 *   const text = await extractText(document);
 *   extractSpan.end();
 *
 *   // Step 2: Analyze with AI
 *   const analyzeSpan = startPipelineStepSpan('analyze', pipelineSpan);
 *   const analysis = await analyzeWithAI(text);
 *   analyzeSpan.end();
 *
 *   pipelineSpan.setStatus('ok');
 * } finally {
 *   pipelineSpan.end();
 * }
 * ```
 */
export function startPipelineSpan(options: AIPipelineOptions): Span {
  const activeSpan = getActiveSpan();
  const op: AIOperationType = 'ai.pipeline';

  // Build attributes
  const attributes: Partial<AISpanAttributes> = {
    ...options.attributes,
  };

  if (options.pipelineId) {
    attributes['ai.pipeline_id'] = options.pipelineId;
  }

  // Create the span
  const span = new Span({
    name: `${op} ${options.name}`,
    op,
    traceId: activeSpan?.traceId || generateTraceId(),
    parentSpanId: activeSpan?.spanId,
    attributes: attributes as Record<string, string | number | boolean | string[] | number[] | boolean[] | undefined>,
    sampled: activeSpan?.sampled,
    origin: 'auto.ai.pipeline',
  });

  // Add version if provided
  if (options.version) {
    span.setData('ai.pipeline_version', options.version);
  }

  return span;
}

/**
 * Create a pipeline step span
 *
 * @param name - Name of the pipeline step
 * @param parentSpan - Parent pipeline span
 * @returns The created span
 */
export function startPipelineStepSpan(name: string, parentSpan?: Span): Span {
  const activeSpan = parentSpan || getActiveSpan();
  const op: AIOperationType = 'ai.pipeline.step';

  const span = new Span({
    name: `${op} ${name}`,
    op,
    traceId: activeSpan?.traceId || generateTraceId(),
    parentSpanId: activeSpan?.spanId,
    sampled: activeSpan?.sampled,
    origin: 'auto.ai.pipeline.step',
  });

  return span;
}

/**
 * Record token usage on a span
 *
 * @param usage - Token usage information
 * @param span - The span to record on (defaults to active span)
 */
export function recordTokenUsage(usage: TokenUsage, span?: Span): void {
  const targetSpan = span || getActiveSpan();
  if (!targetSpan) {
    return;
  }

  if (!targetSpan.isRecording()) {
    return;
  }

  targetSpan.setAttribute('ai.input_tokens', usage.input);
  targetSpan.setAttribute('ai.output_tokens', usage.output);
  targetSpan.setAttribute('ai.total_tokens', usage.total ?? usage.input + usage.output);
}

/**
 * Record cost information on a span
 *
 * @param costUsd - Cost in USD
 * @param span - The span to record on (defaults to active span)
 */
export function recordCost(costUsd: number, span?: Span): void {
  const targetSpan = span || getActiveSpan();
  if (!targetSpan) {
    return;
  }

  if (!targetSpan.isRecording()) {
    return;
  }

  targetSpan.setAttribute('ai.cost_usd', costUsd);
}

/**
 * Record model information on a span
 *
 * @param model - Model identifier
 * @param provider - Provider name (optional)
 * @param span - The span to record on (defaults to active span)
 */
export function recordModelInfo(
  model: string,
  provider?: string,
  span?: Span
): void {
  const targetSpan = span || getActiveSpan();
  if (!targetSpan) {
    return;
  }

  if (!targetSpan.isRecording()) {
    return;
  }

  targetSpan.setAttribute('ai.model', model);
  if (provider) {
    targetSpan.setAttribute('ai.provider', provider);
  }
}

/**
 * Record finish reason on a span
 *
 * @param reason - Finish reason
 * @param span - The span to record on (defaults to active span)
 */
export function recordFinishReason(reason: string, span?: Span): void {
  const targetSpan = span || getActiveSpan();
  if (!targetSpan) {
    return;
  }

  if (!targetSpan.isRecording()) {
    return;
  }

  targetSpan.setAttribute('ai.finish_reason', reason);
}

/**
 * Create an AI chat completion span
 *
 * @param model - Model identifier
 * @param provider - Provider name
 * @param streaming - Whether this is a streaming request
 * @returns The created span
 */
export function startChatCompletionSpan(
  model: string,
  provider: string,
  streaming: boolean = false
): Span {
  const activeSpan = getActiveSpan();
  const op: AIOperationType = 'ai.chat_completion';

  const span = new Span({
    name: `${op} ${model}`,
    op,
    traceId: activeSpan?.traceId || generateTraceId(),
    parentSpanId: activeSpan?.spanId,
    attributes: {
      'ai.model': model,
      'ai.provider': provider,
      'ai.streaming': streaming,
    },
    sampled: activeSpan?.sampled,
    origin: `auto.ai.${provider}`,
  });

  return span;
}

/**
 * Create an embeddings span
 *
 * @param model - Model identifier
 * @param provider - Provider name
 * @returns The created span
 */
export function startEmbeddingSpan(model: string, provider: string): Span {
  const activeSpan = getActiveSpan();
  const op: AIOperationType = 'ai.embedding';

  const span = new Span({
    name: `${op} ${model}`,
    op,
    traceId: activeSpan?.traceId || generateTraceId(),
    parentSpanId: activeSpan?.spanId,
    attributes: {
      'ai.model': model,
      'ai.provider': provider,
    },
    sampled: activeSpan?.sampled,
    origin: `auto.ai.${provider}`,
  });

  return span;
}

/**
 * Set streaming attributes on a span after streaming completes
 *
 * @param span - The span to update
 * @param chunks - Number of chunks received
 * @param totalTime - Total streaming time in seconds
 */
export function finalizeStreamingSpan(
  span: Span,
  chunks: number,
  totalTime: number
): void {
  if (!span.isRecording()) {
    return;
  }

  span.setData('ai.streaming_chunks', chunks);
  span.setData('ai.streaming_duration_seconds', totalTime);
}
