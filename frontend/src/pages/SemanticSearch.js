import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { semanticSearch, indexAllDocuments, getSearchStats } from '../services/api';

function SemanticSearch() {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState(null);
  const [loading, setLoading] = useState(false);
  const [indexing, setIndexing] = useState(false);
  const [stats, setStats] = useState(null);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [filterType, setFilterType] = useState('');
  const navigate = useNavigate();

  useEffect(() => {
    loadStats();
  }, []);

  const loadStats = async () => {
    try {
      const res = await getSearchStats();
      setStats(res.data);
    } catch (err) {
      // Stats are optional
    }
  };

  const handleSearch = async (e) => {
    e.preventDefault();
    if (!query.trim()) return;

    setLoading(true);
    setError('');
    setResults(null);

    try {
      const res = await semanticSearch(query, {
        topK: 10,
        filterSourceType: filterType || null,
      });
      setResults(res.data);
    } catch (err) {
      setError(err.response?.data?.error || 'Search failed');
    } finally {
      setLoading(false);
    }
  };

  const handleIndexAll = async () => {
    setIndexing(true);
    setError('');
    setSuccessMsg('');

    try {
      const res = await indexAllDocuments();
      setSuccessMsg(`Indexed ${res.data.indexed} documents successfully!`);
      setTimeout(() => setSuccessMsg(''), 4000);
      loadStats();
    } catch (err) {
      setError(err.response?.data?.error || 'Indexing failed');
    } finally {
      setIndexing(false);
    }
  };

  const getSourceLink = (sourceType, sourceId) => {
    switch (sourceType) {
      case 'rfp_document': return `/rfp-analyzer/${sourceId}`;
      case 'generated_proposal': return null;
      case 'proposal': return `/proposals`;
      case 'rfp': return `/rfps/${sourceId}`;
      default: return null;
    }
  };

  const getSourceTypeLabel = (type) => {
    const labels = {
      rfp_document: 'RFP Document',
      generated_proposal: 'Generated Proposal',
      proposal: 'Vendor Proposal',
      rfp: 'RFP',
    };
    return labels[type] || type;
  };

  return (
    <div>
      <div className="page-header">
        <h1>Semantic Search</h1>
        <button
          className="btn btn-secondary"
          onClick={handleIndexAll}
          disabled={indexing}
        >
          {indexing ? 'Indexing...' : 'Index All Documents'}
        </button>
      </div>

      {error && <div className="error-msg">{error}</div>}
      {successMsg && <div className="success-msg">{successMsg}</div>}

      {/* Index Stats */}
      {stats && (
        <div className="card" style={{ padding: '12px 24px' }}>
          <div style={{ display: 'flex', gap: 24, alignItems: 'center', fontSize: 13, color: '#666' }}>
            <span><strong>{stats.totalChunks}</strong> chunks indexed</span>
            {stats.byType && stats.byType.map((t) => (
              <span key={t.sourceType}>
                {getSourceTypeLabel(t.sourceType)}: <strong>{t.docCount}</strong> docs ({t.chunkCount} chunks)
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Search Form */}
      <div className="card">
        <form onSubmit={handleSearch}>
          <div className="search-bar">
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Ask anything about your proposals, RFPs, or documents..."
              className="search-input"
              disabled={loading}
            />
            <select
              value={filterType}
              onChange={(e) => setFilterType(e.target.value)}
              className="search-filter"
            >
              <option value="">All Sources</option>
              <option value="rfp_document">RFP Documents</option>
              <option value="generated_proposal">Generated Proposals</option>
              <option value="proposal">Vendor Proposals</option>
              <option value="rfp">RFPs</option>
            </select>
            <button
              type="submit"
              className="btn btn-primary"
              disabled={loading || !query.trim()}
            >
              {loading ? 'Searching...' : 'Search'}
            </button>
          </div>
        </form>

        <div className="search-suggestions">
          <span>Try: </span>
          {['What pricing was used for ERP implementations?', 'Show compliance certifications mentioned', 'Cloud migration experience and past projects'].map((suggestion) => (
            <button
              key={suggestion}
              className="suggestion-chip"
              onClick={() => { setQuery(suggestion); }}
            >
              {suggestion}
            </button>
          ))}
        </div>
      </div>

      {/* AI Answer */}
      {results && (
        <>
          <div className="card rag-answer">
            <h2>AI Answer</h2>
            <div className="answer-content">
              {results.answer.split('\n').map((line, i) => (
                <p key={i}>{line}</p>
              ))}
            </div>
          </div>

          {/* Sources */}
          {results.sources && results.sources.length > 0 && (
            <div className="card">
              <h2>Sources ({results.sources.length})</h2>
              <div className="sources-list">
                {results.sources.map((source, i) => {
                  const link = getSourceLink(source.sourceType, source.sourceId);
                  return (
                    <div key={i} className="source-item">
                      <div className="source-header">
                        <span className={`badge badge-source-${source.sourceType}`}>
                          {getSourceTypeLabel(source.sourceType)}
                        </span>
                        <strong>
                          {link ? (
                            <span
                              className="source-link"
                              onClick={() => navigate(link)}
                            >
                              {source.sourceTitle}
                            </span>
                          ) : source.sourceTitle}
                        </strong>
                        <span className="relevance-badge">
                          {Math.round(source.topSimilarity * 100)}% relevant
                        </span>
                      </div>
                      <span style={{ fontSize: 12, color: '#888' }}>
                        {source.chunkCount} matching section{source.chunkCount > 1 ? 's' : ''}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Matching Chunks */}
          {results.chunks && results.chunks.length > 0 && (
            <div className="card">
              <h2>Matching Passages</h2>
              {results.chunks.map((chunk, i) => (
                <div key={i} className="chunk-item">
                  <div className="chunk-header">
                    <span className="chunk-source">{chunk.sourceTitle}</span>
                    <span className="relevance-badge">
                      {Math.round(chunk.similarity * 100)}%
                    </span>
                  </div>
                  <p className="chunk-text">{chunk.chunkText}</p>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {/* Empty state */}
      {!results && !loading && (
        <div className="card" style={{ textAlign: 'center', padding: 40, color: '#888' }}>
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#ccc" strokeWidth="1.5" style={{ marginBottom: 16 }}>
            <circle cx="11" cy="11" r="8" />
            <path d="M21 21l-4.35-4.35" />
          </svg>
          <h3 style={{ color: '#888' }}>Search your knowledge base</h3>
          <p>Ask questions in natural language. AI will find relevant information across all your documents and proposals.</p>
          {stats && stats.totalChunks === 0 && (
            <p style={{ marginTop: 12, color: '#e63946' }}>
              No documents indexed yet. Click "Index All Documents" to build the search index.
            </p>
          )}
        </div>
      )}
    </div>
  );
}

export default SemanticSearch;
