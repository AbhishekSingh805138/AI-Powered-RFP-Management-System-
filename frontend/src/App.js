import React from 'react';
import { BrowserRouter as Router, Routes, Route, NavLink, Navigate } from 'react-router-dom';
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
import './styles/App.css';

function AppLayout() {
  const { user, logout } = useAuth();
  const isManagerOrAdmin = user?.role === 'admin' || user?.role === 'manager';

  return (
    <div className="app">
      <aside className="sidebar">
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
      <main className="main-content">
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
