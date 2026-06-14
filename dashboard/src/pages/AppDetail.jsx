import { useState, useEffect, useRef } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import api from '../api/client';

function RolloutSlider({ releaseId, appId, initial, onUpdate }) {
  const [value, setValue] = useState(initial);
  const [saving, setSaving] = useState(false);

  const save = async () => {
    setSaving(true);
    try {
      const { data } = await api.patch(`/apps/${appId}/releases/${releaseId}/rollout`, { rolloutPercent: value });
      onUpdate(data);
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to update rollout');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="rollout-control">
      <span className="rollout-label">{value}%</span>
      <input
        type="range" min={0} max={100} step={5}
        value={value}
        onChange={(e) => setValue(Number(e.target.value))}
        className="rollout-slider"
      />
      {value !== initial && (
        <button className="btn btn-sm btn-primary" onClick={save} disabled={saving}>
          {saving ? '...' : 'Save'}
        </button>
      )}
    </div>
  );
}

function AnalyticsBadges({ release }) {
  const total = release.downloadCount || 0;
  const installed = release.installCount || 0;
  const failed = release.failCount || 0;
  const rate = total > 0 ? Math.round((installed / total) * 100) : 0;

  return (
    <div className="analytics-badges">
      <span className="metric" title="Downloads">⬇ {total}</span>
      <span className="metric metric-success" title="Installed">✓ {installed}</span>
      {failed > 0 && <span className="metric metric-fail" title="Failed">✗ {failed}</span>}
      {total > 0 && <span className="metric metric-rate" title="Install rate">{rate}%</span>}
    </div>
  );
}

export default function AppDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [app, setApp] = useState(null);
  const [releases, setReleases] = useState([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [showUpload, setShowUpload] = useState(false);
  const [rollingBack, setRollingBack] = useState(false);
  const [uploadForm, setUploadForm] = useState({
    targetVersion: '', description: '', type: 'bundle',
    isMandatory: false, rolloutPercent: 100,
  });
  const fileRef = useRef();

  const load = async () => {
    try {
      const [appRes, relRes] = await Promise.all([
        api.get(`/apps/${id}`),
        api.get(`/apps/${id}/releases`),
      ]);
      setApp(appRes.data);
      setReleases(relRes.data);
    } catch {
      navigate('/');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [id]);

  const handleUpload = async (e) => {
    e.preventDefault();
    const file = fileRef.current?.files[0];
    if (!file) return;
    setUploading(true);
    const formData = new FormData();
    formData.append('file', file);
    Object.entries(uploadForm).forEach(([k, v]) => formData.append(k, v));
    try {
      await api.post(`/apps/${id}/releases`, formData, { headers: { 'Content-Type': 'multipart/form-data' } });
      setShowUpload(false);
      setUploadForm({ targetVersion: '', description: '', type: 'bundle', isMandatory: false, rolloutPercent: 100 });
      load();
    } catch (err) {
      alert(err.response?.data?.error || 'Upload failed');
    } finally {
      setUploading(false);
    }
  };

  const toggleRelease = async (releaseId) => {
    await api.patch(`/apps/${id}/releases/${releaseId}/toggle`);
    load();
  };

  const handleRollback = async () => {
    const activeReleases = releases.filter((r) => !r.isDisabled && !r.rolledBackAt);
    if (activeReleases.length < 2) {
      return alert('Need at least 2 active releases to rollback.');
    }
    if (!confirm(`Rollback from v${activeReleases[0].version} to v${activeReleases[1].version}?`)) return;
    setRollingBack(true);
    try {
      await api.post(`/apps/${id}/rollback`);
      load();
    } catch (err) {
      alert(err.response?.data?.error || 'Rollback failed');
    } finally {
      setRollingBack(false);
    }
  };

  const deleteApp = async () => {
    if (!confirm('Delete this app and all its releases?')) return;
    await api.delete(`/apps/${id}`);
    navigate('/');
  };

  const updateReleaseInList = (updated) => {
    setReleases((prev) => prev.map((r) => (r.id === updated.id ? updated : r)));
  };

  const copyKey = () => navigator.clipboard.writeText(app.deploymentKey);

  if (loading) return <div className="page-loading">Loading...</div>;
  if (!app) return null;

  const activeReleases = releases.filter((r) => !r.isDisabled && !r.rolledBackAt);
  const canRollback = activeReleases.length >= 2;

  return (
    <div className="page">
      <header className="top-bar">
        <div className="top-bar-left">
          <Link to="/" className="logo">⚡ FastPush</Link>
        </div>
      </header>

      <main className="container">
        <div className="page-header">
          <div>
            <Link to="/" className="back-link">← Back to Apps</Link>
            <h1>{app.platform === 'android' ? '🤖' : '🍎'} {app.name}</h1>
          </div>
          <div className="header-actions">
            <button className="btn btn-primary" onClick={() => setShowUpload(!showUpload)}>
              + New Release
            </button>
            <button
              className="btn btn-outline"
              onClick={handleRollback}
              disabled={!canRollback || rollingBack}
              title={!canRollback ? 'Need 2+ active releases to rollback' : ''}
            >
              {rollingBack ? 'Rolling back...' : '↩ Rollback'}
            </button>
            <button className="btn btn-danger" onClick={deleteApp}>Delete</button>
          </div>
        </div>

        <div className="info-card">
          <div className="info-row">
            <span className="info-label">Platform</span>
            <span className="badge">{app.platform}</span>
          </div>
          <div className="info-row">
            <span className="info-label">Deployment Key</span>
            <code className="deploy-key">{app.deploymentKey}</code>
            <button className="btn btn-sm btn-outline" onClick={copyKey}>Copy</button>
          </div>
          <div className="info-row">
            <span className="info-label">Total Releases</span>
            <span>{releases.length}</span>
          </div>
          <div className="info-row">
            <span className="info-label">Active Releases</span>
            <span>{activeReleases.length}</span>
          </div>
        </div>

        {showUpload && (
          <div className="upload-card">
            <h3>Upload New Release</h3>
            <form onSubmit={handleUpload}>
              <div className="form-row">
                <div className="form-group">
                  <label>File (bundle.zip or .apk)</label>
                  <input type="file" ref={fileRef} accept=".zip,.apk" required />
                </div>
                <div className="form-group">
                  <label>Target Version</label>
                  <input type="text" value={uploadForm.targetVersion}
                    onChange={(e) => setUploadForm({ ...uploadForm, targetVersion: e.target.value })}
                    placeholder="1.0.x" required />
                </div>
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label>Type</label>
                  <select value={uploadForm.type} onChange={(e) => setUploadForm({ ...uploadForm, type: e.target.value })}>
                    <option value="bundle">JS Bundle</option>
                    <option value="apk">APK</option>
                  </select>
                </div>
                <div className="form-group">
                  <label>Description</label>
                  <input type="text" value={uploadForm.description}
                    onChange={(e) => setUploadForm({ ...uploadForm, description: e.target.value })}
                    placeholder="What changed?" />
                </div>
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label>Rollout % (0–100)</label>
                  <div className="rollout-input-row">
                    <input type="range" min={0} max={100} step={5}
                      value={uploadForm.rolloutPercent}
                      onChange={(e) => setUploadForm({ ...uploadForm, rolloutPercent: Number(e.target.value) })}
                      className="rollout-slider" />
                    <span className="rollout-label">{uploadForm.rolloutPercent}%</span>
                  </div>
                </div>
                <div className="form-group checkbox-group" style={{ paddingTop: 28 }}>
                  <label>
                    <input type="checkbox" checked={uploadForm.isMandatory}
                      onChange={(e) => setUploadForm({ ...uploadForm, isMandatory: e.target.checked })} />
                    Mandatory update
                  </label>
                </div>
              </div>
              <div className="form-actions">
                <button type="button" className="btn btn-outline" onClick={() => setShowUpload(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary" disabled={uploading}>
                  {uploading ? 'Uploading...' : 'Upload Release'}
                </button>
              </div>
            </form>
          </div>
        )}

        <h2 style={{ marginBottom: 12 }}>Releases</h2>
        {releases.length === 0 ? (
          <div className="empty-state">
            <p>No releases yet. Upload your first bundle or use the CLI.</p>
            <code style={{ marginTop: 12, display: 'block', fontSize: 13 }}>
              fastpush release --app {app.name} --target-version "1.0.x"
            </code>
          </div>
        ) : (
          <table className="releases-table">
            <thead>
              <tr>
                <th>Version</th>
                <th>Type</th>
                <th>Target</th>
                <th>Analytics</th>
                <th>Rollout</th>
                <th>Mandatory</th>
                <th>Status</th>
                <th>Date</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {releases.map((r) => (
                <tr key={r.id} className={r.isDisabled || r.rolledBackAt ? 'disabled-row' : ''}>
                  <td><strong>v{r.version}</strong></td>
                  <td><span className={`badge badge-${r.type}`}>{r.type}</span></td>
                  <td>{r.targetVersion}</td>
                  <td><AnalyticsBadges release={r} /></td>
                  <td>
                    {!r.isDisabled && !r.rolledBackAt ? (
                      <RolloutSlider
                        releaseId={r.id}
                        appId={id}
                        initial={r.rolloutPercent}
                        onUpdate={updateReleaseInList}
                      />
                    ) : (
                      <span className="rollout-label">{r.rolloutPercent}%</span>
                    )}
                  </td>
                  <td>{r.isMandatory ? '✓' : '—'}</td>
                  <td>
                    {r.rolledBackAt ? (
                      <span className="status status-rolled">Rolled back</span>
                    ) : (
                      <span className={`status ${r.isDisabled ? 'status-disabled' : 'status-active'}`}>
                        {r.isDisabled ? 'Disabled' : 'Active'}
                      </span>
                    )}
                  </td>
                  <td>{new Date(r.createdAt).toLocaleDateString()}</td>
                  <td>
                    {!r.rolledBackAt && (
                      <button className="btn btn-sm btn-outline" onClick={() => toggleRelease(r.id)}>
                        {r.isDisabled ? 'Enable' : 'Disable'}
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </main>
    </div>
  );
}
