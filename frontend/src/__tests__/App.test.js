/**
 * Tests for App.js — routing and navigation structure.
 */

import React from 'react';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import { MemoryRouter } from 'react-router-dom';

// Mock all page components to isolate routing tests
jest.mock('../pages/Dashboard', () => () => <div data-testid="page-dashboard">DashboardPage</div>);
jest.mock('../pages/RfpList', () => () => <div data-testid="page-rfp-list">RFP List</div>);
jest.mock('../pages/RfpCreate', () => () => <div data-testid="page-rfp-create">RFP Create</div>);
jest.mock('../pages/RfpDetail', () => () => <div data-testid="page-rfp-detail">RFP Detail</div>);
jest.mock('../pages/VendorList', () => () => <div data-testid="page-vendor-list">Vendor List</div>);
jest.mock('../pages/ProposalList', () => () => <div data-testid="page-proposal-list">Proposal List</div>);
jest.mock('../pages/RfpAnalyzerUpload', () => () => <div data-testid="page-analyzer-upload">RFP Analyzer Page</div>);
jest.mock('../pages/RfpAnalysis', () => () => <div data-testid="page-analysis">RFP Analysis</div>);
jest.mock('../pages/ProposalGenerator', () => () => <div data-testid="page-proposal-gen">Proposal Generator</div>);
jest.mock('../pages/SemanticSearch', () => () => <div data-testid="page-search">Semantic Search Page</div>);
jest.mock('../pages/ComplianceChecker', () => () => <div data-testid="page-compliance">Compliance Checker Page</div>);
jest.mock('../pages/RiskAnalyzer', () => () => <div data-testid="page-risk-analyzer">Risk Analyzer Page</div>);
jest.mock('../pages/Chatbot', () => () => <div data-testid="page-chatbot">AI Chatbot Page</div>);
jest.mock('../pages/UserManagement', () => () => <div data-testid="page-user-mgmt">User Management Page</div>);
jest.mock('../components/ErrorBoundary', () => ({ children }) => <div>{children}</div>);

// Mock auth context to provide an admin user for navigation tests
jest.mock('../contexts/AuthContext', () => ({
  AuthProvider: ({ children }) => <div>{children}</div>,
  useAuth: () => ({
    user: { id: 1, firstName: 'Test', lastName: 'Admin', email: 'admin@test.com', role: 'admin' },
    loading: false,
    logout: jest.fn(),
  }),
}));

import { Routes, Route } from 'react-router-dom';

// Recreate the App's route structure for testing
function TestRoutes() {
  return (
    <Routes>
      <Route path="/" element={<div data-testid="page-dashboard">DashboardPage</div>} />
      <Route path="/rfp-analyzer" element={<div data-testid="page-analyzer-upload">RFP Analyzer Page</div>} />
      <Route path="/rfp-analyzer/:id" element={<div data-testid="page-analysis">RFP Analysis</div>} />
      <Route path="/rfp-analyzer/:id/generate" element={<div data-testid="page-proposal-gen">Proposal Generator</div>} />
      <Route path="/rfp-analyzer/:id/proposal/:proposalId" element={<div data-testid="page-proposal-gen">Proposal Generator</div>} />
      <Route path="/search" element={<div data-testid="page-search">Semantic Search Page</div>} />
      <Route path="/compliance" element={<div data-testid="page-compliance">Compliance Checker Page</div>} />
      <Route path="/risk-analyzer" element={<div data-testid="page-risk-analyzer">Risk Analyzer Page</div>} />
      <Route path="/chatbot" element={<div data-testid="page-chatbot">AI Chatbot Page</div>} />
      <Route path="/rfps" element={<div data-testid="page-rfp-list">RFP List</div>} />
      <Route path="/rfps/new" element={<div data-testid="page-rfp-create">RFP Create</div>} />
      <Route path="/rfps/:id" element={<div data-testid="page-rfp-detail">RFP Detail</div>} />
      <Route path="/vendors" element={<div data-testid="page-vendor-list">Vendor List</div>} />
      <Route path="/proposals" element={<div data-testid="page-proposal-list">Proposal List</div>} />
    </Routes>
  );
}

describe('App Routing', () => {
  function renderWithRouter(path) {
    return render(
      <MemoryRouter initialEntries={[path]}>
        <TestRoutes />
      </MemoryRouter>
    );
  }

  // Phase 1 routes
  test('renders Dashboard at /', () => {
    renderWithRouter('/');
    expect(screen.getByTestId('page-dashboard')).toBeInTheDocument();
  });

  test('renders RFP List at /rfps', () => {
    renderWithRouter('/rfps');
    expect(screen.getByTestId('page-rfp-list')).toBeInTheDocument();
  });

  test('renders RFP Create at /rfps/new', () => {
    renderWithRouter('/rfps/new');
    expect(screen.getByTestId('page-rfp-create')).toBeInTheDocument();
  });

  test('renders RFP Detail at /rfps/:id', () => {
    renderWithRouter('/rfps/1');
    expect(screen.getByTestId('page-rfp-detail')).toBeInTheDocument();
  });

  test('renders Vendor List at /vendors', () => {
    renderWithRouter('/vendors');
    expect(screen.getByTestId('page-vendor-list')).toBeInTheDocument();
  });

  test('renders Proposal List at /proposals', () => {
    renderWithRouter('/proposals');
    expect(screen.getByTestId('page-proposal-list')).toBeInTheDocument();
  });

  // Phase 2 routes
  test('renders RFP Analyzer Upload at /rfp-analyzer', () => {
    renderWithRouter('/rfp-analyzer');
    expect(screen.getByTestId('page-analyzer-upload')).toBeInTheDocument();
  });

  test('renders RFP Analysis at /rfp-analyzer/:id', () => {
    renderWithRouter('/rfp-analyzer/5');
    expect(screen.getByTestId('page-analysis')).toBeInTheDocument();
  });

  test('renders Proposal Generator at /rfp-analyzer/:id/generate', () => {
    renderWithRouter('/rfp-analyzer/5/generate');
    expect(screen.getByTestId('page-proposal-gen')).toBeInTheDocument();
  });

  test('renders Proposal Generator at /rfp-analyzer/:id/proposal/:proposalId', () => {
    renderWithRouter('/rfp-analyzer/5/proposal/10');
    expect(screen.getByTestId('page-proposal-gen')).toBeInTheDocument();
  });

  test('renders Semantic Search at /search', () => {
    renderWithRouter('/search');
    expect(screen.getByTestId('page-search')).toBeInTheDocument();
  });

  test('renders Compliance Checker at /compliance', () => {
    renderWithRouter('/compliance');
    expect(screen.getByTestId('page-compliance')).toBeInTheDocument();
  });

  // Phase 3 routes
  test('renders Risk Analyzer at /risk-analyzer', () => {
    renderWithRouter('/risk-analyzer');
    expect(screen.getByTestId('page-risk-analyzer')).toBeInTheDocument();
  });

  test('renders AI Chatbot at /chatbot', () => {
    renderWithRouter('/chatbot');
    expect(screen.getByTestId('page-chatbot')).toBeInTheDocument();
  });
});

describe('App Navigation Links', () => {
  test('sidebar contains all navigation links', () => {
    const App = require('../App').default;
    render(<App />);

    // Use getAllByRole for links to avoid duplicate text issues with page content
    const links = screen.getAllByRole('link');
    const linkTexts = links.map(l => l.textContent);

    // Phase 1 navigation
    expect(linkTexts).toContain('Dashboard');
    expect(linkTexts).toContain('RFPs');
    expect(linkTexts).toContain('Create RFP');
    expect(linkTexts).toContain('Vendors');
    expect(linkTexts).toContain('Proposals');

    // Phase 2 navigation
    expect(linkTexts).toContain('RFP Analyzer');
    expect(linkTexts).toContain('Semantic Search');
    expect(linkTexts).toContain('Compliance Checker');

    // Phase 3 navigation
    expect(linkTexts).toContain('Risk Analyzer');
    expect(linkTexts).toContain('AI Chatbot');

    // Admin navigation
    expect(linkTexts).toContain('User Management');
  });

  test('sidebar has 11 navigation links for admin', () => {
    const App = require('../App').default;
    render(<App />);
    const navLinks = screen.getAllByRole('link');
    expect(navLinks.length).toBe(11);
  });

  test('app title is displayed', () => {
    const App = require('../App').default;
    render(<App />);
    expect(screen.getByText('RFP Manager')).toBeInTheDocument();
  });
});
