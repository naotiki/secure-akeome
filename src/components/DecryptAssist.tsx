import { useMemo, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { normalizeOcrArmored } from '@/ocr/normalize';
import { parseExpectedChecksums } from '@/ocr/checksum-parse';
import { computeChecksums } from '@/crypto/checksum';
import { HighlightedArmoredText } from '@/ocr/highlight';
import { ARMOR_WRAP_COLUMNS } from '@/postcard/constants';
import { ocrPdfToText } from '@/ocr/pdf-ocr';
import { recognizePgpText } from '@/ocr/tesseract-pgp';

function downloadText(filename: string, content: string) {
  const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

async function copyToClipboard(text: string) {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(text);
    return;
  }
  const textarea = document.createElement('textarea');
  textarea.value = text;
  textarea.style.position = 'fixed';
  textarea.style.opacity = '0';
  document.body.appendChild(textarea);
  textarea.focus();
  textarea.select();
  document.execCommand('copy');
  document.body.removeChild(textarea);
}

export function DecryptAssist() {
  const [rawText, setRawText] = useState('');
  const [expectedText, setExpectedText] = useState('');
  const [busy, setBusy] = useState(false);
  const [ocrProgress, setOcrProgress] = useState<number | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [pdfName, setPdfName] = useState<string | null>(null);
  const [pdfProgress, setPdfProgress] = useState<{ page: number; total: number } | null>(null);

  const normalizedText = useMemo(() => normalizeOcrArmored(rawText, ARMOR_WRAP_COLUMNS), [rawText]);
  const expected = useMemo(() => parseExpectedChecksums(expectedText), [expectedText]);

  const [computedState, setComputedState] = useState<{
    text: string;
    checksums: Awaited<ReturnType<typeof computeChecksums>>;
    mismatchIndices: Set<number>;
    fullMatch: boolean;
    summary: string;
  } | null>(null);

  const recompute = async () => {
    setStatus(null);
    setError(null);
    setComputedState(null);

    const text = normalizedText;
    if (!text.trim()) {
      setError('PGPメッセージ（OCR結果 or 貼り付け）を入力してください');
      return;
    }

    setBusy(true);
    try {
      const checksums = await computeChecksums(text, 256, 4);
      const computedMap = new Map(checksums.map((c) => [c.index, c.checksum]));
      const mismatches = new Set<number>();

      for (const e of expected) {
        const got = computedMap.get(e.index);
        if (!got || got !== e.checksum) mismatches.add(e.index);
      }

      const fullMatch = expected.length > 0 && expected.length === checksums.length && mismatches.size === 0;
      const summary =
        expected.length === 0
          ? `チェックサムを計算しました（${checksums.length} blocks）`
          : fullMatch
            ? 'チェックサム一致（復号OK）'
            : mismatches.size === 0
              ? `入力したチェックサムは一致（${expected.length}/${checksums.length} blocks）`
              : `不一致: ${Array.from(mismatches).slice(0, 20).join(', ')}${mismatches.size > 20 ? '…' : ''}`;

      setComputedState({ text, checksums, mismatchIndices: mismatches, fullMatch, summary });
      setStatus(summary);
    } catch (err) {
      setError((err as Error).message ?? 'チェックサム計算に失敗しました');
    } finally {
      setBusy(false);
    }
  };

  const runOcr = async (file: File) => {
    setBusy(true);
    setStatus('OCR準備中…');
    setError(null);
    setOcrProgress(0);
    try {
      const text = await recognizePgpText(file, {
        logger: (m) => {
          if (m && typeof m.progress === 'number') {
            setOcrProgress(Math.round(m.progress * 100));
          }
        },
      });
      setRawText(text);
      setStatus('OCR完了（必要なら正規化/手修正してください）');
    } catch (err) {
      setError((err as Error).message ?? 'OCRに失敗しました');
    } finally {
      setBusy(false);
      setOcrProgress(null);
    }
  };

  const runPdfOcr = async (file: File) => {
    setBusy(true);
    setStatus('PDF OCR準備中…');
    setError(null);
    setPdfProgress({ page: 0, total: 0 });
    try {
      const text = await ocrPdfToText(file, {
        scale: 2,
        pageLimit: 20,
        onProgress: (p) => setPdfProgress(p),
      });
      setRawText(text);
      setStatus('PDF OCR完了（必要なら正規化/手修正してください）');
    } catch (err) {
      setError((err as Error).message ?? 'PDF OCRに失敗しました');
    } finally {
      setBusy(false);
      setPdfProgress(null);
    }
  };

  const onPickImage = async (file: File | null) => {
    if (!file) return;
    if (imageUrl) URL.revokeObjectURL(imageUrl);
    const url = URL.createObjectURL(file);
    setImageUrl(url);
    setPdfName(null);
    await runOcr(file);
  };

  const onPickPdf = async (file: File | null) => {
    if (!file) return;
    if (imageUrl) {
      URL.revokeObjectURL(imageUrl);
      setImageUrl(null);
    }
    setPdfName(file.name);
    await runPdfOcr(file);
  };

  const gpgCommand = 'gpg --decrypt message.asc';

  return (
    <Card className="section-card border border-slate-200">
      <CardHeader>
        <CardTitle>復号支援</CardTitle>
        <CardDescription>OCR結果を正規化し、チェックサム照合・手修正のガイドをします（復号は外部gpg）。</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="grid gap-6 lg:grid-cols-2">
          <div className="space-y-4">
            <div className="space-y-2">
              <div className="flex items-center justify-between gap-2">
                <div className="text-sm font-semibold text-foreground">画像/PDFからOCR（任意）</div>
                {ocrProgress !== null && <Badge variant="secondary">OCR {ocrProgress}%</Badge>}
                {pdfProgress && (
                  <Badge variant="secondary">
                    PDF {pdfProgress.page}/{pdfProgress.total}
                  </Badge>
                )}
              </div>
              <div className="grid gap-2 sm:grid-cols-2">
                <Input
                  type="file"
                  accept="image/png,image/jpeg"
                  onChange={(e) => onPickImage(e.target.files?.[0] ?? null)}
                  disabled={busy}
                />
                <Input
                  type="file"
                  accept="application/pdf"
                  onChange={(e) => onPickPdf(e.target.files?.[0] ?? null)}
                  disabled={busy}
                />
              </div>
              {imageUrl && (
                <img
                  src={imageUrl}
                  alt="OCR source"
                  className="w-full rounded-xl border bg-white"
                  style={{ maxHeight: 240, objectFit: 'contain' }}
                />
              )}
              {pdfName && <div className="text-xs text-muted-foreground">PDF: {pdfName}（最大20ページまでOCR）</div>}
            </div>

            <div className="space-y-2">
              <div className="text-sm font-semibold text-foreground">PGPメッセージ（OCR結果 or 貼り付け）</div>
              <Textarea value={rawText} onChange={(e) => setRawText(e.target.value)} className="font-mono min-h-[220px]" />
              <div className="text-xs text-muted-foreground">
                正規化: `BEGIN/END` を探して base64 部分の空白を除去し、{ARMOR_WRAP_COLUMNS}文字幅で再wrapします。
              </div>
            </div>
          </div>

          <div className="space-y-4">
            <div className="space-y-2">
              <div className="flex items-center justify-between gap-2">
                <div className="text-sm font-semibold text-foreground">印字されたチェックサム</div>
                <Button variant="outline" size="sm" onClick={() => setExpectedText('')} disabled={busy}>
                  クリア
                </Button>
              </div>
              <Textarea
                value={expectedText}
                onChange={(e) => setExpectedText(e.target.value)}
                placeholder={`例:\n[1] ABCD\n[2] 91F3\n[3] 7E0B`}
                className="font-mono min-h-[160px]"
              />
              <div className="text-xs text-muted-foreground">入力形式: `[index] CODE`（コードは大文字小文字どちらでもOK）</div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <Button onClick={recompute} disabled={busy}>
                {busy ? '処理中…' : '正規化 + チェックサム照合'}
              </Button>
              {status && <Badge variant="success">{status}</Badge>}
              {error && <Badge variant="destructive">{error}</Badge>}
            </div>

            <div className="space-y-2">
              <div className="text-sm font-semibold text-foreground">プレビュー（黄: 誤読しやすい / 赤: チェックサム不一致）</div>
              <HighlightedArmoredText
                text={computedState?.text ?? normalizedText}
                blocks={computedState?.checksums ?? []}
                mismatchIndices={computedState?.mismatchIndices ?? new Set<number>()}
              />
            </div>

            <div className="rounded-xl border bg-card p-4 space-y-2">
              <div className="text-sm font-semibold text-foreground">復号コマンド</div>
              <div className="text-xs text-muted-foreground">
                {computedState?.fullMatch
                  ? 'チェックサムが全ブロック一致しました。外部gpgで復号してください。'
                  : 'チェックサムが全ブロック一致するまで、赤い領域（ブロック）を中心に修正してください。'}
              </div>
              <div className="rounded-lg border bg-white px-3 py-2 font-mono text-sm">{gpgCommand}</div>
              <div className="flex flex-wrap items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => copyToClipboard(gpgCommand).then(() => setStatus('コマンドをコピーしました'))}
                >
                  コピー
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    const text = computedState?.text ?? normalizedText;
                    if (text.trim()) downloadText('message.asc', text);
                  }}
                  disabled={!(computedState?.text ?? normalizedText).trim()}
                >
                  message.asc 保存
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() =>
                    copyToClipboard((computedState?.text ?? normalizedText) || '').then(() => setStatus('暗号文をコピーしました'))
                  }
                  disabled={!(computedState?.text ?? normalizedText).trim()}
                >
                  暗号文コピー
                </Button>
              </div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
