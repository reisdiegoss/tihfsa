import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "./contexts/AuthContext";

// Layout
import AdminLayout from "./layouts/AdminLayout";

// Admin Pages
import Dashboard from "./pages/admin/Dashboard";
import TicketList from "./pages/admin/TicketList";
import NewTicket from "./pages/admin/NewTicket";
import Assets from "./pages/admin/Assets";
import Settings from "./pages/admin/Settings";
import ZabbixPanel from "./pages/admin/ZabbixPanel";

// Client App Pages (Colaboradores / Vistorias)
import ClientHome from "./pages/client/ClientHome";
import NewRequest from "./pages/client/NewRequest";

// Auth
import Login from "./pages/shared/Login";

function ProtectedAdminRoute({ children }) {
  const { user, isStaff, loading } = useAuth();
  if (loading) return null;
  if (!user) return <Navigate to="/login" replace />;
  if (!isStaff) return <Navigate to="/app" replace />;
  return children; 
}

function ProtectedAppRoute({ children }) {
  const { user, loading } = useAuth();
  if (loading) return null;
  if (!user) return <Navigate to="/login" replace />;
  return children; 
}

// Rota raiz "/"
function RootRedirect() {
  const { user, isStaff, loading } = useAuth();
  if (loading) return null;
  if (!user) return <Navigate to="/login" replace />;
  if (!isStaff) return <Navigate to="/app" replace />;
  return <Navigate to="/admin" replace />;
}

// Public Wallboard / TV NOC Page
import PublicNocPanel from "./pages/public/PublicNocPanel";

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/noc" element={<PublicNocPanel />} />
          <Route path="/noc/public" element={<PublicNocPanel />} />
          <Route path="/" element={<RootRedirect />} />
          
          {/* Main Admin UI Route */}
          <Route path="/admin" element={
            <ProtectedAdminRoute>
              <AdminLayout />
            </ProtectedAdminRoute>
          }>
            <Route index element={<Dashboard />} />
            <Route path="tickets" element={<TicketList />} />
            <Route path="tickets/new" element={<NewTicket />} />
            <Route path="assets" element={<Assets />} />
            <Route path="zabbix" element={<ZabbixPanel />} />
            <Route path="settings" element={<Settings />} />
            <Route path="ad-import" element={<Navigate to="/admin/settings" replace />} />
          </Route>

          {/* Main Colaborador (Client App) UI Route */}
          <Route path="/app" element={
            <ProtectedAppRoute>
              <ClientHome />
            </ProtectedAppRoute>
          } />
          <Route path="/app/new-request" element={
            <ProtectedAppRoute>
              <NewRequest />
            </ProtectedAppRoute>
          } />
          
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}
