import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import Login from './pages/Login';
import Register from './pages/Register';
import Apps from './pages/Apps';
import CreateApp from './pages/CreateApp';
import AppDetail from './pages/AppDetail';
import './App.css';

function PrivateRoute({ children }) {
  const token = localStorage.getItem('fastpush_token');
  return token ? children : <Navigate to="/login" />;
}

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route path="/" element={<PrivateRoute><Apps /></PrivateRoute>} />
        <Route path="/apps/create" element={<PrivateRoute><CreateApp /></PrivateRoute>} />
        <Route path="/apps/:id" element={<PrivateRoute><AppDetail /></PrivateRoute>} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
