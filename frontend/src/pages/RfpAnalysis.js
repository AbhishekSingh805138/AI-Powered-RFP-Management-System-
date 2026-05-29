import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { getRfpDocument, extractRfpRequirements } from '../services/api';
import { useJobPoller } from '../hooks/useJobPoller';

function RfpAnalysis() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [document, setDocument] = useState(null);
  const [loading, setLoading] = useState(true);
  const [extracting, setExtracting] = useState(false);
  const [error, setError] = useState('');
  const { pollJob } = useJobPoller();

  useEffect(() => {
    loadDocument();
  }, [id]);

  const loadDocument = async () => {
    try {
      const res = await getRfpDocument(id);
      setDocument(res.data);
    } catch (err) {
      setError('Failed to load document');
    } finally {
      setLoading(false);
    }
  };

  const handleExtract = async () => {
    setExtracting(true);
    setError('');
    try {
      const res = await extractRfpRequirements(id);

      if (res.status === 202 && res.data.jobId) {
        // Async job — poll until done
        pollJob(
          res.data.jobId,
          async () => {
            const refreshed = await getRfpDocument(id);
            setDocument(refreshed.data);
            setExtracting(false);
          },
          (errMsg) => {
            setError(`Extraction failed: ${errMsg}`);
            setExtracting(false);
          }
        );
      } else {
        setDocument(res.data);
        setExtracting(false);
      }
    } catch (err) {
      setError(err.response?.data?.error || 'Extraction failed');
      setExtracting(false);
    }
  };

  if (loading) return <div className="loading">Loading document...</div>;
  if (error && !document) return <div className="error-msg">{error}</div>;
  if (!document) return <div className="error-msg">Document not found</div>;

  const data = document.extractedData;

  // If not yet extracted, show extract button
  if (!data || document.status === 'error' || document.status === 'uploaded') {
    return (
      <div>
        <div className="page-header">
          <h1>{document.originalFilename}</h1>
          <button className="btn btn-secondary" onClick={() => navigate('/rfp-analyzer')}>
            Back
          </button>
        </div>

        {error && <div className="error-msg">{error}</div>}

        <div className="card" style={{ textAlign: 'center', padding: 40 }}>
          <h2>Document Ready for Analysis</h2>
          <p style={{ color: '#666', margin: '16px 0' }}>
            Click below to extract requirements using AI.
          </p>
          <button
            className="btn btn-primary"
            onClick={handleExtract}
            disabled={extracting}
            style={{ fontSize: 16, padding: '12px 32px' }}
          >
            {extracting ? 'Extracting Requirements...' : 'Extract Requirements with AI'}
          </button>
          {document.errorMessage && (
            <div className="error-msg" style={{ marginTop: 16 }}>{document.errorMessage}</div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="page-header">
        <h1>{data.title || document.originalFilename}</h1>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn btn-secondary" onClick={() => navigate('/rfp-analyzer')}>
            Back
          </button>
          <button
            className="btn btn-primary"
            onClick={() => navigate(`/rfp-analyzer/${id}/generate`)}
          >
            Generate Proposal
          </button>
        </div>
      </div>

      {error && <div className="error-msg">{error}</div>}

      {/* Summary */}
      <div className="card">
        <h2>Summary</h2>
        <p style={{ lineHeight: 1.8 }}>{data.summary}</p>
        <div className="grid-3 mt-16">
          {data.issuing_organization && (
            <div className="info-item">
              <span className="info-label">Issuing Organization</span>
              <span className="info-value">{data.issuing_organization}</span>
            </div>
          )}
          {data.rfp_number && (
            <div className="info-item">
              <span className="info-label">RFP Number</span>
              <span className="info-value">{data.rfp_number}</span>
            </div>
          )}
          {data.submission_deadline && (
            <div className="info-item">
              <span className="info-label">Submission Deadline</span>
              <span className="info-value deadline-value">
                {new Date(data.submission_deadline).toLocaleDateString()}
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Key Dates */}
      {data.key_dates && data.key_dates.length > 0 && (
        <div className="card">
          <h2>Key Dates</h2>
          <table>
            <thead>
              <tr>
                <th>Event</th>
                <th>Date</th>
              </tr>
            </thead>
            <tbody>
              {data.key_dates.map((kd, i) => (
                <tr key={i}>
                  <td>{kd.event}</td>
                  <td>{kd.date}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Budget */}
      {data.budget_info && (
        <div className="card">
          <h2>Budget Information</h2>
          <div className="grid-2">
            {data.budget_info.estimated_budget && (
              <div className="info-item">
                <span className="info-label">Estimated Budget</span>
                <span className="info-value" style={{ fontSize: 20, fontWeight: 700, color: '#2ec4b6' }}>
                  {data.budget_info.currency || '$'} {Number(data.budget_info.estimated_budget).toLocaleString()}
                </span>
              </div>
            )}
            {data.budget_info.budget_notes && (
              <div className="info-item">
                <span className="info-label">Notes</span>
                <span className="info-value">{data.budget_info.budget_notes}</span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Technical Requirements */}
      {data.technical_requirements && data.technical_requirements.length > 0 && (
        <div className="card">
          <h2>Technical Requirements ({data.technical_requirements.length})</h2>
          <table>
            <thead>
              <tr>
                <th>ID</th>
                <th>Category</th>
                <th>Requirement</th>
                <th>Priority</th>
                <th>Details</th>
              </tr>
            </thead>
            <tbody>
              {data.technical_requirements.map((req, i) => (
                <tr key={i}>
                  <td><code>{req.id}</code></td>
                  <td><span className="category-tag">{req.category}</span></td>
                  <td>{req.requirement}</td>
                  <td>
                    <span className={`badge badge-priority-${req.priority}`}>
                      {req.priority}
                    </span>
                  </td>
                  <td style={{ fontSize: 13, color: '#666' }}>{req.details}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Compliance Requirements */}
      {data.compliance_requirements && data.compliance_requirements.length > 0 && (
        <div className="card">
          <h2>Compliance Requirements ({data.compliance_requirements.length})</h2>
          <table>
            <thead>
              <tr>
                <th>ID</th>
                <th>Type</th>
                <th>Requirement</th>
                <th>Mandatory</th>
              </tr>
            </thead>
            <tbody>
              {data.compliance_requirements.map((req, i) => (
                <tr key={i}>
                  <td><code>{req.id}</code></td>
                  <td><span className="category-tag">{req.type}</span></td>
                  <td>{req.requirement}</td>
                  <td>
                    <span className={`badge ${req.mandatory ? 'badge-error' : 'badge-draft'}`}>
                      {req.mandatory ? 'Mandatory' : 'Optional'}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Deliverables */}
      {data.deliverables && data.deliverables.length > 0 && (
        <div className="card">
          <h2>Deliverables ({data.deliverables.length})</h2>
          <table>
            <thead>
              <tr>
                <th>ID</th>
                <th>Deliverable</th>
                <th>Due Date</th>
                <th>Acceptance Criteria</th>
              </tr>
            </thead>
            <tbody>
              {data.deliverables.map((del, i) => (
                <tr key={i}>
                  <td><code>{del.id}</code></td>
                  <td>{del.deliverable}</td>
                  <td>{del.due_date || '-'}</td>
                  <td style={{ fontSize: 13, color: '#666' }}>{del.acceptance_criteria}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Evaluation Criteria */}
      {data.evaluation_criteria && data.evaluation_criteria.length > 0 && (
        <div className="card">
          <h2>Evaluation Criteria</h2>
          <table>
            <thead>
              <tr>
                <th>Criterion</th>
                <th>Weight</th>
                <th>Description</th>
              </tr>
            </thead>
            <tbody>
              {data.evaluation_criteria.map((ec, i) => (
                <tr key={i}>
                  <td><strong>{ec.criterion}</strong></td>
                  <td>
                    {ec.weight_percentage ? (
                      <div>
                        <strong>{ec.weight_percentage}%</strong>
                        <div className="score-bar" style={{ width: 100 }}>
                          <div
                            className="score-bar-fill"
                            style={{ width: `${ec.weight_percentage}%`, background: '#4361ee' }}
                          />
                        </div>
                      </div>
                    ) : '-'}
                  </td>
                  <td style={{ fontSize: 13, color: '#666' }}>{ec.description}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Submission Instructions */}
      {data.submission_instructions && (
        <div className="card">
          <h2>Submission Instructions</h2>
          <div className="grid-2">
            {data.submission_instructions.format && (
              <div className="info-item">
                <span className="info-label">Format</span>
                <span className="info-value">{data.submission_instructions.format}</span>
              </div>
            )}
            {data.submission_instructions.page_limit && (
              <div className="info-item">
                <span className="info-label">Page Limit</span>
                <span className="info-value">{data.submission_instructions.page_limit} pages</span>
              </div>
            )}
            {data.submission_instructions.contact_info && (
              <div className="info-item">
                <span className="info-label">Contact</span>
                <span className="info-value">{data.submission_instructions.contact_info}</span>
              </div>
            )}
          </div>
          {data.submission_instructions.required_sections && data.submission_instructions.required_sections.length > 0 && (
            <div style={{ marginTop: 16 }}>
              <span className="info-label">Required Sections</span>
              <ul style={{ paddingLeft: 20, marginTop: 8 }}>
                {data.submission_instructions.required_sections.map((s, i) => (
                  <li key={i} style={{ marginBottom: 4, fontSize: 14 }}>{s}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      {/* Risks */}
      {data.risks_identified && data.risks_identified.length > 0 && (
        <div className="card">
          <h2>Identified Risks</h2>
          {data.risks_identified.map((risk, i) => (
            <div key={i} className="risk-item">
              <div className="flex-between">
                <strong>{risk.risk}</strong>
                <span className={`badge badge-risk-${risk.severity}`}>{risk.severity}</span>
              </div>
              {risk.mitigation && (
                <p style={{ fontSize: 13, color: '#666', marginTop: 4 }}>
                  Mitigation: {risk.mitigation}
                </p>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Special Conditions */}
      {data.special_conditions && data.special_conditions.length > 0 && (
        <div className="card">
          <h2>Special Conditions</h2>
          <ul style={{ paddingLeft: 20 }}>
            {data.special_conditions.map((sc, i) => (
              <li key={i} style={{ marginBottom: 8, fontSize: 14 }}>{sc}</li>
            ))}
          </ul>
        </div>
      )}

      {/* Generated Proposals */}
      {document.generatedProposals && document.generatedProposals.length > 0 && (
        <div className="card">
          <h2>Generated Proposals</h2>
          <table>
            <thead>
              <tr>
                <th>Version</th>
                <th>Title</th>
                <th>Status</th>
                <th>Created</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {document.generatedProposals.map((gp) => (
                <tr key={gp.id}>
                  <td>v{gp.version}</td>
                  <td>{gp.title || 'Untitled'}</td>
                  <td><span className={`badge badge-${gp.status}`}>{gp.status}</span></td>
                  <td>{new Date(gp.createdAt).toLocaleDateString()}</td>
                  <td>
                    <button
                      className="btn btn-primary btn-sm"
                      onClick={() => navigate(`/rfp-analyzer/${id}/proposal/${gp.id}`)}
                    >
                      View
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Generate Proposal CTA */}
      <div className="card" style={{ textAlign: 'center', padding: 32 }}>
        <h2>Ready to Generate a Proposal?</h2>
        <p style={{ color: '#666', margin: '12px 0 20px' }}>
          AI will create a complete, tailored proposal based on the extracted requirements above.
        </p>
        <button
          className="btn btn-primary"
          onClick={() => navigate(`/rfp-analyzer/${id}/generate`)}
          style={{ fontSize: 16, padding: '12px 32px' }}
        >
          Generate Proposal with AI
        </button>
      </div>
    </div>
  );
}

export default RfpAnalysis;
