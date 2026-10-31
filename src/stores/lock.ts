import { create } from 'zustand';

interface LockState {
  locked: boolean;
  hiddenAt: number | null;
  lock(): void;
  unlock(): void;
  markHidden(at: number | null): void;
}

export const useLockStore = create<LockState>()((set) => ({
  locked: true,
  hiddenAt: null,
  lock: () => set({ locked: true }),
  unlock: () => set({ locked: false, hiddenAt: null }),
  markHidden: (at) => set({ hiddenAt: at })
}));
