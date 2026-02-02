/**
 * AI Agent Monitoring Type Definitions
 *
 * Types for monitoring AI/LLM operations including OpenAI, Anthropic,
 * and other AI providers. Follows Sentry AI monitoring conventions.
 *
 * @see https://docs.sentry.io/platforms/javascript/ai-agent-monitoring-browser/
 */

import type { Span } from '../tracing/span';

/**
 * AI-specific span attributes following OpenTelemetry semantic conventions
 * for GenAI operations
 */
export interface AISpanAttributes {
  /**
   * The AI model identifier (e.g., 'gpt-4', 'claude-3-opus')
   */
  'ai.model': string;

  /**
   * Number of input tokens consumed
   */
  'ai.input_tokens'?: number;

  /**
   * Number of output tokens generated
   */
  'ai.output_tokens'?: number;

  /**
   * Total tokens (input + output)
   */
  'ai.total_tokens'?: number;

  /**
   * Whether this was a streaming response
   */
  'ai.streaming'?: boolean;

  /**
   * Temperature setting used for generation
   */
  'ai.temperature'?: number;

  /**
   * Max tokens setting
   */
  'ai.max_tokens'?: number;

  /**
   * Top P setting for nucleus sampling
   */
  'ai.top_p'?: number;

  /**
   * Provider name (e.g., 'openai', 'anthropic')
   */
  'ai.provider'?: string;

  /**
   * The prompt template ID if applicable
   */
  'ai.prompt_template'?: string;

  /**
   * Pipeline or workflow ID
   */
  'ai.pipeline_id'?: string;

  /**
   * Agent name for multi-agent systems
   */
  'ai.agent_name'?: string;

  /**
   * Tool name for tool executions
   */
  'ai.tool_name'?: string;

  /**
   * Finish reason (e.g., 'stop', 'length', 'tool_calls')
   */
  'ai.finish_reason'?: string;

  /**
   * Request ID from the provider
   */
  'ai.request_id'?: string;

  /**
   * Cost in USD (if available)
   */
  'ai.cost_usd'?: number;
}

/**
 * Options for creating an agent span
 */
export interface AgentSpanOptions {
  /**
   * Name of the agent invocation
   */
  name: string;

  /**
   * The AI model being used
   */
  model?: string;

  /**
   * Additional metadata for the span
   */
  metadata?: Record<string, unknown>;

  /**
   * Provider name
   */
  provider?: string;

  /**
   * Parent span for nesting
   */
  parentSpan?: Span;

  /**
   * Custom attributes
   */
  attributes?: Partial<AISpanAttributes>;
}

/**
 * Options for creating a tool span
 */
export interface ToolSpanOptions {
  /**
   * Name of the tool being executed
   */
  name: string;

  /**
   * Description of what the tool does
   */
  description?: string;

  /**
   * Input parameters passed to the tool
   */
  input?: Record<string, unknown>;

  /**
   * Parent span for nesting
   */
  parentSpan?: Span;

  /**
   * Custom attributes
   */
  attributes?: Partial<AISpanAttributes>;
}

/**
 * Token usage information
 */
export interface TokenUsage {
  /**
   * Number of input/prompt tokens
   */
  input: number;

  /**
   * Number of output/completion tokens
   */
  output: number;

  /**
   * Total tokens (optional, calculated if not provided)
   */
  total?: number;
}

/**
 * OpenAI-compatible chat completion message
 */
export interface ChatMessage {
  role: 'system' | 'user' | 'assistant' | 'function' | 'tool';
  content: string | null;
  name?: string;
  function_call?: {
    name: string;
    arguments: string;
  };
  tool_calls?: Array<{
    id: string;
    type: 'function';
    function: {
      name: string;
      arguments: string;
    };
  }>;
}

/**
 * OpenAI-compatible completion response usage
 */
export interface CompletionUsage {
  prompt_tokens: number;
  completion_tokens: number;
  total_tokens: number;
}

/**
 * OpenAI-compatible chat completion response
 */
export interface ChatCompletionResponse {
  id: string;
  object: string;
  created: number;
  model: string;
  choices: Array<{
    index: number;
    message: ChatMessage;
    finish_reason: string | null;
  }>;
  usage?: CompletionUsage;
}

/**
 * OpenAI-compatible embeddings response
 */
export interface EmbeddingsResponse {
  object: string;
  data: Array<{
    object: string;
    index: number;
    embedding: number[];
  }>;
  model: string;
  usage: {
    prompt_tokens: number;
    total_tokens: number;
  };
}

/**
 * Anthropic-compatible message response
 */
export interface AnthropicMessageResponse {
  id: string;
  type: string;
  role: string;
  content: Array<{
    type: string;
    text?: string;
  }>;
  model: string;
  stop_reason: string | null;
  stop_sequence: string | null;
  usage: {
    input_tokens: number;
    output_tokens: number;
  };
}

/**
 * Streaming event types for OpenAI
 */
export interface OpenAIStreamEvent {
  id: string;
  object: string;
  created: number;
  model: string;
  choices: Array<{
    index: number;
    delta: {
      role?: string;
      content?: string | null;
      function_call?: {
        name?: string;
        arguments?: string;
      };
      tool_calls?: Array<{
        index: number;
        id?: string;
        type?: 'function';
        function?: {
          name?: string;
          arguments?: string;
        };
      }>;
    };
    finish_reason: string | null;
  }>;
  usage?: CompletionUsage;
}

/**
 * Streaming event types for Anthropic
 */
export interface AnthropicStreamEvent {
  type:
    | 'message_start'
    | 'content_block_start'
    | 'content_block_delta'
    | 'content_block_stop'
    | 'message_delta'
    | 'message_stop';
  message?: Partial<AnthropicMessageResponse>;
  index?: number;
  content_block?: {
    type: string;
    text?: string;
  };
  delta?: {
    type?: string;
    text?: string;
    stop_reason?: string;
    stop_sequence?: string;
  };
  usage?: {
    output_tokens: number;
  };
}

/**
 * Options for wrapping an OpenAI client
 */
export interface WrapOpenAIOptions {
  /**
   * Whether to capture prompts/messages (may contain PII)
   */
  capturePrompts?: boolean;

  /**
   * Whether to capture responses (may contain PII)
   */
  captureResponses?: boolean;

  /**
   * Custom span name prefix
   */
  spanNamePrefix?: string;

  /**
   * Additional attributes to add to all spans
   */
  additionalAttributes?: Partial<AISpanAttributes>;
}

/**
 * Options for wrapping an Anthropic client
 */
export interface WrapAnthropicOptions {
  /**
   * Whether to capture prompts/messages (may contain PII)
   */
  capturePrompts?: boolean;

  /**
   * Whether to capture responses (may contain PII)
   */
  captureResponses?: boolean;

  /**
   * Custom span name prefix
   */
  spanNamePrefix?: string;

  /**
   * Additional attributes to add to all spans
   */
  additionalAttributes?: Partial<AISpanAttributes>;
}

/**
 * AI pipeline tracking options
 */
export interface AIPipelineOptions {
  /**
   * Unique identifier for the pipeline run
   */
  pipelineId?: string;

  /**
   * Name of the pipeline
   */
  name: string;

  /**
   * Pipeline version
   */
  version?: string;

  /**
   * Custom attributes
   */
  attributes?: Partial<AISpanAttributes>;
}

/**
 * Main AI Monitoring interface
 */
export interface AIMonitoring {
  /**
   * Wrap an OpenAI client to automatically track completions
   */
  wrapOpenAI<T>(client: T, options?: WrapOpenAIOptions): T;

  /**
   * Wrap an Anthropic client to automatically track messages
   */
  wrapAnthropic<T>(client: T, options?: WrapAnthropicOptions): T;

  /**
   * Start an agent invocation span
   */
  startAgentSpan(name: string, options?: Partial<AgentSpanOptions>): Span;

  /**
   * Start a tool execution span
   */
  startToolSpan(name: string, options?: Partial<ToolSpanOptions>): Span;

  /**
   * Record token usage on the current or specified span
   */
  recordTokenUsage(usage: TokenUsage, span?: Span): void;

  /**
   * Start a pipeline span for tracking multi-step AI workflows
   */
  startPipelineSpan(options: AIPipelineOptions): Span;

  /**
   * Record cost information
   */
  recordCost(costUsd: number, span?: Span): void;
}

/**
 * AI operation types for span operations
 */
export type AIOperationType =
  | 'ai.chat_completion'
  | 'ai.completion'
  | 'ai.embedding'
  | 'ai.agent.invoke'
  | 'ai.tool.execute'
  | 'ai.pipeline'
  | 'ai.pipeline.step';

/**
 * Known AI providers
 */
export type AIProvider = 'openai' | 'anthropic' | 'cohere' | 'huggingface' | 'langchain' | 'custom';

/**
 * Common finish reasons across providers
 */
export type FinishReason = 'stop' | 'length' | 'tool_calls' | 'content_filter' | 'error' | 'unknown';
