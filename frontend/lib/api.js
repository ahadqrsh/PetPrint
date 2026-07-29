import axios from "axios";

const api = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000/api"
});

// Attach the JWT to every request.
api.interceptors.request.use((config) => {
  if (typeof window !== "undefined") {
    const token = localStorage.getItem("token");
    if (token) config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Normalise the backend's { error: { message } } shape.
export function apiError(err) {
  return (
    err?.response?.data?.error?.message ||
    err?.message ||
    "Something went wrong. Please try again."
  );
}

export default api;
