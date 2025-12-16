import { useState } from 'react';
import * as openpgp from 'openpgp';
import type { ContactKey } from '../types';
import { useContactsStore } from '../useContactsStore';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';

function normalizeFingerprint(fp: string) {
  return fp.replace(/\s+/g, '').toUpperCase();
}

async function extractFingerprint(armored: string): Promise<string> {
  const key = await openpgp.readKey({ armoredKey: armored });
  const fp = key.getFingerprint();
  return normalizeFingerprint(fp);
}

export function KeyImportForm() {
  const [armoredText, setArmoredText] = useState('');
  const [label, setLabel] = useState('');
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const add = useContactsStore((s) => s.add);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatus(null);
    setError(null);

    if (!armoredText.trim()) {
      setError('公開鍵を貼り付けてください');
      return;
    }

    try {
      const fingerprint = await extractFingerprint(armoredText.trim());
      const contact: ContactKey = {
        fingerprint,
        label: label.trim() || fingerprint,
        armoredPublicKey: armoredText.trim(),
        source: 'import',
        createdAt: new Date().toISOString(),
      };
      await add(contact);
      setStatus('保存しました');
      setArmoredText('');
      setLabel('');
    } catch (err) {
      setError((err as Error).message ?? '取り込みに失敗しました');
    }
  };

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-lg font-semibold">公開鍵をインポート</h3>
        <p className="text-sm text-muted-foreground">
          Armored テキストを貼り付けて Fingerprint を抽出します。
        </p>
      </div>
      <form onSubmit={onSubmit} className="space-y-3">
        <div className="space-y-1.5">
          <label className="text-sm font-medium text-foreground" htmlFor="label">
            ラベル（任意）
          </label>
          <Input id="label" placeholder="例: Alice (Work)" value={label} onChange={(e) => setLabel(e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <label className="text-sm font-medium text-foreground" htmlFor="armored">
            Armored 公開鍵
          </label>
          <Textarea
            id="armored"
            className="font-mono"
            placeholder="-----BEGIN PGP PUBLIC KEY BLOCK-----"
            value={armoredText}
            onChange={(e) => setArmoredText(e.target.value)}
          />
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button type="submit">取り込む</Button>
          {status && <Badge variant="success">{status}</Badge>}
          {error && (
            <Badge variant="destructive" className="bg-red-100 text-red-700 border-red-200">
              {error}
            </Badge>
          )}
        </div>
      </form>
    </div>
  );
}
