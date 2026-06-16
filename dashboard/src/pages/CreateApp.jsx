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
      const { data } = await api.post('/apps', { name, platform });
      navigate(`/apps/${data.id}/deployments`);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to create app');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <div className="page-breadcrumb"><Link to="/">Apps</Link> / New App</div>
          <h1 className="page-title">Create New App</h1>
        </div>
      </div>

      <div className="card" style={{ maxWidth: 480 }}>
        <div className="card-header">App details</div>
        <div className="card-body">
          {error && <div className="error-msg">{error}</div>}
          <form onSubmit={handleSubmit}>
            <div className="form-group">
              <label>App Name</label>
              <input type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="MyApp" required autoFocus />
            </div>
            <div className="form-group">
              <label>Platform</label>
              <select value={platform} onChange={(e) => setPlatform(e.target.value)}>
                <option value="android">Android 🤖</option>
                <option value="ios">iOS 🍎</option>
              </select>
            </div>
            <div className="form-actions">
              <Link to="/" className="btn btn-secondary">Cancel</Link>
              <button type="submit" className="btn btn-primary" disabled={loading}>
                {loading ? 'Creating…' : 'Create App'}
              </button>
            </div>
          </form>
        </div>
      </div>

      <div className="card mt-4" style={{ maxWidth: 480 }}>
        <div className="card-body">
          <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
            <strong>Production</strong> and <strong>Staging</strong> deployments will be created automatically.
            Each deployment has its own deployment key for use with the SDK.
          </div>
        </div>
      </div>
    </div>
  );
}
