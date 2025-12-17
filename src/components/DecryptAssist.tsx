import { useEffect, useMemo, useRef, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { normalizeOcrArmored } from '@/ocr/normalize';
import { parseExpectedChecksums } from '@/ocr/checksum-parse';
import { computeChecksums } from '@/crypto/checksum';
import { DEFAULT_AMBIGUOUS_CHARS, HighlightedArmoredText } from '@/ocr/highlight';
import { ARMOR_WRAP_COLUMNS } from '@/postcard/constants';
import { ocrPdfToText } from '@/ocr/pdf-ocr';
import { recognizePgpText } from '@/ocr/tesseract-pgp';
import { Scanner, type IDetectedBarcode } from '@yudiel/react-qr-scanner';

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

function safeGetLocalStorage(key: string) {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function safeSetLocalStorage(key: string, value: string) {
  try {
    localStorage.setItem(key, value);
  } catch {
    // ignore
  }
}

function pickHeredocDelimiter(text: string) {
  const base = 'SECURE_AKEOME_PGP_MESSAGE';
  if (!text.includes(base)) return base;
  for (let i = 1; i < 1000; i++) {
    const next = `${base}_${i}`;
    if (!text.includes(next)) return next;
  }
  return `${base}_${crypto.randomUUID().replace(/-/g, '').slice(0, 8)}`;
}

function makeGpgDecryptCommand(armored: string) {
  const normalized = armored.replace(/\r\n/g, '\n').trimEnd();
  const delimiter = pickHeredocDelimiter(normalized);
  return [`cat <<'${delimiter}' | gpg --decrypt`, normalized, delimiter].join('\n');
}

export function DecryptAssist() {
  const [rawText, setRawText] = useState('');
  const [expectedText, setExpectedText] = useState('');
  const [ambiguousChars, setAmbiguousChars] = useState(() => safeGetLocalStorage('decryptAmbiguousChars') ?? DEFAULT_AMBIGUOUS_CHARS);
  const [qrScanOpen, setQrScanOpen] = useState(false);
  const [pgpCameraOpen, setPgpCameraOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [ocrProgress, setOcrProgress] = useState<number | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [pdfName, setPdfName] = useState<string | null>(null);
  const [pdfProgress, setPdfProgress] = useState<{ page: number; total: number } | null>(null);
  const pgpVideoRef = useRef<HTMLVideoElement | null>(null);
  const pgpStreamRef = useRef<MediaStream | null>(null);
  const imageUrlRef = useRef<string | null>(null);

  const normalizedText = useMemo(() => normalizeOcrArmored(rawText, ARMOR_WRAP_COLUMNS), [rawText]);
  const expected = useMemo(() => parseExpectedChecksums(expectedText), [expectedText]);
  const ambiguousCharsNormalized = useMemo(() => ambiguousChars.replace(/\s+/g, ''), [ambiguousChars]);

  useEffect(() => {
    safeSetLocalStorage('decryptAmbiguousChars', ambiguousCharsNormalized);
  }, [ambiguousCharsNormalized]);

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

    if (expected.length === 0) {
      setError('チェックサムQRの文字列（例: SC4:2:...）を入力してください');
      return;
    }

    setBusy(true);
    try {
      const checksums = await computeChecksums(text, { parts: 4, displayChars: 2 });
      const computedMap = new Map(checksums.map((c) => [c.index, c.checksum]));
      const mismatches = new Set<number>();

      for (const e of expected) {
        const got = computedMap.get(e.index);
        if (!got || got !== e.checksum) mismatches.add(e.index);
      }

      const countMismatch = expected.length !== checksums.length;
      if (countMismatch) {
        const expectedMap = new Map(expected.map((e) => [e.index, e.checksum]));
        const max = Math.max(expected.length, checksums.length);
        for (let i = 1; i <= max; i++) {
          const exp = expectedMap.get(i);
          const got = computedMap.get(i);
          if (!exp || !got || exp !== got) mismatches.add(i);
        }
      }
      const fullMatch = !countMismatch && mismatches.size === 0;
      const summary = countMismatch
        ? `チェックサム数が一致しません（QR:${expected.length} / 計算:${checksums.length}）`
        : fullMatch
          ? 'チェックサム一致（復号OK）'
          : mismatches.size === 0
            ? `チェックサムは一致（${expected.length}/${checksums.length} blocks）`
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

  const onQrScan = (result: IDetectedBarcode[]) => {
    const value = result[0]?.rawValue;
    console.log('QR scan result:', result, '->', value);
    if (!value) return;
    const trimmed = value.trim();
    if (!trimmed) return;

    setExpectedText(trimmed);
    setStatus('QRを読み取りました');
    setError(null);
    setQrScanOpen(false);
  };

  const onQrError = (err: unknown) => {
    const msg = err instanceof Error ? err.message : String(err);
    setError(`QRスキャンに失敗しました: ${msg}`);
  };

  const onPickImage = async (file: File | null) => {
    if (!file) return;
    if (imageUrlRef.current) URL.revokeObjectURL(imageUrlRef.current);
    const url = URL.createObjectURL(file);
    setImageUrl(url);
    imageUrlRef.current = url;
    setPdfName(null);
    await runOcr(file);
  };

  const onPickPdf = async (file: File | null) => {
    if (!file) return;
    if (imageUrlRef.current) {
      URL.revokeObjectURL(imageUrlRef.current);
      setImageUrl(null);
      imageUrlRef.current = null;
    }
    setPdfName(file.name);
    await runPdfOcr(file);
  };

  const onPickSource = async (file: File | null) => {
    if (!file) return;
    if (file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf')) {
      await onPickPdf(file);
      return;
    }
    if (file.type.startsWith('image/')) {
      await onPickImage(file);
      return;
    }
    setError(`未対応のファイル形式です: ${file.type || file.name}`);
  };

  useEffect(() => {
    return () => {
      if (imageUrlRef.current) URL.revokeObjectURL(imageUrlRef.current);
      pgpStreamRef.current?.getTracks().forEach((t) => t.stop());
      pgpStreamRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!pgpCameraOpen) {
      pgpStreamRef.current?.getTracks().forEach((t) => t.stop());
      pgpStreamRef.current = null;
      return;
    }

    let alive = true;
    (async () => {
      try {
        if (!navigator.mediaDevices?.getUserMedia) {
          throw new Error('このブラウザではカメラが利用できません');
        }
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: 'environment' } },
          audio: false,
        });
        if (!alive) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        pgpStreamRef.current = stream;
        if (pgpVideoRef.current) {
          pgpVideoRef.current.srcObject = stream;
          await pgpVideoRef.current.play();
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        setError(`カメラ起動に失敗しました: ${msg}`);
        setPgpCameraOpen(false);
      }
    })();

    return () => {
      alive = false;
      pgpStreamRef.current?.getTracks().forEach((t) => t.stop());
      pgpStreamRef.current = null;
    };
  }, [pgpCameraOpen]);

  const capturePgpFromCamera = async () => {
    const video = pgpVideoRef.current;
    if (!video) return;
    if (!video.videoWidth || !video.videoHeight) {
      setError('カメラ映像の準備ができていません');
      return;
    }

    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      setError('Canvasの初期化に失敗しました');
      return;
    }
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

    const blob = await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('画像生成に失敗しました'))), 'image/png');
    });
    const file = new File([blob], `pgp-camera-${Date.now()}.png`, { type: 'image/png' });
    setPgpCameraOpen(false);
    await onPickSource(file);
  };

  const decryptText = computedState?.text ?? normalizedText;
  const gpgCommand = decryptText.trim() ? makeGpgDecryptCommand(decryptText) : '';

  return (
    <Card className="section-card border border-slate-200">
      <CardHeader>
        <CardTitle>復号支援</CardTitle>
        <CardDescription>OCR結果を正規化し、チェックサム照合・手修正のガイドをします（復号は外部gpg）。</CardDescription>
      </CardHeader>
      <CardContent className="space-y-8">
        <div className="space-y-2">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="text-sm font-semibold text-foreground">入力（画像/PDFのOCR or 貼り付け）</div>
            <div className="flex items-center gap-2">
              {ocrProgress !== null && <Badge variant="secondary">OCR {ocrProgress}%</Badge>}
              {pdfProgress && (
                <Badge variant="secondary">
                  PDF {pdfProgress.page}/{pdfProgress.total}
                </Badge>
              )}
            </div>
          </div>

          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <Input
              type="file"
              accept="image/*,application/pdf"
              capture="environment"
              onChange={(e) => {
                const file = e.target.files?.[0] ?? null;
                e.target.value = '';
                void onPickSource(file);
              }}
              disabled={busy}
            />
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setQrScanOpen(false);
                setPgpCameraOpen((v) => !v);
              }}
              disabled={busy}
              className="shrink-0"
            >
              {pgpCameraOpen ? 'PGPカメラ停止' : 'PGPカメラで撮影'}
            </Button>
          </div>

          {pgpCameraOpen ? (
            <div className="rounded-xl border bg-white p-3 space-y-2">
              <video ref={pgpVideoRef} className="w-full rounded-lg bg-black" playsInline muted />
              <div className="flex flex-wrap items-center gap-2">
                <Button type="button" onClick={() => void capturePgpFromCamera()} disabled={busy}>
                  この画面を撮影してOCR
                </Button>
                <Button type="button" variant="outline" onClick={() => setPgpCameraOpen(false)} disabled={busy}>
                  閉じる
                </Button>
                <div className="text-xs text-muted-foreground">カメラは `https` または `localhost` でのみ動作します。</div>
              </div>
            </div>
          ) : null}

          {imageUrl && (
            <img
              src={imageUrl}
              alt="OCR source"
              className="w-full rounded-xl border bg-white"
              style={{ maxHeight: 260, objectFit: 'contain' }}
            />
          )}
          {pdfName && <div className="text-xs text-muted-foreground">PDF: {pdfName}（最大20ページまでOCR）</div>}
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between gap-2">
            <div className="text-sm font-semibold text-foreground">チェックサムQR（文字列）</div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setPgpCameraOpen(false);
                  setQrScanOpen((v) => !v);
                }}
                disabled={busy}
              >
                {qrScanOpen ? 'スキャン停止' : 'QRスキャン'}
              </Button>
              <Button variant="outline" size="sm" onClick={() => setExpectedText('')} disabled={busy}>
                クリア
              </Button>
            </div>
          </div>
          {qrScanOpen ? (
            <div className="rounded-xl border bg-white p-2">
              <Scanner onScan={onQrScan} onError={onQrError} constraints={{ facingMode: { ideal: 'environment' } }} />
              <div className="pt-2 text-xs text-muted-foreground">カメラは `https` または `localhost` でのみ動作します。</div>
            </div>
          ) : null}
          <Textarea
            value={expectedText}
            onChange={(e) => setExpectedText(e.target.value)}
            placeholder={`例:\nSC4:2:ABCD...`}
            className="font-mono min-h-[140px]"
          />
          <div className="text-xs text-muted-foreground">スマホ等でQRを読み取り、出てきた文字列（SC4:...）を貼り付けてください。</div>
        </div>

        <div className="space-y-2">
          <div className="text-sm font-semibold text-foreground">PGPメッセージ（OCR結果 or 貼り付け）</div>
          <Textarea value={rawText} onChange={(e) => setRawText(e.target.value)} className="font-mono min-h-[280px]" />
          <div className="text-xs text-muted-foreground">
            正規化: `BEGIN/END` を探して base64 部分の空白を除去し、{ARMOR_WRAP_COLUMNS}文字幅で再wrapします。
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button onClick={recompute} disabled={busy}>
            {busy ? '処理中…' : '正規化 + チェックサム照合'}
          </Button>
          {status && <Badge variant="success">{status}</Badge>}
          {error && <Badge variant="destructive">{error}</Badge>}
        </div>

	        <div className="space-y-2">
	          <div className="text-sm font-semibold text-foreground">プレビュー（緑: OK / 黄: 誤読しやすい / 赤: チェックサム不一致）</div>
            <div className="rounded-xl border bg-card px-4 py-3 space-y-2">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="text-xs font-semibold text-foreground">黄ハイライト対象（誤読しやすい文字）</div>
                <div className="flex items-center gap-2">
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => setAmbiguousChars(DEFAULT_AMBIGUOUS_CHARS)}
                    disabled={ambiguousCharsNormalized === DEFAULT_AMBIGUOUS_CHARS}
                  >
                    既定に戻す
                  </Button>
                </div>
              </div>
              <Input
                value={ambiguousChars}
                onChange={(e) => setAmbiguousChars(e.target.value)}
                className="font-mono"
                placeholder={DEFAULT_AMBIGUOUS_CHARS}
              />
              <div className="text-xs text-muted-foreground">例: {DEFAULT_AMBIGUOUS_CHARS}（空白は無視します）</div>
            </div>
	          <div className="flex flex-col gap-4 lg:flex-row lg:items-start">
	            <div className="min-w-0 flex-1">
	              <HighlightedArmoredText
	                text={computedState?.text ?? normalizedText}
	                blocks={computedState?.checksums ?? []}
	                mismatchIndices={computedState?.mismatchIndices ?? new Set<number>()}
                  ambiguousChars={ambiguousCharsNormalized}
	              />
	            </div>
	            <div className="w-full lg:w-[260px] shrink-0">
	              <div className="rounded-xl border bg-white p-3 space-y-2">
	                <div className="text-xs font-semibold text-foreground">ブロック別チェックサム</div>
                <div className="text-xs text-muted-foreground">4ブロック=1行（はがきの分割に対応）</div>
                {(() => {
                  const computed = computedState?.checksums ?? [];
                  if (!computed.length && expected.length === 0) {
                    return <div className="text-xs text-muted-foreground">（まだありません）</div>;
                  }
                  const expectedMap = new Map(expected.map((e) => [e.index, e.checksum]));
                  const computedMap = new Map(computed.map((c) => [c.index, c.checksum]));
                  const maxIndex = Math.max(
                    0,
                    ...Array.from(expectedMap.keys()),
                    ...Array.from(computedMap.keys()),
                  );
                  const mismatch = computedState?.mismatchIndices ?? new Set<number>();
                  const rows: number[][] = [];
                  for (let i = 1; i <= maxIndex; i += 4) rows.push([i, i + 1, i + 2, i + 3].filter((n) => n <= maxIndex));
                  return (
                    <div className="space-y-1">
                      {rows.map((row, ridx) => (
                        <div key={ridx} className="grid grid-cols-4 gap-1">
                          {row.map((idx) => {
                            const exp = expectedMap.get(idx);
                            const got = computedMap.get(idx);
                            const isMismatch = mismatch.has(idx);
                            const ok = !!exp && !!got && exp === got && !isMismatch;
                            const cls = ok
                              ? 'bg-emerald-100 text-emerald-900 border-emerald-200'
                              : isMismatch
                                ? 'bg-red-100 text-red-900 border-red-200'
                                : 'bg-slate-100 text-slate-700 border-slate-200';
                            return (
                              <div
                                key={idx}
                                className={`rounded-md border px-1.5 py-1 font-mono text-[11px] leading-none ${cls}`}
                                title={`#${idx} expected=${exp ?? '—'} got=${got ?? '—'}`}
                              >
                                <div className="flex items-center justify-between gap-1">
                                  <span className="opacity-70">{idx}</span>
                                  <span>{(got ?? exp ?? '—').toUpperCase()}</span>
                                </div>
                              </div>
                            );
                          })}
                          {row.length < 4 ? Array.from({ length: 4 - row.length }).map((_, i) => <div key={`pad-${i}`} />) : null}
                        </div>
                      ))}
                    </div>
                  );
                })()}
              </div>
            </div>
          </div>
        </div>

        <div className="rounded-xl border bg-card p-4 space-y-2">
          <div className="text-sm font-semibold text-foreground">復号コマンド</div>
          <div className="text-xs text-muted-foreground">
            {computedState?.fullMatch
              ? 'チェックサムが全ブロック一致しました。外部gpgで復号してください。'
              : 'チェックサムが全ブロック一致するまで、赤い領域（ブロック）を中心に修正してください。'}
          </div>
          <Textarea
            className="font-mono text-xs"
            readOnly
            value={gpgCommand || 'PGPメッセージを入力すると、ここに復号コマンドが出ます。'}
          />
          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => copyToClipboard(gpgCommand).then(() => setStatus('コマンドをコピーしました'))}
              disabled={!gpgCommand.trim()}
            >
              コマンドコピー
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                if (decryptText.trim()) downloadText('message.asc', decryptText);
              }}
              disabled={!decryptText.trim()}
            >
              message.asc 保存
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => copyToClipboard(decryptText || '').then(() => setStatus('暗号文をコピーしました'))}
              disabled={!decryptText.trim()}
            >
              暗号文コピー
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
