import { useState, useEffect } from "react";

/**
 * Detecta se o dispositivo é iOS (iPhone, iPad, iPod)
 */
export function isIOS() {
  if (typeof window === "undefined" || typeof navigator === "undefined") return false;
  return (
    /iPad|iPhone|iPod/.test(navigator.userAgent) ||
    (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1)
  );
}

/**
 * Componente que renderiza com fidelidade absoluta:
 * - Imagem 2: Cupertino Alert Dialog (iOS)
 * - Imagem 3: Material 3 Alert Dialog (Android)
 */
export default function NativeAlertDialog({
  isOpen = true,
  title = "Aviso",
  message = "",
  okText = "OK",
  onOk,
  forcePlatform = null, // null (auto-detect) | "ios" | "android"
  showPlatformToggle = true,
}) {
  const [platform, setPlatform] = useState(() => {
    if (forcePlatform) return forcePlatform;
    return isIOS() ? "ios" : "android";
  });

  useEffect(() => {
    if (forcePlatform) {
      setPlatform(forcePlatform);
    }
  }, [forcePlatform]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[9999] flex flex-col items-center justify-center p-4 select-none animate-in fade-in duration-150">
      
      {/* Backdrop */}
      <div 
        className={`absolute inset-0 transition-opacity ${
          platform === "ios" ? "bg-black/45 backdrop-blur-[2px]" : "bg-black/60"
        }`} 
        onClick={onOk}
      />

      {/* Seletor sutil no topo para alternar entre visual iOS e Android */}
      {showPlatformToggle && (
        <div className="relative z-20 mb-6 bg-black/60 backdrop-blur-md px-3 py-1.5 rounded-full border border-white/20 flex items-center gap-2 shadow-lg">
          <span className="text-[10px] font-bold text-white/70">Estilo:</span>
          <button
            type="button"
            onClick={() => setPlatform("ios")}
            className={`px-2.5 py-0.5 rounded-full text-[10px] font-extrabold transition-all cursor-pointer ${
              platform === "ios" 
                ? "bg-white text-slate-900 shadow-sm" 
                : "text-white/70 hover:text-white"
            }`}
          >
            🍎 iOS (Cupertino)
          </button>
          <button
            type="button"
            onClick={() => setPlatform("android")}
            className={`px-2.5 py-0.5 rounded-full text-[10px] font-extrabold transition-all cursor-pointer ${
              platform === "android" 
                ? "bg-emerald-500 text-white shadow-sm" 
                : "text-white/70 hover:text-white"
            }`}
          >
            🤖 Android (Material)
          </button>
        </div>
      )}

      {/* ========================================================= */}
      {/* 🍎 MODAL NATIVO DO IOS (CUPERTINO ALERT DIALOG - IMAGEM 2) */}
      {/* ========================================================= */}
      {platform === "ios" ? (
        <div 
          className="relative z-10 w-[270px] bg-[#f2f2f2]/95 dark:bg-[#252525]/95 backdrop-blur-xl rounded-[14px] overflow-hidden shadow-2xl border border-white/30 text-center animate-in zoom-in-95 duration-150"
          style={{ fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Text', 'SF Pro Display', 'Helvetica Neue', Helvetica, Arial, sans-serif" }}
        >
          {/* Conteúdo do Alerta */}
          <div className="px-4 pt-5 pb-4">
            <h3 className="text-[17px] font-semibold text-black dark:text-white tracking-tight leading-snug">
              {title}
            </h3>
            <div className="text-[13px] text-black/85 dark:text-white/85 mt-1.5 leading-relaxed whitespace-pre-wrap max-h-72 overflow-y-auto font-normal">
              {message}
            </div>
          </div>

          {/* Botão de Ação Único "OK" com separador fino estilo Apple */}
          <div className="border-t border-[#3c3c43]/30 dark:border-white/20">
            <button
              type="button"
              onClick={onOk}
              className="w-full py-3 text-[17px] font-semibold text-[#007aff] dark:text-[#0a84ff] hover:bg-black/5 active:bg-[#d5d5d5]/60 transition-colors cursor-pointer"
            >
              {okText}
            </button>
          </div>
        </div>
      ) : (
        /* ========================================================= */
        /* 🤖 MODAL NATIVO DO ANDROID (MATERIAL ALERT DIALOG - IMAGEM 3) */
        /* ========================================================= */
        <div 
          className="relative z-10 w-[312px] bg-white dark:bg-[#1e1e24] rounded-[28px] p-6 shadow-2xl flex flex-col text-left animate-in zoom-in-95 duration-150 border border-slate-100 dark:border-slate-800"
          style={{ fontFamily: "'Roboto', 'Segoe UI', Tahoma, sans-serif" }}
        >
          {/* Título Alinhado à Esquerda */}
          <h3 className="text-xl font-bold text-[#1f1f1f] dark:text-white leading-snug">
            {title}
          </h3>

          {/* Mensagem Alinhada à Esquerda */}
          <div className="text-sm text-[#444746] dark:text-slate-300 mt-3.5 leading-relaxed whitespace-pre-wrap max-h-72 overflow-y-auto">
            {message}
          </div>

          {/* Botão "OK" no Canto Inferior Direito estilo Material */}
          <div className="mt-6 flex items-center justify-end">
            <button
              type="button"
              onClick={onOk}
              className="px-5 py-2.5 rounded-full text-sm font-bold text-[#6750a4] dark:text-[#d0bcff] hover:bg-[#6750a4]/10 active:bg-[#6750a4]/20 transition-all cursor-pointer"
            >
              {okText}
            </button>
          </div>
        </div>
      )}

    </div>
  );
}
