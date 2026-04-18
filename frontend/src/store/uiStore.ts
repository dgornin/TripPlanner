import { create } from "zustand";

type State = {
  selectedDay: number | null; // null = all days
  setSelectedDay: (d: number | null) => void;
  toast: string | null;
  showToast: (text: string) => void;
};

export const useUi = create<State>((set) => ({
  selectedDay: null,
  setSelectedDay: (d) => set({ selectedDay: d }),
  toast: null,
  showToast: (text) => {
    set({ toast: text });
    setTimeout(() => set({ toast: null }), 2500);
  },
}));
