import { useState } from 'react';
import { useContactsStore } from '../useContactsStore';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';

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

export function KeyList() {
  const { contacts, loading, remove } = useContactsStore();
  const [senderFingerprint, setSenderFingerprint] = useState(() => safeGetLocalStorage('senderFingerprint') ?? '');

  const setAsSender = (fingerprint: string) => {
    safeSetLocalStorage('senderFingerprint', fingerprint);
    setSenderFingerprint(fingerprint);
  };

  if (loading) return <div className="text-sm text-muted-foreground">読み込み中…</div>;
  if (!contacts.length) return <div className="text-sm text-muted-foreground">保存された公開鍵はまだありません。</div>;

  return (
    <div className="flex flex-col gap-3">
      {contacts.map((key) => (
        <Card key={key.fingerprint} className="border border-slate-200">
          <CardContent className="flex items-start justify-between gap-4 py-4">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <h4 className="text-base font-semibold text-foreground">{key.label}</h4>
                <Badge variant="muted">{key.source}</Badge>
                {senderFingerprint && key.fingerprint === senderFingerprint ? <Badge variant="secondary">sender</Badge> : null}
              </div>
              <div className="font-mono text-sm text-sky-600 break-all">{key.fingerprint}</div>
              <p className="text-xs text-muted-foreground">{new Date(key.createdAt).toLocaleString()}</p>
            </div>
            <div className="flex flex-col items-end gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setAsSender(key.fingerprint)}
                disabled={!!senderFingerprint && key.fingerprint === senderFingerprint}
              >
                差出人FPにセット
              </Button>
              <Button variant="outline" size="sm" onClick={() => remove(key.fingerprint)}>
                削除
              </Button>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
