import { useState, useEffect } from "react";
import { Search, Filter, Plus, FileText, ChevronRight, RefreshCw } from "lucide-react";
import api from "../../api/client";
import TicketDetailDrawer from "../../components/admin/TicketDetailDrawer";

export default function TicketList() {
  const [tickets, setTickets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedStatus, setSelectedStatus] = useState("Todos");
  const [activeTicketId, setActiveTicketId] = useState(null);

  const fetchTickets = () => {
    setLoading(true);
    api.get("/tickets")
      .then((r) => setTickets(r.data))
      .catch(console.error)
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchTickets();
  }, []);

  const filteredTickets = tickets.filter((t) => {
    const matchesSearch =
      t.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      t.id.toString().includes(searchTerm) ||
      (t.requester_name && t.requester_name.toLowerCase().includes(searchTerm.toLowerCase()));
    
    const matchesStatus =
      selectedStatus === "Todos" || t.status === selectedStatus;

    return matchesSearch && matchesStatus;
  });

  const statuses = ["Todos", "Novo", "Em Andamento", "Aguardando Validacao", "Fechado"];

  return (
    <div className="space-y-6 pb-12 animate-fade-in">
      
      {/* Top Header & Actions */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">Fila de Chamados de TI</h1>
          <p className="text-sm font-semibold text-slate-500 mt-1">Gerencie, atribua e resolva solicitações do hotel</p>
        </div>
        <button
          onClick={fetchTickets}
          className="flex items-center gap-2 bg-white text-slate-700 px-4 py-2.5 rounded-xl border border-slate-200 text-sm font-bold shadow-xs hover:bg-slate-50 transition-colors cursor-pointer"
        >
          <RefreshCw size={16} className={loading ? "animate-spin" : ""} />
          Atualizar Fila
        </button>
      </div>

      {/* Filter Tabs & Search Bar */}
      <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-xs flex flex-wrap items-center justify-between gap-4">
        
        {/* Status Pills */}
        <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar">
          {statuses.map((status) => (
            <button
              key={status}
              onClick={() => setSelectedStatus(status)}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
                selectedStatus === status
                  ? "bg-blue-600 text-white shadow-xs"
                  : "bg-slate-50 text-slate-600 hover:bg-slate-100"
              }`}
            >
              {status}
            </button>
          ))}
        </div>

        {/* Search Input */}
        <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 px-3.5 py-2 rounded-xl text-xs w-full sm:w-72">
          <Search size={16} className="text-slate-400 shrink-0" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Buscar por título, ID, solicitante..."
            className="bg-transparent text-slate-900 placeholder-slate-400 outline-none w-full font-medium"
          />
        </div>
      </div>

      {/* Main Table */}
      <div className="bg-white rounded-3xl border border-slate-200 shadow-xs overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-slate-400 font-medium">Carregando lista de chamados...</div>
        ) : filteredTickets.length === 0 ? (
          <div className="p-12 text-center text-slate-400 font-medium">Nenhum chamado encontrado.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-100 text-xs font-bold text-slate-400 uppercase tracking-wider bg-slate-50/50">
                  <th className="px-6 py-4">Chamado</th>
                  <th className="px-6 py-4">Solicitante / Local</th>
                  <th className="px-6 py-4">Categoria</th>
                  <th className="px-6 py-4">Prioridade</th>
                  <th className="px-6 py-4">Status</th>
                  <th className="px-6 py-4 text-right">Ação</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-sm">
                {filteredTickets.map((t) => (
                  <tr
                    key={t.id}
                    onClick={() => setActiveTicketId(t.id)}
                    className="hover:bg-slate-50/80 transition-colors cursor-pointer group"
                  >
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center font-bold text-sm shrink-0">
                          <FileText size={18} />
                        </div>
                        <div>
                          <p className="font-bold text-slate-900 group-hover:text-blue-600 transition-colors">{t.title}</p>
                          <p className="text-xs font-semibold text-slate-400">#{t.id}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <p className="font-bold text-slate-800">{t.requester_name || "Desconhecido"}</p>
                      <p className="text-xs text-slate-400 font-medium">Apt {t.apartment_number || "N/A"}</p>
                    </td>
                    <td className="px-6 py-4 font-semibold text-slate-600 text-xs">
                      {t.category || "Geral"}
                    </td>
                    <td className="px-6 py-4">
                      <span className={`px-2.5 py-1 rounded-full text-xs font-extrabold ${
                        t.priority === "Crítica" ? "bg-red-100 text-red-700" :
                        t.priority === "Alta" ? "bg-amber-100 text-amber-700" :
                        "bg-slate-100 text-slate-700"
                      }`}>
                        {t.priority}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`px-2.5 py-1 rounded-full text-xs font-bold ${
                        t.status === "Em Andamento" ? "bg-amber-100 text-amber-700" :
                        t.status === "Fechado" ? "bg-emerald-100 text-emerald-700" :
                        t.status === "Aguardando Validacao" ? "bg-purple-100 text-purple-700" :
                        "bg-blue-100 text-blue-700"
                      }`}>
                        {t.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <button className="w-8 h-8 rounded-full bg-slate-100 text-slate-400 group-hover:bg-blue-600 group-hover:text-white flex items-center justify-center transition-all cursor-pointer ml-auto">
                        <ChevronRight size={16} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Slide-Over Detail Drawer */}
      <TicketDetailDrawer
        ticketId={activeTicketId}
        onClose={() => setActiveTicketId(null)}
        onUpdate={fetchTickets}
      />
    </div>
  );
}
