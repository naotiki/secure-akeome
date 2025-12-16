export type ExpectedChecksum = { index: number; checksum: string };

export function parseExpectedChecksums(input: string): ExpectedChecksum[] {
  // Accept QR payload form: SC4:<codeChars>:<codes...> (codes are base32, concatenated).
  // (Versioned prefix so we can evolve formats without breaking manual input.)
  const upper = input.toUpperCase();
  const sc4 = upper.match(/SC4:(\d+):([A-Z2-7]+)/);
  if (sc4?.[1] && sc4?.[2]) {
    const codeChars = Number(sc4[1]);
    if (Number.isFinite(codeChars) && codeChars > 0) {
      const blob = sc4[2].trim();
      const count = Math.floor(blob.length / codeChars);
      const out: ExpectedChecksum[] = [];
      for (let i = 0; i < count; i++) {
        const checksum = blob.slice(i * codeChars, (i + 1) * codeChars);
        if (checksum.length === codeChars) out.push({ index: i + 1, checksum });
      }
      return out;
    }
  }

  // Legacy: SC2:ABCD-EFGH-IJKL-MNOP
  const sc2 = upper.match(/SC2:([A-Z0-9]{2,}(?:[-_.][A-Z0-9]{2,}){0,4095})/);
  if (sc2?.[1]) {
    const codes = sc2[1]
      .split(/[-_.]/g)
      .map((s) => s.trim())
      .filter(Boolean);
    return codes.map((checksum, i) => ({ index: i + 1, checksum }));
  }
  return [];
}
