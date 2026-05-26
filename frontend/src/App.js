import React from 'react';
import { BrowserRouter as Router, Routes, Route, NavLink } from 'react-router-dom';
import ErrorBoundary from './components/ErrorBoundary';
import Dashboard from './pages/Dashboard';
import RfpList from './pages/RfpList';
import RfpCreate from './pages/RfpCreate';
import RfpDetail from './pages/RfpDetail';
import VendorList from './pages/VendorList';
import ProposalList from './pages/ProposalList';
import './styles/App.css';

function App() {
  return (
    <ErrorBoundary>
      <Router>
        <div className="app">
          <aside className="sidebar">
            <h1>RFP Manager</h1>
            <nav>
              <NavLink to="/" end>Dashboard</NavLink>
              <NavLink to="/rfps">RFPs</NavLink>
              <NavLink to="/rfps/new">Create RFP</NavLink>
              <NavLink to="/vendors">Vendors</NavLink>
              <NavLink to="/proposals">Proposals</NavLink>
            </nav>
          </aside>
          <main className="main-content">
            <Routes>
              <Route path="/" element={<Dashboard />} />
              <Route path="/rfps" element={<RfpList />} />
              <Route path="/rfps/new" element={<RfpCreate />} />
              <Route path="/rfps/:id" element={<RfpDetail />} />
              <Route path="/vendors" element={<VendorList />} />
              <Route path="/proposals" element={<ProposalList />} />
            </Routes>
          </main>
        </div>
      </Router>
    </ErrorBoundary>
  );
}

export default App;
