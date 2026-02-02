/**
 * Anthropic Client Wrapper
 *
 * Provides automatic instrumentation for Anthropic API calls
 * including message completions with streaming support.
 */

import { Span } from '../tracing/span';
import type {
  WrapAnthropicOptions,
  AnthropicMessageResponse,
  AnthropicStreamEvent,
  TokenUsage,
} from './types';
import {
  startChatCompletionSpan,
  recordTokenUsage,
  recordFinishReason,
  finalizeStreamingSpan,
} from './spans';

/**
 * Anthropic-like messages interface
 */
interface AnthropicMessages {
  create(params: MessageParams): Promise<AnthropicMessageResponse>;
}

/**
 * Anthropic-like client interface
 */
interface AnthropicLikeClient {
  messages?: AnthropicMessages;
}

/**
 * Message parameters for Anthropic
 */
interface MessageParams {
  model: string;
  max_tokens: number;
  messages: Array<{
    role: 'user' | 'assistant';
    content: string | Array<{ type: string; text?: string; [key: string]: unknown }>;
  }>;
  system?: string;
  temperature?: number;
  top_p?: number;
  stream?: boolean;
  [key: string]: unknown;
}

/**
 * Async iterable stream type
 */
interface AsyncIterableStream<T> extends AsyncIterable<T> {
  [Symbol.asyncIterator](): AsyncIterator<T>;
}

/**
 * Wrap an Anthropic client for automatic instrumentation
 *
 * This function wraps the Anthropic client's methods to automatically
 * create spans and record metrics for AI operations.
 *
 * @param client - The Anthropic client to wrap
 * @param options - Wrapping options
 * @returns The wrapped client
 */
export function wrapAnthropicClient<T>(
  client: T,
  options: WrapAnthropicOptions = {}
): T {
  if (!client || typeof client !== 'object') {
    return client;
  }

  const anthropicClient = client as unknown as AnthropicLikeClient;
  const wrappedClient = client as T & AnthropicLikeClient;

  // Wrap messages.create
  if (anthropicClient.messages?.create) {
    const originalCreate = anthropicClient.messages.create.bind(
      anthropicClient.messages
    );

    wrappedClient.messages!.create = async function (
      params: MessageParams
    ): Promise<AnthropicMessageResponse> {
      const isStreaming = params.stream === true;
      const span = startChatCompletionSpan(params.model, 'anthropic', isStreaming);

      // Add request attributes
      if (params.temperature !== undefined) {
        span.setAttribute('ai.temperature', params.temperature);
      }
      if (params.max_tokens !== undefined) {
        span.setAttribute('ai.max_tokens', params.max_tokens);
      }
      if (params.top_p !== undefined) {
        span.setAttribute('ai.top_p', params.top_p);
      }

      // Capture prompts if enabled
      if (options.capturePrompts && params.messages) {
        span.setData('ai.prompt_messages_count', params.messages.length);
        // Only store roles, not content (for privacy)
        span.setData(
          'ai.prompt_roles',
          params.messages.map((m) => m.role)
        );
        // Note if system prompt is present
        if (params.system) {
          span.setData('ai.has_system_prompt', true);
        }
      }

      try {
        const response = await originalCreate(params);

        // Handle streaming response
        if (isStreaming && isAsyncIterable(response)) {
          return wrapAnthropicStreamingResponse(
            response,
            span,
            options
          ) as unknown as AnthropicMessageResponse;
        }

        // Handle regular response
        const messageResponse = response as AnthropicMessageResponse;

        // Record token usage
        if (messageResponse.usage) {
          recordTokenUsage(
            {
              input: messageResponse.usage.input_tokens,
              output: messageResponse.usage.output_tokens,
            },
            span
          );
        }

        // Record finish reason
        if (messageResponse.stop_reason) {
          recordFinishReason(messageResponse.stop_reason, span);
        }

        // Record request ID
        if (messageResponse.id) {
          span.setAttribute('ai.request_id', messageResponse.id);
        }

        // Capture response if enabled
        if (options.captureResponses && messageResponse.content) {
          span.setData('ai.response_content_blocks', messageResponse.content.length);
        }

        span.setStatus('ok');
        return messageResponse;
      } catch (error) {
        span.setStatus({
          code: 'error',
          message: error instanceof Error ? error.message : 'Unknown error',
        });
        throw error;
      } finally {
        span.end();
      }
    } as AnthropicMessages['create'];
  }

  return wrappedClient as T;
}

/**
 * Check if a value is an async iterable
 */
function isAsyncIterable(value: unknown): value is AsyncIterableStream<unknown> {
  return (
    value !== null &&
    typeof value === 'object' &&
    Symbol.asyncIterator in value
  );
}

/**
 * Wrap an Anthropic streaming response to track streaming metrics
 */
function wrapAnthropicStreamingResponse<T>(
  stream: AsyncIterableStream<T>,
  span: Span,
  options: WrapAnthropicOptions
): AsyncIterableStream<T> {
  let chunkCount = 0;
  const startTime = Date.now();
  let inputTokens = 0;
  let outputTokens = 0;
  let stopReason: string | null = null;
  let requestId: string | null = null;

  const wrappedIterator: AsyncIterableStream<T> = {
    async *[Symbol.asyncIterator](): AsyncIterator<T> {
      try {
        for await (const chunk of stream) {
          chunkCount++;

          // Try to extract data from streaming events
          const event = chunk as unknown as AnthropicStreamEvent;

          // Extract message start data
          if (event.type === 'message_start' && event.message) {
            if (event.message.id) {
              requestId = event.message.id;
            }
            if (event.message.usage) {
              inputTokens = event.message.usage.input_tokens ?? 0;
            }
          }

          // Extract message delta data
          if (event.type === 'message_delta') {
            if (event.delta?.stop_reason) {
              stopReason = event.delta.stop_reason;
            }
            if (event.usage?.output_tokens) {
              outputTokens = event.usage.output_tokens;
            }
          }

          yield chunk;
        }

        // Finalize span after streaming completes
        const totalTime = (Date.now() - startTime) / 1000;
        finalizeStreamingSpan(span, chunkCount, totalTime);

        if (inputTokens > 0 || outputTokens > 0) {
          recordTokenUsage(
            {
              input: inputTokens,
              output: outputTokens,
            },
            span
          );
        }

        if (stopReason) {
          recordFinishReason(stopReason, span);
        }

        if (requestId) {
          span.setAttribute('ai.request_id', requestId);
        }

        span.setStatus('ok');
      } catch (error) {
        span.setStatus({
          code: 'error',
          message: error instanceof Error ? error.message : 'Unknown error',
        });
        throw error;
      } finally {
        span.end();
      }
    },
  };

  return wrappedIterator;
}

/**
 * Manually instrument an Anthropic message call
 *
 * Use this when you can't wrap the client but want to track calls.
 *
 * @example
 * ```typescript
 * const { span, finalize } = instrumentAnthropicMessage({
 *   model: 'claude-3-opus-20240229',
 *   maxTokens: 1024,
 *   temperature: 0.7
 * });
 *
 * try {
 *   const response = await anthropic.messages.create(params);
 *   finalize(response);
 *   return response;
 * } catch (error) {
 *   span.setStatus({ code: 'error', message: error.message });
 *   throw error;
 * } finally {
 *   span.end();
 * }
 * ```
 */
export function instrumentAnthropicMessage(params: {
  model: string;
  maxTokens?: number;
  temperature?: number;
  streaming?: boolean;
}): {
  span: Span;
  finalize: (response: AnthropicMessageResponse) => void;
} {
  const span = startChatCompletionSpan(
    params.model,
    'anthropic',
    params.streaming ?? false
  );

  if (params.temperature !== undefined) {
    span.setAttribute('ai.temperature', params.temperature);
  }
  if (params.maxTokens !== undefined) {
    span.setAttribute('ai.max_tokens', params.maxTokens);
  }

  const finalize = (response: AnthropicMessageResponse) => {
    if (response.usage) {
      recordTokenUsage(
        {
          input: response.usage.input_tokens,
          output: response.usage.output_tokens,
        },
        span
      );
    }

    if (response.stop_reason) {
      recordFinishReason(response.stop_reason, span);
    }

    if (response.id) {
      span.setAttribute('ai.request_id', response.id);
    }

    span.setStatus('ok');
  };

  return { span, finalize };
}

/**
 * Calculate cost for Anthropic API calls
 *
 * Pricing as of early 2024 (may need updates):
 * - Claude 3 Opus: $15/$75 per million tokens (input/output)
 * - Claude 3 Sonnet: $3/$15 per million tokens
 * - Claude 3 Haiku: $0.25/$1.25 per million tokens
 *
 * @param model - The model name
 * @param usage - Token usage
 * @returns Cost in USD
 */
export function calculateAnthropicCost(
  model: string,
  usage: TokenUsage
): number {
  // Pricing per million tokens (input, output)
  const pricing: Record<string, [number, number]> = {
    'claude-3-opus': [15, 75],
    'claude-3-sonnet': [3, 15],
    'claude-3-haiku': [0.25, 1.25],
    'claude-2.1': [8, 24],
    'claude-2.0': [8, 24],
    'claude-instant-1.2': [0.8, 2.4],
  };

  // Find matching pricing (models often have date suffixes)
  let matchedPricing: [number, number] | undefined;
  for (const [key, value] of Object.entries(pricing)) {
    if (model.startsWith(key)) {
      matchedPricing = value;
      break;
    }
  }

  if (!matchedPricing) {
    // Default to Sonnet pricing if unknown
    matchedPricing = [3, 15];
  }

  const inputCost = (usage.input / 1_000_000) * matchedPricing[0];
  const outputCost = (usage.output / 1_000_000) * matchedPricing[1];

  return inputCost + outputCost;
}

/**
 * Parse Anthropic model name to extract version info
 *
 * @param model - Full model name (e.g., 'claude-3-opus-20240229')
 * @returns Parsed model info
 */
export function parseAnthropicModel(model: string): {
  family: string;
  variant: string;
  version?: string;
} {
  // Pattern: claude-{version}-{variant}-{date}
  const match = model.match(/^(claude)-(\d+(?:\.\d+)?)-(\w+)(?:-(\d{8}))?$/);

  if (match) {
    return {
      family: match[1],
      variant: `${match[2]}-${match[3]}`,
      version: match[4],
    };
  }

  // Fallback for older models
  const legacyMatch = model.match(/^(claude)-(\d+(?:\.\d+)?)$/);
  if (legacyMatch) {
    return {
      family: legacyMatch[1],
      variant: legacyMatch[2],
    };
  }

  return {
    family: 'claude',
    variant: model,
  };
}
