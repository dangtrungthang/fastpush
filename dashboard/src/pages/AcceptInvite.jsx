import { useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import api from '../api/client';

export default function AcceptInvite() {
  const { token } = useParams();
  const navigate = useNavigate();
  const [status, setStatus] = useState('loading'); // loading | success | error | login
  const [message, setMessage] = useState('');
  const [appId, setAppId] = useState(null);

  useEffect(() => {
    const authToken = localStorage.getItem('fastpush_token');
    if (!authToken) {
      setStatus('login');
      return;
    }

    api.get(`/invites/${token}/accept`)
      .then((res) => {
        setMessage(res.data.message);
        setAppId(res.data.appId);
        setStatus('success');
        setTimeout(() => navigate(`/apps/${res.data.appId}/deployments`), 2000);
      })
      .catch((err) => {
        setMessage(err.response?.data?.error || 'Failed to accept invite');
        setStatus('error');
      });
  }, [token, navigate]);

  return (
    <div className="auth-page">
      <div className="auth-card">
        <div className="auth-brand">⚡ FastPush</div>

        {status === 'loading' && (
          <div className="auth-info">Accepting invite…</div>
        )}

        {status === 'success' && (
          <>
            <div className="auth-success">✅ {message}</div>
            <div className="auth-info">Redirecting to your app…</div>
          </>
        )}

        {status === 'error' && (
          <>
            <div className="auth-error">{message}</div>
            <Link to="/" className="btn btn-primary mt-2">Go to Dashboard</Link>
          </>
        )}

        {status === 'login' && (
          <>
            <div className="auth-info">You need to be logged in to accept this invite.</div>
            <Link
              to={`/login?redirect=/invites/${token}/accept`}
              className="btn btn-primary mt-2"
            >
              Log in to accept
            </Link>
          </>
        )}
      </div>
    </div>
  );
}
