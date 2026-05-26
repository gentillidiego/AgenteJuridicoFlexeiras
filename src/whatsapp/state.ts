// Shared state between dashboard server and WhatsApp module
type WaStatus = 'disconnected' | 'qr' | 'connected';

let _qr: string | null = null;
let _status: WaStatus = 'disconnected';
let _number: string | null = null;
let _startFn: (() => Promise<void>) | null = null;

export function setWaQr(qr: string | null) {
  _qr = qr;
  if (qr) _status = 'qr';
}

export function setWaStatus(status: WaStatus, number?: string) {
  _status = status;
  _number = number || null;
  if (status !== 'qr') _qr = null;
}

export function getWaQr() { return _qr; }
export function getWaStatus() { return { status: _status, number: _number }; }

export function registerStartFn(fn: () => Promise<void>) {
  console.log('[State] Registro da função de início do WhatsApp recebido.');
  _startFn = fn;
}

export async function triggerWaStart() {
  console.log(`[State] triggerWaStart chamado. _startFn ok: ${!!_startFn}, status: ${_status}`);
  if (_startFn && _status === 'disconnected') {
    console.log('[State] Iniciando WhatsApp via trigger...');
    await _startFn();
  } else {
    console.log('[State] Gatilho ignorado (já iniciando ou função não registrada).');
  }
}
