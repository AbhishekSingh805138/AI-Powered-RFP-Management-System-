import React, { useState, useEffect } from 'react';
import { listRfpDocuments, listGeneratedProposals, checkCompliance } from '../services/api';

function ComplianceChecker() {
  const [rfpDocuments, setRfpDocuments] = useState([]);
  const [proposals, setProposals] = useState([]);
  const [selectedRfp, setSelectedRfp] = useState('');
  const [selectedProposal, setSelectedProposal] = useState('');
  const [manualText, setManualText] = useState('');
  const [inputMode, setInputMode] = useState('proposal'); // 'proposal' or 'text'
  const [loading, setLoading] = useState(true);
  const [checking, setChecking] = useState(false);
  const [report, setReport] = useState(null);
  const [error, setError] = useState('');

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
      const res = await listRfpDocuments();
      setRfpDocuments((res.data.data || res.data).filter((d) => d.status === 'extracted'));
    } catch (err) {
      setError('Failed to load documents');
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

  const handleCheck = async () => {
    if (!selectedRfp) {
      setError('Please select an RFP document');
      return;
    }

    const data = { rfpDocumentId: parseInt(selectedRfp, 10) };

    if (inputMode === 'proposal' && selectedProposal) {
      data.generatedProposalId = parseInt(selectedProposal, 10);
    } else if (inputMode === 'text' && manualText.trim()) {
      data.proposalText = manualText;
    } else {
      setError('Please select a proposal or enter proposal text');
      return;
    }

    setChecking(true);
    setError('');
    setReport(null);

    try {
      const res = await checkCompliance(data);
      setReport(res.data);
    } catch (err) {
      setError(err.response?.data?.error || 'Compliance check failed');
    } finally {
      setChecking(false);
    }
  };

  const getSeverityColor = (severity) => {
    const colors = { critical: '#e63946', major: '#f4845f', minor: '#f4a261', none: '#2ec4b6' };
    return colors[severity] || '#888';
  };

  const getStatusIcon = (status) => {
    const icons = {
      compliant: { symbol: '\u2713', color: '#2ec4b6' },
      exceeds: { symbol: '\u2713\u2713', color: '#1a936f' },
      partial: { symbol: '\u25D1', color: '#f4a261' },
      missing: { symbol: '\u2717', color: '#e63946' },
      addressed: { symbol: '\u2713', color: '#2ec4b6' },
      partially_addressed: { symbol: '\u25D1', color: '#f4a261' },
      not_addressed: { symbol: '\u2717', color: '#e63946' },
    };
    return icons[status] || { symbol: '?', color: '#888' };
  };

  if (loading) return <div className="loading">Loading...</div>;

  return (
    <div>
      <div className="page-header">
        <h1>Compliance Checker</h1>
      </div>

      {error && <div className="error-msg">{error}</div>}

      {/* Input Selection */}
      {!report && (
        <div className="card">
          <h2>Check Proposal Compliance</h2>
          <p style={{ color: '#666', marginBottom: 16 }}>
            Select an RFP and a proposal to run an AI-powered compliance gap analysis.
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
            <>
              <div style={{ display: 'flex', gap: 12, marginBottom: 16 }}>
                <button
                  className={`btn btn-sm ${inputMode === 'proposal' ? 'btn-primary' : 'btn-secondary'}`}
                  onClick={() => setInputMode('proposal')}
                >
                  Select Generated Proposal
                </button>
                <button
                  className={`btn btn-sm ${inputMode === 'text' ? 'btn-primary' : 'btn-secondary'}`}
                  onClick={() => setInputMode('text')}
                >
                  Paste Proposal Text
                </button>
              </div>

              {inputMode === 'proposal' ? (
                <div className="form-group">
                  <label>Generated Proposal</label>
                  <select value={selectedProposal} onChange={(e) => setSelectedProposal(e.target.value)}>
                    <option value="">Select a generated proposal...</option>
                    {proposals.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.title || `Proposal v${p.version}`} [{p.status}]
                      </option>
                    ))}
                  </select>
                  {proposals.length === 0 && (
                    <p style={{ fontSize: 13, color: '#888', marginTop: 4 }}>
                      No proposals generated for this RFP yet.
                    </p>
                  )}
                </div>
              ) : (
                <div className="form-group">
                  <label>Proposal Text</label>
                  <textarea
                    value={manualText}
                    onChange={(e) => setManualText(e.target.value)}
                    placeholder="Paste your proposal content here for compliance checking..."
                    rows={8}
                  />
                </div>
              )}
            </>
          )}

          <button
            className="btn btn-primary"
            onClick={handleCheck}
            disabled={checking || !selectedRfp}
            style={{ fontSize: 16, padding: '12px 32px' }}
          >
            {checking ? 'Analyzing Compliance...' : 'Run Compliance Check'}
          </button>
        </div>
      )}

      {/* Compliance Report */}
      {report && (
        <>
          {/* Overall Score */}
          <div className="card">
            <div className="flex-between">
              <h2>Compliance Report</h2>
              <button className="btn btn-secondary" onClick={() => setReport(null)}>
                New Check
              </button>
            </div>
            <p style={{ fontSize: 13, color: '#888', marginBottom: 16 }}>
              RFP: {report.rfpTitle} | Checked: {new Date(report.checkedAt).toLocaleString()}
            </p>

            <div className="compliance-score-section">
              <div className="compliance-score-circle" style={{
                borderColor: report.overall_score >= 80 ? '#2ec4b6' : report.overall_score >= 60 ? '#f4a261' : '#e63946'
              }}>
                <span className="score-number">{report.overall_score}</span>
                <span className="score-label">/ 100</span>
              </div>
              <div className="compliance-score-details">
                <span className={`badge badge-compliance-${report.overall_status}`} style={{ fontSize: 14, padding: '4px 12px' }}>
                  {report.overall_status?.replace(/_/g, ' ')}
                </span>
                <p style={{ marginTop: 8, lineHeight: 1.7 }}>{report.summary}</p>
              </div>
            </div>
          </div>

          {/* Statistics */}
          {report.statistics && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 12, marginBottom: 20 }}>
              <div className="stat-card">
                <div className="stat-value">{report.statistics.total_requirements}</div>
                <div className="stat-label">Total Requirements</div>
              </div>
              <div className="stat-card">
                <div className="stat-value" style={{ color: '#2ec4b6' }}>{report.statistics.fully_addressed}</div>
                <div className="stat-label">Fully Addressed</div>
              </div>
              <div className="stat-card">
                <div className="stat-value" style={{ color: '#f4a261' }}>{report.statistics.partially_addressed}</div>
                <div className="stat-label">Partially Addressed</div>
              </div>
              <div className="stat-card">
                <div className="stat-value" style={{ color: '#e63946' }}>{report.statistics.not_addressed}</div>
                <div className="stat-label">Not Addressed</div>
              </div>
              <div className="stat-card">
                <div className="stat-value" style={{ color: '#e63946' }}>{report.statistics.risks_identified}</div>
                <div className="stat-label">Risks Found</div>
              </div>
            </div>
          )}

          {/* Technical Compliance */}
          {report.technical_compliance && report.technical_compliance.length > 0 && (
            <div className="card">
              <h2>Technical Compliance</h2>
              <table>
                <thead>
                  <tr>
                    <th>ID</th>
                    <th>Requirement</th>
                    <th>Status</th>
                    <th>Proposal Response</th>
                    <th>Gap / Recommendation</th>
                    <th>Severity</th>
                  </tr>
                </thead>
                <tbody>
                  {report.technical_compliance.map((item, i) => {
                    const icon = getStatusIcon(item.status);
                    return (
                      <tr key={i}>
                        <td><code>{item.requirement_id}</code></td>
                        <td>{item.requirement}</td>
                        <td>
                          <span style={{ color: icon.color, fontWeight: 700 }}>{icon.symbol}</span>
                          {' '}
                          <span className={`badge badge-compliance-${item.status}`}>{item.status}</span>
                        </td>
                        <td style={{ fontSize: 13 }}>{item.proposal_response}</td>
                        <td style={{ fontSize: 13, color: '#666' }}>
                          {item.gap_description && <div>{item.gap_description}</div>}
                          {item.recommendation && (
                            <div style={{ marginTop: 4, color: '#4361ee', fontStyle: 'italic' }}>
                              Rec: {item.recommendation}
                            </div>
                          )}
                        </td>
                        <td>
                          <span style={{
                            color: getSeverityColor(item.severity),
                            fontWeight: 600,
                            fontSize: 12,
                            textTransform: 'uppercase',
                          }}>
                            {item.severity}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          {/* Compliance Requirements */}
          {report.compliance_requirements && report.compliance_requirements.length > 0 && (
            <div className="card">
              <h2>Regulatory / Certification Compliance</h2>
              <table>
                <thead>
                  <tr>
                    <th>ID</th>
                    <th>Requirement</th>
                    <th>Mandatory</th>
                    <th>Status</th>
                    <th>Evidence</th>
                    <th>Gap</th>
                  </tr>
                </thead>
                <tbody>
                  {report.compliance_requirements.map((item, i) => {
                    const icon = getStatusIcon(item.status);
                    return (
                      <tr key={i}>
                        <td><code>{item.requirement_id}</code></td>
                        <td>{item.requirement}</td>
                        <td>
                          <span className={`badge ${item.mandatory ? 'badge-error' : 'badge-draft'}`}>
                            {item.mandatory ? 'Yes' : 'No'}
                          </span>
                        </td>
                        <td>
                          <span style={{ color: icon.color, fontWeight: 700 }}>{icon.symbol}</span>
                          {' '}
                          <span className={`badge badge-compliance-${item.status}`}>{item.status}</span>
                        </td>
                        <td style={{ fontSize: 13 }}>{item.evidence_in_proposal}</td>
                        <td style={{ fontSize: 13, color: '#e63946' }}>{item.gap_description}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          {/* Deliverable Compliance */}
          {report.deliverable_compliance && report.deliverable_compliance.length > 0 && (
            <div className="card">
              <h2>Deliverable Coverage</h2>
              <table>
                <thead>
                  <tr>
                    <th>ID</th>
                    <th>Deliverable</th>
                    <th>Status</th>
                    <th>Proposal Coverage</th>
                    <th>Gap</th>
                  </tr>
                </thead>
                <tbody>
                  {report.deliverable_compliance.map((item, i) => {
                    const icon = getStatusIcon(item.status);
                    return (
                      <tr key={i}>
                        <td><code>{item.deliverable_id}</code></td>
                        <td>{item.deliverable}</td>
                        <td>
                          <span style={{ color: icon.color, fontWeight: 700 }}>{icon.symbol}</span>
                          {' '}
                          <span className={`badge badge-compliance-${item.status}`}>{item.status}</span>
                        </td>
                        <td style={{ fontSize: 13 }}>{item.proposal_coverage}</td>
                        <td style={{ fontSize: 13, color: '#e63946' }}>{item.gap_description}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          {/* Budget & Timeline */}
          <div className="grid-2">
            {report.budget_compliance && (
              <div className="card">
                <h3>Budget Compliance</h3>
                <div className="info-item mb-8">
                  <span className="info-label">RFP Budget</span>
                  <span className="info-value">{report.budget_compliance.rfp_budget}</span>
                </div>
                <div className="info-item mb-8">
                  <span className="info-label">Proposal Cost</span>
                  <span className="info-value">{report.budget_compliance.proposal_cost}</span>
                </div>
                <span className={`badge badge-budget-${report.budget_compliance.status}`}>
                  {report.budget_compliance.status?.replace(/_/g, ' ')}
                </span>
                <p style={{ fontSize: 13, color: '#666', marginTop: 8 }}>{report.budget_compliance.analysis}</p>
              </div>
            )}
            {report.timeline_compliance && (
              <div className="card">
                <h3>Timeline Compliance</h3>
                <div className="info-item mb-8">
                  <span className="info-label">RFP Timeline</span>
                  <span className="info-value">{report.timeline_compliance.rfp_timeline}</span>
                </div>
                <div className="info-item mb-8">
                  <span className="info-label">Proposal Timeline</span>
                  <span className="info-value">{report.timeline_compliance.proposal_timeline}</span>
                </div>
                <span className={`badge badge-timeline-${report.timeline_compliance.status}`}>
                  {report.timeline_compliance.status?.replace(/_/g, ' ')}
                </span>
                <p style={{ fontSize: 13, color: '#666', marginTop: 8 }}>{report.timeline_compliance.analysis}</p>
              </div>
            )}
          </div>

          {/* Risks */}
          {report.risks && report.risks.length > 0 && (
            <div className="card">
              <h2>Compliance Risks</h2>
              {report.risks.map((risk, i) => (
                <div key={i} className="risk-item">
                  <div className="flex-between">
                    <strong>{risk.risk}</strong>
                    <span className={`badge badge-risk-${risk.severity}`}>{risk.severity}</span>
                  </div>
                  {risk.affected_requirements && (
                    <div style={{ fontSize: 12, color: '#888', marginTop: 4 }}>
                      Affects: {risk.affected_requirements.join(', ')}
                    </div>
                  )}
                  <p style={{ fontSize: 13, color: '#4361ee', marginTop: 4, fontStyle: 'italic' }}>
                    {risk.recommendation}
                  </p>
                </div>
              ))}
            </div>
          )}

          {/* Strengths & Improvements */}
          <div className="grid-2">
            {report.strengths && report.strengths.length > 0 && (
              <div className="card" style={{ borderLeft: '3px solid #2ec4b6' }}>
                <h3>Strengths</h3>
                <ul style={{ paddingLeft: 20 }}>
                  {report.strengths.map((s, i) => (
                    <li key={i} style={{ marginBottom: 6, fontSize: 14 }}>{s}</li>
                  ))}
                </ul>
              </div>
            )}
            {report.improvement_areas && report.improvement_areas.length > 0 && (
              <div className="card" style={{ borderLeft: '3px solid #f4a261' }}>
                <h3>Areas for Improvement</h3>
                <ul style={{ paddingLeft: 20 }}>
                  {report.improvement_areas.map((a, i) => (
                    <li key={i} style={{ marginBottom: 6, fontSize: 14 }}>{a}</li>
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

export default ComplianceChecker;
