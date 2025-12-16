import { openDB, type DBSchema } from 'idb';
import type { ContactKey, PostcardDraft } from './types';

const DB_NAME = 'e2ee-nengajo';
const DB_VERSION = 2;

interface NengajoDB extends DBSchema {
  contacts: {
    key: string; // fingerprint
    value: ContactKey;
  };
  drafts: {
    key: string; // id
    value: PostcardDraft;
  };
}

const dbPromise = openDB<NengajoDB>(DB_NAME, DB_VERSION, {
  upgrade(db, oldVersion) {
    if (oldVersion < 1) {
      db.createObjectStore('contacts', { keyPath: 'fingerprint' });
    }
    if (oldVersion < 2) {
      db.createObjectStore('drafts', { keyPath: 'id' });
    }
  },
});

export async function upsertContact(contact: ContactKey) {
  const db = await dbPromise;
  await db.put('contacts', contact);
}

export async function deleteContact(fingerprint: string) {
  const db = await dbPromise;
  await db.delete('contacts', fingerprint);
}

export async function listContacts(): Promise<ContactKey[]> {
  const db = await dbPromise;
  return db.getAll('contacts');
}

export async function upsertDraft(draft: PostcardDraft) {
  const db = await dbPromise;
  await db.put('drafts', draft);
}

export async function deleteDraft(id: string) {
  const db = await dbPromise;
  await db.delete('drafts', id);
}

export async function listDrafts(): Promise<PostcardDraft[]> {
  const db = await dbPromise;
  return db.getAll('drafts');
}
