import { create } from 'zustand';
import type { PostcardDraft } from '@/types';
import { deleteDraft, listDrafts, upsertDraft } from '@/storage';

type State = {
  drafts: PostcardDraft[];
  loading: boolean;
  error: string | null;
  init: () => Promise<void>;
  upsertMany: (drafts: PostcardDraft[]) => Promise<void>;
  remove: (id: string) => Promise<void>;
};

export const useDraftsStore = create<State>((set) => ({
  drafts: [],
  loading: false,
  error: null,
  init: async () => {
    set({ loading: true, error: null });
    try {
      const drafts = await listDrafts();
      drafts.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
      set({ drafts, loading: false });
    } catch (error) {
      set({ error: (error as Error).message, loading: false });
    }
  },
  upsertMany: async (draftsToUpsert) => {
    for (const draft of draftsToUpsert) {
      await upsertDraft(draft);
    }
    const drafts = await listDrafts();
    drafts.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    set({ drafts });
  },
  remove: async (id) => {
    await deleteDraft(id);
    const drafts = await listDrafts();
    drafts.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    set({ drafts });
  },
}));

