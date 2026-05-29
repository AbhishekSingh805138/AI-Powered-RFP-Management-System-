import React, { useState, useEffect, useCallback } from 'react';
import { listNotifications, getNotificationStats } from '../services/api';

const TYPE_LABELS = {
  'rfp-sent': 'RFP Sent',
  'proposal-received': 'Proposal Received',
  'status-changed': 'Status Changed',
  'risk-analysis-complete': 'Risk Analysis',
  'extraction-complete': 'Extraction Complete',
};

const STATUS_COLORS = {
  sent: '#34d399',
  queued: '#fbbf24',
  failed: '#f87171',
};

function Notifications() {
  const [notifications, setNotifications] = useState([]);
  const [stats, setStats] = useState(null);
  const [pagination, setPagination] = useState({ page: 1, totalPages: 1, total: 0 });
  const [filters, setFilters] = useState({ type: '', status: '' });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchData = useCallback(async (page = 1) => {
    setLoading(true);
    setError(null);
    try {
      const params = { page, limit: 20 };
      if (filters.type) params.type = filters.type;
      if (filters.status) params.status = filters.status;

      const [notifRes, statsRes] = await Promise.all([
        listNotifications(params),
        page === 1 ? getNotificationStats() : Promise.resolve(null),
      ]);

      setNotifications(notifRes.data.notifications);
      setPagination(notifRes.data.pagination);
      if (statsRes) setStats(statsRes.data);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to load notifications');
    } finally {
      setLoading(false);
    }
  }, [filters]);

  useEffect(() => {
    fetchData(1);
  }, [fetchData]);

  const handleFilterChange = (key, value) => {
    setFilters((prev) => ({ ...prev, [key]: value }));
  };

  return (
    <div className="notifications-page">
      <h2>Notification History</h2>

      {stats && (
        <div className="notification-stats">
          <div className="notif-stat-card">
            <div className="notif-stat-value">{stats.total}</div>
            <div className="notif-stat-label">Total</div>
          </div>
          <div className="notif-stat-card notif-stat-sent">
            <div className="notif-stat-value">{stats.sent}</div>
            <div className="notif-stat-label">Sent</div>
          </div>
          <div className="notif-stat-card notif-stat-failed">
            <div className="notif-stat-value">{stats.failed}</div>
            <div className="notif-stat-label">Failed</div>
          </div>
          <div className="notif-stat-card notif-stat-queued">
            <div className="notif-stat-value">{stats.queued}</div>
            <div className="notif-stat-label">Queued</div>
          </div>
          <div className="notif-stat-card">
            <div className="notif-stat-value">{stats.recentCount}</div>
            <div className="notif-stat-label">Last 7 Days</div>
          </div>
        </div>
      )}

      <div className="notification-filters">
        <select
          value={filters.type}
          onChange={(e) => handleFilterChange('type', e.target.value)}
        >
          <option value="">All Types</option>
          {Object.entries(TYPE_LABELS).map(([key, label]) => (
            <option key={key} value={key}>{label}</option>
          ))}
        </select>
        <select
          value={filters.status}
          onChange={(e) => handleFilterChange('status', e.target.value)}
        >
          <option value="">All Statuses</option>
          <option value="sent">Sent</option>
          <option value="queued">Queued</option>
          <option value="failed">Failed</option>
        </select>
      </div>

      {error && <div className="error-message">{error}</div>}

      {loading ? (
        <p className="loading-text">Loading notifications...</p>
      ) : notifications.length === 0 ? (
        <p className="empty-text">No notifications found.</p>
      ) : (
        <>
          <div className="notification-list">
            {notifications.map((n) => (
              <div key={n.id} className="notification-item">
                <div className="notification-header">
                  <span className="notification-type-badge">
                    {TYPE_LABELS[n.type] || n.type}
                  </span>
                  <span
                    className="notification-status-badge"
                    style={{ background: STATUS_COLORS[n.status] || '#94a3b8' }}
                  >
                    {n.status}
                  </span>
                </div>
                <div className="notification-subject">{n.subject}</div>
                <div className="notification-meta">
                  <span>To: {n.recipientEmail}</span>
                  <span>{new Date(n.createdAt).toLocaleString()}</span>
                  {n.sentAt && <span>Sent: {new Date(n.sentAt).toLocaleString()}</span>}
                </div>
                {n.error && (
                  <div className="notification-error">Error: {n.error}</div>
                )}
              </div>
            ))}
          </div>

          {pagination.totalPages > 1 && (
            <div className="notification-pagination">
              <button
                disabled={pagination.page <= 1}
                onClick={() => fetchData(pagination.page - 1)}
              >
                Previous
              </button>
              <span>Page {pagination.page} of {pagination.totalPages} ({pagination.total} total)</span>
              <button
                disabled={pagination.page >= pagination.totalPages}
                onClick={() => fetchData(pagination.page + 1)}
              >
                Next
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}

export default Notifications;
