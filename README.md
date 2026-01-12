# Bingo Voice Generator

Aplicacion nativa macOS para generar archivos de audio de numeros de bingo usando la API de ElevenLabs TTS.

## Caracteristicas

- **Bingo 90** (numeros 1-90) - Formato europeo
- **Bingo 75** (numeros 1-75 con letras B-I-N-G-O) - Formato americano
- Generacion individual o regeneracion de audios
- Reproduccion de audios generados
- Almacenamiento seguro de API key en Keychain
- Actualizaciones automaticas via Sparkle

## Idiomas y Voces

| Idioma | Voces |
|--------|-------|
| Espanol (es-ES) | Lucia, Manuel |
| Ingles (en-US) | Aria |
| Frances (fr-FR) | Marie |

## Requisitos

- macOS 14 o superior
- Swift 6.2+
- Cuenta de [ElevenLabs](https://elevenlabs.io) con API key

## Instalacion

```bash
git clone git@github.com:wombat-apps/bingo-voice-generator.git
cd bingo-voice-generator
swift build
```

## Uso

### Compilar y Ejecutar

```bash
# Opcion 1: Comando directo
swift build && ./.build/arm64-apple-macosx/debug/BingoVoiceGenerator

# Opcion 2: Script de conveniencia
./Scripts/compile_and_run.sh
```

### Compilar para Distribucion

```bash
# Build release con code signing
./Scripts/package_app.sh release
```

### Configurar API Key

1. Abrir la aplicacion
2. Ir a Settings (Cmd+,)
3. Ingresar tu API key de ElevenLabs

## Estructura de Archivos Generados

Los audios se guardan en:

```
~/Library/Application Support/BingoVoiceGenerator/
├── es-ES/
│   ├── lucia/
│   │   ├── bingo90/
│   │   │   ├── 1.mp3
│   │   │   └── ...
│   │   └── bingo75/
│   │       ├── 1.mp3
│   │       └── ...
│   └── manuel/
│       └── ...
├── en-US/
│   └── aria/
│       └── ...
└── fr-FR/
    └── marie/
        └── ...
```

## Configuracion de Voz (ElevenLabs)

```swift
voiceSettings = [
    "stability": 0.0,           // 0.0=Creativo, 0.5=Natural, 1.0=Robusto
    "similarity_boost": 0.85,
    "style": 0.75,
    "use_speaker_boost": true
]
```

## Agregar Nuevos Idiomas/Voces

1. Agregar caso al enum `Language` en `Sources/BingoVoiceGenerator/Models/Language.swift`
2. Agregar configuracion de idioma en `Sources/BingoVoiceGenerator/Config/NumberWords.swift`
3. Agregar voice ID de ElevenLabs en `Sources/BingoVoiceGenerator/Models/Voice.swift`

## Stack Tecnologico

- **Framework**: SwiftUI
- **Lenguaje**: Swift 6 (strict concurrency)
- **Plataforma**: macOS 14+
- **Dependencias**: Sparkle 2.8.0 (actualizaciones automaticas)
