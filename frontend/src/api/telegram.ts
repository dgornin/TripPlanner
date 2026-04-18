import { api } from "./client";

export const issueLinkCode = () =>
  api
    .post<{ code: string; deep_link: string }>("/telegram/link")
    .then((r) => r.data);

export const linkStatus = () =>
  api.get<{ linked: boolean }>("/telegram/status").then((r) => r.data);
