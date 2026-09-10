import { useState } from "react";
import { KeyRound, Lock, Eye, EyeOff, Check, X, AlertCircle, RefreshCw } from "lucide-react";
import api from "../../api/client";
import { useAuth } from "../../contexts/AuthContext";

export default function ChangePasswordModal({ isOpen, onClose }) {
  const { user } = useAuth();
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);

  if (!isOpen) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    if (!currentPassword) {
      setError("Por favor, digite sua senha atual.");
      return;
    }

    if (!newPassword || newPassword.length < 6) {
      setError("A nova senha deve possuir pelo menos 6 caracteres.");
      return;
    }

    if (newPassword !== confirmPassword) {
      setError("A confirmação da senha não coincide com a nova senha digitada.");
      return;
    }

    if (currentPassword === newPassword) {
      setError("A nova senha não pode ser idêntica à senha atual.");
      return;
    }

    setLoading(true);
    try {
      const response = await api.post("/auth/change-password", {
        current_password: currentPassword,
        new_password: newPassword,
      });

      setSuccess(response.data?.message || "Senha alterada com sucesso!");
      setTimeout(() => {
        handleClose();
      }, 1800);
    } catch (err) {
      const msg = err.response?.data?.detail || "Erro ao alterar senha. Verifique as credenciais.";
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    setCurrentPassword("");
    setNewPassword("");
    setConfirmPassword("");
    setError(null);
    setSuccess(null);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4 animate-fade-in">
      <div className="bg-white rounded-3xl max-w-md w-full shadow-2xl border border-slate-100 overflow-hidden">
        
        {/* Modal Header */}
        <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-slate-50/60">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center border border-blue-100">
              <KeyRound size={20} />
            </div>
            <div>
              <h3 className="font-extrabold text-slate-900 text-base">Alterar Senha do Administrador</h3>
              <p className="text-xs font-semibold text-slate-400">
                Conta local: <span className="text-slate-700 font-bold">{user?.displayName || "Admin"}</span>
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={handleClose}
            className="w-8 h-8 rounded-full bg-white border border-slate-200 text-slate-400 hover:text-slate-700 flex items-center justify-center transition-colors cursor-pointer"
          >
            <X size={16} />
          </button>
        </div>

        {/* Modal Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          
          {error && (
            <div className="p-3.5 bg-red-50 border border-red-200 rounded-2xl flex items-start gap-3 text-red-700 text-xs font-bold animate-shake">
              <AlertCircle size={16} className="shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {success && (
            <div className="p-3.5 bg-emerald-50 border border-emerald-200 rounded-2xl flex items-center gap-3 text-emerald-700 text-xs font-bold">
              <Check size={16} className="shrink-0 text-emerald-600" />
              <span>{success}</span>
            </div>
          )}

          {/* Senha Atual */}
          <div>
            <label className="text-[11px] font-extrabold text-slate-500 uppercase tracking-wider block mb-1.5">
              Senha Atual <span className="text-red-500">*</span>
            </label>
            <div className="relative flex items-center">
              <input
                type={showCurrent ? "text" : "password"}
                required
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                placeholder="Digite a senha atual cadastrada"
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-xs font-bold text-slate-800 outline-none focus:border-blue-500 focus:bg-white transition-all pr-10"
              />
              <button
                type="button"
                onClick={() => setShowCurrent(!showCurrent)}
                className="absolute right-3 text-slate-400 hover:text-slate-600 transition-colors cursor-pointer"
              >
                {showCurrent ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>

          {/* Nova Senha */}
          <div>
            <label className="text-[11px] font-extrabold text-slate-500 uppercase tracking-wider block mb-1.5">
              Nova Senha <span className="text-red-500">*</span>
            </label>
            <div className="relative flex items-center">
              <input
                type={showNew ? "text" : "password"}
                required
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="Mínimo de 6 caracteres"
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-xs font-bold text-slate-800 outline-none focus:border-blue-500 focus:bg-white transition-all pr-10"
              />
              <button
                type="button"
                onClick={() => setShowNew(!showNew)}
                className="absolute right-3 text-slate-400 hover:text-slate-600 transition-colors cursor-pointer"
              >
                {showNew ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>

          {/* Confirmar Nova Senha */}
          <div>
            <label className="text-[11px] font-extrabold text-slate-500 uppercase tracking-wider block mb-1.5">
              Confirmar Nova Senha <span className="text-red-500">*</span>
            </label>
            <div className="relative flex items-center">
              <input
                type={showConfirm ? "text" : "password"}
                required
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Repita a nova senha"
                className={`w-full bg-slate-50 border rounded-xl px-4 py-2.5 text-xs font-bold text-slate-800 outline-none focus:bg-white transition-all pr-10 ${
                  confirmPassword && confirmPassword !== newPassword
                    ? "border-red-400 focus:border-red-500"
                    : "border-slate-200 focus:border-blue-500"
                }`}
              />
              <button
                type="button"
                onClick={() => setShowConfirm(!showConfirm)}
                className="absolute right-3 text-slate-400 hover:text-slate-600 transition-colors cursor-pointer"
              >
                {showConfirm ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
            {confirmPassword && confirmPassword !== newPassword && (
              <p className="text-[10px] font-bold text-red-500 mt-1">As senhas não coincidem.</p>
            )}
          </div>

          <div className="p-3 bg-blue-50/60 border border-blue-100 rounded-xl text-[11px] text-blue-700 font-medium">
            <p className="flex items-center gap-1.5 font-bold mb-0.5">
              <Lock size={12} /> Política de Acesso Local
            </p>
            Esta alteração atualiza a senha de acesso local do administrador raiz. Contas do Active Directory (LDAP) continuam sincronizadas diretamente com a rede corporativa.
          </div>

          {/* Modal Footer */}
          <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2.5">
            <button
              type="button"
              onClick={handleClose}
              className="px-4 py-2 bg-white border border-slate-200 text-slate-600 rounded-xl text-xs font-bold hover:bg-slate-50 transition-colors cursor-pointer"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={loading || !newPassword || !currentPassword}
              className="px-5 py-2 bg-blue-600 text-white rounded-xl text-xs font-bold hover:bg-blue-700 shadow-md shadow-blue-600/20 transition-all disabled:opacity-50 flex items-center gap-1.5 cursor-pointer"
            >
              {loading ? <RefreshCw size={14} className="animate-spin" /> : <Check size={14} />}
              Atualizar Senha
            </button>
          </div>
        </form>

      </div>
    </div>
  );
}
