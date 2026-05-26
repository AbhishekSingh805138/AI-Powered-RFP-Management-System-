import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { listRfps, listVendors, listProposals } from '../services/api';

function Dashboard() {
  const [stats, setStats] = useState({ rfps: 0, vendors: 0, proposals: 0, evaluated: 0 });
  const [recentRfps, setRecentRfps] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const [rfpRes, vendorRes, proposalRes] = await Promise.all([
          listRfps(),
          listVendors(),
          listProposals(),
        ]);

        const rfps = rfpRes.data;
        setStats({
          rfps: rfps.length,
          vendors: vendorRes.data.length,
          proposals: proposalRes.data.length,
          evaluated: rfps.filter((r) => r.status === 'evaluating' || r.status === 'awarded').length,
        });
        setRecentRfps(rfps.slice(0, 5));
      } catch (err) {
        console.error('Dashboard load error:', err);
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
        <Link to="/rfps/new" className="btn btn-primary">Create New RFP</Link>
      </div>

      <div className="grid-3 mb-16">
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
