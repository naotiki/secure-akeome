import { useEffect } from 'react';
import { useContactsStore } from '../useContactsStore';
import { KeyImportForm } from './KeyImportForm';
import { KeyList } from './KeyList';
import { KeyServerSearch } from './KeyServerSearch';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';

export function KeyManager() {
  const init = useContactsStore((s) => s.init);
  const error = useContactsStore((s) => s.error);

  useEffect(() => {
    init();
  }, [init]);

  return (
    <Card className="section-card border border-slate-200">
      <CardHeader className="pb-2">
        <CardTitle>PGP 公開鍵管理</CardTitle>
        <CardDescription>
          Fingerprint を主キーとしてローカル（IndexedDB）に保存します。秘密鍵は扱いません。
        </CardDescription>
        {error && (
          <div className="mt-2 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            {error}
          </div>
        )}
      </CardHeader>
      <CardContent>
        <div className="grid gap-6 md:grid-cols-2">
          <div className="space-y-6">
            <KeyImportForm />
            <div className="h-px bg-border" />
            <KeyServerSearch />
          </div>
          <div className="space-y-3">
            <h3 className="text-lg font-semibold">登録済み鍵</h3>
            <KeyList />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
