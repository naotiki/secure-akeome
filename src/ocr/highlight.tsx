import type { ReactNode } from 'react';
import type { ChecksumBlock } from '@/types';

export const DEFAULT_AMBIGUOUS_CHARS = '0Oo1IlSs5Bb8';

function ambiguousSetFromChars(chars: string | Set<string> | undefined) {
  if (!chars) return new Set<string>();
  if (chars instanceof Set) return chars;
  const set = new Set<string>();
  for (const ch of chars) {
    if (/\s/.test(ch)) continue;
    set.add(ch);
  }
  return set;
}

type Segment = { text: string; kind: 'normal' | 'ambiguous' };

function segmentAmbiguous(text: string, ambiguous: Set<string>): Segment[] {
  const segments: Segment[] = [];
  let buf = '';
  let bufKind: Segment['kind'] = 'normal';

  const flush = () => {
    if (!buf) return;
    segments.push({ text: buf, kind: bufKind });
    buf = '';
  };

  for (const ch of text) {
    const kind: Segment['kind'] = ambiguous.has(ch) ? 'ambiguous' : 'normal';
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
  ambiguousChars?: string | Set<string>;
}) {
  const { text, blocks, mismatchIndices } = props;
  const ambiguous = ambiguousSetFromChars(props.ambiguousChars ?? DEFAULT_AMBIGUOUS_CHARS);
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
          const segments = segmentAmbiguous(chunk, ambiguous);
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
