import { NavLink } from "react-router-dom";
import { LayoutDashboard, Ticket, PlusCircle, Monitor, Activity, QrCode, LogOut, Settings, Star, Briefcase, BarChart3, FileSignature } from "lucide-react";
import { useAuth } from "../../contexts/AuthContext";

export default function Sidebar() {
  const { user, logout, isAdmin, isTechnician, isStaff } = useAuth();

  const userModules = user?.allowed_modules || [];

  const rawMenuItems = [
    { name: "Dashboard", path: "/admin", icon: LayoutDashboard, module: "all" },
    { name: "Chamados", path: "/admin/tickets", icon: Ticket, module: "tickets" },
    { name: "Novo Chamado", path: "/admin/tickets/new", icon: PlusCircle, module: "tickets" },
    { name: "Termos", path: "/admin/terms", icon: FileSignature, module: "terms" },
    { name: "Contratos", path: "/admin/contracts", icon: Briefcase, module: "contracts" },
    { name: "Relatórios", path: "/admin/reports", icon: BarChart3, module: "reports" },
    { name: "Ativos", path: "/admin/assets", icon: Monitor, module: "assets" },
    { name: "QR Codes", path: "/admin/qrcodes", icon: QrCode, module: "qrcodes" },
    { name: "Monitoramento", path: "/admin/monitoring", icon: Activity, module: "monitoring" },
    { name: "Configurações", path: "/admin/settings", icon: Settings, module: "settings" },
  ];

  const menuItems = rawMenuItems.filter(item => {
    if (item.module === "all" || isAdmin) return true;
    if (item.module === "terms") {
      // Garante visibilidade garantida para equipe técnica, gestores e admins
      return isTechnician || isStaff || isAdmin || userModules.includes("terms");
    }
    if (userModules.length > 0) return userModules.includes(item.module);
    if (isTechnician) return ["tickets", "assets", "monitoring", "topology", "qrcodes", "reports", "contracts", "terms"].includes(item.module);
    return item.module === "tickets";
  });



  return (
    <aside 
      data-print="hidden"
      className="hidden lg:flex w-64 bg-white border-r border-slate-200 h-screen flex-col justify-between p-6 z-50 print:hidden no-print shrink-0"
    >
      <div>
        {/* Logo */}
        <div className="flex items-center gap-3 mb-10">
          <div className="w-10 h-10 rounded-xl bg-blue-600 text-white flex items-center justify-center font-bold text-lg shadow-md shadow-blue-500/30">
            TI
          </div>
          <div>
            <h1 className="font-extrabold text-slate-900 leading-tight tracking-tight">TIHFSA</h1>
            <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Fasano Salvador</p>
          </div>
        </div>

        {/* Navigation */}
        <nav className="space-y-2">
          {menuItems.map((item) => (
            <NavLink
              key={item.path}
              to={item.path}
              end={item.path === "/admin"}
              className={({ isActive }) =>
                `flex items-center gap-3 px-4 py-3 rounded-2xl text-sm font-semibold transition-all ${
                  isActive
                    ? "bg-blue-50 text-blue-700"
                    : "text-slate-500 hover:bg-slate-50 hover:text-slate-800"
                }`
              }
            >
              {({ isActive }) => (
                <>
                  <item.icon size={20} className={isActive ? "text-blue-600" : "text-slate-400"} />
                  {item.name}
                </>
              )}
            </NavLink>
          ))}
        </nav>
      </div>

      {/* User Area */}
      <div>
        <button
          onClick={logout}
          className="w-full flex items-center gap-3 px-4 py-3 rounded-2xl text-sm font-semibold text-slate-500 hover:bg-red-50 hover:text-red-600 transition-all cursor-pointer"
        >
          <LogOut size={20} />
          Sair da Conta
        </button>
      </div>
    </aside>
  );
}
