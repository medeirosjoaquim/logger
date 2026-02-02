/**
 * Attachment Utilities Tests
 */

import { describe, it, expect } from 'vitest';
import {
  MAX_ATTACHMENT_SIZE,
  MAX_TOTAL_ATTACHMENTS_SIZE,
  getAttachmentSize,
  validateAttachment,
  validateAttachmentsSize,
  encodeAttachment,
  createAttachmentEnvelopeItem,
  createAttachmentEnvelopeItems,
  inferContentType,
  filterAttachments,
  dropAttachmentsByFilename,
  dropAttachmentsBySize,
  keepAttachmentsByContentType,
  createTextAttachment,
  createJsonAttachment,
  createBinaryAttachment,
} from '../../transport/attachments.js';
import type { Attachment } from '../../types/sentry.js';

describe('Attachment Utilities', () => {
  describe('Constants', () => {
    it('should have correct max attachment size', () => {
      expect(MAX_ATTACHMENT_SIZE).toBe(100 * 1024 * 1024); // 100MB
    });

    it('should have correct max total attachments size', () => {
      expect(MAX_TOTAL_ATTACHMENTS_SIZE).toBe(100 * 1024 * 1024); // 100MB
    });
  });

  describe('getAttachmentSize', () => {
    it('should return correct size for string data', () => {
      const size = getAttachmentSize('hello');
      expect(size).toBe(5);
    });

    it('should return correct size for UTF-8 string', () => {
      const size = getAttachmentSize('hello 世界');
      expect(size).toBe(12); // 'hello ' = 6 bytes + '世界' = 6 bytes (3 bytes each)
    });

    it('should return correct size for Uint8Array', () => {
      const data = new Uint8Array([1, 2, 3, 4, 5]);
      const size = getAttachmentSize(data);
      expect(size).toBe(5);
    });
  });

  describe('validateAttachment', () => {
    it('should validate a valid string attachment', () => {
      const attachment: Attachment = {
        filename: 'test.txt',
        data: 'hello world',
      };
      const result = validateAttachment(attachment);
      expect(result.valid).toBe(true);
      expect(result.size).toBe(11);
    });

    it('should validate a valid Uint8Array attachment', () => {
      const attachment: Attachment = {
        filename: 'test.bin',
        data: new Uint8Array([1, 2, 3, 4, 5]),
      };
      const result = validateAttachment(attachment);
      expect(result.valid).toBe(true);
      expect(result.size).toBe(5);
    });

    it('should reject attachment without filename', () => {
      const attachment = {
        filename: '',
        data: 'hello',
      } as Attachment;
      const result = validateAttachment(attachment);
      expect(result.valid).toBe(false);
      expect(result.error).toContain('filename');
    });

    it('should reject attachment without data', () => {
      const attachment = {
        filename: 'test.txt',
        data: null,
      } as unknown as Attachment;
      const result = validateAttachment(attachment);
      expect(result.valid).toBe(false);
      expect(result.error).toContain('data is required');
    });

    it('should reject empty data', () => {
      const attachment: Attachment = {
        filename: 'test.txt',
        data: '',
      };
      const result = validateAttachment(attachment);
      expect(result.valid).toBe(false);
      expect(result.error).toContain('empty');
    });
  });

  describe('validateAttachmentsSize', () => {
    it('should validate total size of multiple attachments', () => {
      const attachments: Attachment[] = [
        { filename: 'a.txt', data: 'hello' },
        { filename: 'b.txt', data: 'world' },
      ];
      const result = validateAttachmentsSize(attachments);
      expect(result.valid).toBe(true);
      expect(result.size).toBe(10);
    });

    it('should fail if any attachment is invalid', () => {
      const attachments: Attachment[] = [
        { filename: 'a.txt', data: 'hello' },
        { filename: '', data: 'world' },
      ];
      const result = validateAttachmentsSize(attachments);
      expect(result.valid).toBe(false);
    });
  });

  describe('encodeAttachment', () => {
    it('should encode string attachment', () => {
      const attachment: Attachment = {
        filename: 'test.txt',
        data: 'hello',
        contentType: 'text/plain',
      };
      const encoded = encodeAttachment(attachment);
      expect(encoded.filename).toBe('test.txt');
      expect(encoded.contentType).toBe('text/plain');
      expect(encoded.data.constructor.name).toBe('Uint8Array');
      expect(encoded.size).toBe(5);
    });

    it('should encode Uint8Array attachment', () => {
      const data = new Uint8Array([1, 2, 3]);
      const attachment: Attachment = {
        filename: 'test.bin',
        data,
      };
      const encoded = encodeAttachment(attachment);
      expect(encoded.data).toBe(data);
      expect(encoded.size).toBe(3);
    });

    it('should infer content type from filename', () => {
      const attachment: Attachment = {
        filename: 'data.json',
        data: '{}',
      };
      const encoded = encodeAttachment(attachment);
      expect(encoded.contentType).toBe('application/json');
    });

    it('should use default attachment type', () => {
      const attachment: Attachment = {
        filename: 'test.txt',
        data: 'hello',
      };
      const encoded = encodeAttachment(attachment);
      expect(encoded.attachmentType).toBe('event.attachment');
    });
  });

  describe('createAttachmentEnvelopeItem', () => {
    it('should create envelope item with correct header', () => {
      const attachment: Attachment = {
        filename: 'test.txt',
        data: 'hello',
        contentType: 'text/plain',
        attachmentType: 'event.attachment',
      };
      const item = createAttachmentEnvelopeItem(attachment);
      expect(item.header.type).toBe('attachment');
      expect(item.header.filename).toBe('test.txt');
      expect(item.header.content_type).toBe('text/plain');
      expect(item.header.attachment_type).toBe('event.attachment');
      expect(item.header.length).toBe(5);
    });
  });

  describe('createAttachmentEnvelopeItems', () => {
    it('should create multiple envelope items', () => {
      const attachments: Attachment[] = [
        { filename: 'a.txt', data: 'hello' },
        { filename: 'b.txt', data: 'world' },
      ];
      const items = createAttachmentEnvelopeItems(attachments);
      expect(items).toHaveLength(2);
      expect(items[0].header.filename).toBe('a.txt');
      expect(items[1].header.filename).toBe('b.txt');
    });
  });

  describe('inferContentType', () => {
    it('should infer common content types', () => {
      expect(inferContentType('file.txt')).toBe('text/plain');
      expect(inferContentType('file.json')).toBe('application/json');
      expect(inferContentType('file.png')).toBe('image/png');
      expect(inferContentType('file.jpg')).toBe('image/jpeg');
      expect(inferContentType('file.pdf')).toBe('application/pdf');
      expect(inferContentType('file.log')).toBe('text/plain');
    });

    it('should return octet-stream for unknown types', () => {
      expect(inferContentType('file.xyz')).toBe('application/octet-stream');
      expect(inferContentType('file')).toBe('application/octet-stream');
    });
  });

  describe('filterAttachments', () => {
    it('should filter attachments by predicate', () => {
      const attachments: Attachment[] = [
        { filename: 'a.txt', data: 'hello' },
        { filename: 'b.json', data: '{}' },
        { filename: 'c.txt', data: 'world' },
      ];
      const filtered = filterAttachments(attachments, (a) => a.filename.endsWith('.txt'));
      expect(filtered).toHaveLength(2);
      expect(filtered[0].filename).toBe('a.txt');
      expect(filtered[1].filename).toBe('c.txt');
    });
  });

  describe('dropAttachmentsByFilename', () => {
    it('should drop attachments matching string patterns', () => {
      const attachments: Attachment[] = [
        { filename: 'keep.txt', data: 'hello' },
        { filename: 'secret.txt', data: 'password' },
        { filename: 'data.json', data: '{}' },
      ];
      const filtered = dropAttachmentsByFilename(attachments, ['secret.txt']);
      expect(filtered).toHaveLength(2);
      expect(filtered.find((a) => a.filename === 'secret.txt')).toBeUndefined();
    });

    it('should drop attachments matching regex patterns', () => {
      const attachments: Attachment[] = [
        { filename: 'keep.txt', data: 'hello' },
        { filename: 'secret.txt', data: 'password' },
        { filename: 'private.log', data: 'logs' },
      ];
      const filtered = dropAttachmentsByFilename(attachments, [/^(secret|private)/]);
      expect(filtered).toHaveLength(1);
      expect(filtered[0].filename).toBe('keep.txt');
    });
  });

  describe('dropAttachmentsBySize', () => {
    it('should drop attachments exceeding size limit', () => {
      const attachments: Attachment[] = [
        { filename: 'small.txt', data: 'hi' },
        { filename: 'medium.txt', data: 'hello world' },
        { filename: 'large.txt', data: 'a'.repeat(100) },
      ];
      const filtered = dropAttachmentsBySize(attachments, 20);
      expect(filtered).toHaveLength(2);
      expect(filtered.find((a) => a.filename === 'large.txt')).toBeUndefined();
    });
  });

  describe('keepAttachmentsByContentType', () => {
    it('should keep only attachments with allowed content types', () => {
      const attachments: Attachment[] = [
        { filename: 'text.txt', data: 'hello', contentType: 'text/plain' },
        { filename: 'data.json', data: '{}', contentType: 'application/json' },
        { filename: 'image.png', data: 'binary', contentType: 'image/png' },
      ];
      const filtered = keepAttachmentsByContentType(attachments, ['text/plain', 'application/json']);
      expect(filtered).toHaveLength(2);
      expect(filtered.find((a) => a.filename === 'image.png')).toBeUndefined();
    });

    it('should support wildcard content types', () => {
      const attachments: Attachment[] = [
        { filename: 'text.txt', data: 'hello', contentType: 'text/plain' },
        { filename: 'data.json', data: '{}', contentType: 'application/json' },
        { filename: 'image.png', data: 'binary', contentType: 'image/png' },
        { filename: 'image.jpg', data: 'binary', contentType: 'image/jpeg' },
      ];
      const filtered = keepAttachmentsByContentType(attachments, ['image/*']);
      expect(filtered).toHaveLength(2);
      expect(filtered.every((a) => a.contentType?.startsWith('image/'))).toBe(true);
    });
  });

  describe('createTextAttachment', () => {
    it('should create text attachment', () => {
      const attachment = createTextAttachment('notes.txt', 'Some notes');
      expect(attachment.filename).toBe('notes.txt');
      expect(attachment.data).toBe('Some notes');
      expect(attachment.contentType).toBe('text/plain');
      expect(attachment.attachmentType).toBe('event.attachment');
    });

    it('should accept custom options', () => {
      const attachment = createTextAttachment('log.txt', 'Error log', {
        contentType: 'text/x-log',
        attachmentType: 'event.attachment',
      });
      expect(attachment.contentType).toBe('text/x-log');
    });
  });

  describe('createJsonAttachment', () => {
    it('should create JSON attachment', () => {
      const data = { key: 'value', count: 42 };
      const attachment = createJsonAttachment('data', data);
      expect(attachment.filename).toBe('data.json');
      expect(attachment.contentType).toBe('application/json');
      expect(JSON.parse(attachment.data as string)).toEqual(data);
    });

    it('should not double-add .json extension', () => {
      const attachment = createJsonAttachment('data.json', {});
      expect(attachment.filename).toBe('data.json');
    });
  });

  describe('createBinaryAttachment', () => {
    it('should create binary attachment', () => {
      const data = new Uint8Array([1, 2, 3, 4, 5]);
      const attachment = createBinaryAttachment('data.bin', data);
      expect(attachment.filename).toBe('data.bin');
      expect(attachment.data).toBe(data);
      expect(attachment.contentType).toBe('application/octet-stream');
    });

    it('should infer content type from filename', () => {
      const attachment = createBinaryAttachment('image.png', new Uint8Array([1, 2, 3]));
      expect(attachment.contentType).toBe('image/png');
    });
  });
});
