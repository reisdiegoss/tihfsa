import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "./contexts/AuthContext";

// Layout
import AdminLayout from "./layouts/AdminLayout";

// Pages
import Dashboard from "./pages/admin/Dashboard";
import TicketList from "./pages/admin/TicketList";
import NewTicket from "./pages/admin/NewTicket";
import Assets from "./pages/admin/Assets";

// Auth
import Login from "./pages/shared/Login";

function ProtectedRoute({ children }) {
  const { user, loading } = useAuth();
  if (loading) return null;
  if (!user) return <Navigate to="/login" replace />;
  return children; 
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/login" element={<Login />} />
          
          {/* Main Admin UI Route */}
          <Route path="/admin" element={
            <ProtectedRoute>
              <AdminLayout />
            </ProtectedRoute>
          }>
            <Route index element={<Dashboard />} />
            <Route path="tickets" element={<TicketList />} />
            <Route path="tickets/new" element={<NewTicket />} />
            <Route path="assets" element={<Assets />} />
          </Route>
          
          <Route path="*" element={<Navigate to="/admin" replace />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}
