import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { getAnalytics } from '../services/api';
import {
  PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer,
  AreaChart, Area, XAxis, YAxis, CartesianGrid,
  BarChart, Bar,
} from 'recharts';

const STATUS_COLORS = {
  draft: '#94a3b8',
  published: '#60a5fa',
  sent: '#818cf8',
  evaluating: '#fbbf24',
  awarded: '#34d399',
  closed: '#f87171',
};

const RISK_COLORS = {
  low: '#34d399',
  medium: '#fbbf24',
  high: '#fb923c',
  critical: '#f87171',
};

const AREA_COLORS = {
  rfps: '#4361ee',
  documents: '#2ec4b6',
  proposals: '#818cf8',
  risks: '#fb923c',
};

function Dashboard() {
  const { user } = useAuth();
  const isManagerOrAdmin = user?.role === 'admin' || user?.role === 'manager';
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const res = await getAnalytics();
        setData(res.data);
      } catch {
        // Fall back to empty state
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  if (loading) return <div className="loading">Loading dashboard...</div>;

  const summary = data?.summary || {};
  const charts = data?.charts || {};

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

      {/* Summary Stats */}
      <div className="dashboard-stats-grid">
        <div className="stat-card">
          <div className="stat-value">{summary.analyzedDocuments || 0}</div>
          <div className="stat-label">RFPs Analyzed</div>
        </div>
        <div className="stat-card">
          <div className="stat-value">{summary.totalRfps || 0}</div>
          <div className="stat-label">Total RFPs</div>
        </div>
        <div className="stat-card">
          <div className="stat-value">{summary.totalVendors || 0}</div>
          <div className="stat-label">Vendors</div>
        </div>
        <div className="stat-card">
          <div className="stat-value">{summary.totalProposals || 0}</div>
          <div className="stat-label">Proposals Received</div>
        </div>
        <div className="stat-card">
          <div className="stat-value">{summary.riskAnalyses || 0}</div>
          <div className="stat-label">Risk Analyses</div>
        </div>
        <div className="stat-card">
          <div className="stat-value">{summary.avgProposalScore || 0}</div>
          <div className="stat-label">Avg. Proposal Score</div>
        </div>
      </div>

      {/* Budget highlight */}
      {summary.totalBudget > 0 && (
        <div className="dashboard-budget-bar">
          <div className="budget-item">
            <span className="budget-label">Total Budget</span>
            <span className="budget-value">${summary.totalBudget.toLocaleString()}</span>
          </div>
          <div className="budget-item">
            <span className="budget-label">Avg. Budget per RFP</span>
            <span className="budget-value">${summary.avgBudget.toLocaleString()}</span>
          </div>
          <div className="budget-item">
            <span className="budget-label">Chat Conversations</span>
            <span className="budget-value">{summary.chatConversations || 0}</span>
          </div>
        </div>
      )}

      {/* Charts Row */}
      <div className="dashboard-charts-grid">
        {/* RFP Status Breakdown */}
        <div className="card dashboard-chart-card">
          <h3>RFP Status Breakdown</h3>
          {charts.rfpStatusBreakdown?.length > 0 ? (
            <ResponsiveContainer width="100%" height={260}>
              <PieChart>
                <Pie
                  data={charts.rfpStatusBreakdown}
                  cx="50%"
                  cy="50%"
                  innerRadius={50}
                  outerRadius={90}
                  paddingAngle={3}
                  dataKey="value"
                  nameKey="name"
                  label={({ name, value }) => `${name} (${value})`}
                >
                  {charts.rfpStatusBreakdown.map((entry) => (
                    <Cell key={entry.name} fill={STATUS_COLORS[entry.name] || '#94a3b8'} />
                  ))}
                </Pie>
                <Tooltip />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <div className="chart-empty">No RFPs yet</div>
          )}
        </div>

        {/* Risk Level Distribution */}
        <div className="card dashboard-chart-card">
          <h3>Risk Level Distribution</h3>
          {charts.riskLevelDistribution?.some((r) => r.value > 0) ? (
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={charts.riskLevelDistribution} layout="vertical" margin={{ left: 10, right: 20 }}>
                <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                <XAxis type="number" allowDecimals={false} />
                <YAxis dataKey="name" type="category" width={60} tick={{ fontSize: 12, textTransform: 'capitalize' }} />
                <Tooltip />
                <Bar dataKey="value" name="Count" radius={[0, 4, 4, 0]} barSize={28}>
                  {charts.riskLevelDistribution.map((entry) => (
                    <Cell key={entry.name} fill={RISK_COLORS[entry.name] || '#94a3b8'} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="chart-empty">No risk analyses yet</div>
          )}
        </div>
      </div>

      {/* Activity Timeline */}
      {charts.activityTimeline?.length > 0 && (
        <div className="card dashboard-chart-card" style={{ marginBottom: 20 }}>
          <h3>Activity — Last 30 Days</h3>
          <ResponsiveContainer width="100%" height={280}>
            <AreaChart data={charts.activityTimeline} margin={{ top: 10, right: 20, left: 0, bottom: 0 }}>
              <defs>
                {Object.entries(AREA_COLORS).map(([key, color]) => (
                  <linearGradient key={key} id={`grad-${key}`} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={color} stopOpacity={0.3} />
                    <stop offset="95%" stopColor={color} stopOpacity={0} />
                  </linearGradient>
                ))}
              </defs>
              <CartesianGrid strokeDasharray="3 3" vertical={false} />
              <XAxis
                dataKey="date"
                tick={{ fontSize: 11 }}
                tickFormatter={(d) => {
                  const dt = new Date(d + 'T00:00:00');
                  return `${dt.getMonth() + 1}/${dt.getDate()}`;
                }}
                interval={4}
              />
              <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
              <Tooltip
                labelFormatter={(d) => new Date(d + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
              />
              <Legend />
              <Area type="monotone" dataKey="rfps" name="RFPs" stroke={AREA_COLORS.rfps} fillOpacity={1} fill={`url(#grad-rfps)`} />
              <Area type="monotone" dataKey="documents" name="Documents" stroke={AREA_COLORS.documents} fillOpacity={1} fill={`url(#grad-documents)`} />
              <Area type="monotone" dataKey="proposals" name="Proposals" stroke={AREA_COLORS.proposals} fillOpacity={1} fill={`url(#grad-proposals)`} />
              <Area type="monotone" dataKey="risks" name="Risk Analyses" stroke={AREA_COLORS.risks} fillOpacity={1} fill={`url(#grad-risks)`} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Proposal Sources */}
      {charts.proposalSources?.length > 0 && (
        <div className="dashboard-charts-grid" style={{ marginBottom: 20 }}>
          <div className="card dashboard-chart-card">
            <h3>Proposal Sources</h3>
            <ResponsiveContainer width="100%" height={220}>
              <PieChart>
                <Pie
                  data={charts.proposalSources}
                  cx="50%"
                  cy="50%"
                  outerRadius={80}
                  dataKey="value"
                  nameKey="name"
                  label={({ name, value }) => `${name} (${value})`}
                >
                  {charts.proposalSources.map((entry, i) => (
                    <Cell key={entry.name} fill={['#4361ee', '#2ec4b6', '#818cf8', '#fbbf24'][i % 4]} />
                  ))}
                </Pie>
                <Tooltip />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </div>

          <div className="card dashboard-chart-card">
            <h3>Document Analysis Status</h3>
            {charts.documentStatus?.length > 0 ? (
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={charts.documentStatus} margin={{ left: 10, right: 20 }}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                  <YAxis allowDecimals={false} />
                  <Tooltip />
                  <Bar dataKey="value" name="Count" fill="#4361ee" radius={[4, 4, 0, 0]} barSize={40} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="chart-empty">No documents uploaded yet</div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default Dashboard;
