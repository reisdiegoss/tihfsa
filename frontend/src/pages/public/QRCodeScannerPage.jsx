import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { 
  Camera, X, RefreshCw, AlertCircle, FlipHorizontal, 
  Zap, ZapOff, ArrowLeft
} from "lucide-react";
import { Html5Qrcode, Html5QrcodeSupportedFormats } from "html5-qrcode";
import api from "../../api/client";
import NativeAlertDialog from "../../components/ui/NativeAlertDialog";

export default function QRCodeScannerPage() {
  const navigate = useNavigate();
  const [isScanning, setIsScanning] = useState(false);
  const [cameraError, setCameraError] = useState("");
  const [cameras, setCameras] = useState([]);
  const [selectedCameraId, setSelectedCameraId] = useState(null);
  const [torchOn, setTorchOn] = useState(false);
  const [hasTorch, setHasTorch] = useState(false);

  // Estado do Modal de Alerta Nativo
  const [alertData, setAlertData] = useState(null); // { title, message }

  const html5QrCodeRef = useRef(null);
  const isPausedRef = useRef(false);
  const readerId = "qr-reader-viewport";

  // Inicializa lista de câmeras disponíveis
  useEffect(() => {
    Html5Qrcode.getCameras()
      .then((devices) => {
        if (devices && devices.length) {
          setCameras(devices);
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

      // Suporte a Lanterna
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

  // 1 & 2. Callback de sucesso da leitura: pausa imediatamente
  const onScanSuccess = async (decodedText) => {
    if (isPausedRef.current) return;
    isPausedRef.current = true;

    // Pausa a câmera para evitar leituras duplicadas
    try {
      html5QrCodeRef.current?.pause();
    } catch (e) {}

    // Vibração tátil
    if (typeof navigator !== "undefined" && navigator.vibrate) {
      navigator.vibrate(120);
    }
    playBeepSound();

    let displayTitle = "Hotel Fasano Salvador";
    let displayMessage = decodedText;

    // Se o QR Code lido for uma Ficha vCard (100% Offline), extrai os dados estruturados
    if (decodedText.includes("BEGIN:VCARD")) {
      const fnMatch = decodedText.match(/^FN:(.*)$/m);
      const orgMatch = decodedText.match(/^ORG:([^;\r\n]+)/m);
      const noteMatch = decodedText.match(/^NOTE:(.*)$/m);

      if (orgMatch && orgMatch[1]) {
        displayTitle = orgMatch[1].trim();
      } else if (fnMatch && fnMatch[1]) {
        displayTitle = fnMatch[1].trim();
      }

      if (noteMatch && noteMatch[1]) {
        displayMessage = noteMatch[1].replace(/\\n/g, "\n").trim();
      } else {
        const lines = [];
        if (fnMatch) lines.push(`Equipamento: ${fnMatch[1].trim()}`);
        const titleMatch = decodedText.match(/^TITLE:(.*)$/m);
        if (titleMatch) lines.push(titleMatch[1].trim());
        const roleMatch = decodedText.match(/^ROLE:(.*)$/m);
        if (roleMatch) lines.push(roleMatch[1].trim());
        const telMatch = decodedText.match(/^TEL[^:]*:(.*)$/m);
        if (telMatch) lines.push(`Suporte: ${telMatch[1].trim()}`);
        displayMessage = lines.join("\n");
      }
    }
    // Se o QR Code lido for uma URL de equipamento (/qr/QR-XXXX), busca os dados completos
    else {
      const qrMatch = decodedText.match(/\/qr\/([A-Za-z0-9_-]+)/);
      if (qrMatch && qrMatch[1]) {
        try {
          const res = await api.get(`/qrcodes/public/${qrMatch[1]}`);
          if (res.data) {
            const item = res.data;
            displayTitle = item.company || "Hotel Fasano Salvador";
            const lines = [];
            if (item.asset_name || item.title) lines.push(`Equipamento: ${item.asset_name || item.title}`);
            if (item.code) lines.push(`Patrimônio: ${item.code}`);
            if (item.collaborator) lines.push(`Responsável: ${item.collaborator}`);
            const brandModel = [item.brand, item.model].filter(Boolean).join(" • ");
            if (brandModel) lines.push(`Marca/Modelo: ${brandModel}`);
            if (item.address) lines.push(`Local: ${item.address}`);
            if (item.message) lines.push(`\nInstruções:\n"${item.message}"`);
            displayMessage = lines.join("\n");
          }
        } catch (e) {
          // Mantém texto original
        }
      }
    }

    // 3 & 4. Exibe o Modal de Alerta Nativo contendo apenas o botão "OK"
    setAlertData({
      title: displayTitle,
      message: displayMessage,
    });
  };

  const onScanFailure = () => {
    // Ignora frames sem detecção
  };

  // 5. Quando o usuário clica em "OK", o modal fecha e a câmera é reativada
  const resumeScanning = () => {
    setAlertData(null);
    try {
      html5QrCodeRef.current?.resume();
    } catch (e) {}

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

  // Gerador de tom sonoro (Beep) via Web Audio API
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
      
      {/* Header Flutuante */}
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

      {/* Viewport da Câmera */}
      <div className="relative flex-1 flex items-center justify-center bg-black overflow-hidden">
        <div 
          id={readerId} 
          className="w-full h-full flex items-center justify-center overflow-hidden [&>video]:w-full [&>video]:h-full [&>video]:object-cover"
        />

        {/* Mira de Escaneamento Estilizada */}
        {isScanning && !cameraError && (
          <div className="absolute inset-0 pointer-events-none flex flex-col items-center justify-center">
            <div className="relative w-64 h-64 sm:w-72 sm:h-72">
              <div className="absolute -top-1 -left-1 w-8 h-8 border-t-4 border-l-4 border-amber-400 rounded-tl-xl shadow-sm" />
              <div className="absolute -top-1 -right-1 w-8 h-8 border-t-4 border-r-4 border-amber-400 rounded-tr-xl shadow-sm" />
              <div className="absolute -bottom-1 -left-1 w-8 h-8 border-b-4 border-l-4 border-amber-400 rounded-bl-xl shadow-sm" />
              <div className="absolute -bottom-1 -right-1 w-8 h-8 border-b-4 border-r-4 border-amber-400 rounded-br-xl shadow-sm" />
              <div className="absolute inset-x-2 h-0.5 bg-gradient-to-r from-transparent via-amber-400 to-transparent shadow-[0_0_8px_#f59e0b] animate-[bounce_2s_infinite]" />
            </div>

            <p className="text-white text-xs font-bold mt-6 tracking-wide drop-shadow-md bg-black/40 px-3 py-1.5 rounded-full backdrop-blur-md">
              Aponte a câmera para o QR Code
            </p>
          </div>
        )}

        {/* Mensagem de Erro */}
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

      {/* 3, 4 & 5. MODAL DE ALERTA NATIVO (IOS / ANDROID) COM BOTÃO "OK" */}
      {alertData && (
        <NativeAlertDialog
          isOpen={true}
          title={alertData.title}
          message={alertData.message}
          okText="OK"
          onOk={resumeScanning}
        />
      )}

    </div>
  );
}
