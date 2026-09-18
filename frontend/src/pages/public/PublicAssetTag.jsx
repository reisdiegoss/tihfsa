import { useState, useEffect } from "react";
import { useParams, Link } from "react-router-dom";
import { 
  Laptop, ShieldCheck, MapPin, User, Building2, 
  MessageSquare, Copy, Check, AlertCircle, RefreshCw, Smartphone 
} from "lucide-react";
import api from "../../api/client";

export default function PublicAssetTag() {
  const { code } = useParams();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!code) return;
    setLoading(true);
    setError("");

    api.get(`/qrcodes/public/${code}`)
      .then((res) => {
        setData(res.data);
      })
      .catch((err) => {
        console.error("Erro ao carregar dados do QR Code:", err);
        setError("Ficha de equipamento não encontrada ou código inválido.");
      })
      .finally(() => {
        setLoading(false);
      });
  }, [code]);

  const handleCopy = () => {
    if (!data) return;
    const text = [
      `[EQUIPAMENTO - ${data.company || "HOTEL FASANO SALVADOR"}]`,
      `Item: ${data.asset_name || data.title}`,
      data.collaborator ? `Responsável: ${data.collaborator}` : null,
      data.brand ? `Marca: ${data.brand} ${data.model || ""}` : null,
      data.address ? `Localização: ${data.address}` : null,
      data.message ? `Mensagem: ${data.message}` : null,
      `Código de Autenticidade: ${data.code}`,
    ].filter(Boolean).join("\n");

    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 flex flex-col items-center justify-center p-4 sm:p-6 antialiased selection:bg-blue-500 selection:text-white">
      {/* Background Decorativo Suave */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-96 h-96 bg-blue-600/10 rounded-full blur-3xl"></div>
        <div className="absolute -bottom-40 -left-40 w-96 h-96 bg-emerald-600/10 rounded-full blur-3xl"></div>
      </div>

      <div className="w-full max-w-md relative z-10">
        
        {loading ? (
          <div className="bg-slate-800/80 backdrop-blur-xl border border-slate-700/60 rounded-3xl p-8 text-center flex flex-col items-center justify-center shadow-2xl">
            <RefreshCw size={32} className="animate-spin text-blue-400 mb-4" />
            <p className="text-sm font-semibold text-slate-300">Carregando dados do equipamento...</p>
          </div>
        ) : error ? (
          <div className="bg-slate-800/80 backdrop-blur-xl border border-red-500/30 rounded-3xl p-8 text-center shadow-2xl space-y-4">
            <div className="w-16 h-16 rounded-2xl bg-red-500/10 text-red-400 flex items-center justify-center mx-auto">
              <AlertCircle size={32} />
            </div>
            <h2 className="text-lg font-bold text-white">Não Encontrado</h2>
            <p className="text-xs text-slate-400">{error}</p>
            <p className="text-[11px] text-slate-500 font-mono">Código: {code}</p>
          </div>
        ) : (
          <div className="bg-slate-800/90 backdrop-blur-2xl border border-slate-700/80 rounded-3xl overflow-hidden shadow-2xl shadow-black/50">
            
            {/* Topo com Logo / Empresa */}
            <div className="p-6 pb-5 border-b border-slate-700/60 bg-gradient-to-b from-slate-800/60 to-transparent flex flex-col items-center text-center">
              {data.logo_url ? (
                <div className="w-20 h-20 bg-white rounded-2xl p-2.5 shadow-md flex items-center justify-center mb-3">
                  <img
                    src={data.logo_url}
                    alt={data.company || "Logo"}
                    className="max-w-full max-h-full object-contain"
                  />
                </div>
              ) : (
                <div className="w-14 h-14 rounded-2xl bg-blue-600/20 text-blue-400 border border-blue-500/30 flex items-center justify-center mb-3">
                  <Laptop size={28} />
                </div>
              )}

              <h1 className="text-xs font-bold uppercase tracking-widest text-slate-400">
                {data.company || "Hotel Fasano Salvador"}
              </h1>
              <p className="text-lg font-extrabold text-white mt-0.5">
                {data.title}
              </p>

              <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-[11px] font-bold mt-2.5">
                <ShieldCheck size={13} />
                <span>Equipamento Corporativo Registrado</span>
              </div>
            </div>

            {/* Informações em Lista */}
            <div className="p-6 space-y-4 text-xs">
              
              {/* Item / Hostname / Patrimônio */}
              <div className="bg-slate-700/30 border border-slate-700/50 rounded-2xl p-3.5 flex items-start gap-3">
                <div className="p-2 rounded-xl bg-slate-700/60 text-slate-300">
                  <Laptop size={16} />
                </div>
                <div>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Equipamento / Hostname / Patrimônio</span>
                  <p className="text-sm font-bold text-white mt-0.5">{data.asset_name || data.title}</p>
                </div>
              </div>

              {/* Colaborador / Responsável */}
              {data.collaborator && (
                <div className="bg-slate-700/30 border border-slate-700/50 rounded-2xl p-3.5 flex items-start gap-3">
                  <div className="p-2 rounded-xl bg-slate-700/60 text-slate-300">
                    <User size={16} />
                  </div>
                  <div>
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Colaborador / Responsável</span>
                    <p className="text-sm font-bold text-white mt-0.5">{data.collaborator}</p>
                  </div>
                </div>
              )}

              {/* Marca & Modelo */}
              {(data.brand || data.model) && (
                <div className="bg-slate-700/30 border border-slate-700/50 rounded-2xl p-3.5 flex items-start gap-3">
                  <div className="p-2 rounded-xl bg-slate-700/60 text-slate-300">
                    <Building2 size={16} />
                  </div>
                  <div>
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Marca & Modelo</span>
                    <p className="text-sm font-bold text-white mt-0.5">
                      {[data.brand, data.model].filter(Boolean).join(" • ")}
                    </p>
                  </div>
                </div>
              )}

              {/* Endereço / Localização */}
              {data.address && (
                <div className="bg-slate-700/30 border border-slate-700/50 rounded-2xl p-3.5 flex items-start gap-3">
                  <div className="p-2 rounded-xl bg-slate-700/60 text-slate-300">
                    <MapPin size={16} />
                  </div>
                  <div>
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Localização / Setor</span>
                    <p className="text-xs font-semibold text-slate-200 mt-0.5">{data.address}</p>
                  </div>
                </div>
              )}

              {/* Mensagem Personalizada */}
              {data.message && (
                <div className="bg-blue-500/10 border border-blue-500/20 rounded-2xl p-4">
                  <div className="flex items-center gap-1.5 text-blue-400 font-bold text-[11px] mb-1">
                    <MessageSquare size={13} />
                    <span>Instruções & Contato</span>
                  </div>
                  <p className="text-xs text-blue-100/90 leading-relaxed italic">
                    "{data.message}"
                  </p>
                </div>
              )}

              {/* Ação: Copiar Dados */}
              <div className="pt-2">
                <button
                  onClick={handleCopy}
                  className="w-full py-3 bg-slate-700 hover:bg-slate-600 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition-all shadow-sm cursor-pointer"
                >
                  {copied ? (
                    <>
                      <Check size={16} className="text-emerald-400" />
                      <span className="text-emerald-400">Dados Copiados!</span>
                    </>
                  ) : (
                    <>
                      <Copy size={16} />
                      <span>Copiar Dados do Equipamento</span>
                    </>
                  )}
                </button>
              </div>

              {/* Código de Autenticidade */}
              <div className="pt-2 text-center">
                <p className="text-[10px] text-slate-500 font-mono tracking-widest">
                  ID: {data.code}
                </p>
              </div>
            </div>

            {/* Rodapé Corporativo */}
            <div className="px-6 py-3.5 bg-slate-900/60 border-t border-slate-700/60 text-center">
              <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider">
                TIHFSA • Hotel Fasano Salvador
              </p>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
