import { useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import { 
  Laptop, ShieldCheck, MapPin, User, Building2, 
  MessageSquare, Copy, Check, AlertCircle, RefreshCw, CheckCircle2
} from "lucide-react";
import api from "../../api/client";

export default function PublicAssetTag() {
  const { code } = useParams();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);
  const [acknowledged, setAcknowledged] = useState(false);

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
        setError("Ficha de equipamento não localizada ou código inválido.");
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
      data.brand || data.model ? `Marca/Modelo: ${[data.brand, data.model].filter(Boolean).join(" ")}` : null,
      data.address ? `Localização: ${data.address}` : null,
      data.message ? `Instruções: ${data.message}` : null,
      `Código: ${data.code}`,
    ].filter(Boolean).join("\n");

    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  const handleOk = () => {
    handleCopy();
    setAcknowledged(true);
  };

  return (
    <div className="fixed inset-0 bg-slate-900/70 backdrop-blur-md flex items-center justify-center p-4 sm:p-6 z-50 animate-in fade-in duration-200">
      
      {/* Modal de Alerta Centralizado */}
      <div className="bg-white rounded-3xl max-w-sm sm:max-w-md w-full shadow-2xl border border-slate-100 overflow-hidden flex flex-col animate-in zoom-in-95 duration-200">
        
        {loading ? (
          <div className="p-8 text-center flex flex-col items-center justify-center">
            <RefreshCw size={32} className="animate-spin text-blue-600 mb-3" />
            <p className="text-xs font-bold text-slate-600">Carregando informações...</p>
          </div>
        ) : error ? (
          <div className="p-6 text-center space-y-3">
            <div className="w-14 h-14 rounded-2xl bg-red-50 text-red-500 flex items-center justify-center mx-auto">
              <AlertCircle size={28} />
            </div>
            <h2 className="text-base font-bold text-slate-800">Aviso</h2>
            <p className="text-xs text-slate-500">{error}</p>
            <p className="text-[11px] font-mono text-slate-400">ID: {code}</p>
          </div>
        ) : acknowledged ? (
          /* Estado Confirmado após clicar em OK */
          <div className="p-8 text-center space-y-4">
            <div className="w-16 h-16 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center mx-auto shadow-sm">
              <CheckCircle2 size={36} />
            </div>
            <div>
              <h2 className="text-lg font-extrabold text-slate-800">Informações Lidas!</h2>
              <p className="text-xs text-slate-500 mt-1">
                Os dados do equipamento foram copiados para a sua área de transferência.
              </p>
            </div>
            <button
              onClick={() => setAcknowledged(false)}
              className="w-full py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-2xl transition-all cursor-pointer"
            >
              Visualizar Novamente
            </button>
          </div>
        ) : (
          <>
            {/* Topo do Alerta */}
            <div className="p-6 pb-4 bg-slate-50/70 border-b border-slate-100 flex flex-col items-center text-center">
              {data.logo_url ? (
                <div className="w-16 h-16 bg-white rounded-2xl p-2 shadow-xs border border-slate-200/80 flex items-center justify-center mb-2.5">
                  <img
                    src={data.logo_url}
                    alt={data.company || "Logo"}
                    className="max-w-full max-h-full object-contain"
                  />
                </div>
              ) : (
                <div className="w-12 h-12 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center mb-2.5">
                  <Laptop size={22} />
                </div>
              )}

              <p className="text-[10px] font-extrabold tracking-widest text-slate-400 uppercase">
                {data.company || "Hotel Fasano Salvador"}
              </p>
              <h1 className="text-base font-black text-slate-900 mt-0.5">
                {data.title}
              </h1>

              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-100 text-[10px] font-bold mt-2">
                <ShieldCheck size={11} />
                <span>Identificação de Equipamento</span>
              </span>
            </div>

            {/* Conteúdo em Lista de Alerta */}
            <div className="p-5 space-y-2.5 text-xs">
              
              {/* Item / Hostname / Patrimônio */}
              <div className="bg-slate-50 p-3 rounded-2xl border border-slate-100 flex items-start gap-2.5">
                <Laptop size={15} className="text-slate-400 shrink-0 mt-0.5" />
                <div>
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Item / Patrimônio</span>
                  <p className="text-xs font-bold text-slate-800">{data.asset_name || data.title}</p>
                </div>
              </div>

              {/* Colaborador / Responsável */}
              {data.collaborator && (
                <div className="bg-slate-50 p-3 rounded-2xl border border-slate-100 flex items-start gap-2.5">
                  <User size={15} className="text-slate-400 shrink-0 mt-0.5" />
                  <div>
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Colaborador / Responsável</span>
                    <p className="text-xs font-bold text-slate-800">{data.collaborator}</p>
                  </div>
                </div>
              )}

              {/* Marca & Modelo */}
              {(data.brand || data.model) && (
                <div className="bg-slate-50 p-3 rounded-2xl border border-slate-100 flex items-start gap-2.5">
                  <Building2 size={15} className="text-slate-400 shrink-0 mt-0.5" />
                  <div>
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Marca / Modelo</span>
                    <p className="text-xs font-semibold text-slate-700">
                      {[data.brand, data.model].filter(Boolean).join(" • ")}
                    </p>
                  </div>
                </div>
              )}

              {/* Endereço / Localização */}
              {data.address && (
                <div className="bg-slate-50 p-3 rounded-2xl border border-slate-100 flex items-start gap-2.5">
                  <MapPin size={15} className="text-slate-400 shrink-0 mt-0.5" />
                  <div>
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Localização</span>
                    <p className="text-xs font-semibold text-slate-700">{data.address}</p>
                  </div>
                </div>
              )}

              {/* Mensagem / Instruções */}
              {data.message && (
                <div className="bg-blue-50/70 border border-blue-100 p-3 rounded-2xl">
                  <div className="flex items-center gap-1.5 text-blue-700 font-bold text-[10px] mb-1">
                    <MessageSquare size={12} />
                    <span>Instruções de Suporte</span>
                  </div>
                  <p className="text-[11px] text-blue-900 leading-relaxed italic">
                    "{data.message}"
                  </p>
                </div>
              )}

              <p className="text-center text-[10px] font-mono text-slate-400 pt-1">
                ID: {data.code}
              </p>
            </div>

            {/* Rodapé com Botão OK de Alerta */}
            <div className="p-4 bg-slate-50 border-t border-slate-100 flex flex-col gap-2">
              <button
                onClick={handleOk}
                className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-2xl text-sm font-extrabold transition-all shadow-md shadow-blue-500/20 cursor-pointer flex items-center justify-center gap-2"
              >
                <span>OK</span>
              </button>

              <button
                onClick={handleCopy}
                className="w-full py-2 text-slate-500 hover:text-slate-800 text-[11px] font-bold flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
              >
                {copied ? (
                  <>
                    <Check size={13} className="text-emerald-600" />
                    <span className="text-emerald-600">Copiado para a Área de Transferência!</span>
                  </>
                ) : (
                  <>
                    <Copy size={13} />
                    <span>Copiar Informações</span>
                  </>
                )}
              </button>
            </div>
          </>
        )}

      </div>
    </div>
  );
}
