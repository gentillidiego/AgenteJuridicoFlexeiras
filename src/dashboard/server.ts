import express from 'express';
import multer from 'multer';
import cors from 'cors';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { exec } from 'child_process';
import { promisify } from 'util';
import { getWaQr, getWaStatus, triggerWaStart } from '../whatsapp/state.js';

const execAsync = promisify(exec);
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '../../');
const ENV_PATH = path.join(ROOT, '.env');
const DASHBOARD_PATH = path.join(ROOT, 'dashboard');
const GOG = `${process.env.HOME}/.local/bin/gog`;

// ─── .env helpers ────────────────────────────────────────────────
function readEnv(): Record<string, string> {
  if (!fs.existsSync(ENV_PATH)) return {};
  const lines = fs.readFileSync(ENV_PATH, 'utf-8').split('\n');
  const result: Record<string, string> = {};
  for (const line of lines) {
    const match = line.match(/^([^#=]+)=(.*)$/);
    if (match) result[match[1].trim()] = match[2].trim();
  }
  return result;
}

function writeEnv(vars: Record<string, string>): void {
  const current = readEnv();
  const merged = { ...current, ...vars };
  const lines = Object.entries(merged).map(([k, v]) => `${k}=${v}`);
  fs.writeFileSync(ENV_PATH, lines.join('\n') + '\n');
}

// ─── Server ──────────────────────────────────────────────────────
const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static(DASHBOARD_PATH));

const upload = multer({ dest: '/tmp/' });

// ── Status ──────────────────────────────────────────────────────
app.get('/api/status', async (req, res) => {
  const env = readEnv();

  let googleStatus = 'not_configured';
  let googleAccount = '';
  try {
    const { stdout } = await execAsync(`${GOG} auth list 2>&1`);
    if (stdout.includes('@')) {
      googleStatus = 'authenticated';
      const match = stdout.match(/[\w.-]+@[\w.-]+\.\w+/);
      googleAccount = match ? match[0] : '';
    } else {
      googleStatus = 'no_auth';
    }
  } catch { googleStatus = 'not_configured'; }

  const waState = getWaStatus();

  res.json({
    telegram: env.TELEGRAM_BOT_TOKEN ? 'configured' : 'missing',
    groq: env.GROQ_API_KEY ? 'configured' : 'missing',
    elevenlabs: env.ELEVENLABS_API_KEY ? 'configured' : 'missing',
    google: googleStatus,
    googleAccount,
    whatsapp: waState.status,
    waNumber: waState.number,
    waEnabled: env.WHATSAPP_ENABLED === 'true',
  });
});

// ── Config ──────────────────────────────────────────────────────
app.get('/api/config', (req, res) => {
  const env = readEnv();
  const sensitiveKeys = ['TELEGRAM_BOT_TOKEN', 'GROQ_API_KEY', 'OPENROUTER_API_KEY', 'ELEVENLABS_API_KEY'];
  const safe: Record<string, string> = {};
  for (const [k, v] of Object.entries(env)) {
    if (sensitiveKeys.includes(k) && v.length > 8) {
      safe[k] = '••••••••' + v.slice(-4);
    } else {
      safe[k] = v;
    }
  }
  res.json(safe);
});

app.post('/api/config', (req, res) => {
  try {
    const updates: Record<string, string> = req.body;
    const filtered: Record<string, string> = {};
    for (const [k, v] of Object.entries(updates)) {
      if (!v.includes('••')) filtered[k] = v;
    }
    writeEnv(filtered);
    res.json({ ok: true, message: 'Configurações salvas! Reinicie o bot para aplicar.' });
  } catch (e: any) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

// ── Google ──────────────────────────────────────────────────────
app.post('/api/google/upload', upload.single('credential'), async (req, res) => {
  if (!req.file) return res.status(400).json({ ok: false, error: 'Nenhum arquivo enviado' });
  try {
    const dest = path.join(ROOT, req.file.originalname);
    fs.copyFileSync(req.file.path, dest);
    fs.unlinkSync(req.file.path);
    await execAsync(`${GOG} auth credentials "${dest}"`);
    res.json({ ok: true, file: req.file.originalname });
  } catch (e: any) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

app.post('/api/google/auth', async (req, res) => {
  const account = req.body.account || 'gentillidiego@gmail.com';
  try {
    exec(`${GOG} auth add ${account} --services gmail,calendar,drive,contacts,docs,sheets`);
    res.json({ ok: true, message: `Fluxo OAuth iniciado para ${account}. Autorize no navegador.` });
  } catch (e: any) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

app.get('/api/google/status', async (req, res) => {
  try {
    const { stdout } = await execAsync(`${GOG} auth list 2>&1`);
    const accounts = stdout.match(/[\w.-]+@[\w.-]+\.\w+/g) || [];
    res.json({ ok: true, authenticated: accounts.length > 0, accounts });
  } catch {
    res.json({ ok: true, authenticated: false, accounts: [] });
  }
});

app.post('/api/google/disconnect', async (req, res) => {
  const account = req.body.account;
  try {
    await execAsync(`${GOG} auth remove ${account} 2>&1`);
    res.json({ ok: true });
  } catch (e: any) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

// ── WhatsApp ────────────────────────────────────────────────────
app.get('/api/whatsapp/status', (req, res) => {
  const waState = getWaStatus();
  const qr = getWaQr();
  res.json({ status: waState.status, number: waState.number, qr: qr ? true : false });
});

app.get('/api/whatsapp/qr', async (req, res) => {
  const qrRaw = getWaQr();
  if (!qrRaw) return res.json({ ok: false, qr: null });
  try {
    const QRCode = (await import('qrcode')).default;
    const dataUrl = await QRCode.toDataURL(qrRaw);
    res.json({ ok: true, qr: dataUrl });
  } catch (e: any) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

app.post('/api/whatsapp/connect', async (req, res) => {
  if (req.body.numbers) writeEnv({ WHATSAPP_ALLOWED_NUMBERS: req.body.numbers });
  writeEnv({ WHATSAPP_ENABLED: 'true' });

  // Inicia o WhatsApp dinamicamente sem precisar reiniciar o bot
  try {
    await triggerWaStart();
    res.json({ ok: true, message: 'WhatsApp iniciado! Aguarde o QR code aparecer.' });
  } catch (e: any) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

app.post('/api/whatsapp/disconnect', (req, res) => {
  writeEnv({ WHATSAPP_ENABLED: 'false' });
  const sessionDir = path.join(ROOT, 'whatsapp-session');
  if (fs.existsSync(sessionDir)) {
    fs.rmSync(sessionDir, { recursive: true });
  }
  res.json({ ok: true, message: 'WhatsApp desconectado e sessão limpa.' });
});

// ─── Training (Personality) ──────────────────────────────────────
const PERSONALITY_PATH = path.join(ROOT, 'personality.md');

app.get('/api/training/status', (req, res) => {
  const exists = fs.existsSync(PERSONALITY_PATH);
  let content = '';
  if (exists) {
    content = fs.readFileSync(PERSONALITY_PATH, 'utf-8');
  }
  res.json({ ok: true, exists, content: content.substring(0, 500) + (content.length > 500 ? '...' : '') });
});

app.post('/api/training/upload', upload.single('training'), (req, res) => {
  if (!req.file) return res.status(400).json({ ok: false, error: 'Nenhum arquivo enviado' });
  try {
    fs.copyFileSync(req.file.path, PERSONALITY_PATH);
    fs.unlinkSync(req.file.path);
    res.json({ ok: true, message: 'Arquivo de treinamento carregado com sucesso!' });
  } catch (e: any) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

export function startDashboard(port = 3333): void {
  app.listen(port, () => {
    console.log(`[Dashboard] ✅ Painel disponível em http://localhost:${port}`);
  });
}
