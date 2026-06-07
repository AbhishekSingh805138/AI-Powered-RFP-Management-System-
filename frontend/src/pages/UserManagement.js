import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { listUsers, createUser, updateUser, changeUserRole, changeUserStatus, resetUserPassword } from '../services/api';

const ROLE_PERMISSIONS = {
  admin: 'Full access — can manage users, all RFPs, proposals, vendors, AI tools, and system settings.',
  manager: 'Can create/edit RFPs, proposals, vendors. Access AI tools (analysis, compliance, risk, chat). Read analytics.',
  viewer: 'Read-only access to RFPs, proposals, vendors. Can use search and chat.',
};

function UserManagement() {
  const { user: currentUser } = useAuth();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterRole, setFilterRole] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Create user form
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [creating, setCreating] = useState(false);
  const [createForm, setCreateForm] = useState({
    email: '', password: '', firstName: '', lastName: '', role: 'viewer',
  });

  // Edit user modal
  const [editingUser, setEditingUser] = useState(null);
  const [editForm, setEditForm] = useState({
    firstName: '', lastName: '', email: '', role: '', status: '',
  });
  const [saving, setSaving] = useState(false);

  // Reset password modal
  const [resetUser, setResetUser] = useState(null);
  const [newPassword, setNewPassword] = useState('');
  const [resetting, setResetting] = useState(false);

  function clearMessages() {
    setError('');
    setSuccess('');
  }

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

  useEffect(() => { loadUsers(); }, []); // eslint-disable-line

  function handleSearch(e) {
    e.preventDefault();
    setLoading(true);
    loadUsers();
  }

  // ── Create User ──────────────────────────────────────────
  async function handleCreateUser(e) {
    e.preventDefault();
    setCreating(true);
    clearMessages();
    try {
      const res = await createUser(createForm);
      setUsers((prev) => [res.data, ...prev]);
      setShowCreateForm(false);
      setCreateForm({ email: '', password: '', firstName: '', lastName: '', role: 'viewer' });
      setSuccess('User created successfully');
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to create user');
    } finally {
      setCreating(false);
    }
  }

  // ── Edit User ────────────────────────────────────────────
  function openEditModal(user) {
    setEditingUser(user);
    setEditForm({
      firstName: user.firstName,
      lastName: user.lastName,
      email: user.email,
      role: user.role,
      status: user.status,
    });
    clearMessages();
  }

  function closeEditModal() {
    setEditingUser(null);
    setEditForm({ firstName: '', lastName: '', email: '', role: '', status: '' });
  }

  async function handleSaveUser(e) {
    e.preventDefault();
    setSaving(true);
    clearMessages();
    try {
      // Build only changed fields
      const updates = {};
      if (editForm.firstName !== editingUser.firstName) updates.firstName = editForm.firstName;
      if (editForm.lastName !== editingUser.lastName) updates.lastName = editForm.lastName;
      if (editForm.email !== editingUser.email) updates.email = editForm.email;
      if (editForm.role !== editingUser.role) updates.role = editForm.role;
      if (editForm.status !== editingUser.status) updates.status = editForm.status;

      if (Object.keys(updates).length === 0) {
        closeEditModal();
        return;
      }

      const res = await updateUser(editingUser.id, updates);
      setUsers((prev) => prev.map((u) => u.id === editingUser.id ? { ...u, ...res.data } : u));
      setSuccess(`User "${res.data.firstName} ${res.data.lastName}" updated successfully`);
      closeEditModal();
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to update user');
    } finally {
      setSaving(false);
    }
  }

  // ── Inline Role Change ──────────────────────────────────
  async function handleRoleChange(userId, newRole) {
    clearMessages();
    try {
      await changeUserRole(userId, newRole);
      setUsers((prev) => prev.map((u) => u.id === userId ? { ...u, role: newRole } : u));
      setSuccess(`Role updated to "${newRole}"`);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to change role');
    }
  }

  // ── Status Toggle ───────────────────────────────────────
  async function handleStatusToggle(userId, currentStatus) {
    const newStatus = currentStatus === 'active' ? 'suspended' : 'active';
    clearMessages();
    try {
      await changeUserStatus(userId, newStatus);
      setUsers((prev) => prev.map((u) => u.id === userId ? { ...u, status: newStatus } : u));
      setSuccess(`User ${newStatus === 'active' ? 'activated' : 'suspended'} successfully`);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to change status');
    }
  }

  // ── Reset Password ─────────────────────────────────────
  function openResetPassword(user) {
    setResetUser(user);
    setNewPassword('');
    clearMessages();
  }

  async function handleResetPassword(e) {
    e.preventDefault();
    setResetting(true);
    clearMessages();
    try {
      await resetUserPassword(resetUser.id, newPassword);
      setSuccess(`Password reset for "${resetUser.firstName} ${resetUser.lastName}"`);
      setResetUser(null);
      setNewPassword('');
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to reset password');
    } finally {
      setResetting(false);
    }
  }

  if (loading) return <div className="loading">Loading users...</div>;

  const isSelf = (userId) => currentUser && currentUser.id === userId;

  return (
    <div className="user-management">
      <div className="page-header">
        <h1>User Management</h1>
        <button className="btn btn-primary" onClick={() => { setShowCreateForm(!showCreateForm); clearMessages(); }}>
          {showCreateForm ? 'Cancel' : '+ Create User'}
        </button>
      </div>

      {error && <div className="alert alert-error">{error}</div>}
      {success && <div className="alert alert-success">{success}</div>}

      {/* ── Create User Form ── */}
      {showCreateForm && (
        <div className="card" style={{ marginBottom: 16 }}>
          <h3 style={{ marginTop: 0 }}>Create New User</h3>
          <form onSubmit={handleCreateUser}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div>
                <label className="form-label">First Name</label>
                <input type="text" className="form-input" value={createForm.firstName}
                  onChange={(e) => setCreateForm({ ...createForm, firstName: e.target.value })} required />
              </div>
              <div>
                <label className="form-label">Last Name</label>
                <input type="text" className="form-input" value={createForm.lastName}
                  onChange={(e) => setCreateForm({ ...createForm, lastName: e.target.value })} required />
              </div>
              <div>
                <label className="form-label">Email</label>
                <input type="email" className="form-input" value={createForm.email}
                  onChange={(e) => setCreateForm({ ...createForm, email: e.target.value })} required />
              </div>
              <div>
                <label className="form-label">Password</label>
                <input type="password" className="form-input" value={createForm.password}
                  onChange={(e) => setCreateForm({ ...createForm, password: e.target.value })} required minLength={8} />
                <small style={{ color: '#666', fontSize: 11 }}>Min 8 chars, 1 uppercase, 1 lowercase, 1 number</small>
              </div>
              <div>
                <label className="form-label">Role</label>
                <select className="form-input" value={createForm.role}
                  onChange={(e) => setCreateForm({ ...createForm, role: e.target.value })}>
                  <option value="viewer">Viewer</option>
                  <option value="manager">Manager</option>
                  <option value="admin">Admin</option>
                </select>
                <small style={{ color: '#666', fontSize: 11 }}>{ROLE_PERMISSIONS[createForm.role]}</small>
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

      {/* ── Search & Filter ── */}
      <div className="card" style={{ marginBottom: 16 }}>
        <form onSubmit={handleSearch} style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <input type="text" placeholder="Search by name or email..." value={search}
            onChange={(e) => setSearch(e.target.value)} className="form-input" style={{ flex: 1 }} />
          <select value={filterRole} onChange={(e) => setFilterRole(e.target.value)} className="form-input" style={{ width: 150 }}>
            <option value="">All Roles</option>
            <option value="admin">Admin</option>
            <option value="manager">Manager</option>
            <option value="viewer">Viewer</option>
          </select>
          <button type="submit" className="btn btn-primary">Search</button>
        </form>
      </div>

      {/* ── Users Table ── */}
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
                      disabled={isSelf(user.id)}
                      title={isSelf(user.id) ? 'Cannot change your own role' : ROLE_PERMISSIONS[user.role]}
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
                    <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                      <button className="btn btn-sm btn-primary" onClick={() => openEditModal(user)} title="Edit user details">
                        Edit
                      </button>
                      <button className="btn btn-sm btn-secondary" onClick={() => openResetPassword(user)}
                        title="Reset password" disabled={isSelf(user.id)}>
                        Reset Pwd
                      </button>
                      {!isSelf(user.id) && (
                        <button
                          className={`btn btn-sm ${user.status === 'active' ? 'btn-warning' : 'btn-success'}`}
                          onClick={() => handleStatusToggle(user.id, user.status)}
                        >
                          {user.status === 'active' ? 'Suspend' : 'Activate'}
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* ── Edit User Modal ── */}
      {editingUser && (
        <div className="modal-overlay" onClick={closeEditModal}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Edit User</h2>
              <button className="modal-close" onClick={closeEditModal}>&times;</button>
            </div>
            <form onSubmit={handleSaveUser}>
              <div className="modal-body">
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  <div>
                    <label className="form-label">First Name</label>
                    <input type="text" className="form-input" value={editForm.firstName}
                      onChange={(e) => setEditForm({ ...editForm, firstName: e.target.value })} required />
                  </div>
                  <div>
                    <label className="form-label">Last Name</label>
                    <input type="text" className="form-input" value={editForm.lastName}
                      onChange={(e) => setEditForm({ ...editForm, lastName: e.target.value })} required />
                  </div>
                </div>
                <div style={{ marginTop: 12 }}>
                  <label className="form-label">Email</label>
                  <input type="email" className="form-input" value={editForm.email}
                    onChange={(e) => setEditForm({ ...editForm, email: e.target.value })} required />
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginTop: 12 }}>
                  <div>
                    <label className="form-label">Role</label>
                    <select className="form-input" value={editForm.role}
                      onChange={(e) => setEditForm({ ...editForm, role: e.target.value })}
                      disabled={isSelf(editingUser.id)}>
                      <option value="admin">Admin</option>
                      <option value="manager">Manager</option>
                      <option value="viewer">Viewer</option>
                    </select>
                    {isSelf(editingUser.id) && (
                      <small style={{ color: '#e67e22' }}>Cannot change your own role</small>
                    )}
                  </div>
                  <div>
                    <label className="form-label">Status</label>
                    <select className="form-input" value={editForm.status}
                      onChange={(e) => setEditForm({ ...editForm, status: e.target.value })}
                      disabled={isSelf(editingUser.id)}>
                      <option value="active">Active</option>
                      <option value="suspended">Suspended</option>
                    </select>
                    {isSelf(editingUser.id) && (
                      <small style={{ color: '#e67e22' }}>Cannot change your own status</small>
                    )}
                  </div>
                </div>
                {/* Permission summary */}
                <div className="role-permissions-box" style={{ marginTop: 16, padding: 12, background: '#f0f4ff', borderRadius: 6, border: '1px solid #d0d8f0' }}>
                  <strong style={{ fontSize: 13 }}>Permissions for "{editForm.role}":</strong>
                  <p style={{ margin: '4px 0 0', fontSize: 13, color: '#444' }}>{ROLE_PERMISSIONS[editForm.role]}</p>
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={closeEditModal}>Cancel</button>
                <button type="submit" className="btn btn-primary" disabled={saving}>
                  {saving ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Reset Password Modal ── */}
      {resetUser && (
        <div className="modal-overlay" onClick={() => setResetUser(null)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 420 }}>
            <div className="modal-header">
              <h2>Reset Password</h2>
              <button className="modal-close" onClick={() => setResetUser(null)}>&times;</button>
            </div>
            <form onSubmit={handleResetPassword}>
              <div className="modal-body">
                <p style={{ marginBottom: 12, color: '#555' }}>
                  Set a new password for <strong>{resetUser.firstName} {resetUser.lastName}</strong> ({resetUser.email})
                </p>
                <label className="form-label">New Password</label>
                <input type="password" className="form-input" value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)} required minLength={8}
                  placeholder="Enter new password" />
                <small style={{ color: '#666', fontSize: 11 }}>Min 8 chars, 1 uppercase, 1 lowercase, 1 number</small>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setResetUser(null)}>Cancel</button>
                <button type="submit" className="btn btn-primary" disabled={resetting}>
                  {resetting ? 'Resetting...' : 'Reset Password'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default UserManagement;
