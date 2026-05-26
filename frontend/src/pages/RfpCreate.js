import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { createRfp } from '../services/api';

function RfpCreate() {
  const [rawInput, setRawInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!rawInput.trim()) return;

    setLoading(true);
    setError('');

    try {
      const res = await createRfp(rawInput);
      navigate(`/rfps/${res.data.id}`);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to create RFP');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <div className="page-header">
        <h1>Create New RFP</h1>
      </div>

      <div className="card">
        <h2>Describe Your Procurement Needs</h2>
        <p style={{ color: '#666', marginBottom: 16 }}>
          Describe what you need in natural language. Our AI will convert it into a structured RFP.
        </p>

        {error && <div className="error-msg">{error}</div>}

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label>Procurement Description</label>
            <textarea
              value={rawInput}
              onChange={(e) => setRawInput(e.target.value)}
              placeholder="Example: I need to procure laptops and monitors for our new office. Budget is $50,000 total. Need delivery within 30 days. We need 20 laptops with 16GB RAM and 15 monitors 27-inch. Payment terms should be net 30, and we need at least 1 year warranty."
              rows={8}
              disabled={loading}
            />
          </div>

          <button type="submit" className="btn btn-primary" disabled={loading || !rawInput.trim()}>
            {loading ? 'AI is processing...' : 'Create RFP with AI'}
          </button>
        </form>
      </div>

      <div className="card">
        <h3>Tips for Better Results</h3>
        <ul style={{ paddingLeft: 20, color: '#666' }}>
          <li>Include specific quantities and specifications</li>
          <li>Mention your budget if you have one</li>
          <li>Specify delivery timeline requirements</li>
          <li>Include payment terms and warranty needs</li>
          <li>Add any special requirements or conditions</li>
        </ul>
      </div>
    </div>
  );
}

export default RfpCreate;
