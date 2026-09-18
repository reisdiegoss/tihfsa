import QRCode from "qrcode";

/**
 * Escapa caracteres especiais para a sintaxe Wi-Fi de QR Code
 */
export function formatWifiPayload(ssid, password, securityType = "WPA", isHidden = false) {
  const escapeStr = (str) => (str || "").replace(/([\\;,:"])/g, "\\$1");
  const sec = securityType === "nopass" ? "nopass" : (securityType || "WPA");
  const pwd = sec === "nopass" ? "" : escapeStr(password);
  return `WIFI:T:${sec};S:${escapeStr(ssid)};P:${pwd};H:${isHidden ? "true" : "false"};;`;
}

/**
 * Formata o payload para Equipamento.
 * Se tiver code, gera a URL pública (/qr/:code) que é aberta nativamente por iOS e Android.
 */
export function formatEquipmentPayload(item, origin = window.location.origin) {
  if (item.code) {
    return `${origin}/qr/${item.code}`;
  }
  // Fallback para texto caso não tenha code
  return [
    `[EQUIPAMENTO - ${item.company || "HOTEL FASANO SALVADOR"}]`,
    `Equipamento/Patrimônio: ${item.asset_name || item.title || "—"}`,
    `Colaborador/Responsável: ${item.collaborator || "—"}`,
    `Marca/Modelo: ${[item.brand, item.model].filter(Boolean).join(" ") || "—"}`,
    `Endereço/Localização: ${item.address || "—"}`,
    item.message ? `Mensagem: ${item.message}` : "",
  ].filter(Boolean).join("\n");
}

/**
 * Renderiza o QR Code no Canvas com tratamento de logo centralizada e correção de erro nível H
 */
export function renderQRCodeToCanvas(canvas, {
  text,
  size = 512,
  logoUrl = null,
  includeLogo = true,
  darkColor = "#0f172a",
  lightColor = "#ffffff",
}) {
  return new Promise((resolve, reject) => {
    if (!canvas || !text) {
      return resolve(false);
    }

    QRCode.toCanvas(
      canvas,
      text,
      {
        width: size,
        margin: 2,
        errorCorrectionLevel: "H", // Alta tolerância para permitir logo no centro
        color: {
          dark: darkColor,
          light: lightColor,
        },
      },
      (err) => {
        if (err) {
          console.error("[QRCode Render Error]", err);
          return reject(err);
        }

        // Se não tiver logo ou não for para incluir, resolve imediatamente
        if (!includeLogo || !logoUrl) {
          return resolve(true);
        }

        const ctx = canvas.getContext("2d");
        const img = new Image();
        img.crossOrigin = "anonymous";
        img.src = logoUrl;

        img.onload = () => {
          // A logo ocupa aproximadamente 22% do tamanho do QR Code
          const logoSize = Math.floor(size * 0.22);
          const x = (size - logoSize) / 2;
          const y = (size - logoSize) / 2;
          const padding = Math.max(4, Math.floor(size * 0.02));

          // Fundo branco com cantos arredondados sob a logo para excelente contraste
          ctx.fillStyle = lightColor;
          const radius = Math.max(4, Math.floor(size * 0.03));
          
          if (ctx.roundRect) {
            ctx.beginPath();
            ctx.roundRect(
              x - padding,
              y - padding,
              logoSize + padding * 2,
              logoSize + padding * 2,
              radius
            );
            ctx.fill();
          } else {
            ctx.fillRect(
              x - padding,
              y - padding,
              logoSize + padding * 2,
              logoSize + padding * 2
            );
          }

          // Desenha a imagem centralizada
          ctx.drawImage(img, x, y, logoSize, logoSize);
          resolve(true);
        };

        img.onerror = () => {
          console.warn("[QRCode Logo] Não foi possível carregar a logo para embutir no QR:", logoUrl);
          // Continua resolvendo mesmo se a logo falhar para não travar a exibição
          resolve(true);
        };
      }
    );
  });
}
