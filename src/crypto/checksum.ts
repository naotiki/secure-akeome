import { base32Encode } from './base32';
import { sha256 } from './sha256';
import type { ChecksumBlock } from '@/types';

export function chunkStringByChars(input: string, chunkSize: number): Array<{ start: number; end: number; text: string }> {
  const chunks: Array<{ start: number; end: number; text: string }> = [];
  for (let i = 0; i < input.length; i += chunkSize) {
    const start = i;
    const end = Math.min(input.length, i + chunkSize);
    chunks.push({ start, end, text: input.slice(start, end) });
  }
  return chunks;
}

export async function computeChecksums(input: string, blockSize = 256, displayChars = 4): Promise<ChecksumBlock[]> {
  const encoder = new TextEncoder();
  const chunks = chunkStringByChars(input, blockSize);

  const results: ChecksumBlock[] = [];
  for (let i = 0; i < chunks.length; i++) {
    const { start, end, text } = chunks[i];
    const digest = await sha256(encoder.encode(text));
    const code = base32Encode(digest).slice(0, displayChars).toUpperCase();
    results.push({ index: i + 1, checksum: code, start, end });
  }
  return results;
}

