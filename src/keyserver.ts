import * as openpgp from 'openpgp';

export type KeyserverLookupType = 'email' | 'fingerprint' | 'keyid' | 'name';

export type KeyserverLookup = {
  type: KeyserverLookupType;
  value: string;
};

export type ParsedPublicKey = {
  armored: string;
  fingerprint: string;
  userIDs: string[];
  createdAt: string | null;
};

function normalizeFingerprintLike(value: string) {
  return value.replace(/\s+/g, '').toUpperCase();
}

function isHex(value: string) {
  return /^[0-9a-fA-F]+$/.test(value);
}

export function classifyKeyserverQuery(raw: string): KeyserverLookup {
  const value = raw.trim();
  if (!value) return { type: 'name', value: '' };

  if (value.includes('@')) return { type: 'email', value };

  const compact = normalizeFingerprintLike(value);
  if (isHex(compact) && compact.length === 40) return { type: 'fingerprint', value: compact };
  if (isHex(compact) && compact.length === 16) return { type: 'keyid', value: compact };

  return { type: 'name', value };
}

export async function fetchArmoredFromVks(baseUrl: string, lookup: KeyserverLookup): Promise<string> {
  const normalizedBase = baseUrl.replace(/\/+$/, '');

  // keys.openpgp.org VKS endpoints: by-email, by-fingerprint, by-keyid
  let path: string | null = null;
  if (lookup.type === 'email') path = `/vks/v1/by-email/${encodeURIComponent(lookup.value)}`;
  if (lookup.type === 'fingerprint') path = `/vks/v1/by-fingerprint/${encodeURIComponent(lookup.value)}`;
  if (lookup.type === 'keyid') path = `/vks/v1/by-keyid/${encodeURIComponent(lookup.value)}`;

  if (!path) {
    throw new Error('このKeyServerでは name 検索をサポートしていません（email / fingerprint / keyid を指定してください）');
  }

  const res = await fetch(`${normalizedBase}${path}`, {
    method: 'GET',
    headers: {
      Accept: 'application/pgp-keys, text/plain;q=0.9, */*;q=0.8',
    },
  });

  if (!res.ok) {
    if (res.status === 404) throw new Error('該当する公開鍵が見つかりませんでした');
    throw new Error(`KeyServer取得に失敗しました (HTTP ${res.status})`);
  }

  return await res.text();
}

export async function parseArmoredPublicKey(armored: string): Promise<ParsedPublicKey> {
  const key = await openpgp.readKey({ armoredKey: armored });
  const fingerprint = normalizeFingerprintLike(key.getFingerprint());
  const userIDs = key.getUserIDs();
  const created = key.getCreationTime?.();
  const createdAt = created instanceof Date ? created.toISOString() : null;

  return { armored, fingerprint, userIDs, createdAt };
}

