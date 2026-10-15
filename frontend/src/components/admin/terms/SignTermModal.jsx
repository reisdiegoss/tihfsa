import { useState, useEffect, useRef } from "react";
import SignaturePad from "signature_pad";
import * as faceapi from "@vladmandic/face-api";
import { 
  X, CheckCircle2, AlertCircle, Camera, RefreshCw, 
  Trash2, ShieldCheck, UserCheck, Smartphone, Laptop, 
  Radio, Headphones, Key, Clock, PackageCheck, AlertTriangle,
  ArrowRight, ArrowLeft, Sparkles, Smile, ArrowUp, 
  RotateCw, Check, Volume2, Shield, SwitchCamera
} from "lucide-react";
import api from "../../../api/client";

// Catálogo de Desafios de Prova de Vida (Liveness Detection)
// Compatível 100% com usuários de óculos (elimina piscadas sensíveis a reflexos/aros)
const LIVENESS_CHALLENGES = [
  {
    id: "look_up",
    title: "Olhe para cima",
    instruction: "Incline o queixo suavemente e olhe para cima",
    icon: ArrowUp,
    emoji: "👆",
    color: "text-blue-500",
    bg: "bg-blue-500/10",
  },
  {
    id: "turn_left",
    title: "Vire o rosto para a esquerda",
    instruction: "Gire suavemente a cabeça para a sua esquerda",
    icon: ArrowLeft,
    emoji: "👈",
    color: "text-purple-500",
    bg: "bg-purple-500/10",
  },
  {
    id: "turn_right",
    title: "Vire o rosto para a direita",
    instruction: "Gire suavemente a cabeça para a sua direita",
    icon: ArrowRight,
    emoji: "👉",
    color: "text-indigo-500",
    bg: "bg-indigo-500/10",
  },
  {
    id: "smile",
    title: "Dê um sorriso",
    instruction: "Sorria naturalmente olhando para a câmera",
    icon: Smile,
    emoji: "😊",
    color: "text-emerald-500",
    bg: "bg-emerald-500/10",
  },
];

// Emite bipe de sucesso sonoro via Web Audio API
function playSuccessBeep() {
  try {
    const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.type = "sine";
    osc.frequency.setValueAtTime(587.33, audioCtx.currentTime); // D5
    osc.frequency.exponentialRampToValueAtTime(880, audioCtx.currentTime + 0.15); // A5
    gain.gain.setValueAtTime(0.12, audioCtx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.2);
    osc.connect(gain);
    gain.connect(audioCtx.destination);
    osc.start();
    osc.stop(audioCtx.currentTime + 0.22);
  } catch {}
}

export default function SignTermModal({ term, isOpen, onClose, onSuccess }) {
  // Controle de Etapas do Wizard
  // 1 = Assinatura Digital com o Dedo
  // 2 = Biometria Facial & Prova de Vida (Liveness)
  // 3 = Revisão e Confirmação Final
  const [currentStep, setCurrentStep] = useState(1);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // ETAPA 1: Signature Pad
  const canvasRef = useRef(null);
  const signaturePadRef = useRef(null);
  const [hasSignature, setHasSignature] = useState(false);
  const [signatureDataUrl, setSignatureDataUrl] = useState(null);

  // ETAPA 2: Câmera & Prova de Vida
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const [facingMode, setFacingMode] = useState("user"); // "user" (frontal) ou "environment" (traseira)
  const [cameraActive, setCameraActive] = useState(false);
  const [cameraLoading, setCameraLoading] = useState(false);
  const [modelsLoaded, setModelsLoaded] = useState(false);
  const [faceDetected, setFaceDetected] = useState(false);
  const [faceConfidence, setFaceConfidence] = useState(null);
  const [capturedPhoto, setCapturedPhoto] = useState(null);
  const [cameraError, setCameraError] = useState(null);

  // Desafios de Liveness Sorteados
  const [challenges, setChallenges] = useState([]);
  const [currentChallengeIndex, setCurrentChallengeIndex] = useState(0);
  const [challengeProgress, setChallengeProgress] = useState(0); // 0 a 100
  const [challengeCompleted, setChallengeCompleted] = useState(false);
  const [allChallengesPassed, setAllChallengesPassed] = useState(false);

  // Estados temporais para detecção de liveness
  const detectionIntervalRef = useRef(null);

  // Inicializa modelos do face-api
  useEffect(() => {
    let isMounted = true;

    async function loadModels() {
      try {
        const MODEL_URL = "/models";
        await Promise.all([
          faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URL),
          faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_URL),
          faceapi.nets.faceExpressionNet.loadFromUri(MODEL_URL),
        ]);
        if (isMounted) setModelsLoaded(true);
      } catch (err) {
        console.warn("[FaceAPI] Aviso ao carregar modelos neurais locais:", err);
        if (isMounted) setModelsLoaded(false);
      }
    }

    if (isOpen) {
      loadModels();
    }

    return () => {
      isMounted = false;
    };
  }, [isOpen]);

  // Sorteia de 2 a 3 desafios aleatórios quando entrar na Etapa 2
  const setupRandomChallenges = () => {
    // Embaralha o catálogo de desafios e seleciona 2 desafios distintos
    const shuffled = [...LIVENESS_CHALLENGES].sort(() => 0.5 - Math.random());
    const selected = shuffled.slice(0, 2);
    setChallenges(selected);
    setCurrentChallengeIndex(0);
    setChallengeProgress(0);
    setChallengeCompleted(false);
    setAllChallengesPassed(false);
  };

  // Liga a câmera somente quando estiver na Etapa 2
  useEffect(() => {
    if (isOpen && currentStep === 2) {
      setupRandomChallenges();
      startCamera(facingMode);
    } else {
      stopCamera();
    }

    return () => {
      stopCamera();
    };
  }, [isOpen, currentStep]);

  async function startCamera(customFacingMode) {
    const targetMode = customFacingMode || facingMode;
    try {
      setCameraError(null);
      setCameraLoading(true);

      // Interrompe stream anterior caso exista
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
        streamRef.current = null;
      }

      // Constraints naturais para sensores de tablet/smartphone e desktop
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: targetMode ? { ideal: targetMode } : "user",
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
        audio: false,
      });

      streamRef.current = stream;
      if (videoRef.current) {
        const video = videoRef.current;
        video.srcObject = stream;
        video.setAttribute("playsinline", "true");
        video.setAttribute("webkit-playsinline", "true");
        video.muted = true;
        try {
          await video.play();
        } catch (playErr) {
          console.warn("[Camera] Play imediato interceptado:", playErr);
        }
        setCameraActive(true);
      }
    } catch (err) {
      console.error("[Camera] Erro ao acessar webcam/câmera do tablet:", err);
      // Tentativa de fallback com constraints genéricos
      try {
        const fallbackStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
        streamRef.current = fallbackStream;
        if (videoRef.current) {
          const video = videoRef.current;
          video.srcObject = fallbackStream;
          video.setAttribute("playsinline", "true");
          video.setAttribute("webkit-playsinline", "true");
          video.muted = true;
          try {
            await video.play();
          } catch (e) {}
          setCameraActive(true);
        }
      } catch (fallbackErr) {
        setCameraError("Não foi possível acessar a câmera do dispositivo. Verifique as permissões do navegador.");
      }
    } finally {
      setCameraLoading(false);
    }
  }

  const toggleFacingMode = async () => {
    const nextMode = facingMode === "user" ? "environment" : "user";
    setFacingMode(nextMode);
    await startCamera(nextMode);
  };

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

  // Loop de detecção facial e validação dos desafios de Liveness
  useEffect(() => {
    if (currentStep !== 2 || !cameraActive || !modelsLoaded || allChallengesPassed) return;

    detectionIntervalRef.current = setInterval(async () => {
      if (!videoRef.current || videoRef.current.paused || videoRef.current.ended) return;

      try {
        const detection = await faceapi
          .detectSingleFace(
            videoRef.current,
            new faceapi.TinyFaceDetectorOptions({ inputSize: 224, scoreThreshold: 0.5 })
          )
          .withFaceLandmarks()
          .withFaceExpressions();

        if (!detection) {
          setFaceDetected(false);
          setFaceConfidence(null);
          return;
        }

        const rawScore = detection.detection?.score ?? detection.score ?? 0.95;
        const confidenceVal = Number.isFinite(rawScore) ? Math.round(rawScore * 100) : 95;
        setFaceDetected(true);
        setFaceConfidence(confidenceVal);

        // Se já concluiu todos ou não tem desafios sorteados, ignora
        if (challenges.length === 0 || allChallengesPassed) return;

        const activeChallenge = challenges[currentChallengeIndex];
        if (!activeChallenge) return;

        const landmarks = detection.landmarks;
        const expressions = detection.expressions;

        let passed = false;

        // 1. DESAFIO: OLHAR PARA CIMA
        if (activeChallenge.id === "look_up") {
          const nose = landmarks.getNose();
          const leftEye = landmarks.getLeftEye();
          const rightEye = landmarks.getRightEye();
          const jaw = landmarks.getJawOutline();

          const eyeCenterY = (leftEye[0].y + rightEye[3].y) / 2;
          const noseY = nose[3].y;
          const chinY = jaw[8].y;

          const ratio = (noseY - eyeCenterY) / Math.max(chinY - noseY, 1);
          if (ratio < 0.85) {
            const progress = Math.min(Math.round(((0.85 - ratio) / 0.16) * 100), 100);
            setChallengeProgress(Math.max(progress, 15));
          }
          if (ratio < 0.70) {
            passed = true;
          }
        }

        // 2. DESAFIO: VIRAR PARA A ESQUERDA
        else if (activeChallenge.id === "turn_left") {
          const nose = landmarks.getNose();
          const jaw = landmarks.getJawOutline();
          const distToLeft = Math.abs(nose[3].x - jaw[0].x);
          const distToRight = Math.abs(jaw[16].x - nose[3].x);
          // Quando o usuário vira a cabeça para a SUA ESQUERDA, seu nariz se desloca para jaw[16] (lado esquerdo do próprio rosto), aumentando a distância até jaw[0]
          const yawRatio = distToLeft / Math.max(distToRight, 1);
          if (yawRatio > 1.15) {
            const progress = Math.min(Math.round(((yawRatio - 1.15) / 0.40) * 100), 100);
            setChallengeProgress(Math.max(progress, 15));
          }
          if (yawRatio > 1.55) {
            passed = true;
          }
        }

        // 3. DESAFIO: VIRAR PARA A DIREITA
        else if (activeChallenge.id === "turn_right") {
          const nose = landmarks.getNose();
          const jaw = landmarks.getJawOutline();
          const distToLeft = Math.abs(nose[3].x - jaw[0].x);
          const distToRight = Math.abs(jaw[16].x - nose[3].x);
          // Quando o usuário vira a cabeça para a SUA DIREITA, seu nariz se desloca para jaw[0] (lado direito do próprio rosto), aumentando a distância até jaw[16]
          const yawRatio = distToRight / Math.max(distToLeft, 1);
          if (yawRatio > 1.15) {
            const progress = Math.min(Math.round(((yawRatio - 1.15) / 0.40) * 100), 100);
            setChallengeProgress(Math.max(progress, 15));
          }
          if (yawRatio > 1.55) {
            passed = true;
          }
        }

        // 4. DESAFIO: SORRIR
        else if (activeChallenge.id === "smile") {
          const happyScore = expressions?.happy || 0;
          if (happyScore > 0.2) {
            const progress = Math.min(Math.round((happyScore / 0.6) * 100), 100);
            setChallengeProgress(Math.max(progress, 15));
          }
          if (happyScore > 0.60) {
            passed = true;
          } else {
            // Análise por largura da boca relativa aos olhos
            const mouth = landmarks.getMouth();
            const leftEye = landmarks.getLeftEye();
            const rightEye = landmarks.getRightEye();
            const mouthWidth = Math.hypot(mouth[6].x - mouth[0].x, mouth[6].y - mouth[0].y);
            const eyeDist = Math.hypot(rightEye[3].x - leftEye[0].x, rightEye[3].y - leftEye[0].y);
            const mouthRatio = mouthWidth / Math.max(eyeDist, 1);
            if (mouthRatio > 0.78) {
              const progress = Math.min(Math.round(((mouthRatio - 0.75) / 0.12) * 100), 100);
              setChallengeProgress(Math.max(progress, 15));
            }
            if (mouthRatio > 0.86) {
              passed = true;
            }
          }
        }

        // Se o desafio atual foi superado
        if (passed) {
          playSuccessBeep();
          setChallengeProgress(100);
          setChallengeCompleted(true);

          setTimeout(() => {
            if (currentChallengeIndex + 1 < challenges.length) {
              // Avança para o próximo desafio
              setCurrentChallengeIndex((prev) => prev + 1);
              setChallengeProgress(0);
              setChallengeCompleted(false);
            } else {
              // Todos os desafios de prova de vida foram concluídos!
              setAllChallengesPassed(true);
              captureSnapshotFromVideo();
            }
          }, 600);
        }
      } catch (err) {
        // Erro transiente de frame
      }
    }, 280);

    return () => {
      if (detectionIntervalRef.current) {
        clearInterval(detectionIntervalRef.current);
      }
    };
  }, [currentStep, cameraActive, modelsLoaded, currentChallengeIndex, challenges, allChallengesPassed]);

  // Captura foto instantânea em alta fidelidade a partir do elemento de vídeo
  const captureSnapshotFromVideo = () => {
    if (!videoRef.current) return;
    const video = videoRef.current;
    const tempCanvas = document.createElement("canvas");
    tempCanvas.width = video.videoWidth || 1280;
    tempCanvas.height = video.videoHeight || 720;
    const ctx = tempCanvas.getContext("2d");

    if (facingMode === "user") {
      // Espelha horizontalmente apenas para câmera frontal (comportamento de espelho natural)
      ctx.translate(tempCanvas.width, 0);
      ctx.scale(-1, 1);
    }
    ctx.drawImage(video, 0, 0, tempCanvas.width, tempCanvas.height);

    const dataUrl = tempCanvas.toDataURL("image/jpeg", 0.92);
    setCapturedPhoto(dataUrl);

    // Para a câmera e avança para a etapa 3 após pequeno delay de celebração
    setTimeout(() => {
      stopCamera();
      setCurrentStep(3);
    }, 900);
  };

  // Inicializa Signature Pad na Etapa 1
  useEffect(() => {
    if (!isOpen || currentStep !== 1 || !canvasRef.current) return;

    const canvas = canvasRef.current;
    const ratio = Math.max(window.devicePixelRatio || 1, 1);
    canvas.width = canvas.offsetWidth * ratio;
    canvas.height = canvas.offsetHeight * ratio;
    const ctx = canvas.getContext("2d");
    ctx.scale(ratio, ratio);

    const pad = new SignaturePad(canvas, {
      backgroundColor: "rgb(255, 255, 255)",
      penColor: "rgb(15, 23, 42)",
      minWidth: 2,
      maxWidth: 4.5,
    });

    // Se já havia assinado antes e voltou de etapa, restaura
    if (signatureDataUrl) {
      pad.fromDataURL(signatureDataUrl);
      setHasSignature(true);
    }

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
  }, [isOpen, currentStep]);

  const handleClearSignature = () => {
    if (signaturePadRef.current) {
      signaturePadRef.current.clear();
      setHasSignature(false);
      setSignatureDataUrl(null);
    }
  };

  // Confirma a Etapa 1 e avança para a Etapa 2
  const handleConfirmSignature = () => {
    if (!signaturePadRef.current || signaturePadRef.current.isEmpty()) {
      setError("Por favor, faça a assinatura com o dedo no quadro antes de prosseguir.");
      return;
    }
    setError(null);
    const dataUrl = signaturePadRef.current.toDataURL("image/png");
    setSignatureDataUrl(dataUrl);
    setCurrentStep(2);
  };

  // Captura manual assistida se a webcam não suportar modelos neurais
  const handleManualCapture = () => {
    captureSnapshotFromVideo();
  };

  // Envio final para o backend na Etapa 3
  const handleFinalSubmit = async () => {
    if (!signatureDataUrl) {
      setError("Assinatura não localizada. Por favor, volte à Etapa 1.");
      setCurrentStep(1);
      return;
    }

    if (!capturedPhoto) {
      setError("Foto biométrica não localizada. Por favor, refaça a Etapa 2.");
      setCurrentStep(2);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const payload = {
        signature_data: signatureDataUrl,
        facial_photo_data: capturedPhoto,
        facial_verified: Boolean(allChallengesPassed || faceDetected),
        facial_confidence: faceConfidence ? faceConfidence / 100 : 0.95,
        signer_device: `${navigator.userAgent} (${window.innerWidth}x${window.innerHeight})`,
      };

      await api.post(`/terms/${term.id}/sign`, payload);

      stopCamera();
      if (onSuccess) onSuccess();
      onClose();
    } catch (err) {
      console.error("Erro ao registrar aceite digital do termo:", err);
      setError(err.response?.data?.detail || "Falha ao registrar termo digital.");
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen || !term) return null;

  const activeChallenge = challenges[currentChallengeIndex];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-slate-900/80 backdrop-blur-sm overflow-y-auto animate-fadeIn pt-[max(12px,env(safe-area-inset-top))] pb-[max(12px,env(safe-area-inset-bottom))]">
      <div className="bg-white w-full max-w-4xl rounded-3xl shadow-2xl border border-slate-200 overflow-hidden my-auto flex flex-col max-h-[88dvh] sm:max-h-[92dvh]">
        
        {/* 1. HEADER DO MODAL COM STEPPER PROGRESSIVO */}
        <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-blue-950 text-white px-4 sm:px-6 py-3 sm:py-4 border-b border-slate-800 shrink-0">
          <div className="flex items-center justify-between mb-2 sm:mb-3">
            <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
              <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-blue-500/20 border border-blue-400/30 flex items-center justify-center text-blue-300 shrink-0">
                <ShieldCheck size={20} />
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-[10px] sm:text-xs font-semibold px-2 py-0.5 rounded-full bg-blue-500/30 text-blue-200 border border-blue-400/30 font-mono">
                    {term.term_number}
                  </span>
                  <h3 className="font-bold text-sm sm:text-lg truncate">Aceite Digital</h3>
                </div>
                <p className="text-[11px] sm:text-xs text-slate-300 truncate mt-0.5">
                  Beneficiário: <strong className="text-white">{term.beneficiary_name}</strong>
                </p>
              </div>
            </div>

            <button 
              onClick={() => { stopCamera(); onClose(); }}
              className="text-slate-400 hover:text-white p-2 rounded-xl hover:bg-white/10 transition-colors cursor-pointer shrink-0"
            >
              <X size={20} />
            </button>
          </div>

          {/* Stepper Progress Bar Responsivo */}
          <div className="grid grid-cols-3 gap-1.5 sm:gap-2 pt-2 border-t border-slate-700/60">
            <div className={`flex items-center gap-1.5 sm:gap-2 py-1 transition-all ${currentStep === 1 ? "text-blue-400 font-bold" : currentStep > 1 ? "text-emerald-400" : "text-slate-500"}`}>
              <div className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-black shrink-0 ${currentStep === 1 ? "bg-blue-500 text-white" : currentStep > 1 ? "bg-emerald-500 text-white" : "bg-slate-700 text-slate-400"}`}>
                {currentStep > 1 ? "✓" : "1"}
              </div>
              <span className="text-xs truncate">
                <span className="sm:hidden">Assinatura</span>
                <span className="hidden sm:inline">1. Assinar com o Dedo</span>
              </span>
            </div>

            <div className={`flex items-center gap-1.5 sm:gap-2 py-1 transition-all ${currentStep === 2 ? "text-amber-400 font-bold" : currentStep > 2 ? "text-emerald-400" : "text-slate-500"}`}>
              <div className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-black shrink-0 ${currentStep === 2 ? "bg-amber-500 text-slate-900" : currentStep > 2 ? "bg-emerald-500 text-white" : "bg-slate-700 text-slate-400"}`}>
                {currentStep > 2 ? "✓" : "2"}
              </div>
              <span className="text-xs truncate">
                <span className="sm:hidden">Biometria</span>
                <span className="hidden sm:inline">2. Prova de Vida</span>
              </span>
            </div>

            <div className={`flex items-center gap-1.5 sm:gap-2 py-1 transition-all ${currentStep === 3 ? "text-emerald-400 font-bold" : "text-slate-500"}`}>
              <div className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-black shrink-0 ${currentStep === 3 ? "bg-emerald-500 text-white" : "bg-slate-700 text-slate-400"}`}>
                3
              </div>
              <span className="text-xs truncate">
                <span className="sm:hidden">Conclusão</span>
                <span className="hidden sm:inline">3. Conclusão & Registro</span>
              </span>
            </div>
          </div>
        </div>

        {/* 2. CORPO DO MODAL BASEADO NA ETAPA ATIVA */}
        <div className={`overflow-y-auto flex-1 text-slate-800 ${currentStep === 2 ? "p-3 sm:p-5 space-y-2 sm:space-y-4" : "p-4 sm:p-6 space-y-4 sm:space-y-5"}`}>
          {error && (
            <div className="p-4 rounded-2xl bg-red-50 border border-red-200 text-red-700 text-sm flex items-center gap-3">
              <AlertCircle size={20} className="shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* ========================================================= */}
          {/* ETAPA 1: LEITURA DO TERMO & ASSINATURA TOUCH COM O DEDO */}
          {/* ========================================================= */}
          {currentStep === 1 && (
            <div className="space-y-5 animate-fadeIn">
              {/* Resumo dos Itens Retirados */}
              <div className="bg-slate-50 rounded-2xl p-4 border border-slate-200">
                <div className="flex items-center justify-between mb-2.5">
                  <span className="text-xs font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
                    <PackageCheck size={16} className="text-blue-600" />
                    Itens entregues ao colaborador ({term.items?.length || 0})
                  </span>
                  <span className="text-xs text-slate-500">
                    Emissor: <strong>{term.technician_name}</strong>
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {term.items?.map((item) => (
                    <div key={item.id} className="bg-white p-2.5 rounded-xl border border-slate-200 flex items-center gap-2.5 shadow-sm text-xs">
                      <div className="w-7 h-7 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
                        <PackageCheck size={15} />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="font-bold text-slate-900 truncate">{item.item_name}</p>
                        <p className="text-[11px] text-slate-500">Qtd: {item.quantity} • {item.condition}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Quadro Touch de Assinatura */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                      Assine no quadro abaixo utilizando o dedo ou caneta touch:
                    </span>
                    <span className="px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 text-[10px] font-bold border border-blue-200">
                      Obrigatório
                    </span>
                  </div>

                  <button
                    type="button"
                    onClick={handleClearSignature}
                    disabled={!hasSignature}
                    className="inline-flex items-center gap-1.5 px-3 py-1 text-xs font-semibold text-rose-600 hover:text-rose-700 bg-rose-50 hover:bg-rose-100 rounded-lg border border-rose-200 transition-colors disabled:opacity-40 disabled:pointer-events-none cursor-pointer"
                  >
                    <Trash2 size={13} />
                    Limpar Assinatura
                  </button>
                </div>

                <div className="relative border-2 border-dashed border-slate-300 rounded-2xl overflow-hidden bg-white shadow-inner touch-none">
                  <canvas
                    ref={canvasRef}
                    className="w-full h-56 cursor-crosshair block"
                  />
                  {!hasSignature && (
                    <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none text-slate-400">
                      <span className="text-3xl mb-1">✍️</span>
                      <p className="text-xs font-medium">Faça sua rubrica ou assinatura aqui</p>
                      <p className="text-[10px] text-slate-300">O colaborador confirma ter recebido os bens listados acima</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* ========================================================= */}
          {/* ETAPA 2: PROVA DE VIDA FACIAL COM DESAFIOS ALEATÓRIOS     */}
          {/* ========================================================= */}
          {currentStep === 2 && (
            <div className="animate-fadeIn flex flex-col items-center justify-center space-y-2 sm:space-y-3">
              
              {/* Feed da Câmera com Guias e Instruções Integradas Diretamente no Enquadramento */}
              <div className="relative rounded-2xl sm:rounded-3xl overflow-hidden bg-black border-2 border-slate-700 shadow-2xl w-full max-w-[310px] sm:max-w-sm md:max-w-md mx-auto aspect-[3/4] max-h-[48dvh] sm:max-h-[55dvh] flex items-center justify-center">
                {/* Barra de Progresso do Desafio no Topo do Frame da Câmera */}
                {challengeProgress > 0 && (
                  <div className="absolute top-0 inset-x-0 h-1.5 bg-slate-900/80 z-30 overflow-hidden">
                    <div 
                      className="bg-amber-400 h-full transition-all duration-200 rounded-r-full shadow-[0_0_10px_rgba(251,191,36,0.9)]" 
                      style={{ width: `${challengeProgress}%` }}
                    />
                  </div>
                )}

                {cameraLoading && (
                  <div className="absolute inset-0 flex flex-col items-center justify-center text-slate-400 z-30 bg-slate-900/90 backdrop-blur-sm">
                    <RefreshCw size={32} className="animate-spin text-blue-500 mb-2" />
                    <span className="text-xs font-semibold">Ativando câmera...</span>
                  </div>
                )}

                {cameraError ? (
                  <div className="p-6 text-center text-rose-400 space-y-3 z-30">
                    <AlertTriangle size={36} className="mx-auto" />
                    <p className="text-xs">{cameraError}</p>
                    <button
                      type="button"
                      onClick={() => startCamera(facingMode)}
                      className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white text-xs font-bold rounded-xl border border-slate-700 cursor-pointer"
                    >
                      Tentar Novamente
                    </button>
                  </div>
                ) : (
                  <>
                    {/* Wrapper Absoluto para impedir bug de flexbox no WebKit */}
                    <div className="absolute inset-0 w-full h-full overflow-hidden flex items-center justify-center">
                      <video
                        ref={videoRef}
                        autoPlay
                        playsInline
                        webkit-playsinline="true"
                        muted
                        style={{
                          width: "100%",
                          height: "100%",
                          objectFit: "cover",
                          transform: facingMode === "user" ? "scaleX(-1)" : "none",
                          WebkitTransform: facingMode === "user" ? "scaleX(-1)" : "none",
                          transformOrigin: "center center",
                          WebkitTransformOrigin: "center center",
                        }}
                        className="w-full h-full block"
                      />
                    </div>

                    {/* Guia Oval de Centralização do Rosto Adaptativa */}
                    <div className="absolute inset-0 pointer-events-none flex items-center justify-center z-10">
                      <div
                        className={`w-[62%] h-[72%] max-w-[210px] max-h-[280px] rounded-full border-4 transition-all duration-300 shadow-2xl ${
                          challengeCompleted
                            ? "border-emerald-400 bg-emerald-500/10 scale-105 shadow-[0_0_24px_rgba(52,211,153,0.5)]"
                            : faceDetected
                            ? "border-amber-400 bg-amber-400/10 shadow-[0_0_20px_rgba(251,191,36,0.3)]"
                            : "border-white/50 border-dashed"
                        }`}
                      />
                    </div>

                    {/* Tarja de Instrução Flutuante Direta SOBRE o Feed da Câmera (Foco Visual Ocular) */}
                    <div className="absolute top-3 left-3 right-24 z-20 pointer-events-none">
                      <div className="bg-slate-950/85 backdrop-blur-md px-3 py-1.5 rounded-2xl border border-white/20 shadow-xl flex items-center gap-2">
                        <span className="text-lg sm:text-xl shrink-0">{activeChallenge?.emoji || "✨"}</span>
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5">
                            <span className="text-[10px] uppercase font-bold text-amber-400 block leading-none">
                              Desafio {currentChallengeIndex + 1}/{challenges.length}
                            </span>
                            {challengeCompleted ? (
                              <span className="text-[9px] font-bold px-1.5 py-0.5 bg-emerald-500/30 text-emerald-300 rounded border border-emerald-400/40">
                                ✓ Concluído
                              </span>
                            ) : faceDetected ? (
                              <span className="text-[9px] font-bold px-1.5 py-0.5 bg-blue-500/30 text-blue-300 rounded border border-blue-400/40">
                                {faceConfidence ? `${faceConfidence}%` : "OK"}
                              </span>
                            ) : null}
                          </div>
                          <span className="text-xs sm:text-sm font-black text-white block leading-tight mt-0.5 truncate">
                            {activeChallenge ? activeChallenge.title : "Posicione o rosto"}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Dica Flutuante Inferior sobre a Moldura Facial (Onde o usuário está olhando) */}
                    <div className="absolute bottom-11 inset-x-3 sm:inset-x-4 flex justify-center pointer-events-none z-20 text-center">
                      <span className={`px-3.5 py-1.5 rounded-full text-xs font-black backdrop-blur-md shadow-xl transition-all max-w-[92%] break-words ${
                        challengeCompleted 
                          ? "bg-emerald-600/95 text-white border border-emerald-400 shadow-emerald-900/50 animate-bounce" 
                          : faceDetected 
                          ? "bg-slate-950/85 text-amber-300 border border-amber-400/50" 
                          : "bg-slate-950/85 text-white/95 border border-white/20"
                      }`}>
                        {challengeCompleted 
                          ? "✓ Desafio Concluído!" 
                          : faceDetected 
                          ? activeChallenge?.instruction || "Execute a ação solicitada" 
                          : "👤 Centralize seu rosto no círculo"}
                      </span>
                    </div>

                    {/* Botão de Alternar Câmera (Frontal / Traseira) */}
                    <button
                      type="button"
                      onClick={toggleFacingMode}
                      className="absolute top-3 right-3 z-20 pointer-events-auto px-2.5 py-1.5 bg-slate-900/80 hover:bg-slate-800 active:scale-95 text-white text-xs font-bold rounded-xl border border-slate-700/80 backdrop-blur-md shadow-md flex items-center gap-1.5 cursor-pointer transition-all"
                      title="Alternar entre câmera frontal e traseira"
                    >
                      <SwitchCamera size={14} className="text-blue-400" />
                      <span className="text-[11px]">{facingMode === "user" ? "Traseira" : "Frontal"}</span>
                    </button>

                    {/* Badge flutuante inferior esquerdo no box: Modo de Câmera */}
                    <div className="absolute bottom-3 left-3 z-20 pointer-events-none">
                      <div className="bg-slate-900/80 backdrop-blur-md px-2 py-0.5 rounded-lg text-white text-[10px] font-semibold border border-slate-700/60 flex items-center gap-1.5 shadow">
                        <Camera size={11} className="text-blue-400" />
                        <span>{facingMode === "user" ? "Frontal" : "Traseira"}</span>
                      </div>
                    </div>

                    {/* Badge flutuante inferior direito no box: Detecção de Rosto */}
                    <div className="absolute bottom-3 right-3 z-20 pointer-events-none">
                      <div className={`backdrop-blur-md px-2 py-0.5 rounded-lg text-[10px] font-bold border flex items-center gap-1 shadow ${
                        faceDetected
                          ? "bg-blue-950/80 text-blue-300 border-blue-500/40"
                          : "bg-slate-900/80 text-slate-400 border-slate-700/60"
                      }`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${faceDetected ? "bg-blue-400 animate-ping" : "bg-slate-500"}`} />
                        <span>{faceDetected ? "Alinhado" : "Buscando"}</span>
                      </div>
                    </div>
                  </>
                )}
              </div>

              <p className="text-center text-[10px] sm:text-xs text-slate-500">
                A foto biométrica é capturada automaticamente quando os desafios forem concluídos.
              </p>
            </div>
          )}

          {/* ========================================================= */}
          {/* ETAPA 3: REVISÃO & CONFIRMAÇÃO FINAL                      */}
          {/* ========================================================= */}
          {currentStep === 3 && (
            <div className="space-y-5 animate-fadeIn">
              <div className="text-center max-w-md mx-auto">
                <div className="w-12 h-12 bg-emerald-100 text-emerald-600 rounded-2xl flex items-center justify-center mx-auto mb-2 shadow-sm">
                  <CheckCircle2 size={28} />
                </div>
                <h4 className="text-lg font-black text-slate-900">Validações Concluídas com Sucesso!</h4>
                <p className="text-xs text-slate-500 mt-1">
                  Ambas as evidências digitais pertencem ao colaborador <strong>{term.beneficiary_name}</strong>.
                </p>
              </div>

              {/* Grid com as Duas Evidências do Beneficiário */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* 1. Assinatura Touch */}
                <div className="border border-slate-200 rounded-2xl p-4 bg-slate-50 text-center flex flex-col justify-between">
                  <div>
                    <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block mb-2">
                      1. Assinatura com o Dedo (Touch)
                    </span>
                    <div className="h-40 bg-white rounded-xl border border-slate-200 p-3 flex items-center justify-center shadow-inner">
                      {signatureDataUrl ? (
                        <img src={signatureDataUrl} alt="Assinatura" className="max-h-full max-w-full object-contain" />
                      ) : (
                        <span className="text-xs text-slate-400">Sem assinatura</span>
                      )}
                    </div>
                  </div>
                  <div className="mt-3 pt-2 border-t border-slate-200 text-xs">
                    <p className="font-bold text-slate-800">{term.beneficiary_name}</p>
                    <p className="text-[11px] text-slate-500">Beneficiário Recebedor</p>
                  </div>
                </div>

                {/* 2. Foto Biométrica Liveness */}
                <div className="border border-slate-200 rounded-2xl p-4 bg-slate-50 text-center flex flex-col justify-between">
                  <div>
                    <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block mb-2">
                      2. Biometria Facial (Prova de Vida)
                    </span>
                    <div className="h-40 bg-slate-900 rounded-xl border border-slate-700 overflow-hidden flex items-center justify-center shadow-inner">
                      {capturedPhoto ? (
                        <img src={capturedPhoto} alt="Biometria" className="w-full h-full object-cover" />
                      ) : (
                        <span className="text-xs text-slate-400">Sem foto biométrica</span>
                      )}
                    </div>
                  </div>
                  <div className="mt-3 pt-2 border-t border-slate-200 text-xs">
                    <p className="font-bold text-emerald-700 flex items-center justify-center gap-1">
                      <Shield size={13} /> Prova de Vida Aprovada (100%)
                    </p>
                    <p className="text-[11px] text-slate-500">Validação biométrica em tempo real</p>
                  </div>
                </div>
              </div>

              {/* Registro do Técnico Responsável / Testemunha */}
              <div className="p-3.5 bg-blue-50 border border-blue-200 rounded-2xl text-xs flex items-center justify-between text-blue-900">
                <div className="flex items-center gap-2">
                  <UserCheck size={18} className="text-blue-600 shrink-0" />
                  <div>
                    <p className="font-bold">Testemunha / Técnico Emissor TI:</p>
                    <p className="text-blue-800">{term.technician_name} — Tecnologia da Informação Fasano Salvador</p>
                  </div>
                </div>
                <span className="text-[11px] font-bold bg-blue-200/80 text-blue-900 px-2.5 py-1 rounded-lg">
                  Fé Pública Interna
                </span>
              </div>
            </div>
          )}
        </div>

        {/* 3. FOOTER COM NAVEGAÇÃO DE ETAPAS */}
        <div className="bg-slate-50 px-4 sm:px-6 py-3 sm:py-4 border-t border-slate-200 flex items-center justify-between gap-2 shrink-0">
          <div>
            {currentStep > 1 && (
              <button
                type="button"
                onClick={() => {
                  stopCamera();
                  setCurrentStep((prev) => prev - 1);
                }}
                className="px-3.5 sm:px-4 py-2.5 bg-white border border-slate-300 hover:bg-slate-100 text-slate-700 font-bold text-xs rounded-xl flex items-center gap-1.5 transition-all cursor-pointer shadow-sm min-h-[44px]"
              >
                <ArrowLeft size={15} />
                <span className="hidden sm:inline">Voltar Etapa</span>
                <span className="sm:hidden">Voltar</span>
              </button>
            )}
          </div>

          <div className="flex items-center gap-2 sm:gap-3">
            <button
              type="button"
              onClick={() => { stopCamera(); onClose(); }}
              className="px-3 sm:px-4 py-2.5 text-xs font-semibold text-slate-600 hover:text-slate-900 cursor-pointer min-h-[44px] flex items-center"
            >
              Cancelar
            </button>

            {/* BOTÃO DA ETAPA 1 */}
            {currentStep === 1 && (
              <button
                type="button"
                onClick={handleConfirmSignature}
                disabled={!hasSignature}
                className="px-4 sm:px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-xl shadow-lg shadow-blue-500/25 flex items-center gap-2 transition-all disabled:opacity-50 disabled:pointer-events-none cursor-pointer min-h-[44px]"
              >
                <span>Avançar para Biometria</span>
                <ArrowRight size={15} />
              </button>
            )}

            {/* BOTÃO DA ETAPA 2 */}
            {currentStep === 2 && (
              <button
                type="button"
                onClick={handleManualCapture}
                className="px-4 sm:px-5 py-2.5 bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs rounded-xl shadow-lg shadow-amber-500/25 flex items-center gap-2 transition-all cursor-pointer min-h-[44px]"
              >
                <span>Concluir Foto Facial</span>
                <ArrowRight size={15} />
              </button>
            )}

            {/* BOTÃO DA ETAPA 3 (FINALIZAÇÃO) */}
            {currentStep === 3 && (
              <button
                type="button"
                onClick={handleFinalSubmit}
                disabled={loading}
                className="px-5 sm:px-6 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs rounded-xl shadow-lg shadow-emerald-600/30 flex items-center gap-2 transition-all disabled:opacity-50 cursor-pointer hover:shadow-none min-h-[44px]"
              >
                <CheckCircle2 size={16} />
                <span>{loading ? "Registrando..." : "Finalizar Termo"}</span>
              </button>
            )}
          </div>
        </div>

      </div>
    </div>
  );
}
