import { api } from "./client";

export type User = {
  id: string;
  email: string;
  display_name: string | null;
  is_admin: boolean;
};

export const signup = (body: {
  email: string;
  password: string;
  display_name?: string;
}) => api.post<User>("/auth/signup", body).then((r) => r.data);

export const login = (body: { email: string; password: string }) =>
  api.post<User>("/auth/login", body).then((r) => r.data);

export const logout = () => api.post("/auth/logout").then((r) => r.data);

export const me = () => api.get<User>("/auth/me").then((r) => r.data);
