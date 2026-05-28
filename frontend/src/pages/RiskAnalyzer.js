import React, { useState, useEffect } from 'react';
import { listRfpDocuments, listGeneratedProposals, analyzeRisks, listRiskAnalyses, getRiskAnalysis, compareRiskProfiles, deleteRiskAnalysis } from '../services/api';

function RiskAnalyzer() {
  const [rfpDocuments, setRfpDocuments] = useState([]);
  const [proposals, setProposals] = useState([]);
  const [selectedRfp, setSelectedRfp] = useState('');
  const [selectedProposal, setSelectedProposal] = useState('');
  const [loading, setLoading] = useState(true);
  const [analyzing, setAnalyzing] = useState(false);
  const [report, setReport] = useState(null);
  const [history, setHistory] = useState([]);
  const [error, setError] = useState('');
  const [view, setView] = useState('form'); // 'form' | 'report' | 'history'

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    if (selectedRfp) {
      loadProposals(selectedRfp);
    } else {
      setProposals([]);
      setSelectedProposal('');
    }
  }, [selectedRfp]);

  const loadData = async () => {
    try {
      const [docsRes, historyRes] = await Promise.all([
        listRfpDocuments(),
        listRiskAnalyses(),
      ]);
      setRfpDocuments(docsRes.data.filter((d) => d.status === 'extracted'));
      setHistory(historyRes.data);
    } catch (err) {
      setError('Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  const loadProposals = async (rfpDocId) => {
    try {
      const res = await listGeneratedProposals(rfpDocId);
      setProposals(res.data);
    } catch (err) {
      setProposals([]);
    }
  };

  const handleAnalyze = async () => {
    if (!selectedRfp) {
      setError('Please select an RFP document');
      return;
    }

    setAnalyzing(true);
    setError('');

    try {
      const data = { rfpDocumentId: parseInt(selectedRfp, 10) };
      if (selectedProposal) {
        data.generatedProposalId = parseInt(selectedProposal, 10);
      }

      const res = await analyzeRisks(data);
      setReport(res.data);
      setView('report');
      loadData(); // refresh history
    } catch (err) {
      setError(err.response?.data?.error || 'Risk analysis failed');
    } finally {
      setAnalyzing(false);
    }
  };

  const handleViewReport = async (id) => {
    try {
      setLoading(true);
      const res = await getRiskAnalysis(id);
      setReport(res.data);
      setView('report');
    } catch (err) {
      setError('Failed to load analysis');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id) => {
    try {
      await deleteRiskAnalysis(id);
      setHistory(history.filter((h) => h.id !== id));
    } catch (err) {
      setError('Failed to delete analysis');
    }
  };

  const getRiskLevelColor = (level) => {
    const colors = { critical: '#e63946', high: '#f4845f', medium: '#f4a261', low: '#2ec4b6' };
    return colors[level] || '#888';
  };

  const getSeverityBg = (severity) => {
    const bgs = { critical: '#fde8ea', high: '#fef0eb', medium: '#fef7ec', low: '#e8f8f5' };
    return bgs[severity] || '#f5f5f5';
  };

  const getLikelihoodLabel = (likelihood) => {
    const labels = { very_likely: 'Very Likely', likely: 'Likely', possible: 'Possible', unlikely: 'Unlikely' };
    return labels[likelihood] || likelihood;
  };

  if (loading) return <div className="loading">Loading...</div>;

  return (
    <div>
      <div className="page-header">
        <h1>Risk Analyzer</h1>
        {view !== 'form' && (
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="btn btn-secondary" onClick={() => { setView('form'); setReport(null); }}>
              New Analysis
            </button>
            <button className="btn btn-secondary" onClick={() => setView('history')}>
              History ({history.length})
            </button>
          </div>
        )}
      </div>

      {error && <div className="error-msg">{error}</div>}

      {/* Analysis Form */}
      {view === 'form' && (
        <>
          <div className="card">
            <h2>Analyze RFP Risk</h2>
            <p style={{ color: '#666', marginBottom: 16 }}>
              Select an RFP document to run an AI-powered multi-category risk assessment.
              Optionally include a proposal to analyze gaps.
            </p>

            <div className="form-group">
              <label>RFP Document *</label>
              <select value={selectedRfp} onChange={(e) => setSelectedRfp(e.target.value)}>
                <option value="">Select an analyzed RFP document...</option>
                {rfpDocuments.map((doc) => (
                  <option key={doc.id} value={doc.id}>
                    {doc.title || doc.originalFilename}
                  </option>
                ))}
              </select>
            </div>

            {selectedRfp && (
              <div className="form-group">
                <label>Generated Proposal (optional)</label>
                <select value={selectedProposal} onChange={(e) => setSelectedProposal(e.target.value)}>
                  <option value="">Analyze RFP risks only...</option>
                  {proposals.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.title || `Proposal v${p.version}`} [{p.status}]
                    </option>
                  ))}
                </select>
              </div>
            )}

            <button
              className="btn btn-primary"
              onClick={handleAnalyze}
              disabled={analyzing || !selectedRfp}
              style={{ fontSize: 16, padding: '12px 32px' }}
            >
              {analyzing ? 'Analyzing Risks...' : 'Run Risk Analysis'}
            </button>
          </div>

          {/* History Preview */}
          {history.length > 0 && (
            <div className="card">
              <h2>Recent Analyses</h2>
              <table>
                <thead>
                  <tr>
                    <th>RFP</th>
                    <th>Score</th>
                    <th>Level</th>
                    <th>Date</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {history.slice(0, 5).map((item) => (
                    <tr key={item.id}>
                      <td>{item.rfpDocument?.title || item.rfpDocument?.originalFilename || `Doc #${item.rfpDocumentId}`}</td>
                      <td><strong>{item.overallRiskScore}</strong>/100</td>
                      <td>
                        <span className="risk-level-badge" style={{ color: getRiskLevelColor(item.overallRiskLevel), fontWeight: 600, textTransform: 'uppercase', fontSize: 12 }}>
                          {item.overallRiskLevel}
                        </span>
                      </td>
                      <td style={{ fontSize: 13, color: '#888' }}>{new Date(item.createdAt).toLocaleDateString()}</td>
                      <td>
                        <button className="btn btn-sm btn-secondary" onClick={() => handleViewReport(item.id)}>View</button>
                        {' '}
                        <button className="btn btn-sm btn-danger" onClick={() => handleDelete(item.id)}>Delete</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {history.length > 5 && (
                <button className="btn btn-sm btn-secondary" onClick={() => setView('history')} style={{ marginTop: 8 }}>
                  View All ({history.length})
                </button>
              )}
            </div>
          )}
        </>
      )}

      {/* Full History View */}
      {view === 'history' && (
        <div className="card">
          <h2>All Risk Analyses ({history.length})</h2>
          <table>
            <thead>
              <tr>
                <th>ID</th>
                <th>RFP</th>
                <th>Score</th>
                <th>Level</th>
                <th>Status</th>
                <th>Date</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {history.map((item) => (
                <tr key={item.id}>
                  <td>#{item.id}</td>
                  <td>{item.rfpDocument?.title || `Doc #${item.rfpDocumentId}`}</td>
                  <td><strong>{item.overallRiskScore}</strong>/100</td>
                  <td>
                    <span style={{ color: getRiskLevelColor(item.overallRiskLevel), fontWeight: 600, textTransform: 'uppercase', fontSize: 12 }}>
                      {item.overallRiskLevel}
                    </span>
                  </td>
                  <td><span className={`badge badge-${item.status}`}>{item.status}</span></td>
                  <td style={{ fontSize: 13 }}>{new Date(item.createdAt).toLocaleDateString()}</td>
                  <td>
                    <button className="btn btn-sm btn-secondary" onClick={() => handleViewReport(item.id)}>View</button>
                    {' '}
                    <button className="btn btn-sm btn-danger" onClick={() => handleDelete(item.id)}>Delete</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Risk Report */}
      {view === 'report' && report && (
        <>
          {/* Overall Score */}
          <div className="card">
            <h2>Risk Assessment Report</h2>
            {report.rfpDocument && (
              <p style={{ fontSize: 13, color: '#888', marginBottom: 16 }}>
                RFP: {report.rfpDocument.title || report.rfpDocument.originalFilename}
                {report.generatedProposal && ` | Proposal: ${report.generatedProposal.title || `v${report.generatedProposal.version}`}`}
              </p>
            )}

            <div className="risk-score-section">
              <div className="risk-score-circle" style={{
                borderColor: getRiskLevelColor(report.overallRiskLevel || report.analysisData?.overall_risk_level)
              }}>
                <span className="score-number">{report.overallRiskScore || report.analysisData?.overall_risk_score}</span>
                <span className="score-label">/ 100</span>
              </div>
              <div className="risk-score-details">
                <span className="risk-level-tag" style={{
                  background: getSeverityBg(report.overallRiskLevel || report.analysisData?.overall_risk_level),
                  color: getRiskLevelColor(report.overallRiskLevel || report.analysisData?.overall_risk_level),
                  padding: '6px 16px',
                  borderRadius: 20,
                  fontWeight: 700,
                  fontSize: 14,
                  textTransform: 'uppercase',
                }}>
                  {report.overallRiskLevel || report.analysisData?.overall_risk_level} risk
                </span>
                <p style={{ marginTop: 8, lineHeight: 1.7 }}>
                  {report.analysisData?.executive_summary}
                </p>
              </div>
            </div>
          </div>

          {/* Category Breakdown */}
          {report.analysisData?.categories && (
            <div className="card">
              <h2>Risk by Category</h2>
              <div className="risk-categories-grid">
                {report.analysisData.categories.map((cat, i) => (
                  <div key={i} className="risk-category-card" style={{ borderTop: `3px solid ${getRiskLevelColor(cat.level)}` }}>
                    <div className="flex-between" style={{ marginBottom: 8 }}>
                      <h3 style={{ margin: 0, textTransform: 'capitalize' }}>{cat.name}</h3>
                      <span style={{ color: getRiskLevelColor(cat.level), fontWeight: 700, fontSize: 20 }}>
                        {cat.score}
                      </span>
                    </div>
                    <span style={{
                      fontSize: 11,
                      textTransform: 'uppercase',
                      color: getRiskLevelColor(cat.level),
                      fontWeight: 600,
                    }}>
                      {cat.level}
                    </span>
                    <p style={{ fontSize: 13, color: '#666', marginTop: 8 }}>{cat.description}</p>
                    <div style={{ fontSize: 12, color: '#888', marginTop: 8 }}>
                      {cat.risks?.length || 0} risk{(cat.risks?.length || 0) !== 1 ? 's' : ''} identified
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Risk Matrix */}
          {report.analysisData?.risk_matrix && report.analysisData.risk_matrix.length > 0 && (
            <div className="card">
              <h2>Risk Matrix</h2>
              <table>
                <thead>
                  <tr>
                    <th>ID</th>
                    <th>Risk</th>
                    <th>Category</th>
                    <th>Severity</th>
                    <th>Likelihood</th>
                  </tr>
                </thead>
                <tbody>
                  {report.analysisData.risk_matrix.map((item, i) => (
                    <tr key={i}>
                      <td><code>{item.risk_id}</code></td>
                      <td>{item.title}</td>
                      <td style={{ textTransform: 'capitalize' }}>{item.category}</td>
                      <td>
                        <span style={{
                          color: getRiskLevelColor(item.severity),
                          fontWeight: 600,
                          fontSize: 12,
                          textTransform: 'uppercase',
                        }}>
                          {item.severity}
                        </span>
                      </td>
                      <td>{getLikelihoodLabel(item.likelihood)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Detailed Risks by Category */}
          {report.analysisData?.categories && report.analysisData.categories.map((cat, ci) => (
            cat.risks && cat.risks.length > 0 && (
              <div key={ci} className="card">
                <h2 style={{ textTransform: 'capitalize' }}>{cat.name} Risks</h2>
                {cat.risks.map((risk, ri) => (
                  <div key={ri} className="risk-detail-item" style={{
                    background: getSeverityBg(risk.severity),
                    padding: 16,
                    borderRadius: 8,
                    marginBottom: 12,
                  }}>
                    <div className="flex-between">
                      <strong><code>{risk.id}</code> {risk.title}</strong>
                      <span style={{
                        color: getRiskLevelColor(risk.severity),
                        fontWeight: 600,
                        fontSize: 12,
                        textTransform: 'uppercase',
                      }}>
                        {risk.severity}
                      </span>
                    </div>
                    <p style={{ fontSize: 13, marginTop: 8, color: '#444' }}>{risk.description}</p>
                    <div style={{ display: 'flex', gap: 16, marginTop: 8, fontSize: 12, color: '#666' }}>
                      <span>Likelihood: <strong>{getLikelihoodLabel(risk.likelihood)}</strong></span>
                      <span>Impact: <strong style={{ textTransform: 'capitalize' }}>{risk.impact}</strong></span>
                    </div>
                    {risk.affected_requirements && risk.affected_requirements.length > 0 && (
                      <div style={{ fontSize: 12, color: '#888', marginTop: 6 }}>
                        Affects: {risk.affected_requirements.join(', ')}
                      </div>
                    )}
                    <div style={{ marginTop: 8, padding: '8px 12px', background: 'rgba(255,255,255,0.7)', borderRadius: 6, fontSize: 13 }}>
                      <strong style={{ color: '#4361ee' }}>Mitigation:</strong> {risk.mitigation}
                    </div>
                    {risk.contingency && (
                      <div style={{ marginTop: 4, padding: '8px 12px', background: 'rgba(255,255,255,0.5)', borderRadius: 6, fontSize: 13 }}>
                        <strong style={{ color: '#888' }}>Contingency:</strong> {risk.contingency}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )
          ))}

          {/* Recommendations */}
          {report.analysisData?.recommendations && report.analysisData.recommendations.length > 0 && (
            <div className="card">
              <h2>Recommendations</h2>
              {report.analysisData.recommendations.map((rec, i) => (
                <div key={i} style={{ padding: '12px 16px', borderLeft: `3px solid ${rec.priority === 'immediate' ? '#e63946' : rec.priority === 'short_term' ? '#f4a261' : '#2ec4b6'}`, marginBottom: 12, background: '#fafafa', borderRadius: '0 6px 6px 0' }}>
                  <div className="flex-between">
                    <strong>{rec.action}</strong>
                    <span style={{ fontSize: 11, textTransform: 'uppercase', fontWeight: 600, color: rec.priority === 'immediate' ? '#e63946' : rec.priority === 'short_term' ? '#f4a261' : '#2ec4b6' }}>
                      {rec.priority?.replace(/_/g, ' ')}
                    </span>
                  </div>
                  <p style={{ fontSize: 13, color: '#666', marginTop: 4 }}>{rec.expected_impact}</p>
                </div>
              ))}
            </div>
          )}

          {/* Strengths & Watch Items */}
          <div className="grid-2">
            {report.analysisData?.strengths && report.analysisData.strengths.length > 0 && (
              <div className="card" style={{ borderLeft: '3px solid #2ec4b6' }}>
                <h3>Strengths</h3>
                <ul style={{ paddingLeft: 20 }}>
                  {report.analysisData.strengths.map((s, i) => (
                    <li key={i} style={{ marginBottom: 6, fontSize: 14 }}>{s}</li>
                  ))}
                </ul>
              </div>
            )}
            {report.analysisData?.watch_items && report.analysisData.watch_items.length > 0 && (
              <div className="card" style={{ borderLeft: '3px solid #f4a261' }}>
                <h3>Watch Items</h3>
                <ul style={{ paddingLeft: 20 }}>
                  {report.analysisData.watch_items.map((w, i) => (
                    <li key={i} style={{ marginBottom: 6, fontSize: 14 }}>{w}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}

export default RiskAnalyzer;
