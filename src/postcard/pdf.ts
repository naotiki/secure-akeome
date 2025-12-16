import { PDFDocument } from 'pdf-lib';
import { POSTCARD_MM, POSTCARD_PX } from './render';

function mmToPoints(mm: number) {
  return (mm * 72) / 25.4;
}

function dataUrlToUint8Array(dataUrl: string) {
  const [, base64] = dataUrl.split(',', 2);
  const bin = atob(base64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
}

async function svgToPngDataUrl(svg: string, widthPx: number, heightPx: number) {
  const blob = new Blob([svg], { type: 'image/svg+xml;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  try {
    const image = new Image();
    image.decoding = 'async';
    const loaded = new Promise<void>((resolve, reject) => {
      image.onload = () => resolve();
      image.onerror = () => reject(new Error('SVGの描画に失敗しました'));
    });
    image.src = url;
    await loaded;

    const canvas = document.createElement('canvas');
    canvas.width = widthPx;
    canvas.height = heightPx;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Canvas context を取得できません');
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, widthPx, heightPx);
    ctx.drawImage(image, 0, 0, widthPx, heightPx);
    return canvas.toDataURL('image/png');
  } finally {
    URL.revokeObjectURL(url);
  }
}

export async function svgsToPdfBytes(svgs: string[]): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();

  for (const svg of svgs) {
    const pngUrl = await svgToPngDataUrl(svg, POSTCARD_PX.width, POSTCARD_PX.height);
    const pngBytes = dataUrlToUint8Array(pngUrl);
    const png = await pdf.embedPng(pngBytes);

    const pageWidth = mmToPoints(POSTCARD_MM.width);
    const pageHeight = mmToPoints(POSTCARD_MM.height);
    const page = pdf.addPage([pageWidth, pageHeight]);
    page.drawImage(png, { x: 0, y: 0, width: pageWidth, height: pageHeight });
  }

  const bytes = await pdf.save();
  return bytes;
}
