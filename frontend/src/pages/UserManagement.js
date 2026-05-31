import React, { useState, useEffect } from 'react';
import { listUsers, changeUserRole, changeUserStatus, createUser } from '../services/api';

function UserManagement() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterRole, setFilterRole] = useState('');
  const [error, setError] = useState('');
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [creating, setCreating] = useState(false);
  const [createForm, setCreateForm] = useState({
    email: '', password: '', firstName: '', lastName: '', role: 'viewer',
  });

  async function loadUsers() {
    try {
      const params = {};
      if (search) params.search = search;
      if (filterRole) params.role = filterRole;
      const res = await listUsers(params);
      setUsers(res.data);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to load users');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { loadUsers(); }, []);

  async function handleRoleChange(userId, newRole) {
    try {
      setError('');
      await changeUserRole(userId, newRole);
      setUsers((prev) => prev.map((u) => u.id === userId ? { ...u, role: newRole } : u));
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to change role');
    }
  }

  async function handleStatusToggle(userId, currentStatus) {
    const newStatus = currentStatus === 'active' ? 'suspended' : 'active';
    try {
      setError('');
      await changeUserStatus(userId, newStatus);
      setUsers((prev) => prev.map((u) => u.id === userId ? { ...u, status: newStatus } : u));
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to change status');
    }
  }

  function handleSearch(e) {
    e.preventDefault();
    setLoading(true);
    loadUsers();
  }

  async function handleCreateUser(e) {
    e.preventDefault();
    setCreating(true);
    setError('');
    try {
      const res = await createUser(createForm);
      setUsers((prev) => [res.data, ...prev]);
      setShowCreateForm(false);
      setCreateForm({ email: '', password: '', firstName: '', lastName: '', role: 'viewer' });
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to create user');
    } finally {
      setCreating(false);
    }
  }

  if (loading) return <div className="loading">Loading users...</div>;

  return (
    <div>
      <div className="page-header">
        <h1>User Management</h1>
        <button className="btn btn-primary" onClick={() => setShowCreateForm(!showCreateForm)}>
          {showCreateForm ? 'Cancel' : '+ Create User'}
        </button>
      </div>

      {error && <div className="alert alert-error">{error}</div>}

      {showCreateForm && (
        <div className="card" style={{ marginBottom: 16 }}>
          <h3 style={{ marginTop: 0 }}>Create New User</h3>
          <form onSubmit={handleCreateUser}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div>
                <label className="form-label">First Name</label>
                <input
                  type="text"
                  className="form-input"
                  value={createForm.firstName}
                  onChange={(e) => setCreateForm({ ...createForm, firstName: e.target.value })}
                  required
                />
              </div>
              <div>
                <label className="form-label">Last Name</label>
                <input
                  type="text"
                  className="form-input"
                  value={createForm.lastName}
                  onChange={(e) => setCreateForm({ ...createForm, lastName: e.target.value })}
                  required
                />
              </div>
              <div>
                <label className="form-label">Email</label>
                <input
                  type="email"
                  className="form-input"
                  value={createForm.email}
                  onChange={(e) => setCreateForm({ ...createForm, email: e.target.value })}
                  required
                />
              </div>
              <div>
                <label className="form-label">Password</label>
                <input
                  type="password"
                  className="form-input"
                  value={createForm.password}
                  onChange={(e) => setCreateForm({ ...createForm, password: e.target.value })}
                  required
                  minLength={8}
                />
              </div>
              <div>
                <label className="form-label">Role</label>
                <select
                  className="form-input"
                  value={createForm.role}
                  onChange={(e) => setCreateForm({ ...createForm, role: e.target.value })}
                >
                  <option value="viewer">Viewer</option>
                  <option value="manager">Manager</option>
                  <option value="admin">Admin</option>
                </select>
              </div>
            </div>
            <div style={{ marginTop: 12 }}>
              <button type="submit" className="btn btn-primary" disabled={creating}>
                {creating ? 'Creating...' : 'Create User'}
              </button>
            </div>
          </form>
        </div>
      )}

      <div className="card" style={{ marginBottom: 16 }}>
        <form onSubmit={handleSearch} style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <input
            type="text"
            placeholder="Search users..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="form-input"
            style={{ flex: 1 }}
          />
          <select value={filterRole} onChange={(e) => setFilterRole(e.target.value)} className="form-input" style={{ width: 150 }}>
            <option value="">All Roles</option>
            <option value="admin">Admin</option>
            <option value="manager">Manager</option>
            <option value="viewer">Viewer</option>
          </select>
          <button type="submit" className="btn btn-primary">Search</button>
        </form>
      </div>

      <div className="card">
        <table>
          <thead>
            <tr>
              <th>Name</th>
              <th>Email</th>
              <th>Role</th>
              <th>Status</th>
              <th>Last Login</th>
              <th>Joined</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {users.length === 0 ? (
              <tr><td colSpan="7" style={{ textAlign: 'center' }}>No users found</td></tr>
            ) : (
              users.map((user) => (
                <tr key={user.id}>
                  <td>{user.firstName} {user.lastName}</td>
                  <td>{user.email}</td>
                  <td>
                    <select
                      value={user.role}
                      onChange={(e) => handleRoleChange(user.id, e.target.value)}
                      className="form-input"
                      style={{ width: 120, padding: '4px 8px' }}
                    >
                      <option value="admin">Admin</option>
                      <option value="manager">Manager</option>
                      <option value="viewer">Viewer</option>
                    </select>
                  </td>
                  <td>
                    <span className={`badge badge-${user.status === 'active' ? 'sent' : 'failed'}`}>
                      {user.status}
                    </span>
                  </td>
                  <td>{user.lastLoginAt ? new Date(user.lastLoginAt).toLocaleDateString() : 'Never'}</td>
                  <td>{new Date(user.createdAt).toLocaleDateString()}</td>
                  <td>
                    <button
                      className={`btn btn-sm ${user.status === 'active' ? 'btn-warning' : 'btn-success'}`}
                      onClick={() => handleStatusToggle(user.id, user.status)}
                    >
                      {user.status === 'active' ? 'Suspend' : 'Activate'}
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default UserManagement;
