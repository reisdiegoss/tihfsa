import { useState, useEffect } from "react";
import { X, ExternalLink, Copy, Check, Shield, Laptop, Monitor, AlertCircle } from "lucide-react";
import api from "../../api/client";

// Ícones SVG oficiais dos softwares de acesso remoto
export function AnyDeskIcon({ size = 16, className = "" }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" className={className}>
      <path d="M8.4 4.8L3 10.2c-1.3 1.3-1.3 3.5 0 4.8l5.4 5.4c1.3 1.3 3.5 1.3 4.8 0l5.4-5.4c1.3-1.3 1.3-3.5 0-4.8L13.2 4.8c-1.3-1.3-3.5-1.3-4.8 0z" fill="#EF4444" />
      <path d="M15.6 4.8l5.4 5.4c1.3 1.3 1.3 3.5 0 4.8l-5.4 5.4c-1.3 1.3-3.5 1.3-4.8 0l2.4-2.4c.5-.5.5-1.3 0-1.8L11.4 14.4c-.5-.5-1.3-.5-1.8 0L7.2 16.8 6 15.6l4.8-4.8c1.3-1.3 3.5-1.3 4.8 0l-2.4 2.4c-.5.5-.5 1.3 0 1.8l1.8 1.8c.5.5 1.3.5 1.8 0l2.4-2.4c.5-.5.5-1.3 0-1.8L15.6 9.6l-2.4-2.4 2.4-2.4z" fill="#DC2626" />
    </svg>
  );
}

export function RustDeskIcon({ size = 16, className = "" }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" className={className}>
      <rect x="3" y="3" width="18" height="18" rx="5" fill="#0284C7" />
      <path d="M7 8h10v2.5H7V8zm0 5h10v3H7v-3z" fill="#FFFFFF" />
      <circle cx="8.5" cy="14.5" r="1" fill="#0284C7" />
      <circle cx="15.5" cy="14.5" r="1" fill="#0284C7" />
    </svg>
  );
}

export default function RemoteAccessModal({ isOpen, onClose, machine, onSuccess }) {
  const [anydeskId, setAnydeskId] = useState("");
  const [rustdeskId, setRustdeskId] = useState("");
  const [saving, setSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [copiedType, setCopiedType] = useState(null);

  useEffect(() => {
    if (machine) {
      setAnydeskId(machine.anydesk_id || "");
      setRustdeskId(machine.rustdesk_id || "");
      setErrorMsg("");
    }
  }, [machine, isOpen]);

  if (!isOpen || !machine) return null;

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    setErrorMsg("");

    try {
      await api.patch(`/monitoring/agent/machines/${machine.id}/remote-access`, {
        anydesk_id: anydeskId.trim() || null,
        rustdesk_id: rustdeskId.trim() || null,
      });

      if (onSuccess) {
        onSuccess({
          ...machine,
          anydesk_id: anydeskId.trim() || null,
          rustdesk_id: rustdeskId.trim() || null,
        });
      }
      onClose();
    } catch (err) {
      console.error("Erro ao salvar acesso remoto:", err);
      setErrorMsg(err.response?.data?.detail || "Erro ao salvar IDs de acesso remoto.");
    } finally {
      setSaving(false);
    }
  };

  const handleCopy = (text, type) => {
    if (!text) return;
    navigator.clipboard.writeText(text);
    setCopiedType(type);
    setTimeout(() => setCopiedType(null), 2500);
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl max-w-lg w-full p-6 space-y-6 shadow-2xl border border-slate-200 animate-in fade-in zoom-in-95 duration-200">
        
        {/* Cabeçalho */}
        <div className="flex items-center justify-between pb-3 border-b border-slate-100">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-indigo-50 border border-indigo-100 text-indigo-700 flex items-center justify-center shrink-0 shadow-xs">
              <Monitor size={20} />
            </div>
            <div>
              <h3 className="text-base font-black text-slate-900">
                Acesso Remoto Direto
              </h3>
              <p className="text-xs text-slate-500 font-mono">
                {machine.hostname} • IP: {machine.ip_address}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 p-2 rounded-xl hover:bg-slate-100 transition-colors cursor-pointer"
          >
            <X size={20} />
          </button>
        </div>

        {errorMsg && (
          <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs flex items-center gap-2">
            <AlertCircle size={15} className="shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

        <form onSubmit={handleSave} className="space-y-4">
          
          {/* Campo AnyDesk */}
          <div className="p-4 rounded-2xl bg-rose-50/40 border border-rose-100 space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-black uppercase text-rose-800 flex items-center gap-1.5">
                <AnyDeskIcon size={16} /> AnyDesk (ID ou Alias)
              </label>
              {anydeskId.trim() && (
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => handleCopy(anydeskId.trim(), "anydesk")}
                    className="text-[11px] font-bold text-rose-700 hover:text-rose-900 flex items-center gap-1 cursor-pointer"
                    title="Copiar AnyDesk ID"
                  >
                    {copiedType === "anydesk" ? (
                      <>
                        <Check size={12} className="text-emerald-600" />
                        <span className="text-emerald-600">Copiado!</span>
                      </>
                    ) : (
                      <>
                        <Copy size={12} />
                        <span>Copiar</span>
                      </>
                    )}
                  </button>
                  <a
                    href={`anydesk:${anydeskId.trim()}`}
                    className="inline-flex items-center gap-1 text-[11px] font-black text-white bg-rose-600 hover:bg-rose-700 px-2 py-0.5 rounded-md shadow-2xs"
                    title="Abrir AnyDesk agora"
                  >
                    Conectar <ExternalLink size={10} />
                  </a>
                </div>
              )}
            </div>
            <div className="relative">
              <input
                type="text"
                placeholder="Ex: 123456789 ou colaborador@ad"
                value={anydeskId}
                onChange={(e) => setAnydeskId(e.target.value)}
                className="w-full text-xs font-mono font-bold bg-white border border-rose-200 rounded-xl px-3.5 py-2.5 text-slate-800 focus:outline-hidden focus:ring-2 focus:ring-rose-400 focus:border-rose-400"
              />
            </div>
            <p className="text-[10px] text-slate-500">
              Protocolo disparado: <code className="font-mono text-rose-700 bg-white px-1 py-0.5 rounded border border-rose-200">anydesk:{anydeskId.trim() || "&lt;ID&gt;"}</code>
            </p>
          </div>

          {/* Campo RustDesk */}
          <div className="p-4 rounded-2xl bg-sky-50/40 border border-sky-100 space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-black uppercase text-sky-800 flex items-center gap-1.5">
                <RustDeskIcon size={16} /> RustDesk (ID)
              </label>
              {rustdeskId.trim() && (
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => handleCopy(rustdeskId.trim(), "rustdesk")}
                    className="text-[11px] font-bold text-sky-700 hover:text-sky-900 flex items-center gap-1 cursor-pointer"
                    title="Copiar RustDesk ID"
                  >
                    {copiedType === "rustdesk" ? (
                      <>
                        <Check size={12} className="text-emerald-600" />
                        <span className="text-emerald-600">Copiado!</span>
                      </>
                    ) : (
                      <>
                        <Copy size={12} />
                        <span>Copiar</span>
                      </>
                    )}
                  </button>
                  <a
                    href={`rustdesk://${rustdeskId.trim()}`}
                    className="inline-flex items-center gap-1 text-[11px] font-black text-white bg-sky-600 hover:bg-sky-700 px-2 py-0.5 rounded-md shadow-2xs"
                    title="Abrir RustDesk agora"
                  >
                    Conectar <ExternalLink size={10} />
                  </a>
                </div>
              )}
            </div>
            <div className="relative">
              <input
                type="text"
                placeholder="Ex: 987654321"
                value={rustdeskId}
                onChange={(e) => setRustdeskId(e.target.value)}
                className="w-full text-xs font-mono font-bold bg-white border border-sky-200 rounded-xl px-3.5 py-2.5 text-slate-800 focus:outline-hidden focus:ring-2 focus:ring-sky-400 focus:border-sky-400"
              />
            </div>
            <p className="text-[10px] text-slate-500">
              Protocolo disparado: <code className="font-mono text-sky-700 bg-white px-1 py-0.5 rounded border border-sky-200">rustdesk://{rustdeskId.trim() || "&lt;ID&gt;"}</code>
            </p>
          </div>

          <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl text-[11px] text-slate-600 flex items-start gap-2">
            <Shield size={14} className="text-indigo-600 shrink-0 mt-0.5" />
            <span>
              <strong>Dica de Suporte:</strong> O agente instalado nas estações detecta automaticamente esses IDs quando o AnyDesk ou RustDesk estão instalados na máquina. Você pode sobrescrever ou cadastrar manualmente a qualquer momento.
            </span>
          </div>

          {/* Botões do Rodapé */}
          <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              disabled={saving}
              className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-5 py-2 rounded-xl text-xs font-black bg-indigo-600 hover:bg-indigo-700 text-white shadow-xs hover:shadow-md transition-all cursor-pointer flex items-center gap-1.5"
            >
              {saving ? "Salvando..." : "Salvar Acesso Remoto"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
