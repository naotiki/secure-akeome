import { useEffect, useMemo, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { useContactsStore } from '@/useContactsStore';
import { useDraftsStore } from '@/useDraftsStore';
import type { ContactKey, PostcardDraft } from '@/types';
import { encryptForRecipient } from '@/crypto/encrypt';
import { splitByLines } from '@/crypto/paging';
import { computeChecksums } from '@/crypto/checksum';
import { rewrapArmoredMessage } from '@/crypto/armor';
import { ARMOR_WRAP_COLUMNS, POSTCARD_LINES_PER_PAGE } from '@/postcard/constants';

type DraftView = PostcardDraft & { recipientLabel: string };

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

function byLabelOrFingerprint(a: ContactKey, b: ContactKey) {
  return (a.label || a.fingerprint).localeCompare(b.label || b.fingerprint);
}

export function PostcardComposer() {
  const { contacts, init } = useContactsStore();
  const draftsStoreInit = useDraftsStore((s) => s.init);
  const upsertMany = useDraftsStore((s) => s.upsertMany);
  const savedDrafts = useDraftsStore((s) => s.drafts);
  const savedLoading = useDraftsStore((s) => s.loading);
  const removeDraft = useDraftsStore((s) => s.remove);
  const [senderFingerprint, setSenderFingerprint] = useState(() => {
    try {
      return localStorage.getItem('senderFingerprint') ?? '';
    } catch {
      return '';
    }
  });
  const [plaintext, setPlaintext] = useState('');
  const [selected, setSelected] = useState<Record<string, boolean>>({});
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [drafts, setDrafts] = useState<DraftView[]>([]);

  useEffect(() => {
    init();
    draftsStoreInit();
  }, [init, draftsStoreInit]);

  useEffect(() => {
    try {
      localStorage.setItem('senderFingerprint', senderFingerprint);
    } catch {
      // ignore
    }
  }, [senderFingerprint]);

  const sortedContacts = useMemo(() => [...contacts].sort(byLabelOrFingerprint), [contacts]);
  const selectedRecipients = useMemo(
    () => sortedContacts.filter((c) => selected[c.fingerprint]),
    [sortedContacts, selected],
  );

  const recipientLabelByFingerprint = useMemo(() => {
    const map = new Map<string, string>();
    for (const c of sortedContacts) map.set(c.fingerprint, c.label);
    return map;
  }, [sortedContacts]);

  const toggleAll = (value: boolean) => {
    const next: Record<string, boolean> = {};
    for (const c of sortedContacts) next[c.fingerprint] = value;
    setSelected(next);
  };

  const onEncrypt = async () => {
    setStatus(null);
    setError(null);
    setDrafts([]);

    if (!plaintext.trim()) {
      setError('本文（平文）を入力してください');
      return;
    }

    if (!selectedRecipients.length) {
      setError('宛先を1人以上選択してください');
      return;
    }

    setBusy(true);
    try {
      const created: DraftView[] = [];
      const draftsToSave: PostcardDraft[] = [];
      for (const recipient of selectedRecipients) {
        setStatus(`暗号化中: ${recipient.label}`);
        const encryptedMessage = await encryptForRecipient(plaintext, recipient);
        const printable = rewrapArmoredMessage(encryptedMessage, ARMOR_WRAP_COLUMNS);
        const pages = splitByLines(printable, POSTCARD_LINES_PER_PAGE);
        const checksums = await computeChecksums(printable, { parts: 4, displayChars: 2 });
        const baseDraft: PostcardDraft = {
          id: crypto.randomUUID(),
          recipientFingerprint: recipient.fingerprint,
          plaintext,
          encryptedMessage: printable,
          pages,
          checksums,
          createdAt: new Date().toISOString(),
        };
        draftsToSave.push(baseDraft);
        created.push({ ...baseDraft, recipientLabel: recipient.label });
      }
      await upsertMany(draftsToSave);
      setDrafts(created);
      setStatus('完了');
    } catch (err) {
      setError((err as Error).message ?? '暗号化に失敗しました');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card className="section-card border border-slate-200">
      <CardHeader>
        <CardTitle>年賀状作成（暗号化）</CardTitle>
        <CardDescription>宛先ごとに公開鍵で暗号化し、分割ページとチェックサムを生成します。</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="grid gap-6 md:grid-cols-2">
          <div className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-foreground" htmlFor="sender-fp">
                差出人 Fingerprint（印字用 / 任意）
              </label>
              <Input
                id="sender-fp"
                value={senderFingerprint}
                onChange={(e) => setSenderFingerprint(e.target.value)}
                placeholder="例: 0123... (40 hex)"
              />
              <div className="text-xs text-muted-foreground">
                暗号化には使いません（テンプレ出力時に印字します）。「公開鍵管理」から差出人FPにセットできます。
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-sm font-medium text-foreground" htmlFor="plaintext">
                本文（平文）
              </label>
              <Textarea id="plaintext" value={plaintext} onChange={(e) => setPlaintext(e.target.value)} />
            </div>
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between gap-2">
              <div>
                <div className="text-sm font-semibold text-foreground">宛先（公開鍵）</div>
                <div className="text-xs text-muted-foreground">宛先ごとに個別暗号化します。</div>
              </div>
              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" onClick={() => toggleAll(true)} disabled={!sortedContacts.length}>
                  全選択
                </Button>
                <Button variant="outline" size="sm" onClick={() => toggleAll(false)} disabled={!sortedContacts.length}>
                  全解除
                </Button>
              </div>
            </div>

            {!sortedContacts.length ? (
              <div className="rounded-xl border bg-card px-4 py-3 text-sm text-muted-foreground">
                まず「公開鍵管理」で宛先の公開鍵を登録してください。
              </div>
            ) : (
              <div className="rounded-xl border bg-card divide-y">
                {sortedContacts.map((c) => (
                  <label key={c.fingerprint} className="flex items-start gap-3 px-4 py-3 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={!!selected[c.fingerprint]}
                      onChange={(e) => setSelected((prev) => ({ ...prev, [c.fingerprint]: e.target.checked }))}
                      className="mt-1 h-4 w-4 accent-sky-600"
                    />
                    <span className="flex-1">
                      <span className="block text-sm font-medium text-foreground">{c.label}</span>
                      <span className="block font-mono text-xs text-sky-600 break-all">{c.fingerprint}</span>
                    </span>
                    <Badge variant="muted">{c.source}</Badge>
                  </label>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button onClick={onEncrypt} disabled={busy}>
            {busy ? '暗号化中…' : '宛先ごとに暗号化'}
          </Button>
          {status && <Badge variant="success">{status}</Badge>}
          {error && <Badge variant="destructive">{error}</Badge>}
        </div>

        {drafts.length > 0 && (
          <div className="space-y-4">
            <div className="flex items-center justify-between gap-2">
              <h3 className="text-lg font-semibold">生成結果</h3>
              <div className="text-xs text-muted-foreground">
                rewrap: {ARMOR_WRAP_COLUMNS} chars/line / ページ分割: {POSTCARD_LINES_PER_PAGE}行/ページ / チェックサム: 256文字ブロック（4桁表示）
              </div>
            </div>
            <div className="grid gap-4">
              {drafts.map((d) => (
                <div key={d.id} className="rounded-2xl border bg-card p-4 space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="space-y-1">
                      <div className="text-sm font-semibold text-foreground">{d.recipientLabel}</div>
                      <div className="font-mono text-xs text-sky-600 break-all">{d.recipientFingerprint}</div>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge variant="secondary">{d.pages.length} pages</Badge>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => copyToClipboard(d.encryptedMessage).then(() => setStatus('暗号文をコピーしました'))}
                      >
                        暗号文コピー
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => downloadText(`message-${d.recipientFingerprint}.asc`, d.encryptedMessage)}
                      >
                        .asc保存
                      </Button>
                    </div>
                  </div>

                  <div className="rounded-xl border bg-background/40 p-3 space-y-2">
                    <div className="text-xs font-semibold text-foreground">CHECKSUM</div>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                      {d.checksums.map((c) => (
                        <div key={c.index} className="font-mono text-xs text-muted-foreground">
                          [{c.index}] <span className="text-foreground">{c.checksum}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  <details className="rounded-xl border bg-background/30 px-3 py-2">
                    <summary className="cursor-pointer text-sm text-foreground">暗号文プレビュー</summary>
                    <pre className="mt-2 whitespace-pre-wrap break-words text-xs text-muted-foreground font-mono">
                      {d.encryptedMessage}
                    </pre>
                  </details>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="space-y-3">
          <div className="flex items-center justify-between gap-2">
            <h3 className="text-lg font-semibold">保存済みドラフト</h3>
            <div className="text-xs text-muted-foreground">IndexedDB に保存されています。</div>
          </div>
          {savedLoading ? (
            <div className="text-sm text-muted-foreground">読み込み中…</div>
          ) : savedDrafts.length === 0 ? (
            <div className="text-sm text-muted-foreground">まだドラフトはありません。</div>
          ) : (
            <div className="rounded-2xl border bg-card divide-y">
              {savedDrafts.map((d) => (
                <div key={d.id} className="px-4 py-3 flex flex-wrap items-center justify-between gap-2">
                  <div className="space-y-0.5 min-w-[240px]">
                    <div className="text-sm font-semibold text-foreground">
                      {recipientLabelByFingerprint.get(d.recipientFingerprint) ?? d.recipientFingerprint}
                    </div>
                    <div className="font-mono text-xs text-sky-600 break-all">{d.recipientFingerprint}</div>
                    <div className="text-xs text-muted-foreground">{new Date(d.createdAt).toLocaleString()}</div>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant="secondary">{d.pages.length} pages</Badge>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => copyToClipboard(d.encryptedMessage).then(() => setStatus('暗号文をコピーしました'))}
                    >
                      コピー
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => downloadText(`message-${d.recipientFingerprint}.asc`, d.encryptedMessage)}
                    >
                      .asc
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => removeDraft(d.id).then(() => setStatus('削除しました'))}
                    >
                      削除
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
