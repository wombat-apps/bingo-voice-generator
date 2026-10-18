/**
 * Error shapes received from Tauri commands and the Spanish messages shown for them.
 * ElevenLabs codes are listed in docs/elevenlabs-plans.md (section Errors).
 */

import type { ElevenLabsError } from '../types';

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

const PLAN_CODES = new Set([
  'subscription_required',
  'feature_not_available',
  'voice_access_denied',
  'model_access_denied',
]);

/** Message for a failed generation with the Active Account `accountName`. */
export function describeGenerationError(err: unknown, accountName: string | null): string {
  if (!isElevenLabsError(err)) return `Error al generar audio: ${errorMessage(err)}`;

  switch (err.code) {
    case 'NO_API_KEY':
      return 'Por favor, selecciona una cuenta de ElevenLabs.';
    case 'NETWORK_ERROR':
      return 'No se pudo conectar con ElevenLabs. Comprueba tu conexión a internet.';
    case 'VOICE_LIMIT_REACHED':
      return 'Has alcanzado el límite de voces de tu plan de ElevenLabs.';
    case 'API_ERROR':
      break;
  }

  const { status, apiCode, message } = err;
  const account = accountName ? ` "${accountName}"` : '';
  const voiceNotFound = `La voz seleccionada no existe en la cuenta${account}. Cambia de cuenta o selecciona otra voz.`;
  const invalidKey = `La API key de la cuenta${account} no es válida o no tiene los permisos necesarios: ${message}`;
  const planDenied = `Tu plan de ElevenLabs no permite esta operación: ${message}`;
  const busy = 'ElevenLabs está ocupado o se ha superado el límite de peticiones. Espera unos segundos y vuelve a intentarlo.';

  switch (apiCode) {
    case 'insufficient_credits':
      return 'Has alcanzado el límite de créditos de ElevenLabs. Actualiza tu plan o espera a que se renueve tu cuota.';
    case 'paid_plan_required':
      return 'El plan Free de ElevenLabs no permite usar voces de la biblioteca (Library Voices) por API. Usa una voz predeterminada o mejora tu plan.';
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
  if (apiCode && PLAN_CODES.has(apiCode)) return planDenied;

  if (status === 401) return invalidKey;
  if (status === 403) return planDenied;
  if (status === 404) return voiceNotFound;
  if (status === 429) return busy;
  if (status >= 500) return `ElevenLabs no está disponible en este momento (${status}). Inténtalo más tarde.`;
  return `Error al generar audio (${status}): ${message}`;
}
