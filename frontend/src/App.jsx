import { useEffect } from "react";
import { BrowserRouter, Routes, Route, Navigate, useLocation } from "react-router-dom";
import { AuthProvider, useAuth } from "./contexts/AuthContext";
import api from "./api/client";

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
import CSATDashboard from "./pages/admin/CSATDashboard";
import Contracts from "./pages/admin/Contracts";
import Reports from "./pages/admin/Reports";
import Terms from "./pages/admin/Terms";

// Client App Pages (Colaboradores / Vistorias)
import ClientHome from "./pages/client/ClientHome";
import NewRequest from "./pages/client/NewRequest";

// Auth
import Login from "./pages/shared/Login";

function ProtectedAdminRoute({ children }) {
  const { user, isStaff, loading } = useAuth();
  const location = useLocation();
  if (loading) return null;
  if (!user) {
    const fullPath = location.pathname + location.search;
    return <Navigate to={`/login?redirect=${encodeURIComponent(fullPath)}`} state={{ from: location }} replace />;
  }
  if (!isStaff) return <Navigate to={`/app${location.search}`} replace />;
  return children; 
}

function ProtectedAppRoute({ children }) {
  const { user, loading } = useAuth();
  const location = useLocation();
  if (loading) return null;
  if (!user) {
    const fullPath = location.pathname + location.search;
    return <Navigate to={`/login?redirect=${encodeURIComponent(fullPath)}`} state={{ from: location }} replace />;
  }
  return children; 
}

// Rota raiz "/"
function RootRedirect() {
  const { user, isStaff, loading } = useAuth();
  const location = useLocation();
  if (loading) return null;
  if (!user) {
    const fullPath = location.pathname + location.search;
    const redirectUrl = fullPath && fullPath !== "/" ? `/login?redirect=${encodeURIComponent(fullPath)}` : "/login";
    return <Navigate to={redirectUrl} replace />;
  }
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
  useEffect(() => {
    // Sincroniza dinamicamente título, favicon, apple-touch-icon e manifesto PWA
    api.get("/settings/general")
      .then((res) => {
        const s = res.data;
        if (!s) return;
        if (s.pwa_name) {
          document.title = s.pwa_name;
        }
        if (s.pwa_theme_color) {
          const themeMeta = document.querySelector("meta[name='theme-color']");
          if (themeMeta) themeMeta.setAttribute("content", s.pwa_theme_color);
        }
        if (s.pwa_icon_url) {
          const iconUrl = s.pwa_icon_url;
          // Favicon dinâmico
          let fav = document.querySelector("link[rel='icon']");
          if (fav) fav.setAttribute("href", iconUrl);
          // Apple Touch Icon para iOS Safari
          document.querySelectorAll("link[rel='apple-touch-icon']").forEach((el) => {
            el.setAttribute("href", iconUrl);
          });
          // Força atualização imediata do manifesto com hash/timestamp do ícone
          let man = document.querySelector("link[rel='manifest']");
          if (man) {
            const v = encodeURIComponent(iconUrl.split("/").pop() || "latest");
            man.setAttribute("href", `/manifest.webmanifest?v=${v}`);
          }
        }
      })
      .catch(() => {});
  }, []);

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
            <Route path="csat" element={<Navigate to="/admin/tickets?tab=csat" replace />} />
            <Route path="avaliacoes" element={<Navigate to="/admin/tickets?tab=csat" replace />} />

            <Route path="contracts" element={<Contracts />} />
            <Route path="contratos" element={<Contracts />} />
            <Route path="terms" element={<Terms />} />
            <Route path="termos" element={<Terms />} />
            <Route path="reports" element={<Reports />} />
            <Route path="relatorios" element={<Reports />} />

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
