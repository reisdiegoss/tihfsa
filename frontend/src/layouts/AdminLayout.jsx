import { Outlet, Navigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import Sidebar from "../components/admin/Sidebar";
import Header from "../components/admin/Header";
import BottomNav from "../components/admin/BottomNav";

export default function AdminLayout() {
  const { isStaff } = useAuth();

  if (!isStaff) return <Navigate to="/app" replace />;

  return (
    <div className="flex h-screen w-full bg-[#f8fafc] overflow-hidden">
      {/* Desktop Left Sidebar (Hidden on mobile) */}
      <Sidebar />

      {/* Main Right Content */}
      <div className="flex-1 flex flex-col h-screen min-w-0">
        <Header />
        
        {/* Scrollable Content Area - Added pb-20 on mobile for BottomNav */}
        <main className="flex-1 overflow-y-auto p-4 sm:p-8 pb-24 md:pb-8">
          <div className="max-w-7xl mx-auto space-y-8">
            <Outlet />
          </div>
        </main>
      </div>

      {/* Mobile Bottom Navigation (Hidden on desktop) */}
      <BottomNav />
    </div>
  );
}
