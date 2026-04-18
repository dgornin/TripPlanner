import { create } from "zustand";
import { me, type User } from "../api/auth";

type State = {
  user: User | null;
  loading: boolean;
  loaded: boolean;
  load: () => Promise<void>;
  set: (u: User | null) => void;
};

export const useAuth = create<State>((set, get) => ({
  user: null,
  loading: false,
  loaded: false,
  load: async () => {
    if (get().loading) return;
    set({ loading: true });
    try {
      const user = await me();
      set({ user, loading: false, loaded: true });
    } catch {
      set({ user: null, loading: false, loaded: true });
    }
  },
  set: (u) => set({ user: u, loaded: true }),
}));
