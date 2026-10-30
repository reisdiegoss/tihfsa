import { useState, useEffect } from "react";
import { useParams, Link } from "react-router-dom";
import {
  Laptop,
  User,
  MapPin,
  Tag,
  AlertTriangle,
  RefreshCw,
  ShieldCheck,
  Server,
  Cpu,
} from "lucide-react";
import api from "../../api/client";

export default function PublicAssetTag() {
  const { code } = useParams();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

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

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950 text-slate-100 flex flex-col justify-between font-sans selection:bg-amber-500 selection:text-slate-950">
      
      {/* ======================================================== */}
      {/* TOPO: IDENTIDADE VISUAL FASANO                           */}
      {/* ======================================================== */}
      <header className="border-b border-slate-800/80 bg-slate-950/70 backdrop-blur-md px-4 py-4 sticky top-0 z-30">
        <div className="max-w-2xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-amber-500 to-amber-700 flex items-center justify-center text-slate-950 font-black shadow-lg shadow-amber-500/20">
              <span className="text-sm font-serif tracking-tighter">HF</span>
            </div>
            <div>
              <h1 className="text-xs font-bold uppercase tracking-widest text-amber-400">
                Hotel Fasano Salvador
              </h1>
              <p className="text-[11px] text-slate-400 font-medium">
                Central de Tecnologia & Gestão Patrimonial
              </p>
            </div>
          </div>

          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
            Ativo Verificado
          </span>
        </div>
      </header>

      {/* ======================================================== */}
      {/* CONTEÚDO PRINCIPAL: FICHA DO EQUIPAMENTO                 */}
      {/* ======================================================== */}
      <main className="flex-1 max-w-2xl w-full mx-auto p-4 sm:p-6 space-y-5 my-auto">
        
        {/* Loading */}
        {loading && (
          <div className="bg-slate-900/80 border border-slate-800 rounded-3xl p-10 flex flex-col items-center justify-center text-center space-y-4 shadow-2xl">
            <RefreshCw className="w-8 h-8 text-amber-400 animate-spin" />
            <div>
              <p className="text-sm font-bold text-white">Carregando Informações do Equipamento...</p>
              <p className="text-xs text-slate-400 mt-1">Consultando base de ativos do fassa29</p>
            </div>
          </div>
        )}

        {/* Erro */}
        {!loading && error && (
          <div className="bg-slate-900/90 border border-rose-500/40 rounded-3xl p-8 text-center space-y-4 shadow-2xl">
            <div className="w-12 h-12 rounded-full bg-rose-500/20 text-rose-400 flex items-center justify-center mx-auto">
              <AlertTriangle className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white">Código Não Localizado</h2>
              <p className="text-xs text-slate-400 max-w-sm mx-auto mt-1">
                {error}
              </p>
            </div>
            <div className="pt-2 flex justify-center gap-3">
              <button
                onClick={() => window.location.reload()}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-xs font-semibold rounded-xl text-white transition cursor-pointer"
              >
                Tentar Novamente
              </button>
            </div>
          </div>
        )}

        {/* Dados do Equipamento Carregados */}
        {!loading && data && (
          <div className="space-y-4 animate-in fade-in zoom-in-98 duration-200">
            
            {/* Card Principal */}
            <div className="bg-slate-900/90 border border-slate-800 rounded-3xl p-5 sm:p-7 shadow-2xl space-y-5">
              
              {/* Topo do Card: Título & Patrimônio */}
              <div className="border-b border-slate-800/80 pb-4">
                <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
                  <span className="text-[10px] font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-md bg-amber-500/10 text-amber-300 border border-amber-500/30">
                    Ficha Técnica de TI
                  </span>
                  <div className="flex items-center gap-1.5 font-mono text-xs bg-slate-950 px-2.5 py-1 rounded-lg border border-slate-800 text-slate-300">
                    <Tag className="w-3.5 h-3.5 text-amber-400" />
                    <span>Patrimônio: <strong className="text-white">{data.code}</strong></span>
                  </div>
                </div>

                <h2 className="text-xl sm:text-2xl font-bold text-white tracking-tight">
                  {data.asset_name || data.title}
                </h2>
                <p className="text-xs text-slate-400 mt-1 font-medium">
                  {data.company || "Hotel Fasano Salvador"}
                </p>
              </div>

              {/* Grid de Especificações */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                
                {/* Responsável */}
                <div className="bg-slate-950/60 border border-slate-800/90 rounded-2xl p-3.5 flex items-start gap-3">
                  <div className="p-2 rounded-xl bg-blue-500/10 text-blue-400 border border-blue-500/20 shrink-0">
                    <User className="w-4 h-4" />
                  </div>
                  <div>
                    <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider block">
                      Responsável / Alocação
                    </span>
                    <span className="text-xs font-semibold text-white mt-0.5 block">
                      {data.collaborator || "Uso Coletivo / Setor"}
                    </span>
                  </div>
                </div>

                {/* Localização Física */}
                <div className="bg-slate-950/60 border border-slate-800/90 rounded-2xl p-3.5 flex items-start gap-3">
                  <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 shrink-0">
                    <MapPin className="w-4 h-4" />
                  </div>
                  <div>
                    <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider block">
                      Localização Física
                    </span>
                    <span className="text-xs font-semibold text-white mt-0.5 block">
                      {data.address || "Hotel Fasano Salvador"}
                    </span>
                  </div>
                </div>

                {/* Marca & Modelo */}
                <div className="bg-slate-950/60 border border-slate-800/90 rounded-2xl p-3.5 flex items-start gap-3">
                  <div className="p-2 rounded-xl bg-purple-500/10 text-purple-400 border border-purple-500/20 shrink-0">
                    <Laptop className="w-4 h-4" />
                  </div>
                  <div>
                    <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider block">
                      Marca & Modelo
                    </span>
                    <span className="text-xs font-semibold text-white mt-0.5 block">
                      {[data.brand, data.model].filter(Boolean).join(" • ") || "Padrão Corporativo"}
                    </span>
                  </div>
                </div>

                {/* Categoria / Tipo */}
                <div className="bg-slate-950/60 border border-slate-800/90 rounded-2xl p-3.5 flex items-start gap-3">
                  <div className="p-2 rounded-xl bg-amber-500/10 text-amber-400 border border-amber-500/20 shrink-0">
                    <Server className="w-4 h-4" />
                  </div>
                  <div>
                    <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider block">
                      Tipo / Categoria
                    </span>
                    <span className="text-xs font-semibold text-white mt-0.5 block">
                      {data.asset_type || "Equipamento de TI"}
                    </span>
                  </div>
                </div>

                {/* Serial / Service Tag (se houver) */}
                {data.serial_number && (
                  <div className="bg-slate-950/60 border border-slate-800/90 rounded-2xl p-3.5 flex items-start gap-3 sm:col-span-2">
                    <div className="p-2 rounded-xl bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 shrink-0">
                      <Cpu className="w-4 h-4" />
                    </div>
                    <div>
                      <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider block">
                        Número de Série / Service Tag
                      </span>
                      <span className="text-xs font-mono font-semibold text-cyan-300 mt-0.5 block">
                        {data.serial_number}
                      </span>
                    </div>
                  </div>
                )}
              </div>

              {/* Mensagem / Orientações do Suporte */}
              {data.message && (
                <div className="p-4 bg-amber-950/20 border border-amber-500/30 rounded-2xl space-y-1">
                  <div className="flex items-center gap-1.5 text-xs font-bold text-amber-300 uppercase tracking-wide">
                    <span>Instruções & Orientações</span>
                  </div>
                  <p className="text-xs text-amber-100/90 leading-relaxed whitespace-pre-wrap">
                    "{data.message}"
                  </p>
                </div>
              )}

            </div>

          </div>
        )}
      </main>

      {/* ======================================================== */}
      {/* RODAPÉ PÚBLICO                                           */}
      {/* ======================================================== */}
      <footer className="border-t border-slate-800/80 bg-slate-950/80 px-4 py-4 text-center text-[11px] text-slate-500">
        <p className="max-w-md mx-auto">
          TIHFSA • Sistema de Gestão de Tecnologia da Informação do Hotel Fasano Salvador.
          Todos os direitos reservados.
        </p>
      </footer>

    </div>
  );
}
