import pandas as pd
import requests
from PIL import Image
from io import BytesIO
from pathlib import Path

SHEET_URL = "https://docs.google.com/spreadsheets/d/e/2PACX-1vQ9Z2C4BVz2pf5BzTj1pAtYBJydtyDgOd7itl9pF12cflFUXR26VaYxAPHARMjupx6t1g3brjMZZPhz/pub?gid=1526309505&single=true&output=csv"
IMG_DIR = Path("img/portadas")
DATA_FILE = Path("data/portadas.csv")

IMG_DIR.mkdir(parents=True, exist_ok=True)
DATA_FILE.parent.mkdir(parents=True, exist_ok=True)

def ejecutar():
    try:
        df = pd.read_csv(SHEET_URL)
        registros_finales = []

        for _, row in df.iterrows():
            url = row.get('URL')
            etiqueta = row.get('Etiqueta')
            
            if pd.isna(url) or pd.isna(etiqueta): continue
            
            nombre_archivo = f"{etiqueta.strip().lower()}.jpg"
            ruta_guardado = IMG_DIR / nombre_archivo
            
            try:
                res = requests.get(url, timeout=25)
                if res.status_code == 200:
                    img = Image.open(BytesIO(res.content))
                    if img.mode != 'RGB': img = img.convert('RGB')
                    img.thumbnail((1200, 1600), Image.Resampling.LANCZOS)
                    img.save(ruta_guardado, "JPEG", quality=85, optimize=True)
                    
                    registros_finales.append({'Diario': etiqueta.upper(), 'Imagen': f"img/portadas/{nombre_archivo}"})
                    print(f"✓ {etiqueta}")
            except Exception as e:
                print(f"✗ Error en {etiqueta}: {e}")

        pd.DataFrame(registros_finales).to_csv(DATA_FILE, index=False)
    except Exception as e:
        print(f"Error crítico: {e}")

if __name__ == "__main__":
    ejecutar()
