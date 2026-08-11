import { useEffect, useState } from "react";
import { Ticket, Clock, CheckCircle, Monitor, ShieldCheck, Activity, Search, FileText } from "lucide-react";
import api from "../../api/client";

export default function Dashboard() {
  const [stats, setStats] = useState(null);
  const [tickets, setTickets] = useState([]);

  useEffect(() => {
    api.get("/tickets/stats").then((r) => setStats(r.data)).catch(console.error);
    api.get("/tickets?limit=8").then((r) => setTickets(r.data)).catch(console.error);
  }, []);

  return (
    <div className="space-y-8 animate-fade-in pb-10">
      {/* Top Hero Banner */}
      <div className="bg-blue-600 rounded-3xl p-8 text-white flex items-center justify-between shadow-sm relative overflow-hidden">
        <div className="absolute right-0 top-0 w-64 h-64 bg-white/10 rounded-full blur-3xl -mr-20 -mt-20"></div>
        <div className="relative z-10">
          <span className="text-xs font-bold uppercase tracking-wider text-blue-200">Visão Geral do Sistema</span>
          <h2 className="text-3xl font-extrabold mt-1 mb-2">Painel de Gestão de TI</h2>
          <p className="text-blue-100 font-medium">Hotel Fasano Salvador — Central de Serviços Compartilhados</p>
        </div>
        <button className="bg-white text-blue-600 px-6 py-3 rounded-xl font-bold text-sm shadow-md hover:bg-slate-50 transition-colors relative z-10 cursor-pointer">
          + Novo Chamado
        </button>
      </div>

      {/* Metric Cards Row */}
      <div className="grid grid-cols-4 gap-6">
        <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-sm flex items-center gap-4">
          <div className="w-14 h-14 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
            <Ticket size={24} />
          </div>
          <div>
            <p className="text-3xl font-extrabold text-slate-800">{stats?.total || 0}</p>
            <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">Total Chamados</p>
          </div>
        </div>
        <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-sm flex items-center gap-4">
          <div className="w-14 h-14 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center shrink-0">
            <Clock size={24} />
          </div>
          <div>
            <p className="text-3xl font-extrabold text-slate-800">{stats?.by_status?.["Em Andamento"] || 0}</p>
            <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">Em Andamento</p>
          </div>
        </div>
        <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-sm flex items-center gap-4">
          <div className="w-14 h-14 rounded-2xl bg-purple-50 text-purple-600 flex items-center justify-center shrink-0">
            <ShieldCheck size={24} />
          </div>
          <div>
            <p className="text-3xl font-extrabold text-slate-800">{stats?.by_status?.["Aguardando Validacao"] || 0}</p>
            <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">Aguardando Validação</p>
          </div>
        </div>
        <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-sm flex items-center gap-4">
          <div className="w-14 h-14 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
            <CheckCircle size={24} />
          </div>
          <div>
            <p className="text-3xl font-extrabold text-slate-800">{stats?.by_status?.["Fechado"] || 0}</p>
            <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">Fechados</p>
          </div>
        </div>
      </div>

      {/* Main Grid Content */}
      <div className="grid grid-cols-3 gap-6">
        {/* Ticket List Table */}
        <div className="col-span-2 bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden flex flex-col">
          <div className="p-6 border-b border-slate-100 flex items-center justify-between">
            <h3 className="text-lg font-extrabold text-slate-800">Fila de Chamados Recentes</h3>
            <button className="text-sm font-bold text-blue-600 hover:text-blue-700 cursor-pointer">Ver Todos</button>
          </div>
          
          <div className="flex-1 overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-slate-100 text-xs font-bold text-slate-400 uppercase tracking-wider bg-slate-50">
                  <th className="px-6 py-4 font-semibold">Chamado</th>
                  <th className="px-6 py-4 font-semibold">Prioridade</th>
                  <th className="px-6 py-4 font-semibold">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-sm">
                {tickets.map(t => (
                  <tr key={t.id} className="hover:bg-slate-50 transition-colors cursor-pointer">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
                          <FileText size={18} />
                        </div>
                        <div>
                          <p className="font-bold text-slate-800">{t.title}</p>
                          <p className="text-xs text-slate-500">#{t.id}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className="font-bold text-slate-700">{t.priority}</span>
                    </td>
                    <td className="px-6 py-4">
                      <span className="font-bold text-slate-700">{t.status}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Right Side Tools */}
        <div className="col-span-1 space-y-6">
          <div className="bg-white rounded-3xl border border-slate-200 shadow-sm p-6">
            <h3 className="text-sm font-extrabold text-slate-800 mb-4">Acesso Rápido</h3>
            <div className="grid grid-cols-2 gap-3">
              <button className="flex flex-col items-center justify-center p-4 bg-slate-50 rounded-2xl border border-slate-100 hover:border-blue-300 hover:bg-blue-50 transition-all cursor-pointer group">
                <div className="w-10 h-10 rounded-xl bg-blue-100 text-blue-600 flex items-center justify-center mb-2 group-hover:scale-110 transition-transform">
                  <Ticket size={20} />
                </div>
                <span className="text-xs font-bold text-slate-700">Chamados</span>
              </button>
              <button className="flex flex-col items-center justify-center p-4 bg-slate-50 rounded-2xl border border-slate-100 hover:border-emerald-300 hover:bg-emerald-50 transition-all cursor-pointer group">
                <div className="w-10 h-10 rounded-xl bg-emerald-100 text-emerald-600 flex items-center justify-center mb-2 group-hover:scale-110 transition-transform">
                  <Monitor size={20} />
                </div>
                <span className="text-xs font-bold text-slate-700">Ativos TI</span>
              </button>
              <button className="flex flex-col items-center justify-center p-4 bg-slate-50 rounded-2xl border border-slate-100 hover:border-amber-300 hover:bg-amber-50 transition-all cursor-pointer group">
                <div className="w-10 h-10 rounded-xl bg-amber-100 text-amber-600 flex items-center justify-center mb-2 group-hover:scale-110 transition-transform">
                  <Activity size={20} />
                </div>
                <span className="text-xs font-bold text-slate-700">Zabbix</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
