import { useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import { RefreshCw, CheckCircle2 } from "lucide-react";
import api from "../../api/client";
import NativeAlertDialog from "../../components/ui/NativeAlertDialog";

export default function PublicAssetTag() {
  const { code } = useParams();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [dismissed, setDismissed] = useState(false);

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

  // Monta a mensagem formatada para o modal de alerta nativo
  const getFormattedMessage = () => {
    if (!data) return "";
    const lines = [];
    
    if (data.asset_name || data.title) {
      lines.push(`Equipamento: ${data.asset_name || data.title}`);
    }
    if (data.code) {
      lines.push(`Patrimônio: ${data.code}`);
    }
    if (data.collaborator) {
      lines.push(`Responsável: ${data.collaborator}`);
    }
    const brandModel = [data.brand, data.model].filter(Boolean).join(" • ");
    if (brandModel) {
      lines.push(`Marca/Modelo: ${brandModel}`);
    }
    if (data.address) {
      lines.push(`Local: ${data.address}`);
    }
    if (data.message) {
      lines.push(`\nInstruções:\n"${data.message}"`);
    }

    return lines.join("\n");
  };

  const handleOk = () => {
    if (data) {
      const textToCopy = getFormattedMessage();
      try {
        navigator.clipboard?.writeText(textToCopy);
      } catch (e) {}
    }
    setDismissed(true);
  };

  return (
    <div className="fixed inset-0 bg-slate-900 flex items-center justify-center p-4">
      
      {/* Loading */}
      {loading && (
        <div className="flex flex-col items-center justify-center text-white/80 p-6">
          <RefreshCw size={32} className="animate-spin text-amber-400 mb-3" />
          <p className="text-xs font-bold tracking-wide">Carregando informações...</p>
        </div>
      )}

      {/* Erro */}
      {!loading && error && (
        <NativeAlertDialog
          isOpen={true}
          title="Aviso"
          message={error}
          okText="OK"
          onOk={() => window.location.reload()}
        />
      )}

      {/* MODAL NATIVO DO IOS / ANDROID CONFORME IMAGENS ANEXADAS */}
      {!loading && data && !dismissed && (
        <NativeAlertDialog
          isOpen={true}
          title={data.company || "Hotel Fasano Salvador"}
          message={getFormattedMessage()}
          okText="OK"
          onOk={handleOk}
        />
      )}

      {/* Tela de Confirmação após Clicar em OK */}
      {dismissed && data && (
        <div className="w-full max-w-sm bg-white/10 backdrop-blur-xl border border-white/20 rounded-3xl p-8 text-center text-white space-y-4 animate-in zoom-in-95 duration-200">
          <div className="w-14 h-14 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center mx-auto">
            <CheckCircle2 size={32} />
          </div>
          <div>
            <h2 className="text-base font-bold">Informações Lidas!</h2>
            <p className="text-xs text-white/70 mt-1">
              Os dados do equipamento foram lidos e copiados para a sua área de transferência.
            </p>
          </div>
          <button
            onClick={() => setDismissed(false)}
            className="w-full py-3 bg-white text-slate-900 font-bold text-xs rounded-2xl hover:bg-white/90 active:scale-98 transition-all cursor-pointer"
          >
            Visualizar Modal Novamente
          </button>
        </div>
      )}

    </div>
  );
}
