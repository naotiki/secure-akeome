import { base32Encode } from './base32';
import { sha256 } from './sha256';
import type { ChecksumBlock } from '@/types';

function isArmorBegin(line: string) {
  return line.startsWith('-----BEGIN ') && line.endsWith('-----');
}

function isArmorEnd(line: string) {
  return line.startsWith('-----END ') && line.endsWith('-----');
}

type LineMeta = { text: string; start: number; end: number };

function splitLinesWithOffsets(text: string): LineMeta[] {
  const lines = text.split('\n');
  const out: LineMeta[] = [];
  let cursor = 0;
  for (const line of lines) {
    const start = cursor;
    const end = start + line.length;
    out.push({ text: line, start, end });
    cursor = end + 1; // '\n'
  }
  return out;
}

function findArmoredCoreLineRange(lines: LineMeta[]): { startLine: number; endLine: number } {
  const beginIndex = lines.findIndex((l) => isArmorBegin(l.text));
  if (beginIndex === -1) return { startLine: 0, endLine: lines.length };
  const endIndex = lines.findIndex((l, idx) => idx > beginIndex && isArmorEnd(l.text));
  if (endIndex === -1) return { startLine: 0, endLine: lines.length };
  return { startLine: beginIndex + 1, endLine: endIndex };
}

function partitionCount(total: number, parts: number): number[] {
  if (parts <= 0) return [];
  const base = Math.floor(total / parts);
  const rem = total % parts;
  const sizes: number[] = [];
  for (let i = 0; i < parts; i++) sizes.push(base + (i < rem ? 1 : 0));
  return sizes;
}

export type ComputeChecksumsOptions = {
  parts?: number; // default 4 (parts per line)
  displayChars?: number; // default 4 (base32 chars)
};

// Spec (v2): exclude armor BEGIN/END lines; for each remaining line, split into N parts; hash each part.
export async function computeChecksums(input: string, opts: ComputeChecksumsOptions = {}): Promise<ChecksumBlock[]> {
  const parts = Math.max(1, Math.floor(opts.parts ?? 4));
  const displayChars = Math.max(2, Math.floor(opts.displayChars ?? 4));
  const text = input.replace(/\r\n/g, '\n').trimEnd();
  if (!text) return [];

  const encoder = new TextEncoder();
  const lines = splitLinesWithOffsets(text);
  const { startLine: coreStart, endLine: coreEnd } = findArmoredCoreLineRange(lines);

  const results: ChecksumBlock[] = [];
  let index = 1;
  for (let lineIndex = coreStart; lineIndex < coreEnd; lineIndex++) {
    const line = lines[lineIndex];
    const sizes = partitionCount(line.text.length, parts);
    let pos = 0;
    for (let partIndex = 0; partIndex < sizes.length; partIndex++) {
      const size = sizes[partIndex];
      const segStart = pos;
      const segEnd = segStart + size;
      pos = segEnd;

      const segText = line.text.slice(segStart, segEnd);
      const digest = await sha256(encoder.encode(segText));
      const code = base32Encode(digest).slice(0, displayChars).toUpperCase();
      results.push({
        index,
        checksum: code,
        start: line.start + segStart,
        end: line.start + segEnd,
      });
      index++;
    }
  }
  return results;
}
