import axios from 'axios';

const api = axios.create({
  baseURL: process.env.REACT_APP_API_URL || 'http://localhost:5000/api',
});

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

export default api;
