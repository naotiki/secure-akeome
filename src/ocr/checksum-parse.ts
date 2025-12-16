export type ExpectedChecksum = { index: number; checksum: string };

export function parseExpectedChecksums(input: string): ExpectedChecksum[] {
  const lines = input
    .replace(/\r\n/g, '\n')
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean);

  const out: ExpectedChecksum[] = [];
  for (const line of lines) {
    // Accept: [1] ABCD, 1 ABCD, 1:ABCD, [12] 91F3 ...
    const m = line.match(/^\[?\s*(\d+)\s*\]?\s*[:\-]?\s*([A-Za-z0-9]{2,})\s*$/);
    if (!m) continue;
    const index = Number(m[1]);
    if (!Number.isFinite(index) || index <= 0) continue;
    out.push({ index, checksum: m[2].toUpperCase() });
  }

  // de-dupe by index (last wins)
  const map = new Map<number, string>();
  for (const item of out) map.set(item.index, item.checksum);
  return Array.from(map.entries())
    .sort((a, b) => a[0] - b[0])
    .map(([index, checksum]) => ({ index, checksum }));
}

