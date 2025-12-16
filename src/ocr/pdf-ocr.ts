export type PdfOcrOptions = {
  scale?: number;
  pageLimit?: number;
};

async function renderPdfToCanvases(file: File, options: PdfOcrOptions = {}) {
  const { scale = 2, pageLimit = 20 } = options;

  const pdfjs = await import('pdfjs-dist');
  // Vite: resolve worker as URL and set pdf.js workerSrc.
  const workerUrl = (await import('pdfjs-dist/build/pdf.worker.min.mjs?url')).default as string;
  (pdfjs as any).GlobalWorkerOptions.workerSrc = workerUrl;

  const bytes = new Uint8Array(await file.arrayBuffer());
  const loadingTask = (pdfjs as any).getDocument({ data: bytes });
  const pdf = await loadingTask.promise;

  const total = Math.min(pdf.numPages, pageLimit);
  const canvases: HTMLCanvasElement[] = [];

  for (let pageNo = 1; pageNo <= total; pageNo++) {
    const page = await pdf.getPage(pageNo);
    const viewport = page.getViewport({ scale });
    const canvas = document.createElement('canvas');
    canvas.width = Math.ceil(viewport.width);
    canvas.height = Math.ceil(viewport.height);
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Canvas context を取得できません');

    // White background improves OCR.
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    await page.render({ canvasContext: ctx, viewport }).promise;
    canvases.push(canvas);
  }

  return canvases;
}

async function canvasToBlob(canvas: HTMLCanvasElement): Promise<Blob> {
  return await new Promise((resolve, reject) => {
    canvas.toBlob(
      (b) => (b ? resolve(b) : reject(new Error('canvas.toBlob failed'))),
      'image/png',
      1,
    );
  });
}

export async function ocrPdfToText(
  file: File,
  options: PdfOcrOptions & { onProgress?: (p: { page: number; total: number }) => void } = {},
): Promise<string> {
  const canvases = await renderPdfToCanvases(file, options);
  const total = canvases.length;

  const { recognizePgpText } = await import('@/ocr/tesseract-pgp');

  const texts: string[] = [];
  for (let i = 0; i < canvases.length; i++) {
    options.onProgress?.({ page: i + 1, total });
    const blob = await canvasToBlob(canvases[i]);
    const text = await recognizePgpText(blob);
    texts.push(text);
  }

  return texts.join('\n\n');
}
