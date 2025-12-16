import satori from 'satori';
import type { ChecksumBlock } from '@/types';
import { loadSatoriFonts } from './fonts';
import { ARMOR_WRAP_COLUMNS, CHECKSUM_QR_SIZE_PX, POSTCARD_TEXT_SCALE } from './constants';
import { checksumQrDataUrl } from './checksum-qr';

export type PostcardRenderParams = {
  senderFingerprint: string;
  recipientFingerprint: string;
  pageText: string;
  pageIndex: number; // 1-based
  pageCount: number;
  checksums: ChecksumBlock[];
  checksumQrDataUrl?: string;
};

// Landscape postcard (more width improves OCR reliability for armored blocks).
export const POSTCARD_PX = { width: 1480, height: 1000 };
export const POSTCARD_MM = { width: 148, height: 100 };

function formatFingerprint(fp: string) {
  const compact = fp.replace(/\s+/g, '').toUpperCase();
  if (!compact) return '—';
  return compact.length > 40 ? compact.slice(0, 40) : compact;
}

function wrapLine(line: string, columns: number) {
  if (line.length <= columns) return [line];
  const out: string[] = [];
  for (let i = 0; i < line.length; i += columns) out.push(line.slice(i, i + columns));
  return out;
}

function patchSvgForPrint(svg: string) {
  const { width, height } = POSTCARD_PX;
  const mmW = `${POSTCARD_MM.width}mm`;
  const mmH = `${POSTCARD_MM.height}mm`;

  // Replace the first width/height attributes and inject viewBox when absent.
  let out = svg.replace(`width=\"${width}\"`, `width=\"${mmW}\"`);
  out = out.replace(`height=\"${height}\"`, `height=\"${mmH}\"`);
  if (!out.includes('viewBox=')) {
    out = out.replace('<svg', `<svg viewBox=\"0 0 ${width} ${height}\"`);
  }
  return out;
}

function Template(props: PostcardRenderParams) {
  const px = (value: number) => Math.round(value * POSTCARD_TEXT_SCALE);

  const rawLines = props.pageText.replace(/\r\n/g, '\n').split('\n');
  const messageLines = rawLines.flatMap((l) => wrapLine(l, ARMOR_WRAP_COLUMNS));
  const messageFont = 'OCR Mono, JetBrains Mono';

  return (
    <div
      style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        backgroundColor: '#ffffff',
        padding: 18,
        boxSizing: 'border-box',
        fontFamily: 'JetBrains Mono',
        gap: 14,
      }}
    >
      {/* Row 1: PGP message (80%) + checksums (20%) */}
      <div style={{ display: 'flex', flexDirection: 'row', flex: 1, gap: 14, minHeight: 0 }}>
        <div style={{ display: 'flex', flexDirection: 'column', flexGrow: 4, flexBasis: 0, minWidth: 0, gap: 8 }}>
          <div
            style={{
              flex: 1,
              border: '1px solid #e2e8f0',
              borderRadius: 16,
              padding: 14,
              backgroundColor: '#ffffff',
              boxSizing: 'border-box',
              display: 'flex',
              flexDirection: 'column',
              gap: 0,
              minHeight: 0,
            }}
          >
            {messageLines.map((line, idx) => (
              <div key={idx} style={{ display: 'flex' }}>
                <span style={{ fontSize: px(14), lineHeight: 1.1, color: '#0f172a', fontFamily: messageFont }}>
                  {line === '' ? '\u00A0' : line}
                </span>
              </div>
            ))}
          </div>
        </div>

      </div>

      {/* Row 2: FROM/TO + page num + QR */}
      <div
        style={{
          display: 'flex',
          flexDirection: 'row',
          alignItems: 'flex-end',
          justifyContent: 'space-between',
          gap: 14,
          border: '1px solid #e2e8f0',
          borderRadius: 16,
          padding: 12,
          boxSizing: 'border-box',
        }}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, fontSize: px(12), color: '#0f172a' }}>
            <div style={{ display: 'flex', gap: 6, minWidth: 0 }}>
              <span style={{ color: '#64748b' }}>FROM:</span>
              <span style={{ color: '#0284c7' }}>{formatFingerprint(props.senderFingerprint)}</span>
            </div>
            <div style={{ display: 'flex', gap: 6, minWidth: 0 }}>
              <span style={{ color: '#64748b' }}>TO:</span>
              <span style={{ color: '#0284c7' }}>{formatFingerprint(props.recipientFingerprint)}</span>
            </div>
          </div>
        </div>
        <div
          style={{
            display: 'flex',
            gap: 6,
            fontSize: px(10),
            color: '#0f172a',
            backgroundColor: '#e0f2fe',
            padding: '6px 10px',
            borderRadius: 999,
            border: '1px solid #bae6fd',
          }}
        >
          <span>
            PAGE {props.pageIndex} / {props.pageCount}
          </span>
        </div>
        {props.checksumQrDataUrl ? (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 6 }}>
            <div style={{ display: 'flex', gap: 6, fontSize: px(10), color: '#64748b' }}>
              <span>CHECKSUM QR</span>
            </div>
            <img
              src={props.checksumQrDataUrl}
              width={300}
              height={300}
              style={{
                width: "150px",
                height: "150px",
                borderRadius: 8,
                border: '1px solid #e2e8f0',
                backgroundColor: '#ffffff',
              }}
            />
          </div>
        ) : null}
      </div>
    </div>
  );
}

export async function renderPostcardSvg(params: PostcardRenderParams): Promise<string> {
  const fonts = await loadSatoriFonts();
  const qr = params.checksumQrDataUrl ?? (await checksumQrDataUrl(params.checksums, CHECKSUM_QR_SIZE_PX)) ?? undefined;
  const svg = await satori(<Template {...params} checksumQrDataUrl={qr} />, {
    width: POSTCARD_PX.width,
    height: POSTCARD_PX.height,
    fonts,
  });
  return patchSvgForPrint(svg);
}
