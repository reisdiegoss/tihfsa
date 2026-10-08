import { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { 
  Star, MessageSquare, Award, CheckCircle2, AlertCircle, 
  Search, Filter, RotateCcw, User, UserCheck, ExternalLink, 
  TrendingUp, ThumbsUp, HelpCircle, RefreshCw, Calendar, 
  ChevronRight, ArrowUpDown, ChevronDown
} from "lucide-react";
import api from "../../api/client";

// Formatação amigável de data e hora
function formatDateTime(dateStr) {
  if (!dateStr) return { date: "—", time: "—", full: "—", relative: "" };
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return { date: "—", time: "—", full: "—", relative: "" };

    const date = d.toLocaleDateString("pt-BR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });

    const time = d.toLocaleTimeString("pt-BR", {
      hour: "2-digit",
      minute: "2-digit",
    });

    const full = `${date} às ${time}`;

    const now = new Date();
    const diffMs = now.getTime() - d.getTime();
    const diffSecs = Math.floor(diffMs / 1000);
    const diffMins = Math.floor(diffSecs / 60);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    let relative = "";
    if (diffMins < 1) relative = "agora mesmo";
    else if (diffMins < 60) relative = `há ${diffMins} min`;
    else if (diffHours < 24) relative = `há ${diffHours} h`;
    else if (diffDays === 1) relative = "ontem";
    else if (diffDays < 7) relative = `há ${diffDays} dias`;
    else relative = date;

    return { date, time, full, relative };
  } catch {
    return { date: dateStr, time: "", full: dateStr, relative: "" };
  }
}

// Renderizador visual de estrelas
function StarRating({ rating, size = 16, showNumber = false }) {
  const stars = [1, 2, 3, 4, 5];
  return (
    <div className="flex items-center gap-1">
      <div className="flex items-center gap-0.5">
        {stars.map((s) => (
          <Star
            key={s}
            size={size}
            className={`${
              s <= rating
                ? "text-amber-400 fill-amber-400"
                : "text-slate-200 fill-slate-100"
            } transition-colors`}
          />
        ))}
      </div>
      {showNumber && (
        <span className="text-xs font-bold text-slate-700 ml-1">
          {rating ? Number(rating).toFixed(1) : "—"}
        </span>
      )}
    </div>
  );
}

// Classificação de qualidade da nota
function getRatingLabel(rating) {
  if (rating === 5) return { text: "Excelente", bg: "bg-emerald-50 text-emerald-700 border-emerald-200" };
  if (rating === 4) return { text: "Bom", bg: "bg-teal-50 text-teal-700 border-teal-200" };
  if (rating === 3) return { text: "Regular", bg: "bg-amber-50 text-amber-700 border-amber-200" };
  if (rating === 2) return { text: "Insatisfeito", bg: "bg-orange-50 text-orange-700 border-orange-200" };
  return { text: "Muito Insatisfeito", bg: "bg-red-50 text-red-700 border-red-200" };
}

export default function CSATDashboard() {
  const navigate = useNavigate();

  // Estados de dados
  const [metrics, setMetrics] = useState(null);
  const [surveys, setSurveys] = useState([]);
  const [totalSurveys, setTotalSurveys] = useState(0);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Estados de filtros
  const [selectedRating, setSelectedRating] = useState(null);
  const [selectedTechId, setSelectedTechId] = useState(null);
  const [hasCommentOnly, setHasCommentOnly] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [page, setPage] = useState(1);
  const limit = 20;

  // Carregar métricas consolidadas
  const loadMetrics = async () => {
    try {
      const res = await api.get("/api/v1/reports/csat");
      setMetrics(res.data);
    } catch (err) {
      console.error("Erro ao carregar métricas de CSAT:", err);
    }
  };

  // Carregar lista de pesquisas filtradas
  const loadSurveys = async () => {
    try {
      setLoading(true);
      const params = {
        limit,
        offset: (page - 1) * limit,
      };
      if (selectedRating !== null) params.rating = selectedRating;
      if (selectedTechId !== null) params.technician_id = selectedTechId;
      if (hasCommentOnly) params.has_comment = true;
      if (searchTerm.trim()) params.search = searchTerm.trim();

      const res = await api.get("/api/v1/reports/csat/surveys", { params });
      setSurveys(res.data.items || []);
      setTotalSurveys(res.data.total || 0);
    } catch (err) {
      console.error("Erro ao carregar lista de pesquisas:", err);
    } finally {
      setLoading(false);
    }
  };

  // Atualização inicial
  useEffect(() => {
    loadMetrics();
  }, []);

  // Recarregar pesquisas ao mudar filtros ou página
  useEffect(() => {
    loadSurveys();
  }, [selectedRating, selectedTechId, hasCommentOnly, searchTerm, page]);

  // Atualizar tudo
  const handleRefresh = async () => {
    setRefreshing(true);
    await Promise.all([loadMetrics(), loadSurveys()]);
    setRefreshing(false);
  };

  // Limpar filtros
  const handleClearFilters = () => {
    setSelectedRating(null);
    setSelectedTechId(null);
    setHasCommentOnly(false);
    setSearchTerm("");
    setPage(1);
  };

  // Lista de técnicos para o dropdown
  const techniciansList = useMemo(() => {
    if (!metrics || !metrics.technicians_performance) return [];
    return metrics.technicians_performance.filter((t) => t.technician_id);
  }, [metrics]);

  const totalPages = Math.ceil(totalSurveys / limit);

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* ========================================================
          CABEÇALHO
          ======================================================== */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-6 rounded-3xl border border-slate-200/80 shadow-sm">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-amber-50 border border-amber-200/60 flex items-center justify-center text-amber-500 shadow-sm">
            <Star size={26} className="fill-amber-400 text-amber-500" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-black text-slate-900 tracking-tight">
                Avaliações & CSAT
              </h1>
              <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-100 text-amber-800 border border-amber-200">
                Qualidade de Atendimento
              </span>
            </div>
            <p className="text-sm text-slate-500 mt-0.5">
              Acompanhe a percepção dos usuários, notas por chamado e o ranking de desempenho da equipe técnica.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={handleRefresh}
            disabled={refreshing}
            className="flex items-center gap-2 px-4 py-2.5 rounded-2xl border border-slate-200 text-sm font-semibold text-slate-700 bg-white hover:bg-slate-50 transition-all cursor-pointer shadow-sm active:scale-95 disabled:opacity-50"
          >
            <RefreshCw size={16} className={refreshing ? "animate-spin text-blue-600" : "text-slate-500"} />
            Atualizar
          </button>
        </div>
      </div>

      {/* ========================================================
          CARDS DE RESUMO EXECUTIVO (TOP STATS)
          ======================================================== */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Média Geral */}
        <div className="bg-white p-5 rounded-3xl border border-slate-200/80 shadow-sm flex flex-col justify-between relative overflow-hidden">
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-bold uppercase tracking-wider">Média Geral (CSAT)</span>
            <div className="w-8 h-8 rounded-xl bg-amber-50 flex items-center justify-center text-amber-500">
              <Star size={18} className="fill-amber-400" />
            </div>
          </div>
          <div className="flex items-baseline gap-2 mt-1">
            <span className="text-4xl font-black font-mono text-slate-900">
              {metrics ? metrics.average_rating.toFixed(1) : "5.0"}
            </span>
            <span className="text-sm font-bold text-slate-400">/ 5.0</span>
          </div>
          <div className="mt-3 flex items-center justify-between">
            <StarRating rating={Math.round(metrics?.average_rating || 5)} size={16} />
            <span className="text-xs font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-100">
              {(metrics?.average_rating || 5) >= 4.5 ? "Excelente" : "Positivo"}
            </span>
          </div>
        </div>

        {/* Card 2: Índice de Satisfação */}
        <div className="bg-white p-5 rounded-3xl border border-slate-200/80 shadow-sm flex flex-col justify-between relative overflow-hidden">
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-bold uppercase tracking-wider">Aprovação / Satisfação</span>
            <div className="w-8 h-8 rounded-xl bg-emerald-50 flex items-center justify-center text-emerald-600">
              <ThumbsUp size={18} />
            </div>
          </div>
          <div className="flex items-baseline gap-2 mt-1">
            <span className="text-4xl font-black font-mono text-emerald-600">
              {metrics ? metrics.satisfaction_pct : 100}%
            </span>
            <span className="text-xs font-semibold text-slate-400">notas 4 e 5 ★</span>
          </div>
          <div className="mt-3 w-full bg-slate-100 rounded-full h-2 overflow-hidden">
            <div 
              className="bg-emerald-500 h-2 rounded-full transition-all duration-500"
              style={{ width: `${Math.min(100, metrics?.satisfaction_pct || 100)}%` }}
            />
          </div>
        </div>

        {/* Card 3: Total Respondidas */}
        <div className="bg-white p-5 rounded-3xl border border-slate-200/80 shadow-sm flex flex-col justify-between relative overflow-hidden">
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-bold uppercase tracking-wider">Avaliações Recebidas</span>
            <div className="w-8 h-8 rounded-xl bg-blue-50 flex items-center justify-center text-blue-600">
              <CheckCircle2 size={18} />
            </div>
          </div>
          <div className="flex items-baseline gap-2 mt-1">
            <span className="text-4xl font-black font-mono text-slate-900">
              {metrics ? metrics.answered_surveys : 0}
            </span>
            <span className="text-xs font-semibold text-slate-400">feedbacks</span>
          </div>
          <div className="mt-3 text-xs text-slate-500 flex items-center justify-between">
            <span>De {metrics?.total_surveys || 0} chamados encerrados</span>
            <span className="font-bold text-blue-600">{metrics?.response_rate_pct || 0}% adesão</span>
          </div>
        </div>

        {/* Card 4: Feedback com Comentários */}
        <div className="bg-white p-5 rounded-3xl border border-slate-200/80 shadow-sm flex flex-col justify-between relative overflow-hidden">
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-bold uppercase tracking-wider">Comentários & Elogios</span>
            <div className="w-8 h-8 rounded-xl bg-purple-50 flex items-center justify-center text-purple-600">
              <MessageSquare size={18} />
            </div>
          </div>
          <div className="flex items-baseline gap-2 mt-1">
            <span className="text-4xl font-black font-mono text-slate-900">
              {metrics ? metrics.recent_comments?.length || 0 : 0}
            </span>
            <span className="text-xs font-semibold text-slate-400">depoimentos</span>
          </div>
          <div className="mt-3 text-xs text-purple-700 bg-purple-50 px-2 py-0.5 rounded-md border border-purple-100 flex items-center gap-1">
            <span>Feedback qualitativo registrado</span>
          </div>
        </div>
      </div>

      {/* ========================================================
          DISTRIBUIÇÃO DE NOTAS + DESEMPENHO DA EQUIPE
          ======================================================== */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* Distribuição das Notas (5 colunas) */}
        <div className="lg:col-span-5 bg-white p-6 rounded-3xl border border-slate-200/80 shadow-sm flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between pb-4 border-b border-slate-100 mb-4">
              <h2 className="text-base font-bold text-slate-800 flex items-center gap-2">
                <TrendingUp size={18} className="text-blue-600" />
                Distribuição das Notas
              </h2>
              <span className="text-xs text-slate-400 font-semibold">
                Clique para filtrar
              </span>
            </div>

            <div className="space-y-3">
              {[5, 4, 3, 2, 1].map((star) => {
                const count = metrics?.rating_distribution?.[String(star)] || 0;
                const total = metrics?.answered_surveys || 1;
                const pct = Math.round((count / Math.max(1, total)) * 100);
                const isSelected = selectedRating === star;

                const colorMap = {
                  5: "bg-emerald-500 text-emerald-700",
                  4: "bg-teal-500 text-teal-700",
                  3: "bg-amber-500 text-amber-700",
                  2: "bg-orange-500 text-orange-700",
                  1: "bg-red-500 text-red-700",
                };

                return (
                  <button
                    key={star}
                    onClick={() => setSelectedRating(isSelected ? null : star)}
                    className={`w-full p-2.5 rounded-2xl flex items-center gap-3 transition-all text-left cursor-pointer border ${
                      isSelected
                        ? "bg-blue-50/70 border-blue-300 shadow-sm"
                        : "hover:bg-slate-50 border-transparent"
                    }`}
                  >
                    <div className="flex items-center gap-1 w-16 text-xs font-bold text-slate-700">
                      <span>{star}</span>
                      <Star size={13} className="fill-amber-400 text-amber-400" />
                    </div>

                    <div className="flex-1 bg-slate-100 rounded-full h-3 overflow-hidden">
                      <div
                        className={`h-3 rounded-full transition-all duration-500 ${colorMap[star].split(" ")[0]}`}
                        style={{ width: `${pct}%` }}
                      />
                    </div>

                    <div className="w-16 text-right">
                      <span className="text-xs font-extrabold text-slate-800">{count}</span>
                      <span className="text-[11px] text-slate-400 ml-1">({pct}%)</span>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {selectedRating !== null && (
            <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-blue-600">
              <span>Filtrando por {selectedRating} estrela(s)</span>
              <button 
                onClick={() => setSelectedRating(null)}
                className="font-bold underline hover:text-blue-800 cursor-pointer"
              >
                Remover filtro
              </button>
            </div>
          )}
        </div>

        {/* Desempenho por Técnico / Ranking (7 colunas) */}
        <div className="lg:col-span-7 bg-white p-6 rounded-3xl border border-slate-200/80 shadow-sm flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between pb-4 border-b border-slate-100 mb-4">
              <div>
                <h2 className="text-base font-bold text-slate-800 flex items-center gap-2">
                  <Award size={18} className="text-amber-500" />
                  Desempenho por Técnico
                </h2>
                <p className="text-xs text-slate-400 mt-0.5">
                  Índice de satisfação e média de avaliações por atendente
                </p>
              </div>
              <span className="text-xs font-bold text-slate-500 bg-slate-100 px-2.5 py-1 rounded-xl">
                {metrics?.technicians_performance?.length || 0} técnico(s) avaliado(s)
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr className="text-[11px] font-bold text-slate-400 uppercase tracking-wider border-b border-slate-100">
                    <th className="pb-3 pl-2">Técnico</th>
                    <th className="pb-3 text-center">Atendimentos</th>
                    <th className="pb-3 text-center">Média CSAT</th>
                    <th className="pb-3 text-center">Aprovação</th>
                    <th className="pb-3 text-right pr-2">Ação</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-sm">
                  {(!metrics?.technicians_performance || metrics.technicians_performance.length === 0) ? (
                    <tr>
                      <td colSpan={5} className="py-8 text-center text-slate-400 text-xs">
                        Nenhum atendimento avaliado para a equipe ainda.
                      </td>
                    </tr>
                  ) : (
                    metrics.technicians_performance.map((tech, idx) => {
                      const isSelected = selectedTechId === tech.technician_id;
                      return (
                        <tr 
                          key={tech.technician_id || idx}
                          className={`hover:bg-slate-50/80 transition-colors ${
                            isSelected ? "bg-blue-50/60" : ""
                          }`}
                        >
                          <td className="py-3.5 pl-2">
                            <div className="flex items-center gap-3">
                              <div className={`w-8 h-8 rounded-xl flex items-center justify-center font-bold text-xs ${
                                idx === 0 
                                  ? "bg-amber-100 text-amber-800 border border-amber-300"
                                  : "bg-slate-100 text-slate-700"
                              }`}>
                                {idx === 0 ? "★ 1" : `#${idx + 1}`}
                              </div>
                              <div>
                                <div className="font-bold text-slate-800">{tech.technician_name}</div>
                                <div className="text-[11px] text-slate-400">
                                  {tech.last_rating_at ? `Última: ${formatDateTime(tech.last_rating_at).relative}` : "Atendente TI"}
                                </div>
                              </div>
                            </div>
                          </td>

                          <td className="py-3.5 text-center font-mono font-bold text-slate-700">
                            {tech.total_answered}
                          </td>

                          <td className="py-3.5 text-center">
                            <div className="inline-flex items-center gap-1 px-2.5 py-1 rounded-xl bg-amber-50 border border-amber-200/80 text-amber-800 font-bold font-mono text-xs">
                              <Star size={12} className="fill-amber-400 text-amber-400" />
                              {tech.average_rating.toFixed(1)}
                            </div>
                          </td>

                          <td className="py-3.5 text-center font-bold text-xs">
                            <span className={tech.satisfaction_pct >= 90 ? "text-emerald-600" : tech.satisfaction_pct >= 75 ? "text-amber-600" : "text-red-600"}>
                              {tech.satisfaction_pct}%
                            </span>
                          </td>

                          <td className="py-3.5 text-right pr-2">
                            <button
                              onClick={() => setSelectedTechId(isSelected ? null : tech.technician_id)}
                              className={`text-xs font-bold px-2.5 py-1 rounded-xl transition-all cursor-pointer ${
                                isSelected
                                  ? "bg-blue-600 text-white"
                                  : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                              }`}
                            >
                              {isSelected ? "Filtrado" : "Ver chamados"}
                            </button>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {selectedTechId !== null && (
            <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-blue-600">
              <span>Filtrando chamados do técnico selecionado</span>
              <button 
                onClick={() => setSelectedTechId(null)}
                className="font-bold underline hover:text-blue-800 cursor-pointer"
              >
                Remover filtro
              </button>
            </div>
          )}
        </div>

      </div>

      {/* ========================================================
          FEED E LISTA DETALHADA DE AVALIAÇÕES
          ======================================================== */}
      <div className="bg-white rounded-3xl border border-slate-200/80 shadow-sm p-6 space-y-6">
        
        {/* Barra de Filtros e Busca */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-4 border-b border-slate-100">
          <div>
            <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
              <MessageSquare size={20} className="text-blue-600" />
              Histórico de Avaliações
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Exibindo {surveys.length} de {totalSurveys} avaliação(ões) registrada(s)
            </p>
          </div>

          {/* Filtros em linha */}
          <div className="flex flex-wrap items-center gap-2">
            {/* Busca textual */}
            <div className="relative min-w-[220px]">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => {
                  setSearchTerm(e.target.value);
                  setPage(1);
                }}
                placeholder="Buscar solicitante, chamado..."
                className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-2xl text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 text-slate-800"
              />
            </div>

            {/* Filtro de Estrelas */}
            <select
              value={selectedRating || ""}
              onChange={(e) => {
                setSelectedRating(e.target.value ? Number(e.target.value) : null);
                setPage(1);
              }}
              className="bg-slate-50 border border-slate-200 rounded-2xl px-3 py-2 text-xs font-semibold text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
            >
              <option value="">Todas as Notas</option>
              <option value="5">5 Estrelas (Excelente)</option>
              <option value="4">4 Estrelas (Bom)</option>
              <option value="3">3 Estrelas (Regular)</option>
              <option value="2">2 Estrelas (Ruim)</option>
              <option value="1">1 Estrela (Insatisfeito)</option>
            </select>

            {/* Filtro de Técnico */}
            {techniciansList.length > 0 && (
              <select
                value={selectedTechId || ""}
                onChange={(e) => {
                  setSelectedTechId(e.target.value ? Number(e.target.value) : null);
                  setPage(1);
                }}
                className="bg-slate-50 border border-slate-200 rounded-2xl px-3 py-2 text-xs font-semibold text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
              >
                <option value="">Todos os Técnicos</option>
                {techniciansList.map((t) => (
                  <option key={t.technician_id} value={t.technician_id}>
                    {t.technician_name}
                  </option>
                ))}
              </select>
            )}

            {/* Toggle apenas com comentário */}
            <button
              onClick={() => {
                setHasCommentOnly(!hasCommentOnly);
                setPage(1);
              }}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-2xl text-xs font-semibold border transition-all cursor-pointer ${
                hasCommentOnly
                  ? "bg-purple-50 text-purple-700 border-purple-200"
                  : "bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100"
              }`}
            >
              <MessageSquare size={14} className={hasCommentOnly ? "text-purple-600" : "text-slate-400"} />
              Com comentários
            </button>

            {/* Limpar Filtros */}
            {(selectedRating !== null || selectedTechId !== null || hasCommentOnly || searchTerm) && (
              <button
                onClick={handleClearFilters}
                className="flex items-center gap-1 px-3 py-2 rounded-2xl text-xs font-semibold text-red-600 bg-red-50 hover:bg-red-100 transition-all cursor-pointer"
                title="Limpar todos os filtros"
              >
                <RotateCcw size={14} />
                Limpar
              </button>
            )}
          </div>
        </div>

        {/* Lista de Feedbacks */}
        {loading ? (
          <div className="py-12 flex flex-col items-center justify-center text-slate-400 space-y-3">
            <RefreshCw size={28} className="animate-spin text-blue-600" />
            <span className="text-xs font-semibold">Carregando avaliações...</span>
          </div>
        ) : surveys.length === 0 ? (
          <div className="py-16 flex flex-col items-center justify-center text-center max-w-sm mx-auto space-y-3">
            <div className="w-16 h-16 rounded-full bg-slate-100 flex items-center justify-center text-slate-400">
              <Star size={28} />
            </div>
            <h3 className="text-base font-bold text-slate-800">Nenhuma avaliação encontrada</h3>
            <p className="text-xs text-slate-500">
              Nenhuma pesquisa de satisfação corresponde aos filtros atuais. Tente limpar os critérios de busca.
            </p>
            <button
              onClick={handleClearFilters}
              className="mt-2 px-4 py-2 bg-blue-50 text-blue-700 rounded-xl text-xs font-bold hover:bg-blue-100 transition-colors"
            >
              Limpar Filtros
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {surveys.map((survey) => {
              const dt = formatDateTime(survey.answered_at || survey.created_at);
              const label = getRatingLabel(survey.rating);

              return (
                <div
                  key={survey.id}
                  className="bg-slate-50/70 hover:bg-white border border-slate-200/80 hover:border-blue-200 rounded-2xl p-5 transition-all shadow-xs hover:shadow-md flex flex-col justify-between space-y-4"
                >
                  {/* Topo do Card: Chamado #, Estrelas e Badge */}
                  <div>
                    <div className="flex items-center justify-between gap-2 mb-2">
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => navigate(`/admin/tickets?ticketId=${survey.ticket_id}`)}
                          className="font-mono text-xs font-extrabold px-2.5 py-1 rounded-lg bg-blue-100 text-blue-800 hover:bg-blue-200 transition-colors flex items-center gap-1 cursor-pointer"
                          title="Abrir este chamado"
                        >
                          #{survey.ticket_id}
                          <ExternalLink size={12} />
                        </button>
                        <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full border ${label.bg}`}>
                          {label.text}
                        </span>
                      </div>

                      <div className="text-[11px] font-semibold text-slate-400" title={dt.full}>
                        {dt.relative}
                      </div>
                    </div>

                    <h4 
                      onClick={() => navigate(`/admin/tickets?ticketId=${survey.ticket_id}`)}
                      className="text-sm font-bold text-slate-900 hover:text-blue-600 transition-colors cursor-pointer line-clamp-1"
                    >
                      {survey.ticket_title}
                    </h4>

                    {/* Estrelas */}
                    <div className="mt-2 flex items-center gap-2">
                      <StarRating rating={survey.rating} size={18} />
                      <span className="text-xs font-extrabold text-slate-700">
                        {survey.rating}.0 / 5.0
                      </span>
                    </div>
                  </div>

                  {/* Comentário do Solicitante (se houver) */}
                  {survey.comment ? (
                    <div className="bg-white border border-slate-200/90 rounded-xl p-3 text-xs text-slate-700 italic relative">
                      <span className="text-slate-400 font-serif text-lg leading-none absolute -top-2 left-2">“</span>
                      <p className="pt-1">{survey.comment}</p>
                    </div>
                  ) : (
                    <div className="text-[11px] text-slate-400 italic">
                      Nenhum comentário adicional registrado.
                    </div>
                  )}

                  {/* Rodapé do Card: Solicitante e Técnico */}
                  <div className="pt-3 border-t border-slate-200/60 flex items-center justify-between text-xs text-slate-500">
                    <div className="flex items-center gap-2">
                      <div className="w-6 h-6 rounded-full bg-slate-200 flex items-center justify-center text-slate-600 font-bold text-[10px]">
                        {survey.requester_name.charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <span className="font-semibold text-slate-700 block line-clamp-1">
                          {survey.requester_name}
                        </span>
                        <span className="text-[10px] text-slate-400 block">
                          {survey.department_name || "Solicitante"}
                        </span>
                      </div>
                    </div>

                    <div className="text-right">
                      <span className="text-[10px] text-slate-400 block uppercase font-bold">Atendido por</span>
                      <span className="font-bold text-slate-800 text-[11px] flex items-center gap-1 justify-end">
                        <UserCheck size={12} className="text-blue-600" />
                        {survey.technician_name}
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Paginação */}
        {totalPages > 1 && (
          <div className="pt-4 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
            <div>
              Página {page} de {totalPages} ({totalSurveys} registros)
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
                className="px-3 py-1.5 rounded-xl border border-slate-200 font-semibold hover:bg-slate-50 disabled:opacity-40 cursor-pointer"
              >
                Anterior
              </button>
              <button
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
                className="px-3 py-1.5 rounded-xl border border-slate-200 font-semibold hover:bg-slate-50 disabled:opacity-40 cursor-pointer"
              >
                Próxima
              </button>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
