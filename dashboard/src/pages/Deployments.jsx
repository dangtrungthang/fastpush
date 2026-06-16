import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import api from '../api/client';

export default function Deployments() {
  const { id: appId } = useParams();
  const navigate = useNavigate();
  const [app, setApp] = useState(null);
  const [deployments, setDeployments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [newDepName, setNewDepName] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [error, setError] = useState('');

  // Rename state
  const [editingName, setEditingName] = useState(false);
  const [newAppName, setNewAppName] = useState('');
  const [renaming, setRenaming] = useState(false);

  // Delete state
  const [deleting, setDeleting] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleteInput, setDeleteInput] = useState('');

  const load = useCallback(async () => {
    try {
      const [appRes, depRes] = await Promise.all([
        api.get(`/apps/${appId}`),
        api.get(`/apps/${appId}/deployments`),
      ]);
      setApp(appRes.data);
      setNewAppName(appRes.data.name);
      setDeployments(depRes.data);
    } catch (e) {
      setError(e.response?.data?.error || 'Failed to load');
    } finally {
      setLoading(false);
    }
  }, [appId]);

  useEffect(() => { load(); }, [load]);

  async function createDeployment(e) {
    e.preventDefault();
    setCreating(true);
    try {
      await api.post(`/apps/${appId}/deployments`, { name: newDepName });
      setNewDepName('');
      setShowCreate(false);
      load();
    } catch (e) {
      setError(e.response?.data?.error || 'Failed to create deployment');
    } finally {
      setCreating(false);
    }
  }

  async function renameApp(e) {
    e.preventDefault();
    if (!newAppName.trim() || newAppName.trim() === app.name) { setEditingName(false); return; }
    setRenaming(true);
    setError('');
    try {
      await api.patch(`/apps/${appId}`, { name: newAppName.trim() });
      setEditingName(false);
      load();
    } catch (e) {
      setError(e.response?.data?.error || 'Failed to rename app');
    } finally {
      setRenaming(false);
    }
  }

  async function deleteApp() {
    if (deleteInput !== app.name) return;
    setDeleting(true);
    try {
      await api.delete(`/apps/${appId}`);
      navigate('/');
    } catch (e) {
      setError(e.response?.data?.error || 'Failed to delete app');
      setDeleting(false);
      setShowDeleteConfirm(false);
    }
  }

  if (loading) return <div className="page-loading">Loading…</div>;

  const isOwner = app?.role === 'owner';

  return (
    <div className="page">
      <div className="page-header">
        <div style={{ flex: 1 }}>
          {/* Editable app name */}
          {editingName ? (
            <form className="inline-form" onSubmit={renameApp} style={{ marginBottom: 4 }}>
              <input
                className="form-input page-title-input"
                value={newAppName}
                onChange={(e) => setNewAppName(e.target.value)}
                autoFocus
                required
              />
              <button type="submit" className="btn btn-primary btn-sm" disabled={renaming}>
                {renaming ? 'Saving…' : 'Save'}
              </button>
              <button type="button" className="btn btn-secondary btn-sm" onClick={() => { setEditingName(false); setNewAppName(app.name); }}>
                Cancel
              </button>
            </form>
          ) : (
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <h1 className="page-title">{app?.name}</h1>
              {isOwner && (
                <button className="btn-icon" title="Rename app" onClick={() => setEditingName(true)}>✏️</button>
              )}
            </div>
          )}
          <div className="page-subtitle">{app?.platform} app · {deployments.length} deployments</div>
        </div>

        <div style={{ display: 'flex', gap: 8 }}>
          {(isOwner || app?.role === 'collaborator') && (
            <button className="btn btn-primary" onClick={() => setShowCreate((s) => !s)}>
              + Deployment
            </button>
          )}
          {isOwner && (
            <button className="btn btn-danger" onClick={() => { setShowDeleteConfirm(true); setDeleteInput(''); }}>
              Delete App
            </button>
          )}
        </div>
      </div>

      {error && <div className="alert alert-error">{error}</div>}

      {/* New deployment form */}
      {showCreate && (
        <div className="card mb-4">
          <div className="card-header">New Deployment</div>
          <div className="card-body">
            <form className="inline-form" onSubmit={createDeployment}>
              <input
                type="text"
                placeholder="e.g. Development"
                value={newDepName}
                onChange={(e) => setNewDepName(e.target.value)}
                className="form-input"
                required
                autoFocus
              />
              <button type="submit" className="btn btn-primary" disabled={creating}>
                {creating ? 'Creating…' : 'Create'}
              </button>
              <button type="button" className="btn btn-secondary" onClick={() => setShowCreate(false)}>Cancel</button>
            </form>
          </div>
        </div>
      )}

      {/* Delete confirmation modal */}
      {showDeleteConfirm && (
        <div className="modal-overlay" onClick={() => setShowDeleteConfirm(false)}>
          <div className="modal-card" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <span className="modal-icon">🗑️</span>
              <h3 className="modal-title">Delete "{app?.name}"?</h3>
            </div>
            <p className="modal-desc">
              This will permanently delete the app, all deployments, all releases, and all activity logs.
              <strong> This action cannot be undone.</strong>
            </p>
            <div className="modal-confirm-label">
              Type <strong>{app?.name}</strong> to confirm:
            </div>
            <input
              className="form-input"
              placeholder={app?.name}
              value={deleteInput}
              onChange={(e) => setDeleteInput(e.target.value)}
              autoFocus
            />
            <div className="modal-actions">
              <button className="btn btn-secondary" onClick={() => setShowDeleteConfirm(false)}>Cancel</button>
              <button
                className="btn btn-danger"
                disabled={deleteInput !== app?.name || deleting}
                onClick={deleteApp}
              >
                {deleting ? 'Deleting…' : 'Delete App'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Deployments grid */}
      <div className="deployments-grid">
        {deployments.map((dep) => {
          const latest = dep.releases?.[0];
          return (
            <div key={dep.id} className="deployment-card" onClick={() => navigate(`/apps/${appId}/deployments/${dep.id}`)}>
              <div className="deployment-card-header">
                <div className="deployment-name">{dep.name}</div>
                {dep.name === 'Production' && <span className="badge badge-primary">Default</span>}
                {dep.name === 'Staging' && <span className="badge badge-warning">Staging</span>}
              </div>

              <div className="deployment-stats">
                <div className="deployment-stat">
                  <span className="stat-num">{dep._count?.releases || 0}</span>
                  <span className="stat-label">releases</span>
                </div>
                {latest && (
                  <div className="deployment-stat">
                    <span className="stat-num">v{latest.version}</span>
                    <span className="stat-label">latest</span>
                  </div>
                )}
                {latest && (
                  <div className="deployment-stat">
                    <span className="stat-num">{latest.rolloutPercent}%</span>
                    <span className="stat-label">rollout</span>
                  </div>
                )}
              </div>

              <div className="deployment-key-preview">
                <span className="label">Key:</span>
                <code>{dep.deploymentKey?.slice(0, 12)}…</code>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
