import { useState, useEffect } from 'react';
import { NavLink, useNavigate, useParams, useLocation } from 'react-router-dom';
import api from '../api/client';

export default function Sidebar() {
  const navigate = useNavigate();
  const location = useLocation();
  const { id: activeAppId } = useParams();
  const [apps, setApps] = useState([]);
  const [expanded, setExpanded] = useState({});
  const [user, setUser] = useState(null);

  useEffect(() => {
    api.get('/apps').then((r) => {
      setApps(r.data);
      // Auto-expand active app
      if (activeAppId) setExpanded((e) => ({ ...e, [activeAppId]: true }));
    }).catch(() => {});

    const name = localStorage.getItem('fastpush_name');
    const email = localStorage.getItem('fastpush_email');
    if (name || email) setUser({ name, email });
  }, [activeAppId]);

  function toggleApp(id) {
    setExpanded((e) => ({ ...e, [id]: !e[id] }));
  }

  function logout() {
    localStorage.clear();
    navigate('/login');
  }

  const platformIcon = (p) => p === 'ios' ? '🍎' : '🤖';

  return (
    <nav className="sidebar">
      <div className="sidebar-brand">
        <span className="sidebar-logo">⚡</span>
        <span className="sidebar-title">FastPush</span>
      </div>

      <div className="sidebar-section-label">Apps</div>

      <div className="sidebar-apps">
        {apps.map((app) => (
          <div key={app.id} className="sidebar-app-group">
            <button
              className={`sidebar-app-name ${activeAppId === app.id ? 'active' : ''}`}
              onClick={() => { toggleApp(app.id); navigate(`/apps/${app.id}/deployments`); }}
            >
              <span>{platformIcon(app.platform)}</span>
              <span className="sidebar-app-label">{app.name}</span>
              <span className={`sidebar-chevron ${expanded[app.id] ? 'open' : ''}`}>›</span>
            </button>

            {expanded[app.id] && (
              <div className="sidebar-app-children">
                {(app.deployments || []).map((dep) => (
                  <NavLink
                    key={dep.id}
                    to={`/apps/${app.id}/deployments/${dep.id}`}
                    className={({ isActive }) => `sidebar-child ${isActive ? 'active' : ''}`}
                  >
                    {dep.name}
                  </NavLink>
                ))}
                <NavLink
                  to={`/apps/${app.id}/devices`}
                  className={({ isActive }) => `sidebar-child ${isActive ? 'active' : ''}`}
                >
                  Devices
                </NavLink>
                <NavLink
                  to={`/apps/${app.id}/team`}
                  className={({ isActive }) => `sidebar-child ${isActive ? 'active' : ''}`}
                >
                  Team
                </NavLink>
                <NavLink
                  to={`/apps/${app.id}/activity`}
                  className={({ isActive }) => `sidebar-child ${isActive ? 'active' : ''}`}
                >
                  Activity
                </NavLink>
              </div>
            )}
          </div>
        ))}
      </div>

      <NavLink to="/apps/create" className="sidebar-create-btn">
        + New App
      </NavLink>

      <div className="sidebar-divider" />

      <NavLink to="/docs" className={({ isActive }) => `sidebar-nav-link ${isActive ? 'active' : ''}`}>
        📖 Documentation
      </NavLink>

      <div className="sidebar-footer">
        <div className="sidebar-user">
          <div className="sidebar-avatar">{(user?.name || 'U')[0].toUpperCase()}</div>
          <div className="sidebar-user-info">
            <div className="sidebar-user-name">{user?.name || 'User'}</div>
            <div className="sidebar-user-email">{user?.email || ''}</div>
          </div>
        </div>
        <button className="sidebar-logout" onClick={logout}>Logout</button>
      </div>
    </nav>
  );
}
