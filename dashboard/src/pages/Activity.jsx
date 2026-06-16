import { useState, useEffect, useCallback } from 'react';
import { useParams, Link } from 'react-router-dom';
import api from '../api/client';

const ACTION_ICONS = {
  'app.create': '🚀',
  'release.create': '📦',
  'release.rollback': '⏪',
  'release.disable': '🔴',
  'release.enable': '🟢',
  'release.rollout_change': '📊',
  'member.invite': '✉️',
  'member.remove': '👋',
  'member.role_change': '🔑',
  'deployment.create': '🏗️',
  'deployment.delete': '🗑️',
};

const ACTION_LABELS = {
  'app.create': 'Created app',
  'release.create': 'Published release',
  'release.rollback': 'Rolled back',
  'release.disable': 'Disabled release',
  'release.enable': 'Enabled release',
  'release.rollout_change': 'Changed rollout',
  'member.invite': 'Invited member',
  'member.remove': 'Removed member',
  'member.role_change': 'Changed role',
  'deployment.create': 'Created deployment',
  'deployment.delete': 'Deleted deployment',
};

function metaText(action, meta) {
  if (!meta) return '';
  if (action === 'release.create') return `v${meta.version} → ${meta.targetVersion} (${meta.type})`;
  if (action === 'release.rollback') return `v${meta.fromVersion} → v${meta.toVersion || 'none'}`;
  if (action === 'release.rollout_change') return `v${meta.version} → ${meta.rolloutPercent}%`;
  if (action === 'release.disable' || action === 'release.enable') return `v${meta.version}`;
  if (action === 'member.invite') return `${meta.email} as ${meta.role}`;
  if (action === 'member.remove') return meta.email;
  if (action === 'member.role_change') return `${meta.email} → ${meta.role}`;
  if (action === 'deployment.create') return meta.name;
  return '';
}

function timeAgo(date) {
  const diff = Date.now() - new Date(date).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

export default function Activity() {
  const { id: appId } = useParams();
  const [logs, setLogs] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const res = await api.get(`/apps/${appId}/activity?page=${page}&limit=20`);
      setLogs(res.data.logs);
      setTotal(res.data.total);
      setTotalPages(res.data.totalPages);
    } catch (_) {
    } finally {
      setLoading(false);
    }
  }, [appId, page]);

  useEffect(() => { load(); }, [load]);

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <div className="page-breadcrumb"><Link to={`/apps/${appId}/deployments`}>Overview</Link> / Activity</div>
          <h1 className="page-title">Activity Log</h1>
        </div>
      </div>

      {loading ? (
        <div className="page-loading">Loading...</div>
      ) : logs.length === 0 ? (
        <div className="empty-state">
          <div className="empty-icon">📋</div>
          <div className="empty-title">No activity yet</div>
          <div className="empty-desc">Actions like releases, rollbacks, and team changes will appear here.</div>
        </div>
      ) : (
        <>
          <div className="activity-feed">
            {logs.map((log) => (
              <div key={log.id} className="activity-item">
                <div className="activity-icon">{ACTION_ICONS[log.action] || '•'}</div>
                <div className="activity-content">
                  <div className="activity-main">
                    <span className="activity-user">{log.user?.name || log.user?.email}</span>
                    <span className="activity-action">{ACTION_LABELS[log.action] || log.action}</span>
                    {metaText(log.action, log.meta) && (
                      <span className="activity-meta">{metaText(log.action, log.meta)}</span>
                    )}
                  </div>
                  <div className="activity-time">{timeAgo(log.createdAt)}</div>
                </div>
              </div>
            ))}
          </div>

          {totalPages > 1 && (
            <div className="pagination">
              <button className="btn btn-secondary" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>← Prev</button>
              <span className="pagination-info">Page {page} of {totalPages}</span>
              <button className="btn btn-secondary" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}>Next →</button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
