
import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

type SettingsState = {
  enableDeletion: boolean;
  toggleDeletion: () => void;
  multiPin: boolean;
  toggleMultiPin: () => void;
};

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      enableDeletion: false,
      toggleDeletion: () => set((state) => ({ enableDeletion: !state.enableDeletion })),
      multiPin: false,
      toggleMultiPin: () => set((state) => ({ multiPin: !state.multiPin })),
    }),
    {
      name: 'settings-storage', // name of the item in the storage (must be unique)
      storage: createJSONStorage(() => localStorage), // (optional) by default, 'localStorage' is used
    }
  )
);
