import React, { useState, useEffect } from 'react';
import { listVendors, createVendor, updateVendor, deleteVendor } from '../services/api';

const emptyVendor = { name: '', email: '', company: '', phone: '', category: '', address: '', notes: '' };

function VendorList() {
  const [vendors, setVendors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({ ...emptyVendor });
  const [search, setSearch] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    loadVendors();
  }, []);

  async function loadVendors() {
    try {
      const res = await listVendors({ search });
      setVendors(res.data.data);
      setError('');
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to load vendors. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    try {
      if (editing) {
        await updateVendor(editing, form);
      } else {
        await createVendor(form);
      }
      setShowForm(false);
      setEditing(null);
      setForm({ ...emptyVendor });
      await loadVendors();
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to save vendor');
    }
  };

  const handleEdit = (vendor) => {
    setForm({
      name: vendor.name,
      email: vendor.email,
      company: vendor.company || '',
      phone: vendor.phone || '',
      category: vendor.category || '',
      address: vendor.address || '',
      notes: vendor.notes || '',
    });
    setEditing(vendor.id);
    setShowForm(true);
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this vendor?')) return;
    try {
      await deleteVendor(id);
      setVendors(vendors.filter((v) => v.id !== id));
    } catch (err) {
      alert('Failed to delete: ' + (err.response?.data?.error || err.message));
    }
  };

  const handleSearch = (e) => {
    e.preventDefault();
    setLoading(true);
    loadVendors();
  };

  if (loading) return <div className="loading">Loading vendors...</div>;

  return (
    <div>
      <div className="page-header">
        <h1>Vendors</h1>
        <button
          onClick={() => { setShowForm(!showForm); setEditing(null); setForm({ ...emptyVendor }); }}
          className="btn btn-primary"
        >
          {showForm ? 'Cancel' : 'Add Vendor'}
        </button>
      </div>

      {error && <div className="error-msg">{error}</div>}

      {showForm && (
        <div className="card">
          <h2>{editing ? 'Edit Vendor' : 'Add New Vendor'}</h2>
          <form onSubmit={handleSubmit}>
            <div className="grid-2">
              <div className="form-group">
                <label>Name *</label>
                <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
              </div>
              <div className="form-group">
                <label>Email *</label>
                <input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} required />
              </div>
              <div className="form-group">
                <label>Company</label>
                <input value={form.company} onChange={(e) => setForm({ ...form, company: e.target.value })} />
              </div>
              <div className="form-group">
                <label>Phone</label>
                <input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
              </div>
              <div className="form-group">
                <label>Category</label>
                <input value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} placeholder="IT, Furniture, Office Supplies..." />
              </div>
              <div className="form-group">
                <label>Address</label>
                <input value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} />
              </div>
            </div>
            <div className="form-group">
              <label>Notes</label>
              <textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} rows={3} />
            </div>
            <button type="submit" className="btn btn-primary">{editing ? 'Update' : 'Add'} Vendor</button>
          </form>
        </div>
      )}

      <div className="card">
        <form onSubmit={handleSearch} style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search vendors..."
            style={{ flex: 1, padding: '8px 12px', border: '1px solid #ddd', borderRadius: 6 }}
          />
          <button type="submit" className="btn btn-secondary">Search</button>
        </form>

        {vendors.length === 0 ? (
          <p>No vendors found.</p>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Name</th>
                <th>Email</th>
                <th>Company</th>
                <th>Category</th>
                <th>Phone</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {vendors.map((v) => (
                <tr key={v.id}>
                  <td><strong>{v.name}</strong></td>
                  <td>{v.email}</td>
                  <td>{v.company || '—'}</td>
                  <td>{v.category || '—'}</td>
                  <td>{v.phone || '—'}</td>
                  <td>
                    <button onClick={() => handleEdit(v)} className="btn btn-secondary btn-sm" style={{ marginRight: 4 }}>Edit</button>
                    <button onClick={() => handleDelete(v.id)} className="btn btn-danger btn-sm">Delete</button>
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

export default VendorList;
