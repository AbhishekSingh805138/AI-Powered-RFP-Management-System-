import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { getRfpDocument, generateProposalFromRfp, getGeneratedProposal, updateGeneratedProposal, exportProposal, listGeneratedProposals } from '../services/api';
import { useJobPoller } from '../hooks/useJobPoller';

function ProposalGenerator() {
  const { id, proposalId } = useParams();
  const navigate = useNavigate();

  const [document, setDocument] = useState(null);
  const [proposal, setProposal] = useState(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [exporting, setExporting] = useState(null);
  const [editingSection, setEditingSection] = useState(null);
  const [editContent, setEditContent] = useState('');
  const { pollJob } = useJobPoller();

  const [companyProfile, setCompanyProfile] = useState({
    company_name: '',
    industry: '',
    expertise: '',
    years_of_experience: '',
    team_size: '',
    certifications: '',
    key_differentiators: '',
  });

  useEffect(() => {
    loadData();
  }, [id, proposalId]);

  const loadData = async () => {
    try {
      const docRes = await getRfpDocument(id);
      setDocument(docRes.data);

      if (proposalId) {
        const propRes = await getGeneratedProposal(id, proposalId);
        setProposal(propRes.data);
        if (propRes.data.companyProfile) {
          setCompanyProfile((prev) => ({ ...prev, ...propRes.data.companyProfile }));
        }
      }
    } catch (err) {
      setError('Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  const handleGenerate = async (e) => {
    e.preventDefault();
    if (!companyProfile.company_name.trim()) {
      setError('Company name is required');
      return;
    }

    setGenerating(true);
    setError('');

    try {
      const res = await generateProposalFromRfp(id, companyProfile);

      if (res.status === 202 && res.data.jobId) {
        // Async job — poll until done
        pollJob(
          res.data.jobId,
          async () => {
            // Fetch the latest proposals and use the most recent
            const propRes = res.data.proposalId
              ? await getGeneratedProposal(id, res.data.proposalId)
              : await listGeneratedProposals(id);
            const prop = res.data.proposalId ? propRes.data : propRes.data[0];
            setProposal(prop);
            setGenerating(false);
            setSuccessMsg('Proposal generated successfully!');
            setTimeout(() => setSuccessMsg(''), 3000);
          },
          (errMsg) => {
            setError(`Generation failed: ${errMsg}`);
            setGenerating(false);
          }
        );
      } else {
        setProposal(res.data);
        setSuccessMsg('Proposal generated successfully!');
        setTimeout(() => setSuccessMsg(''), 3000);
        setGenerating(false);
      }
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to generate proposal');
      setGenerating(false);
    }
  };

  const handleEditSection = (sectionKey, content) => {
    setEditingSection(sectionKey);
    setEditContent(typeof content === 'string' ? content : JSON.stringify(content, null, 2));
  };

  const handleSaveSection = async () => {
    if (!proposal) return;
    setSaving(true);

    try {
      const updatedContent = { ...proposal.proposalContent };

      // Try to parse as JSON for structured sections, fallback to string
      try {
        updatedContent[editingSection] = JSON.parse(editContent);
      } catch {
        updatedContent[editingSection] = editContent;
      }

      const res = await updateGeneratedProposal(id, proposal.id, {
        proposalContent: updatedContent,
        status: 'edited',
      });

      setProposal(res.data);
      setEditingSection(null);
      setEditContent('');
      setSuccessMsg('Section updated!');
      setTimeout(() => setSuccessMsg(''), 2000);
    } catch (err) {
      setError('Failed to save changes');
    } finally {
      setSaving(false);
    }
  };

  const handleExport = async (format) => {
    if (!proposal) return;
    setExporting(format);
    setError('');

    try {
      const res = await exportProposal(id, proposal.id, format);
      const blob = new Blob([res.data], {
        type: format === 'docx'
          ? 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
          : 'application/pdf',
      });
      const url = window.URL.createObjectURL(blob);
      const link = window.document.createElement('a');
      link.href = url;
      link.download = `${(proposal.title || 'Proposal').replace(/[^a-zA-Z0-9_\- ]/g, '')}_v${proposal.version || 1}.${format}`;
      window.document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
      setSuccessMsg(`${format.toUpperCase()} exported successfully!`);
      setTimeout(() => setSuccessMsg(''), 3000);
    } catch (err) {
      console.error('Export error:', err);
      setError(`Failed to export ${format.toUpperCase()}`);
    } finally {
      setExporting(null);
    }
  };

  const handleFinalize = async () => {
    if (!proposal) return;
    try {
      const res = await updateGeneratedProposal(id, proposal.id, { status: 'finalized' });
      setProposal(res.data);
      setSuccessMsg('Proposal finalized!');
      setTimeout(() => setSuccessMsg(''), 3000);
    } catch (err) {
      setError('Failed to finalize proposal');
    }
  };

  if (loading) return <div className="loading">Loading...</div>;
  if (!document) return <div className="error-msg">Document not found</div>;

  const content = proposal?.proposalContent;

  return (
    <div>
      <div className="page-header">
        <h1>{content ? (content.title || 'Generated Proposal') : 'Generate Proposal'}</h1>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn btn-secondary" onClick={() => navigate(`/rfp-analyzer/${id}`)}>
            Back to Analysis
          </button>
          {content && (
            <>
              <button
                className="btn btn-secondary"
                onClick={() => handleExport('pdf')}
                disabled={!!exporting}
              >
                {exporting === 'pdf' ? 'Exporting...' : 'Export PDF'}
              </button>
              <button
                className="btn btn-secondary"
                onClick={() => handleExport('docx')}
                disabled={!!exporting}
              >
                {exporting === 'docx' ? 'Exporting...' : 'Export DOCX'}
              </button>
            </>
          )}
          {content && proposal.status !== 'finalized' && (
            <button className="btn btn-success" onClick={handleFinalize}>
              Finalize Proposal
            </button>
          )}
        </div>
      </div>

      {error && <div className="error-msg">{error}</div>}
      {successMsg && <div className="success-msg">{successMsg}</div>}

      {/* Company Profile Form (show if no proposal yet) */}
      {!content && (
        <div className="card">
          <h2>Company Profile</h2>
          <p style={{ color: '#666', marginBottom: 16 }}>
            Provide your company details to generate a tailored proposal for:
            <strong> {document.extractedData?.title || document.originalFilename}</strong>
          </p>

          <form onSubmit={handleGenerate}>
            <div className="grid-2">
              <div className="form-group">
                <label>Company Name *</label>
                <input
                  type="text"
                  value={companyProfile.company_name}
                  onChange={(e) => setCompanyProfile({ ...companyProfile, company_name: e.target.value })}
                  placeholder="Your Company Name"
                  disabled={generating}
                />
              </div>
              <div className="form-group">
                <label>Industry</label>
                <input
                  type="text"
                  value={companyProfile.industry}
                  onChange={(e) => setCompanyProfile({ ...companyProfile, industry: e.target.value })}
                  placeholder="e.g. IT Services, Consulting"
                  disabled={generating}
                />
              </div>
              <div className="form-group">
                <label>Core Expertise</label>
                <input
                  type="text"
                  value={companyProfile.expertise}
                  onChange={(e) => setCompanyProfile({ ...companyProfile, expertise: e.target.value })}
                  placeholder="e.g. Cloud Migration, Custom Software Development"
                  disabled={generating}
                />
              </div>
              <div className="form-group">
                <label>Years of Experience</label>
                <input
                  type="text"
                  value={companyProfile.years_of_experience}
                  onChange={(e) => setCompanyProfile({ ...companyProfile, years_of_experience: e.target.value })}
                  placeholder="e.g. 10+"
                  disabled={generating}
                />
              </div>
              <div className="form-group">
                <label>Team Size</label>
                <input
                  type="text"
                  value={companyProfile.team_size}
                  onChange={(e) => setCompanyProfile({ ...companyProfile, team_size: e.target.value })}
                  placeholder="e.g. 50-100 professionals"
                  disabled={generating}
                />
              </div>
              <div className="form-group">
                <label>Certifications</label>
                <input
                  type="text"
                  value={companyProfile.certifications}
                  onChange={(e) => setCompanyProfile({ ...companyProfile, certifications: e.target.value })}
                  placeholder="e.g. ISO 27001, AWS Partner, PMP"
                  disabled={generating}
                />
              </div>
            </div>
            <div className="form-group">
              <label>Key Differentiators</label>
              <textarea
                value={companyProfile.key_differentiators}
                onChange={(e) => setCompanyProfile({ ...companyProfile, key_differentiators: e.target.value })}
                placeholder="What makes your company stand out? Past wins, unique capabilities, client success stories..."
                rows={3}
                disabled={generating}
              />
            </div>

            <button
              type="submit"
              className="btn btn-primary"
              disabled={generating || !companyProfile.company_name.trim()}
              style={{ fontSize: 16, padding: '12px 32px' }}
            >
              {generating ? 'AI is generating proposal...' : 'Generate Proposal with AI'}
            </button>
          </form>
        </div>
      )}

      {/* Generated Proposal Display */}
      {content && (
        <>
          {/* Status bar */}
          <div className="card flex-between">
            <div>
              <span className={`badge badge-${proposal.status}`}>{proposal.status}</span>
              <span style={{ marginLeft: 12, color: '#888', fontSize: 13 }}>
                Version {proposal.version} | Generated {new Date(proposal.createdAt).toLocaleString()}
              </span>
            </div>
            {proposal.status !== 'finalized' && !proposalId && (
              <button
                className="btn btn-primary btn-sm"
                onClick={handleGenerate}
                disabled={generating}
              >
                {generating ? 'Regenerating...' : 'Regenerate'}
              </button>
            )}
          </div>

          {/* Executive Summary */}
          {renderSection('Executive Summary', 'executive_summary', content.executive_summary)}

          {/* Understanding of Requirements */}
          {renderSection('Understanding of Requirements', 'understanding_of_requirements', content.understanding_of_requirements)}

          {/* Technical Approach */}
          {content.technical_approach && (
            <div className="card proposal-section">
              <div className="flex-between mb-8">
                <h2>Technical Approach</h2>
                {proposal.status !== 'finalized' && (
                  <button className="btn btn-secondary btn-sm" onClick={() => handleEditSection('technical_approach', content.technical_approach)}>
                    Edit
                  </button>
                )}
              </div>
              {editingSection === 'technical_approach' ? renderEditor() : (
                <>
                  <p style={{ marginBottom: 16 }}>{content.technical_approach.overview}</p>
                  {content.technical_approach.methodology && (
                    <div className="mb-16">
                      <h4 style={{ marginBottom: 8 }}>Methodology</h4>
                      <p>{content.technical_approach.methodology}</p>
                    </div>
                  )}
                  {content.technical_approach.solution_components && (
                    <div>
                      <h4 style={{ marginBottom: 8 }}>Solution Components</h4>
                      {content.technical_approach.solution_components.map((comp, i) => (
                        <div key={i} className="solution-component">
                          <strong>{comp.component}</strong>
                          <p style={{ fontSize: 14, color: '#555' }}>{comp.description}</p>
                          {comp.technologies && (
                            <div style={{ marginTop: 4 }}>
                              {comp.technologies.map((tech, j) => (
                                <span key={j} className="tech-tag">{tech}</span>
                              ))}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                  {content.technical_approach.innovation && (
                    <div className="mt-16">
                      <h4 style={{ marginBottom: 8 }}>Innovation & Added Value</h4>
                      <p>{content.technical_approach.innovation}</p>
                    </div>
                  )}
                </>
              )}
            </div>
          )}

          {/* Scope of Work */}
          {content.scope_of_work && content.scope_of_work.length > 0 && (
            <div className="card proposal-section">
              <div className="flex-between mb-8">
                <h2>Scope of Work</h2>
                {proposal.status !== 'finalized' && (
                  <button className="btn btn-secondary btn-sm" onClick={() => handleEditSection('scope_of_work', content.scope_of_work)}>
                    Edit
                  </button>
                )}
              </div>
              {editingSection === 'scope_of_work' ? renderEditor() : (
                <div className="phases-timeline">
                  {content.scope_of_work.map((phase, i) => (
                    <div key={i} className="phase-item">
                      <div className="phase-header">
                        <span className="phase-number">Phase {i + 1}</span>
                        <strong>{phase.phase}</strong>
                        {phase.duration && <span className="phase-duration">{phase.duration}</span>}
                      </div>
                      <p style={{ fontSize: 14, color: '#555', marginBottom: 8 }}>{phase.description}</p>
                      {phase.activities && (
                        <div>
                          <span style={{ fontSize: 13, fontWeight: 600 }}>Activities:</span>
                          <ul style={{ paddingLeft: 20, fontSize: 13 }}>
                            {phase.activities.map((a, j) => <li key={j}>{a}</li>)}
                          </ul>
                        </div>
                      )}
                      {phase.deliverables && (
                        <div style={{ marginTop: 8 }}>
                          <span style={{ fontSize: 13, fontWeight: 600 }}>Deliverables:</span>
                          <ul style={{ paddingLeft: 20, fontSize: 13 }}>
                            {phase.deliverables.map((d, j) => <li key={j}>{d}</li>)}
                          </ul>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Timeline & Milestones */}
          {content.timeline && (
            <div className="card proposal-section">
              <div className="flex-between mb-8">
                <h2>Timeline</h2>
                {proposal.status !== 'finalized' && (
                  <button className="btn btn-secondary btn-sm" onClick={() => handleEditSection('timeline', content.timeline)}>
                    Edit
                  </button>
                )}
              </div>
              {editingSection === 'timeline' ? renderEditor() : (
                <>
                  <p><strong>Total Duration:</strong> {content.timeline.total_duration}</p>
                  {content.timeline.milestones && (
                    <table className="mt-16">
                      <thead>
                        <tr>
                          <th>Milestone</th>
                          <th>Target Date</th>
                          <th>Deliverables</th>
                        </tr>
                      </thead>
                      <tbody>
                        {content.timeline.milestones.map((m, i) => (
                          <tr key={i}>
                            <td><strong>{m.milestone}</strong></td>
                            <td>{m.target_date}</td>
                            <td>{m.deliverables?.join(', ')}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </>
              )}
            </div>
          )}

          {/* Team Composition */}
          {content.team_composition && content.team_composition.length > 0 && (
            <div className="card proposal-section">
              <div className="flex-between mb-8">
                <h2>Team Composition</h2>
                {proposal.status !== 'finalized' && (
                  <button className="btn btn-secondary btn-sm" onClick={() => handleEditSection('team_composition', content.team_composition)}>
                    Edit
                  </button>
                )}
              </div>
              {editingSection === 'team_composition' ? renderEditor() : (
                <table>
                  <thead>
                    <tr>
                      <th>Role</th>
                      <th>Responsibilities</th>
                      <th>Qualifications</th>
                    </tr>
                  </thead>
                  <tbody>
                    {content.team_composition.map((t, i) => (
                      <tr key={i}>
                        <td><strong>{t.role}</strong></td>
                        <td style={{ fontSize: 13 }}>{t.responsibilities}</td>
                        <td style={{ fontSize: 13, color: '#666' }}>{t.qualifications}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          )}

          {/* Cost Breakdown */}
          {content.cost_breakdown && (
            <div className="card proposal-section">
              <div className="flex-between mb-8">
                <h2>Cost Breakdown</h2>
                {proposal.status !== 'finalized' && (
                  <button className="btn btn-secondary btn-sm" onClick={() => handleEditSection('cost_breakdown', content.cost_breakdown)}>
                    Edit
                  </button>
                )}
              </div>
              {editingSection === 'cost_breakdown' ? renderEditor() : (
                <>
                  <p style={{ marginBottom: 16 }}>{content.cost_breakdown.summary}</p>
                  {content.cost_breakdown.line_items && (
                    <table>
                      <thead>
                        <tr>
                          <th>Item</th>
                          <th>Category</th>
                          <th>Estimated Cost</th>
                          <th>Notes</th>
                        </tr>
                      </thead>
                      <tbody>
                        {content.cost_breakdown.line_items.map((item, i) => (
                          <tr key={i}>
                            <td>{item.item}</td>
                            <td><span className="category-tag">{item.category}</span></td>
                            <td><strong>{item.estimated_cost}</strong></td>
                            <td style={{ fontSize: 13, color: '#666' }}>{item.notes}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                  {content.cost_breakdown.total_estimated_cost && (
                    <div style={{ marginTop: 16, padding: 16, background: '#f0f7ff', borderRadius: 8, textAlign: 'right' }}>
                      <span style={{ fontSize: 14, color: '#666' }}>Total Estimated Cost: </span>
                      <strong style={{ fontSize: 20, color: '#4361ee' }}>{content.cost_breakdown.total_estimated_cost}</strong>
                    </div>
                  )}
                  {content.cost_breakdown.payment_schedule && (
                    <p className="mt-16"><strong>Payment Schedule:</strong> {content.cost_breakdown.payment_schedule}</p>
                  )}
                  {content.cost_breakdown.assumptions && (
                    <div className="mt-16">
                      <strong>Assumptions:</strong>
                      <ul style={{ paddingLeft: 20, fontSize: 13, marginTop: 4 }}>
                        {content.cost_breakdown.assumptions.map((a, i) => <li key={i}>{a}</li>)}
                      </ul>
                    </div>
                  )}
                </>
              )}
            </div>
          )}

          {/* Compliance Matrix */}
          {content.compliance_matrix && content.compliance_matrix.length > 0 && (
            <div className="card proposal-section">
              <div className="flex-between mb-8">
                <h2>Compliance Matrix</h2>
              </div>
              <table>
                <thead>
                  <tr>
                    <th>Req. ID</th>
                    <th>Requirement</th>
                    <th>Status</th>
                    <th>Response</th>
                  </tr>
                </thead>
                <tbody>
                  {content.compliance_matrix.map((cm, i) => (
                    <tr key={i}>
                      <td><code>{cm.requirement_id}</code></td>
                      <td>{cm.requirement_summary}</td>
                      <td>
                        <span className={`badge badge-compliance-${cm.compliance_status}`}>
                          {cm.compliance_status}
                        </span>
                      </td>
                      <td style={{ fontSize: 13 }}>{cm.response}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Risk Mitigation */}
          {content.risk_mitigation && content.risk_mitigation.length > 0 && (
            <div className="card proposal-section">
              <h2>Risk Mitigation</h2>
              <table>
                <thead>
                  <tr>
                    <th>Risk</th>
                    <th>Impact</th>
                    <th>Mitigation Strategy</th>
                  </tr>
                </thead>
                <tbody>
                  {content.risk_mitigation.map((r, i) => (
                    <tr key={i}>
                      <td>{r.risk}</td>
                      <td>
                        <span className={`badge badge-risk-${r.impact}`}>{r.impact}</span>
                      </td>
                      <td style={{ fontSize: 13 }}>{r.mitigation_strategy}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Differentiators */}
          {content.differentiators && content.differentiators.length > 0 && (
            <div className="card proposal-section">
              <h2>Why Choose Us</h2>
              <div className="differentiators-grid">
                {content.differentiators.map((d, i) => (
                  <div key={i} className="differentiator-item">
                    <span className="diff-number">{i + 1}</span>
                    <span>{d}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Past Performance */}
          {renderSection('Past Performance', 'past_performance', content.past_performance)}

          {/* Terms */}
          {renderSection('Terms & Conditions', 'terms_and_conditions', content.terms_and_conditions)}
        </>
      )}
    </div>
  );

  function renderSection(title, key, value) {
    if (!value) return null;
    return (
      <div className="card proposal-section">
        <div className="flex-between mb-8">
          <h2>{title}</h2>
          {proposal.status !== 'finalized' && (
            <button className="btn btn-secondary btn-sm" onClick={() => handleEditSection(key, value)}>
              Edit
            </button>
          )}
        </div>
        {editingSection === key ? renderEditor() : (
          <p style={{ lineHeight: 1.8, whiteSpace: 'pre-wrap' }}>{value}</p>
        )}
      </div>
    );
  }

  function renderEditor() {
    return (
      <div>
        <textarea
          value={editContent}
          onChange={(e) => setEditContent(e.target.value)}
          rows={10}
          style={{ width: '100%', fontFamily: 'inherit', fontSize: 14, padding: 12, border: '1px solid #ddd', borderRadius: 6, resize: 'vertical' }}
        />
        <div style={{ marginTop: 8, display: 'flex', gap: 8 }}>
          <button className="btn btn-primary btn-sm" onClick={handleSaveSection} disabled={saving}>
            {saving ? 'Saving...' : 'Save'}
          </button>
          <button className="btn btn-secondary btn-sm" onClick={() => { setEditingSection(null); setEditContent(''); }}>
            Cancel
          </button>
        </div>
      </div>
    );
  }
}

export default ProposalGenerator;
