import type { ReactNode } from 'react';
import type { ChecksumBlock } from '@/types';

const AMBIGUOUS = new Set(['0', 'O', 'o', '1', 'I', 'l', 'S', 's', '5', 'B', 'b', '8']);

type Segment = { text: string; kind: 'normal' | 'ambiguous' };

function segmentAmbiguous(text: string): Segment[] {
  const segments: Segment[] = [];
  let buf = '';
  let bufKind: Segment['kind'] = 'normal';

  const flush = () => {
    if (!buf) return;
    segments.push({ text: buf, kind: bufKind });
    buf = '';
  };

  for (const ch of text) {
    const kind: Segment['kind'] = AMBIGUOUS.has(ch) ? 'ambiguous' : 'normal';
    if (kind !== bufKind) {
      flush();
      bufKind = kind;
    }
    buf += ch;
  }
  flush();
  return segments;
}

export function HighlightedArmoredText(props: {
  text: string;
  blocks: ChecksumBlock[];
  mismatchIndices: Set<number>;
}) {
  const { text, blocks, mismatchIndices } = props;
  if (!text) return null;

  if (!blocks.length) {
    return (
      <div className="whitespace-pre-wrap break-words font-mono text-sm text-foreground rounded-xl border bg-white p-3">
        {text}
      </div>
    );
  }

  const sorted = [...blocks].sort((a, b) => a.start - b.start);

  return (
    <div className="whitespace-pre-wrap break-words font-mono text-sm text-foreground rounded-xl border bg-white p-3">
      {(() => {
        const out: ReactNode[] = [];
        let cursor = 0;

        for (const b of sorted) {
          const start = Math.max(0, Math.min(text.length, b.start));
          const end = Math.max(start, Math.min(text.length, b.end));

          if (cursor < start) {
            out.push(<span key={`gap-${cursor}`}>{text.slice(cursor, start)}</span>);
          }

          const chunk = text.slice(start, end);
          const isMismatch = mismatchIndices.has(b.index);
          const segments = segmentAmbiguous(chunk);
          const blockClass = isMismatch
            ? 'bg-red-100/80 outline outline-1 outline-red-200 outline-offset-[-1px]'
            : 'bg-emerald-100/70 outline outline-1 outline-emerald-200 outline-offset-[-1px]';
          out.push(
            <span key={`block-${b.index}`} className={`box-decoration-clone rounded-[3px] ${blockClass}`} data-block={b.index}>
              {segments.map((s, idx) =>
                s.kind === 'ambiguous' ? (
                  <span key={idx} className="bg-yellow-200/80">
                    {s.text}
                  </span>
                ) : (
                  <span key={idx}>{s.text}</span>
                ),
              )}
            </span>,
          );
          cursor = end;
        }

        if (cursor < text.length) {
          out.push(<span key={`gap-${cursor}`}>{text.slice(cursor)}</span>);
        }
        return out;
      })()}
    </div>
  );
}
