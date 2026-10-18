# Funcionalidades Pendientes - Port Tauri

Listado de funcionalidades presentes en la app nativa de macOS (`/Volumes/Developer/bingo-voice-generator`) que faltan en el port de Tauri.

---

## 1. Gestión de Voces

### 1.1 Editar voz ✅ COMPLETADO
- ✅ Cambiar nombre personalizado
- ✅ Cambiar idioma asignado
- ✅ Cambiar género

**Referencia macOS:** `BingoVoiceGenerator/Features/Voices/VoiceFormSheet.swift`
**Implementación Tauri:** `src/features/voices/VoiceFormModal.tsx`

### 1.2 Voces favoritas ✅ COMPLETADO
- ✅ Marcar/desmarcar voces como favoritas (estrella)
- ✅ Ordenar favoritas primero en la lista

**Referencia macOS:** `BingoVoiceGenerator/Features/Voices/VoiceStore.swift` (propiedades `favoriteVoices`, `toggleFavorite()`)
**Implementación Tauri:** `src/features/sidebar/Sidebar.tsx` (star icon + sorting)

### 1.3 Importar voces desde ZIP
- Importar archivo ZIP con voz y audios
- Parsear `voice.yml` con metadatos
- Copiar archivos de audio al storage

**Referencia macOS:** `BingoVoiceGenerator/Services/ImportExportService.swift` (método `importVoice()`)

### 1.4 Exportar voces a ZIP
- Exportar voz seleccionada con todos sus audios
- Generar `voice.yml` con metadatos
- Incluir audios de ambos modos (Bingo 90 y 75)

**Referencia macOS:** `BingoVoiceGenerator/Services/ImportExportService.swift` (método `exportVoice()`)

### 1.5 Sidebar de voces mejorado
- Voces agrupadas por idioma
- Búsqueda de voces por nombre
- Menú contextual (click derecho): editar, eliminar, exportar

**Referencia macOS:** `BingoVoiceGenerator/Features/Voices/VoiceSidebar.swift`

---

## 2. Configuración de ElevenLabs

### 2.1 Ajustes de voz (sliders)
- **Stability:** Slider 0.0-1.0 (Creative → Natural → Robust)
- **Similarity Boost:** Slider 0.0-1.0
- **Style:** Slider 0.0-1.0 (exageración emocional)
- **Speaker Boost:** Toggle on/off (mejorar claridad)
- **Speed:** Slider 0.7-1.2 (velocidad del habla)

**Referencia macOS:** `BingoVoiceGenerator/Features/Settings/ElevenLabsSettingsSidebar.swift`

### 2.2 Selección de modelo TTS
- Eleven v3 (última versión, máxima calidad)
- Turbo v2 (generación rápida)
- Multilingual v2 (mejor para idiomas no ingleses)

**Referencia macOS:** `BingoVoiceGenerator/Features/Settings/SettingsState.swift` (propiedad `selectedModel`)

### 2.3 Selección de formato de salida
- MP3 44.1kHz 128kbps (estándar)
- MP3 44.1kHz 192kbps (alta calidad)
- MP3 22kHz 32kbps (tamaño pequeño)
- Formatos PCM: 16kHz, 22kHz, 44.1kHz

**Referencia macOS:** `BingoVoiceGenerator/Features/Settings/SettingsState.swift` (propiedad `selectedOutputFormat`)

### 2.4 Restablecer ajustes por defecto
- Botón para resetear todos los ajustes de voz a valores predeterminados

**Referencia macOS:** `BingoVoiceGenerator/Features/Settings/SettingsState.swift` (método `resetToDefaults()`)

---

## 3. Información de Suscripción ✅ COMPLETADO

### 3.1 Panel de información de suscripción completo ✅
- ✅ Mostrar tier del plan (Free, Starter, Creator, Pro, etc.)
- ✅ Caracteres usados / límite total
- ✅ Porcentaje de uso con barra de progreso
- ✅ Código de colores (verde → naranja → rojo según uso)
- ✅ Fecha del próximo reset (formato relativo)
- ✅ Caracteres restantes

**Referencia macOS:** `BingoVoiceGenerator/Features/Subscription/SubscriptionInfoView.swift`
**Implementación Tauri:** `src/features/sidebar/SubscriptionInfo.tsx`

---

## 4. Barra de Reproducción (Now Playing)

### 4.1 Navegación anterior/siguiente
- Botones para ir al número anterior/siguiente
- Navegación circular (del último al primero)

**Referencia macOS:** `BingoVoiceGenerator/Features/NowPlaying/NowPlayingBar.swift` (botones previous/next)

### 4.2 Selector de parte (Word/Digit)
- Botones W/D para reproducir parte específica
- Indicador visual de parte actual

**Referencia macOS:** `BingoVoiceGenerator/Features/NowPlaying/NowPlayingBar.swift`

### 4.3 Waveform interactivo ✅ COMPLETADO
- ✅ Click para hacer seek en el audio
- ✅ Arrastrar para navegar

**Referencia macOS:** `BingoVoiceGenerator/Features/NowPlaying/NowPlayingBar.swift`
**Implementación Tauri:** `src/features/player/WaveformSlider.tsx`

### 4.4 Display de tiempo ✅ COMPLETADO
- ✅ Tiempo actual / duración total
- ✅ Actualización en tiempo real (50ms)
- ✅ Formato con décimas para audios cortos (< 10s)

**Referencia macOS:** `BingoVoiceGenerator/Features/NowPlaying/NowPlayingBar.swift`
**Implementación Tauri:** `src/features/player/WaveformSlider.tsx`, `src/services/audioPlayer.ts`

### 4.5 Contador de audios
- Indicador "X / Total" de audios generados

**Referencia macOS:** `BingoVoiceGenerator/Features/NowPlaying/NowPlayingBar.swift`

### 4.6 Botón regenerar
- Regenerar audio del número actual

**Referencia macOS:** `BingoVoiceGenerator/Features/NowPlaying/NowPlayingBar.swift`

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

**Referencia macOS:** `BingoVoiceGenerator/Features/Grid/BingoCellView.swift` (`.contextMenu`)

### 5.2 Display de duración en celdas
- Mostrar duración del audio en cada celda

**Referencia macOS:** `BingoVoiceGenerator/Features/Grid/BingoCellView.swift`

### 5.3 Tooltips en hover
- Información adicional al pasar el ratón

**Referencia macOS:** `BingoVoiceGenerator/Features/Grid/BingoCellView.swift` (`.help()`)

---

## 6. Procesamiento de Audio

### 6.1 Recorte automático de silencios ✅ COMPLETADO
- ✅ Eliminar silencios al final del audio generado
- Parámetros: umbral -40dB, padding 150ms, fade-out 80ms, silencio final 80ms

**Referencia macOS:** `BingoVoiceGenerator/Services/AudioTrimmer.swift`
**Implementación Tauri:** `src-tauri/src/services/audio_trimmer.rs`

---

## 7. UI/UX

### 7.1 Vista de estado vacío (onboarding)
- Pantalla de bienvenida cuando no hay voces
- Guía para añadir primera voz

**Referencia macOS:** `BingoVoiceGenerator/Features/Voices/EmptyStateView.swift`

### 7.2 Header de progreso
- Barra de progreso durante generación batch
- Porcentaje completado
- Contador completados/total

**Referencia macOS:** `BingoVoiceGenerator/Features/Grid/ProgressHeader.swift`

---

## 8. Actualizaciones Automáticas

### 8.1 Sistema de auto-actualización
- Integración con Sparkle para actualizaciones automáticas
- Menú "Buscar actualizaciones..." (Cmd+Option+U)
- Descarga e instalación automática

**Referencia macOS:** `BingoVoiceGenerator/Services/UpdaterService.swift`

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
