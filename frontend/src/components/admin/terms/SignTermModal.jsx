import { useState, useEffect, useRef } from "react";
import SignaturePad from "signature_pad";
import * as faceapi from "@vladmandic/face-api";
import { 
  X, CheckCircle2, AlertCircle, Camera, RefreshCw, 
  Trash2, ShieldCheck, UserCheck, Smartphone, Laptop, 
  Radio, Headphones, Key, Clock, PackageCheck, AlertTriangle
} from "lucide-react";
import api from "../../../api/client";

export default function SignTermModal({ term, isOpen, onClose, onSuccess }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  
  // Signature Pad state
  const canvasRef = useRef(null);
  const signaturePadRef = useRef(null);
  const [hasSignature, setHasSignature] = useState(false);

  // Facial Recognition state
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const [cameraActive, setCameraActive] = useState(false);
  const [cameraLoading, setCameraLoading] = useState(true);
  const [modelsLoaded, setModelsLoaded] = useState(false);
  const [faceDetected, setFaceDetected] = useState(false);
  const [faceConfidence, setFaceConfidence] = useState(null);
  const [capturedPhoto, setCapturedPhoto] = useState(null);
  const [cameraError, setCameraError] = useState(null);
  const detectionIntervalRef = useRef(null);

  // Inicializa modelos do face-api
  useEffect(() => {
    let isMounted = true;

    async function loadModels() {
      try {
        setCameraLoading(true);
        // Carrega modelos a partir do diretório /models na pasta public do Vite
        const MODEL_URL = "/models";
        await Promise.all([
          faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URL),
          faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_URL),
        ]);
        if (isMounted) {
          setModelsLoaded(true);
        }
      } catch (err) {
        console.warn("[FaceAPI] Aviso ao carregar modelos neurais:", err);
        // Continua mesmo se houver falha de rede para permitir captura de foto simples
        if (isMounted) setModelsLoaded(false);
      } finally {
        if (isMounted) setCameraLoading(false);
      }
    }

    if (isOpen) {
      loadModels();
    }

    return () => {
      isMounted = false;
    };
  }, [isOpen]);

  // Inicializa Câmera
  useEffect(() => {
    if (!isOpen) {
      stopCamera();
      return;
    }

    startCamera();

    return () => {
      stopCamera();
    };
  }, [isOpen]);

  async function startCamera() {
    try {
      setCameraError(null);
      setCameraLoading(true);
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: "user",
          width: { ideal: 640 },
          height: { ideal: 480 },
        },
        audio: false,
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play();
        setCameraActive(true);
      }
    } catch (err) {
      console.error("[Camera] Erro ao acessar webcam/câmera do tablet:", err);
      setCameraError("Não foi possível acessar a câmera do dispositivo. Verifique as permissões do navegador.");
    } finally {
      setCameraLoading(false);
    }
  }

  function stopCamera() {
    if (detectionIntervalRef.current) {
      clearInterval(detectionIntervalRef.current);
      detectionIntervalRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    setCameraActive(false);
    setFaceDetected(false);
  }

  // Loop de detecção facial em tempo real
  useEffect(() => {
    if (!cameraActive || !modelsLoaded || capturedPhoto) return;

    detectionIntervalRef.current = setInterval(async () => {
      if (videoRef.current && !videoRef.current.paused && !videoRef.current.ended) {
        try {
          const detection = await faceapi.detectSingleFace(
            videoRef.current,
            new faceapi.TinyFaceDetectorOptions({ inputSize: 224, scoreThreshold: 0.5 })
          );

          if (detection) {
            setFaceDetected(true);
            setFaceConfidence(Math.round(detection.score * 100));
          } else {
            setFaceDetected(false);
            setFaceConfidence(null);
          }
        } catch {
          // Ignore transient frame errors
        }
      }
    }, 400);

    return () => {
      if (detectionIntervalRef.current) {
        clearInterval(detectionIntervalRef.current);
      }
    };
  }, [cameraActive, modelsLoaded, capturedPhoto]);

  // Inicializa Signature Pad
  useEffect(() => {
    if (!isOpen || !canvasRef.current) return;

    const canvas = canvasRef.current;
    
    // Configura resolução retina/hi-dpi no canvas para assinatura nítida
    const ratio = Math.max(window.devicePixelRatio || 1, 1);
    canvas.width = canvas.offsetWidth * ratio;
    canvas.height = canvas.offsetHeight * ratio;
    const ctx = canvas.getContext("2d");
    ctx.scale(ratio, ratio);

    const pad = new SignaturePad(canvas, {
      backgroundColor: "rgb(255, 255, 255)",
      penColor: "rgb(15, 23, 42)", // Slate-900 elegante
      minWidth: 1.5,
      maxWidth: 3.5,
    });

    pad.addEventListener("afterUpdateStroke", () => {
      setHasSignature(!pad.isEmpty());
    });

    signaturePadRef.current = pad;

    return () => {
      if (signaturePadRef.current) {
        signaturePadRef.current.off();
        signaturePadRef.current = null;
      }
    };
  }, [isOpen]);

  const handleClearSignature = () => {
    if (signaturePadRef.current) {
      signaturePadRef.current.clear();
      setHasSignature(false);
    }
  };

  const handleCapturePhoto = () => {
    if (!videoRef.current) return;
    const video = videoRef.current;
    const tempCanvas = document.createElement("canvas");
    tempCanvas.width = video.videoWidth || 640;
    tempCanvas.height = video.videoHeight || 480;
    const ctx = tempCanvas.getContext("2d");
    ctx.drawImage(video, 0, 0, tempCanvas.width, tempCanvas.height);
    const dataUrl = tempCanvas.toDataURL("image/jpeg", 0.85);
    setCapturedPhoto(dataUrl);
    stopCamera();
  };

  const handleRetakePhoto = () => {
    setCapturedPhoto(null);
    setFaceDetected(false);
    setFaceConfidence(null);
    startCamera();
  };

  const handleSubmit = async () => {
    if (!signaturePadRef.current || signaturePadRef.current.isEmpty()) {
      setError("Por favor, faça a assinatura na tela antes de confirmar.");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const signatureData = signaturePadRef.current.toDataURL("image/png");
      
      let photoData = capturedPhoto;
      // Se não tirou snapshot manual antes, tira agora se a câmera estiver ligada
      if (!photoData && videoRef.current && cameraActive) {
        const video = videoRef.current;
        const tempCanvas = document.createElement("canvas");
        tempCanvas.width = video.videoWidth || 640;
        tempCanvas.height = video.videoHeight || 480;
        const ctx = tempCanvas.getContext("2d");
        ctx.drawImage(video, 0, 0, tempCanvas.width, tempCanvas.height);
        photoData = tempCanvas.toDataURL("image/jpeg", 0.85);
      }

      const payload = {
        signature_data: signatureData,
        facial_photo_data: photoData || null,
        facial_verified: Boolean(faceDetected || photoData),
        facial_confidence: faceConfidence ? faceConfidence / 100 : null,
        signer_device: `${navigator.userAgent} (${window.innerWidth}x${window.innerHeight})`,
      };

      await api.post(`/terms/${term.id}/sign`, payload);

      stopCamera();
      if (onSuccess) onSuccess();
      onClose();
    } catch (err) {
      console.error("Erro ao registrar assinatura do termo:", err);
      setError(err.response?.data?.detail || "Erro ao salvar assinatura e foto do termo.");
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen || !term) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/80 backdrop-blur-sm overflow-y-auto">
      <div className="bg-white w-full max-w-4xl rounded-3xl shadow-2xl border border-slate-200 overflow-hidden my-auto flex flex-col max-h-[92vh]">
        
        {/* Header Superior */}
        <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-blue-900 text-white px-6 py-4 flex items-center justify-between border-b border-slate-700">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-500/20 border border-blue-400/30 flex items-center justify-center text-blue-300">
              <ShieldCheck size={24} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-blue-500/30 text-blue-200 border border-blue-400/30">
                  {term.term_number}
                </span>
                <h3 className="font-bold text-base sm:text-lg">Assinatura Eletrônica & Validação Biométrica</h3>
              </div>
              <p className="text-xs text-slate-300">
                Beneficiário: <strong className="text-white">{term.beneficiary_name}</strong> • Setor: {term.department_name || "Geral"}
              </p>
            </div>
          </div>
          <button 
            onClick={() => { stopCamera(); onClose(); }}
            className="text-slate-400 hover:text-white p-2 rounded-xl hover:bg-white/10 transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        {/* Conteúdo com Scroll */}
        <div className="p-5 sm:p-6 overflow-y-auto space-y-6 flex-1 text-slate-800">
          {error && (
            <div className="p-4 rounded-2xl bg-red-50 border border-red-200 text-red-700 text-sm flex items-center gap-3">
              <AlertCircle size={20} className="shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Resumo dos Itens Retirados */}
          <div className="bg-slate-50 rounded-2xl p-4 border border-slate-200">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
                <PackageCheck size={16} className="text-blue-600" />
                Equipamentos a serem retirados ({term.items?.length || 0})
              </span>
              <span className="text-xs text-slate-500 font-medium">
                Técnico Emissor: <strong>{term.technician_name}</strong>
              </span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {term.items?.map((item) => (
                <div key={item.id} className="bg-white p-3 rounded-xl border border-slate-200 flex items-start gap-3 shadow-sm">
                  <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center shrink-0 mt-0.5">
                    {item.item_name.toLowerCase().includes("fone") ? <Headphones size={18} /> :
                     item.item_name.toLowerCase().includes("rádio") || item.item_name.toLowerCase().includes("radio") ? <Radio size={18} /> :
                     item.item_name.toLowerCase().includes("celular") ? <Smartphone size={18} /> :
                     item.item_name.toLowerCase().includes("notebook") ? <Laptop size={18} /> :
                     item.item_name.toLowerCase().includes("chave") ? <Key size={18} /> :
                     item.item_name.toLowerCase().includes("relógio") || item.item_name.toLowerCase().includes("relogio") ? <Clock size={18} /> :
                     <PackageCheck size={18} />}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="font-bold text-sm text-slate-900 truncate">{item.item_name}</p>
                    <div className="flex flex-wrap items-center gap-x-2 text-xs text-slate-500">
                      {item.asset_tag && <span>Pat: <strong>{item.asset_tag}</strong></span>}
                      {item.serial_number && <span>S/N: <strong>{item.serial_number}</strong></span>}
                      <span>Qtd: <strong>{item.quantity}</strong></span>
                    </div>
                    {item.accessories && (
                      <p className="text-[11px] text-slate-400 truncate mt-0.5">Acessórios: {item.accessories}</p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Declaração e Termo Legal */}
          <div className="border border-slate-200 rounded-2xl p-3.5 bg-slate-50/50 text-xs text-slate-600 leading-relaxed max-h-28 overflow-y-auto">
            <p className="font-semibold text-slate-800 mb-1">Declaração de Responsabilidade:</p>
            {term.legal_text}
          </div>

          {/* Grid Principal: Câmera + Assinatura */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            
            {/* CÂMERA & RECONHECIMENTO FACIAL */}
            <div className="flex flex-col">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                  <Camera size={16} className="text-blue-600" />
                  1. Validação Facial (Câmera)
                </span>
                {faceDetected && !capturedPhoto && (
                  <span className="text-[11px] font-bold text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-full flex items-center gap-1">
                    <CheckCircle2 size={12} />
                    Rosto detectado ({faceConfidence}%)
                  </span>
                )}
              </div>

              <div className="relative aspect-[4/3] bg-slate-900 rounded-2xl overflow-hidden border-2 border-slate-200 flex items-center justify-center shadow-inner group">
                {capturedPhoto ? (
                  <div className="relative w-full h-full">
                    <img src={capturedPhoto} alt="Foto Capturada" className="w-full h-full object-cover" />
                    <div className="absolute top-2 right-2 bg-emerald-600 text-white text-[11px] font-bold px-2.5 py-1 rounded-full shadow flex items-center gap-1">
                      <CheckCircle2 size={12} />
                      Foto Registrada
                    </div>
                  </div>
                ) : (
                  <>
                    <video 
                      ref={videoRef} 
                      autoPlay 
                      playsInline 
                      muted 
                      className={`w-full h-full object-cover ${cameraActive ? "block" : "hidden"} transform -scale-x-100`} 
                    />
                    
                    {/* Guia visual de enquadramento facial */}
                    {cameraActive && (
                      <div className={`absolute inset-0 flex items-center justify-center pointer-events-none transition-all ${
                        faceDetected ? "border-4 border-emerald-500/80 bg-emerald-500/5" : "border-2 border-dashed border-amber-400/80"
                      }`}>
                        <div className={`w-40 h-52 sm:w-48 sm:h-60 rounded-[50%] border-2 transition-all ${
                          faceDetected ? "border-emerald-400 shadow-[0_0_20px_rgba(16,185,129,0.5)]" : "border-amber-300/70"
                        }`} />
                        <span className={`absolute bottom-3 text-xs font-semibold px-3 py-1 rounded-full backdrop-blur-md ${
                          faceDetected ? "bg-emerald-950/80 text-emerald-200" : "bg-slate-900/80 text-amber-200"
                        }`}>
                          {faceDetected ? "✓ Rosto alinhado e verificado" : "Posicione o rosto do colaborador aqui"}
                        </span>
                      </div>
                    )}

                    {cameraLoading && (
                      <div className="text-center p-4 text-slate-400">
                        <RefreshCw size={28} className="animate-spin mx-auto mb-2 text-blue-400" />
                        <p className="text-xs">Ativando câmera e IA neural...</p>
                      </div>
                    )}

                    {cameraError && (
                      <div className="text-center p-4 text-amber-300 max-w-xs">
                        <AlertTriangle size={28} className="mx-auto mb-2 text-amber-400" />
                        <p className="text-xs">{cameraError}</p>
                      </div>
                    )}
                  </>
                )}
              </div>

              {/* Botões da Câmera */}
              <div className="flex items-center justify-between mt-2.5">
                {capturedPhoto ? (
                  <button
                    type="button"
                    onClick={handleRetakePhoto}
                    className="text-xs font-semibold text-slate-600 hover:text-blue-600 flex items-center gap-1 py-1 px-2.5 rounded-lg border border-slate-200 hover:bg-slate-50 cursor-pointer"
                  >
                    <RefreshCw size={14} />
                    Tirar outra foto
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={handleCapturePhoto}
                    disabled={!cameraActive}
                    className="text-xs font-semibold text-blue-700 bg-blue-50 hover:bg-blue-100 flex items-center gap-1.5 py-1.5 px-3 rounded-lg border border-blue-200 disabled:opacity-50 cursor-pointer transition-colors"
                  >
                    <Camera size={14} />
                    Congelar Foto Facial
                  </button>
                )}
                <span className="text-[11px] text-slate-400 italic">
                  Foto salva com carimbo e IP
                </span>
              </div>
            </div>

            {/* ASSINATURA DIGITAL NA TELA (SIGNATURE PAD) */}
            <div className="flex flex-col">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                  <UserCheck size={16} className="text-blue-600" />
                  2. Assinatura na Tela (Dedo ou Caneta)
                </span>
                {hasSignature && (
                  <span className="text-[11px] font-bold text-blue-700 bg-blue-100 px-2 py-0.5 rounded-full flex items-center gap-1">
                    <CheckCircle2 size={12} />
                    Assinado
                  </span>
                )}
              </div>

              <div className="relative aspect-[4/3] bg-white rounded-2xl overflow-hidden border-2 border-slate-300 shadow-inner flex flex-col justify-between">
                <canvas
                  ref={canvasRef}
                  className="w-full h-full touch-none cursor-crosshair"
                />
                {!hasSignature && (
                  <div className="absolute inset-0 flex items-center justify-center pointer-events-none text-slate-400 text-sm">
                    <span className="bg-slate-100/90 px-4 py-1.5 rounded-full font-medium shadow-sm">
                      ✍️ Assine aqui na tela
                    </span>
                  </div>
                )}
                <div className="absolute bottom-2 left-4 right-4 pointer-events-none border-b border-dashed border-slate-300 pb-1 flex justify-between text-[10px] text-slate-400">
                  <span>Assinatura do Beneficiário</span>
                  <span>{term.beneficiary_name}</span>
                </div>
              </div>

              {/* Botão Limpar */}
              <div className="flex items-center justify-between mt-2.5">
                <button
                  type="button"
                  onClick={handleClearSignature}
                  disabled={!hasSignature}
                  className="text-xs font-semibold text-slate-600 hover:text-red-600 flex items-center gap-1 py-1 px-2.5 rounded-lg border border-slate-200 hover:bg-slate-50 disabled:opacity-40 cursor-pointer transition-colors"
                >
                  <Trash2 size={14} />
                  Limpar Assinatura
                </button>
                <span className="text-[11px] text-slate-400">
                  Validação jurídica interna
                </span>
              </div>
            </div>

          </div>
        </div>

        {/* Rodapé de Ações */}
        <div className="bg-slate-50 px-6 py-4 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="text-xs text-slate-500 text-center sm:text-left">
            Ao clicar em confirmar, o termo será registrado com validade de entrega.
          </div>
          <div className="flex items-center gap-3 w-full sm:w-auto">
            <button
              type="button"
              onClick={() => { stopCamera(); onClose(); }}
              className="flex-1 sm:flex-none px-4 py-2.5 rounded-xl border border-slate-300 text-slate-700 font-semibold text-sm hover:bg-slate-100 transition-colors cursor-pointer"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={handleSubmit}
              disabled={loading || !hasSignature}
              className="flex-1 sm:flex-none px-6 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-sm shadow-md shadow-blue-500/20 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 cursor-pointer transition-all"
            >
              {loading ? (
                <>
                  <RefreshCw size={18} className="animate-spin" />
                  Gravando Termo...
                </>
              ) : (
                <>
                  <CheckCircle2 size={18} />
                  Confirmar e Registrar Aceite
                </>
              )}
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}
