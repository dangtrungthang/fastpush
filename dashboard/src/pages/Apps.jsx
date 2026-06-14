import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import api from '../api/client';

export default function Apps() {
  const [apps, setApps] = useState([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    api.get('/apps').then(({ data }) => {
      setApps(data);
      setLoading(false);
    });
  }, []);

  const user = JSON.parse(localStorage.getItem('fastpush_user') || '{}');

  const logout = () => {
    localStorage.removeItem('fastpush_token');
    localStorage.removeItem('fastpush_user');
    navigate('/login');
  };

  if (loading) return <div className="page-loading">Loading...</div>;

  return (
    <div className="page">
      <header className="top-bar">
        <div className="top-bar-left">
          <span className="logo">⚡ FastPush</span>
        </div>
        <div className="top-bar-right">
          <span className="user-name">{user.name}</span>
          <button className="btn btn-sm btn-outline" onClick={logout}>Logout</button>
        </div>
      </header>

      <main className="container">
        <div className="page-header">
          <h1>My Apps</h1>
          <Link to="/apps/create" className="btn btn-primary">+ New App</Link>
        </div>

        {apps.length === 0 ? (
          <div className="empty-state">
            <p>No apps yet. Create your first app to get started.</p>
          </div>
        ) : (
          <div className="app-grid">
            {apps.map((app) => (
              <Link to={`/apps/${app.id}`} key={app.id} className="app-card">
                <div className="app-card-icon">{app.platform === 'android' ? '🤖' : '🍎'}</div>
                <div className="app-card-info">
                  <h3>{app.name}</h3>
                  <span className="badge">{app.platform}</span>
                  <p>{app._count?.releases || 0} releases</p>
                </div>
              </Link>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
