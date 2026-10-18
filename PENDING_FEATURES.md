# Funcionalidades Pendientes - Port Tauri

Listado de funcionalidades presentes en la app nativa de macOS (retirada; consultar con `git show swift-final:<ruta>`, ver `docs/adr/0001-tauri-replaces-native-swift.md`) que faltan en el port de Tauri.

---

## 1. Gestión de Voces

### 1.1 Editar voz ✅ COMPLETADO
- ✅ Cambiar nombre personalizado
- ✅ Cambiar idioma asignado
- ✅ Cambiar género

**Referencia macOS:** `swift-final:Sources/BingoVoiceGenerator/Views/Sidebar/VoiceFormSheet.swift`
**Implementación Tauri:** `src/features/voices/VoiceFormModal.tsx`

### 1.2 Voces favoritas ✅ COMPLETADO
- ✅ Marcar/desmarcar voces como favoritas (estrella)
- ✅ Ordenar favoritas primero en la lista

**Referencia macOS:** `swift-final:Sources/BingoVoiceGenerator/State/VoiceStore.swift` (propiedades `favoriteVoices`, `toggleFavorite()`)
**Implementación Tauri:** `src/features/sidebar/Sidebar.tsx` (star icon + sorting)

### 1.3 Importar voces desde ZIP
- Importar archivo ZIP con voz y audios
- Parsear `voice.yml` con metadatos
- Copiar archivos de audio al storage

**Referencia macOS:** `swift-final:Sources/BingoVoiceGenerator/Services/ImportService.swift`

### 1.4 Exportar voces a ZIP
- Exportar voz seleccionada con todos sus audios
- Generar `voice.yml` con metadatos
- Incluir audios de ambos modos (Bingo 90 y 75)

**Referencia macOS:** `swift-final:Sources/BingoVoiceGenerator/Services/ExportService.swift`

### 1.5 Sidebar de voces mejorado
- Voces agrupadas por idioma
- Búsqueda de voces por nombre
- Menú contextual (click derecho): editar, eliminar, exportar

**Referencia macOS:** `swift-final:Sources/BingoVoiceGenerator/Views/Sidebar/VoiceSidebar.swift`

---

## 2. Configuración de ElevenLabs

### 2.1 Ajustes de voz (sliders)
- **Stability:** Slider 0.0-1.0 (Creative → Natural → Robust)
- **Similarity Boost:** Slider 0.0-1.0
- **Style:** Slider 0.0-1.0 (exageración emocional)
- **Speaker Boost:** Toggle on/off (mejorar claridad)
- **Speed:** Slider 0.7-1.2 (velocidad del habla)

**Referencia macOS:** `swift-final:Sources/BingoVoiceGenerator/Views/Sidebar/VoiceSettingsSection.swift`

### 2.2 Selección de modelo TTS
- Eleven v4 (máxima calidad, por defecto)
- Eleven v4 Turbo (rápido y más barato)
- Eleven v3 (generación anterior, expresivo)
- Multilingual v2 (estable, buena lectura de números)

En la app Tauri la lista es fija en `src/types.ts` (`TTS_MODELS`). Turbo v2.5 se quitó porque ElevenLabs lo deprecó.

**Referencia macOS:** `swift-final:Sources/BingoVoiceGenerator/State/SettingsState.swift` (propiedad `selectedModel`)

### 2.3 Selección de formato de salida
- MP3 44.1kHz 128kbps (estándar, todos los planes)
- MP3 44.1kHz 192kbps (alta calidad, plan Creator o superior)
- MP3 22kHz 32kbps (tamaño pequeño)
- Formatos PCM: 16kHz, 22kHz, 44.1kHz (44.1kHz requiere plan Pro o superior)

Si se implementa, solo se deben ofrecer los formatos que permita el Plan de la Active Account. Ver `docs/elevenlabs-plans.md`.

**Referencia macOS:** `swift-final:Sources/BingoVoiceGenerator/State/SettingsState.swift` (propiedad `selectedOutputFormat`)

### 2.4 Restablecer ajustes por defecto
- Botón para resetear todos los ajustes de voz a valores predeterminados

**Referencia macOS:** `swift-final:Sources/BingoVoiceGenerator/State/SettingsState.swift` (método `resetToDefaults()`)

---

## 3. Información de Suscripción ✅ COMPLETADO

### 3.1 Panel de información de suscripción completo ✅
- ✅ Mostrar tier del plan (Free, Starter, Creator, Pro, etc.)
- ✅ Caracteres usados / límite total
- ✅ Porcentaje de uso con barra de progreso
- ✅ Código de colores (verde → naranja → rojo según uso)
- ✅ Fecha del próximo reset (formato relativo)
- ✅ Caracteres restantes

**Referencia macOS:** `swift-final:Sources/BingoVoiceGenerator/Views/Sidebar/APIKeySection.swift`
**Implementación Tauri:** `src/features/sidebar/SubscriptionInfo.tsx`

---

## 4. Barra de Reproducción (Now Playing)

### 4.1 Navegación anterior/siguiente
- Botones para ir al número anterior/siguiente
- Navegación circular (del último al primero)

**Referencia macOS:** `swift-final:Sources/BingoVoiceGenerator/Views/NowPlayingBar.swift` (botones previous/next)

### 4.2 Selector de parte (Word/Digit)
- Botones W/D para reproducir parte específica
- Indicador visual de parte actual

**Referencia macOS:** `swift-final:Sources/BingoVoiceGenerator/Views/NowPlayingBar.swift`

### 4.3 Waveform interactivo ✅ COMPLETADO
- ✅ Click para hacer seek en el audio
- ✅ Arrastrar para navegar

**Referencia macOS:** `swift-final:Sources/BingoVoiceGenerator/Views/NowPlayingBar.swift`
**Implementación Tauri:** `src/features/player/WaveformSlider.tsx`

### 4.4 Display de tiempo ✅ COMPLETADO
- ✅ Tiempo actual / duración total
- ✅ Actualización en tiempo real (50ms)
- ✅ Formato con décimas para audios cortos (< 10s)

**Referencia macOS:** `swift-final:Sources/BingoVoiceGenerator/Views/NowPlayingBar.swift`
**Implementación Tauri:** `src/features/player/WaveformSlider.tsx`, `src/services/audioPlayer.ts`

### 4.5 Contador de audios
- Indicador "X / Total" de audios generados

**Referencia macOS:** `swift-final:Sources/BingoVoiceGenerator/Views/NowPlayingBar.swift`

### 4.6 Botón regenerar
- Regenerar audio del número actual

**Referencia macOS:** `swift-final:Sources/BingoVoiceGenerator/Views/NowPlayingBar.swift`

---

## 5. Grid de Bingo

### 5.1 Menú contextual en celdas
- Click derecho con opciones:
  - Generar solo Word
  - Generar solo Digit
  - Generar ambos
  - Reproducir Word
  - Reproducir Digit
  - Eliminar audios

**Referencia macOS:** `swift-final:Sources/BingoVoiceGenerator/Views/Grid/BingoCellView.swift` (`.contextMenu`)

### 5.2 Display de duración en celdas
- Mostrar duración del audio en cada celda

**Referencia macOS:** `swift-final:Sources/BingoVoiceGenerator/Views/Grid/BingoCellView.swift`

### 5.3 Tooltips en hover
- Información adicional al pasar el ratón

**Referencia macOS:** `swift-final:Sources/BingoVoiceGenerator/Views/Grid/BingoCellView.swift` (`.help()`)

---

## 6. Procesamiento de Audio

### 6.1 Recorte automático de silencios ✅ COMPLETADO
- ✅ Eliminar silencios al final del audio generado
- Parámetros: umbral -40dB, padding 150ms, fade-out 80ms, silencio final 80ms

**Referencia macOS:** `swift-final:Sources/BingoVoiceGenerator/Services/SilenceTrimmingService.swift`
**Implementación Tauri:** `src-tauri/src/services/audio_trimmer.rs`

---

## 7. UI/UX

### 7.1 Vista de estado vacío (onboarding)
- Pantalla de bienvenida cuando no hay voces
- Guía para añadir primera voz

**Referencia macOS:** `swift-final:Sources/BingoVoiceGenerator/Views/EmptyStateView.swift`

### 7.2 Header de progreso
- Barra de progreso durante generación batch
- Porcentaje completado
- Contador completados/total

**Referencia macOS:** `swift-final:Sources/BingoVoiceGenerator/Views/Grid/ProgressHeader.swift`

---

## 8. Actualizaciones Automáticas

### 8.1 Sistema de auto-actualización
- Integración con Sparkle para actualizaciones automáticas
- Menú "Buscar actualizaciones..." (Cmd+Option+U)
- Descarga e instalación automática

**Referencia macOS:** `swift-final:Sources/BingoVoiceGenerator/Services/UpdaterService.swift`

---

## Resumen por Prioridad

### Alta prioridad (funcionalidad core)
- [x] Ajustes de voz (stability, similarity, style, speed, speaker boost)
- [x] Selección de modelo TTS
- [x] Menú contextual en celdas
- [x] Navegación anterior/siguiente en reproductor
- [x] Panel de información de suscripción

### Media prioridad (mejora UX)
- [x] Editar voz
- [x] Voces favoritas
- [x] Selector de parte W/D en reproductor
- [x] Waveform interactivo (seek)
- [x] Display de tiempo en reproductor
- [x] Recorte automático de silencios

### Baja prioridad (nice-to-have)
- [ ] Importar/exportar voces (ZIP)
- [ ] Vista de estado vacío
- [ ] Selección de formato de salida
- [ ] Actualizaciones automáticas (Sparkle/Tauri updater)
