import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { uploadRfpDocument, listRfpDocuments, deleteRfpDocument, extractRfpRequirements, getRfpDocument } from '../services/api';
import { useJobPoller } from '../hooks/useJobPoller';

function RfpAnalyzerUpload() {
  const [documents, setDocuments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');
  const [dragActive, setDragActive] = useState(false);
  const fileInputRef = useRef(null);
  const navigate = useNavigate();
  const { pollJob } = useJobPoller();

  useEffect(() => {
    loadDocuments();
  }, []);

  const loadDocuments = async () => {
    try {
      const res = await listRfpDocuments();
      setDocuments(res.data);
    } catch (err) {
      setError('Failed to load documents');
    } finally {
      setLoading(false);
    }
  };

  const handleUpload = async (file) => {
    if (!file || file.type !== 'application/pdf') {
      setError('Please upload a PDF file');
      return;
    }

    setUploading(true);
    setError('');

    try {
      const formData = new FormData();
      formData.append('file', file);
      const res = await uploadRfpDocument(formData);
      const doc = res.data;

      // Auto-trigger extraction
      setDocuments((prev) => [{ ...doc, status: 'extracting' }, ...prev]);
      try {
        const extracted = await extractRfpRequirements(doc.id);

        if (extracted.status === 202 && extracted.data.jobId) {
          // Async job — poll until done
          pollJob(
            extracted.data.jobId,
            async () => {
              const refreshed = await getRfpDocument(doc.id);
              setDocuments((prev) => prev.map((d) => (d.id === doc.id ? refreshed.data : d)));
            },
            (errMsg) => {
              setDocuments((prev) => prev.map((d) => (d.id === doc.id ? { ...d, status: 'error' } : d)));
              setError(`Extraction failed: ${errMsg}`);
            }
          );
        } else {
          setDocuments((prev) => prev.map((d) => (d.id === doc.id ? extracted.data : d)));
        }
      } catch (extractErr) {
        setDocuments((prev) =>
          prev.map((d) => (d.id === doc.id ? { ...d, status: 'error' } : d))
        );
        setError('Upload succeeded but extraction failed. You can retry from the document view.');
      }
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to upload document');
    } finally {
      setUploading(false);
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setDragActive(false);
    const file = e.dataTransfer.files[0];
    handleUpload(file);
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    setDragActive(true);
  };

  const handleDragLeave = () => setDragActive(false);

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this document and all generated proposals?')) return;
    try {
      await deleteRfpDocument(id);
      setDocuments((prev) => prev.filter((d) => d.id !== id));
    } catch (err) {
      setError('Failed to delete document');
    }
  };

  const formatFileSize = (bytes) => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1048576) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / 1048576).toFixed(1) + ' MB';
  };

  const statusBadge = (status) => {
    const map = {
      uploaded: 'badge-received',
      extracting: 'badge-parsing',
      extracted: 'badge-parsed',
      error: 'badge-error',
    };
    return <span className={`badge ${map[status] || ''}`}>{status}</span>;
  };

  if (loading) return <div className="loading">Loading documents...</div>;

  return (
    <div>
      <div className="page-header">
        <h1>RFP Analyzer</h1>
      </div>

      {error && <div className="error-msg">{error}</div>}

      <div
        className={`card drop-zone ${dragActive ? 'drop-zone-active' : ''}`}
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onClick={() => fileInputRef.current?.click()}
        style={{ cursor: 'pointer' }}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept=".pdf"
          style={{ display: 'none' }}
          onChange={(e) => handleUpload(e.target.files[0])}
        />
        <div className="drop-zone-content">
          <div className="drop-zone-icon">
            {uploading ? (
              <span className="spinner-text">Uploading & Analyzing...</span>
            ) : (
              <>
                <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#4361ee" strokeWidth="1.5">
                  <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M17 8l-5-5-5 5M12 3v12" />
                </svg>
                <h3>Upload RFP Document</h3>
                <p>Drag & drop a PDF file here, or click to browse</p>
                <p className="drop-zone-hint">AI will automatically extract requirements, deadlines, and compliance items</p>
              </>
            )}
          </div>
        </div>
      </div>

      <div className="card">
        <h2>Uploaded Documents ({documents.length})</h2>

        {documents.length === 0 ? (
          <p style={{ color: '#888', padding: '20px 0' }}>
            No documents yet. Upload an RFP PDF to get started.
          </p>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Document</th>
                <th>Size</th>
                <th>Status</th>
                <th>Proposals</th>
                <th>Uploaded</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {documents.map((doc) => (
                <tr key={doc.id}>
                  <td>
                    <strong>{doc.title || doc.originalFilename}</strong>
                    {doc.title && (
                      <div style={{ fontSize: 12, color: '#888' }}>{doc.originalFilename}</div>
                    )}
                  </td>
                  <td>{formatFileSize(doc.fileSize)}</td>
                  <td>{statusBadge(doc.status)}</td>
                  <td>{doc.generatedProposals?.length || 0}</td>
                  <td>{new Date(doc.createdAt).toLocaleDateString()}</td>
                  <td>
                    <div style={{ display: 'flex', gap: 8 }}>
                      {doc.status === 'extracted' && (
                        <button
                          className="btn btn-primary btn-sm"
                          onClick={() => navigate(`/rfp-analyzer/${doc.id}`)}
                        >
                          View Analysis
                        </button>
                      )}
                      {doc.status === 'error' && (
                        <button
                          className="btn btn-success btn-sm"
                          onClick={() => navigate(`/rfp-analyzer/${doc.id}`)}
                        >
                          Retry
                        </button>
                      )}
                      <button
                        className="btn btn-danger btn-sm"
                        onClick={() => handleDelete(doc.id)}
                      >
                        Delete
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

export default RfpAnalyzerUpload;
