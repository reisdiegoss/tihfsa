/**
 * ClientHome — tela inicial do PWA do usuário (Light/Modern Theme) com acabamento premium.
 */
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Plus, Ticket, Sparkles, ChevronRight, MapPin } from "lucide-react";
import api from "../../api/client";
import { useAuth } from "../../contexts/AuthContext";
import StatusBadge from "../../components/ui/StatusBadge";

export default function ClientHome() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [tickets, setTickets] = useState([]);

  useEffect(() => {
    if (user?.id) {
      api.get(`/tickets?requester_id=${user.id}&limit=5`).then((r) => setTickets(r.data)).catch(console.error);
    }
  }, [user]);

  return (
    <div className="min-h-screen w-full bg-slate-50 text-slate-900 pb-12">
      {/* Top Header */}
      <header className="px-5 py-4 bg-white border-b border-slate-200 sticky top-0 z-20 shadow-xs">
        <div className="max-w-lg mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div
              className="w-10 h-10 rounded-xl flex items-center justify-center font-extrabold text-sm shadow-md"
              style={{
                background: "linear-gradient(135deg, #d4af37 0%, #f3e5ab 50%, #aa820a 100%)",
                color: "#0b0f19",
              }}
            >
              TI
            </div>
            <div>
              <div className="flex items-center gap-1">
                <h1 className="text-sm font-extrabold text-slate-900">TIHFSA Portal</h1>
                <Sparkles size={12} className="text-amber-500" />
              </div>
              <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">Acesso Colaborador</p>
            </div>
          </div>

          <div className="flex items-center gap-2.5 bg-slate-100 px-3 py-1.5 rounded-full border border-slate-200">
            <div className="w-6 h-6 rounded-full bg-blue-600 text-white font-bold text-xs flex items-center justify-center">
              {user?.displayName?.charAt(0) || "U"}
            </div>
            <span className="text-xs font-semibold text-slate-700 truncate max-w-[100px]">
              {user?.displayName?.split(" ")[0] || "Usuário"}
            </span>
          </div>
        </div>
      </header>

      <main className="max-w-lg mx-auto p-4 sm:p-6 space-y-6">
        {/* Main Banner CTA */}
        <button
          onClick={() => navigate("/app/new-request")}
          className="w-full rounded-2xl p-6 text-left cursor-pointer transition-all duration-300 transform hover:-translate-y-1 shadow-xl shadow-blue-500/20 relative overflow-hidden group"
          style={{
            background: "linear-gradient(135deg, #2563eb 0%, #1d4ed8 50%, #1e40af 100%)",
            color: "#fff",
          }}
        >
          <div className="absolute -right-10 -bottom-10 w-36 h-36 rounded-full bg-white/10 blur-xl group-hover:scale-125 transition-transform" />

          <div className="flex items-center justify-between relative z-10">
            <div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-blue-200 bg-white/10 px-2.5 py-1 rounded-full border border-white/10 flex items-center gap-1 w-max">
                <MapPin size={12} /> Vistoria UH / Áreas
              </span>
              <p className="text-xl font-extrabold mt-2">Relatar Problema</p>
              <p className="text-xs text-blue-100 mt-1">Abra um chamado direto com a equipe de TI</p>
            </div>
            <div className="w-12 h-12 rounded-xl bg-white/20 backdrop-blur-md flex items-center justify-center text-white shrink-0 shadow-lg">
              <Plus size={24} />
            </div>
          </div>
        </button>

        {/* Recent Tickets Section */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-xs font-bold text-slate-700 uppercase tracking-wider">
              Meus Chamados Recentes
            </h2>
            <span className="text-xs font-semibold text-slate-400">
              {tickets.length} chamados
            </span>
          </div>

          <div className="space-y-2.5">
            {tickets.map((t) => (
              <div
                key={t.id}
                className="bg-white rounded-2xl p-4 border border-slate-200 shadow-xs hover:shadow-md transition-all cursor-pointer flex flex-col gap-2 group"
              >
                <div className="flex items-center justify-between w-full">
                  <div className="flex items-center gap-2">
                    <span className="text-[11px] font-mono font-bold text-slate-400">#{t.id}</span>
                    <StatusBadge status={t.status} />
                  </div>
                  <p className="text-[11px] text-slate-400">
                    {new Date(t.created_at).toLocaleDateString("pt-BR")}
                  </p>
                </div>
                
                <h3 className="text-sm font-bold text-slate-800 group-hover:text-blue-600 transition-colors">
                  {t.title}
                </h3>
              </div>
            ))}

            {tickets.length === 0 && (
              <div className="bg-white rounded-2xl p-8 text-center border border-slate-200 space-y-2">
                <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center text-slate-400 mx-auto">
                  <Ticket size={24} />
                </div>
                <p className="text-xs font-semibold text-slate-600">Nenhum chamado aberto recentemente</p>
                <p className="text-[11px] text-slate-400">Quando você reportar problemas durante vistorias, eles aparecerão aqui.</p>
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
