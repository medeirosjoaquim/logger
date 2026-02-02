/**
 * OpenAI Client Wrapper
 *
 * Provides automatic instrumentation for OpenAI API calls including
 * chat completions, completions, and embeddings.
 */

import { Span } from '../tracing/span';
import type {
  WrapOpenAIOptions,
  ChatCompletionResponse,
  EmbeddingsResponse,
  OpenAIStreamEvent,
  TokenUsage,
} from './types';
import {
  startChatCompletionSpan,
  startEmbeddingSpan,
  recordTokenUsage,
  recordFinishReason,
  finalizeStreamingSpan,
} from './spans';

/**
 * OpenAI-like chat completions interface
 */
interface OpenAIChatCompletions {
  create(params: ChatCompletionParams): Promise<ChatCompletionResponse>;
}

/**
 * OpenAI-like embeddings interface
 */
interface OpenAIEmbeddings {
  create(params: EmbeddingsParams): Promise<EmbeddingsResponse>;
}

/**
 * OpenAI-like client interface
 */
interface OpenAILikeClient {
  chat?: {
    completions: OpenAIChatCompletions;
  };
  completions?: {
    create(params: CompletionParams): Promise<CompletionResponse>;
  };
  embeddings?: OpenAIEmbeddings;
}

/**
 * Chat completion parameters
 */
interface ChatCompletionParams {
  model: string;
  messages: Array<{
    role: string;
    content: string | null;
    name?: string;
  }>;
  temperature?: number;
  max_tokens?: number;
  top_p?: number;
  stream?: boolean;
  [key: string]: unknown;
}

/**
 * Completion parameters (legacy)
 */
interface CompletionParams {
  model: string;
  prompt: string | string[];
  temperature?: number;
  max_tokens?: number;
  top_p?: number;
  stream?: boolean;
  [key: string]: unknown;
}

/**
 * Completion response (legacy)
 */
interface CompletionResponse {
  id: string;
  object: string;
  created: number;
  model: string;
  choices: Array<{
    text: string;
    index: number;
    finish_reason: string | null;
  }>;
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

/**
 * Async iterable stream type
 */
interface AsyncIterableStream<T> extends AsyncIterable<T> {
  [Symbol.asyncIterator](): AsyncIterator<T>;
}

/**
 * Wrap an OpenAI client for automatic instrumentation
 *
 * This function wraps the OpenAI client's methods to automatically
 * create spans and record metrics for AI operations.
 *
 * @param client - The OpenAI client to wrap
 * @param options - Wrapping options
 * @returns The wrapped client
 */
export function wrapOpenAIClient<T>(client: T, options: WrapOpenAIOptions = {}): T {
  if (!client || typeof client !== 'object') {
    return client;
  }

  const openaiClient = client as unknown as OpenAILikeClient;
  const wrappedClient = client as T & OpenAILikeClient;

  // Wrap chat.completions.create
  if (openaiClient.chat?.completions?.create) {
    const originalChatCreate = openaiClient.chat.completions.create.bind(
      openaiClient.chat.completions
    );

    wrappedClient.chat!.completions.create = async function (
      params: ChatCompletionParams
    ): Promise<ChatCompletionResponse> {
      const isStreaming = params.stream === true;
      const span = startChatCompletionSpan(params.model, 'openai', isStreaming);

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
      }

      try {
        const response = await originalChatCreate(params);

        // Handle streaming response
        if (isStreaming && isAsyncIterable(response)) {
          return wrapStreamingResponse(response, span, options) as unknown as ChatCompletionResponse;
        }

        // Handle regular response
        const chatResponse = response as ChatCompletionResponse;

        // Record token usage
        if (chatResponse.usage) {
          recordTokenUsage(
            {
              input: chatResponse.usage.prompt_tokens,
              output: chatResponse.usage.completion_tokens,
              total: chatResponse.usage.total_tokens,
            },
            span
          );
        }

        // Record finish reason
        if (chatResponse.choices?.[0]?.finish_reason) {
          recordFinishReason(chatResponse.choices[0].finish_reason, span);
        }

        // Record request ID
        if (chatResponse.id) {
          span.setAttribute('ai.request_id', chatResponse.id);
        }

        // Capture response if enabled
        if (options.captureResponses && chatResponse.choices) {
          span.setData('ai.response_choices_count', chatResponse.choices.length);
        }

        span.setStatus('ok');
        return chatResponse;
      } catch (error) {
        span.setStatus({
          code: 'error',
          message: error instanceof Error ? error.message : 'Unknown error',
        });
        throw error;
      } finally {
        span.end();
      }
    } as OpenAIChatCompletions['create'];
  }

  // Wrap completions.create (legacy)
  if (openaiClient.completions?.create) {
    const originalCompletionsCreate = openaiClient.completions.create.bind(
      openaiClient.completions
    );

    wrappedClient.completions!.create = async function (
      params: CompletionParams
    ): Promise<CompletionResponse> {
      const isStreaming = params.stream === true;
      const span = startChatCompletionSpan(params.model, 'openai', isStreaming);
      span.updateName(`ai.completion ${params.model}`);

      // Add request attributes
      if (params.temperature !== undefined) {
        span.setAttribute('ai.temperature', params.temperature);
      }
      if (params.max_tokens !== undefined) {
        span.setAttribute('ai.max_tokens', params.max_tokens);
      }

      try {
        const response = await originalCompletionsCreate(params);
        const completionResponse = response as CompletionResponse;

        // Record token usage
        if (completionResponse.usage) {
          recordTokenUsage(
            {
              input: completionResponse.usage.prompt_tokens,
              output: completionResponse.usage.completion_tokens,
              total: completionResponse.usage.total_tokens,
            },
            span
          );
        }

        // Record finish reason
        if (completionResponse.choices?.[0]?.finish_reason) {
          recordFinishReason(completionResponse.choices[0].finish_reason, span);
        }

        span.setStatus('ok');
        return completionResponse;
      } catch (error) {
        span.setStatus({
          code: 'error',
          message: error instanceof Error ? error.message : 'Unknown error',
        });
        throw error;
      } finally {
        span.end();
      }
    };
  }

  // Wrap embeddings.create
  if (openaiClient.embeddings?.create) {
    const originalEmbeddingsCreate = openaiClient.embeddings.create.bind(
      openaiClient.embeddings
    );

    wrappedClient.embeddings!.create = async function (
      params: EmbeddingsParams
    ): Promise<EmbeddingsResponse> {
      const span = startEmbeddingSpan(params.model, 'openai');

      try {
        const response = await originalEmbeddingsCreate(params);

        // Record token usage
        if (response.usage) {
          recordTokenUsage(
            {
              input: response.usage.prompt_tokens,
              output: 0,
              total: response.usage.total_tokens,
            },
            span
          );
        }

        // Record embedding count
        span.setData('ai.embedding_count', response.data?.length ?? 0);

        span.setStatus('ok');
        return response;
      } catch (error) {
        span.setStatus({
          code: 'error',
          message: error instanceof Error ? error.message : 'Unknown error',
        });
        throw error;
      } finally {
        span.end();
      }
    } as OpenAIEmbeddings['create'];
  }

  return wrappedClient as T;
}

/**
 * Embeddings parameters
 */
interface EmbeddingsParams {
  model: string;
  input: string | string[];
  [key: string]: unknown;
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
 * Wrap a streaming response to track streaming metrics
 */
function wrapStreamingResponse<T>(
  stream: AsyncIterableStream<T>,
  span: Span,
  options: WrapOpenAIOptions
): AsyncIterableStream<T> {
  let chunkCount = 0;
  const startTime = Date.now();
  let totalInputTokens = 0;
  let totalOutputTokens = 0;
  let finishReason: string | null = null;

  const wrappedIterator: AsyncIterableStream<T> = {
    async *[Symbol.asyncIterator](): AsyncIterator<T> {
      try {
        for await (const chunk of stream) {
          chunkCount++;

          // Try to extract usage from streaming chunk
          const streamChunk = chunk as unknown as OpenAIStreamEvent;
          if (streamChunk.usage) {
            totalInputTokens = streamChunk.usage.prompt_tokens;
            totalOutputTokens = streamChunk.usage.completion_tokens;
          }

          // Extract finish reason
          if (streamChunk.choices?.[0]?.finish_reason) {
            finishReason = streamChunk.choices[0].finish_reason;
          }

          yield chunk;
        }

        // Finalize span after streaming completes
        const totalTime = (Date.now() - startTime) / 1000;
        finalizeStreamingSpan(span, chunkCount, totalTime);

        if (totalInputTokens > 0 || totalOutputTokens > 0) {
          recordTokenUsage(
            {
              input: totalInputTokens,
              output: totalOutputTokens,
            },
            span
          );
        }

        if (finishReason) {
          recordFinishReason(finishReason, span);
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
 * Manually instrument an OpenAI chat completion call
 *
 * Use this when you can't wrap the client but want to track calls.
 *
 * @example
 * ```typescript
 * const { span, finalize } = instrumentChatCompletion({
 *   model: 'gpt-4',
 *   temperature: 0.7
 * });
 *
 * try {
 *   const response = await openai.chat.completions.create(params);
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
export function instrumentChatCompletion(params: {
  model: string;
  temperature?: number;
  maxTokens?: number;
  streaming?: boolean;
}): {
  span: Span;
  finalize: (response: ChatCompletionResponse) => void;
} {
  const span = startChatCompletionSpan(
    params.model,
    'openai',
    params.streaming ?? false
  );

  if (params.temperature !== undefined) {
    span.setAttribute('ai.temperature', params.temperature);
  }
  if (params.maxTokens !== undefined) {
    span.setAttribute('ai.max_tokens', params.maxTokens);
  }

  const finalize = (response: ChatCompletionResponse) => {
    if (response.usage) {
      recordTokenUsage(
        {
          input: response.usage.prompt_tokens,
          output: response.usage.completion_tokens,
          total: response.usage.total_tokens,
        },
        span
      );
    }

    if (response.choices?.[0]?.finish_reason) {
      recordFinishReason(response.choices[0].finish_reason, span);
    }

    if (response.id) {
      span.setAttribute('ai.request_id', response.id);
    }

    span.setStatus('ok');
  };

  return { span, finalize };
}

/**
 * Manually instrument an OpenAI embeddings call
 *
 * @example
 * ```typescript
 * const { span, finalize } = instrumentEmbeddings({ model: 'text-embedding-3-small' });
 *
 * try {
 *   const response = await openai.embeddings.create(params);
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
export function instrumentEmbeddings(params: {
  model: string;
}): {
  span: Span;
  finalize: (response: EmbeddingsResponse) => void;
} {
  const span = startEmbeddingSpan(params.model, 'openai');

  const finalize = (response: EmbeddingsResponse) => {
    if (response.usage) {
      recordTokenUsage(
        {
          input: response.usage.prompt_tokens,
          output: 0,
          total: response.usage.total_tokens,
        },
        span
      );
    }

    span.setData('ai.embedding_count', response.data?.length ?? 0);
    span.setStatus('ok');
  };

  return { span, finalize };
}
