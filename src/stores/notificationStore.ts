import { create } from 'zustand';

type NotificationState = {
  hasNotifications: boolean;
  setHasNotifications: (has: boolean) => void;
  triggerNotification: () => void;
};

export const useNotificationStore = create<NotificationState>((set) => ({
  hasNotifications: false,
  setHasNotifications: (has) => set({ hasNotifications: has }),
  triggerNotification: () => set({ hasNotifications: true }),
}));
