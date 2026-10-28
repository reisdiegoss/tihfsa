/**
 * API Projects — Comunicação com o backend de Gestão de Projetos, Kanban, CMDB, Equipe e Timeline.
 */
import api from "./client";

export const projectsApi = {
  // Projetos
  getProjects: async (params = {}) => {
    const res = await api.get("/projects", { params });
    return res.data;
  },

  getProject: async (projectId) => {
    const res = await api.get(`/projects/${projectId}`);
    return res.data;
  },

  createProject: async (data) => {
    const res = await api.post("/projects", data);
    return res.data;
  },

  updateProject: async (projectId, data) => {
    const res = await api.put(`/projects/${projectId}`, data);
    return res.data;
  },

  deleteProject: async (projectId) => {
    const res = await api.delete(`/projects/${projectId}`);
    return res.data;
  },

  // Tarefas / Kanban
  createTask: async (projectId, data) => {
    const res = await api.post(`/projects/${projectId}/tasks`, data);
    return res.data;
  },

  updateTask: async (projectId, taskId, data) => {
    const res = await api.put(`/projects/${projectId}/tasks/${taskId}`, data);
    return res.data;
  },

  deleteTask: async (projectId, taskId) => {
    const res = await api.delete(`/projects/${projectId}/tasks/${taskId}`);
    return res.data;
  },

  // Chamados Vinculados
  createTicketForProject: async (projectId, data) => {
    const res = await api.post(`/projects/${projectId}/create-ticket`, data);
    return res.data;
  },

  linkTicket: async (projectId, ticketId) => {
    const res = await api.post(`/projects/${projectId}/link-ticket`, { ticket_id: ticketId });
    return res.data;
  },

  unlinkTicket: async (projectId, ticketId) => {
    const res = await api.delete(`/projects/${projectId}/unlink-ticket/${ticketId}`);
    return res.data;
  },

  // Equipe / Membros Técnicos
  addMember: async (projectId, userId) => {
    const res = await api.post(`/projects/${projectId}/members`, { user_id: userId });
    return res.data;
  },

  removeMember: async (projectId, userId) => {
    const res = await api.delete(`/projects/${projectId}/members/${userId}`);
    return res.data;
  },

  // Ativos CMDB Vinculados
  linkAsset: async (projectId, assetId) => {
    const res = await api.post(`/projects/${projectId}/assets`, { asset_id: assetId });
    return res.data;
  },

  unlinkAsset: async (projectId, assetId) => {
    const res = await api.delete(`/projects/${projectId}/assets/${assetId}`);
    return res.data;
  },

  // Linha do Tempo (Timeline & Comentários)
  getTimeline: async (projectId) => {
    const res = await api.get(`/projects/${projectId}/timeline`);
    return res.data;
  },

  addTimelineComment: async (projectId, content, eventType = "comment") => {
    const res = await api.post(`/projects/${projectId}/timeline`, {
      content,
      event_type: eventType,
    });
    return res.data;
  },
};

export default projectsApi;
