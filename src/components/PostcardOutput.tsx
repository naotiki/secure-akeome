import { useEffect, useMemo, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useDraftsStore } from '@/useDraftsStore';
import { useContactsStore } from '@/useContactsStore';
import { renderPostcardSvg } from '@/postcard/render';
import { svgsToPdfBytes } from '@/postcard/pdf';
import { computeChecksums } from '@/crypto/checksum';

function downloadBlob(filename: string, blob: Blob) {
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

function openSvgInNewTab(svg: string) {
  const url = URL.createObjectURL(new Blob([svg], { type: 'image/svg+xml;charset=utf-8' }));
  window.open(url, '_blank', 'noopener,noreferrer');
  window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

function summarizePlaintext(plaintext: string, maxChars = 80) {
  const firstLine = plaintext.replace(/\r\n/g, '\n').split('\n')[0] ?? '';
  const trimmed = firstLine.trim();
  if (!trimmed) return '（平文なし）';
  return trimmed.length > maxChars ? `${trimmed.slice(0, maxChars)}…` : trimmed;
}

export function PostcardOutput() {
  const draftsInit = useDraftsStore((s) => s.init);
  const drafts = useDraftsStore((s) => s.drafts);
  const draftsLoading = useDraftsStore((s) => s.loading);
  const contactsInit = useContactsStore((s) => s.init);
  const contacts = useContactsStore((s) => s.contacts);

  const [selectedDraftId, setSelectedDraftId] = useState<string | null>(null);
  const [svgs, setSvgs] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [previewScale, setPreviewScale] = useState(1.35);
  const [previewColumns, setPreviewColumns] = useState<1 | 2>(1);
  const [showPlaintext, setShowPlaintext] = useState(false);

  const senderFingerprint = useMemo(() => {
    try {
      return localStorage.getItem('senderFingerprint') ?? '';
    } catch {
      return '';
    }
  }, []);

  useEffect(() => {
    draftsInit();
    contactsInit();
  }, [draftsInit, contactsInit]);

  const selectedDraft = useMemo(() => drafts.find((d) => d.id === selectedDraftId) ?? null, [drafts, selectedDraftId]);

  const recipientLabel = useMemo(() => {
    if (!selectedDraft) return null;
    return contacts.find((c) => c.fingerprint === selectedDraft.recipientFingerprint)?.label ?? null;
  }, [contacts, selectedDraft]);

  useEffect(() => {
    if (!selectedDraftId && drafts.length) setSelectedDraftId(drafts[0].id);
  }, [drafts, selectedDraftId]);

  const generate = async () => {
    setStatus(null);
    setError(null);
    setSvgs([]);
    if (!selectedDraft) {
      setError('ドラフトを選択してください');
      return;
    }
    setBusy(true);
    try {
      // Always recompute (checksum spec may change and old drafts might have legacy checksums).
      const checksums = await computeChecksums(selectedDraft.encryptedMessage, { parts: 4, displayChars: 2 });
      const pageCount = selectedDraft.pages.length;
      const generated: string[] = [];
      for (let i = 0; i < pageCount; i++) {
        setStatus(`SVG生成中… (${i + 1}/${pageCount})`);
        const svg = await renderPostcardSvg({
          senderFingerprint,
          recipientFingerprint: selectedDraft.recipientFingerprint,
          pageText: selectedDraft.pages[i],
          pageIndex: i + 1,
          pageCount,
          checksums,
        });
        generated.push(svg);
      }
      setSvgs(generated);
      setStatus('完了');
    } catch (err) {
      setError((err as Error).message ?? '生成に失敗しました');
    } finally {
      setBusy(false);
    }
  };

  const downloadSvgs = () => {
    if (!selectedDraft || svgs.length === 0) return;
    svgs.forEach((svg, i) => {
      const filename = `postcard-${selectedDraft.recipientFingerprint}-page-${i + 1}-of-${svgs.length}.svg`;
      downloadBlob(filename, new Blob([svg], { type: 'image/svg+xml;charset=utf-8' }));
    });
  };

  const downloadPdf = async () => {
    if (!selectedDraft || svgs.length === 0) return;
    setStatus('PDF生成中…');
    setError(null);
    try {
      const bytes = await svgsToPdfBytes(svgs);
      const blob = new Blob([bytes as unknown as ArrayBuffer], { type: 'application/pdf' });
      downloadBlob(`postcard-${selectedDraft.recipientFingerprint}.pdf`, blob);
      setStatus('PDFを保存しました');
    } catch (err) {
      setError((err as Error).message ?? 'PDF生成に失敗しました');
    }
  };

  return (
    <Card className="section-card border border-slate-200">
      <CardHeader>
        <CardTitle>はがき出力（Satori）</CardTitle>
        <CardDescription>保存済みドラフトから、印刷用SVG（+任意でPDF）を生成します。</CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="grid gap-6 lg:grid-cols-[360px_1fr]">
          <div className="space-y-3">
            <div className="text-sm font-semibold text-foreground">ドラフト選択</div>
            {draftsLoading ? (
              <div className="text-sm text-muted-foreground">読み込み中…</div>
            ) : drafts.length === 0 ? (
              <div className="text-sm text-muted-foreground">まだドラフトがありません。「暗号化作成」で作ってください。</div>
            ) : (
              <div className="rounded-2xl border bg-card divide-y">
                {drafts.map((d) => (
	                  <button
	                    key={d.id}
	                    type="button"
	                    onClick={() => {
	                      setSelectedDraftId(d.id);
	                      setShowPlaintext(false);
	                    }}
	                    className={[
	                      'w-full text-left px-4 py-3 transition',
	                      selectedDraftId === d.id ? 'bg-sky-50' : 'hover:bg-slate-50',
	                    ].join(' ')}
	                  >
                    <div className="text-sm font-semibold text-foreground">
                      {contacts.find((c) => c.fingerprint === d.recipientFingerprint)?.label ?? d.recipientFingerprint}
                    </div>
                    <div className="font-mono text-xs text-sky-600 break-all">{d.recipientFingerprint}</div>
	                    <div className="text-xs text-muted-foreground pt-1">{summarizePlaintext(d.plaintext)}</div>
	                    <div className="flex items-center justify-between pt-1">
	                      <span className="text-xs text-muted-foreground">{new Date(d.createdAt).toLocaleString()}</span>
	                      <div className="flex items-center gap-2">
	                        {d.signedPlaintext ? <Badge variant="muted">signed</Badge> : null}
	                        <Badge variant="secondary">{d.pages.length} pages</Badge>
	                      </div>
	                    </div>
	                  </button>
	                ))}
	              </div>
	            )}

            <div className="flex flex-wrap items-center gap-2">
              <Button onClick={generate} disabled={busy || !selectedDraft}>
                {busy ? '生成中…' : 'SVG生成'}
              </Button>
              <Button variant="outline" onClick={downloadSvgs} disabled={!svgs.length}>
                SVG保存
              </Button>
              <Button variant="outline" onClick={downloadPdf} disabled={!svgs.length}>
                PDF保存
              </Button>
              {status && <Badge variant="success">{status}</Badge>}
              {error && <Badge variant="destructive">{error}</Badge>}
            </div>

            <div className="text-xs text-muted-foreground">
              SVGは `100mm x 148mm` に設定します。印刷時に「用紙に合わせる」等で調整してください。
            </div>
          </div>

	          <div className="space-y-3">
	            {selectedDraft ? (
	              <div className="rounded-2xl border bg-card px-4 py-3 space-y-2">
	                <div className="flex flex-wrap items-center justify-between gap-2">
	                  <div className="flex items-center gap-2">
	                    <div className="text-sm font-semibold text-foreground">平文（ローカルのみ）</div>
	                    {selectedDraft.signedPlaintext ? <Badge variant="muted">signed</Badge> : null}
	                  </div>
	                  <div className="flex items-center gap-2">
	                    <Button type="button" size="sm" variant="outline" onClick={() => setShowPlaintext((v) => !v)}>
	                      {showPlaintext ? '隠す' : '表示'}
	                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      disabled={!showPlaintext}
                      onClick={() => copyToClipboard(selectedDraft.plaintext).then(() => setStatus('平文をコピーしました'))}
                    >
                      コピー
                    </Button>
                  </div>
                </div>
	                <pre
	                  className={[
	                    'rounded-xl border bg-white px-3 py-2 text-xs font-mono whitespace-pre-wrap break-words',
	                    showPlaintext ? 'text-slate-900' : 'text-muted-foreground',
	                  ].join(' ')}
	                  style={{ maxHeight: 180, overflow: 'auto' }}
	                >
	                  {showPlaintext ? selectedDraft.plaintext || '（平文なし）' : '（非表示）'}
	                </pre>
	                {selectedDraft.signedPlaintext ? (
	                  <details className="rounded-xl border bg-background/30 px-3 py-2">
	                    <summary className="cursor-pointer text-sm text-foreground">署名付き本文（gpg / ローカルのみ）</summary>
	                    <div className="mt-2 flex flex-wrap items-center justify-end gap-2">
	                      <Button
	                        type="button"
	                        variant="outline"
	                        size="sm"
	                        onClick={() =>
	                          copyToClipboard(selectedDraft.signedPlaintext ?? '').then(() => setStatus('署名付き本文をコピーしました'))
	                        }
	                      >
	                        署名付き本文コピー
	                      </Button>
	                    </div>
	                    <pre className="mt-2 whitespace-pre-wrap break-words text-xs text-muted-foreground font-mono">
	                      {selectedDraft.signedPlaintext}
	                    </pre>
	                  </details>
	                ) : null}
	              </div>
	            ) : null}
            <div className="flex items-center justify-between gap-2">
              <div>
                <div className="text-sm font-semibold text-foreground">プレビュー</div>
                <div className="text-xs text-muted-foreground">
                  {selectedDraft ? (
                    <>
                      {recipientLabel ?? '—'} / {selectedDraft.recipientFingerprint}
                    </>
                  ) : (
                    '—'
                  )}
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <div className="hidden sm:flex items-center gap-1">
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => setPreviewScale((s) => Math.max(0.75, Math.round((s - 0.1) * 100) / 100))}
                    disabled={!svgs.length}
                  >
                    −
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => setPreviewScale((s) => Math.min(2.5, Math.round((s + 0.1) * 100) / 100))}
                    disabled={!svgs.length}
                  >
                    ＋
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => setPreviewScale(1.35)}
                    disabled={!svgs.length}
                  >
                    既定
                  </Button>
                </div>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => setPreviewColumns((c) => (c === 2 ? 1 : 2))}
                  disabled={!svgs.length}
                >
                  {previewColumns === 2 ? '1列' : '2列'}
                </Button>
                <Badge variant="muted">{svgs.length ? `${svgs.length} pages` : 'not generated'}</Badge>
              </div>
            </div>

            {svgs.length === 0 ? (
              <div className="rounded-2xl border bg-card px-4 py-10 text-center text-sm text-muted-foreground">
                「SVG生成」を押すとプレビューが表示されます。
              </div>
            ) : (
              <div className={['grid gap-4', previewColumns === 2 ? 'md:grid-cols-2' : ''].join(' ')}>
                {svgs.map((svg, idx) => (
                  <div key={idx} className="rounded-2xl border bg-white p-2 shadow-sm">
                    <div className="flex items-center justify-between gap-2 px-1 pb-2">
                      <div className="text-xs text-muted-foreground">PAGE {idx + 1}</div>
                      <Button type="button" size="sm" variant="outline" onClick={() => openSvgInNewTab(svg)}>
                        別タブで開く
                      </Button>
                    </div>
                    <div className="w-full overflow-auto rounded-xl border bg-white" style={{ aspectRatio: '148 / 100' }}>
                      <div
                        style={{
                          width: '100%',
                          height: '100%',
                          transform: `scale(${previewScale})`,
                          transformOrigin: 'top left',
                        }}
                        dangerouslySetInnerHTML={{
                          __html: svg
                            .replace(/width=\"[^\"]+\"/, 'width=\"100%\"')
                            .replace(/height=\"[^\"]+\"/, 'height=\"100%\"'),
                        }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
