/**
 * @fileoverview Shared helpers for reading rendered MCP content blocks in tests.
 * @module tests/helpers/content
 */

import type { ContentBlock } from '@cyanheads/mcp-ts-core';

/**
 * Read the text of the first content block.
 *
 * `ContentBlock` is a union (text, image, audio, resource), so indexing the
 * array and reading `.text` does not typecheck on its own. Throws when the
 * block is missing or is not a text block, which is a test failure either way.
 */
export function firstText(blocks: ContentBlock[]): string {
  const block = blocks[0];
  if (!block) throw new Error('Expected at least one content block, got none.');
  if (block.type !== 'text') {
    throw new Error(`Expected a text content block, got "${block.type}".`);
  }
  return block.text;
}
