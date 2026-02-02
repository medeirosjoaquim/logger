/**
 * Attachment Utilities for Sentry-Compatible Events
 *
 * Provides encoding, validation, and envelope item creation
 * for file attachments sent with events.
 *
 * @see https://docs.sentry.io/platforms/javascript/enriching-events/attachments/
 */

import type { Attachment } from '../types/sentry.js';
import type { EnvelopeItem, EnvelopeItemHeader } from './envelope.js';

/**
 * Maximum attachment size in bytes (100MB)
 * This is the Sentry server-side limit
 */
export const MAX_ATTACHMENT_SIZE = 100 * 1024 * 1024;

/**
 * Maximum total attachments size per event (100MB)
 */
export const MAX_TOTAL_ATTACHMENTS_SIZE = 100 * 1024 * 1024;

/**
 * Default attachment type
 */
export const DEFAULT_ATTACHMENT_TYPE = 'event.attachment';

/**
 * Valid attachment types as per Sentry specification
 */
export type AttachmentType =
  | 'event.attachment'
  | 'event.minidump'
  | 'event.applecrashreport'
  | 'event.view_hierarchy'
  | 'unreal.context'
  | 'unreal.logs';

/**
 * Result of attachment validation
 */
export interface AttachmentValidationResult {
  /**
   * Whether the attachment is valid
   */
  valid: boolean;

  /**
   * Error message if invalid
   */
  error?: string;

  /**
   * Size of the attachment data in bytes
   */
  size: number;
}

/**
 * Encoded attachment ready for envelope
 */
export interface EncodedAttachment {
  /**
   * The attachment data as Uint8Array
   */
  data: Uint8Array;

  /**
   * The filename
   */
  filename: string;

  /**
   * The content type
   */
  contentType: string;

  /**
   * The attachment type
   */
  attachmentType: AttachmentType;

  /**
   * Size in bytes
   */
  size: number;
}

/**
 * Get the size of attachment data in bytes
 */
export function getAttachmentSize(data: Attachment['data']): number {
  if (typeof data === 'string') {
    // String data - count UTF-8 bytes
    return new TextEncoder().encode(data).length;
  }

  if (data instanceof Uint8Array) {
    return data.length;
  }

  // Handle Blob (browser environment)
  if (typeof Blob !== 'undefined' && data instanceof Blob) {
    return data.size;
  }

  // Should not happen with proper types, but handle gracefully
  return 0;
}

/**
 * Validate an attachment for size and format
 */
export function validateAttachment(attachment: Attachment): AttachmentValidationResult {
  const { data, filename } = attachment;

  // Validate filename
  if (!filename || typeof filename !== 'string' || filename.trim() === '') {
    return {
      valid: false,
      error: 'Attachment filename is required and must be a non-empty string',
      size: 0,
    };
  }

  // Validate data exists
  if (data === null || data === undefined) {
    return {
      valid: false,
      error: 'Attachment data is required',
      size: 0,
    };
  }

  // Validate data type
  const isBlob = typeof Blob !== 'undefined' && data instanceof Blob;
  if (typeof data !== 'string' && !(data instanceof Uint8Array) && !isBlob) {
    return {
      valid: false,
      error: 'Attachment data must be a string, Uint8Array, or Blob',
      size: 0,
    };
  }

  // Calculate size
  const size = getAttachmentSize(data);

  // Validate size
  if (size > MAX_ATTACHMENT_SIZE) {
    return {
      valid: false,
      error: `Attachment size (${formatBytes(size)}) exceeds maximum allowed size (${formatBytes(MAX_ATTACHMENT_SIZE)})`,
      size,
    };
  }

  if (size === 0) {
    return {
      valid: false,
      error: 'Attachment data cannot be empty',
      size: 0,
    };
  }

  return {
    valid: true,
    size,
  };
}

/**
 * Validate total size of multiple attachments
 */
export function validateAttachmentsSize(attachments: Attachment[]): AttachmentValidationResult {
  let totalSize = 0;

  for (const attachment of attachments) {
    const result = validateAttachment(attachment);
    if (!result.valid) {
      return result;
    }
    totalSize += result.size;
  }

  if (totalSize > MAX_TOTAL_ATTACHMENTS_SIZE) {
    return {
      valid: false,
      error: `Total attachments size (${formatBytes(totalSize)}) exceeds maximum allowed (${formatBytes(MAX_TOTAL_ATTACHMENTS_SIZE)})`,
      size: totalSize,
    };
  }

  return {
    valid: true,
    size: totalSize,
  };
}

/**
 * Encode attachment data to Uint8Array (synchronous version)
 * Note: For Blob data, use encodeAttachmentAsync instead
 */
export function encodeAttachment(attachment: Attachment): EncodedAttachment {
  const { data, filename, contentType, attachmentType } = attachment;

  // Convert data to Uint8Array
  let encodedData: Uint8Array;
  if (typeof data === 'string') {
    encodedData = new TextEncoder().encode(data);
  } else if (data instanceof Uint8Array) {
    encodedData = data;
  } else if (typeof Blob !== 'undefined' && data instanceof Blob) {
    // For Blob, we cannot encode synchronously - return empty and warn
    console.warn('Blob attachments require async encoding. Use encodeAttachmentAsync instead.');
    encodedData = new Uint8Array(0);
  } else {
    // Fallback for unexpected types
    encodedData = new TextEncoder().encode(String(data));
  }

  // Determine content type
  const resolvedContentType = contentType || inferContentType(filename);

  // Determine attachment type
  const resolvedAttachmentType = (attachmentType || DEFAULT_ATTACHMENT_TYPE) as AttachmentType;

  return {
    data: encodedData,
    filename,
    contentType: resolvedContentType,
    attachmentType: resolvedAttachmentType,
    size: encodedData.length,
  };
}

/**
 * Encode attachment data to Uint8Array (async version)
 * Supports Blob data in browser environments
 */
export async function encodeAttachmentAsync(attachment: Attachment): Promise<EncodedAttachment> {
  const { data, filename, contentType, attachmentType } = attachment;

  // Convert data to Uint8Array
  let encodedData: Uint8Array;
  if (typeof data === 'string') {
    encodedData = new TextEncoder().encode(data);
  } else if (data instanceof Uint8Array) {
    encodedData = data;
  } else if (typeof Blob !== 'undefined' && data instanceof Blob) {
    // Read Blob as ArrayBuffer and convert to Uint8Array
    const arrayBuffer = await data.arrayBuffer();
    encodedData = new Uint8Array(arrayBuffer);
  } else {
    // Fallback for unexpected types
    encodedData = new TextEncoder().encode(String(data));
  }

  // Determine content type (prefer Blob's type if available)
  let resolvedContentType = contentType;
  if (!resolvedContentType) {
    if (typeof Blob !== 'undefined' && data instanceof Blob && data.type) {
      resolvedContentType = data.type;
    } else {
      resolvedContentType = inferContentType(filename);
    }
  }

  // Determine attachment type
  const resolvedAttachmentType = (attachmentType || DEFAULT_ATTACHMENT_TYPE) as AttachmentType;

  return {
    data: encodedData,
    filename,
    contentType: resolvedContentType,
    attachmentType: resolvedAttachmentType,
    size: encodedData.length,
  };
}

/**
 * Create an attachment envelope item (synchronous)
 * Note: For Blob attachments, use createAttachmentEnvelopeItemAsync
 */
export function createAttachmentEnvelopeItem(attachment: Attachment): EnvelopeItem<Uint8Array> {
  const encoded = encodeAttachment(attachment);

  const header: EnvelopeItemHeader = {
    type: 'attachment',
    filename: encoded.filename,
    content_type: encoded.contentType,
    attachment_type: encoded.attachmentType,
    length: encoded.size,
  };

  return {
    header,
    payload: encoded.data,
  };
}

/**
 * Create an attachment envelope item (async)
 * Supports Blob attachments in browser environments
 */
export async function createAttachmentEnvelopeItemAsync(attachment: Attachment): Promise<EnvelopeItem<Uint8Array>> {
  const encoded = await encodeAttachmentAsync(attachment);

  const header: EnvelopeItemHeader = {
    type: 'attachment',
    filename: encoded.filename,
    content_type: encoded.contentType,
    attachment_type: encoded.attachmentType,
    length: encoded.size,
  };

  return {
    header,
    payload: encoded.data,
  };
}

/**
 * Create multiple attachment envelope items (synchronous)
 */
export function createAttachmentEnvelopeItems(attachments: Attachment[]): EnvelopeItem<Uint8Array>[] {
  return attachments.map(createAttachmentEnvelopeItem);
}

/**
 * Create multiple attachment envelope items (async)
 * Supports Blob attachments in browser environments
 */
export async function createAttachmentEnvelopeItemsAsync(attachments: Attachment[]): Promise<EnvelopeItem<Uint8Array>[]> {
  return Promise.all(attachments.map(createAttachmentEnvelopeItemAsync));
}

/**
 * Infer content type from filename extension
 */
export function inferContentType(filename: string): string {
  const ext = filename.split('.').pop()?.toLowerCase();

  const mimeTypes: Record<string, string> = {
    // Text types
    txt: 'text/plain',
    log: 'text/plain',
    json: 'application/json',
    xml: 'application/xml',
    html: 'text/html',
    css: 'text/css',
    js: 'application/javascript',
    ts: 'text/typescript',
    md: 'text/markdown',
    csv: 'text/csv',

    // Image types
    png: 'image/png',
    jpg: 'image/jpeg',
    jpeg: 'image/jpeg',
    gif: 'image/gif',
    svg: 'image/svg+xml',
    webp: 'image/webp',
    ico: 'image/x-icon',
    bmp: 'image/bmp',

    // Archive types
    zip: 'application/zip',
    gz: 'application/gzip',
    tar: 'application/x-tar',

    // Binary/other
    pdf: 'application/pdf',
    bin: 'application/octet-stream',
    dmp: 'application/x-dmp', // Minidump
  };

  return mimeTypes[ext || ''] || 'application/octet-stream';
}

/**
 * Format bytes into human-readable string
 */
function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 Bytes';

  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));

  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
}

/**
 * Filter attachments based on a predicate function
 * Useful for removing sensitive attachments in beforeSend
 */
export function filterAttachments(
  attachments: Attachment[],
  predicate: (attachment: Attachment, index: number) => boolean
): Attachment[] {
  return attachments.filter(predicate);
}

/**
 * Drop attachments that match certain filenames or patterns
 */
export function dropAttachmentsByFilename(
  attachments: Attachment[],
  patterns: (string | RegExp)[]
): Attachment[] {
  return filterAttachments(attachments, (attachment) => {
    return !patterns.some((pattern) => {
      if (typeof pattern === 'string') {
        return attachment.filename === pattern;
      }
      return pattern.test(attachment.filename);
    });
  });
}

/**
 * Drop attachments that exceed a certain size
 */
export function dropAttachmentsBySize(
  attachments: Attachment[],
  maxSize: number
): Attachment[] {
  return filterAttachments(attachments, (attachment) => {
    return getAttachmentSize(attachment.data) <= maxSize;
  });
}

/**
 * Keep only attachments with certain content types
 */
export function keepAttachmentsByContentType(
  attachments: Attachment[],
  allowedTypes: string[]
): Attachment[] {
  return filterAttachments(attachments, (attachment) => {
    const contentType = attachment.contentType || inferContentType(attachment.filename);
    return allowedTypes.some((type) => {
      if (type.endsWith('/*')) {
        // Wildcard match (e.g., 'image/*')
        const prefix = type.slice(0, -1);
        return contentType.startsWith(prefix);
      }
      return contentType === type;
    });
  });
}

/**
 * Create a text attachment from a string
 */
export function createTextAttachment(
  filename: string,
  content: string,
  options?: { contentType?: string; attachmentType?: AttachmentType }
): Attachment {
  return {
    filename,
    data: content,
    contentType: options?.contentType || 'text/plain',
    attachmentType: options?.attachmentType || 'event.attachment',
  };
}

/**
 * Create a JSON attachment from an object
 */
export function createJsonAttachment(
  filename: string,
  data: unknown,
  options?: { attachmentType?: AttachmentType }
): Attachment {
  const jsonString = JSON.stringify(data, null, 2);
  return {
    filename: filename.endsWith('.json') ? filename : `${filename}.json`,
    data: jsonString,
    contentType: 'application/json',
    attachmentType: options?.attachmentType || 'event.attachment',
  };
}

/**
 * Create a binary attachment from a Uint8Array
 */
export function createBinaryAttachment(
  filename: string,
  data: Uint8Array,
  options?: { contentType?: string; attachmentType?: AttachmentType }
): Attachment {
  return {
    filename,
    data,
    contentType: options?.contentType || inferContentType(filename),
    attachmentType: options?.attachmentType || 'event.attachment',
  };
}
