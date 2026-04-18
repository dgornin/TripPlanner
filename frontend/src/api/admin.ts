import { api } from "./client";

export type AdminStats = {
  totals: {
    users: number;
    trips: number;
    messages: number;
    shares: number;
  };
  by_day: Array<{ date: string } & Record<string, number | string>>;
  top_destinations: Array<{ destination: string; count: number }>;
};

export type Funnel = {
  steps: Array<{ step: string; count: number }>;
};

export const getStats = (days = 14) =>
  api.get<AdminStats>(`/admin/stats?days=${days}`).then((r) => r.data);

export const getFunnel = () =>
  api.get<Funnel>("/admin/funnel").then((r) => r.data);
