import QRCode from 'qrcode';
import type { ChecksumBlock } from '@/types';

export function encodeChecksumQrPayload(checksums: ChecksumBlock[]): string | null {
  if (!checksums.length) return null;
  const sorted = [...checksums]
    .sort((a, b) => a.index - b.index)
    .map((c) => c.checksum.trim().toUpperCase());

  const codeChars = sorted[0]?.length ?? 0;
  if (codeChars <= 0) return null;
  for (const c of sorted) {
    if (c.length !== codeChars) throw new Error('checksum codes have different lengths');
  }

  // Compact payload:
  // SC4:<codeChars>:<codes...>  (no separators; split by fixed width)
  return `SC4:${codeChars}:${sorted.join('')}`;
}

const qrCache = new Map<string, string>();

export async function checksumQrDataUrl(checksums: ChecksumBlock[], sizePx: number): Promise<string | null> {
  const payload = encodeChecksumQrPayload(checksums);
  if (!payload) return null;
  const cacheKey = `${sizePx}:${payload}`;
  const cached = qrCache.get(cacheKey);
  if (cached) return cached;

  const dataUrl = await QRCode.toDataURL(payload, {
    errorCorrectionLevel: 'M',
    margin: 1,
    width: sizePx,
    type: 'image/png',
  });
  qrCache.set(cacheKey, dataUrl);
  return dataUrl;
}
