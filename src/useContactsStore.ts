import { create } from 'zustand';
import type { ContactKey } from './types';
import { deleteContact, listContacts, upsertContact } from './storage';

type State = {
  contacts: ContactKey[];
  loading: boolean;
  error: string | null;
  init: () => Promise<void>;
  add: (contact: ContactKey) => Promise<void>;
  remove: (fingerprint: string) => Promise<void>;
};

export const useContactsStore = create<State>((set) => ({
  contacts: [],
  loading: false,
  error: null,
  init: async () => {
    set({ loading: true, error: null });
    try {
      const contacts = await listContacts();
      set({ contacts, loading: false });
    } catch (error) {
      set({ error: (error as Error).message, loading: false });
    }
  },
  add: async (contact) => {
    await upsertContact(contact);
    const contacts = await listContacts();
    set({ contacts });
  },
  remove: async (fingerprint) => {
    await deleteContact(fingerprint);
    const contacts = await listContacts();
    set({ contacts });
  },
}));
