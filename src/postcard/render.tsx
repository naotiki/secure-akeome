import satori from 'satori';
import type { ChecksumBlock } from '@/types';
import { loadSatoriFonts } from './fonts';
import { ARMOR_WRAP_COLUMNS, CHECKSUM_BLOCKS_PER_PAGE, POSTCARD_TEXT_SCALE } from './constants';

export type PostcardRenderParams = {
  senderFingerprint: string;
  recipientFingerprint: string;
  pageText: string;
  pageIndex: number; // 1-based
  pageCount: number;
  checksums: ChecksumBlock[];
};

// Landscape postcard (more width improves OCR reliability for armored blocks).
export const POSTCARD_PX = { width: 1480, height: 1000 };
export const POSTCARD_MM = { width: 148, height: 100 };

function formatFingerprint(fp: string) {
  const compact = fp.replace(/\s+/g, '').toUpperCase();
  if (!compact) return '—';
  return compact.length > 40 ? compact.slice(0, 40) : compact;
}

function checksumLines(blocks: ChecksumBlock[]) {
  return blocks.map((b) => `[${b.index}] ${b.checksum}`);
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
  const start = (props.pageIndex - 1) * CHECKSUM_BLOCKS_PER_PAGE;
  const end = start + CHECKSUM_BLOCKS_PER_PAGE;
  const checks = checksumLines(props.checksums.slice(start, end));
  const left = checks.slice(0, Math.ceil(checks.length / 2)).join('\n');
  const right = checks.slice(Math.ceil(checks.length / 2)).join('\n');
  const remaining = Math.max(0, props.checksums.length - end);

  const rawLines = props.pageText.replace(/\r\n/g, '\n').split('\n');
  const messageLines = rawLines.flatMap((l) => wrapLine(l, ARMOR_WRAP_COLUMNS));
  const messageFont = 'OCR Mono, JetBrains Mono';

  return (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'row',
          backgroundColor: '#ffffff',
          padding: 18,
          boxSizing: 'border-box',
          fontFamily: 'JetBrains Mono',
          gap: 16,
        }}
      >
      <div style={{ display: 'flex', flexDirection: 'column', flex: 1, gap: 12 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
            <div style={{ display: 'flex', gap: 6, fontSize: px(12), color: '#64748b' }}>
              <span>PGP MESSAGE (ASCII armored)</span>
            </div>
          </div>
          <div
            style={{
              display: 'flex',
              gap: 6,
              fontSize: px(12),
              color: '#0f172a',
              backgroundColor: '#e0f2fe',
              padding: '6px 10px',
              borderRadius: 999,
              border: '1px solid #bae6fd',
            }}
          >
            <span>PAGE</span>
            <span>
              {props.pageIndex} / {props.pageCount}
            </span>
          </div>
        </div>

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

      <div style={{ display: 'flex', flexDirection: 'column', width: 420, gap: 12 }}>
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: 10,
            border: '1px solid #e2e8f0',
            borderRadius: 16,
            padding: 14,
            boxSizing: 'border-box',
          }}
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
              <div style={{ display: 'flex', gap: 6, fontSize: px(12), color: '#334155' }}>
                <span>RECIPIENT FP</span>
              </div>
              <div style={{ display: 'flex', gap: 6, fontSize: px(16), color: '#0284c7' }}>
                <span>{formatFingerprint(props.recipientFingerprint)}</span>
              </div>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
              <div style={{ display: 'flex', gap: 6, fontSize: px(12), color: '#334155' }}>
                <span>SENDER FP</span>
              </div>
              <div style={{ display: 'flex', gap: 6, fontSize: px(16), color: '#0284c7' }}>
                <span>{formatFingerprint(props.senderFingerprint)}</span>
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ display: 'flex', gap: 6, fontSize: px(12), color: '#0f172a' }}>
                <span>CHECKSUM</span>
              </div>
              <div style={{ display: 'flex', gap: 6, fontSize: px(10), color: '#64748b' }}>
                <span>
                  {start + 1}..{Math.min(end, props.checksums.length)}
                </span>
                <span>/</span>
                <span>{props.checksums.length}</span>
              </div>
            </div>
            <div style={{ display: 'flex', gap: 12 }}>
              <pre
                style={{
                  margin: 0,
                  flex: 1,
                  fontFamily: 'JetBrains Mono',
                  fontSize: px(14),
                  lineHeight: 1.2,
                  color: '#334155',
                  whiteSpace: 'pre-wrap',
                }}
              >
                {left}
              </pre>
              <pre
                style={{
                  margin: 0,
                  flex: 1,
                  fontFamily: 'JetBrains Mono',
                  fontSize: px(14),
                  lineHeight: 1.2,
                  color: '#334155',
                  whiteSpace: 'pre-wrap',
                }}
              >
                {right}
              </pre>
            </div>
            {remaining > 0 && (
              <div style={{ display: 'flex', gap: 6, fontSize: px(10), color: '#64748b' }}>
                <span>次ページに続きます</span>
              </div>
            )}
          </div>
        </div>

        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: 4,
            border: '1px solid #e2e8f0',
            borderRadius: 16,
            padding: 12,
          }}
        >
        </div>
      </div>
    </div>
  );
}

export async function renderPostcardSvg(params: PostcardRenderParams): Promise<string> {
  const fonts = await loadSatoriFonts();
  const svg = await satori(<Template {...params} />, {
    width: POSTCARD_PX.width,
    height: POSTCARD_PX.height,
    fonts,
  });
  return patchSvgForPrint(svg);
}
