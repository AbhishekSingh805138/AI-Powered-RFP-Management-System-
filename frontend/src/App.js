import React, { useState, useEffect, useCallback } from 'react';
import { BrowserRouter as Router, Routes, Route, NavLink, Navigate, useLocation } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import ProtectedRoute from './components/ProtectedRoute';
import ErrorBoundary from './components/ErrorBoundary';
import Login from './pages/Login';
import Register from './pages/Register';
import Dashboard from './pages/Dashboard';
import RfpList from './pages/RfpList';
import RfpCreate from './pages/RfpCreate';
import RfpDetail from './pages/RfpDetail';
import VendorList from './pages/VendorList';
import ProposalList from './pages/ProposalList';
import RfpAnalyzerUpload from './pages/RfpAnalyzerUpload';
import RfpAnalysis from './pages/RfpAnalysis';
import ProposalGenerator from './pages/ProposalGenerator';
import SemanticSearch from './pages/SemanticSearch';
import ComplianceChecker from './pages/ComplianceChecker';
import RiskAnalyzer from './pages/RiskAnalyzer';
import Chatbot from './pages/Chatbot';
import UserManagement from './pages/UserManagement';
import Notifications from './pages/Notifications';
import './styles/App.css';

function ScrollToTop() {
  const { pathname } = useLocation();
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);
  return null;
}

function AppLayout() {
  const { user, logout } = useAuth();
  const isManagerOrAdmin = user?.role === 'admin' || user?.role === 'manager';
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const location = useLocation();

  const closeSidebar = useCallback(() => setSidebarOpen(false), []);

  // Close sidebar on route change (mobile)
  useEffect(() => {
    closeSidebar();
  }, [location.pathname, closeSidebar]);

  // Close sidebar on Escape key
  useEffect(() => {
    const handleEsc = (e) => { if (e.key === 'Escape') closeSidebar(); };
    document.addEventListener('keydown', handleEsc);
    return () => document.removeEventListener('keydown', handleEsc);
  }, [closeSidebar]);

  return (
    <div className="app">
      <a href="#main-content" className="skip-to-content">Skip to content</a>

      <button
        className="sidebar-toggle"
        onClick={() => setSidebarOpen(!sidebarOpen)}
        aria-label={sidebarOpen ? 'Close navigation' : 'Open navigation'}
        aria-expanded={sidebarOpen}
      >
        <span />
      </button>

      <div
        className={`sidebar-overlay ${sidebarOpen ? 'visible' : ''}`}
        onClick={closeSidebar}
        aria-hidden="true"
      />

      <aside className={`sidebar ${sidebarOpen ? 'open' : ''}`} role="navigation" aria-label="Main navigation">
        <h1>RFP Manager</h1>
        <nav>
          <NavLink to="/" end>Dashboard</NavLink>
          <NavLink to="/rfps">RFPs</NavLink>
          {isManagerOrAdmin && <NavLink to="/rfps/new">Create RFP</NavLink>}
          <NavLink to="/vendors">Vendors</NavLink>
          <NavLink to="/proposals">Proposals</NavLink>
          <NavLink to="/rfp-analyzer">RFP Analyzer</NavLink>
          <NavLink to="/search">Semantic Search</NavLink>
          {isManagerOrAdmin && <NavLink to="/compliance">Compliance Checker</NavLink>}
          {isManagerOrAdmin && <NavLink to="/risk-analyzer">Risk Analyzer</NavLink>}
          <NavLink to="/chatbot">AI Chatbot</NavLink>
          <NavLink to="/notifications">Notifications</NavLink>
          {user?.role === 'admin' && <NavLink to="/admin/users">User Management</NavLink>}
        </nav>
        <div className="sidebar-user">
          <div className="sidebar-user-info">
            <span className="sidebar-user-name">{user?.firstName} {user?.lastName}</span>
            <span className="sidebar-user-role">{user?.role}</span>
          </div>
          <button className="btn-logout" onClick={logout}>Logout</button>
        </div>
      </aside>
      <main className="main-content" id="main-content" role="main">
        <ScrollToTop />
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/rfps" element={<RfpList />} />
          <Route path="/rfps/new" element={
            <ProtectedRoute roles={['admin', 'manager']}><RfpCreate /></ProtectedRoute>
          } />
          <Route path="/rfps/:id" element={<RfpDetail />} />
          <Route path="/vendors" element={<VendorList />} />
          <Route path="/proposals" element={<ProposalList />} />
          <Route path="/rfp-analyzer" element={<RfpAnalyzerUpload />} />
          <Route path="/rfp-analyzer/:id" element={<RfpAnalysis />} />
          <Route path="/rfp-analyzer/:id/generate" element={
            <ProtectedRoute roles={['admin', 'manager']}><ProposalGenerator /></ProtectedRoute>
          } />
          <Route path="/rfp-analyzer/:id/proposal/:proposalId" element={<ProposalGenerator />} />
          <Route path="/search" element={<SemanticSearch />} />
          <Route path="/compliance" element={
            <ProtectedRoute roles={['admin', 'manager']}><ComplianceChecker /></ProtectedRoute>
          } />
          <Route path="/risk-analyzer" element={
            <ProtectedRoute roles={['admin', 'manager']}><RiskAnalyzer /></ProtectedRoute>
          } />
          <Route path="/chatbot" element={<Chatbot />} />
          <Route path="/notifications" element={<Notifications />} />
          <Route path="/admin/users" element={
            <ProtectedRoute roles={['admin']}><UserManagement /></ProtectedRoute>
          } />
        </Routes>
      </main>
    </div>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <AuthProvider>
        <Router>
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route path="/register" element={<Register />} />
            <Route path="/*" element={
              <ProtectedRoute>
                <AppLayout />
              </ProtectedRoute>
            } />
          </Routes>
        </Router>
      </AuthProvider>
    </ErrorBoundary>
  );
}

export default App;
