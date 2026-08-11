/**
 * API Client — Axios configurado com base URL e interceptor JWT.
 */
import axios from "axios";

const api = axios.create({
  baseURL: "http://localhost:8000/api/v1",
  headers: { "Content-Type": "application/json" },
});

// Interceptor: adiciona JWT em cada request
api.interceptors.request.use((config) => {
  const token = localStorage.getItem("tihfsa_token");
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Interceptor: redirect para login em caso de 401
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem("tihfsa_token");
      localStorage.removeItem("tihfsa_user");
      if (window.location.pathname !== "/login") {
        window.location.href = "/login";
      }
    }
    return Promise.reject(error);
  }
);

export default api;
