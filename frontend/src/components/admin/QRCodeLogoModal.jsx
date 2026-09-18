import { useState, useEffect, useRef } from "react";
import { X, Upload, Image as ImageIcon, CheckCircle2, AlertCircle, RefreshCw } from "lucide-react";
import api from "../../api/client";

export default function QRCodeLogoModal({ isOpen, onClose, onLogoUpdated }) {
  const [currentLogo, setCurrentLogo] = useState(null);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [previewUrl, setPreviewUrl] = useState(null);
  const [selectedFile, setSelectedFile] = useState(null);
  const [errorMsg, setErrorMsg] = useState("");
  const [successMsg, setSuccessMsg] = useState("");
  const fileInputRef = useRef(null);

  useEffect(() => {
    if (isOpen) {
      fetchCurrentLogo();
      setPreviewUrl(null);
      setSelectedFile(null);
      setErrorMsg("");
      setSuccessMsg("");
    }
  }, [isOpen]);

  const fetchCurrentLogo = async () => {
    setLoading(true);
    try {
      const res = await api.get("/qrcodes/logo");
      if (res.data && res.data.default_logo_url) {
        setCurrentLogo(res.data.default_logo_url);
      }
    } catch (err) {
      console.error("Erro ao buscar logo atual:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    if (!file.type.includes("png") && !file.type.includes("jpeg") && !file.type.includes("svg") && !file.type.includes("webp")) {
      setErrorMsg("Por favor, selecione uma imagem válida (PNG transparente recomendado, JPEG ou SVG).");
      return;
    }

    setErrorMsg("");
    setSelectedFile(file);
    const objectUrl = URL.createObjectURL(file);
    setPreviewUrl(objectUrl);
  };

  const handleUpload = async () => {
    if (!selectedFile) return;

    setUploading(true);
    setErrorMsg("");
    setSuccessMsg("");

    try {
      const formData = new FormData();
      formData.append("file", selectedFile);

      const res = await api.post("/qrcodes/logo?set_as_default=true", formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });

      if (res.data && res.data.logo_url) {
        setCurrentLogo(res.data.logo_url);
        setSuccessMsg("Logo cadastrada como padrão com sucesso!");
        if (onLogoUpdated) {
          onLogoUpdated(res.data.logo_url);
        }
        setTimeout(() => {
          onClose();
        }, 1200);
      }
    } catch (err) {
      console.error("Erro ao fazer upload da logo:", err);
      setErrorMsg(err.response?.data?.detail || "Erro ao salvar a logo. Tente novamente.");
    } finally {
      setUploading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white rounded-3xl max-w-md w-full shadow-2xl border border-slate-100 overflow-hidden flex flex-col">
        {/* Header */}
        <div className="px-6 py-5 border-b border-slate-100 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center">
              <ImageIcon size={20} />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-800">Logo Central dos QR Codes</h2>
              <p className="text-xs text-slate-400 font-medium">Cadastre a marca para embutir nos códigos</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-50 rounded-xl transition-all"
          >
            <X size={20} />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 space-y-5">
          {errorMsg && (
            <div className="p-3 bg-red-50 text-red-700 text-xs rounded-xl flex items-center gap-2 border border-red-100">
              <AlertCircle size={16} className="shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {successMsg && (
            <div className="p-3 bg-emerald-50 text-emerald-700 text-xs rounded-xl flex items-center gap-2 border border-emerald-100">
              <CheckCircle2 size={16} className="shrink-0" />
              <span>{successMsg}</span>
            </div>
          )}

          {/* Current Logo vs Preview */}
          <div className="flex flex-col items-center justify-center p-6 bg-slate-50 border-2 border-dashed border-slate-200 rounded-2xl relative">
            {previewUrl || currentLogo ? (
              <div className="relative group flex flex-col items-center">
                <div className="w-28 h-28 bg-white rounded-2xl shadow-sm border border-slate-200 flex items-center justify-center p-3 relative overflow-hidden">
                  <img
                    src={previewUrl || currentLogo}
                    alt="Logo QR Code"
                    className="max-w-full max-h-full object-contain"
                  />
                </div>
                <p className="text-xs font-semibold text-slate-600 mt-2.5">
                  {previewUrl ? "Nova logo selecionada" : "Logo padrão atual"}
                </p>
              </div>
            ) : (
              <div className="flex flex-col items-center text-center">
                <div className="w-16 h-16 rounded-2xl bg-white shadow-sm border border-slate-200 flex items-center justify-center text-slate-300 mb-2">
                  <ImageIcon size={32} />
                </div>
                <p className="text-sm font-semibold text-slate-700">Nenhuma logo cadastrada</p>
                <p className="text-xs text-slate-400 mt-1">Envie uma imagem PNG com fundo transparente</p>
              </div>
            )}

            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileChange}
              accept="image/png, image/jpeg, image/webp, image/svg+xml"
              className="hidden"
            />

            <button
              onClick={() => fileInputRef.current?.click()}
              className="mt-4 px-4 py-2 bg-white hover:bg-slate-100 text-slate-700 text-xs font-bold rounded-xl border border-slate-200 transition-all cursor-pointer flex items-center gap-1.5 shadow-sm"
            >
              <Upload size={14} />
              <span>{previewUrl || currentLogo ? "Escolher Outro Arquivo" : "Selecionar Imagem"}</span>
            </button>
          </div>

          <div className="bg-blue-50/70 p-3.5 rounded-2xl border border-blue-100 text-xs text-blue-800 leading-relaxed">
            <p className="font-bold flex items-center gap-1 mb-1">
              <span>💡</span> Dica de Legibilidade
            </p>
            Para que os celulares leiam o QR Code sem falhas, use arquivos <strong>PNG com fundo transparente</strong>, preferencialmente quadrados (proporção 1:1) com boa definição e contraste.
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 bg-slate-50 border-t border-slate-100 flex items-center justify-end gap-2.5">
          <button
            onClick={onClose}
            className="px-4 py-2.5 text-slate-600 hover:bg-slate-200/60 rounded-xl text-xs font-bold transition-all"
          >
            Cancelar
          </button>
          <button
            onClick={handleUpload}
            disabled={!selectedFile || uploading}
            className={`px-5 py-2.5 rounded-xl text-xs font-bold flex items-center gap-2 transition-all cursor-pointer ${
              selectedFile && !uploading
                ? "bg-blue-600 hover:bg-blue-700 text-white shadow-md shadow-blue-500/20"
                : "bg-slate-200 text-slate-400 cursor-not-allowed"
            }`}
          >
            {uploading ? (
              <>
                <RefreshCw size={14} className="animate-spin" />
                <span>Enviando...</span>
              </>
            ) : (
              <>
                <CheckCircle2 size={14} />
                <span>Salvar como Padrão</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
