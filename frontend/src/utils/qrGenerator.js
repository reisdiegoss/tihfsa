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
 * Insere caracteres zero-width space (\u200B) invisíveis aos olhos humanos em palavras-chave
 * e padrões de logradouros/cidades.
 * Isso quebra os tokens de detecção de entidades do iOS Data Detectors e Google Lens,
 * impedindo 100% que o sistema operacional trate o texto como endereço geográfico (Abrir no Mapas)
 * e garantindo a abertura do MODAL NATIVO PROPRIETÁRIO de texto do iOS / Android.
 */
export function sanitizeForNativeModal(text) {
  if (!text) return "";
  return text
    .replace(/\bR\./gi, "R\u200B.")
    .replace(/\bRua\b/gi, "Ru\u200Ba")
    .replace(/\bAv\./gi, "A\u200Bv.")
    .replace(/\bAvenida\b/gi, "Ave\u200Bnida")
    .replace(/\bPraça\b/gi, "Pra\u200Bça")
    .replace(/\bPraca\b/gi, "Pra\u200Bca")
    .replace(/\bAlameda\b/gi, "Ala\u200Bmeda")
    .replace(/\bTravessa\b/gi, "Tra\u200Bvessa")
    .replace(/\bEstrada\b/gi, "Est\u200Brada")
    .replace(/\bRodovia\b/gi, "Rodo\u200Bvia")
    .replace(/\bSalvador\b/gi, "Sal\u200Bvador")
    .replace(/\bBahia\b/gi, "Ba\u200Bhia")
    .replace(/,\s*(\d+)/g, ",\u200B $1");
}

/**
 * Formata o texto estruturado para o Modal Nativo do iOS e Android.
 */
export function formatEquipmentText(item) {
  const parts = [];
  const company = sanitizeForNativeModal(item.company || "Hotel Fasano Salvador");
  parts.push(`[${company.toUpperCase()}]`);
  parts.push(`FICHA DE IDENTIFICAÇÃO DE EQUIPAMENTO`);
  if (item.asset_name || item.title) {
    parts.push(`Equipamento: ${item.asset_name || item.title}`);
  }
  if (item.code) {
    parts.push(`Patrimônio: ${item.code}`);
  }
  if (item.collaborator) {
    parts.push(`Responsável: ${item.collaborator}`);
  }
  const brandModel = [item.brand, item.model].filter(Boolean).join(" • ");
  if (brandModel) {
    parts.push(`Marca/Modelo: ${brandModel}`);
  }
  if (item.address) {
    parts.push(`Localização: ${sanitizeForNativeModal(item.address)}`);
  }
  if (item.message) {
    parts.push(`Instruções: ${sanitizeForNativeModal(item.message)}`);
  }
  return parts.join("\n");
}

/**
 * Formata o payload para Equipamento.
 * Por padrão, utiliza Texto Sanitizado para abrir o MODAL NATIVO PROPRIETÁRIO do iOS / Android.
 * Se o modo for "url", retorna o link da página web.
 */
export function formatEquipmentPayload(item, modeOverride = null, origin = window.location.origin) {
  const mode = modeOverride || item.encode_mode || "text";
  if (mode === "url" && item.code) {
    return `${origin}/qr/${item.code}`;
  }
  return formatEquipmentText(item);
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
