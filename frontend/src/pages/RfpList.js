import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { listRfps, deleteRfp } from '../services/api';

function RfpList() {
  const [rfps, setRfps] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadRfps();
  }, []);

  async function loadRfps() {
    try {
      const res = await listRfps();
      setRfps(res.data);
    } catch (err) {
      console.error('Failed to load RFPs:', err);
    } finally {
      setLoading(false);
    }
  }

  async function handleDelete(id) {
    if (!window.confirm('Delete this RFP?')) return;
    try {
      await deleteRfp(id);
      setRfps(rfps.filter((r) => r.id !== id));
    } catch (err) {
      alert('Failed to delete: ' + (err.response?.data?.error || err.message));
    }
  }

  if (loading) return <div className="loading">Loading RFPs...</div>;

  return (
    <div>
      <div className="page-header">
        <h1>RFPs</h1>
        <Link to="/rfps/new" className="btn btn-primary">Create New RFP</Link>
      </div>

      <div className="card">
        {rfps.length === 0 ? (
          <p>No RFPs found. <Link to="/rfps/new">Create one</Link></p>
        ) : (
          <table>
            <thead>
              <tr>
                <th>ID</th>
                <th>Title</th>
                <th>Budget</th>
                <th>Delivery</th>
                <th>Status</th>
                <th>Vendors</th>
                <th>Proposals</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {rfps.map((rfp) => (
                <tr key={rfp.id}>
                  <td><Link to={`/rfps/${rfp.id}`}>RFP-{String(rfp.id).padStart(4, '0')}</Link></td>
                  <td>{rfp.title}</td>
                  <td>{rfp.budget ? `$${Number(rfp.budget).toLocaleString()}` : '—'}</td>
                  <td>{rfp.deliveryDays ? `${rfp.deliveryDays} days` : '—'}</td>
                  <td><span className={`badge badge-${rfp.status}`}>{rfp.status}</span></td>
                  <td>{rfp.vendors?.length || 0}</td>
                  <td>{rfp.proposals?.length || 0}</td>
                  <td>
                    <Link to={`/rfps/${rfp.id}`} className="btn btn-secondary btn-sm" style={{ marginRight: 4 }}>View</Link>
                    <button onClick={() => handleDelete(rfp.id)} className="btn btn-danger btn-sm">Delete</button>
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

export default RfpList;
