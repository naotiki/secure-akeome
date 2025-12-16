type SatoriFont = {
  name: string;
  data: ArrayBuffer;
  weight?: 100 | 200 | 300 | 400 | 500 | 600 | 700 | 800 | 900;
  style?: 'normal' | 'italic';
};

let fontPromise: Promise<SatoriFont[]> | null = null;

async function fetchFont(url: string) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`フォント読み込みに失敗しました: ${url}`);
  return await res.arrayBuffer();
}

async function tryFetchFont(url: string): Promise<ArrayBuffer | null> {
  const res = await fetch(url);
  if (!res.ok) return null;
  return await res.arrayBuffer();
}

export function loadSatoriFonts(): Promise<SatoriFont[]> {
  if (!fontPromise) {
    fontPromise = (async () => {
      // Satori expects TTF/OTF bytes. (woff/woff2 are not supported)
      const base = import.meta.env.BASE_URL;
      const [monoTtf, ocrTtf] = await Promise.all([
        fetchFont(`${base}fonts/JetBrainsMono-Regular.ttf`),
        tryFetchFont(`${base}fonts/OCRB.ttf`),
      ]);
      return [
        // NOTE: variable fonts often fail in Satori's font parser. Use a stable static TTF for now.
        { name: 'JetBrains Mono', data: monoTtf, weight: 400, style: 'normal' },
        ...(ocrTtf ? [{ name: 'OCR Mono', data: ocrTtf, weight: 400 as const, style: 'normal' as const }] : []),
      ];
    })();
  }
  return fontPromise;
}
