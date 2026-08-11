import { NavLink } from "react-router-dom";
import { LayoutDashboard, Ticket, PlusCircle, Monitor, Activity, LogOut } from "lucide-react";
import { useAuth } from "../../contexts/AuthContext";

export default function Sidebar() {
  const { logout } = useAuth();

  const menuItems = [
    { name: "Dashboard", path: "/admin", icon: LayoutDashboard },
    { name: "Chamados", path: "/admin/tickets", icon: Ticket },
    { name: "Novo Chamado", path: "/admin/tickets/new", icon: PlusCircle },
    { name: "Ativos", path: "/admin/assets", icon: Monitor },
    { name: "Monitoramento", path: "/admin/zabbix", icon: Activity },
  ];

  return (
    <aside className="hidden md:flex w-64 bg-white border-r border-slate-200 h-screen flex-col justify-between p-6 z-50">
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
