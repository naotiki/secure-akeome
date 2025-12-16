function isArmorBegin(line: string) {
  return line.startsWith('-----BEGIN ') && line.endsWith('-----');
}

function isArmorEnd(line: string) {
  return line.startsWith('-----END ') && line.endsWith('-----');
}

export function rewrapArmoredMessage(armored: string, columns: number): string {
  const normalized = armored.replace(/\r\n/g, '\n').trimEnd();
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
    headerLines.push(line);
  }

  const bodyLines = middle.slice(i);

  // Extract checksum line if present (starts with "=").
  let checksumLine: string | null = null;
  const dataLines: string[] = [];
  for (const line of bodyLines) {
    if (line.startsWith('=')) {
      checksumLine = line;
      continue;
    }
    if (!line.trim()) continue;
    dataLines.push(line.trim());
  }

  const data = dataLines.join('');
  const wrapped: string[] = [];
  for (let pos = 0; pos < data.length; pos += columns) {
    wrapped.push(data.slice(pos, pos + columns));
  }

  const out: string[] = [];
  out.push(...head);
  out.push(...headerLines);
  out.push(''); // blank line
  out.push(...wrapped);
  if (checksumLine) out.push(checksumLine);
  out.push(...tail);

  return out.join('\n');
}

