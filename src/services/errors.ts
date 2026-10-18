/**
 * Error shapes received from Tauri commands and the Spanish messages shown for them.
 * ElevenLabs codes are listed in docs/elevenlabs-plans.md (section Errors).
 */

import type { ElevenLabsError } from '../types';
import { planErrorMessage } from '../domain/plan';

export function isElevenLabsError(err: unknown): err is ElevenLabsError {
  return (
    typeof err === 'object' &&
    err !== null &&
    typeof (err as { code?: unknown }).code === 'string' &&
    typeof (err as { message?: unknown }).message === 'string'
  );
}

/** Readable message for any error: `Error`, string, or a plain object with a `message`. */
export function errorMessage(err: unknown): string {
  if (err instanceof Error) return err.message;
  if (typeof err === 'string') return err;
  if (typeof err === 'object' && err !== null) {
    const { message } = err as { message?: unknown };
    if (typeof message === 'string') return message;
  }
  return 'Error desconocido';
}

/** Message for a failed generation with the Active Account `accountName`. */
export function describeGenerationError(err: unknown, accountName: string | null): string {
  if (!isElevenLabsError(err)) return `Error al generar audio: ${errorMessage(err)}`;

  switch (err.code) {
    case 'NO_ACTIVE_ACCOUNT':
      return 'Por favor, selecciona una cuenta de ElevenLabs.';
    case 'ACCOUNT_ERROR':
      return `No se pudo leer la API key de la cuenta del Llavero: ${err.message}`;
    case 'NETWORK_ERROR':
      return 'No se pudo conectar con ElevenLabs. Comprueba tu conexión a internet.';
    case 'NO_DIGIT':
    case 'STORAGE_ERROR':
      return `Error al generar audio: ${err.message}`;
    case 'API_ERROR':
      break;
  }

  const { status, apiCode, message } = err;
  const account = accountName ? ` "${accountName}"` : '';
  const voiceNotFound = `La voz seleccionada no existe en la cuenta${account}. Cambia de cuenta o selecciona otra voz.`;
  const invalidKey = `La API key de la cuenta${account} no es válida o no tiene los permisos necesarios: ${message}`;
  const busy = 'ElevenLabs está ocupado o se ha superado el límite de peticiones. Espera unos segundos y vuelve a intentarlo.';

  switch (apiCode) {
    case 'insufficient_credits':
      return 'Has alcanzado el límite de créditos de ElevenLabs. Actualiza tu plan o espera a que se renueve tu cuota.';
    case 'invalid_api_key':
    case 'unauthorized':
      return invalidKey;
    case 'voice_not_found':
    case 'voice_does_not_exist':
      return voiceNotFound;
    case 'concurrent_limit_exceeded':
      return 'Demasiadas peticiones simultáneas a ElevenLabs. Espera a que terminen las demás y vuelve a intentarlo.';
    case 'rate_limit_exceeded':
    case 'system_busy':
      return busy;
  }
  const plan = planErrorMessage(apiCode, status, message);
  if (plan) return plan;

  if (status === 401) return invalidKey;
  if (status === 404) return voiceNotFound;
  if (status === 429) return busy;
  if (status >= 500) return `ElevenLabs no está disponible en este momento (${status}). Inténtalo más tarde.`;
  return `Error al generar audio (${status}): ${message}`;
}
