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

  return (
    <div className="whitespace-pre-wrap break-words font-mono text-sm text-foreground rounded-xl border bg-white p-3">
      {blocks.map((b) => {
        const chunk = text.slice(b.start, b.end);
        const isMismatch = mismatchIndices.has(b.index);
        const segments = segmentAmbiguous(chunk);
        return (
          <span
            key={b.index}
            className={isMismatch ? 'bg-red-100/70' : undefined}
            data-block={b.index}
          >
            {segments.map((s, idx) =>
              s.kind === 'ambiguous' ? (
                <span key={idx} className="bg-yellow-200/80">
                  {s.text}
                </span>
              ) : (
                <span key={idx}>{s.text}</span>
              ),
            )}
          </span>
        );
      })}
    </div>
  );
}

