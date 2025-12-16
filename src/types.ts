export type ContactKeySource = 'import' | 'keyserver';

export type ContactKey = {
  fingerprint: string;
  label: string;
  armoredPublicKey: string;
  source: ContactKeySource;
  createdAt: string; // ISO string
};

export type ChecksumBlock = {
  index: number; // 1-based
  checksum: string; // short display string
  start: number; // inclusive character index
  end: number; // exclusive character index
};

export type PostcardDraft = {
  id: string;
  recipientFingerprint: string;
  plaintext: string;
  encryptedMessage: string;
  pages: string[];
  checksums: ChecksumBlock[];
  createdAt: string; // ISO string
};

export type KeyValidationResult =
  | { ok: true; fingerprint: string }
  | { ok: false; error: string };
