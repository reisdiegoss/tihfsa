"""
Serviço de Processamento e Sincronização de Ícones PWA e Apple Touch Icon — TIHFSA.

Gera imagens em dimensões e formatos estritos para compatibilidade com:
- Apple iOS Safari (Home Screen PWA / 'Abrir como app web' sem fallback para monograma)
- Android Chrome (WebAPK Minting, safe-zone maskable e dimensões exatas 192x192 e 512x512)
- Desktop (Chrome, Edge, Windows PWA)
"""

import os
import shutil
import json
from pathlib import Path
from PIL import Image, ImageOps, ImageColor


def _hex_to_rgb(hex_str: str) -> tuple[int, int, int]:
    hex_clean = (hex_str or "#0f172a").strip().lstrip("#")
    if len(hex_clean) == 3:
        hex_clean = "".join([c * 2 for c in hex_clean])
    try:
        return ImageColor.getrgb(f"#{hex_clean}")
    except Exception:
        return (15, 23, 42)


def generate_pwa_icons_from_source(source_path: str, bg_color_hex: str = "#0f172a") -> dict[str, str]:
    """
    Gera todos os ícones necessários a partir da imagem original enviada pelo usuário:
    - icon-192.png (192x192 RGBA)
    - icon-maskable-192.png (192x192 RGBA com safe-zone 78% em fundo sólido)
    - icon-512.png (512x512 RGBA)
    - icon-maskable-512.png (512x512 RGBA com safe-zone 78% em fundo sólido)
    - apple-touch-icon.png (180x180 RGB OPACO - sem transparência para iOS Safari)
    - apple-touch-icon-180x180.png
    - apple-touch-icon-precomposed.png
    """
    if not os.path.exists(source_path) or not os.path.isfile(source_path):
        raise FileNotFoundError(f"Arquivo fonte não encontrado: {source_path}")

    bg_rgb = _hex_to_rgb(bg_color_hex)
    bg_rgba = (*bg_rgb, 255)

    # Diretório de saída dos ícones gerados
    backend_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
    out_dir = os.path.join(backend_dir, "uploads", "pwa", "generated")
    os.makedirs(out_dir, exist_ok=True)

    with Image.open(source_path) as src_raw:
        # Corrige rotação EXIF se presente
        src = ImageOps.exif_transpose(src_raw)
        src = src.convert("RGBA")

        # 1. icon-192.png (192x192 RGBA)
        icon_192 = Image.new("RGBA", (192, 192), (0, 0, 0, 0))
        thumb_192 = src.copy()
        thumb_192.thumbnail((192, 192), Image.Resampling.LANCZOS)
        offset_192 = ((192 - thumb_192.width) // 2, (192 - thumb_192.height) // 2)
        icon_192.paste(thumb_192, offset_192, thumb_192)
        p_192 = os.path.join(out_dir, "icon-192.png")
        icon_192.save(p_192, format="PNG", optimize=True)

        # 2. icon-512.png (512x512 RGBA)
        icon_512 = Image.new("RGBA", (512, 512), (0, 0, 0, 0))
        thumb_512 = src.copy()
        thumb_512.thumbnail((512, 512), Image.Resampling.LANCZOS)
        offset_512 = ((512 - thumb_512.width) // 2, (512 - thumb_512.height) // 2)
        icon_512.paste(thumb_512, offset_512, thumb_512)
        p_512 = os.path.join(out_dir, "icon-512.png")
        icon_512.save(p_512, format="PNG", optimize=True)

        # 3. icon-maskable-512.png (512x512 com safe-zone 78% em fundo sólido)
        # Especificação WebAPK: O conteúdo essencial deve estar no círculo central de raio 40% (diâmetro 80%)
        # 512 * 0.78 = ~400px
        mask_512 = Image.new("RGBA", (512, 512), bg_rgba)
        thumb_m512 = src.copy()
        thumb_m512.thumbnail((400, 400), Image.Resampling.LANCZOS)
        offset_m512 = ((512 - thumb_m512.width) // 2, (512 - thumb_m512.height) // 2)
        mask_512.paste(thumb_m512, offset_m512, thumb_m512)
        p_mask_512 = os.path.join(out_dir, "icon-maskable-512.png")
        mask_512.save(p_mask_512, format="PNG", optimize=True)

        # 4. icon-maskable-192.png (192x192 com safe-zone 78% em fundo sólido)
        # 192 * 0.78 = ~150px
        mask_192 = Image.new("RGBA", (192, 192), bg_rgba)
        thumb_m192 = src.copy()
        thumb_m192.thumbnail((150, 150), Image.Resampling.LANCZOS)
        offset_m192 = ((192 - thumb_m192.width) // 2, (192 - thumb_m192.height) // 2)
        mask_192.paste(thumb_m192, offset_m192, thumb_m192)
        p_mask_192 = os.path.join(out_dir, "icon-maskable-192.png")
        mask_192.save(p_mask_192, format="PNG", optimize=True)

        # 5. apple-touch-icon.png (180x180 RGB OPACO - SEM CANAL ALPHA)
        # CRÍTICO: iOS Safari rejeita ícones com transparência e substitui por monograma da letra inicial.
        # Deve ser estritamente modo RGB, tamanho 180x180 e fundo opaco.
        apple_icon = Image.new("RGBA", (180, 180), bg_rgba)
        thumb_apple = src.copy()
        # Se a imagem tiver canal alpha (transparência), reduz para 156x156 para margem harmônica
        thumb_apple.thumbnail((156, 156), Image.Resampling.LANCZOS)
        offset_apple = ((180 - thumb_apple.width) // 2, (180 - thumb_apple.height) // 2)
        apple_icon.paste(thumb_apple, offset_apple, thumb_apple)
        # Converte para RGB eliminando qualquer canal alpha
        apple_rgb = apple_icon.convert("RGB")
        
        p_apple = os.path.join(out_dir, "apple-touch-icon.png")
        apple_rgb.save(p_apple, format="PNG", optimize=True)

        # Variantes suportadas pelo Safari
        p_apple_180 = os.path.join(out_dir, "apple-touch-icon-180x180.png")
        p_apple_pre = os.path.join(out_dir, "apple-touch-icon-precomposed.png")
        p_apple_180_pre = os.path.join(out_dir, "apple-touch-icon-180x180-precomposed.png")
        apple_rgb.save(p_apple_180, format="PNG", optimize=True)
        apple_rgb.save(p_apple_pre, format="PNG", optimize=True)
        apple_rgb.save(p_apple_180_pre, format="PNG", optimize=True)

    return {
        "icon-192.png": p_192,
        "icon-512.png": p_512,
        "icon-maskable-512.png": p_mask_512,
        "icon-maskable-192.png": p_mask_192,
        "apple-touch-icon.png": p_apple,
        "apple-touch-icon-180x180.png": p_apple_180,
        "apple-touch-icon-precomposed.png": p_apple_pre,
        "apple-touch-icon-180x180-precomposed.png": p_apple_180_pre,
    }


def find_source_icon_path(icon_url: str | None) -> str | None:
    """Localiza o arquivo físico da imagem no servidor a partir da URL."""
    if not icon_url or not icon_url.startswith("/uploads/"):
        return None

    rel_path = icon_url.lstrip("/")
    base_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))

    possible_sources = [
        os.path.abspath(os.path.join(base_dir, rel_path)),
        os.path.abspath(os.path.join(base_dir, "..", rel_path)),
        f"/root/TIHFSA/{rel_path}",
        f"/root/TIHFSA/backend/{rel_path}",
        f"/root/tihfsa/{rel_path}",
        f"/root/tihfsa/backend/{rel_path}",
        f"/var/www/tihfsa/{rel_path}",
    ]

    for p in possible_sources:
        if os.path.exists(p) and os.path.isfile(p):
            return p
    return None


def sync_all_pwa_assets(setting) -> bool:
    """
    Sincroniza arquivos físicos do manifesto e todos os ícones PWA nas pastas públicas.
    Gera as resoluções canônicas via Pillow caso o ícone customizado esteja disponível.
    """
    from app.routers.system_settings import build_pwa_manifest_dict

    base_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
    bg_color = (setting.pwa_bg_color if setting and setting.pwa_bg_color else "#0f172a")

    # 1. Gera ícones caso haja imagem fonte
    found_src = None
    if setting and setting.pwa_icon_url:
        found_src = find_source_icon_path(setting.pwa_icon_url)

    generated_map = {}
    if found_src:
        try:
            generated_map = generate_pwa_icons_from_source(found_src, bg_color)
            print(f"[PWA] Ícones customizados gerados com sucesso a partir de {found_src}")
        except Exception as e:
            print(f"[PWA WARN] Erro ao gerar ícones com Pillow: {e}")

    # 2. Constrói e escreve o manifesto PWA atualizado
    manifest_dict = build_pwa_manifest_dict(setting)
    manifest_json_str = json.dumps(manifest_dict, ensure_ascii=False, indent=2)

    target_manifest_files = [
        os.path.abspath(os.path.join(base_dir, "..", "frontend", "public", "manifest.webmanifest")),
        os.path.abspath(os.path.join(base_dir, "..", "frontend", "dist", "manifest.webmanifest")),
        "/var/www/tihfsa/manifest.webmanifest",
    ]

    for m_path in target_manifest_files:
        try:
            if os.path.exists(os.path.dirname(m_path)):
                with open(m_path, "w", encoding="utf-8") as f:
                    f.write(manifest_json_str)
        except Exception:
            pass

    # 3. Distribui os ícones gerados (ou existentes) para as pastas de Frontend e Nginx
    target_icon_dirs = [
        os.path.abspath(os.path.join(base_dir, "..", "frontend", "public", "icons")),
        os.path.abspath(os.path.join(base_dir, "..", "frontend", "dist", "icons")),
        "/var/www/tihfsa/icons",
    ]

    root_public_dirs = [
        os.path.abspath(os.path.join(base_dir, "..", "frontend", "public")),
        os.path.abspath(os.path.join(base_dir, "..", "frontend", "dist")),
        "/var/www/tihfsa",
    ]

    if generated_map:
        for fname, fpath in generated_map.items():
            # Para diretórios /icons/
            for idir in target_icon_dirs:
                try:
                    if os.path.exists(os.path.dirname(idir)):
                        os.makedirs(idir, exist_ok=True)
                        shutil.copy(fpath, os.path.join(idir, fname))
                except Exception:
                    pass

            # Para raiz pública (apple-touch-icon na raiz do site)
            if fname.startswith("apple-touch-icon"):
                for rdir in root_public_dirs:
                    try:
                        if os.path.exists(rdir):
                            shutil.copy(fpath, os.path.join(rdir, fname))
                    except Exception:
                        pass

    return True
