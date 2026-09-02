/**
 * API Client — Axios configurado com base URL e interceptor JWT.
 */
import axios from "axios";

const API_BASE = `http://${window.location.hostname}:8000/api/v1`;

const api = axios.create({
  baseURL: API_BASE,
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
      // Não redireciona para login se estiver navegando em rotas públicas (como o painel NOC de TV)
      const isPublicPath = window.location.pathname.startsWith("/noc");
      if (window.location.pathname !== "/login" && !isPublicPath) {
        window.location.href = "/login";
      }
    }
    return Promise.reject(error);
  }
);

export default api;
