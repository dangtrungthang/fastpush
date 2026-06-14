import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import api from '../api/client';

export default function CreateApp() {
  const [name, setName] = useState('');
  const [platform, setPlatform] = useState('android');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      await api.post('/apps', { name, platform });
      navigate('/');
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to create app');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="page">
      <header className="top-bar">
        <div className="top-bar-left">
          <Link to="/" className="logo">⚡ FastPush</Link>
        </div>
      </header>

      <main className="container" style={{ maxWidth: 500 }}>
        <h1>Create New App</h1>
        {error && <div className="error-msg">{error}</div>}
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label>App Name</label>
            <input type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="MyApp" required />
          </div>
          <div className="form-group">
            <label>Platform</label>
            <select value={platform} onChange={(e) => setPlatform(e.target.value)}>
              <option value="android">Android</option>
              <option value="ios">iOS</option>
            </select>
          </div>
          <div className="form-actions">
            <Link to="/" className="btn btn-outline">Cancel</Link>
            <button type="submit" className="btn btn-primary" disabled={loading}>
              {loading ? 'Creating...' : 'Create App'}
            </button>
          </div>
        </form>
      </main>
    </div>
  );
}
