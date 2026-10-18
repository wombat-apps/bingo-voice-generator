import { error as logError, warn as logWarn } from '@tauri-apps/plugin-log';

// Tauri errors arrive as plain objects, so stringify them instead of printing "[object Object]".
function formatArg(arg: unknown): string {
  if (arg instanceof Error) return arg.stack ?? `${arg.name}: ${arg.message}`;
  if (typeof arg === 'string') return arg;
  try {
    return JSON.stringify(arg);
  } catch {
    return String(arg);
  }
}

function format(args: unknown[]): string {
  return args.map(formatArg).join(' ');
}

// Sending a log line goes through IPC, and Tauri's IPC warns when it falls back to
// postMessage. Forwarding that warning would send another line and warn again, forever.
const IPC_FALLBACK_WARNING = 'IPC custom protocol failed';

function forward(send: (message: string) => Promise<void>, args: unknown[]): void {
  const message = format(args);
  if (message.includes(IPC_FALLBACK_WARNING)) return;
  send(message).catch(() => {});
}

/**
 * Mirrors console.error/console.warn and uncaught errors into the app log file
 * (~/Library/Logs/com.wombatapps.bingovoicegenerator/), so they survive outside devtools.
 */
export function forwardConsoleToLog(): void {
  if (!('__TAURI_INTERNALS__' in window)) return;

  const originalError = console.error.bind(console);
  const originalWarn = console.warn.bind(console);

  console.error = (...args: unknown[]) => {
    originalError(...args);
    forward(logError, args);
  };
  console.warn = (...args: unknown[]) => {
    originalWarn(...args);
    forward(logWarn, args);
  };

  window.addEventListener('error', (event) => {
    forward(logError, ['Uncaught error:', event.error ?? event.message]);
  });
  window.addEventListener('unhandledrejection', (event) => {
    forward(logError, ['Unhandled rejection:', event.reason]);
  });
}
