/**
 * AI Agent Monitoring Tests
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';

import {
  aiMonitoring,
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
  wrapOpenAIClient,
  wrapAnthropicClient,
  instrumentChatCompletion,
  instrumentEmbeddings,
  instrumentAnthropicMessage,
  calculateAnthropicCost,
  parseAnthropicModel,
  createAIMonitoring,
  getActiveAISpan,
} from '../../ai';

import type { TokenUsage, ChatCompletionResponse, AnthropicMessageResponse } from '../../ai';

describe('AI Agent Monitoring', () => {
  describe('aiMonitoring singleton', () => {
    it('should provide all expected methods', () => {
      expect(typeof aiMonitoring.wrapOpenAI).toBe('function');
      expect(typeof aiMonitoring.wrapAnthropic).toBe('function');
      expect(typeof aiMonitoring.startAgentSpan).toBe('function');
      expect(typeof aiMonitoring.startToolSpan).toBe('function');
      expect(typeof aiMonitoring.recordTokenUsage).toBe('function');
      expect(typeof aiMonitoring.startPipelineSpan).toBe('function');
      expect(typeof aiMonitoring.recordCost).toBe('function');
    });

    it('should create agent spans', () => {
      const span = aiMonitoring.startAgentSpan('test-agent', {
        model: 'gpt-4',
        provider: 'openai',
      });

      expect(span).toBeTruthy();
      expect(span.spanId).toBeTruthy();
      expect(span.traceId).toBeTruthy();
      expect(span.op).toBe('ai.agent.invoke');
      expect(span.name).toContain('test-agent');

      span.end();
    });

    it('should create tool spans', () => {
      const span = aiMonitoring.startToolSpan('search-tool', {
        description: 'Search the database',
        input: { query: 'test' },
      });

      expect(span).toBeTruthy();
      expect(span.op).toBe('ai.tool.execute');
      expect(span.name).toContain('search-tool');

      span.end();
    });

    it('should record token usage', () => {
      const span = aiMonitoring.startAgentSpan('token-test');

      aiMonitoring.recordTokenUsage(
        { input: 100, output: 50, total: 150 },
        span
      );

      expect(span.attributes['ai.input_tokens']).toBe(100);
      expect(span.attributes['ai.output_tokens']).toBe(50);
      expect(span.attributes['ai.total_tokens']).toBe(150);

      span.end();
    });

    it('should record cost', () => {
      const span = aiMonitoring.startAgentSpan('cost-test');
      aiMonitoring.recordCost(0.0045, span);
      expect(span.attributes['ai.cost_usd']).toBe(0.0045);
      span.end();
    });

    it('should create pipeline spans', () => {
      const span = aiMonitoring.startPipelineSpan({
        name: 'document-processing',
        pipelineId: 'pipe-123',
        version: '1.0.0',
      });

      expect(span).toBeTruthy();
      expect(span.op).toBe('ai.pipeline');
      expect(span.name).toContain('document-processing');
      expect(span.attributes['ai.pipeline_id']).toBe('pipe-123');

      span.end();
    });
  });

  describe('Span creation helpers', () => {
    it('startAgentSpan should create span with correct operation', () => {
      const span = startAgentSpan('my-agent', {
        model: 'claude-3-opus',
        provider: 'anthropic',
        metadata: { userId: '123' },
      });

      expect(span.op).toBe('ai.agent.invoke');
      expect(span.attributes['ai.model']).toBe('claude-3-opus');
      expect(span.attributes['ai.provider']).toBe('anthropic');
      expect(span.attributes['ai.agent_name']).toBe('my-agent');

      span.end();
    });

    it('startToolSpan should create span with correct operation', () => {
      const span = startToolSpan('calculator', {
        description: 'Calculate math expressions',
      });

      expect(span.op).toBe('ai.tool.execute');
      expect(span.attributes['ai.tool_name']).toBe('calculator');

      span.end();
    });

    it('startPipelineSpan should create span with pipeline attributes', () => {
      const span = startPipelineSpan({
        name: 'rag-pipeline',
        pipelineId: 'rag-001',
        version: '2.0.0',
      });

      expect(span.op).toBe('ai.pipeline');
      expect(span.attributes['ai.pipeline_id']).toBe('rag-001');

      span.end();
    });

    it('startPipelineStepSpan should create child span', () => {
      const pipelineSpan = startPipelineSpan({ name: 'test-pipeline' });
      const stepSpan = startPipelineStepSpan('extract-text', pipelineSpan);

      expect(stepSpan.op).toBe('ai.pipeline.step');
      expect(stepSpan.traceId).toBe(pipelineSpan.traceId);
      expect(stepSpan.name).toContain('extract-text');

      stepSpan.end();
      pipelineSpan.end();
    });

    it('startChatCompletionSpan should create span for chat completions', () => {
      const span = startChatCompletionSpan('gpt-4-turbo', 'openai', false);

      expect(span.op).toBe('ai.chat_completion');
      expect(span.attributes['ai.model']).toBe('gpt-4-turbo');
      expect(span.attributes['ai.provider']).toBe('openai');
      expect(span.attributes['ai.streaming']).toBe(false);

      span.end();
    });

    it('startChatCompletionSpan should handle streaming flag', () => {
      const span = startChatCompletionSpan('gpt-4', 'openai', true);
      expect(span.attributes['ai.streaming']).toBe(true);
      span.end();
    });

    it('startEmbeddingSpan should create span for embeddings', () => {
      const span = startEmbeddingSpan('text-embedding-3-small', 'openai');

      expect(span.op).toBe('ai.embedding');
      expect(span.attributes['ai.model']).toBe('text-embedding-3-small');
      expect(span.attributes['ai.provider']).toBe('openai');

      span.end();
    });
  });

  describe('Token and metric recording', () => {
    it('recordTokenUsage should record all token metrics', () => {
      const span = startAgentSpan('test');
      recordTokenUsage({ input: 200, output: 100 }, span);

      expect(span.attributes['ai.input_tokens']).toBe(200);
      expect(span.attributes['ai.output_tokens']).toBe(100);
      expect(span.attributes['ai.total_tokens']).toBe(300);

      span.end();
    });

    it('recordTokenUsage should use provided total', () => {
      const span = startAgentSpan('test');
      recordTokenUsage({ input: 200, output: 100, total: 350 }, span);
      expect(span.attributes['ai.total_tokens']).toBe(350);
      span.end();
    });

    it('recordCost should record cost in USD', () => {
      const span = startAgentSpan('test');
      recordCost(0.0123, span);
      expect(span.attributes['ai.cost_usd']).toBe(0.0123);
      span.end();
    });

    it('recordModelInfo should record model and provider', () => {
      const span = startAgentSpan('test');
      recordModelInfo('claude-3-sonnet', 'anthropic', span);
      expect(span.attributes['ai.model']).toBe('claude-3-sonnet');
      expect(span.attributes['ai.provider']).toBe('anthropic');
      span.end();
    });

    it('recordFinishReason should record finish reason', () => {
      const span = startAgentSpan('test');
      recordFinishReason('stop', span);
      expect(span.attributes['ai.finish_reason']).toBe('stop');
      span.end();
    });
  });

  describe('OpenAI client wrapping', () => {
    it('wrapOpenAIClient should return client unchanged if not object', () => {
      expect(wrapOpenAIClient(null)).toBe(null);
      expect(wrapOpenAIClient(undefined)).toBe(undefined);
    });

    it('wrapOpenAIClient should wrap chat.completions.create', async () => {
      const mockResponse: ChatCompletionResponse = {
        id: 'chatcmpl-123',
        object: 'chat.completion',
        created: Date.now(),
        model: 'gpt-4',
        choices: [{
          index: 0,
          message: { role: 'assistant', content: 'Hello!' },
          finish_reason: 'stop',
        }],
        usage: { prompt_tokens: 10, completion_tokens: 5, total_tokens: 15 },
      };

      const mockClient = {
        chat: {
          completions: {
            create: async () => mockResponse,
          },
        },
      };

      const wrappedClient = wrapOpenAIClient(mockClient);
      const response = await wrappedClient.chat.completions.create({
        model: 'gpt-4',
        messages: [{ role: 'user', content: 'Hi' }],
      });

      expect(response.id).toBe('chatcmpl-123');
      expect(response.choices[0].message.content).toBe('Hello!');
    });

    it('wrapOpenAIClient should wrap embeddings.create', async () => {
      const mockResponse = {
        object: 'list',
        data: [{ object: 'embedding', index: 0, embedding: [0.1, 0.2, 0.3] }],
        model: 'text-embedding-3-small',
        usage: { prompt_tokens: 5, total_tokens: 5 },
      };

      const mockClient = {
        embeddings: {
          create: async () => mockResponse,
        },
      };

      const wrappedClient = wrapOpenAIClient(mockClient);
      const response = await wrappedClient.embeddings.create({
        model: 'text-embedding-3-small',
        input: 'test',
      });

      expect(response.object).toBe('list');
      expect(response.data[0].embedding.length).toBe(3);
    });
  });

  describe('Anthropic client wrapping', () => {
    it('wrapAnthropicClient should return client unchanged if not object', () => {
      expect(wrapAnthropicClient(null)).toBe(null);
    });

    it('wrapAnthropicClient should wrap messages.create', async () => {
      const mockResponse: AnthropicMessageResponse = {
        id: 'msg_123',
        type: 'message',
        role: 'assistant',
        content: [{ type: 'text', text: 'Hello!' }],
        model: 'claude-3-opus-20240229',
        stop_reason: 'end_turn',
        stop_sequence: null,
        usage: { input_tokens: 10, output_tokens: 5 },
      };

      const mockClient = {
        messages: {
          create: async () => mockResponse,
        },
      };

      const wrappedClient = wrapAnthropicClient(mockClient);
      const response = await wrappedClient.messages.create({
        model: 'claude-3-opus-20240229',
        max_tokens: 1024,
        messages: [{ role: 'user', content: 'Hi' }],
      });

      expect(response.id).toBe('msg_123');
      expect(response.content[0].text).toBe('Hello!');
    });
  });

  describe('Manual instrumentation helpers', () => {
    it('instrumentChatCompletion should return span and finalize function', () => {
      const { span, finalize } = instrumentChatCompletion({
        model: 'gpt-4',
        temperature: 0.7,
        maxTokens: 100,
      });

      expect(span).toBeTruthy();
      expect(typeof finalize).toBe('function');
      expect(span.attributes['ai.temperature']).toBe(0.7);
      expect(span.attributes['ai.max_tokens']).toBe(100);

      finalize({
        id: 'test-123',
        object: 'chat.completion',
        created: Date.now(),
        model: 'gpt-4',
        choices: [{
          index: 0,
          message: { role: 'assistant', content: 'test' },
          finish_reason: 'stop',
        }],
        usage: { prompt_tokens: 10, completion_tokens: 5, total_tokens: 15 },
      });

      expect(span.attributes['ai.input_tokens']).toBe(10);
      expect(span.attributes['ai.output_tokens']).toBe(5);
      expect(span.attributes['ai.finish_reason']).toBe('stop');

      span.end();
    });

    it('instrumentEmbeddings should return span and finalize function', () => {
      const { span, finalize } = instrumentEmbeddings({
        model: 'text-embedding-3-small',
      });

      expect(span).toBeTruthy();
      expect(span.op).toBe('ai.embedding');

      finalize({
        object: 'list',
        data: [{ object: 'embedding', index: 0, embedding: [0.1] }],
        model: 'text-embedding-3-small',
        usage: { prompt_tokens: 5, total_tokens: 5 },
      });

      expect(span.attributes['ai.input_tokens']).toBe(5);
      span.end();
    });

    it('instrumentAnthropicMessage should return span and finalize function', () => {
      const { span, finalize } = instrumentAnthropicMessage({
        model: 'claude-3-opus-20240229',
        temperature: 0.5,
        maxTokens: 500,
      });

      expect(span).toBeTruthy();
      expect(span.attributes['ai.temperature']).toBe(0.5);
      expect(span.attributes['ai.max_tokens']).toBe(500);

      finalize({
        id: 'msg_test',
        type: 'message',
        role: 'assistant',
        content: [{ type: 'text', text: 'Hi' }],
        model: 'claude-3-opus-20240229',
        stop_reason: 'end_turn',
        stop_sequence: null,
        usage: { input_tokens: 20, output_tokens: 10 },
      });

      expect(span.attributes['ai.input_tokens']).toBe(20);
      expect(span.attributes['ai.output_tokens']).toBe(10);
      expect(span.attributes['ai.finish_reason']).toBe('end_turn');

      span.end();
    });
  });

  describe('Utility functions', () => {
    describe('calculateAnthropicCost', () => {
      it('should calculate cost for Claude 3 Opus', () => {
        const cost = calculateAnthropicCost('claude-3-opus-20240229', { input: 1000, output: 500 });
        const expected = (1000 / 1_000_000) * 15 + (500 / 1_000_000) * 75;
        expect(cost).toBe(expected);
      });

      it('should calculate cost for Claude 3 Sonnet', () => {
        const cost = calculateAnthropicCost('claude-3-sonnet-20240229', { input: 1000, output: 500 });
        const expected = (1000 / 1_000_000) * 3 + (500 / 1_000_000) * 15;
        expect(cost).toBe(expected);
      });

      it('should calculate cost for Claude 3 Haiku', () => {
        const cost = calculateAnthropicCost('claude-3-haiku-20240307', { input: 10000, output: 5000 });
        const expected = (10000 / 1_000_000) * 0.25 + (5000 / 1_000_000) * 1.25;
        expect(cost).toBe(expected);
      });

      it('should default to Sonnet pricing for unknown models', () => {
        const cost = calculateAnthropicCost('claude-unknown', { input: 1000, output: 500 });
        const expected = (1000 / 1_000_000) * 3 + (500 / 1_000_000) * 15;
        expect(cost).toBe(expected);
      });
    });

    describe('parseAnthropicModel', () => {
      it('should parse Claude 3 Opus model name', () => {
        const result = parseAnthropicModel('claude-3-opus-20240229');
        expect(result.family).toBe('claude');
        expect(result.variant).toBe('3-opus');
        expect(result.version).toBe('20240229');
      });

      it('should parse Claude 3 Sonnet model name', () => {
        const result = parseAnthropicModel('claude-3-sonnet-20240229');
        expect(result.family).toBe('claude');
        expect(result.variant).toBe('3-sonnet');
        expect(result.version).toBe('20240229');
      });

      it('should parse legacy Claude 2 model name', () => {
        const result = parseAnthropicModel('claude-2.1');
        expect(result.family).toBe('claude');
        expect(result.variant).toBe('2.1');
        expect(result.version).toBeUndefined();
      });

      it('should handle unknown model format', () => {
        const result = parseAnthropicModel('some-custom-model');
        expect(result.family).toBe('claude');
        expect(result.variant).toBe('some-custom-model');
      });
    });
  });

  describe('createAIMonitoring', () => {
    it('should create a new AIMonitoring instance', () => {
      const monitoring = createAIMonitoring();
      expect(monitoring).toBeTruthy();
      expect(typeof monitoring.wrapOpenAI).toBe('function');
      expect(typeof monitoring.wrapAnthropic).toBe('function');
      expect(typeof monitoring.startAgentSpan).toBe('function');
    });

    it('should accept default options', () => {
      const monitoring = createAIMonitoring({
        openAI: { capturePrompts: true },
        anthropic: { captureResponses: true },
      });
      expect(monitoring).toBeTruthy();
    });
  });

  describe('getActiveAISpan', () => {
    it('should return undefined when no AI span is active', () => {
      const span = getActiveAISpan();
      expect(span).toBeUndefined();
    });
  });
});
