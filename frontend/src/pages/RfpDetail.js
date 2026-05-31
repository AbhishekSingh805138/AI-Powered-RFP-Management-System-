import React, { useState, useEffect, useCallback } from 'react';
import { useParams, Link } from 'react-router-dom';
import {
  getRfp, updateRfp, sendRfpToVendors, compareProposals,
  listVendors, createProposal, parseProposal, fetchEmails, uploadProposal,
} from '../services/api';

function RfpDetail() {
  const { id } = useParams();
  const [rfp, setRfp] = useState(null);
  const [allVendors, setAllVendors] = useState([]);
  const [selectedVendors, setSelectedVendors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [comparing, setComparing] = useState(false);
  const [fetching, setFetching] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [showAddProposal, setShowAddProposal] = useState(false);
  const [manualProposal, setManualProposal] = useState({ vendorId: '', rawContent: '' });
  const [comparisonResult, setComparisonResult] = useState(null);
  const [pdfFile, setPdfFile] = useState(null);
  const [pdfVendorId, setPdfVendorId] = useState('');

  const loadRfp = useCallback(async () => {
    try {
      const res = await getRfp(id);
      setRfp(res.data);
      if (res.data.comparisons?.length > 0) {
        setComparisonResult(res.data.comparisons[0]);
      }
    } catch (err) {
      setError('Failed to load RFP');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    loadRfp();
    listVendors({ limit: 100 }).then((res) => setAllVendors(res.data.data || res.data)).catch(() => {
      // Vendor dropdown will be empty — non-critical, RFP still loads
    });
  }, [loadRfp]);

  const handleSend = async () => {
    if (selectedVendors.length === 0) return setError('Select at least one vendor');
    setSending(true);
    setError('');
    setMessage('');
    try {
      const res = await sendRfpToVendors(id, selectedVendors);
      setMessage(`Sent to ${res.data.results.filter((r) => r.status === 'sent').length} vendor(s)`);
      setSelectedVendors([]);
      await loadRfp();
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to send');
    } finally {
      setSending(false);
    }
  };

  const handleFetchEmails = async () => {
    setFetching(true);
    setMessage('');
    setError('');
    try {
      const res = await fetchEmails();
      setMessage(res.data.message);
      await loadRfp();
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to fetch emails');
    } finally {
      setFetching(false);
    }
  };

  const handleAddProposal = async (e) => {
    e.preventDefault();
    try {
      await createProposal({
        rfpId: parseInt(id, 10),
        vendorId: parseInt(manualProposal.vendorId, 10),
        rawContent: manualProposal.rawContent,
        sourceType: 'manual',
      });
      setShowAddProposal(false);
      setManualProposal({ vendorId: '', rawContent: '' });
      setMessage('Proposal added');
      await loadRfp();
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to add proposal');
    }
  };

  const handlePdfSelect = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setPdfFile(file);
    setPdfVendorId('');
    e.target.value = '';
  };

  const handleUploadPdf = async () => {
    if (!pdfFile || !pdfVendorId) return;

    const formData = new FormData();
    formData.append('file', pdfFile);
    formData.append('rfpId', id);
    formData.append('vendorId', pdfVendorId);

    try {
      await uploadProposal(formData);
      setMessage('PDF uploaded and text extracted');
      setPdfFile(null);
      setPdfVendorId('');
      await loadRfp();
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to upload PDF');
    }
  };

  const handleParseProposal = async (proposalId) => {
    try {
      await parseProposal(proposalId);
      setMessage('Proposal parsed successfully');
      await loadRfp();
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to parse proposal');
    }
  };

  const handleCompare = async () => {
    setComparing(true);
    setError('');
    setMessage('');
    try {
      const res = await compareProposals(id);
      setComparisonResult(res.data.comparison);
      setMessage('Comparison complete');
      await loadRfp();
    } catch (err) {
      setError(err.response?.data?.error || 'Need at least 2 parsed proposals');
    } finally {
      setComparing(false);
    }
  };

  if (loading) return <div className="loading">Loading RFP...</div>;
  if (!rfp) return <div className="error-msg">RFP not found</div>;

  const structured = rfp.structuredData || {};
  const proposals = rfp.proposals || [];
  const parsedCount = proposals.filter((p) => p.status === 'parsed').length;

  return (
    <div>
      <div className="page-header">
        <h1>RFP-{String(rfp.id).padStart(4, '0')}: {rfp.title}</h1>
        <span className={`badge badge-${rfp.status}`}>{rfp.status}</span>
      </div>

      {error && <div className="error-msg">{error}</div>}
      {message && <div className="success-msg">{message}</div>}

      {/* RFP Details */}
      <div className="grid-2 mb-16">
        <div className="card">
          <h2>RFP Details</h2>
          <p><strong>Budget:</strong> {rfp.budget ? `$${Number(rfp.budget).toLocaleString()} ${rfp.currency}` : 'Not specified'}</p>
          <p><strong>Delivery:</strong> {rfp.deliveryDays ? `${rfp.deliveryDays} days` : 'Not specified'}</p>
          <p><strong>Payment Terms:</strong> {structured.terms?.paymentTerms || 'Not specified'}</p>
          <p><strong>Warranty:</strong> {structured.terms?.warranty || 'Not specified'}</p>

          {structured.items && (
            <div className="mt-16">
              <h3>Items Required</h3>
              <table>
                <thead>
                  <tr><th>Item</th><th>Qty</th><th>Specifications</th></tr>
                </thead>
                <tbody>
                  {structured.items.map((item, i) => (
                    <tr key={i}>
                      <td>{item.name}</td>
                      <td>{item.quantity}</td>
                      <td>{item.specifications}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div className="card">
          <h2>Original Input</h2>
          <p style={{ whiteSpace: 'pre-wrap', color: '#555' }}>{rfp.rawInput}</p>
        </div>
      </div>

      {/* Send to Vendors */}
      <div className="card">
        <div className="flex-between">
          <h2>Send to Vendors</h2>
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={handleSend} className="btn btn-primary" disabled={sending || selectedVendors.length === 0}>
              {sending ? 'Sending...' : `Send to ${selectedVendors.length} vendor(s)`}
            </button>
          </div>
        </div>

        {rfp.vendors?.length > 0 && (
          <div className="mb-16 mt-16">
            <h3>Already Sent To</h3>
            {rfp.vendors.map((v) => (
              <div key={v.id} style={{ fontSize: 14, padding: '4px 0' }}>
                {v.name} ({v.email}) — <span className={`badge badge-${v.RfpVendor?.email_status || 'sent'}`}>
                  {v.RfpVendor?.email_status || 'sent'}
                </span>
              </div>
            ))}
          </div>
        )}

        <div className="mt-16">
          <h3>Select Vendors</h3>
          {allVendors.length === 0 ? (
            <p>No vendors yet. <Link to="/vendors">Add vendors</Link></p>
          ) : (
            allVendors.map((v) => (
              <div key={v.id} className="vendor-checkbox">
                <input
                  type="checkbox"
                  id={`vendor-${v.id}`}
                  checked={selectedVendors.includes(v.id)}
                  onChange={(e) => {
                    if (e.target.checked) {
                      setSelectedVendors([...selectedVendors, v.id]);
                    } else {
                      setSelectedVendors(selectedVendors.filter((vid) => vid !== v.id));
                    }
                  }}
                />
                <label htmlFor={`vendor-${v.id}`}>{v.name} — {v.email} {v.company ? `(${v.company})` : ''}</label>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Proposals */}
      <div className="card">
        <div className="flex-between">
          <h2>Proposals ({proposals.length})</h2>
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={handleFetchEmails} className="btn btn-secondary" disabled={fetching}>
              {fetching ? 'Checking...' : 'Fetch Emails'}
            </button>
            <button onClick={() => setShowAddProposal(!showAddProposal)} className="btn btn-primary">
              + Add Manually
            </button>
            <label className="btn btn-success" style={{ cursor: 'pointer' }}>
              Upload PDF
              <input type="file" accept=".pdf" onChange={handlePdfSelect} style={{ display: 'none' }} />
            </label>
          </div>
        </div>

        {pdfFile && (
          <div className="mt-16" style={{ borderTop: '1px solid #eee', paddingTop: 16, marginBottom: 16 }}>
            <h3>Upload PDF: {pdfFile.name}</h3>
            <div className="grid-2" style={{ marginTop: 8 }}>
              <div className="form-group">
                <label>Select Vendor for this PDF</label>
                <select value={pdfVendorId} onChange={(e) => setPdfVendorId(e.target.value)}>
                  <option value="">Select vendor...</option>
                  {allVendors.map((v) => <option key={v.id} value={v.id}>{v.name}</option>)}
                </select>
              </div>
            </div>
            <button onClick={handleUploadPdf} className="btn btn-primary" disabled={!pdfVendorId} style={{ marginRight: 8 }}>
              Upload
            </button>
            <button onClick={() => { setPdfFile(null); setPdfVendorId(''); }} className="btn btn-secondary">
              Cancel
            </button>
          </div>
        )}

        {showAddProposal && (
          <form onSubmit={handleAddProposal} className="mt-16" style={{ borderTop: '1px solid #eee', paddingTop: 16 }}>
            <div className="grid-2">
              <div className="form-group">
                <label>Vendor</label>
                <select value={manualProposal.vendorId} onChange={(e) => setManualProposal({ ...manualProposal, vendorId: e.target.value })}>
                  <option value="">Select vendor...</option>
                  {allVendors.map((v) => <option key={v.id} value={v.id}>{v.name}</option>)}
                </select>
              </div>
            </div>
            <div className="form-group">
              <label>Proposal Content</label>
              <textarea
                value={manualProposal.rawContent}
                onChange={(e) => setManualProposal({ ...manualProposal, rawContent: e.target.value })}
                placeholder="Paste vendor's proposal text here..."
                rows={6}
              />
            </div>
            <button type="submit" className="btn btn-primary" disabled={!manualProposal.vendorId || !manualProposal.rawContent}>
              Add Proposal
            </button>
          </form>
        )}

        {proposals.length > 0 && (
          <table className="mt-16">
            <thead>
              <tr>
                <th>Vendor</th>
                <th>Source</th>
                <th>Status</th>
                <th>Total Price</th>
                <th>Score</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {proposals.map((p) => (
                <tr key={p.id}>
                  <td>{p.vendor?.name || `Vendor ${p.vendorId}`}</td>
                  <td>{p.sourceType}</td>
                  <td><span className={`badge badge-${p.status}`}>{p.status}</span></td>
                  <td>{p.totalPrice ? `$${Number(p.totalPrice).toLocaleString()}` : '—'}</td>
                  <td>
                    {p.score ? (
                      <div>
                        <strong>{Number(p.score).toFixed(1)}</strong>/100
                        <div className="score-bar">
                          <div
                            className="score-bar-fill"
                            style={{
                              width: `${p.score}%`,
                              background: p.score >= 70 ? '#2ec4b6' : p.score >= 50 ? '#ffc107' : '#e63946',
                            }}
                          />
                        </div>
                      </div>
                    ) : '—'}
                  </td>
                  <td>
                    {(p.status === 'received' || p.status === 'error') && (
                      <button onClick={() => handleParseProposal(p.id)} className="btn btn-success btn-sm">
                        Parse with AI
                      </button>
                    )}
                    {p.status === 'parsed' && p.parsedData && (
                      <details>
                        <summary className="btn btn-secondary btn-sm">View Parsed</summary>
                        <pre style={{ fontSize: 11, maxHeight: 200, overflow: 'auto', marginTop: 8, background: '#f8f9fa', padding: 8, borderRadius: 4 }}>
                          {JSON.stringify(p.parsedData, null, 2)}
                        </pre>
                      </details>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Compare & Recommend */}
      <div className="card">
        <div className="flex-between">
          <h2>AI Comparison & Recommendation</h2>
          <button
            onClick={handleCompare}
            className="btn btn-primary"
            disabled={comparing || parsedCount < 2}
          >
            {comparing ? 'AI is comparing...' : `Compare ${parsedCount} Proposals`}
          </button>
        </div>

        {parsedCount < 2 && (
          <p className="mt-16" style={{ color: '#888' }}>
            Need at least 2 parsed proposals to compare. Current: {parsedCount} parsed.
          </p>
        )}

        {comparisonResult && comparisonResult.recommendation && (
          <div className="mt-16">
            <div className="recommendation-box">
              <h3>Recommended: {comparisonResult.recommendation.vendorName}</h3>
              <p><strong>Confidence:</strong> {comparisonResult.recommendation.confidence}</p>
              <p>{comparisonResult.recommendation.reasoning}</p>
              {comparisonResult.recommendation.caveats?.length > 0 && (
                <div style={{ marginTop: 12 }}>
                  <strong>Caveats:</strong>
                  <ul style={{ paddingLeft: 20, marginTop: 4 }}>
                    {comparisonResult.recommendation.caveats.map((c, i) => <li key={i}>{c}</li>)}
                  </ul>
                </div>
              )}
            </div>

            {comparisonResult.summary && (
              <div className="card">
                <h3>Executive Summary</h3>
                <p style={{ whiteSpace: 'pre-wrap' }}>{comparisonResult.summary}</p>
              </div>
            )}

            {comparisonResult.comparisonData && (
              <div className="card">
                <h3>Score Breakdown</h3>
                <table className="comparison-table">
                  <thead>
                    <tr>
                      <th>Vendor</th>
                      <th>Price</th>
                      <th>Specs</th>
                      <th>Delivery</th>
                      <th>Payment</th>
                      <th>Warranty</th>
                      <th>Overall</th>
                      <th>Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(Array.isArray(comparisonResult.comparisonData) ? comparisonResult.comparisonData : []).map((vs, i) => (
                      <tr key={i}>
                        <td><strong>{vs.vendorName}</strong></td>
                        <td>{vs.scores?.price_competitiveness}</td>
                        <td>{vs.scores?.specification_compliance}</td>
                        <td>{vs.scores?.delivery_timeline}</td>
                        <td>{vs.scores?.payment_terms}</td>
                        <td>{vs.scores?.warranty_coverage}</td>
                        <td>{vs.scores?.overall_value}</td>
                        <td><strong>{vs.totalScore?.toFixed(1)}</strong></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export default RfpDetail;
