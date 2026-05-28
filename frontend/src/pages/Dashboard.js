import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { listRfps, listVendors, listProposals, listRfpDocuments, listRiskAnalyses, listConversations } from '../services/api';

function Dashboard() {
  const { user } = useAuth();
  const isManagerOrAdmin = user?.role === 'admin' || user?.role === 'manager';
  const [stats, setStats] = useState({ rfps: 0, vendors: 0, proposals: 0, evaluated: 0, analyzedDocs: 0, riskAnalyses: 0, chatConversations: 0 });
  const [recentRfps, setRecentRfps] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const [rfpRes, vendorRes, proposalRes, docRes, riskRes, chatRes] = await Promise.all([
          listRfps(),
          listVendors(),
          listProposals(),
          listRfpDocuments().catch(() => ({ data: [] })),
          listRiskAnalyses().catch(() => ({ data: [] })),
          listConversations().catch(() => ({ data: [] })),
        ]);

        const rfps = rfpRes.data;
        setStats({
          rfps: rfps.length,
          vendors: vendorRes.data.length,
          proposals: proposalRes.data.length,
          evaluated: rfps.filter((r) => r.status === 'evaluating' || r.status === 'awarded').length,
          analyzedDocs: docRes.data.filter((d) => d.status === 'extracted').length,
          riskAnalyses: riskRes.data.length,
          chatConversations: chatRes.data.length,
        });
        setRecentRfps(rfps.slice(0, 5));
      } catch (err) {
        // silently handled — error state could be added if needed
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  if (loading) return <div className="loading">Loading dashboard...</div>;

  return (
    <div>
      <div className="page-header">
        <h1>Dashboard</h1>
        <div style={{ display: 'flex', gap: 8 }}>
          <Link to="/rfp-analyzer" className="btn btn-success">Analyze RFP</Link>
          {isManagerOrAdmin && <Link to="/risk-analyzer" className="btn btn-warning">Analyze Risk</Link>}
          <Link to="/chatbot" className="btn btn-info">AI Chat</Link>
          {isManagerOrAdmin && <Link to="/rfps/new" className="btn btn-primary">Create New RFP</Link>}
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16, marginBottom: 16 }}>
        <div className="stat-card">
          <div className="stat-value">{stats.analyzedDocs}</div>
          <div className="stat-label">RFPs Analyzed</div>
        </div>
        <div className="stat-card">
          <div className="stat-value">{stats.rfps}</div>
          <div className="stat-label">Total RFPs</div>
        </div>
        <div className="stat-card">
          <div className="stat-value">{stats.vendors}</div>
          <div className="stat-label">Vendors</div>
        </div>
        <div className="stat-card">
          <div className="stat-value">{stats.proposals}</div>
          <div className="stat-label">Proposals Received</div>
        </div>
        <div className="stat-card">
          <div className="stat-value">{stats.riskAnalyses}</div>
          <div className="stat-label">Risk Analyses</div>
        </div>
        <div className="stat-card">
          <div className="stat-value">{stats.chatConversations}</div>
          <div className="stat-label">Chat Conversations</div>
        </div>
      </div>

      <div className="card">
        <h2>Recent RFPs</h2>
        {recentRfps.length === 0 ? (
          <p>No RFPs yet. <Link to="/rfps/new">Create your first RFP</Link></p>
        ) : (
          <table>
            <thead>
              <tr>
                <th>ID</th>
                <th>Title</th>
                <th>Budget</th>
                <th>Status</th>
                <th>Proposals</th>
                <th>Created</th>
              </tr>
            </thead>
            <tbody>
              {recentRfps.map((rfp) => (
                <tr key={rfp.id}>
                  <td><Link to={`/rfps/${rfp.id}`}>RFP-{String(rfp.id).padStart(4, '0')}</Link></td>
                  <td>{rfp.title}</td>
                  <td>{rfp.budget ? `$${Number(rfp.budget).toLocaleString()}` : '—'}</td>
                  <td><span className={`badge badge-${rfp.status}`}>{rfp.status}</span></td>
                  <td>{rfp.proposals?.length || 0}</td>
                  <td>{new Date(rfp.createdAt).toLocaleDateString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

export default Dashboard;
