import { api } from "./client";

export type Place = {
  id: string;
  order_index: number;
  name: string;
  description: string | null;
  category: string | null;
  lat: number;
  lon: number;
  address: string | null;
  duration_minutes: number | null;
};

export type Day = {
  id: string;
  day_number: number;
  date: string | null;
  title: string | null;
  places: Place[];
};

export type Trip = {
  id: string;
  title: string | null;
  destination: string;
  start_date: string | null;
  end_date: string | null;
  travelers: number;
  interests: string[];
  summary: string | null;
  is_public: boolean;
  days: Day[];
  created_at: string;
  updated_at: string;
};

export type TripSummary = {
  id: string;
  title: string | null;
  destination: string;
  start_date: string | null;
  end_date: string | null;
  created_at: string;
  is_public: boolean;
};

export const createTrip = (body: {
  destination: string;
  start_date?: string | null;
  end_date?: string | null;
  travelers?: number;
  interests?: string[];
  title?: string;
}) => api.post<Trip>("/trips", body).then((r) => r.data);

export const listTrips = () =>
  api.get<TripSummary[]>("/trips").then((r) => r.data);

export const getTrip = (id: string) =>
  api.get<Trip>(`/trips/${id}`).then((r) => r.data);

export const patchTrip = (
  id: string,
  body: Partial<{ title: string; is_public: boolean }>,
) => api.patch<Trip>(`/trips/${id}`, body).then((r) => r.data);

export const deleteTrip = (id: string) =>
  api.delete(`/trips/${id}`).then((r) => r.data);

export const publicTrip = (id: string) =>
  api.get<Trip>(`/public/trips/${id}`).then((r) => r.data);
