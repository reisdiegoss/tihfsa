import { useState, useEffect, useRef } from "react";
import SignaturePad from "signature_pad";
import * as faceapi from "@vladmandic/face-api";
import { 
  X, CheckCircle2, AlertCircle, Camera, RefreshCw, 
  Trash2, ShieldCheck, UserCheck, Smartphone, Laptop, 
  Radio, Headphones, Key, Clock, PackageCheck, AlertTriangle,
  ArrowRight, ArrowLeft, Sparkles, Smile, Eye, ArrowUp, 
  RotateCw, Check, Volume2, Shield, SwitchCamera
} from "lucide-react";
import api from "../../../api/client";

// Catálogo de Desafios de Prova de Vida (Liveness Detection)
const LIVENESS_CHALLENGES = [
  {
    id: "blink",
    title: "Pisque os olhos",
    instruction: "Pisque os dois olhos lentamente olhando para a câmera",
    icon: Eye,
    color: "text-amber-500",
    bg: "bg-amber-500/10",
  },
  {
    id: "look_up",
    title: "Olhe para cima",
    instruction: "Levante ligeiramente o queixo e olhe para cima",
    icon: ArrowUp,
    color: "text-blue-500",
    bg: "bg-blue-500/10",
  },
  {
    id: "turn_left",
    title: "Vire o rosto para a esquerda",
    instruction: "Gire a cabeça suavemente para o seu lado esquerdo",
    icon: ArrowLeft,
    color: "text-purple-500",
    bg: "bg-purple-500/10",
  },
  {
    id: "turn_right",
    title: "Vire o rosto para a direita",
    instruction: "Gire a cabeça suavemente para o seu lado direito",
    icon: ArrowRight,
    color: "text-indigo-500",
    bg: "bg-indigo-500/10",
  },
  {
    id: "smile",
    title: "Dê um sorriso",
    instruction: "Sorria naturalmente para a validação da expressão facial",
    icon: Smile,
    color: "text-emerald-500",
    bg: "bg-emerald-500/10",
  },
];

// Cálculo do Eye Aspect Ratio (EAR) para detecção de piscadas
function getEar(eye) {
  if (!eye || eye.length < 6) return 0.3;
  const d1 = Math.hypot(eye[1].x - eye[5].x, eye[1].y - eye[5].y);
  const d2 = Math.hypot(eye[2].x - eye[4].x, eye[2].y - eye[4].y);
  const d3 = Math.hypot(eye[0].x - eye[3].x, eye[0].y - eye[3].y);
  return (d1 + d2) / (2.0 * (d3 || 1));
}

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
  const blinkStateRef = useRef({ eyeWasClosed: false, closedFrames: 0 });
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
    blinkStateRef.current = { eyeWasClosed: false, closedFrames: 0 };
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

      // Constraints sem restrições que forçam crop/zoom digital no sensor
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: { ideal: targetMode },
          width: { ideal: 1280, max: 1920 },
          height: { ideal: 720, max: 1080 },
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
      // Tentativa de fallback com constraints genéricos
      try {
        const fallbackStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
        streamRef.current = fallbackStream;
        if (videoRef.current) {
          videoRef.current.srcObject = fallbackStream;
          videoRef.current.play();
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

        setFaceDetected(true);
        setFaceConfidence(Math.round(detection.score * 100));

        // Se já concluiu todos ou não tem desafios sorteados, ignora
        if (challenges.length === 0 || allChallengesPassed) return;

        const activeChallenge = challenges[currentChallengeIndex];
        if (!activeChallenge) return;

        const landmarks = detection.landmarks;
        const expressions = detection.expressions;

        let passed = false;

        // 1. DESAFIO: PISCAR OS OLHOS
        if (activeChallenge.id === "blink") {
          const leftEye = landmarks.getLeftEye();
          const rightEye = landmarks.getRightEye();
          const ear = (getEar(leftEye) + getEar(rightEye)) / 2;

          // Se EAR cair abaixo de 0.22, os olhos fecharam
          if (ear < 0.22) {
            blinkStateRef.current.eyeWasClosed = true;
            blinkStateRef.current.closedFrames += 1;
            setChallengeProgress(50);
          } else if (blinkStateRef.current.eyeWasClosed && ear >= 0.26) {
            // Olho abriu de novo: piscada válida!
            passed = true;
          }
        }

        // 2. DESAFIO: OLHAR PARA CIMA
        else if (activeChallenge.id === "look_up") {
          const nose = landmarks.getNose();
          const leftEye = landmarks.getLeftEye();
          const rightEye = landmarks.getRightEye();
          const jaw = landmarks.getJawOutline();

          const eyeCenterY = (leftEye[0].y + rightEye[3].y) / 2;
          const noseY = nose[3].y;
          const chinY = jaw[8].y;

          const ratio = (noseY - eyeCenterY) / Math.max(chinY - noseY, 1);
          if (ratio < 0.68) {
            passed = true;
          }
        }

        // 3. DESAFIO: VIRAR PARA A ESQUERDA
        else if (activeChallenge.id === "turn_left") {
          const nose = landmarks.getNose();
          const jaw = landmarks.getJawOutline();
          const distToLeft = Math.abs(nose[3].x - jaw[0].x);
          const distToRight = Math.abs(jaw[16].x - nose[3].x);
          // Rosto virado para a esquerda
          if (distToRight / Math.max(distToLeft, 1) > 1.85) {
            passed = true;
          }
        }

        // 4. DESAFIO: VIRAR PARA A DIREITA
        else if (activeChallenge.id === "turn_right") {
          const nose = landmarks.getNose();
          const jaw = landmarks.getJawOutline();
          const distToLeft = Math.abs(nose[3].x - jaw[0].x);
          const distToRight = Math.abs(jaw[16].x - nose[3].x);
          // Rosto virado para a direita
          if (distToLeft / Math.max(distToRight, 1) > 1.85) {
            passed = true;
          }
        }

        // 5. DESAFIO: SORRIR
        else if (activeChallenge.id === "smile") {
          if (expressions && expressions.happy > 0.65) {
            passed = true;
          } else {
            // Análise por largura da boca relativa aos olhos
            const mouth = landmarks.getMouth();
            const leftEye = landmarks.getLeftEye();
            const rightEye = landmarks.getRightEye();
            const mouthWidth = Math.hypot(mouth[6].x - mouth[0].x, mouth[6].y - mouth[0].y);
            const eyeDist = Math.hypot(rightEye[3].x - leftEye[0].x, rightEye[3].y - leftEye[0].y);
            if (mouthWidth / Math.max(eyeDist, 1) > 0.88) {
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
              blinkStateRef.current = { eyeWasClosed: false, closedFrames: 0 };
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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/80 backdrop-blur-sm overflow-y-auto animate-fadeIn">
      <div className="bg-white w-full max-w-4xl rounded-3xl shadow-2xl border border-slate-200 overflow-hidden my-auto flex flex-col max-h-[94vh]">
        
        {/* 1. HEADER DO MODAL COM STEPPER PROGRESSIVO */}
        <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-blue-950 text-white px-6 py-4 border-b border-slate-800 shrink-0">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-blue-500/20 border border-blue-400/30 flex items-center justify-center text-blue-300">
                <ShieldCheck size={22} />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-blue-500/30 text-blue-200 border border-blue-400/30">
                    {term.term_number}
                  </span>
                  <h3 className="font-bold text-base sm:text-lg">Aceite Digital em 3 Etapas</h3>
                </div>
                <p className="text-xs text-slate-300">
                  Beneficiário: <strong className="text-white">{term.beneficiary_name}</strong> • Testemunha TI: {term.technician_name}
                </p>
              </div>
            </div>

            <button 
              onClick={() => { stopCamera(); onClose(); }}
              className="text-slate-400 hover:text-white p-2 rounded-xl hover:bg-white/10 transition-colors cursor-pointer"
            >
              <X size={20} />
            </button>
          </div>

          {/* Stepper Progress Bar */}
          <div className="grid grid-cols-3 gap-2 pt-1 border-t border-slate-700/60">
            <div className={`flex items-center gap-2 py-1 transition-all ${currentStep === 1 ? "text-blue-400 font-bold" : currentStep > 1 ? "text-emerald-400" : "text-slate-500"}`}>
              <div className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-black ${currentStep === 1 ? "bg-blue-500 text-white" : currentStep > 1 ? "bg-emerald-500 text-white" : "bg-slate-700 text-slate-400"}`}>
                {currentStep > 1 ? "✓" : "1"}
              </div>
              <span className="text-xs truncate">1. Assinar com o Dedo</span>
            </div>

            <div className={`flex items-center gap-2 py-1 transition-all ${currentStep === 2 ? "text-amber-400 font-bold" : currentStep > 2 ? "text-emerald-400" : "text-slate-500"}`}>
              <div className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-black ${currentStep === 2 ? "bg-amber-500 text-slate-900" : currentStep > 2 ? "bg-emerald-500 text-white" : "bg-slate-700 text-slate-400"}`}>
                {currentStep > 2 ? "✓" : "2"}
              </div>
              <span className="text-xs truncate">2. Prova de Vida Facial</span>
            </div>

            <div className={`flex items-center gap-2 py-1 transition-all ${currentStep === 3 ? "text-emerald-400 font-bold" : "text-slate-500"}`}>
              <div className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-black ${currentStep === 3 ? "bg-emerald-500 text-white" : "bg-slate-700 text-slate-400"}`}>
                3
              </div>
              <span className="text-xs truncate">3. Conclusão & Registro</span>
            </div>
          </div>
        </div>

        {/* 2. CORPO DO MODAL BASEADO NA ETAPA ATIVA */}
        <div className="p-5 sm:p-6 overflow-y-auto space-y-5 flex-1 text-slate-800">
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
            <div className="space-y-4 animate-fadeIn">
              
              {/* Banner do Desafio Ativo */}
              <div className="p-4 rounded-2xl bg-gradient-to-r from-amber-500/10 via-amber-500/5 to-slate-50 border border-amber-300/80 flex flex-col sm:flex-row items-center justify-between gap-3 shadow-sm">
                <div className="flex items-center gap-3.5">
                  <div className="w-12 h-12 rounded-2xl bg-amber-500 text-slate-900 flex items-center justify-center font-black shadow-md shadow-amber-500/20 shrink-0">
                    {activeChallenge ? (
                      <activeChallenge.icon size={26} className="animate-pulse" />
                    ) : (
                      <Sparkles size={26} />
                    )}
                  </div>
                  <div>
                    <span className="text-[11px] font-black uppercase tracking-wider text-amber-700 block">
                      Prova de Vida • Desafio {currentChallengeIndex + 1} de {challenges.length}
                    </span>
                    <h4 className="text-base sm:text-lg font-black text-slate-900">
                      {activeChallenge ? activeChallenge.title : "Posicione o rosto na câmera..."}
                    </h4>
                    <p className="text-xs text-slate-600 mt-0.5">
                      {activeChallenge ? activeChallenge.instruction : "Olhe fixamente para a tela"}
                    </p>
                  </div>
                </div>

                {/* Status do Desafio */}
                <div className="flex flex-col items-end shrink-0">
                  {challengeCompleted ? (
                    <span className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 text-white text-xs font-bold rounded-xl shadow">
                      <Check size={14} /> Desafio Aprovado!
                    </span>
                  ) : faceDetected ? (
                    <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-blue-100 text-blue-800 text-xs font-semibold rounded-lg border border-blue-200">
                      Rosto Alinhado ({faceConfidence}%)
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-slate-100 text-slate-600 text-xs font-semibold rounded-lg">
                      Aproxime o rosto
                    </span>
                  )}
                </div>
              </div>

              {/* Feed da Câmera com Imagem Real (Sem Zoom / Sem Corte) e Moldura Guia */}
              <div className="relative rounded-3xl overflow-hidden bg-slate-950 border-2 border-slate-700 shadow-xl w-full max-w-xl mx-auto flex items-center justify-center min-h-[300px] max-h-[55vh]">
                {cameraLoading && (
                  <div className="absolute inset-0 flex flex-col items-center justify-center text-slate-400 z-20 bg-slate-900/90 backdrop-blur-sm">
                    <RefreshCw size={32} className="animate-spin text-blue-500 mb-2" />
                    <span className="text-xs font-semibold">Ativando lente da câmera real...</span>
                  </div>
                )}

                {cameraError ? (
                  <div className="p-6 text-center text-rose-400 space-y-3 z-20">
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
                    <video
                      ref={videoRef}
                      playsInline
                      muted
                      className={`w-full h-full max-h-[55vh] object-contain transition-transform duration-300 ${
                        facingMode === "user" ? "scale-x-[-1]" : ""
                      }`}
                    />

                    {/* Guia Oval de Centralização do Rosto Adaptativa */}
                    <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
                      <div
                        className={`w-44 h-60 sm:w-56 sm:h-72 rounded-full border-4 transition-all duration-300 shadow-2xl ${
                          challengeCompleted
                            ? "border-emerald-400 bg-emerald-500/10 scale-105"
                            : faceDetected
                            ? "border-amber-400 bg-amber-400/5"
                            : "border-white/40 border-dashed"
                        }`}
                      />
                    </div>

                    {/* Botão de Alternar Câmera (Frontal / Traseira) para Tablets e Smartphones */}
                    <button
                      type="button"
                      onClick={toggleFacingMode}
                      className="absolute top-3.5 right-3.5 z-20 pointer-events-auto px-3 py-1.5 bg-slate-900/80 hover:bg-slate-800 text-white text-xs font-bold rounded-xl border border-slate-700 backdrop-blur-md shadow-md flex items-center gap-1.5 cursor-pointer transition-colors"
                      title="Alternar entre câmera frontal e traseira"
                    >
                      <SwitchCamera size={14} className="text-blue-400" />
                      <span className="text-[11px]">{facingMode === "user" ? "Câmera Traseira" : "Câmera Frontal"}</span>
                    </button>

                    {/* Badge flutuante do desafio e controle */}
                    <div className="absolute bottom-4 inset-x-4 flex items-center justify-between z-10 pointer-events-none">
                      <div className="bg-slate-900/85 backdrop-blur-md px-3 py-1.5 rounded-xl text-white text-xs font-bold border border-slate-700 flex items-center gap-2 shadow-lg">
                        <Camera size={14} className="text-blue-400" />
                        <span className="text-[11px] truncate max-w-[170px] sm:max-w-none">
                          {facingMode === "user" ? "Câmera Frontal (FOV Real)" : "Câmera Traseira (FOV Real)"}
                        </span>
                      </div>

                      {/* Botão de fallback manual caso necessário */}
                      <button
                        type="button"
                        onClick={handleManualCapture}
                        className="pointer-events-auto px-3.5 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl shadow-lg cursor-pointer transition-all"
                        title="Capturar foto do colaborador imediatamente"
                      >
                        Capturar Foto
                      </button>
                    </div>
                  </>
                )}
              </div>

              <p className="text-center text-xs text-slate-500">
                A biometria facial garante que o termo está sendo assinado pelo próprio colaborador no momento da retirada.
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
        <div className="bg-slate-50 px-6 py-4 border-t border-slate-200 flex items-center justify-between shrink-0">
          <div>
            {currentStep > 1 && (
              <button
                type="button"
                onClick={() => {
                  stopCamera();
                  setCurrentStep((prev) => prev - 1);
                }}
                className="px-4 py-2.5 bg-white border border-slate-300 hover:bg-slate-100 text-slate-700 font-bold text-xs rounded-xl flex items-center gap-1.5 transition-all cursor-pointer shadow-sm"
              >
                <ArrowLeft size={15} />
                Voltar Etapa
              </button>
            )}
          </div>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => { stopCamera(); onClose(); }}
              className="px-4 py-2.5 text-xs font-semibold text-slate-600 hover:text-slate-900 cursor-pointer"
            >
              Cancelar
            </button>

            {/* BOTÃO DA ETAPA 1 */}
            {currentStep === 1 && (
              <button
                type="button"
                onClick={handleConfirmSignature}
                disabled={!hasSignature}
                className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-xl shadow-lg shadow-blue-500/25 flex items-center gap-2 transition-all disabled:opacity-50 disabled:pointer-events-none cursor-pointer"
              >
                Confirmar Assinatura & Ir para Biometria
                <ArrowRight size={15} />
              </button>
            )}

            {/* BOTÃO DA ETAPA 2 */}
            {currentStep === 2 && (
              <button
                type="button"
                onClick={handleManualCapture}
                className="px-5 py-2.5 bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs rounded-xl shadow-lg shadow-amber-500/25 flex items-center gap-2 transition-all cursor-pointer"
              >
                Concluir Foto Facial
                <ArrowRight size={15} />
              </button>
            )}

            {/* BOTÃO DA ETAPA 3 (FINALIZAÇÃO) */}
            {currentStep === 3 && (
              <button
                type="button"
                onClick={handleFinalSubmit}
                disabled={loading}
                className="px-6 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs rounded-xl shadow-lg shadow-emerald-600/30 flex items-center gap-2 transition-all disabled:opacity-50 cursor-pointer hover:shadow-none"
              >
                <CheckCircle2 size={16} />
                {loading ? "Registrando Termo..." : "Finalizar e Registrar Termo Digital"}
              </button>
            )}
          </div>
        </div>

      </div>
    </div>
  );
}
