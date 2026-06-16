import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import api from '../api/client';

function StatusBadge({ release }) {
  if (!release) return null;
  if (release.rolledBackAt) return <span className="badge badge-error">Rolled Back</span>;
  if (release.isDisabled) return <span className="badge badge-warning">Disabled</span>;
  if (release.rolloutPercent < 100) return <span className="badge badge-info">{release.rolloutPercent}% Rollout</span>;
  return <span className="badge badge-success">Active</span>;
}

export default function DeploymentDetail() {
  const { id: appId, depId } = useParams();
  const navigate = useNavigate();
  const [deployment, setDeployment] = useState(null);
  const [releases, setReleases] = useState([]);
  const [devices, setDevices] = useState([]);
  const [groups, setGroups] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [rolloutEdit, setRolloutEdit] = useState({});
  const [targetEdit, setTargetEdit] = useState(null); // { release, targetMode, targetDeviceIds, targetGroupId }
  const [savingTarget, setSavingTarget] = useState(false);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const [depRes, relRes, devRes, grpRes] = await Promise.all([
        api.get(`/apps/${appId}/deployments`),
        api.get(`/apps/${appId}/releases/${depId}`),
        api.get(`/apps/${appId}/devices`),
        api.get(`/apps/${appId}/device-groups`),
      ]);
      const dep = depRes.data.find((d) => d.id === depId);
      setDeployment(dep);
      setReleases(relRes.data);
      setDevices(devRes.data);
      setGroups(grpRes.data);
    } catch (e) {
      setError(e.response?.data?.error || 'Failed to load');
    } finally {
      setLoading(false);
    }
  }, [appId, depId]);

  useEffect(() => { load(); }, [load]);

  async function toggleRelease(releaseId, isDisabled) {
    await api.patch(`/apps/${appId}/releases/${releaseId}/toggle`);
    load();
  }

  async function rollback(releaseId) {
    if (!confirm('Roll back this release?')) return;
    await api.post(`/apps/${appId}/releases/${releaseId}/rollback`);
    load();
  }

  async function updateRollout(releaseId) {
    const pct = parseInt(rolloutEdit[releaseId]);
    if (isNaN(pct) || pct < 0 || pct > 100) return;
    await api.patch(`/apps/${appId}/releases/${releaseId}/rollout`, { rolloutPercent: pct });
    setRolloutEdit((r) => ({ ...r, [releaseId]: undefined }));
    load();
  }

  function openTargetEdit(release) {
    setTargetEdit({
      release,
      targetMode: release.targetMode || 'all',
      targetDeviceIds: release.targetDeviceIds || [],
      targetGroupId: release.targetGroupId || '',
    });
  }

  // Number of devices the current selection resolves to
  function selectedCount(t) {
    if (!t) return 0;
    if (t.targetMode === 'all') return devices.length;
    if (t.targetMode === 'devices') return t.targetDeviceIds.length;
    if (t.targetMode === 'group') return devices.filter((d) => d.deviceGroup?.id === t.targetGroupId).length;
    return 0;
  }

  function toggleTargetDevice(serialNumber) {
    setTargetEdit((t) => {
      const has = t.targetDeviceIds.includes(serialNumber);
      return {
        ...t,
        targetDeviceIds: has
          ? t.targetDeviceIds.filter((id) => id !== serialNumber)
          : [...t.targetDeviceIds, serialNumber],
      };
    });
  }

  async function saveTarget() {
    if (targetEdit.targetMode === 'group' && !targetEdit.targetGroupId) {
      setError('Please select a device group');
      return;
    }
    setSavingTarget(true);
    try {
      await api.patch(`/apps/${appId}/releases/${targetEdit.release.id}/target`, {
        targetMode: targetEdit.targetMode,
        targetDeviceIds: targetEdit.targetDeviceIds,
        targetGroupId: targetEdit.targetGroupId || null,
      });
      setTargetEdit(null);
      load();
    } catch (e) {
      setError(e.response?.data?.error || 'Failed to update target');
    } finally {
      setSavingTarget(false);
    }
  }

  if (loading) return <div className="page-loading">Loading...</div>;
  if (error) return <div className="page-error">{error}</div>;

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <div className="page-breadcrumb">
            <Link to={`/apps/${appId}/deployments`}>Deployments</Link> / {deployment?.name}
          </div>
          <h1 className="page-title">{deployment?.name}</h1>
          <div className="deployment-key-row">
            <span className="label">Deployment Key:</span>
            <code className="dep-key">{deployment?.deploymentKey}</code>
            <button className="btn-copy" onClick={() => navigator.clipboard.writeText(deployment?.deploymentKey)}>Copy</button>
          </div>
        </div>
      </div>

      {releases.length === 0 ? (
        <div className="empty-state">
          <div className="empty-icon">📦</div>
          <div className="empty-title">No releases yet</div>
          <div className="empty-desc">Use the FastPush CLI to push your first release to this deployment.</div>
          <code className="empty-cmd">fastpush release --app {appId} --deployment {deployment?.name} --target-version "1.0.x"</code>
        </div>
      ) : (
        <div className="releases-table-wrap">
          <table className="releases-table">
            <thead>
              <tr>
                <th>Version</th>
                <th>Status</th>
                <th>Type</th>
                <th>Target</th>
                <th>Description</th>
                <th>Rollout</th>
                <th>Devices</th>
                <th>Downloads</th>
                <th>Installs</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {releases.map((r) => (
                <tr key={r.id} className={r.rolledBackAt ? 'row-muted' : ''}>
                  <td><span className="version-badge">v{r.version}</span></td>
                  <td><StatusBadge release={r} /></td>
                  <td><span className={`type-badge type-${r.type}`}>{r.type.toUpperCase()}</span></td>
                  <td>{r.targetVersion}</td>
                  <td className="desc-cell">{r.description || '—'}</td>
                  <td>
                    {!r.rolledBackAt && !r.isDisabled ? (
                      <div className="rollout-inline">
                        <input
                          type="number"
                          min="0"
                          max="100"
                          value={rolloutEdit[r.id] ?? r.rolloutPercent}
                          onChange={(e) => setRolloutEdit((x) => ({ ...x, [r.id]: e.target.value }))}
                          className="rollout-input"
                        />
                        <span>%</span>
                        {rolloutEdit[r.id] !== undefined && rolloutEdit[r.id] !== String(r.rolloutPercent) && (
                          <button className="btn-xs btn-primary" onClick={() => updateRollout(r.id)}>Set</button>
                        )}
                      </div>
                    ) : (
                      <span>{r.rolloutPercent}%</span>
                    )}
                  </td>
                  <td>
                    <div className="rollout-inline">
                      {r.targetMode === 'devices' ? (
                        <span className="badge badge-info">{r.targetDeviceIds.length} device{r.targetDeviceIds.length === 1 ? '' : 's'}</span>
                      ) : r.targetMode === 'group' ? (
                        <span className="badge badge-info">
                          {groups.find((g) => g.id === r.targetGroupId)?.name || 'Group'}
                          {' '}({devices.filter((d) => d.deviceGroup?.id === r.targetGroupId).length})
                        </span>
                      ) : (
                        <span className="badge badge-success">All devices</span>
                      )}
                      {!r.rolledBackAt && (
                        <button className="btn-xs btn-secondary" onClick={() => openTargetEdit(r)}>Edit</button>
                      )}
                    </div>
                  </td>
                  <td>{r.downloadCount}</td>
                  <td>{r.installCount}</td>
                  <td>
                    {!r.rolledBackAt && (
                      <div className="action-btns">
                        <button
                          className={`btn-xs ${r.isDisabled ? 'btn-success' : 'btn-warning'}`}
                          onClick={() => toggleRelease(r.id, r.isDisabled)}
                        >
                          {r.isDisabled ? 'Enable' : 'Disable'}
                        </button>
                        <button className="btn-xs btn-danger" onClick={() => rollback(r.id)}>Rollback</button>
                      </div>
                    )}
                    {r.rolledBackAt && <span className="muted-text">—</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {targetEdit && (
        <div className="modal-overlay" onClick={() => setTargetEdit(null)}>
          <div className="modal-card" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <span className="modal-icon">🎯</span>
              <h3 className="modal-title">Target devices — v{targetEdit.release.version}</h3>
              <span className="badge badge-info target-count">
                {selectedCount(targetEdit)} device{selectedCount(targetEdit) === 1 ? '' : 's'} selected
              </span>
            </div>

            <div className="form-group">
              <label>
                <input
                  type="radio"
                  checked={targetEdit.targetMode === 'all'}
                  onChange={() => setTargetEdit((t) => ({ ...t, targetMode: 'all' }))}
                />
                {' '}All devices
              </label>
            </div>
            <div className="form-group">
              <label>
                <input
                  type="radio"
                  checked={targetEdit.targetMode === 'group'}
                  onChange={() => setTargetEdit((t) => ({ ...t, targetMode: 'group' }))}
                />
                {' '}Device group
              </label>
            </div>
            <div className="form-group">
              <label>
                <input
                  type="radio"
                  checked={targetEdit.targetMode === 'devices'}
                  onChange={() => setTargetEdit((t) => ({ ...t, targetMode: 'devices' }))}
                />
                {' '}Specific devices
              </label>
            </div>

            {targetEdit.targetMode === 'group' && (
              <div className="form-group">
                {groups.length === 0 ? (
                  <p className="muted-text">No device groups yet. Create one in the Devices page.</p>
                ) : (
                  <select
                    className="form-input"
                    value={targetEdit.targetGroupId}
                    onChange={(e) => setTargetEdit((t) => ({ ...t, targetGroupId: e.target.value }))}
                  >
                    <option value="">— Select a group —</option>
                    {groups.map((g) => (
                      <option key={g.id} value={g.id}>
                        {g.name} ({devices.filter((d) => d.deviceGroup?.id === g.id).length} devices)
                      </option>
                    ))}
                  </select>
                )}
              </div>
            )}

            {targetEdit.targetMode === 'devices' && (
              <div className="device-checklist">
                {devices.length === 0 && <p className="muted-text">No devices registered yet.</p>}
                {devices.map((d) => (
                  <label key={d.id} className="device-checklist-item">
                    <input
                      type="checkbox"
                      checked={targetEdit.targetDeviceIds.includes(d.serialNumber)}
                      onChange={() => toggleTargetDevice(d.serialNumber)}
                    />
                    {' '}<code>{d.serialNumber}</code>
                    {d.deviceGroup && <span className="badge badge-info">{d.deviceGroup.name}</span>}
                  </label>
                ))}
              </div>
            )}

            <div className="modal-actions">
              <button className="btn btn-secondary" onClick={() => setTargetEdit(null)}>Cancel</button>
              <button className="btn btn-primary" disabled={savingTarget} onClick={saveTarget}>
                {savingTarget ? 'Saving…' : 'Save'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
