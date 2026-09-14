import { useState } from "react";
import { Search, LogOut, KeyRound } from "lucide-react";
import { useAuth } from "../../contexts/AuthContext";
import ChangePasswordModal from "../common/ChangePasswordModal";
import NotificationsPopover from "./NotificationsPopover";

export default function Header() {
  const { user, logout, canChangePassword } = useAuth();
  const [passwordModalOpen, setPasswordModalOpen] = useState(false);

  return (
    <>
      <header className="h-20 bg-white border-b border-slate-200 px-4 sm:px-8 flex items-center justify-between sticky top-0 z-10 shrink-0">
        
        <div className="flex items-center gap-3 w-full sm:w-auto">
          {/* Search Bar */}
          <div className="flex items-center gap-3 bg-slate-50 px-4 py-2.5 rounded-full border border-slate-200 w-full sm:w-80 md:w-96 focus-within:ring-2 focus-within:ring-blue-100 focus-within:border-blue-400 transition-all">
            <Search size={18} className="text-slate-400 shrink-0" />
            <input
              type="text"
              placeholder="Pesquisar chamados, ativos..."
              className="bg-transparent text-sm text-slate-800 placeholder-slate-400 outline-none w-full font-medium"
            />
          </div>
        </div>

        {/* Right Side */}
        <div className="flex items-center gap-3 sm:gap-5 ml-4">
          <NotificationsPopover />

          <div className="flex items-center gap-3 pl-3 sm:pl-4 border-l border-slate-200">
            <div className="text-right hidden sm:block">
              <p className="text-sm font-bold text-slate-800">{user?.displayName || "Administrador"}</p>
              <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">{user?.role || "admin"}</p>
            </div>
            <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-full bg-slate-100 text-slate-600 font-bold text-sm flex items-center justify-center border border-slate-200 shrink-0">
              {user?.displayName?.charAt(0) || "A"}
            </div>

            {canChangePassword && (
              <button
                onClick={() => setPasswordModalOpen(true)}
                className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-xl transition-all cursor-pointer"
                title="Alterar Senha do Administrador Local"
              >
                <KeyRound size={19} />
              </button>
            )}

            <button
              onClick={logout}
              className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-xl transition-all cursor-pointer ml-1"
              title="Sair da Sessão"
            >
              <LogOut size={20} />
            </button>
          </div>
        </div>
      </header>

      {/* Modal de Alteração de Senha */}
      <ChangePasswordModal
        isOpen={passwordModalOpen}
        onClose={() => setPasswordModalOpen(false)}
      />
    </>
  );
}
