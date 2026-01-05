# Bingo Voice Generator

Script Python para generar archivos de audio de voces de bingo usando la API de ElevenLabs TTS.

Genera voces para:
- **Bingo 90** (números 1-90) - Formato europeo
- **Bingo 75** (números 1-75 con letras B-I-N-G-O) - Formato americano

## Requisitos

- Python 3.10+
- Cuenta de [ElevenLabs](https://elevenlabs.io) con API key

## Instalacion

1. Clonar el repositorio:
```bash
git clone git@github.com:wombat-apps/bingo-voice-generator.git
cd bingo-voice-generator
```

2. Crear entorno virtual e instalar dependencias:
```bash
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
```

3. Configurar API key de ElevenLabs:
   - Editar `generate_bingo_audio.py` y actualizar la variable `API_KEY`

## Uso

```bash
# Generar audio para un idioma (todas las voces)
python generate_bingo_audio.py --lang es-ES

# Generar audio para una voz especifica
python generate_bingo_audio.py --lang es-ES --voice manuel

# Limpiar archivos existentes y regenerar
python generate_bingo_audio.py --lang es-ES --clean
```

### Argumentos

| Argumento | Descripcion |
|-----------|-------------|
| `--lang` | Codigo de idioma (requerido). Ej: `es-ES`, `en-US`, `fr-FR` |
| `--voice` | Nombre de voz (opcional). Si no se especifica, genera todas las voces del idioma |
| `--clean` | Elimina archivos existentes antes de generar |

## Idiomas y Voces Disponibles

| Idioma | Voces |
|--------|-------|
| `es-ES` (Espanol) | lucia, manuel |
| `en-US` (Ingles) | aria |
| `fr-FR` (Frances) | marie |

## Estructura de Archivos Generados

```
out_audio/
├── es-ES/
│   ├── lucia/
│   │   ├── es-ES_lucia_1.mp3      # Bingo 90: numero 1
│   │   ├── es-ES_lucia_90.mp3     # Bingo 90: numero 90
│   │   ├── es-ES_lucia_b1.mp3     # Bingo 75: B1
│   │   └── es-ES_lucia_o75.mp3    # Bingo 75: O75
│   └── manuel/
│       └── ...
├── en-US/
│   └── aria/
│       └── ...
└── fr-FR/
    └── marie/
        └── ...
```

## Formato de Nombres

- **Bingo 90**: `{locale}_{voice}_{numero}.mp3` (ej: `es-ES_manuel_54.mp3`)
- **Bingo 75**: `{locale}_{voice}_{letra}{numero}.mp3` (ej: `es-ES_manuel_b12.mp3`)

## Configuracion

El script tiene varias opciones configurables en la seccion de configuracion:

```python
MODEL_ID = "eleven_v3"           # Modelo TTS de ElevenLabs
OUTPUT_FORMAT = "mp3_44100_128"  # Formato de salida
RATE_LIMIT_DELAY_SEC = 0.35      # Delay entre llamadas API
```

### Voice Settings

```python
VOICE_SETTINGS = {
    "stability": 0.0,            # 0.0=Creativo, 0.5=Natural, 1.0=Robusto
    "similarity_boost": 0.85,
    "style": 0.75,
    "use_speaker_boost": True
}
```

## Agregar Nuevos Idiomas/Voces

1. Agregar voice ID de ElevenLabs al diccionario `VOICES`
2. Agregar configuracion de idioma al diccionario `LANGUAGES`:
   - `digits`: palabras para digitos 0-9
   - `numbers`: palabras para numeros 1-90
   - `patterns`: patrones de pronunciacion

## Integracion con Bingo App

Los archivos generados se copian manualmente al bundle de la app iOS:
```
Modules/Sources/BingoCaller/Resources/Voices/{locale}/{voice}/
```

## Notas

- El script es **idempotente**: no regenera archivos que ya existen
- Rate limiting automatico para respetar limites de la API
- Soporta multiples voces por idioma
