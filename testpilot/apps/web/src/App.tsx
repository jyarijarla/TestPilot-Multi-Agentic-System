import { Routes, Route } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import Navbar from './components/Navbar';
import ProtectedRoute from './components/ProtectedRoute';
import Home from './pages/Home';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import RunDetail from './pages/RunDetail';
import Report from './pages/Report';

export default function App() {
  return (
    <AuthProvider>
      <div className="min-h-screen bg-bg-primary">
        <Navbar />
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/login" element={<Login />} />
          <Route path="/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
          <Route path="/runs/:id" element={<ProtectedRoute><RunDetail /></ProtectedRoute>} />
          <Route path="/runs/:id/report" element={<ProtectedRoute><Report /></ProtectedRoute>} />
        </Routes>
      </div>
    </AuthProvider>
  );
}
