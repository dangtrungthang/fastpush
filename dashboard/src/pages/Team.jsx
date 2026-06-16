import { useState, useEffect, useCallback } from 'react';
import { useParams, Link } from 'react-router-dom';
import api from '../api/client';

const ROLE_LABELS = { owner: 'Owner', collaborator: 'Collaborator', viewer: 'Viewer' };
const ROLE_COLORS = { owner: 'badge-primary', collaborator: 'badge-success', viewer: 'badge-info' };

export default function Team() {
  const { id: appId } = useParams();
  const [members, setMembers] = useState([]);
  const [invites, setInvites] = useState([]);
  const [myRole, setMyRole] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [form, setForm] = useState({ email: '', role: 'collaborator' });
  const [submitting, setSubmitting] = useState(false);
  const [inviteResult, setInviteResult] = useState(null);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const [membersRes, appRes] = await Promise.all([
        api.get(`/apps/${appId}/members`),
        api.get(`/apps/${appId}`),
      ]);
      setMembers(membersRes.data.members);
      setInvites(membersRes.data.invites);
      setMyRole(appRes.data.role);
    } catch (e) {
      setError(e.response?.data?.error || 'Failed to load');
    } finally {
      setLoading(false);
    }
  }, [appId]);

  useEffect(() => { load(); }, [load]);

  async function sendInvite(e) {
    e.preventDefault();
    setSubmitting(true);
    setError('');
    setInviteResult(null);
    try {
      const res = await api.post(`/apps/${appId}/members/invite`, form);
      setInviteResult(res.data);
      setForm({ email: '', role: 'collaborator' });
      load();
    } catch (e) {
      setError(e.response?.data?.error || 'Failed to send invite');
    } finally {
      setSubmitting(false);
    }
  }

  async function changeRole(userId, role) {
    await api.patch(`/apps/${appId}/members/${userId}`, { role });
    load();
  }

  async function removeMember(userId, name) {
    if (!confirm(`Remove ${name} from the team?`)) return;
    await api.delete(`/apps/${appId}/members/${userId}`);
    load();
  }

  async function cancelInvite(id) {
    await api.delete(`/apps/${appId}/members/invites/${id}`);
    load();
  }

  if (loading) return <div className="page-loading">Loading...</div>;

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <div className="page-breadcrumb"><Link to={`/apps/${appId}/deployments`}>Overview</Link> / Team</div>
          <h1 className="page-title">Team</h1>
        </div>
      </div>

      {error && <div className="alert alert-error">{error}</div>}

      {/* Invite form — owner only */}
      {myRole === 'owner' && (
        <div className="card mb-4">
          <div className="card-header">Invite member</div>
          <div className="card-body">
            <form className="invite-form" onSubmit={sendInvite}>
              <input
                type="email"
                placeholder="Email address"
                value={form.email}
                onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                required
                className="form-input"
              />
              <select
                value={form.role}
                onChange={(e) => setForm((f) => ({ ...f, role: e.target.value }))}
                className="form-select"
              >
                <option value="collaborator">Collaborator</option>
                <option value="viewer">Viewer</option>
              </select>
              <button type="submit" className="btn btn-primary" disabled={submitting}>
                {submitting ? 'Sending…' : 'Send Invite'}
              </button>
            </form>

            {inviteResult && (
              <div className="invite-result">
                <div className="invite-result-label">Invite link (share this):</div>
                <div className="invite-link-row">
                  <code className="invite-link">{window.location.origin}{inviteResult.inviteLink}</code>
                  <button className="btn-copy" onClick={() => navigator.clipboard.writeText(`${window.location.origin}${inviteResult.inviteLink}`)}>Copy</button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Members list */}
      <div className="card mb-4">
        <div className="card-header">Members ({members.length})</div>
        <div className="card-body p-0">
          <table className="members-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Email</th>
                <th>Role</th>
                {myRole === 'owner' && <th>Actions</th>}
              </tr>
            </thead>
            <tbody>
              {members.map((m) => (
                <tr key={m.id}>
                  <td>
                    <div className="member-name-cell">
                      <div className="member-avatar">{(m.user.name || 'U')[0].toUpperCase()}</div>
                      <span>{m.user.name}</span>
                    </div>
                  </td>
                  <td>{m.user.email}</td>
                  <td>
                    {myRole === 'owner' && m.role !== 'owner' ? (
                      <select
                        value={m.role}
                        onChange={(e) => changeRole(m.user.id, e.target.value)}
                        className="role-select"
                      >
                        <option value="collaborator">Collaborator</option>
                        <option value="viewer">Viewer</option>
                      </select>
                    ) : (
                      <span className={`badge ${ROLE_COLORS[m.role]}`}>{ROLE_LABELS[m.role]}</span>
                    )}
                  </td>
                  {myRole === 'owner' && (
                    <td>
                      {m.role !== 'owner' && (
                        <button className="btn-xs btn-danger" onClick={() => removeMember(m.user.id, m.user.name)}>
                          Remove
                        </button>
                      )}
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Pending invites */}
      {invites.length > 0 && (
        <div className="card">
          <div className="card-header">Pending Invites ({invites.length})</div>
          <div className="card-body p-0">
            <table className="members-table">
              <thead>
                <tr>
                  <th>Email</th>
                  <th>Role</th>
                  <th>Invited</th>
                  {myRole === 'owner' && <th>Actions</th>}
                </tr>
              </thead>
              <tbody>
                {invites.map((inv) => (
                  <tr key={inv.id}>
                    <td>{inv.email}</td>
                    <td><span className={`badge ${ROLE_COLORS[inv.role]}`}>{ROLE_LABELS[inv.role]}</span></td>
                    <td className="muted-text">{new Date(inv.createdAt).toLocaleDateString()}</td>
                    {myRole === 'owner' && (
                      <td>
                        <button className="btn-xs btn-danger" onClick={() => cancelInvite(inv.id)}>Cancel</button>
                      </td>
                    )}
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
