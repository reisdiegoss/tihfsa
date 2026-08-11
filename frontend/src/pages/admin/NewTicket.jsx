import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Send, ArrowLeft, Image as ImageIcon, Paperclip, AlertCircle, HardDrive, Wifi, Phone, MonitorSmartphone } from "lucide-react";
import api from "../../api/client";

export default function NewTicket() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    title: "",
    description: "",
    category: "Geral",
    priority: "Normal",
    apartment_number: "",
    requester_name: "",
  });

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      await api.post("/tickets", formData);
      navigate("/admin/tickets");
    } catch (error) {
      console.error(error);
      alert("Erro ao criar chamado. Tente novamente.");
    } finally {
      setLoading(false);
    }
  };

  const categories = [
    { id: "Geral", icon: AlertCircle, desc: "Dúvidas ou requisições gerais" },
    { id: "Hardware", icon: HardDrive, desc: "Impressoras, PCs, TVs" },
    { id: "Rede", icon: Wifi, desc: "Wi-Fi, Cabeamento, Internet" },
    { id: "Telefonia", icon: Phone, desc: "Telefones IP, Ramais" },
    { id: "Software", icon: MonitorSmartphone, desc: "Sistemas, Zabbix, PMS" },
  ];

  return (
    <div className="space-y-6 pb-12 animate-fade-in max-w-4xl mx-auto">
      
      {/* Top Header & Actions */}
      <div className="flex items-center gap-4">
        <button
          onClick={() => navigate(-1)}
          className="w-10 h-10 rounded-full bg-white border border-slate-200 flex items-center justify-center text-slate-500 hover:bg-slate-50 transition-colors"
        >
          <ArrowLeft size={20} />
        </button>
        <div>
          <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">Novo Chamado Técnico</h1>
          <p className="text-sm font-semibold text-slate-500 mt-1">Preencha os detalhes para registrar uma nova solicitação</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        
        {/* Main Info Card */}
        <div className="bg-white rounded-3xl border border-slate-200 p-6 sm:p-8 shadow-xs">
          <div className="space-y-6">
            
            {/* Title */}
            <div className="space-y-2">
              <label className="text-xs font-extrabold text-slate-500 uppercase tracking-wider">Título Resumido</label>
              <input
                type="text"
                required
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                placeholder="Ex: Wi-Fi lento no Restaurante"
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3.5 text-sm font-bold text-slate-800 placeholder-slate-400 outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 transition-all"
              />
            </div>

            {/* Requester & Location Row */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <label className="text-xs font-extrabold text-slate-500 uppercase tracking-wider">Nome do Solicitante</label>
                <input
                  type="text"
                  required
                  value={formData.requester_name}
                  onChange={(e) => setFormData({ ...formData, requester_name: e.target.value })}
                  placeholder="Ex: João (Governança)"
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3.5 text-sm font-semibold text-slate-800 placeholder-slate-400 outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 transition-all"
                />
              </div>
              <div className="space-y-2">
                <label className="text-xs font-extrabold text-slate-500 uppercase tracking-wider">Apartamento / Local</label>
                <input
                  type="text"
                  value={formData.apartment_number}
                  onChange={(e) => setFormData({ ...formData, apartment_number: e.target.value })}
                  placeholder="Ex: Apt 105 ou Recepção"
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3.5 text-sm font-semibold text-slate-800 placeholder-slate-400 outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 transition-all"
                />
              </div>
            </div>

            {/* Description */}
            <div className="space-y-2">
              <label className="text-xs font-extrabold text-slate-500 uppercase tracking-wider">Descrição Detalhada do Problema</label>
              <textarea
                required
                rows={4}
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="Descreva o cenário, testes já realizados ou qualquer informação relevante..."
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3.5 text-sm font-semibold text-slate-800 placeholder-slate-400 outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 transition-all resize-none"
              />
            </div>
            
          </div>
        </div>

        {/* Categories & Priorities */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          
          {/* Categories */}
          <div className="bg-white rounded-3xl border border-slate-200 p-6 shadow-xs space-y-4">
            <label className="text-xs font-extrabold text-slate-500 uppercase tracking-wider block mb-2">Categoria do Incidente</label>
            <div className="space-y-3">
              {categories.map((cat) => (
                <label
                  key={cat.id}
                  className={`flex items-center gap-4 p-3.5 rounded-2xl border-2 cursor-pointer transition-all ${
                    formData.category === cat.id
                      ? "border-blue-600 bg-blue-50/50"
                      : "border-slate-100 hover:border-slate-300 bg-white"
                  }`}
                >
                  <input
                    type="radio"
                    name="category"
                    value={cat.id}
                    checked={formData.category === cat.id}
                    onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                    className="hidden"
                  />
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 transition-colors ${
                    formData.category === cat.id ? "bg-blue-600 text-white" : "bg-slate-100 text-slate-500"
                  }`}>
                    <cat.icon size={20} />
                  </div>
                  <div>
                    <p className={`text-sm font-extrabold ${formData.category === cat.id ? "text-blue-900" : "text-slate-700"}`}>{cat.id}</p>
                    <p className="text-[11px] font-semibold text-slate-500 mt-0.5">{cat.desc}</p>
                  </div>
                </label>
              ))}
            </div>
          </div>

          {/* Priorities */}
          <div className="bg-white rounded-3xl border border-slate-200 p-6 shadow-xs h-fit space-y-4">
            <label className="text-xs font-extrabold text-slate-500 uppercase tracking-wider block mb-2">Nível de Prioridade</label>
            <div className="grid grid-cols-2 gap-3">
              {["Baixa", "Normal", "Alta", "Crítica"].map((prio) => (
                <label
                  key={prio}
                  className={`flex flex-col items-center justify-center p-4 rounded-2xl border-2 cursor-pointer transition-all ${
                    formData.priority === prio
                      ? prio === "Crítica" ? "border-red-600 bg-red-50 text-red-700" :
                        prio === "Alta" ? "border-amber-500 bg-amber-50 text-amber-700" :
                        prio === "Normal" ? "border-blue-600 bg-blue-50 text-blue-700" :
                        "border-slate-500 bg-slate-50 text-slate-700"
                      : "border-slate-100 text-slate-500 hover:border-slate-300"
                  }`}
                >
                  <input
                    type="radio"
                    name="priority"
                    value={prio}
                    checked={formData.priority === prio}
                    onChange={(e) => setFormData({ ...formData, priority: e.target.value })}
                    className="hidden"
                  />
                  <span className="font-bold text-sm">{prio}</span>
                </label>
              ))}
            </div>
            
            {/* Attachment Note */}
            <div className="mt-8 p-4 bg-slate-50 rounded-2xl border border-slate-200 border-dashed text-center space-y-2">
              <div className="flex justify-center gap-2 text-slate-400">
                <ImageIcon size={20} />
                <Paperclip size={20} />
              </div>
              <p className="text-xs font-bold text-slate-500">Anexos de fotos ou arquivos em breve.</p>
            </div>
          </div>

        </div>

        {/* Submit Button */}
        <div className="flex justify-end pt-4">
          <button
            type="submit"
            disabled={loading || !formData.title || !formData.description}
            className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-8 py-4 rounded-2xl font-bold shadow-lg shadow-blue-600/30 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? "Registrando..." : "Registrar Chamado"}
            <Send size={18} />
          </button>
        </div>

      </form>
    </div>
  );
}
