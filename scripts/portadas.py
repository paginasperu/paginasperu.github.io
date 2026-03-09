import pandas as pd
import requests
from PIL import Image
from io import BytesIO
from pathlib import Path
import sys

# Configuración de rutas (Subimos un nivel desde 'scripts' a la raíz)
BASE_DIR = Path(__file__).resolve().parent.parent
SHEET_URL = "https://docs.google.com/spreadsheets/d/e/2PACX-1vQ9Z2C4BVz2pf5BzTj1pAtYBJydtyDgOd7itl9pF12cflFUXR26VaYxAPHARMjupx6t1g3brjMZZPhz/pub?gid=1526309505&single=true&output=csv"

IMG_DIR = BASE_DIR / "img" / "portadas"
DATA_FILE = BASE_DIR / "data" / "portadas.csv"

# Asegurar directorios en la raíz
IMG_DIR.mkdir(parents=True, exist_ok=True)
DATA_FILE.parent.mkdir(parents=True, exist_ok=True)

def ejecutar():
    try:
        print(f"Leyendo datos desde Google Sheets...")
        df = pd.read_csv(SHEET_URL)
        
        if 'URL' not in df.columns or 'Etiqueta' not in df.columns:
            print(f"Error: Columnas no encontradas. Detectadas: {df.columns.tolist()}")
            sys.exit(1)

        registros_finales = []

        for _, row in df.iterrows():
            url = row['URL']
            etiqueta = row['Etiqueta']
            
            if pd.isna(url) or pd.isna(etiqueta):
                continue
            
            nombre_archivo = f"{str(etiqueta).strip().lower()}.jpg"
            ruta_guardado = IMG_DIR / nombre_archivo
            
            try:
                res = requests.get(url, timeout=25)
                if res.status_code == 200:
                    img = Image.open(BytesIO(res.content))
                    if img.mode != 'RGB': img = img.convert('RGB')
                    
                    # Optimización: 1200px de ancho para web rápida
                    img.thumbnail((1200, 1600), Image.Resampling.LANCZOS)
                    img.save(ruta_guardado, "JPEG", quality=85, optimize=True)
                    
                    # Ruta relativa que leerá el index.html
                    registros_finales.append({
                        'Diario': str(etiqueta).upper(),
                        'Imagen': f"img/portadas/{nombre_archivo}"
                    })
                    print(f"✓ {etiqueta} procesado")
            except Exception as e:
                print(f"✗ Error descargando {etiqueta}: {e}")

        if registros_finales:
            pd.DataFrame(registros_finales).to_csv(DATA_FILE, index=False)
            print(f"Éxito: {DATA_FILE} actualizado.")
        else:
            print("No se generaron registros nuevos.")

    except Exception as e:
        print(f"ERROR CRÍTICO: {e}")
        sys.exit(1)

if __name__ == "__main__":
    ejecutar()
