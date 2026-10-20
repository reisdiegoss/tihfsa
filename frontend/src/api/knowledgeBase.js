/**
 * API Knowledge Base — Comunicação com o backend da Base de Conhecimento.
 */
import api from "./client";

export const knowledgeBaseApi = {
  // Categorias
  getCategories: async () => {
    const res = await api.get("/kb/categories");
    return res.data;
  },

  createCategory: async (data) => {
    const res = await api.post("/kb/categories", data);
    return res.data;
  },

  // Artigos
  getArticles: async (params = {}) => {
    const res = await api.get("/kb/articles", { params });
    return res.data;
  },

  getArticle: async (idOrSlug) => {
    const res = await api.get(`/kb/articles/${idOrSlug}`);
    return res.data;
  },

  sendFeedback: async (articleId, isHelpful) => {
    const res = await api.post(`/kb/articles/${articleId}/feedback`, { is_helpful: isHelpful });
    return res.data;
  },

  createArticle: async (data) => {
    const res = await api.post("/kb/articles", data);
    return res.data;
  },

  updateArticle: async (articleId, data) => {
    const res = await api.put(`/kb/articles/${articleId}`, data);
    return res.data;
  },

  deleteArticle: async (articleId) => {
    const res = await api.delete(`/kb/articles/${articleId}`);
    return res.data;
  },

  triggerSeed: async (overwrite = false) => {
    const res = await api.post("/kb/seed", null, { params: { overwrite } });
    return res.data;
  },
};

export default knowledgeBaseApi;
