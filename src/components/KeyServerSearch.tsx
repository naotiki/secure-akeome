import { useEffect, useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { classifyKeyserverQuery, fetchArmoredFromVks, parseArmoredPublicKey, type ParsedPublicKey } from '@/keyserver';
import { useContactsStore } from '@/useContactsStore';
import type { ContactKey } from '@/types';

const DEFAULT_VKS = 'https://keys.openpgp.org';

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

export function KeyServerSearch() {
  const add = useContactsStore((s) => s.add);
  const [serverUrl, setServerUrl] = useState(() => safeGetLocalStorage('keyServerURL') ?? DEFAULT_VKS);
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<ParsedPublicKey | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    safeSetLocalStorage('keyServerURL', serverUrl);
  }, [serverUrl]);

  const lookup = useMemo(() => classifyKeyserverQuery(query), [query]);

  const onSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatus(null);
    setError(null);
    setResult(null);

    if (!query.trim()) {
      setError('検索条件を入力してください');
      return;
    }

    if (lookup.type === 'name') {
      setError('name 検索は未対応です（email / fingerprint(40hex) / keyid(16hex) を入力してください）');
      return;
    }

    setLoading(true);
    try {
      const armored = await fetchArmoredFromVks(serverUrl, lookup);
      const parsed = await parseArmoredPublicKey(armored);
      setResult(parsed);
      setStatus('取得しました');
    } catch (err) {
      setError((err as Error).message ?? '検索に失敗しました');
    } finally {
      setLoading(false);
    }
  };

  const onImport = async () => {
    if (!result) return;
    setStatus(null);
    setError(null);

    const label = result.userIDs[0]?.trim() || result.fingerprint;
    const contact: ContactKey = {
      fingerprint: result.fingerprint,
      label,
      armoredPublicKey: result.armored,
      source: 'keyserver',
      createdAt: new Date().toISOString(),
    };

    try {
      await add(contact);
      setStatus('保存しました');
    } catch (err) {
      setError((err as Error).message ?? '保存に失敗しました');
    }
  };

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-lg font-semibold">KeyServer 検索</h3>
        <p className="text-sm text-muted-foreground">
          `keys.openpgp.org`（VKS）から公開鍵を取得します。email / fingerprint / keyid に対応します。
        </p>
      </div>

      <form onSubmit={onSearch} className="space-y-3">
        <div className="space-y-1.5">
          <label className="text-sm font-medium text-foreground" htmlFor="keyserver-url">
            KeyServer URL
          </label>
          <Input
            id="keyserver-url"
            value={serverUrl}
            onChange={(e) => setServerUrl(e.target.value)}
            placeholder={DEFAULT_VKS}
            inputMode="url"
          />
        </div>

        <div className="space-y-1.5">
          <label className="text-sm font-medium text-foreground" htmlFor="keyserver-query">
            検索（email / fingerprint / keyid）
          </label>
          <Input
            id="keyserver-query"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="alice@example.com / 0123... (40 hex) / 89ABCDEF01234567"
          />
          <div className="text-xs text-muted-foreground">
            判定: <span className="font-mono">{lookup.type}</span>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button type="submit" disabled={loading}>
            {loading ? '検索中…' : '検索'}
          </Button>
          {status && <Badge variant="success">{status}</Badge>}
          {error && <Badge variant="destructive">{error}</Badge>}
        </div>
      </form>

      {result && (
        <div className="rounded-xl border bg-card px-4 py-3 space-y-2">
          <div className="flex items-center justify-between gap-2">
            <div className="space-y-1">
              <div className="text-sm font-semibold text-foreground">取得結果</div>
              <div className="font-mono text-xs text-sky-600 break-all">{result.fingerprint}</div>
            </div>
            <Button variant="outline" size="sm" onClick={onImport}>
              取り込む
            </Button>
          </div>
          <div className="text-sm text-muted-foreground">
            {result.userIDs.length ? (
              <ul className="list-disc pl-5">
                {result.userIDs.slice(0, 4).map((uid) => (
                  <li key={uid} className="break-words">
                    {uid}
                  </li>
                ))}
              </ul>
            ) : (
              <span className="muted-text">User ID なし</span>
            )}
          </div>
          {result.createdAt && <div className="text-xs text-muted-foreground">Key created: {result.createdAt}</div>}
        </div>
      )}
    </div>
  );
}

