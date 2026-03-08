import os
import requests
import pandas as pd
import time
import re
from pathlib import Path
from bs4 import BeautifulSoup
from PIL import Image
from io import BytesIO
import fitz  # PyMuPDF
from urllib.parse import urljoin

# --- CONFIGURACIÓN DE RUTAS Y NUBE ---
BASE_DIR = Path(__file__).resolve().parent.parent
# 1. REEMPLAZAR CON TU URL DE GOOGLE SHEETS (Publicar en la Web -> CSV)
SHEET_CSV_URL = "https://docs.google.com/spreadsheets/d/e/2PACX-1vQ9Z2C4BVz2pf5BzTj1pAtYBJydtyDgOd7itl9pF12cflFUXR26VaYxAPHARMjupx6t1g3brjMZZPhz/pub?gid=1526309505&single=true&output=csv"
CSV_LOCAL_PATH = BASE_DIR / "data" / "DATOS.csv"
CSV_TMP_PATH = BASE_DIR / "data" / "DATOS.tmp.csv"
IMG_DIR = BASE_DIR / "img" / "portadas"
IMG_DIR.mkdir(parents=True, exist_ok=True)

HEADERS = {'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'}

def peticion_segura(url, reintentos=3):
    for i in range(reintentos):
        try:
            r = requests.get(url, headers=HEADERS, timeout=25)
            if r.status_code == 200: return r
        except: time.sleep(3)
    return None

def extraer_de_pdf(pdf_url):
    res = peticion_segura(pdf_url)
    if not res: return None
    try:
        doc = fitz.open(stream=res.content, filetype="pdf")
        page = doc.load_page(0)
        zoom = 150 / 72  # 150 DPI exactos para calidad de impresión
        pix = page.get_pixmap(matrix=fitz.Matrix(zoom, zoom))
        img = Image.open(BytesIO(pix.tobytes()))
        return img
    except Exception as e:
        print(f" [!] Error PDF: {e}")
        return None

def obtener_mejor_img(soup, instruccion, url_base):
    instruccion = str(instruccion).lower().strip()
    img_tag = None

    # Rama 1: ISSUU (Prensa Chalaca)
    if "issuu" in instruccion:
        link_issuu = soup.find("a", href=re.compile(r"issuu\.com", re.I))
        if link_issuu:
            img_tag = link_issuu.find("img")
        if not img_tag: instruccion = "og:image"

    # Rama 2: ALT con REGEX (Expreso y otros)
    if "alt=" in instruccion:
        match = re.search(r'alt="([^"]*)"', instruccion, re.I)
        val_alt = match.group(1) if match else ""
        if val_alt:
            img_tag = soup.find("img", alt=re.compile(re.escape(val_alt), re.I))

    # Rama 3: CLASS / SELECTOR
    if "class=" in instruccion or "." in instruccion or "#" in instruccion:
        selector = instruccion.replace("class=", "")
        img_tag = soup.select_one(selector)

    # JERARQUÍA MAESTRA DE EXTRACCIÓN (Parseo por valor W)
    if img_tag:
        srcset = img_tag.get("srcset") or img_tag.get("data-srcset")
        if srcset:
            try:
                parts = [p.strip().split() for p in srcset.split(',')]
                urls = [(int(p[1][:-1]), p[0]) for p in parts if len(p) == 2 and 'w' in p[1].lower()]
                if urls:
                    return urljoin(url_base, sorted(urls, reverse=True)[0][1])
            except: pass
        
        for attr in ['data-src-large', 'data-src', 'src']:
            src = img_tag.get(attr)
            if src and not src.startswith('data:image'):
                return urljoin(url_base, src)

    # Rama FINAL: OG:IMAGE (Estándar o Fallback)
    if instruccion == "og:image" or not img_tag:
        meta = soup.find("meta", property="og:image")
        if meta and meta.get("content"):
            return urljoin(url_base, meta["content"])

    return None

def guardar_imagen(img, nombre_diario):
    filename = f"{nombre_diario.lower().replace(' ', '_')}.jpg"
    filepath = IMG_DIR / filename
    if img.mode != 'RGB': img = img.convert('RGB')
    if img.width != 1200:
        new_h = int(img.height * 1200 / img.width)
        img = img.resize((1200, new_h), Image.Resampling.LANCZOS)
    img.save(filepath, "JPEG", quality=85, optimize=True)
    return f"img/portadas/{filename}"

def procesar_diario(row):
    # Soporte flexible para nombres de columnas (Fix V7.1)
    diario = row.get('Diario')
    url = row.get('URL') or row.get('Url')
    instruccion = row.get('Instrucción') or row.get('Instruccion') or 'og:image'
    
    if not diario or not url:
        return None
        
    res = peticion_segura(url)
    if not res: return None
    soup = BeautifulSoup(res.text, 'html.parser')

    if "elperuano.pe" in url:
        pdf_link = soup.find("a", href=re.compile(r"epdoc2"))
        if pdf_link:
            pdf_url = urljoin(url, pdf_link['href'])
            img = extraer_de_pdf(pdf_url)
            if img: return guardar_imagen(img, diario)

    img_url = obtener_mejor_img(soup, instruccion, url)
    if img_url:
        img_res = peticion_segura(img_url)
        if img_res:
            try:
                img = Image.open(BytesIO(img_res.content))
                return guardar_imagen(img, diario)
            except: return None
    return None

def main():
    print(f"--- MOTOR OFICIAL.PE V7.1: SINCRONIZACIÓN NUBE ---")
    
    df = None
    for attempt in range(3):
        try:
            df = pd.read_csv(SHEET_CSV_URL)
            break
        except Exception as e:
            print(f" [!] Intento {attempt+1} fallido leyendo Sheets: {e}")
            time.sleep(5)

    if df is None:
        print(" [!] Fallo crítico de conexión tras 3 intentos. Abortando.")
        return

    actualizados = 0
    if 'Imagen' not in df.columns: df['Imagen'] = ""

    for i, row in df.iterrows():
        print(f" -> Procesando: {row['Diario']}")
        ruta_local = procesar_diario(row)
        if ruta_local:
            df.at[i, 'Imagen'] = ruta_local
            actualizados += 1

    if actualizados > 0:
        CSV_LOCAL_PATH.parent.mkdir(exist_ok=True)
        try:
            df.to_csv(CSV_TMP_PATH, index=False)
            if os.path.exists(CSV_LOCAL_PATH): os.remove(CSV_LOCAL_PATH)
            os.rename(CSV_TMP_PATH, CSV_LOCAL_PATH)
            print(f"\n--- ÉXITO: {actualizados} portadas procesadas ---")
        except Exception as e:
            print(f" [!] Error al guardar el CSV atómico: {e}")
    else:
        print("\n [!] Sin cambios detectados en las portadas.")

if __name__ == "__main__":
    main()
