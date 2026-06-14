import { useState, useEffect, useRef } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import api from '../api/client';

export default function AppDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [app, setApp] = useState(null);
  const [releases, setReleases] = useState([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [showUpload, setShowUpload] = useState(false);
  const [uploadForm, setUploadForm] = useState({ targetVersion: '', description: '', type: 'bundle', isMandatory: false });
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
    formData.append('targetVersion', uploadForm.targetVersion);
    formData.append('description', uploadForm.description);
    formData.append('type', uploadForm.type);
    formData.append('isMandatory', uploadForm.isMandatory);

    try {
      await api.post(`/apps/${id}/releases`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      setShowUpload(false);
      setUploadForm({ targetVersion: '', description: '', type: 'bundle', isMandatory: false });
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

  const deleteApp = async () => {
    if (!confirm('Delete this app and all its releases?')) return;
    await api.delete(`/apps/${id}`);
    navigate('/');
  };

  const copyKey = () => {
    navigator.clipboard.writeText(app.deploymentKey);
  };

  if (loading) return <div className="page-loading">Loading...</div>;
  if (!app) return null;

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
            <button className="btn btn-danger" onClick={deleteApp}>Delete App</button>
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
        </div>

        {showUpload && (
          <div className="upload-card">
            <h3>Upload Release</h3>
            <form onSubmit={handleUpload}>
              <div className="form-row">
                <div className="form-group">
                  <label>File (bundle.zip or .apk)</label>
                  <input type="file" ref={fileRef} accept=".zip,.apk" required />
                </div>
                <div className="form-group">
                  <label>Target Version</label>
                  <input type="text" value={uploadForm.targetVersion} onChange={(e) => setUploadForm({...uploadForm, targetVersion: e.target.value})} placeholder="1.0.x" required />
                </div>
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label>Type</label>
                  <select value={uploadForm.type} onChange={(e) => setUploadForm({...uploadForm, type: e.target.value})}>
                    <option value="bundle">JS Bundle</option>
                    <option value="apk">APK</option>
                  </select>
                </div>
                <div className="form-group">
                  <label>Description</label>
                  <input type="text" value={uploadForm.description} onChange={(e) => setUploadForm({...uploadForm, description: e.target.value})} placeholder="What changed?" />
                </div>
              </div>
              <div className="form-group checkbox-group">
                <label>
                  <input type="checkbox" checked={uploadForm.isMandatory} onChange={(e) => setUploadForm({...uploadForm, isMandatory: e.target.checked})} />
                  Mandatory update
                </label>
              </div>
              <div className="form-actions">
                <button type="button" className="btn btn-outline" onClick={() => setShowUpload(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary" disabled={uploading}>
                  {uploading ? 'Uploading...' : 'Upload'}
                </button>
              </div>
            </form>
          </div>
        )}

        <h2>Releases</h2>
        {releases.length === 0 ? (
          <div className="empty-state">
            <p>No releases yet. Upload your first bundle or use the CLI.</p>
          </div>
        ) : (
          <table className="releases-table">
            <thead>
              <tr>
                <th>Version</th>
                <th>Type</th>
                <th>Target</th>
                <th>Size</th>
                <th>Downloads</th>
                <th>Mandatory</th>
                <th>Status</th>
                <th>Date</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {releases.map((r) => (
                <tr key={r.id} className={r.isDisabled ? 'disabled-row' : ''}>
                  <td><strong>v{r.version}</strong></td>
                  <td><span className={`badge badge-${r.type}`}>{r.type}</span></td>
                  <td>{r.targetVersion}</td>
                  <td>{(r.fileSize / 1024).toFixed(1)} KB</td>
                  <td>{r.downloadCount}</td>
                  <td>{r.isMandatory ? '✓' : '—'}</td>
                  <td>
                    <span className={`status ${r.isDisabled ? 'status-disabled' : 'status-active'}`}>
                      {r.isDisabled ? 'Disabled' : 'Active'}
                    </span>
                  </td>
                  <td>{new Date(r.createdAt).toLocaleDateString()}</td>
                  <td>
                    <button className="btn btn-sm btn-outline" onClick={() => toggleRelease(r.id)}>
                      {r.isDisabled ? 'Enable' : 'Disable'}
                    </button>
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
