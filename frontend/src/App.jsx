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
import MonitoringHub from "./pages/admin/MonitoringHub";
import PublicHelpdeskTv from "./pages/public/PublicHelpdeskTv";
import PublicTicketForm from "./pages/public/PublicTicketForm";

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

// Public Wallboard / TV NOC Page & QR Code Tag
import PublicNocPanel from "./pages/public/PublicNocPanel";
import PublicAssetTag from "./pages/public/PublicAssetTag";
import QRCodeScannerPage from "./pages/public/QRCodeScannerPage";
import QRCodeManager from "./pages/admin/QRCodeManager";

import SatisfactionSurvey from "./pages/public/SatisfactionSurvey";

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/noc" element={<PublicNocPanel />} />
          <Route path="/noc/public" element={<PublicNocPanel />} />
          <Route path="/tv/helpdesk" element={<PublicHelpdeskTv />} />
          <Route path="/tv/tickets" element={<PublicHelpdeskTv />} />
          <Route path="/qr/:code" element={<PublicAssetTag />} />
          <Route path="/scan" element={<QRCodeScannerPage />} />
          <Route path="/chamado" element={<PublicTicketForm />} />
          <Route path="/abrir-chamado" element={<PublicTicketForm />} />
          <Route path="/suporte" element={<PublicTicketForm />} />
          <Route path="/avaliacao/:token" element={<SatisfactionSurvey />} />
          <Route path="/avaliacao" element={<SatisfactionSurvey />} />
          <Route path="/csat/:token" element={<SatisfactionSurvey />} />
          <Route path="/csat" element={<SatisfactionSurvey />} />
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
            <Route path="qrcodes" element={<QRCodeManager />} />
            <Route path="qrcodes/scan" element={<QRCodeScannerPage />} />
            <Route path="monitoring" element={<MonitoringHub />} />
            <Route path="zabbix" element={<Navigate to="/admin/monitoring" replace />} />
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
