import React, { useState, useEffect, useRef } from 'react';
import { createConversation, listConversations, getConversation, sendChatMessage, archiveConversation, deleteConversation, getSuggestedQuestions } from '../services/api';

function Chatbot() {
  const [conversations, setConversations] = useState([]);
  const [activeConversation, setActiveConversation] = useState(null);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [loading, setLoading] = useState(true);
  const [suggestions, setSuggestions] = useState([]);
  const [error, setError] = useState('');
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);

  useEffect(() => {
    loadConversations();
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  useEffect(() => {
    if (activeConversation && inputRef.current) {
      inputRef.current.focus();
    }
  }, [activeConversation]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const loadConversations = async () => {
    try {
      const res = await listConversations();
      setConversations(res.data.data);
    } catch (err) {
      // Non-critical
    } finally {
      setLoading(false);
    }
  };

  const handleNewConversation = async () => {
    try {
      const res = await createConversation();
      setConversations([res.data, ...conversations]);
      setActiveConversation(res.data);
      setMessages([]);
      setSuggestions([
        'What RFP documents have been uploaded?',
        'Summarize the key requirements across all RFPs',
        'What are the common compliance requirements?',
      ]);
      setError('');
    } catch (err) {
      setError('Failed to create conversation');
    }
  };

  const handleSelectConversation = async (conv) => {
    try {
      setLoading(true);
      const res = await getConversation(conv.id);
      setActiveConversation(res.data);
      setMessages(res.data.messages || []);
      setError('');
      loadSuggestions(conv.id);
    } catch (err) {
      setError('Failed to load conversation');
    } finally {
      setLoading(false);
    }
  };

  const loadSuggestions = async (conversationId) => {
    try {
      const res = await getSuggestedQuestions(conversationId);
      setSuggestions(res.data.questions || []);
    } catch (err) {
      setSuggestions([]);
    }
  };

  const handleSend = async (messageText) => {
    const text = messageText || input.trim();
    if (!text || sending) return;

    if (!activeConversation) {
      // Auto-create conversation on first message
      try {
        const res = await createConversation();
        setConversations([res.data, ...conversations]);
        setActiveConversation(res.data);
        await sendMessageToConversation(res.data.id, text);
      } catch (err) {
        setError('Failed to start conversation');
      }
      return;
    }

    await sendMessageToConversation(activeConversation.id, text);
  };

  const sendMessageToConversation = async (conversationId, text) => {
    setSending(true);
    setInput('');
    setError('');
    setSuggestions([]);

    // Optimistically add user message
    const tempUserMsg = { id: `temp-${Date.now()}`, role: 'user', content: text, createdAt: new Date().toISOString() };
    setMessages((prev) => [...prev, tempUserMsg]);

    try {
      const res = await sendChatMessage(conversationId, text);
      const { userMessage, message: assistantMessage, conversationTitle } = res.data;

      // Replace temp message with real one and add assistant response
      setMessages((prev) => {
        const filtered = prev.filter((m) => m.id !== tempUserMsg.id);
        return [...filtered, userMessage, assistantMessage];
      });

      // Update conversation title if changed
      if (conversationTitle) {
        setActiveConversation((prev) => ({ ...prev, title: conversationTitle }));
        setConversations((prev) =>
          prev.map((c) => c.id === conversationId ? { ...c, title: conversationTitle } : c)
        );
      }

      // Load follow-up suggestions
      loadSuggestions(conversationId);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to send message');
      // Remove optimistic message on error
      setMessages((prev) => prev.filter((m) => m.id !== tempUserMsg.id));
    } finally {
      setSending(false);
    }
  };

  const handleArchive = async (convId) => {
    try {
      await archiveConversation(convId);
      setConversations(conversations.filter((c) => c.id !== convId));
      if (activeConversation?.id === convId) {
        setActiveConversation(null);
        setMessages([]);
      }
    } catch (err) {
      setError('Failed to archive conversation');
    }
  };

  const handleDelete = async (convId) => {
    try {
      await deleteConversation(convId);
      setConversations(conversations.filter((c) => c.id !== convId));
      if (activeConversation?.id === convId) {
        setActiveConversation(null);
        setMessages([]);
      }
    } catch (err) {
      setError('Failed to delete conversation');
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
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
    <div className="chatbot-container">
      {/* Sidebar */}
      <div className={`chat-sidebar ${sidebarOpen ? 'open' : 'closed'}`}>
        <div className="chat-sidebar-header">
          <h3>Conversations</h3>
          <button className="btn btn-sm btn-primary" onClick={handleNewConversation}>
            + New
          </button>
        </div>

        <div className="chat-conversation-list">
          {conversations.length === 0 && !loading && (
            <div style={{ padding: 16, color: '#888', fontSize: 13, textAlign: 'center' }}>
              No conversations yet. Start a new one!
            </div>
          )}
          {conversations.map((conv) => (
            <div
              key={conv.id}
              className={`chat-conversation-item ${activeConversation?.id === conv.id ? 'active' : ''}`}
              onClick={() => handleSelectConversation(conv)}
            >
              <div className="conv-title">{conv.title}</div>
              <div className="conv-meta">
                {conv.lastMessageAt
                  ? new Date(conv.lastMessageAt).toLocaleDateString()
                  : new Date(conv.createdAt).toLocaleDateString()}
              </div>
              <div className="conv-actions" onClick={(e) => e.stopPropagation()}>
                <button
                  className="btn-icon"
                  title="Archive"
                  onClick={() => handleArchive(conv.id)}
                >
                  A
                </button>
                <button
                  className="btn-icon btn-icon-danger"
                  title="Delete"
                  onClick={() => handleDelete(conv.id)}
                >
                  X
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Chat Area */}
      <div className="chat-main">
        <div className="chat-header">
          <button
            className="btn btn-sm btn-secondary chat-sidebar-toggle"
            onClick={() => setSidebarOpen(!sidebarOpen)}
          >
            {sidebarOpen ? '<' : '>'}
          </button>
          <h2>{activeConversation?.title || 'AI Chatbot'}</h2>
        </div>

        {error && <div className="error-msg" style={{ margin: '0 16px' }}>{error}</div>}

        {/* Messages */}
        <div className="chat-messages">
          {messages.length === 0 && !sending && (
            <div className="chat-empty-state">
              <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#ccc" strokeWidth="1.5" style={{ marginBottom: 16 }}>
                <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
              </svg>
              <h3 style={{ color: '#888' }}>RFP Knowledge Assistant</h3>
              <p style={{ color: '#aaa' }}>
                Ask questions about your RFP documents, proposals, compliance requirements, and more.
                Answers are grounded in your indexed knowledge base.
              </p>
            </div>
          )}

          {messages.map((msg) => (
            <div key={msg.id} className={`chat-message chat-message-${msg.role}`}>
              <div className="chat-message-bubble">
                <div className="chat-message-content">
                  {msg.content.split('\n').map((line, i) => (
                    <p key={i}>{line}</p>
                  ))}
                </div>

                {/* Source Citations */}
                {msg.sources && msg.sources.length > 0 && (
                  <div className="chat-sources">
                    <div className="chat-sources-label">Sources:</div>
                    {msg.sources.map((src, i) => (
                      <span key={i} className="chat-source-chip">
                        {getSourceTypeLabel(src.sourceType)}: {src.sourceTitle}
                        <span className="source-similarity">{Math.round(src.similarity * 100)}%</span>
                      </span>
                    ))}
                  </div>
                )}
              </div>
              <div className="chat-message-time">
                {msg.createdAt ? new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}
              </div>
            </div>
          ))}

          {sending && (
            <div className="chat-message chat-message-assistant">
              <div className="chat-message-bubble">
                <div className="chat-typing-indicator">
                  <span></span><span></span><span></span>
                </div>
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Suggestions */}
        {suggestions.length > 0 && !sending && (
          <div className="chat-suggestions">
            {suggestions.map((q, i) => (
              <button
                key={i}
                className="suggestion-chip"
                onClick={() => handleSend(q)}
              >
                {q}
              </button>
            ))}
          </div>
        )}

        {/* Input */}
        <div className="chat-input-area">
          <textarea
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask about your RFPs, proposals, or procurement..."
            rows={1}
            disabled={sending}
            className="chat-input"
          />
          <button
            className="btn btn-primary chat-send-btn"
            onClick={() => handleSend()}
            disabled={sending || !input.trim()}
          >
            {sending ? '...' : 'Send'}
          </button>
        </div>
      </div>
    </div>
  );
}

export default Chatbot;
