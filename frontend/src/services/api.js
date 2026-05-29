import axios from 'axios';

const api = axios.create({
  baseURL: process.env.REACT_APP_API_URL || 'http://localhost:5000/api',
});

// Safe localStorage helpers — never throw
function getToken(key) {
  try { return localStorage.getItem(key); } catch { return null; }
}
function setToken(key, value) {
  try { localStorage.setItem(key, value); } catch { /* private browsing / quota */ }
}
function removeToken(key) {
  try { localStorage.removeItem(key); } catch { /* ignored */ }
}

// Attach access token to every request
api.interceptors.request.use((config) => {
  const token = getToken('accessToken');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Handle 401 — attempt token refresh once, then redirect to login
let isRefreshing = false;
let failedQueue = [];

const processQueue = (error, token = null) => {
  failedQueue.forEach((p) => (error ? p.reject(error) : p.resolve(token)));
  failedQueue = [];
};

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    if (error.response?.status === 401 && !originalRequest._retry && !originalRequest.url?.includes('/auth/')) {
      if (isRefreshing) {
        return new Promise((resolve, reject) => {
          failedQueue.push({ resolve, reject });
        }).then((token) => {
          originalRequest.headers.Authorization = `Bearer ${token}`;
          return api(originalRequest);
        });
      }

      originalRequest._retry = true;
      isRefreshing = true;

      const refreshToken = getToken('refreshToken');
      if (!refreshToken) {
        removeToken('accessToken');
        window.location.href = '/login';
        return Promise.reject(error);
      }

      try {
        const res = await axios.post(
          `${api.defaults.baseURL}/auth/refresh`,
          { refreshToken },
          { timeout: 10000 }
        );
        const { accessToken } = res.data;
        setToken('accessToken', accessToken);
        processQueue(null, accessToken);
        originalRequest.headers.Authorization = `Bearer ${accessToken}`;
        return api(originalRequest);
      } catch (refreshError) {
        processQueue(refreshError, null);
        removeToken('accessToken');
        removeToken('refreshToken');
        window.location.href = '/login';
        return Promise.reject(refreshError);
      } finally {
        isRefreshing = false;
      }
    }
    return Promise.reject(error);
  }
);

// Auth
export const loginUser = (email, password) => api.post('/auth/login', { email, password });
export const registerUser = (data) => api.post('/auth/register', data);
export const refreshAccessToken = (refreshToken) => api.post('/auth/refresh', { refreshToken });
export const changePassword = (data) => api.put('/auth/change-password', data);
export const getMe = () => api.get('/auth/me');

// RFPs
export const createRfp = (rawInput) => api.post('/rfps', { rawInput });
export const listRfps = () => api.get('/rfps');
export const getRfp = (id) => api.get(`/rfps/${id}`);
export const updateRfp = (id, data) => api.put(`/rfps/${id}`, data);
export const deleteRfp = (id) => api.delete(`/rfps/${id}`);
export const sendRfpToVendors = (id, vendorIds) => api.post(`/rfps/${id}/send`, { vendorIds });
export const compareProposals = (rfpId) => api.post(`/rfps/${rfpId}/compare`);

// Vendors
export const createVendor = (data) => api.post('/vendors', data);
export const listVendors = (params) => api.get('/vendors', { params });
export const getVendor = (id) => api.get(`/vendors/${id}`);
export const updateVendor = (id, data) => api.put(`/vendors/${id}`, data);
export const deleteVendor = (id) => api.delete(`/vendors/${id}`);

// Proposals
export const createProposal = (data) => api.post('/proposals/manual', data);
export const uploadProposal = (formData) => api.post('/proposals/upload', formData, {
  headers: { 'Content-Type': 'multipart/form-data' },
});
export const listProposals = (rfpId) => api.get('/proposals', { params: { rfpId } });
export const getProposal = (id) => api.get(`/proposals/${id}`);
export const parseProposal = (id) => api.post(`/proposals/${id}/parse`);
export const fetchEmails = () => api.post('/proposals/fetch-emails');

// RFP Documents (Analyzer)
export const uploadRfpDocument = (formData) => api.post('/rfp-documents/upload', formData, {
  headers: { 'Content-Type': 'multipart/form-data' },
});
export const extractRfpRequirements = (id) => api.post(`/rfp-documents/${id}/extract`);
export const listRfpDocuments = () => api.get('/rfp-documents');
export const getRfpDocument = (id) => api.get(`/rfp-documents/${id}`);
export const deleteRfpDocument = (id) => api.delete(`/rfp-documents/${id}`);

// Generated Proposals
export const generateProposalFromRfp = (docId, companyProfile) => api.post(`/rfp-documents/${docId}/generate`, { companyProfile });
export const listGeneratedProposals = (docId) => api.get(`/rfp-documents/${docId}/proposals`);
export const getGeneratedProposal = (docId, id) => api.get(`/rfp-documents/${docId}/proposals/${id}`);
export const updateGeneratedProposal = (docId, id, data) => api.put(`/rfp-documents/${docId}/proposals/${id}`, data);
export const exportProposal = (docId, id, format = 'pdf') => api.get(`/rfp-documents/${docId}/proposals/${id}/export`, {
  params: { format },
  responseType: 'blob',
});

// Semantic Search (RAG)
export const semanticSearch = (query, options = {}) => api.post('/search', { query, ...options });
export const indexDocument = (sourceType, sourceId) => api.post(`/search/index/${sourceType}/${sourceId}`);
export const indexAllDocuments = () => api.post('/search/index-all');
export const getSearchStats = () => api.get('/search/stats');

// Compliance Checker
export const checkCompliance = (data) => api.post('/compliance/check', data);

// Risk Analysis
export const analyzeRisks = (data) => api.post('/risk-analysis', data);
export const getRiskAnalysis = (id) => api.get(`/risk-analysis/${id}`);
export const listRiskAnalyses = (params) => api.get('/risk-analysis', { params });
export const compareRiskProfiles = (analysisIds) => api.post('/risk-analysis/compare', { analysisIds });
export const deleteRiskAnalysis = (id) => api.delete(`/risk-analysis/${id}`);

// Chat
export const createConversation = (title) => api.post('/chat/conversations', { title });
export const listConversations = (params) => api.get('/chat/conversations', { params });
export const getConversation = (id) => api.get(`/chat/conversations/${id}`);
export const sendChatMessage = (conversationId, content, options) => api.post(`/chat/conversations/${conversationId}/messages`, { content, options });
export const archiveConversation = (id) => api.put(`/chat/conversations/${id}/archive`);
export const deleteConversation = (id) => api.delete(`/chat/conversations/${id}`);
export const getSuggestedQuestions = (conversationId) => api.get(`/chat/conversations/${conversationId}/suggestions`);

// Jobs
export const getJobStatus = (jobId) => api.get(`/jobs/${jobId}`);

// Analytics
export const getAnalytics = () => api.get('/analytics');

// Notifications
export const listNotifications = (params) => api.get('/notifications', { params });
export const getNotificationStats = () => api.get('/notifications/stats');

// Admin
export const listUsers = (params) => api.get('/admin/users', { params });
export const getUser = (id) => api.get(`/admin/users/${id}`);
export const changeUserRole = (id, role) => api.put(`/admin/users/${id}/role`, { role });
export const changeUserStatus = (id, status) => api.put(`/admin/users/${id}/status`, { status });

export default api;
