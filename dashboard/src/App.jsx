import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import Login from './pages/Login';
import Register from './pages/Register';
import Apps from './pages/Apps';
import CreateApp from './pages/CreateApp';
import Deployments from './pages/Deployments';
import DeploymentDetail from './pages/DeploymentDetail';
import Team from './pages/Team';
import Activity from './pages/Activity';
import Devices from './pages/Devices';
import AcceptInvite from './pages/AcceptInvite';
import Docs from './pages/Docs';
import AppShell from './components/AppShell';
import './App.css';

function PrivateRoute({ children }) {
  const token = localStorage.getItem('fastpush_token');
  return token ? children : <Navigate to="/login" />;
}

function Shell({ children }) {
  return (
    <PrivateRoute>
      <AppShell>{children}</AppShell>
    </PrivateRoute>
  );
}

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route path="/invites/:token/accept" element={<PrivateRoute><AcceptInvite /></PrivateRoute>} />

        <Route path="/" element={<Shell><Apps /></Shell>} />
        <Route path="/apps/create" element={<Shell><CreateApp /></Shell>} />
        <Route path="/apps/:id" element={<Shell><Deployments /></Shell>} />
        <Route path="/apps/:id/deployments" element={<Shell><Deployments /></Shell>} />
        <Route path="/apps/:id/deployments/:depId" element={<Shell><DeploymentDetail /></Shell>} />
        <Route path="/apps/:id/team" element={<Shell><Team /></Shell>} />
        <Route path="/apps/:id/activity" element={<Shell><Activity /></Shell>} />
        <Route path="/apps/:id/devices" element={<Shell><Devices /></Shell>} />
        <Route path="/docs" element={<Shell><Docs /></Shell>} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
