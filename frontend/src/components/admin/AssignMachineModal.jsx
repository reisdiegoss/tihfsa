import { useState, useEffect } from "react";
import { UserCheck, X, Check, Search, Laptop, Monitor, Server, Cpu } from "lucide-react";
import api from "../../api/client";

export default function AssignMachineModal({ isOpen, onClose, machine, onSaved, usersList = [] }) {
  const [assignedUserId, setAssignedUserId] = useState("0");
  const [deviceType, setDeviceType] = useState("Desktop");
  const [userSearch, setUserSearch] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (machine) {
      setAssignedUserId(machine.assigned_user_id ? String(machine.assigned_user_id) : "0");
      setDeviceType(machine.device_type || "Desktop");
      setUserSearch("");
    }
  }, [machine, isOpen]);

  if (!isOpen || !machine) return null;

  const filteredUsers = usersList.filter((u) => {
    const q = userSearch.toLowerCase();
    const dept = u.department?.name || u.department_name || "";
    return (
      (u.display_name || "").toLowerCase().includes(q) ||
      (u.ad_username || "").toLowerCase().includes(q) ||
      dept.toLowerCase().includes(q)
    );
  });

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await api.patch(`/monitoring/agent/machines/${machine.id}/assign`, {
        assigned_user_id: assignedUserId === "0" ? 0 : Number(assignedUserId),
        device_type: deviceType,
      });
      onSaved();
      onClose();
    } catch (err) {
      console.error("Erro ao atribuir máquina:", err);
      alert("Erro ao salvar atribuição da máquina.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-150">
      <div className="bg-white rounded-3xl max-w-lg w-full p-6 space-y-5 shadow-2xl border border-slate-200 animate-in zoom-in-95 duration-200">
        <div className="flex items-center justify-between pb-3 border-b border-slate-100">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-blue-100 text-blue-700">
              <UserCheck size={20} />
            </div>
            <div>
              <h3 className="text-base font-black text-slate-900">Atribuir Colaborador & Tipo</h3>
              <p className="text-xs text-slate-500">
                Estação: <strong className="text-slate-800">{machine.hostname}</strong> ({machine.ip_address})
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 p-1.5 rounded-lg transition-colors cursor-pointer"
          >
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSave} className="space-y-4">
          {/* Tipo do Equipamento */}
          <div>
            <label className="block text-xs font-black uppercase text-slate-500 mb-1.5">
              Tipo do Equipamento
            </label>
            <div className="grid grid-cols-3 gap-2">
              {[
                { label: "Desktop", icon: Monitor },
                { label: "Notebook", icon: Laptop },
                { label: "Servidor", icon: Server },
              ].map(({ label, icon: Icon }) => (
                <button
                  key={label}
                  type="button"
                  onClick={() => setDeviceType(label)}
                  className={`flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl border text-xs font-bold transition-all cursor-pointer ${
                    deviceType === label
                      ? "bg-blue-50 border-blue-400 text-blue-700 shadow-2xs font-black"
                      : "bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100"
                  }`}
                >
                  <Icon size={15} />
                  <span>{label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Colaborador Responsável */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs font-black uppercase text-slate-500">
                Colaborador Responsável & Setor
              </label>
              {assignedUserId !== "0" && (
                <button
                  type="button"
                  onClick={() => setAssignedUserId("0")}
                  className="text-[11px] font-bold text-red-500 hover:underline cursor-pointer"
                >
                  Desvincular
                </button>
              )}
            </div>

            <div className="space-y-2">
              <div className="relative">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                <input
                  type="text"
                  placeholder="Pesquisar colaborador por nome ou setor..."
                  value={userSearch}
                  onChange={(e) => setUserSearch(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-8 pr-3 py-2 text-xs font-medium text-slate-800 outline-none focus:border-blue-500"
                />
              </div>

              <div className="max-h-52 overflow-y-auto border border-slate-200 rounded-2xl divide-y divide-slate-100 bg-white">
                <button
                  type="button"
                  onClick={() => setAssignedUserId("0")}
                  className={`w-full text-left px-3.5 py-2.5 text-xs flex items-center justify-between cursor-pointer transition-colors ${
                    assignedUserId === "0"
                      ? "bg-blue-50 font-black text-blue-700"
                      : "hover:bg-slate-50 text-slate-600"
                  }`}
                >
                  <span>Nenhum / Não atribuído (Máquina de uso comum ou de serviço)</span>
                  {assignedUserId === "0" && <Check size={14} className="text-blue-600 shrink-0" />}
                </button>

                {filteredUsers.length === 0 ? (
                  <div className="p-4 text-center text-xs text-slate-400">
                    Nenhum colaborador encontrado para &ldquo;{userSearch}&rdquo;
                  </div>
                ) : (
                  filteredUsers.map((u) => {
                    const isSel = String(u.id) === String(assignedUserId);
                    const dept = u.department?.name || u.department_name || "Geral";
                    return (
                      <button
                        key={u.id}
                        type="button"
                        onClick={() => setAssignedUserId(String(u.id))}
                        className={`w-full text-left px-3.5 py-2.5 text-xs flex items-center justify-between gap-2 cursor-pointer transition-colors ${
                          isSel
                            ? "bg-blue-50/90 font-black text-blue-900 border-l-4 border-blue-600"
                            : "hover:bg-slate-50 text-slate-800"
                        }`}
                      >
                        <div className="min-w-0">
                          <p className="truncate font-bold text-slate-900">{u.display_name}</p>
                          <p className="text-[10px] text-slate-400 truncate">
                            🏢 {dept} {u.ad_username ? `• @${u.ad_username}` : ""}
                          </p>
                        </div>
                        {isSel && <Check size={14} className="text-blue-600 shrink-0" />}
                      </button>
                    );
                  })
                )}
              </div>
            </div>
          </div>

          <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2.5">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-black shadow-md cursor-pointer disabled:opacity-50 transition-all"
            >
              {saving ? "Salvando..." : "Salvar Atribuição"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
