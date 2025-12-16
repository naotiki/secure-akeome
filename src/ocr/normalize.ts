import { ARMOR_WRAP_COLUMNS } from '@/postcard/constants';

function isArmorBegin(line: string) {
  return line.startsWith('-----BEGIN ') && line.endsWith('-----');
}

function isArmorEnd(line: string) {
  return line.startsWith('-----END ') && line.endsWith('-----');
}

export function normalizeOcrArmored(raw: string, columns = ARMOR_WRAP_COLUMNS): string {
  const normalized = raw.replace(/\r\n/g, '\n').trim();
  if (!normalized) return '';

  const lines = normalized.split('\n');
  const beginIndex = lines.findIndex(isArmorBegin);
  if (beginIndex === -1) return normalized;

  const endIndex = lines.findIndex((l, idx) => idx > beginIndex && isArmorEnd(l));
  if (endIndex === -1) return normalized;

  const head = lines.slice(0, beginIndex + 1);
  const tail = lines.slice(endIndex);

  const middle = lines.slice(beginIndex + 1, endIndex);
  const headerLines: string[] = [];
  let i = 0;
  for (; i < middle.length; i++) {
    const line = middle[i];
    if (line.trim() === '') {
      i++;
      break;
    }
    headerLines.push(line.trimEnd());
  }

  const bodyLines = middle.slice(i);

  let checksumLine: string | null = null;
  const dataChunks: string[] = [];
  for (const line of bodyLines) {
    if (!line.trim()) continue;
    const trimmed = line.trim();
    if (trimmed.startsWith('=')) {
      checksumLine = trimmed.replace(/\s+/g, '');
      continue;
    }
    // OCR tends to insert spaces; remove all whitespace in base64 region.
    dataChunks.push(trimmed.replace(/\s+/g, ''));
  }

  const data = dataChunks.join('');
  const wrapped: string[] = [];
  for (let pos = 0; pos < data.length; pos += columns) {
    wrapped.push(data.slice(pos, pos + columns));
  }

  const out: string[] = [];
  out.push(...head);
  out.push(...headerLines);
  out.push('');
  out.push(...wrapped);
  if (checksumLine) out.push(checksumLine);
  out.push(...tail);

  return out.join('\n');
}

