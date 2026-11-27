import axios, { isAxiosError } from "axios";

export const api = axios.create({
  baseURL: "/api",
});

export function apiErrorMessage(error: unknown, fallback: string) {
  if (isAxiosError<{ message?: unknown }>(error)) {
    const message = error.response?.data?.message;
    if (typeof message === "string" && message.trim()) return message;
  }
  return fallback;
}

api.interceptors.request.use((config) => {
  const token = localStorage.getItem("pizza_token");
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});
