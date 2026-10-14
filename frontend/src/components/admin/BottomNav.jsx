import { NavLink } from "react-router-dom";
import { LayoutDashboard, Ticket, FileSignature, Monitor, Activity } from "lucide-react";

export default function BottomNav() {
  const menuItems = [
    { name: "Início", path: "/admin", icon: LayoutDashboard },
    { name: "Fila", path: "/admin/tickets", icon: Ticket },
    { name: "Termos", path: "/admin/terms", icon: FileSignature },
    { name: "Ativos", path: "/admin/assets", icon: Monitor },
    { name: "Monitor", path: "/admin/monitoring", icon: Activity },
  ];


  return (
    <nav 
      data-print="hidden"
      className="md:hidden fixed bottom-0 left-0 w-full bg-white border-t border-slate-200 px-2 py-2 pb-safe z-50 flex items-center justify-around shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)] print:hidden no-print"
    >
      {menuItems.map((item) => (
        <NavLink
          key={item.path}
          to={item.path}
          end={item.path === "/admin"}
          className={({ isActive }) =>
            `flex flex-col items-center justify-center w-16 h-14 rounded-2xl transition-all ${
              isActive
                ? "text-blue-600"
                : "text-slate-400 hover:text-slate-600"
            }`
          }
        >
          {({ isActive }) => (
            <>
              <div className={`flex items-center justify-center w-8 h-8 rounded-full mb-1 transition-colors ${isActive ? 'bg-blue-50' : 'bg-transparent'}`}>
                <item.icon size={20} strokeWidth={isActive ? 2.5 : 2} />
              </div>
              <span className={`text-[10px] tracking-wide ${isActive ? 'font-bold' : 'font-semibold'}`}>
                {item.name}
              </span>
            </>
          )}
        </NavLink>
      ))}
    </nav>
  );
}
