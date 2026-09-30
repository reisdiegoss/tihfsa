import { useState, useEffect } from "react";
import { 
  Clock, ShieldAlert, AlertTriangle, CheckCircle2, 
  Calendar, Layers, Save, RefreshCw, Plus, Trash2, 
  Info, Sparkles, Sliders, Check, HelpCircle
} from "lucide-react";
import api from "../../api/client";

const DAYS_OF_WEEK = [
  { key: "mon", label: "Seg" },
  { key: "tue", label: "Ter" },
  { key: "wed", label: "Qua" },
  { key: "thu", label: "Qui" },
  { key: "fri", label: "Sex" },
  { key: "sat", label: "Sáb" },
  { key: "sun", label: "Dom" },
];

export default function SLASettingsSection() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [categories, setCategories] = useState([]);
  
  // Configuração Global de SLA
  const [config, setConfig] = useState({
    calc_business_hours: false,
    business_start_time: "08:00",
    business_end_time: "18:00",
    business_days: "mon,tue,wed,thu,fri",
    enable_category_sla: false,
    critical_response_min: 15,
    critical_resolution_min: 120,
    high_response_min: 60,
    high_resolution_min: 240,
    medium_response_min: 120,
    medium_resolution_min: 480,
    low_response_min: 240,
    low_resolution_min: 1440,
    warning_threshold_percent: 75,
  });

  const [categoryRules, setCategoryRules] = useState([]);
  const [feedbackMsg, setFeedbackMsg] = useState(null);

  // Modal / Formulário de Regra por Categoria
  const [newCatId, setNewCatId] = useState("");
  const [newCatResponseMin, setNewCatResponseMin] = useState(30);
  const [newCatResolutionMin, setNewCatResolutionMin] = useState(120);
  const [addingCatRule, setAddingCatRule] = useState(false);

  const fetchSlaData = async () => {
    setLoading(true);
    try {
      const [resSla, resCats] = await Promise.all([
        api.get("/sla/config"),
        api.get("/categories/"),
      ]);

      if (resSla.data?.config) {
        setConfig(resSla.data.config);
      }
      if (resSla.data?.category_rules) {
        setCategoryRules(resSla.data.category_rules);
      }
      setCategories(Array.isArray(resCats.data) ? resCats.data : []);
    } catch (err) {
      console.error("Erro ao carregar dados de SLA:", err);
      setFeedbackMsg({ type: "error", text: "Não foi possível carregar as configurações de SLA." });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSlaData();
  }, []);

  const handleSaveConfig = async (e) => {
    e?.preventDefault();
    setSaving(true);
    setFeedbackMsg(null);
    try {
      await api.put("/sla/config", config);
      setFeedbackMsg({ type: "success", text: "Diretrizes de SLA salvas com sucesso!" });
      setTimeout(() => setFeedbackMsg(null), 4000);
    } catch (err) {
      console.error("Erro ao salvar SLA:", err);
      setFeedbackMsg({ 
        type: "error", 
        text: err.response?.data?.detail || "Erro ao salvar as configurações de SLA." 
      });
    } finally {
      setSaving(false);
    }
  };

  const handleToggleDay = (dayKey) => {
    const current = config.business_days ? config.business_days.split(",").map(d => d.trim()) : [];
    let updated;
    if (current.includes(dayKey)) {
      updated = current.filter(d => d !== dayKey);
    } else {
      updated = [...current, dayKey];
    }
    setConfig(prev => ({ ...prev, business_days: updated.join(",") }));
  };

  const handleAddCategoryRule = async (e) => {
    e.preventDefault();
    if (!newCatId) return;
    setAddingCatRule(true);
    try {
      await api.post("/sla/category-rules", {
        category_id: parseInt(newCatId, 10),
        response_min: parseInt(newCatResponseMin, 10) || null,
        resolution_min: parseInt(newCatResolutionMin, 10) || 120,
      });
      setNewCatId("");
      fetchSlaData();
    } catch (err) {
      console.error(err);
      alert(err.response?.data?.detail || "Erro ao salvar regra para a categoria.");
    } finally {
      setAddingCatRule(false);
    }
  };

  const handleDeleteCategoryRule = async (ruleId) => {
    if (!window.confirm("Deseja remover a regra de SLA desta categoria?")) return;
    try {
      await api.delete(`/sla/category-rules/${ruleId}`);
      setCategoryRules(prev => prev.filter(r => r.id !== ruleId));
    } catch (err) {
      console.error(err);
      alert("Erro ao remover regra.");
    }
  };

  // Conversor amigável de minutos para visualização
  const formatMinHelper = (mins) => {
    if (!mins && mins !== 0) return "—";
    if (mins < 60) return `${mins} min`;
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    return m > 0 ? `${h}h ${m}m` : `${h} hora${h > 1 ? "s" : ""}`;
  };

  if (loading) {
    return (
      <div className="bg-white rounded-3xl border border-slate-200 p-12 text-center shadow-xs">
        <RefreshCw size={28} className="animate-spin text-blue-600 mx-auto mb-3" />
        <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">Carregando parâmetros de SLA...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      
      {/* Header Informativo */}
      <div className="bg-white rounded-3xl border border-slate-200 p-6 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-base font-bold text-slate-800 flex items-center gap-2">
            <Clock className="text-blue-600" size={20} /> Parametrização e Metas de SLA (Service Level Agreement)
          </h2>
          <p className="text-xs font-semibold text-slate-500 mt-1">
            Defina os limites de tempo de primeira resposta e resolução. Esses prazos alimentam os alertas em tempo real do Helpdesk e o Dashboard da TV.
          </p>
        </div>

        <button
          onClick={handleSaveConfig}
          disabled={saving}
          className="flex items-center justify-center gap-2 bg-blue-600 text-white px-6 py-3 rounded-2xl text-sm font-bold shadow-md shadow-blue-600/20 hover:bg-blue-700 transition-all cursor-pointer disabled:opacity-50 shrink-0"
        >
          {saving ? <RefreshCw size={16} className="animate-spin" /> : <Save size={16} />}
          {saving ? "Salvando..." : "Salvar Diretrizes de SLA"}
        </button>
      </div>

      {feedbackMsg && (
        <div className={`p-4 rounded-2xl border text-xs font-bold flex items-center gap-2.5 shadow-xs ${
          feedbackMsg.type === "success" 
            ? "bg-emerald-50 text-emerald-800 border-emerald-200" 
            : "bg-red-50 text-red-800 border-red-200"
        }`}>
          {feedbackMsg.type === "success" ? <CheckCircle2 size={16} /> : <AlertTriangle size={16} />}
          <span>{feedbackMsg.text}</span>
        </div>
      )}

      {/* Grid de Configurações */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

        {/* CARD 1: Modo de Contagem e Horário Comercial */}
        <div className="bg-white rounded-3xl border border-slate-200 p-6 shadow-xs space-y-5">
          <div className="flex items-center gap-2.5 pb-3 border-b border-slate-100">
            <div className="w-8 h-8 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center font-bold">
              <Calendar size={18} />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-800">Expediente e Janela de Atendimento</h3>
              <p className="text-[11px] text-slate-400 font-medium">Contagem contínua (24/7) ou durante horário de trabalho</p>
            </div>
          </div>

          {/* Toggle 24/7 vs Comercial */}
          <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 flex items-center justify-between gap-4">
            <div>
              <p className="text-xs font-bold text-slate-800">
                Calcular SLA estritamente em Horário Comercial
              </p>
              <p className="text-[11px] text-slate-500 mt-0.5">
                {config.calc_business_hours
                  ? "Pausas noturnas e finais de semana são descontados do tempo do SLA."
                  : "Contagem contínua 24/7 (SLA corre mesmo à noite e finais de semana)."}
              </p>
            </div>
            <label className="relative inline-flex items-center cursor-pointer shrink-0">
              <input
                type="checkbox"
                checked={config.calc_business_hours}
                onChange={(e) => setConfig(prev => ({ ...prev, calc_business_hours: e.target.checked }))}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
            </label>
          </div>

          {/* Horários do Expediente (se ativo) */}
          <div className={`space-y-4 transition-opacity ${config.calc_business_hours ? "opacity-100" : "opacity-40 pointer-events-none"}`}>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold text-slate-600 mb-1">Início do Expediente:</label>
                <input
                  type="time"
                  value={config.business_start_time}
                  onChange={(e) => setConfig(prev => ({ ...prev, business_start_time: e.target.value }))}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-sm font-bold text-slate-800"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-600 mb-1">Fim do Expediente:</label>
                <input
                  type="time"
                  value={config.business_end_time}
                  onChange={(e) => setConfig(prev => ({ ...prev, business_end_time: e.target.value }))}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-sm font-bold text-slate-800"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-600 mb-1.5">Dias Úteis de Atendimento:</label>
              <div className="flex flex-wrap gap-2">
                {DAYS_OF_WEEK.map((d) => {
                  const isSelected = (config.business_days || "").includes(d.key);
                  return (
                    <button
                      key={d.key}
                      type="button"
                      onClick={() => handleToggleDay(d.key)}
                      className={`px-3 py-1.5 rounded-xl text-xs font-bold border transition-all cursor-pointer ${
                        isSelected 
                          ? "bg-blue-600 border-blue-600 text-white shadow-xs" 
                          : "bg-white border-slate-200 text-slate-600 hover:bg-slate-50"
                      }`}
                    >
                      {d.label}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Limiar de Alerta (Warning) */}
          <div className="pt-3 border-t border-slate-100">
            <div className="flex items-center justify-between mb-1">
              <label className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                <AlertTriangle size={14} className="text-amber-500" />
                <span>Alerta Visual de Proximidade (Warning):</span>
              </label>
              <span className="text-xs font-extrabold text-amber-600 bg-amber-50 px-2 py-0.5 rounded-md border border-amber-200">
                {config.warning_threshold_percent}% do tempo
              </span>
            </div>
            <p className="text-[11px] text-slate-400 mb-2">
              Quando um chamado atingir essa porcentagem do SLA total, ele começará a pulsar em amarelo/âmbar na TV.
            </p>
            <input
              type="range"
              min="50"
              max="90"
              step="5"
              value={config.warning_threshold_percent}
              onChange={(e) => setConfig(prev => ({ ...prev, warning_threshold_percent: parseInt(e.target.value, 10) }))}
              className="w-full accent-amber-500 cursor-pointer"
            />
          </div>
        </div>

        {/* CARD 2: Prazos Padrão por Prioridade */}
        <div className="bg-white rounded-3xl border border-slate-200 p-6 shadow-xs space-y-4">
          <div className="flex items-center gap-2.5 pb-3 border-b border-slate-100">
            <div className="w-8 h-8 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center font-bold">
              <Sliders size={18} />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-800">Prazos de SLA por Prioridade (Padrão ITIL)</h3>
              <p className="text-[11px] text-slate-400 font-medium">Metas de primeira resposta e resolução máxima</p>
            </div>
          </div>

          <div className="space-y-3">
            {/* Crítica */}
            <div className="p-3.5 bg-red-50/60 rounded-2xl border border-red-100 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-black text-red-700 uppercase tracking-wide flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-red-500 animate-ping"></span>
                  Prioridade Crítica
                </span>
                <span className="text-[11px] font-bold text-red-600">
                  Resolução: {formatMinHelper(config.critical_resolution_min)}
                </span>
              </div>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div>
                  <span className="text-[10px] font-bold text-slate-500">1ª Resposta (min):</span>
                  <input
                    type="number"
                    min="1"
                    value={config.critical_response_min}
                    onChange={(e) => setConfig(prev => ({ ...prev, critical_response_min: parseInt(e.target.value, 10) || 1 }))}
                    className="w-full mt-0.5 bg-white border border-red-200 rounded-lg px-2.5 py-1.5 font-bold text-slate-800"
                  />
                </div>
                <div>
                  <span className="text-[10px] font-bold text-slate-500">Resolução Total (min):</span>
                  <input
                    type="number"
                    min="5"
                    value={config.critical_resolution_min}
                    onChange={(e) => setConfig(prev => ({ ...prev, critical_resolution_min: parseInt(e.target.value, 10) || 5 }))}
                    className="w-full mt-0.5 bg-white border border-red-200 rounded-lg px-2.5 py-1.5 font-bold text-slate-800"
                  />
                </div>
              </div>
            </div>

            {/* Alta */}
            <div className="p-3.5 bg-orange-50/60 rounded-2xl border border-orange-100 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-black text-orange-700 uppercase tracking-wide">
                  Prioridade Alta
                </span>
                <span className="text-[11px] font-bold text-orange-600">
                  Resolução: {formatMinHelper(config.high_resolution_min)}
                </span>
              </div>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div>
                  <span className="text-[10px] font-bold text-slate-500">1ª Resposta (min):</span>
                  <input
                    type="number"
                    min="1"
                    value={config.high_response_min}
                    onChange={(e) => setConfig(prev => ({ ...prev, high_response_min: parseInt(e.target.value, 10) || 1 }))}
                    className="w-full mt-0.5 bg-white border border-orange-200 rounded-lg px-2.5 py-1.5 font-bold text-slate-800"
                  />
                </div>
                <div>
                  <span className="text-[10px] font-bold text-slate-500">Resolução Total (min):</span>
                  <input
                    type="number"
                    min="5"
                    value={config.high_resolution_min}
                    onChange={(e) => setConfig(prev => ({ ...prev, high_resolution_min: parseInt(e.target.value, 10) || 5 }))}
                    className="w-full mt-0.5 bg-white border border-orange-200 rounded-lg px-2.5 py-1.5 font-bold text-slate-800"
                  />
                </div>
              </div>
            </div>

            {/* Média */}
            <div className="p-3.5 bg-blue-50/50 rounded-2xl border border-blue-100 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-black text-blue-700 uppercase tracking-wide">
                  Prioridade Média
                </span>
                <span className="text-[11px] font-bold text-blue-600">
                  Resolução: {formatMinHelper(config.medium_resolution_min)}
                </span>
              </div>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div>
                  <span className="text-[10px] font-bold text-slate-500">1ª Resposta (min):</span>
                  <input
                    type="number"
                    min="1"
                    value={config.medium_response_min}
                    onChange={(e) => setConfig(prev => ({ ...prev, medium_response_min: parseInt(e.target.value, 10) || 1 }))}
                    className="w-full mt-0.5 bg-white border border-blue-200 rounded-lg px-2.5 py-1.5 font-bold text-slate-800"
                  />
                </div>
                <div>
                  <span className="text-[10px] font-bold text-slate-500">Resolução Total (min):</span>
                  <input
                    type="number"
                    min="5"
                    value={config.medium_resolution_min}
                    onChange={(e) => setConfig(prev => ({ ...prev, medium_resolution_min: parseInt(e.target.value, 10) || 5 }))}
                    className="w-full mt-0.5 bg-white border border-blue-200 rounded-lg px-2.5 py-1.5 font-bold text-slate-800"
                  />
                </div>
              </div>
            </div>

            {/* Baixa */}
            <div className="p-3.5 bg-slate-50 rounded-2xl border border-slate-200 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-black text-slate-700 uppercase tracking-wide">
                  Prioridade Baixa
                </span>
                <span className="text-[11px] font-bold text-slate-600">
                  Resolução: {formatMinHelper(config.low_resolution_min)}
                </span>
              </div>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div>
                  <span className="text-[10px] font-bold text-slate-500">1ª Resposta (min):</span>
                  <input
                    type="number"
                    min="1"
                    value={config.low_response_min}
                    onChange={(e) => setConfig(prev => ({ ...prev, low_response_min: parseInt(e.target.value, 10) || 1 }))}
                    className="w-full mt-0.5 bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 font-bold text-slate-800"
                  />
                </div>
                <div>
                  <span className="text-[10px] font-bold text-slate-500">Resolução Total (min):</span>
                  <input
                    type="number"
                    min="5"
                    value={config.low_resolution_min}
                    onChange={(e) => setConfig(prev => ({ ...prev, low_resolution_min: parseInt(e.target.value, 10) || 5 }))}
                    className="w-full mt-0.5 bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 font-bold text-slate-800"
                  />
                </div>
              </div>
            </div>
          </div>
        </div>

      </div>

      {/* CARD 3: Regras Específicas por Categoria */}
      <div className="bg-white rounded-3xl border border-slate-200 p-6 shadow-xs space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-3 border-b border-slate-100">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center font-bold">
              <Layers size={18} />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-800">Sobreposição de SLA por Categoria (Opcional)</h3>
              <p className="text-[11px] text-slate-400 font-medium">Permite definir prazos específicos para categorias críticas (ex: Sistemas de PDV)</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <span className="text-xs font-bold text-slate-700">Ativar regras por Categoria:</span>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={config.enable_category_sla}
                onChange={(e) => setConfig(prev => ({ ...prev, enable_category_sla: e.target.checked }))}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-purple-600"></div>
            </label>
          </div>
        </div>

        {config.enable_category_sla && (
          <div className="space-y-4 animate-fade-in">
            {/* Formulário para Adicionar Nova Regra */}
            <form onSubmit={handleAddCategoryRule} className="p-4 bg-slate-50 rounded-2xl border border-slate-200 grid grid-cols-1 sm:grid-cols-4 gap-3 items-end">
              <div>
                <label className="block text-xs font-bold text-slate-600 mb-1">Selecionar Categoria:</label>
                <select
                  value={newCatId}
                  onChange={(e) => setNewCatId(e.target.value)}
                  className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold text-slate-800"
                  required
                >
                  <option value="">Selecione...</option>
                  {categories.map((c) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-600 mb-1">1ª Resposta (min):</label>
                <input
                  type="number"
                  min="1"
                  value={newCatResponseMin}
                  onChange={(e) => setNewCatResponseMin(e.target.value)}
                  className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold text-slate-800"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-600 mb-1">Resolução (minutos):</label>
                <input
                  type="number"
                  min="5"
                  value={newCatResolutionMin}
                  onChange={(e) => setNewCatResolutionMin(e.target.value)}
                  className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold text-slate-800"
                  required
                />
              </div>

              <button
                type="submit"
                disabled={addingCatRule || !newCatId}
                className="w-full bg-purple-600 hover:bg-purple-700 text-white py-2 rounded-xl text-xs font-bold shadow-sm transition-all flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
              >
                <Plus size={14} />
                <span>Adicionar Regra</span>
              </button>
            </form>

            {/* Lista de Regras Criadas */}
            {categoryRules.length === 0 ? (
              <p className="text-xs text-slate-400 italic text-center py-4">
                Nenhuma categoria possui SLA customizado no momento. O SLA por Prioridade será aplicado.
              </p>
            ) : (
              <div className="divide-y divide-slate-100 border border-slate-200 rounded-2xl overflow-hidden">
                {categoryRules.map((rule) => (
                  <div key={rule.id} className="p-3.5 bg-white flex items-center justify-between gap-3 text-xs">
                    <div>
                      <p className="font-bold text-slate-800">{rule.category_name}</p>
                      <p className="text-[11px] text-slate-400">
                        Resposta: <strong>{formatMinHelper(rule.response_min)}</strong> • Resolução: <strong>{formatMinHelper(rule.resolution_min)}</strong>
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleDeleteCategoryRule(rule.id)}
                      className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors cursor-pointer"
                      title="Excluir regra de categoria"
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

    </div>
  );
}
