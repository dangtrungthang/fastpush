import { useState, useEffect, useCallback } from 'react';
import { useParams, Link } from 'react-router-dom';
import api from '../api/client';

export default function Devices() {
  const { id: appId } = useParams();
  const [devices, setDevices] = useState([]);
  const [groups, setGroups] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [filterGroup, setFilterGroup] = useState('all');

  const [showCreateGroup, setShowCreateGroup] = useState(false);
  const [newGroupName, setNewGroupName] = useState('');
  const [creatingGroup, setCreatingGroup] = useState(false);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const [devicesRes, groupsRes] = await Promise.all([
        api.get(`/apps/${appId}/devices`),
        api.get(`/apps/${appId}/device-groups`),
      ]);
      setDevices(devicesRes.data);
      setGroups(groupsRes.data);
    } catch (e) {
      setError(e.response?.data?.error || 'Failed to load');
    } finally {
      setLoading(false);
    }
  }, [appId]);

  useEffect(() => { load(); }, [load]);

  async function createGroup(e) {
    e.preventDefault();
    setCreatingGroup(true);
    try {
      await api.post(`/apps/${appId}/device-groups`, { name: newGroupName });
      setNewGroupName('');
      setShowCreateGroup(false);
      load();
    } catch (e) {
      setError(e.response?.data?.error || 'Failed to create group');
    } finally {
      setCreatingGroup(false);
    }
  }

  async function renameGroup(group) {
    const name = prompt('Rename group', group.name);
    if (!name || name === group.name) return;
    await api.patch(`/apps/${appId}/device-groups/${group.id}`, { name });
    load();
  }

  async function deleteGroup(group) {
    if (!confirm(`Delete group "${group.name}"? Devices in this group will become ungrouped.`)) return;
    await api.delete(`/apps/${appId}/device-groups/${group.id}`);
    if (filterGroup === group.id) setFilterGroup('all');
    load();
  }

  async function assignGroup(deviceId, deviceGroupId) {
    await api.patch(`/apps/${appId}/devices/${deviceId}`, { deviceGroupId: deviceGroupId || null });
    load();
  }

  async function deleteDevice(device) {
    if (!confirm(`Remove device "${device.serialNumber}" from the registry?`)) return;
    await api.delete(`/apps/${appId}/devices/${device.id}`);
    load();
  }

  if (loading) return <div className="page-loading">Loading...</div>;

  const filteredDevices = devices.filter((d) => {
    if (filterGroup === 'all') return true;
    if (filterGroup === 'ungrouped') return !d.deviceGroupId;
    return d.deviceGroupId === filterGroup;
  });

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <div className="page-breadcrumb"><Link to={`/apps/${appId}/deployments`}>Overview</Link> / Devices</div>
          <h1 className="page-title">Devices</h1>
          <div className="page-subtitle">{devices.length} registered devices</div>
        </div>
        <button className="btn btn-primary" onClick={() => setShowCreateGroup((s) => !s)}>+ Group</button>
      </div>

      {error && <div className="alert alert-error">{error}</div>}

      {showCreateGroup && (
        <div className="card mb-4">
          <div className="card-header">New Device Group</div>
          <div className="card-body">
            <form className="inline-form" onSubmit={createGroup}>
              <input
                type="text"
                placeholder="e.g. Beta Testers"
                value={newGroupName}
                onChange={(e) => setNewGroupName(e.target.value)}
                className="form-input"
                required
                autoFocus
              />
              <button type="submit" className="btn btn-primary" disabled={creatingGroup}>
                {creatingGroup ? 'Creating…' : 'Create'}
              </button>
              <button type="button" className="btn btn-secondary" onClick={() => setShowCreateGroup(false)}>Cancel</button>
            </form>
          </div>
        </div>
      )}

      {groups.length > 0 && (
        <div className="card mb-4">
          <div className="card-header">Groups ({groups.length})</div>
          <div className="card-body p-0">
            <table className="members-table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Devices</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {groups.map((g) => (
                  <tr key={g.id}>
                    <td>{g.name}</td>
                    <td>{g._count?.devices || 0}</td>
                    <td>
                      <div className="action-btns">
                        <button className="btn-xs btn-secondary" onClick={() => renameGroup(g)}>Rename</button>
                        <button className="btn-xs btn-danger" onClick={() => deleteGroup(g)}>Delete</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {devices.length === 0 ? (
        <div className="empty-state">
          <div className="empty-icon">📱</div>
          <div className="empty-title">No devices yet</div>
          <div className="empty-desc">Devices register automatically the first time they call FastPush.checkForUpdate().</div>
        </div>
      ) : (
        <div className="card">
          <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span>Devices ({filteredDevices.length})</span>
            <select
              value={filterGroup}
              onChange={(e) => setFilterGroup(e.target.value)}
              className="form-select"
              style={{ width: 'auto' }}
            >
              <option value="all">All groups</option>
              <option value="ungrouped">Ungrouped</option>
              {groups.map((g) => (
                <option key={g.id} value={g.id}>{g.name}</option>
              ))}
            </select>
          </div>
          <div className="card-body p-0">
            <table className="members-table">
              <thead>
                <tr>
                  <th>Device ID</th>
                  <th>Native Version</th>
                  <th>OTA Version</th>
                  <th>Group</th>
                  <th>Last Seen</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredDevices.map((d) => (
                  <tr key={d.id}>
                    <td><code>{d.serialNumber}</code></td>
                    <td>{d.nativeAppVersion || '—'}</td>
                    <td>{d.otaVersion != null ? `v${d.otaVersion}` : '—'}</td>
                    <td>
                      <select
                        value={d.deviceGroupId || ''}
                        onChange={(e) => assignGroup(d.id, e.target.value)}
                        className="role-select"
                      >
                        <option value="">Ungrouped</option>
                        {groups.map((g) => (
                          <option key={g.id} value={g.id}>{g.name}</option>
                        ))}
                      </select>
                    </td>
                    <td className="muted-text">{new Date(d.lastSeenAt).toLocaleString()}</td>
                    <td>
                      <button className="btn-xs btn-danger" onClick={() => deleteDevice(d)}>Remove</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
