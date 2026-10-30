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
 * Normaliza e formata o payload para QR Code de Link / URL Web.
 * Garante que a URL possua protocolo (http:// ou https://) para que qualquer câmera
 * (iOS, Android, Google Lens) a reconheça e abra diretamente no navegador.
 */
export function formatUrlPayload(url) {
  if (!url) return "";
  const trimmed = url.trim();
  if (/^[a-zA-Z]+:\/\//i.test(trimmed)) {
    return trimmed;
  }
  return `https://${trimmed}`;
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
 * Formata o payload do Equipamento como Ficha Técnica Nativa vCard 3.0.
 * Este formato é reconhecido nativamente pelas câmeras de fábrica do iOS (Apple Camera)
 * e do Android (Samsung Camera / Google Lens) de forma 100% OFFLINE, sem precisar de
 * conexão de rede, Wi-Fi interno ou navegador, abrindo diretamente a Ficha do Equipamento.
 */
export function formatEquipmentVCard(item) {
  if (!item) return "";

  const name = item.asset_name || item.title || "Equipamento TI";
  const code = item.code ? `[${item.code}] ` : "";
  const fullName = `${code}${name}`.trim();
  const company = item.company || "Hotel Fasano Salvador";
  const dept = "Tecnologia da Informação";
  const brandModel = [item.brand, item.model].filter(Boolean).join(" • ");
  
  // Extrair telefone da mensagem de suporte ou ramal
  let phone = "";
  if (item.message) {
    const phoneMatch = item.message.match(/\(?\d{2}\)?\s*9?\d{4}[-\s]?\d{4}/);
    if (phoneMatch) {
      phone = phoneMatch[0];
    }
  }

  // Montar bloco descritivo de notas
  const notes = [];
  notes.push(`FICHA DE IDENTIFICAÇÃO DE EQUIPAMENTO`);
  if (item.code) notes.push(`Patrimônio: ${item.code}`);
  if (item.asset_name || item.title) notes.push(`Equipamento: ${item.asset_name || item.title}`);
  if (item.collaborator) notes.push(`Responsável: ${item.collaborator}`);
  if (brandModel) notes.push(`Marca/Modelo: ${brandModel}`);
  if (item.address) notes.push(`Localização: ${item.address}`);
  if (item.message) notes.push(`Instruções: ${item.message}`);

  const vcardLines = [
    "BEGIN:VCARD",
    "VERSION:3.0",
    `FN:${fullName}`,
    `N:${name};;;;`,
    `ORG:${company};${dept}`,
  ];

  if (brandModel || item.code) {
    vcardLines.push(`TITLE:${[item.code ? `Patrimônio ${item.code}` : "", brandModel].filter(Boolean).join(" - ")}`);
  }

  if (item.collaborator) {
    vcardLines.push(`ROLE:Responsável: ${item.collaborator}`);
  }

  if (phone) {
    vcardLines.push(`TEL;TYPE=WORK,VOICE:${phone}`);
  }

  if (item.address) {
    vcardLines.push(`ADR;TYPE=WORK:;;${item.address};Salvador;BA;;Brasil`);
  }

  vcardLines.push(`NOTE:${notes.join(" \\n ")}`);
  vcardLines.push("END:VCARD");

  return vcardLines.join("\n");
}

/**
 * Retorna a URL base pública oficial do fassa29.
 * Se o usuário estiver acessando via fassa29 ou fassa29.fasanobr.local, preserva a origem acessada.
 * Se estiver em ambiente local (localhost / 127.0.0.1 / portas de dev), utiliza 'https://fassa29'
 * para garantir que os QR Codes gerados e impressos funcionem em qualquer celular de ponta a ponta.
 */
export function getCanonicalPublicBaseUrl(overrideOrigin = null) {
  if (overrideOrigin) {
    return overrideOrigin.replace(/\/$/, "");
  }
  if (typeof window !== "undefined" && window.location) {
    const origin = window.location.origin;
    if (origin.toLowerCase().includes("fassa29")) {
      return origin.replace(/\/$/, "");
    }
    const isDev = /localhost|127\.0\.0\.1|:5173|:3000|:8000/i.test(origin);
    if (!isDev && origin.startsWith("http")) {
      return origin.replace(/\/$/, "");
    }
  }
  return "https://fassa29";
}

/**
 * Formata o payload para Equipamento.
 * Gera SEMPRE e OBRIGATORIAMENTE o link para a URL pública oficial do fassa29:
 * https://fassa29/qr/{code}
 * Independentemente de qualquer configuração antiga (vcard/texto), garantindo
 * que tanto novos quanto antigos QR Codes abram diretamente a Ficha Pública no fassa29.
 */
export function formatEquipmentPayload(item, modeOverride = null, origin = null) {
  if (!item) return "";
  const base = getCanonicalPublicBaseUrl(origin);
  const code = item.code || "QR-CODE";

  // Equipamentos geram SEMPRE o link para a URL pública do fassa29
  return `${base}/qr/${code}`;
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
