import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { listProposals, parseProposal, fetchEmails } from '../services/api';

function ProposalList() {
  const [proposals, setProposals] = useState([]);
  const [loading, setLoading] = useState(true);
  const [fetching, setFetching] = useState(false);
  const [message, setMessage] = useState('');

  useEffect(() => {
    loadProposals();
  }, []);

  async function loadProposals() {
    try {
      const res = await listProposals();
      setProposals(res.data);
    } catch (err) {
      console.error('Failed to load proposals:', err);
    } finally {
      setLoading(false);
    }
  }

  const handleFetchEmails = async () => {
    setFetching(true);
    setMessage('');
    try {
      const res = await fetchEmails();
      setMessage(res.data.message);
      await loadProposals();
    } catch (err) {
      setMessage('Failed to fetch: ' + (err.response?.data?.error || err.message));
    } finally {
      setFetching(false);
    }
  };

  const handleParse = async (id) => {
    try {
      await parseProposal(id);
      setMessage('Proposal parsed successfully');
      await loadProposals();
    } catch (err) {
      setMessage('Parse failed: ' + (err.response?.data?.error || err.message));
    }
  };

  if (loading) return <div className="loading">Loading proposals...</div>;

  return (
    <div>
      <div className="page-header">
        <h1>All Proposals</h1>
        <button onClick={handleFetchEmails} className="btn btn-primary" disabled={fetching}>
          {fetching ? 'Checking inbox...' : 'Fetch New Emails'}
        </button>
      </div>

      {message && <div className="success-msg">{message}</div>}

      <div className="card">
        {proposals.length === 0 ? (
          <p>No proposals yet. Fetch emails or add proposals manually from an RFP detail page.</p>
        ) : (
          <table>
            <thead>
              <tr>
                <th>RFP</th>
                <th>Vendor</th>
                <th>Source</th>
                <th>Status</th>
                <th>Total Price</th>
                <th>Score</th>
                <th>Received</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {proposals.map((p) => (
                <tr key={p.id}>
                  <td>
                    {p.rfp ? (
                      <Link to={`/rfps/${p.rfp.id}`}>RFP-{String(p.rfp.id).padStart(4, '0')}: {p.rfp.title}</Link>
                    ) : `RFP #${p.rfpId}`}
                  </td>
                  <td>{p.vendor?.name || `Vendor #${p.vendorId}`}</td>
                  <td>{p.sourceType}</td>
                  <td><span className={`badge badge-${p.status}`}>{p.status}</span></td>
                  <td>{p.totalPrice ? `$${Number(p.totalPrice).toLocaleString()}` : '—'}</td>
                  <td>{p.score ? `${Number(p.score).toFixed(1)}/100` : '—'}</td>
                  <td>{new Date(p.createdAt).toLocaleDateString()}</td>
                  <td>
                    {(p.status === 'received' || p.status === 'error') && (
                      <button onClick={() => handleParse(p.id)} className="btn btn-success btn-sm">Parse</button>
                    )}
                    {p.status === 'parsed' && (
                      <Link to={`/rfps/${p.rfpId}`} className="btn btn-secondary btn-sm">View in RFP</Link>
                    )}
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

export default ProposalList;
