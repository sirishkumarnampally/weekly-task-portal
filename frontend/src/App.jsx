import { Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import Login from './pages/Login';
import Register from './pages/Register';
import MemberDashboard from './pages/MemberDashboard';
import ManagerDashboard from './pages/ManagerDashboard';
import ManageUsers from './pages/ManageUsers';
import CapacityReport from './pages/CapacityReport';
import Stats from './pages/Stats';
import Layout from './components/Layout';

function PrivateRoute({ children, role }) {
  const { user, loading } = useAuth();
  if (loading) return <div className="flex items-center justify-center h-screen"><div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600" /></div>;
  if (!user) return <Navigate to="/login" replace />;
  if (role && user.role !== role) return <Navigate to="/" replace />;
  return children;
}

function RootRedirect() {
  const { user, loading } = useAuth();
  if (loading) return null;
  if (!user) return <Navigate to="/login" replace />;
  return <Navigate to={user.role === 'manager' ? '/manager' : '/dashboard'} replace />;
}

export default function App() {
  return (
    <AuthProvider>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route path="/" element={<RootRedirect />} />
        <Route path="/dashboard" element={
          <PrivateRoute role="member">
            <Layout><MemberDashboard /></Layout>
          </PrivateRoute>
        } />
        <Route path="/manager" element={
          <PrivateRoute role="manager">
            <Layout><ManagerDashboard /></Layout>
          </PrivateRoute>
        } />
        <Route path="/users" element={
          <PrivateRoute role="manager">
            <Layout><ManageUsers /></Layout>
          </PrivateRoute>
        } />
        <Route path="/capacity" element={
          <PrivateRoute role="manager">
            <Layout><CapacityReport /></Layout>
          </PrivateRoute>
        } />
        <Route path="/stats" element={
          <PrivateRoute role="manager">
            <Layout><Stats /></Layout>
          </PrivateRoute>
        } />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </AuthProvider>
  );
}
