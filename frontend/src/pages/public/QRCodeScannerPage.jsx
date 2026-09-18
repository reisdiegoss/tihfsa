import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { 
  Camera, X, RefreshCw, AlertCircle, CheckCircle2, 
  FlipHorizontal, Zap, ZapOff, ArrowLeft, Sliders, ShieldCheck
} from "lucide-react";
import { Html5Qrcode, Html5QrcodeSupportedFormats } from "html5-qrcode";

export default function QRCodeScannerPage() {
  const navigate = useNavigate();
  const [isScanning, setIsScanning] = useState(false);
  const [cameraError, setCameraError] = useState("");
  const [cameras, setCameras] = useState([]);
  const [selectedCameraId, setSelectedCameraId] = useState(null);
  const [torchOn, setTorchOn] = useState(false);
  const [hasTorch, setHasTorch] = useState(false);
  
  // Opção: Alert Dialog nativo (window.alert) ou Modal na tela
  const [useNativeAlert, setUseNativeAlert] = useState(true);

  // Estado do Modal de Alerta na tela (caso useNativeAlert seja falso ou como visualização)
  const [alertData, setAlertData] = useState(null); // { text }

  const html5QrCodeRef = useRef(null);
  const isPausedRef = useRef(false);
  const readerId = "qr-reader-viewport";

  // Inicializa lista de câmeras disponíveis
  useEffect(() => {
    Html5Qrcode.getCameras()
      .then((devices) => {
        if (devices && devices.length) {
          setCameras(devices);
          // Prefere a câmera traseira (environment / back)
          const backCam = devices.find((d) => 
            d.label.toLowerCase().includes("back") || 
            d.label.toLowerCase().includes("traseira") ||
            d.label.toLowerCase().includes("environment")
          );
          setSelectedCameraId(backCam ? backCam.id : devices[0].id);
        } else {
          setCameraError("Nenhuma câmera encontrada no dispositivo.");
        }
      })
      .catch((err) => {
        console.warn("Aviso ao buscar câmeras:", err);
      });

    return () => {
      stopScanner();
    };
  }, []);

  // Inicia o scanner sempre que selecionada uma câmera ou no mount
  useEffect(() => {
    startScanner();
    return () => {
      stopScanner();
    };
  }, [selectedCameraId]);

  const stopScanner = async () => {
    if (html5QrCodeRef.current) {
      try {
        if (html5QrCodeRef.current.isScanning) {
          await html5QrCodeRef.current.stop();
        }
        await html5QrCodeRef.current.clear();
      } catch (err) {
        console.warn("Erro ao parar scanner:", err);
      }
      html5QrCodeRef.current = null;
    }
    setIsScanning(false);
  };

  const startScanner = async () => {
    await stopScanner();
    setCameraError("");
    isPausedRef.current = false;

    try {
      const qrCode = new Html5Qrcode(readerId, {
        formatsToSupport: [Html5QrcodeSupportedFormats.QR_CODE],
        verbose: false,
      });
      html5QrCodeRef.current = qrCode;

      const cameraConfig = selectedCameraId 
        ? { deviceId: { exact: selectedCameraId } }
        : { facingMode: "environment" };

      await qrCode.start(
        cameraConfig,
        {
          fps: 15,
          qrbox: (viewfinderWidth, viewfinderHeight) => {
            const minEdge = Math.min(viewfinderWidth, viewfinderHeight);
            const edgeSize = Math.max(220, Math.floor(minEdge * 0.72));
            return { width: edgeSize, height: edgeSize };
          },
          aspectRatio: 1.0,
        },
        onScanSuccess,
        onScanFailure
      );

      setIsScanning(true);

      // Verifica suporte a Lanterna / Torch
      try {
        const track = qrCode.getRunningTrack();
        const capabilities = track?.getCapabilities?.();
        if (capabilities && capabilities.torch) {
          setHasTorch(true);
        }
      } catch (e) {}

    } catch (err) {
      console.error("Erro ao iniciar câmera:", err);
      setCameraError(
        err?.name === "NotAllowedError"
          ? "Permissão de acesso à câmera negada. Conceda permissão no navegador para ler o QR Code."
          : "Não foi possível abrir a câmera. Verifique se o site está usando HTTPS ou se a câmera está ocupada por outro aplicativo."
      );
      setIsScanning(false);
    }
  };

  // Callback de sucesso da leitura
  const onScanSuccess = (decodedText) => {
    // 2. Assim que detectado, pausa temporariamente para evitar loops/duplicatas
    if (isPausedRef.current) return;
    isPausedRef.current = true;

    // Pausa o processador de vídeo da biblioteca
    try {
      html5QrCodeRef.current?.pause();
    } catch (e) {}

    // Feedback de vibração tátil nativo
    if (typeof navigator !== "undefined" && navigator.vibrate) {
      navigator.vibrate(120);
    }

    // Beep sonoro sutil
    playBeepSound();

    if (useNativeAlert) {
      // 3 & 4. Alert Dialog NATIVO do sistema operacional (iOS / Android) contendo apenas o botão "OK"
      setTimeout(() => {
        window.alert(decodedText);
        // 5. Quando o usuário clica em "OK", fecha o alerta e reativa a câmera para novas leituras
        resumeScanning();
      }, 80);
    } else {
      // Modal de Alerta na tela com o mesmo fluxo e apenas o botão "OK"
      setAlertData({ text: decodedText });
    }
  };

  const onScanFailure = () => {
    // Ignora frames sem QR Code
  };

  // 5. Reativação da câmera após o clique em OK
  const resumeScanning = () => {
    setAlertData(null);
    try {
      html5QrCodeRef.current?.resume();
    } catch (e) {}

    // Delay de proteção contra re-escaneamento imediato do mesmo código na mira
    setTimeout(() => {
      isPausedRef.current = false;
    }, 500);
  };

  // Alternar Lanterna
  const toggleTorch = async () => {
    if (!html5QrCodeRef.current) return;
    try {
      const track = html5QrCodeRef.current.getRunningTrack();
      if (track) {
        await track.applyConstraints({
          advanced: [{ torch: !torchOn }],
        });
        setTorchOn(!torchOn);
      }
    } catch (err) {
      console.warn("Falha ao acionar lanterna:", err);
    }
  };

  // Alternar entre câmeras
  const switchCamera = () => {
    if (cameras.length <= 1) return;
    const currentIndex = cameras.findIndex((c) => c.id === selectedCameraId);
    const nextIndex = (currentIndex + 1) % cameras.length;
    setSelectedCameraId(cameras[nextIndex].id);
  };

  // Gerador de tom sonoro (Beep) via Web Audio API sem dependências externas
  const playBeepSound = () => {
    try {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      if (AudioContext) {
        const ctx = new AudioContext();
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.type = "sine";
        osc.frequency.setValueAtTime(880, ctx.currentTime);
        gain.gain.setValueAtTime(0.15, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.15);
        osc.start(ctx.currentTime);
        osc.stop(ctx.currentTime + 0.15);
      }
    } catch (e) {}
  };

  return (
    <div className="fixed inset-0 bg-black flex flex-col z-50 select-none overflow-hidden">
      
      {/* Top Bar / Header Flutuante */}
      <div className="absolute top-0 left-0 right-0 z-30 p-4 pt-safe flex items-center justify-between bg-gradient-to-b from-black/80 via-black/40 to-transparent text-white">
        <button
          onClick={() => navigate(-1)}
          className="w-10 h-10 rounded-full bg-white/20 backdrop-blur-md flex items-center justify-center text-white hover:bg-white/30 transition-all cursor-pointer"
          title="Voltar"
        >
          <ArrowLeft size={20} />
        </button>

        <div className="text-center">
          <h1 className="text-sm font-extrabold tracking-wide uppercase">Leitor de QR Code</h1>
          <p className="text-[10px] text-white/70 font-medium">TIHFSA • Hotel Fasano Salvador</p>
        </div>

        <div className="flex items-center gap-2">
          {hasTorch && (
            <button
              onClick={toggleTorch}
              className={`w-10 h-10 rounded-full backdrop-blur-md flex items-center justify-center transition-all cursor-pointer ${
                torchOn ? "bg-amber-400 text-black font-bold" : "bg-white/20 text-white hover:bg-white/30"
              }`}
              title="Alternar Lanterna"
            >
              {torchOn ? <Zap size={18} /> : <ZapOff size={18} />}
            </button>
          )}

          {cameras.length > 1 && (
            <button
              onClick={switchCamera}
              className="w-10 h-10 rounded-full bg-white/20 backdrop-blur-md flex items-center justify-center text-white hover:bg-white/30 transition-all cursor-pointer"
              title="Trocar Câmera"
            >
              <FlipHorizontal size={18} />
            </button>
          )}
        </div>
      </div>

      {/* Área da Câmera / Viewport */}
      <div className="relative flex-1 flex items-center justify-center bg-black overflow-hidden">
        
        {/* Container onde o html5-qrcode injeta o elemento de vídeo */}
        <div 
          id={readerId} 
          className="w-full h-full flex items-center justify-center overflow-hidden [&>video]:w-full [&>video]:h-full [&>video]:object-cover"
        />

        {/* Mira de Escaneamento Estilizada Sobreposta */}
        {isScanning && !cameraError && (
          <div className="absolute inset-0 pointer-events-none flex flex-col items-center justify-center">
            {/* Máscara de escurecimento ao redor */}
            <div className="relative w-64 h-64 sm:w-72 sm:h-72">
              
              {/* Cantos da Mira (Amarelo / Fasano Gold) */}
              <div className="absolute -top-1 -left-1 w-8 h-8 border-t-4 border-l-4 border-amber-400 rounded-tl-xl shadow-sm" />
              <div className="absolute -top-1 -right-1 w-8 h-8 border-t-4 border-r-4 border-amber-400 rounded-tr-xl shadow-sm" />
              <div className="absolute -bottom-1 -left-1 w-8 h-8 border-b-4 border-l-4 border-amber-400 rounded-bl-xl shadow-sm" />
              <div className="absolute -bottom-1 -right-1 w-8 h-8 border-b-4 border-r-4 border-amber-400 rounded-br-xl shadow-sm" />

              {/* Linha de Varredura Laser Animada */}
              <div className="absolute inset-x-2 h-0.5 bg-gradient-to-r from-transparent via-amber-400 to-transparent shadow-[0_0_8px_#f59e0b] animate-[bounce_2s_infinite]" />
            </div>

            <p className="text-white text-xs font-bold mt-6 tracking-wide drop-shadow-md bg-black/40 px-3 py-1.5 rounded-full backdrop-blur-md">
              Aponte a câmera para o QR Code
            </p>
          </div>
        )}

        {/* Mensagem de Erro de Câmera */}
        {cameraError && (
          <div className="absolute inset-0 bg-slate-950 flex flex-col items-center justify-center p-6 text-center z-20">
            <div className="w-16 h-16 rounded-3xl bg-red-500/20 text-red-400 flex items-center justify-center mb-4">
              <AlertCircle size={36} />
            </div>
            <h2 className="text-base font-extrabold text-white">Acesso à Câmera Indisponível</h2>
            <p className="text-xs text-slate-400 max-w-sm mt-2 leading-relaxed">
              {cameraError}
            </p>
            <button
              onClick={startScanner}
              className="mt-6 px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-2xl flex items-center gap-2 transition-all cursor-pointer"
            >
              <RefreshCw size={15} />
              <span>Tentar Novamente</span>
            </button>
          </div>
        )}
      </div>

      {/* Barra Inferior com Configurações Rápidas */}
      <div className="p-4 pb-safe bg-gradient-to-t from-black/90 via-black/70 to-transparent flex flex-col items-center gap-3 z-30">
        
        {/* Toggle de Tipo de Alert Dialog */}
        <div className="flex items-center gap-2 bg-white/10 backdrop-blur-md px-3.5 py-1.5 rounded-full border border-white/10">
          <span className="text-[11px] font-bold text-white/80">Modo de Alerta:</span>
          <button
            onClick={() => setUseNativeAlert(true)}
            className={`px-3 py-1 rounded-full text-[10px] font-extrabold transition-all cursor-pointer ${
              useNativeAlert ? "bg-amber-400 text-slate-900 shadow-sm" : "text-white/60 hover:text-white"
            }`}
          >
            Nativo do Sistema (iOS / Android)
          </button>
          <button
            onClick={() => setUseNativeAlert(false)}
            className={`px-3 py-1 rounded-full text-[10px] font-extrabold transition-all cursor-pointer ${
              !useNativeAlert ? "bg-blue-600 text-white shadow-sm" : "text-white/60 hover:text-white"
            }`}
          >
            Modal na Tela
          </button>
        </div>

        <p className="text-[10px] text-white/50 text-center font-medium">
          O escaneamento pausa automaticamente ao detectar o código e reativa ao clicar em OK.
        </p>
      </div>

      {/* 3 & 4. MODAL DE ALERTA NA TELA COM APENAS O BOTÃO "OK" */}
      {alertData && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl max-w-sm w-full p-6 shadow-2xl border border-slate-100 flex flex-col text-center animate-in zoom-in-95 duration-200">
            
            <div className="w-14 h-14 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center mx-auto mb-3">
              <CheckCircle2 size={32} />
            </div>

            <h3 className="text-sm font-black text-slate-900 uppercase tracking-wider">
              QR Code Detectado
            </h3>

            {/* Texto extraído do QR Code */}
            <div className="my-4 p-3 bg-slate-50 rounded-2xl border border-slate-200/80 text-left max-h-60 overflow-y-auto">
              <pre className="font-mono text-xs text-slate-800 whitespace-pre-wrap leading-relaxed">
                {alertData.text}
              </pre>
            </div>

            {/* 4. Apenas um botão "OK" */}
            <button
              onClick={resumeScanning}
              className="w-full py-3.5 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white rounded-2xl font-black text-sm transition-all shadow-md shadow-blue-500/20 cursor-pointer"
            >
              OK
            </button>
          </div>
        </div>
      )}

    </div>
  );
}
