import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import api from '../api/client';

const PLATFORM_ICON = { android: '🤖', ios: '🍎' };
const ROLE_COLORS = { owner: 'badge-primary', collaborator: 'badge-success', viewer: 'badge-info' };

export default function Apps() {
  const [apps, setApps] = useState([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    api.get('/apps').then((r) => setApps(r.data)).finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="page-loading">Loading…</div>;

  return (
    <div className="page">
      <div className="page-header">
        <h1 className="page-title">Apps</h1>
        <Link to="/apps/create" className="btn btn-primary">+ New App</Link>
      </div>

      {apps.length === 0 ? (
        <div className="empty-state">
          <div className="empty-icon">🚀</div>
          <div className="empty-title">No apps yet</div>
          <div className="empty-desc">Create your first app to start pushing OTA updates.</div>
          <Link to="/apps/create" className="btn btn-primary">Create App</Link>
        </div>
      ) : (
        <div className="app-grid">
          {apps.map((app) => {
            const prodDep = app.deployments?.find((d) => d.name === 'Production');
            const stagingDep = app.deployments?.find((d) => d.name === 'Staging');
            return (
              <div key={app.id} className="app-card" onClick={() => navigate(`/apps/${app.id}/deployments`)}>
                <div className="app-card-header">
                  <div className="app-card-icon">{PLATFORM_ICON[app.platform] || '📱'}</div>
                  <div className="app-card-info">
                    <div className="app-card-name">{app.name}</div>
                    <div className="app-card-platform">{app.platform}</div>
                  </div>
                  <span className={`badge ${ROLE_COLORS[app.role]}`}>{app.role}</span>
                </div>
                <div className="app-card-stats">
                  {prodDep && (
                    <div className="app-card-stat">
                      <span className="stat-label">Production</span>
                      <span className="stat-value">{prodDep._count?.releases || 0} releases</span>
                    </div>
                  )}
                  {stagingDep && (
                    <div className="app-card-stat">
                      <span className="stat-label">Staging</span>
                      <span className="stat-value">{stagingDep._count?.releases || 0} releases</span>
                    </div>
                  )}
                  <div className="app-card-stat">
                    <span className="stat-label">Members</span>
                    <span className="stat-value">{app._count?.members || 1}</span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
