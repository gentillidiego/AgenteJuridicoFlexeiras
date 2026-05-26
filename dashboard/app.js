const API = '';  // same origin

// ─── Tabs ──────────────────────────────────────────────────────
document.querySelectorAll('.tab').forEach(tab => {
  tab.addEventListener('click', () => {
    document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.tab-content').forEach(t => t.classList.remove('active'));
    tab.classList.add('active');
    document.getElementById('tab-' + tab.dataset.tab).classList.add('active');
    
    // Auto-load tab data
    if (tab.dataset.tab === 'credentials') loadConfig();
    if (tab.dataset.tab === 'google') refreshStatus();
    if (tab.dataset.tab === 'whatsapp') refreshStatus();
    if (tab.dataset.tab === 'training') loadTrainingStatus();
  });
});

// ─── Training ───────────────────────────────────────────────────
async function loadTrainingStatus() {
  const preview = document.getElementById('activePersonality');
  if (!preview) return;
  preview.innerText = '⏳ Carregando...';
  try {
    const res = await fetch(`${API}/api/training/status`);
    const data = await res.json();
    if (data.exists) {
      preview.innerText = data.content || 'Arquivo vazio ou sem conteúdo legível.';
    } else {
      preview.innerText = 'Nenhuma personalidade personalizada carregada. O agente está usando o perfil padrão.';
    }
  } catch (e) {
    preview.innerText = '❌ Erro ao carregar status de treinamento.';
  }
}

async function uploadTraining(input) {
  const file = input.files[0];
  if (!file) return;

  const status = document.getElementById('trainingStatus');
  const fileNameDisplay = document.getElementById('trainingFileName');
  
  status.classList.remove('hidden', 'success', 'error');
  status.innerText = '⏳ Enviando...';
  fileNameDisplay.innerText = file.name;

  const formData = new FormData();
  formData.append('training', file);

  try {
    const res = await fetch(`${API}/api/training/upload`, {
      method: 'POST',
      body: formData
    });
    const data = await res.json();
    if (data.ok) {
      status.innerText = '✅ Personalidade atualizada!';
      status.classList.add('success');
      toast('Agente treinado com sucesso!');
      loadTrainingStatus();
    } else {
      throw new Error(data.error);
    }
  } catch (e) {
    status.innerText = '❌ Erro: ' + e.message;
    status.classList.add('error');
  }
}

// ─── Toast ──────────────────────────────────────────────────────
let toastTimer;
function toast(msg, type = 'success') {
  const el = document.getElementById('toast');
  el.textContent = msg;
  el.className = `toast ${type}`;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.add('hidden'), 4000);
}

// ─── Status bar ──────────────────────────────────────────────────
async function refreshStatus() {
  try {
    const r = await fetch(`${API}/api/status`);
    const s = await r.json();

    setPill('st-telegram', s.telegram === 'configured');
    setPill('st-groq', s.groq === 'configured');
    setPill('st-elevenlabs', s.elevenlabs === 'configured');
    setPill('st-google', s.google === 'authenticated', s.google === 'not_configured' ? 'err' : 'warn');
    setPill('st-whatsapp', s.whatsapp === 'connected', s.whatsapp === 'disconnected' ? 'err' : 'warn');

    // WhatsApp panel sync
    document.getElementById('waEnabled').checked = s.waEnabled;
    if (s.whatsapp === 'connected') showWaConnected(s.waNumber);
    else if (s.whatsapp === 'qr') pollQR();

    // Google details
    document.getElementById('googleDetails').innerHTML = s.google === 'authenticated'
      ? `<span style="color:var(--green)">✅ Autenticado como <strong>${s.googleAccount}</strong></span>`
      : `<span style="color:var(--text-muted)">Não autenticado</span>`;
  } catch (e) { console.error('Status error', e); }
}

function setPill(id, ok, warnClass = 'warn') {
  const el = document.getElementById(id);
  el.className = 'status-pill ' + (ok ? 'ok' : warnClass);
}

// ─── Load config ──────────────────────────────────────────────────
async function loadConfig() {
  try {
    const r = await fetch(`${API}/api/config`);
    const cfg = await r.json();
    for (const [k, v] of Object.entries(cfg)) {
      const el = document.getElementById(k);
      if (el) el.value = v;
    }
  } catch (e) { console.error('Config load error', e); }
}

// ─── Save credentials form ────────────────────────────────────────
document.getElementById('credForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const data = {};
  new FormData(e.target).forEach((v, k) => { data[k] = v; });
  try {
    const r = await fetch(`${API}/api/config`, { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify(data) });
    const j = await r.json();
    toast(j.message || 'Salvo!', j.ok ? 'success' : 'error');
  } catch { toast('Erro ao salvar', 'error'); }
});

// ─── Save advanced form ───────────────────────────────────────────
document.getElementById('advancedForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const data = {};
  new FormData(e.target).forEach((v, k) => { data[k] = v; });
  try {
    const r = await fetch(`${API}/api/config`, { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify(data) });
    const j = await r.json();
    toast(j.message || 'Salvo!', j.ok ? 'success' : 'error');
  } catch { toast('Erro ao salvar', 'error'); }
});

// ─── Toggle password visibility ──────────────────────────────────
function togglePass(btn) {
  const input = btn.previousElementSibling;
  input.type = input.type === 'password' ? 'text' : 'password';
  btn.textContent = input.type === 'password' ? '👁' : '🙈';
}

// ─── Upload credentials ──────────────────────────────────────────
async function uploadCredentials(input) {
  const file = input.files[0];
  if (!file) return;
  const statusEl = document.getElementById('uploadStatus');
  statusEl.className = 'upload-status';
  statusEl.textContent = '⏳ Enviando...';
  statusEl.classList.remove('hidden');

  const fd = new FormData();
  fd.append('credential', file);
  try {
    const r = await fetch(`${API}/api/google/upload`, { method: 'POST', body: fd });
    const j = await r.json();
    if (j.ok) {
      statusEl.classList.add('success');
      statusEl.textContent = `✅ Arquivo ${j.file} carregado com sucesso!`;
    } else {
      statusEl.classList.add('error');
      statusEl.textContent = `❌ Erro: ${j.error}`;
    }
  } catch (e) {
    statusEl.classList.add('error');
    statusEl.textContent = '❌ Erro ao enviar arquivo.';
  }
}

// Drag and drop
const uploadArea = document.getElementById('uploadArea');
uploadArea.addEventListener('dragover', e => { e.preventDefault(); uploadArea.classList.add('dragover'); });
uploadArea.addEventListener('dragleave', () => uploadArea.classList.remove('dragover'));
uploadArea.addEventListener('drop', e => {
  e.preventDefault(); uploadArea.classList.remove('dragover');
  const file = e.dataTransfer.files[0];
  if (file) {
    const dt = new DataTransfer();
    dt.items.add(file);
    document.getElementById('jsonFile').files = dt.files;
    uploadCredentials(document.getElementById('jsonFile'));
  }
});

// ─── Google Auth ─────────────────────────────────────────────────
async function authGoogle() {
  const account = document.getElementById('googleAccount').value;
  const statusEl = document.getElementById('googleStatus');
  statusEl.className = 'status-box';
  statusEl.innerHTML = '⏳ Iniciando autorização...';
  statusEl.classList.remove('hidden');

  try {
    const r = await fetch(`${API}/api/google/auth`, {
      method: 'POST', headers: {'Content-Type':'application/json'},
      body: JSON.stringify({ account })
    });
    const j = await r.json();
    statusEl.innerHTML = `<p style="color:var(--yellow)">🔐 ${j.message}<br><br>Uma nova janela/aba deve ter aberto para autorizar. Volte aqui após autorizar.</p>`;
    setTimeout(refreshStatus, 5000);
  } catch {
    statusEl.innerHTML = '<p style="color:var(--red)">❌ Erro ao iniciar autorização.</p>';
  }
}

async function disconnectGoogle() {
  const account = document.getElementById('googleAccount').value;
  if (!confirm(`Desconectar ${account} do Google?`)) return;
  try {
    await fetch(`${API}/api/google/disconnect`, { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify({ account }) });
    toast('Conta Google desconectada.', 'success');
    refreshStatus();
  } catch { toast('Erro ao desconectar.', 'error'); }
}

// ─── WhatsApp ────────────────────────────────────────────────────
async function toggleWhatsApp(checkbox) {
  const numbers = document.getElementById('WHATSAPP_ALLOWED_NUMBERS').value;
  if (checkbox.checked) {
    if (!numbers.trim()) {
      toast('Informe ao menos um número permitido antes de ativar.', 'error');
      checkbox.checked = false; return;
    }
    await fetch(`${API}/api/whatsapp/connect`, { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify({ numbers }) });
    toast('WhatsApp habilitado. Reinicie o bot e gere o QR.', 'success');
  } else {
    await disconnectWhatsApp();
  }
}

let qrPollInterval;
async function generateQR() {
  const numbers = document.getElementById('WHATSAPP_ALLOWED_NUMBERS').value;
  document.getElementById('waStatusBox').classList.add('hidden');
  document.getElementById('qrContainer').classList.remove('hidden');
  document.getElementById('waConnectedBox').classList.add('hidden');
  
  // Garante que o backend inicie o processo do WhatsApp
  try {
    await fetch(`${API}/api/whatsapp/connect`, { 
      method: 'POST', 
      headers: {'Content-Type':'application/json'}, 
      body: JSON.stringify({ numbers }) 
    });
  } catch (e) { console.error('Error starting WhatsApp', e); }

  await pollQR();
  clearInterval(qrPollInterval);
  qrPollInterval = setInterval(pollQR, 8000);
}

async function pollQR() {
  try {
    const r = await fetch(`${API}/api/whatsapp/qr`);
    const j = await r.json();
    if (j.ok && j.qr) {
      document.getElementById('qrCode').innerHTML = `<img src="${j.qr}" alt="QR Code WhatsApp">`;
      document.getElementById('qrTimer').textContent = 'QR atualiza automaticamente a cada 8s';
    }
    // Check if connected
    const sr = await fetch(`${API}/api/whatsapp/status`);
    const ss = await sr.json();
    if (ss.status === 'connected') {
      clearInterval(qrPollInterval);
      showWaConnected(ss.number);
    }
  } catch (e) { console.error('QR poll error', e); }
}

function showWaConnected(number) {
  document.getElementById('waStatusBox').classList.add('hidden');
  document.getElementById('qrContainer').classList.add('hidden');
  document.getElementById('waConnectedBox').classList.remove('hidden');
  document.getElementById('waNumber').textContent = `+${number || '...'}`;
  setPill('st-whatsapp', true);
}

async function disconnectWhatsApp() {
  if (!confirm('Desconectar o WhatsApp e limpar sessão?')) return;
  clearInterval(qrPollInterval);
  await fetch(`${API}/api/whatsapp/disconnect`, { method: 'POST' });
  document.getElementById('waStatusBox').classList.remove('hidden');
  document.getElementById('qrContainer').classList.add('hidden');
  document.getElementById('waConnectedBox').classList.add('hidden');
  document.getElementById('waEnabled').checked = false;
  toast('WhatsApp desconectado.', 'success');
  refreshStatus();
}

// ─── Help modals ──────────────────────────────────────────────────
const HELP = {
  telegram_token: {
    title: '🤖 Como obter o Token do Telegram',
    body: `
      <p>O Token é a chave que identifica o seu bot no Telegram. Você o obtém pelo <strong>@BotFather</strong>.</p>
      <div class="step"><div class="step-num">1</div><div>Abra o Telegram e pesquise por <code>@BotFather</code></div></div>
      <div class="step"><div class="step-num">2</div><div>Envie <code>/newbot</code> e siga as instruções</div></div>
      <div class="step"><div class="step-num">3</div><div>Escolha um nome e um username (deve terminar em <code>bot</code>)</div></div>
      <div class="step"><div class="step-num">4</div><div>O BotFather enviará uma mensagem com o token no formato <code>1234567890:AAH...</code></div></div>
      <div class="step"><div class="step-num">5</div><div>Copie e cole o token aqui</div></div>
    `
  },
  telegram_ids: {
    title: '🆔 Como descobrir seu User ID do Telegram',
    body: `
      <p>O User ID é o identificador numérico único da sua conta, necessário para a whitelist de segurança.</p>
      <div class="step"><div class="step-num">1</div><div>Abra o Telegram e pesquise por <code>@userinfobot</code></div></div>
      <div class="step"><div class="step-num">2</div><div>Envie qualquer mensagem para ele</div></div>
      <div class="step"><div class="step-num">3</div><div>Ele responderá com seu ID numérico (ex: <code>83013502</code>)</div></div>
      <div class="step"><div class="step-num">4</div><div>Para múltiplos usuários, separe por vírgula: <code>83013502,987654321</code></div></div>
    `
  },
  groq: {
    title: '🧠 Como obter a chave da Groq',
    body: `
      <p>A Groq oferece o Llama 3.3 70B gratuitamente com limites generosos (~100 req/min).</p>
      <div class="step"><div class="step-num">1</div><div>Acesse <a href="https://console.groq.com" target="_blank">console.groq.com</a></div></div>
      <div class="step"><div class="step-num">2</div><div>Crie uma conta (pode usar Google/GitHub)</div></div>
      <div class="step"><div class="step-num">3</div><div>Vá em <strong>API Keys → Create API Key</strong></div></div>
      <div class="step"><div class="step-num">4</div><div>Copie a chave gerada (começa com <code>gsk_</code>)</div></div>
    `
  },
  openrouter: {
    title: '🔀 Como obter a chave do OpenRouter',
    body: `
      <p>O OpenRouter é usado como fallback caso a Groq falhe. Tem modelos completamente gratuitos.</p>
      <div class="step"><div class="step-num">1</div><div>Acesse <a href="https://openrouter.ai" target="_blank">openrouter.ai</a></div></div>
      <div class="step"><div class="step-num">2</div><div>Faça login e vá em <strong>Keys → Create Key</strong></div></div>
      <div class="step"><div class="step-num">3</div><div>A chave começa com <code>sk-or-v1-...</code></div></div>
      <p>Para usar modelos gratuitos, mantenha o modelo como <code>openrouter/free</code> ou escolha um modelo com ":free" no nome.</p>
    `
  },
  elevenlabs: {
    title: '🎙 Como obter a chave da ElevenLabs',
    body: `
      <p>A ElevenLabs é usada para gerar as respostas em áudio. O plano gratuito inclui 10.000 caracteres/mês.</p>
      <div class="step"><div class="step-num">1</div><div>Acesse <a href="https://elevenlabs.io" target="_blank">elevenlabs.io</a></div></div>
      <div class="step"><div class="step-num">2</div><div>Crie uma conta gratuita</div></div>
      <div class="step"><div class="step-num">3</div><div>Vá em seu perfil → <strong>API Key</strong></div></div>
      <div class="step"><div class="step-num">4</div><div>Copie a chave (começa com <code>sk_</code>)</div></div>
    `
  },
  elevenlabs_voice: {
    title: '🗣 Sobre as vozes do ElevenLabs',
    body: `
      <p>Todas as vozes disponíveis são multilíngues e falam Português do Brasil com excelente qualidade usando o modelo <code>eleven_multilingual_v2</code>.</p>
      <ul>
        <li><strong>Jessica</strong> — Jovem, calorosa, ideal para conversas</li>
        <li><strong>Sarah</strong> — Madura, profissional, confiante</li>
        <li><strong>Matilda</strong> — Animada, educacional</li>
        <li><strong>Alice</strong> — Clara, britânica, educacional</li>
        <li><strong>Lily</strong> — Aveludada, britânica, elegante</li>
      </ul>
      <p>Você pode pedir resposta em áudio a qualquer momento dizendo <strong>"responda em áudio"</strong> ou <strong>"responde por voz"</strong>.</p>
    `
  },
  google_credentials: {
    title: '🟢 Como obter as credenciais do Google',
    body: `
      <p>As credenciais OAuth permitem que o agente acesse seu Gmail, Calendar, Drive e Contacts.</p>
      <div class="step"><div class="step-num">1</div><div>Acesse <a href="https://console.cloud.google.com" target="_blank">console.cloud.google.com</a></div></div>
      <div class="step"><div class="step-num">2</div><div>Crie um projeto novo (ex: <code>OpenGravity</code>)</div></div>
      <div class="step"><div class="step-num">3</div><div>Vá em <strong>APIs e Serviços → Credenciais → Criar Credencial → ID do cliente OAuth</strong></div></div>
      <div class="step"><div class="step-num">4</div><div>Tipo: <strong>Aplicativo para computador</strong></div></div>
      <div class="step"><div class="step-num">5</div><div>Clique em <strong>Fazer download do JSON</strong></div></div>
      <div class="step"><div class="step-num">6</div><div>Ative as APIs: Gmail, Calendar, Drive, Contacts (People), Sheets, Docs em <strong>Biblioteca de APIs</strong></div></div>
      <div class="step"><div class="step-num">7</div><div>Faça upload do JSON baixado aqui no dashboard</div></div>
    `
  },
  wa_numbers: {
    title: '📱 Formato do número do WhatsApp',
    body: `
      <p>Os números autorizados devem estar no formato internacional <strong>sem o sinal de +</strong>.</p>
      <p>Exemplos:</p>
      <ul>
        <li>Brasil (SP): <code>5511999999999</code></li>
        <li>Brasil (RJ): <code>5521888888888</code></li>
      </ul>
      <p>A composição é: <code>55</code> (código do país) + <code>11</code> (DDD) + <code>9XXXXXXXX</code> (número).</p>
      <p>Para múltiplos números, separe por vírgula: <code>5511999999999,5521888888888</code></p>
      <p style="color:var(--yellow)">⚠️ Recomendamos usar um número/chip dedicado para o bot, não o seu número pessoal principal.</p>
    `
  }
};

function showHelp(key) {
  const h = HELP[key];
  if (!h) return;
  document.getElementById('helpContent').innerHTML = `<h2>${h.title}</h2>${h.body}`;
  document.getElementById('helpModal').classList.remove('hidden');
}
function closeHelp() { document.getElementById('helpModal').classList.add('hidden'); }
document.addEventListener('keydown', e => { if (e.key === 'Escape') closeHelp(); });

// ─── Init ─────────────────────────────────────────────────────────
loadConfig();
refreshStatus();
setInterval(refreshStatus, 15000);
