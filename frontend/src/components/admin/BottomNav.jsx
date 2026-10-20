import { useState } from "react";
import { NavLink } from "react-router-dom";
import { 
  LayoutDashboard, Ticket, FileSignature, Monitor, 
  Menu, X, PlusCircle, Briefcase, BarChart3, 
  QrCode, Activity, Settings, LogOut, FolderKanban, BookOpen
} from "lucide-react";
import { useAuth } from "../../contexts/AuthContext";

export default function BottomNav() {
  const { user, logout, isAdmin, isTechnician, isStaff, can } = useAuth();
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);

  const userModules = user?.allowed_modules || [];

  const canSeeTerms = isAdmin || isTechnician;
  const canSeeAssets = isAdmin || isTechnician || userModules.includes("assets");

  const mainItems = canSeeTerms && canSeeAssets ? [
    { name: "Início", path: "/admin", icon: LayoutDashboard },
    { name: "Chamados", path: "/admin/tickets", icon: Ticket },
    { name: "Termos", path: "/admin/terms", icon: FileSignature, highlight: true },
    { name: "Ativos", path: "/admin/assets", icon: Monitor },
  ] : [
    { name: "Início", path: "/admin", icon: LayoutDashboard },
    { name: "Chamados", path: "/admin/tickets", icon: Ticket },
    { name: "Novo", path: "/admin/tickets/new", icon: PlusCircle, highlight: true },
    { name: "Conhecimento", path: "/admin/knowledge", icon: BookOpen },
  ];

  const drawerItems = [
    { name: "Novo Chamado", path: "/admin/tickets/new", icon: PlusCircle, module: "tickets" },
    { name: "Projetos", path: "/admin/projects", icon: FolderKanban, module: "projects" },
    { name: "Termos", path: "/admin/terms", icon: FileSignature, module: "terms" },
    { name: "Contratos", path: "/admin/contracts", icon: Briefcase, module: "contracts" },
    { name: "Relatórios", path: "/admin/reports", icon: BarChart3, module: "reports" },
    { name: "QR Codes", path: "/admin/qrcodes", icon: QrCode, module: "qrcodes" },
    { name: "Monitoramento", path: "/admin/monitoring", icon: Activity, module: "monitoring" },
    { name: "Conhecimento", path: "/admin/knowledge", icon: BookOpen, module: "all" },
    { name: "Configurações", path: "/admin/settings", icon: Settings, module: "settings" },
  ].filter(item => {
    if (item.module === "all" || isAdmin) return true;
    if (item.module === "terms") {
      return isAdmin || isTechnician;
    }
    if (item.module === "projects") {
      return isAdmin || isTechnician || (userModules.includes("projects") && (can ? can("projects", "view") : true));
    }
    if (isTechnician) return true;
    if (userModules.length > 0) return userModules.includes(item.module);
    return item.module === "tickets";
  });

  return (
    <>
      {/* Gaveta Deslizante (Menu Completo para Tablet e Mobile) */}
      {isDrawerOpen && (
        <div className="lg:hidden fixed inset-0 z-50 flex flex-col justify-end bg-slate-950/70 backdrop-blur-sm animate-fadeIn">
          <div 
            className="fixed inset-0"
            onClick={() => setIsDrawerOpen(false)}
          />
          <div className="relative bg-white rounded-t-3xl p-5 shadow-2xl border-t border-slate-200 max-h-[80vh] overflow-y-auto space-y-4 z-10 animate-slideUp">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-blue-600 text-white flex items-center justify-center font-bold text-sm shadow-md shadow-blue-500/20">
                  TI
                </div>
                <div>
                  <h3 className="font-extrabold text-slate-900 text-sm">Menu do Sistema</h3>
                  <p className="text-[10px] text-slate-500 font-medium">TIHFSA • Fasano Salvador</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsDrawerOpen(false)}
                className="p-2 text-slate-400 hover:text-slate-600 rounded-xl hover:bg-slate-100 cursor-pointer"
              >
                <X size={20} />
              </button>
            </div>

            {/* Grid de Navegação Complementar */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
              {drawerItems.map((item) => (
                <NavLink
                  key={item.path}
                  to={item.path}
                  onClick={() => setIsDrawerOpen(false)}
                  className={({ isActive }) =>
                    `flex items-center gap-3 p-3 rounded-2xl text-xs font-bold transition-all ${
                      isActive
                        ? "bg-blue-50 text-blue-700 border border-blue-200"
                        : "bg-slate-50 text-slate-700 hover:bg-slate-100 border border-slate-200/60"
                    }`
                  }
                >
                  <item.icon size={18} className="shrink-0 text-blue-600" />
                  <span className="truncate">{item.name}</span>
                </NavLink>
              ))}
            </div>

            {/* Logout */}
            <div className="pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => { setIsDrawerOpen(false); logout(); }}
                className="w-full flex items-center justify-center gap-2 p-3 rounded-2xl text-xs font-bold text-red-600 bg-red-50 hover:bg-red-100 transition-colors cursor-pointer"
              >
                <LogOut size={16} />
                Sair da Conta ({user?.name || "Usuário"})
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Barra de Navegação Inferior (Visível em Celular e Tablet / iPad < lg) */}
      <nav 
        data-print="hidden"
        className="lg:hidden fixed bottom-0 left-0 w-full bg-white/95 backdrop-blur-md border-t border-slate-200 px-3 py-2 pb-safe z-40 flex items-center justify-around shadow-[0_-4px_12px_rgba(0,0,0,0.06)] print:hidden no-print"
      >
        {mainItems.map((item) => (
          <NavLink
            key={item.path}
            to={item.path}
            end={item.path === "/admin"}
            className={({ isActive }) =>
              `flex flex-col items-center justify-center flex-1 h-14 rounded-2xl transition-all cursor-pointer ${
                isActive
                  ? "text-blue-600"
                  : "text-slate-400 hover:text-slate-600"
              }`
            }
          >
            {({ isActive }) => (
              <>
                <div className={`relative flex items-center justify-center w-9 h-9 rounded-2xl mb-0.5 transition-all ${
                  isActive 
                    ? item.highlight 
                      ? 'bg-blue-600 text-white shadow-md shadow-blue-500/30 scale-105'
                      : 'bg-blue-50 text-blue-600'
                    : item.highlight
                    ? 'bg-blue-50 text-blue-700 border border-blue-200'
                    : 'bg-transparent text-slate-500'
                }`}>
                  <item.icon size={19} strokeWidth={isActive ? 2.5 : 2} />
                </div>
                <span className={`text-[10px] tracking-tight leading-none ${isActive ? 'font-bold' : 'font-semibold'}`}>
                  {item.name}
                </span>
              </>
            )}
          </NavLink>
        ))}

        {/* Botão de Menu Completo / Mais */}
        <button
          type="button"
          onClick={() => setIsDrawerOpen(true)}
          className="flex flex-col items-center justify-center flex-1 h-14 rounded-2xl text-slate-400 hover:text-slate-600 transition-all cursor-pointer"
        >
          <div className="flex items-center justify-center w-9 h-9 rounded-2xl mb-0.5 bg-slate-100 text-slate-600">
            <Menu size={19} />
          </div>
          <span className="text-[10px] font-semibold tracking-tight leading-none">
            Mais
          </span>
        </button>
      </nav>
    </>
  );
}
