require('dotenv').config();
const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
let Groq;
try {
  Groq = require('groq-sdk');
} catch (e) {
  Groq = null;
}

app.get('/', (req, res) => {
  res.status(200).json({ message: "NusaQuest Server is running!" });
});

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());


const DEV_PASSWORD = process.env.DEV_SUITE_PASSWORD ? String(process.env.DEV_SUITE_PASSWORD).trim() : '';
const DEV_SESSION_SECRET = process.env.DEV_SESSION_SECRET || crypto.randomBytes(32).toString('hex');
const SESSION_COOKIE_NAME = 'nq_dev_session';
const SESSION_DURATION_MS = 12 * 60 * 60 * 1000; // 12 hours
const MAX_LOGIN_ATTEMPTS = 5;
const LOCKOUT_DURATION_MS = 15 * 60 * 1000; // 15 minutes


// In-memory rate limiting map: ip -> { count, resetAt, lockedUntil }
const loginAttempts = new Map();

function getClientIp(req) {
  const forwarded = req.headers['x-forwarded-for'];
  if (forwarded) {
    return forwarded.split(',')[0].trim();
  }
  return req.ip || req.connection?.remoteAddress || '127.0.0.1';
}

function checkRateLimit(ip) {
  const now = Date.now();
  const entry = loginAttempts.get(ip);
  if (!entry) return { isLocked: false, remainingAttempts: MAX_LOGIN_ATTEMPTS };

  if (entry.lockedUntil && entry.lockedUntil > now) {
    const remainingSeconds = Math.ceil((entry.lockedUntil - now) / 1000);
    return { isLocked: true, lockedRemainingSeconds: remainingSeconds };
  }

  if (entry.resetAt && entry.resetAt <= now) {
    loginAttempts.delete(ip);
    return { isLocked: false, remainingAttempts: MAX_LOGIN_ATTEMPTS };
  }

  const remaining = Math.max(0, MAX_LOGIN_ATTEMPTS - entry.count);
  return { isLocked: false, remainingAttempts: remaining };
}

function recordLoginFailure(ip) {
  const now = Date.now();
  let entry = loginAttempts.get(ip);
  if (!entry || (entry.resetAt && entry.resetAt <= now)) {
    entry = { count: 1, resetAt: now + LOCKOUT_DURATION_MS, lockedUntil: 0 };
  } else {
    entry.count += 1;
  }

  if (entry.count >= MAX_LOGIN_ATTEMPTS) {
    entry.lockedUntil = now + LOCKOUT_DURATION_MS;
  }

  loginAttempts.set(ip, entry);
  return checkRateLimit(ip);
}

function resetLoginAttempts(ip) {
  loginAttempts.delete(ip);
}

// Timing-safe password verification using SHA-256 fixed hashes
function verifyDevPassword(inputPassword) {
  if (!DEV_PASSWORD || typeof inputPassword !== 'string' || inputPassword.length === 0) return false;
  const inputHash = crypto.createHash('sha256').update(inputPassword).digest();
  const targetHash = crypto.createHash('sha256').update(DEV_PASSWORD).digest();
  return crypto.timingSafeEqual(inputHash, targetHash);
}


// Cryptographic HMAC-SHA256 Token Generator & Validator
function createDevSessionToken() {
  const payload = {
    auth: true,
    iat: Date.now(),
    exp: Date.now() + SESSION_DURATION_MS,
    nonce: crypto.randomBytes(16).toString('hex')
  };
  const payloadB64 = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const signature = crypto.createHmac('sha256', DEV_SESSION_SECRET).update(payloadB64).digest('base64url');
  return `${payloadB64}.${signature}`;
}

function verifyDevSessionToken(token) {
  if (!token || typeof token !== 'string') return false;
  const parts = token.split('.');
  if (parts.length !== 2) return false;

  const [payloadB64, signature] = parts;
  const expectedSignature = crypto.createHmac('sha256', DEV_SESSION_SECRET).update(payloadB64).digest('base64url');

  if (signature.length !== expectedSignature.length) return false;
  const sigBuf = Buffer.from(signature);
  const expBuf = Buffer.from(expectedSignature);
  if (!crypto.timingSafeEqual(sigBuf, expBuf)) return false;

  try {
    const payload = JSON.parse(Buffer.from(payloadB64, 'base64url').toString('utf8'));
    if (!payload || !payload.auth || !payload.exp) return false;
    if (Date.now() > payload.exp) return false;
    return true;
  } catch {
    return false;
  }
}

function parseCookies(cookieHeader) {
  const cookies = {};
  if (!cookieHeader) return cookies;
  cookieHeader.split(';').forEach(cookie => {
    const parts = cookie.split('=');
    if (parts.length >= 2) {
      cookies[parts[0].trim()] = decodeURIComponent(parts.slice(1).join('=').trim());
    }
  });
  return cookies;
}

function isDevAuthenticated(req) {
  const authHeader = req.headers['authorization'];
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.substring(7).trim();
    if (verifyDevSessionToken(token)) return true;
  }

  const cookies = parseCookies(req.headers.cookie);
  const sessionToken = cookies[SESSION_COOKIE_NAME];
  if (sessionToken && verifyDevSessionToken(sessionToken)) {
    return true;
  }

  return false;
}

function requireDevAuth(req, res, next) {
  if (isDevAuthenticated(req)) {
    return next();
  }

  if (req.path.startsWith('/api/') || req.xhr || (req.headers.accept && req.headers.accept.includes('application/json'))) {
    return res.status(401).json({
      error: 'Dev Suite Access Denied: Authentication required.',
      code: 'UNAUTHORIZED_DEV_ACCESS'
    });
  }

  const redirectTarget = req.originalUrl || '/dev/';
  return res.redirect(302, `/dev/login.html?redirect=${encodeURIComponent(redirectTarget)}`);
}

// Dev Suite Authentication APIs (Public)
app.post('/api/dev/login', (req, res) => {
  const ip = getClientIp(req);
  const rateLimit = checkRateLimit(ip);

  if (rateLimit.isLocked) {
    return res.status(429).json({
      error: `Terlalu banyak percobaan gagal. Akses dikunci selama ${rateLimit.lockedRemainingSeconds} detik.`,
      lockedRemainingSeconds: rateLimit.lockedRemainingSeconds
    });
  }

  const { password } = req.body || {};
  if (!password || !verifyDevPassword(password)) {
    const failureStatus = recordLoginFailure(ip);
    if (failureStatus.isLocked) {
      return res.status(429).json({
        error: `Password salah. Terlalu banyak percobaan, akses dikunci selama ${failureStatus.lockedRemainingSeconds} detik.`,
        lockedRemainingSeconds: failureStatus.lockedRemainingSeconds
      });
    }
    return res.status(401).json({
      error: `Password Dev Suite salah. Sisa percobaan: ${failureStatus.remainingAttempts}`,
      remainingAttempts: failureStatus.remainingAttempts
    });
  }

  resetLoginAttempts(ip);
  const token = createDevSessionToken();

  res.setHeader(
    'Set-Cookie',
    `${SESSION_COOKIE_NAME}=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=43200`
  );

  return res.json({
    status: 'ok',
    message: 'Dev Suite unlocked successfully',
    token
  });
});

app.post('/api/dev/logout', (req, res) => {
  res.setHeader(
    'Set-Cookie',
    `${SESSION_COOKIE_NAME}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0; Expires=Thu, 01 Jan 1970 00:00:00 GMT`
  );
  return res.json({
    status: 'ok',
    message: 'Dev Suite session cleared'
  });
});

app.get('/api/dev/auth-status', (req, res) => {
  return res.json({
    authenticated: isDevAuthenticated(req)
  });
});

// Whitelist login page and dev styles before the auth barrier
app.get(['/dev/login', '/dev/login.html'], (req, res) => res.sendFile(path.join(__dirname, 'dev', 'login.html')));
app.get('/dev/dev.css', (req, res) => res.sendFile(path.join(__dirname, 'dev', 'dev.css')));

// Intercept all requests under /dev to enforce authentication
app.use('/dev', (req, res, next) => {
  const reqPath = (req.path || '').toLowerCase();
  if (reqPath === '/login.html' || reqPath === '/login' || reqPath === '/dev.css') {
    return next();
  }
  return requireDevAuth(req, res, next);
});

// Redirect legacy root dev page URLs to exclusive /dev/{pages} with auth check
app.get(['/map_maker', '/map_maker.html'], requireDevAuth, (req, res) => res.redirect(301, '/dev/map_maker.html'));
app.get(['/tile_viewer', '/tile_viewer.html'], requireDevAuth, (req, res) => res.redirect(301, '/dev/tile_viewer.html'));
app.get(['/npc_config', '/npc_config.html'], requireDevAuth, (req, res) => res.redirect(301, '/dev/npc_config.html'));

// Dev Suite Hub & Protected HTML Pages
app.get(['/dev', '/dev/'], requireDevAuth, (req, res) => res.sendFile(path.join(__dirname, 'dev', 'index.html')));

app.get('/dev/:page', requireDevAuth, (req, res, next) => {
  let page = req.params.page;
  if (!page.endsWith('.html') && !page.includes('.')) page += '.html';
  const targetPath = path.join(__dirname, 'dev', page);
  if (fs.existsSync(targetPath)) {
    return res.sendFile(targetPath);
  }
  next();
});

// Dev Suite static files (accessible only when authenticated)
app.use('/dev', requireDevAuth, express.static(path.join(__dirname, 'dev')));

// Serve main game static files (exclude /dev directory to prevent bypassing auth)
app.use((req, res, next) => {
  if (req.path === '/dev' || req.path.startsWith('/dev/')) {
    return next();
  }
  express.static(__dirname)(req, res, next);
});



const QUIZZES_DIR = path.join(__dirname, 'data', 'quizzes');
const LEGACY_QUIZZES_FILE = path.join(__dirname, 'data', 'quizzes.json');
const TILE_MAP_FILE = path.join(__dirname, 'data', 'tile_map.json');
const TILESHEETS_FILE = path.join(__dirname, 'assets', 'tiles', 'tilesheets.json');
const DIALOGUES_FILE = path.join(__dirname, 'data', 'dialogues.json');
const NPC_PLACEMENTS_FILE = path.join(__dirname, 'data', 'npc_placements.json');
const MAPS_FILE = path.join(__dirname, 'data', 'maps.json');
const QUESTS_FILE = path.join(__dirname, 'data', 'quests.json');

function ensureDirForFile(filePath) {
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

function ensureQuizDir() {
  if (!fs.existsSync(QUIZZES_DIR)) {
    fs.mkdirSync(QUIZZES_DIR, { recursive: true });
  }
}

function getQuizFilePath(npcId) {
  const sanitizedId = String(npcId || 'default').replace(/[^a-zA-Z0-9_-]/g, '_');
  return path.join(QUIZZES_DIR, `${sanitizedId}.json`);
}

function readNpcQuiz(npcId) {
  ensureQuizDir();
  const filePath = getQuizFilePath(npcId);
  if (!fs.existsSync(filePath)) {
    return ensureNpcQuizFile(npcId);
  }
  try {
    const raw = fs.readFileSync(filePath, 'utf8');
    const parsed = JSON.parse(raw || '[]');
    if (Array.isArray(parsed)) return parsed;
    if (parsed && typeof parsed === 'object') {
      if (Array.isArray(parsed.questions)) return [parsed];
      return Object.values(parsed).flatMap(val => Array.isArray(val) ? val : (val && val.questions ? [val] : []));
    }
    return [];
  } catch (err) {
    console.error(`Error reading quiz file for NPC ${npcId}:`, err.message);
    return [];
  }
}

function writeNpcQuiz(npcId, quizHistory) {
  ensureQuizDir();
  const filePath = getQuizFilePath(npcId);
  try {
    fs.writeFileSync(filePath, JSON.stringify(quizHistory, null, 2), 'utf8');
    return true;
  } catch (err) {
    console.error(`Error writing quiz file for NPC ${npcId}:`, err.message);
    return false;
  }
}

function ensureNpcQuizFile(npcId) {
  ensureQuizDir();
  const filePath = getQuizFilePath(npcId);
  if (fs.existsSync(filePath)) {
    return readNpcQuiz(npcId);
  }

  const initialQuiz = generateFallbackQuiz(npcId, 1, []);
  const quizHistory = [initialQuiz];
  writeNpcQuiz(npcId, quizHistory);
  console.log(`[QUIZ FILE] Auto-created individual quiz file: data/quizzes/${npcId}.json`);
  return quizHistory;
}

function ensureDataFiles() {
  ensureQuizDir();

  // Migrate legacy monolithic quizzes.json to individual data/quizzes/{npcId}.json files
  if (fs.existsSync(LEGACY_QUIZZES_FILE)) {
    try {
      const raw = fs.readFileSync(LEGACY_QUIZZES_FILE, 'utf8');
      const legacyDb = JSON.parse(raw || '{}');
      for (const [npcId, quizData] of Object.entries(legacyDb)) {
        const filePath = getQuizFilePath(npcId);
        if (!fs.existsSync(filePath)) {
          let history = [];
          if (Array.isArray(quizData)) {
            history = quizData;
          } else if (quizData && typeof quizData === 'object' && Array.isArray(quizData.questions)) {
            history = [quizData];
          }
          if (history.length > 0) {
            writeNpcQuiz(npcId, history);
            console.log(`[MIGRATION] Migrated quizzes for NPC ${npcId} to data/quizzes/${npcId}.json`);
          }
        }
      }
    } catch (err) {
      console.error('Error migrating legacy quizzes.json:', err.message);
    }
  }

  // Ensure all NPCs defined in dialogues.json have a quiz file created
  try {
    if (fs.existsSync(DIALOGUES_FILE)) {
      const raw = fs.readFileSync(DIALOGUES_FILE, 'utf8');
      const dialogues = JSON.parse(raw || '{}');
      for (const npcId of Object.keys(dialogues)) {
        ensureNpcQuizFile(npcId);
      }
    }
  } catch (err) {
    console.error('Error auto-creating quiz files for dialogues:', err.message);
  }
}

function readDb(filePath) {
  ensureDataFiles();
  try {
    if (!fs.existsSync(filePath)) return {};
    const raw = fs.readFileSync(filePath, 'utf8');
    return JSON.parse(raw || '{}');
  } catch (err) {
    console.error(`Error reading ${filePath}:`, err.message);
    return {};
  }
}

function writeDb(filePath, data) {
  ensureDirForFile(filePath);
  try {
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf8');
    return true;
  } catch (err) {
    console.error(`Error writing ${filePath}:`, err.message);
    return false;
  }
}

ensureDataFiles();


const NPC_INFO = {
  mbok_sari: {
    name: 'Mbok Sari',
    role: 'Penjual Pasar (Market Seller)',
    persona: 'Market vendor selling fresh vegetables. Teaches numbers, prices, and shopping phrases.',
    vocab: [
      { word: 'sedasa', meaning: 'sepuluh (10)' },
      { word: 'pinten', meaning: 'berapa' },
      { word: 'regine', meaning: 'harganya' },
      { word: 'mundhut', meaning: 'membeli' },
      { word: 'matur nuwun', meaning: 'terima kasih' }
    ]
  },
  pak_joko: {
    name: 'Pak Joko',
    role: 'Petani (Farmer)',
    persona: 'Farmer in rice paddies. Teaches farming, crops, and nature vocabulary.',
    vocab: [
      { word: 'sawah', meaning: 'sawah / ladang' },
      { word: 'pari', meaning: 'padi' },
      { word: 'toya', meaning: 'air' },
      { word: 'panen', meaning: 'panen' },
      { word: 'subur', meaning: 'subur' }
    ]
  },
  dimas: {
    name: 'Dimas',
    role: 'Bocah Desa (Village Kid)',
    persona: 'Village boy playing soccer. Teaches greetings, feelings, and sports.',
    vocab: [
      { word: 'pripun kabare', meaning: 'apa kabar' },
      { word: 'sae', meaning: 'baik / sehat' },
      { word: 'bal-balan', meaning: 'main bola' },
      { word: 'remen', meaning: 'suka' },
      { word: 'kanca', meaning: 'teman' }
    ]
  },
  mbah_kakung: {
    name: 'Mbah Kakung',
    role: 'Sesepuh Joglo (Village Elder)',
    persona: 'Wise elder near the Joglo. Teaches culture, family, and values.',
    vocab: [
      { word: 'kulawarga', meaning: 'keluarga' },
      { word: 'tentrem', meaning: 'tenteram / damai' },
      { word: 'mugi-mugi', meaning: 'semoga' },
      { word: 'balai desa', meaning: 'balai desa' }
    ]
  },
  budi: {
    name: 'Budi',
    role: 'Anak Rantau',
    persona: 'New kid in town. Teaches casual Javanese words.',
    vocab: [
      { word: 'sampeyan', meaning: 'kamu' },
      { word: 'arek', meaning: 'anak' }
    ]
  }
};

function getNpcMeta(npcId) {
  const dialogues = readDb(DIALOGUES_FILE);
  const dialogueData = dialogues[npcId] || {};
  const baseInfo = NPC_INFO[npcId] || {};

  const name = dialogueData.name || baseInfo.name || (npcId ? npcId.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ') : 'NPC');
  const role = dialogueData.role || baseInfo.role || 'Warga Desa (Villager)';
  const persona = dialogueData.persona || baseInfo.persona || `${name} adalah warga desa NusaQuest.`;

  const lines = Array.isArray(dialogueData.lines) ? dialogueData.lines : [];

  const vocab = [];
  if (baseInfo.vocab && Array.isArray(baseInfo.vocab)) {
    vocab.push(...baseInfo.vocab);
  }
  if (Array.isArray(dialogueData.vocab)) {
    vocab.push(...dialogueData.vocab);
  }

  lines.forEach(line => {
    if (line.teaches && line.teaches.word) {
      if (!vocab.some(v => v.word.toLowerCase() === line.teaches.word.toLowerCase())) {
        vocab.push({ word: line.teaches.word, meaning: line.teaches.meaning });
      }
    } else if (line.javanese && line.indonesian) {
      if (line.javanese.split(' ').length <= 3 && !vocab.some(v => v.word.toLowerCase() === line.javanese.toLowerCase())) {
        vocab.push({ word: line.javanese, meaning: line.indonesian });
      }
    }
  });

  if (vocab.length === 0) {
    vocab.push(
      { word: 'sugeng', meaning: 'selamat' },
      { word: 'matur nuwun', meaning: 'terima kasih' }
    );
  }

  return {
    id: npcId,
    name,
    role,
    persona,
    lines,
    vocab
  };
}


let groqClient = null;
if (process.env.GROQ_API_KEY && Groq) {
  try {
    groqClient = new Groq({ apiKey: process.env.GROQ_API_KEY });
    console.log('Groq Client initialized successfully for Quiz Generation (Model: qwen/qwen3.8-27b).');
  } catch (e) {
    console.warn('Groq Client failed to initialize:', e.message);
  }
} else {
  console.log('GROQ_API_KEY not set. Using smart dynamic quiz generator.');
}

const questionPool = {
  mbok_sari: [
    {
      question: 'Apa tegese tembung "sedasa" ing basa Indonesia?',
      options: ['Sepuluh (10)', 'Lima (5)', 'Satu (1)', 'Dua puluh (20)'],
      answer: 0,
      explanation: '"Sedasa" tegese sepuluh (10).',
      teaches: { word: 'sedasa', meaning: 'sepuluh (10)' }
    },
    {
      question: 'Tembung "pinten" digunakake kanggo takon babagan apa?',
      options: ['Waktu (Kapan)', 'Jumlah / Harga (Berapa)', 'Tempat (Di mana)', 'Nama orang (Siapa)'],
      answer: 1,
      explanation: '"Pinten" artine berapa.',
      teaches: { word: 'pinten', meaning: 'berapa' }
    },
    {
      question: 'Kepriye ngandhakake "Terima kasih" ing basa Jawa ngoko/krama?',
      options: ['Sugeng enjing', 'Matur nuwun', 'Pripun kabare', 'Sae-sae mawon'],
      answer: 1,
      explanation: '"Matur nuwun" tegese terima kasih.',
      teaches: { word: 'matur nuwun', meaning: 'terima kasih' }
    },
    {
      question: 'Apa tegese tembung "mundhut" ing pasar?',
      options: ['Membeli / Beli', 'Menjual', 'Melihat', 'Membuang'],
      answer: 0,
      explanation: '"Mundhut" tegese tuku utawa membeli.',
      teaches: { word: 'mundhut', meaning: 'membeli' }
    }
  ],
  pak_joko: [
    {
      question: 'Apa tegese tembung "sawah" ing basa Indonesia?',
      options: ['Lautan', 'Sawah / Ladang', 'Hutan', 'Pasar'],
      answer: 1,
      explanation: '"Sawah" tegese sawah utawa ladang.',
      teaches: { word: 'sawah', meaning: 'sawah / ladang' }
    },
    {
      question: 'Tembung "pari" tegese apa yen durung diolah dadi beras?',
      options: ['Jagung', 'Padi', 'Gandum', 'Singkong'],
      answer: 1,
      explanation: '"Pari" artine padi.',
      teaches: { word: 'pari', meaning: 'padi' }
    },
    {
      question: 'Tembung "toya" ing basa Jawa tegese apa?',
      options: ['Air', 'Tanah', 'Api', 'Angin'],
      answer: 0,
      explanation: '"Toya" tegese banyu / air.',
      teaches: { word: 'toya', meaning: 'air' }
    }
  ],
  dimas: [
    {
      question: 'Unen-unen "pripun kabare" tegese apa?',
      options: ['Selamat tinggal', 'Apa kabar', 'Siapa namamu', 'Mau ke mana'],
      answer: 1,
      explanation: '"Pripun kabare" artinya apa kabar.',
      teaches: { word: 'pripun kabare', meaning: 'apa kabar' }
    },
    {
      question: 'Yen ditakoni kabar lan kahananmu sehat, kepriye jawabane?',
      options: ['Sae-sae mawon', 'Mboten ngertos', 'Sampun dhahar', 'Matur nuwun'],
      answer: 0,
      explanation: '"Sae-sae mawon" artine baik-baik saja.',
      teaches: { word: 'sae', meaning: 'baik / sehat' }
    },
    {
      question: 'Olahraga apa sing dimaksud "bal-balan"?',
      options: ['Bulu tangkis', 'Sepak bola', 'Bola voli', 'Renang'],
      answer: 1,
      explanation: '"Bal-balan" artinya bermain sepak bola.',
      teaches: { word: 'bal-balan', meaning: 'main bola' }
    }
  ],
  mbah_kakung: [
    {
      question: 'Apa tegese tembung "kulawarga"?',
      options: ['Tetangga', 'Keluarga', 'Masyarakat', 'Teman'],
      answer: 1,
      explanation: '"Kulawarga" tegese keluarga.',
      teaches: { word: 'kulawarga', meaning: 'keluarga' }
    },
    {
      question: 'Tembung "tentrem" tegese apa?',
      options: ['Ramai', 'Tenteram / Damai', 'Sedih', 'Marah'],
      answer: 1,
      explanation: '"Tentrem" tegese tenteram dan damai.',
      teaches: { word: 'tentrem', meaning: 'tenteram' }
    }
  ]
};

function shuffleArray(arr) {
  const array = [...arr];
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
  return array;
}

function generateFallbackQuiz(npcId, attemptIndex = 1, previousQuestions = []) {
  const npc = getNpcMeta(npcId);
  const candidates = [];

  if (npc.lines && npc.lines.length > 0) {
    npc.lines.forEach(l => {
      if (l.teaches && l.teaches.word && l.teaches.meaning) {
        candidates.push({
          question: `Apa tegese tembung "${l.teaches.word}" ing basa Indonesia?`,
          correct: l.teaches.meaning,
          explanation: `"${l.teaches.word}" tegese ${l.teaches.meaning}.`,
          word: l.teaches.word
        });
      } else if (l.javanese && l.indonesian) {
        candidates.push({
          question: `Apa tegese ukara "${l.javanese}" ing basa Indonesia?`,
          correct: l.indonesian,
          explanation: `"${l.javanese}" artine "${l.indonesian}".`,
          word: l.javanese
        });
      }
    });
  }

  if (npc.vocab && npc.vocab.length > 0) {
    npc.vocab.forEach(v => {
      candidates.push({
        question: `Apa tegese tembung "${v.word}"?`,
        correct: v.meaning,
        explanation: `"${v.word}" tegese ${v.meaning}.`,
        word: v.word
      });
    });
  }

  if (questionPool[npcId]) {
    questionPool[npcId].forEach(pq => {
      candidates.push({
        question: pq.question,
        correct: pq.options[pq.answer],
        explanation: pq.explanation,
        word: pq.teaches ? pq.teaches.word : 'tembung'
      });
    });
  }

  const globalDistractors = [
    'Sepuluh (10)', 'Berapa', 'Terima kasih', 'Sawah / Ladang', 'Padi',
    'Air', 'Apa kabar', 'Baik / Sehat', 'Keluarga', 'Tenteram',
    'Membeli', 'Harganya', 'Selamat', 'Main bola', 'Teman'
  ];

  const genericDefaults = [
    { question: 'Apa tegese tembung "sugeng" ing basa Indonesia?', correct: 'Selamat', explanation: '"Sugeng" tegese selamat.', word: 'sugeng' },
    { question: 'Kepriye ngandhakake "Terima kasih" ing basa Jawa?', correct: 'Matur nuwun', explanation: '"Matur nuwun" tegese terima kasih.', word: 'matur nuwun' },
    { question: 'Unen-unen "pripun kabare" tegese apa?', correct: 'Apa kabar', explanation: '"Pripun kabare" artine apa kabar.', word: 'pripun kabare' },
    { question: 'Apa tegese tembung "sae" ing basa Jawa?', correct: 'Baik / Sehat', explanation: '"Sae" tegese baik atau sehat.', word: 'sae' },
    { question: 'Tembung "kanca" tegese apa?', correct: 'Teman', explanation: '"Kanca" tegese teman.', word: 'kanca' }
  ];

  candidates.push(...genericDefaults);

  const prevSet = new Set((previousQuestions || []).map(q => q.toLowerCase().trim()));
  let freshCandidates = candidates.filter(c => !prevSet.has(c.question.toLowerCase().trim()));

  if (freshCandidates.length < 3) {
    freshCandidates = [...freshCandidates, ...candidates];
  }

  const selectedCandidates = [];
  const usedWords = new Set();
  for (const item of freshCandidates) {
    const key = (item.word || item.correct).toLowerCase().trim();
    if (!usedWords.has(key)) {
      usedWords.add(key);
      selectedCandidates.push(item);
    }
    if (selectedCandidates.length >= 3) break;
  }

  const finalQuestions = selectedCandidates.map((cand, idx) => {
    const options = [cand.correct];
    const pool = shuffleArray(globalDistractors);
    for (const d of pool) {
      if (options.length >= 4) break;
      if (d.toLowerCase() !== cand.correct.toLowerCase() && !options.includes(d)) {
        options.push(d);
      }
    }
    while (options.length < 4) {
      options.push(`Pilihan ${options.length + 1}`);
    }

    const shuffledOptions = shuffleArray(options);
    const correctIndex = shuffledOptions.indexOf(cand.correct);

    return {
      id: idx + 1,
      question: cand.question,
      options: shuffledOptions,
      answer: correctIndex,
      explanation: cand.explanation,
      teaches: {
        word: cand.word,
        meaning: cand.correct
      }
    };
  });

  return {
    id: `quiz_fallback_${Date.now()}`,
    npcId,
    title: `Kuis Kosakata — ${npc.name} (Kuis #${attemptIndex})`,
    generatedAt: new Date().toISOString(),
    questions: finalQuestions
  };
}


app.get('/api/status', (req, res) => {
  res.json({
    status: 'ok',
    aiQuizEnabled: !!groqClient,
    model: 'qwen/qwen3.8-27b'
  });
});


app.post('/api/npc/quiz', async (req, res) => {
  try {
    const { npcId = 'mbok_sari' } = req.body;
    let previousQuizHistory = readNpcQuiz(npcId);

    const previousQuestions = [];
    previousQuizHistory.forEach(qSet => {
      if (qSet && Array.isArray(qSet.questions)) {
        qSet.questions.forEach(q => {
          if (q && q.question) previousQuestions.push(q.question);
        });
      }
    });

    console.log(`[QUIZ REQ] NPC: ${npcId} (Loaded data/quizzes/${npcId}.json) | Prev Quizzes: ${previousQuizHistory.length} | Prev Questions Count: ${previousQuestions.length}`);

    let generatedQuiz = null;

    if (groqClient) {
      try {
        const npcMeta = getNpcMeta(npcId);

        let dialogueLinesText = '(No predefined dialogue script found.)';
        if (npcMeta.lines && npcMeta.lines.length > 0) {
          dialogueLinesText = npcMeta.lines.map((l, i) => {
            let text = `${i + 1}. Javanese: "${l.javanese}" | Indonesian: "${l.indonesian}"`;
            if (l.teaches && l.teaches.word) {
              text += ` [Teaches: ${l.teaches.word} = ${l.teaches.meaning}]`;
            }
            return text;
          }).join('\n');
        }

        const vocabListText = npcMeta.vocab.map(v => `- ${v.word}: ${v.meaning}`).join('\n');

        let prevQuizzesText = '(No previous quizzes generated yet.)';
        if (previousQuizHistory.length > 0) {
          const recentHistory = previousQuizHistory.slice(-3);
          prevQuizzesText = recentHistory.map((qSet, idx) => {
            const qList = (qSet.questions || []).map(q => `   - Question: "${q.question}"`).join('\n');
            return `Quiz Set #${idx + 1}:\n${qList}`;
          }).join('\n');
        }

        const prompt = `
You are generating a NEW interactive multiple-choice Javanese learning quiz for NPC "${npcMeta.name}" (${npcMeta.role}) in NusaQuest.

PREDEFINED DIALOGUE SCRIPT SPOKEN BY THIS NPC IN GAME:
${dialogueLinesText}

VOCABULARY TAUGHT BY THIS NPC:
${vocabListText}

PREVIOUSLY GENERATED QUIZZES / QUESTIONS HISTORY GIVEN TO THE PLAYER:
${prevQuizzesText}

INSTRUCTIONS:
1. Generate a NEW, UNIQUE 3-question quiz testing Javanese vocabulary, sentence translations, or dialogue comprehension directly based on "${npcMeta.name}"'s predefined dialogue script and vocabulary above.
2. CRITICAL: Read the PREVIOUSLY GENERATED QUIZZES history carefully! Do NOT repeat or duplicate questions that were already asked before. Create new question formulations, ask about different words/sentences in the dialogue, or test different option choices.
3. Provide 4 option choices per question (indices 0 to 3) and set "answer" to the integer index of the correct option. Vary the correct answer index across questions (do not make option 0 always correct).
4. Add a "teaches" object with "word" and "meaning" for the vocabulary word or phrase tested in each question.
5. Output MUST be strict valid JSON matching this schema:
{
  "title": "Kuis Kosakata ${npcMeta.name}",
  "questions": [
    {
      "id": 1,
      "question": "Apa tegese tembung 'sedasa' in basa Indonesia?",
      "options": ["Lima (5)", "Sepuluh (10)", "Dua (2)", "Satu (1)"],
      "answer": 1,
      "explanation": "'Sedasa' tegese sepuluh (10).",
      "teaches": {
        "word": "sedasa",
        "meaning": "sepuluh (10)"
      }
    }
  ]
}
`;

        const completion = await groqClient.chat.completions.create({
          model: 'qwen/qwen3.8-27b',
          messages: [
            { role: 'system', content: 'You output strictly valid JSON quiz objects for Javanese learning games.' },
            { role: 'user', content: prompt }
          ],
          response_format: { type: 'json_object' },
          max_tokens: 600,
          temperature: 0.8
        });

        const parsed = JSON.parse(completion.choices[0].message.content);
        if (parsed.questions && Array.isArray(parsed.questions) && parsed.questions.length > 0) {
          generatedQuiz = {
            id: `quiz_${Date.now()}`,
            npcId,
            title: parsed.title || `Kuis Kosakata — ${npcMeta.name}`,
            generatedAt: new Date().toISOString(),
            questions: parsed.questions
          };
          console.log(`Groq (qwen/qwen3.8-27b) generated fresh quiz for NPC ${npcId}!`);
        }
      } catch (aiErr) {
        console.error('Groq Quiz error:', aiErr.message);
      }
    }

    if (!generatedQuiz) {
      const attemptCount = previousQuizHistory.length + 1;
      console.log(`[FALLBACK DYNAMIC] Generating fallback quiz variant #${attemptCount} for NPC ${npcId}`);
      generatedQuiz = generateFallbackQuiz(npcId, attemptCount, previousQuestions);
    }

    previousQuizHistory.push(generatedQuiz);
    writeNpcQuiz(npcId, previousQuizHistory);
    console.log(`Saved newly generated quiz to data/quizzes/${npcId}.json (Total quizzes for ${npcId} = ${previousQuizHistory.length})`);

    return res.json({
      source: groqClient && generatedQuiz && !generatedQuiz.id.startsWith('quiz_fallback_') ? 'groq_ai' : 'fallback_generator',
      quiz: generatedQuiz
    });

  } catch (err) {
    console.error('Error in /api/npc/quiz:', err);
    res.status(500).json({ error: 'Failed to process quiz request', details: err.message });
  }
});

app.get('/api/npc/quiz/get', (req, res) => {
  try {
    const npcId = req.query.npcId || 'mbok_sari';
    let quizList = readNpcQuiz(npcId);

    let latestQuiz = quizList.length > 0 ? quizList[quizList.length - 1] : null;
    if (!latestQuiz) {
      latestQuiz = generateFallbackQuiz(npcId, 1, []);
      quizList = [latestQuiz];
      writeNpcQuiz(npcId, quizList);
    }

    return res.json({
      status: 'ok',
      npcId,
      totalQuizzes: quizList.length,
      quiz: latestQuiz,
      history: quizList
    });
  } catch (err) {
    console.error('Error in /api/npc/quiz/get:', err);
    res.status(500).json({ error: 'Failed to retrieve quiz', details: err.message });
  }
});

app.post('/api/npc/quiz/save', requireDevAuth, (req, res) => {
  try {
    const { npcId, quiz } = req.body || {};
    if (!npcId || !quiz || !Array.isArray(quiz.questions)) {
      return res.status(400).json({ error: 'Invalid quiz payload' });
    }

    let previousQuizHistory = readNpcQuiz(npcId);

    const savedQuiz = {
      id: quiz.id || `quiz_custom_${Date.now()}`,
      npcId,
      title: quiz.title || `Kuis Tembung — ${getNpcMeta(npcId).name}`,
      generatedAt: new Date().toISOString(),
      isCustom: true,
      questions: quiz.questions
    };

    previousQuizHistory.push(savedQuiz);
    writeNpcQuiz(npcId, previousQuizHistory);
    console.log(`Saved custom/edited quiz for NPC ${npcId} to data/quizzes/${npcId}.json!`);

    return res.json({
      status: 'ok',
      message: `Quiz saved for ${npcId}`,
      quiz: savedQuiz
    });
  } catch (err) {
    console.error('Error in /api/npc/quiz/save:', err);
    res.status(500).json({ error: 'Failed to save quiz', details: err.message });
  }
});




app.get('/api/database/view', requireDevAuth, (req, res) => {
  ensureQuizDir();
  const quizFiles = fs.readdirSync(QUIZZES_DIR).filter(f => f.endsWith('.json'));
  const quizzes = {};
  quizFiles.forEach(file => {
    const npcId = path.basename(file, '.json');
    quizzes[npcId] = readNpcQuiz(npcId);
  });
  res.json({
    quizzesDir: QUIZZES_DIR,
    npcsCount: Object.keys(quizzes).length,
    quizzes
  });
});

app.get('/api/tile-map', (req, res) => {
  const tileMap = readDb(TILE_MAP_FILE);
  res.json(tileMap);
});

app.post('/api/tile-map', requireDevAuth, (req, res) => {
  const data = req.body;
  if (!data || typeof data !== 'object') {
    return res.status(400).json({ error: 'Invalid payload' });
  }
  const ok = writeDb(TILE_MAP_FILE, data);
  if (ok) {
    console.log('Auto-saved data/tile_map.json');
    res.json({ status: 'ok', file: 'data/tile_map.json' });
  } else {
    res.status(500).json({ error: 'Failed to write data/tile_map.json' });
  }
});


app.get('/api/tilesheets', (req, res) => {
  const tilesheets = readDb(TILESHEETS_FILE);
  res.json(tilesheets);
});

app.post('/api/tilesheets', requireDevAuth, (req, res) => {
  const data = req.body;
  if (!data || typeof data !== 'object') {
    return res.status(400).json({ error: 'Invalid payload' });
  }
  const ok = writeDb(TILESHEETS_FILE, data);
  if (ok) {
    console.log('Auto-saved assets/tiles/tilesheets.json');
    res.json({ status: 'ok', file: 'assets/tiles/tilesheets.json' });
  } else {
    res.status(500).json({ error: 'Failed to write assets/tiles/tilesheets.json' });
  }
});

app.get('/api/dialogues', (req, res) => {
  const dialogues = readDb(DIALOGUES_FILE);
  res.json(dialogues);
});

app.post('/api/dialogues', requireDevAuth, (req, res) => {
  const data = req.body;
  if (!data || typeof data !== 'object') {
    return res.status(400).json({ error: 'Invalid payload' });
  }
  const ok = writeDb(DIALOGUES_FILE, data);
  if (ok) {
    for (const npcId of Object.keys(data)) {
      ensureNpcQuizFile(npcId);
    }
    console.log('Auto-saved data/dialogues.json & ensured individual NPC quiz files');
    res.json({ status: 'ok', file: 'data/dialogues.json' });
  } else {
    res.status(500).json({ error: 'Failed to write data/dialogues.json' });
  }
});

app.get('/api/quests', (req, res) => {
  const quests = readDb(QUESTS_FILE);
  res.json(quests);
});

app.post('/api/quests', requireDevAuth, (req, res) => {
  const data = req.body;
  if (!data || !Array.isArray(data)) {
    return res.status(400).json({ error: 'Invalid payload' });
  }
  const ok = writeDb(QUESTS_FILE, data);
  if (ok) {
    console.log('Auto-saved data/quests.json');
    res.json({ status: 'ok', file: 'data/quests.json' });
  } else {
    res.status(500).json({ error: 'Failed to write data/quests.json' });
  }
});


function syncPlacementsToMaps(placements) {
  if (!placements || typeof placements !== 'object') return;
  const maps = readDb(MAPS_FILE);
  if (!maps || typeof maps !== 'object') return;
  let modified = false;
  for (const [mapId, npcList] of Object.entries(placements)) {
    if (maps[mapId]) {
      maps[mapId].npcs = npcList;
      modified = true;
    }
  }
  if (modified) {
    writeDb(MAPS_FILE, maps);
  }
}

function syncMapsToPlacements(maps) {
  if (!maps || typeof maps !== 'object') return;
  const placements = readDb(NPC_PLACEMENTS_FILE) || {};
  let modified = false;
  for (const [mapId, mapDef] of Object.entries(maps)) {
    if (mapDef && Array.isArray(mapDef.npcs)) {
      placements[mapId] = mapDef.npcs;
      modified = true;
    }
  }
  if (modified) {
    writeDb(NPC_PLACEMENTS_FILE, placements);
  }
}

app.get('/api/npc-placements', (req, res) => {
  const placements = readDb(NPC_PLACEMENTS_FILE);
  res.json(placements);
});

app.post('/api/npc-placements', requireDevAuth, (req, res) => {
  const data = req.body;
  if (!data || typeof data !== 'object') {
    return res.status(400).json({ error: 'Invalid payload' });
  }
  const ok = writeDb(NPC_PLACEMENTS_FILE, data);
  if (ok) {
    syncPlacementsToMaps(data);
    console.log('Auto-saved data/npc_placements.json');
    res.json({ status: 'ok', file: 'data/npc_placements.json' });
  } else {
    res.status(500).json({ error: 'Failed to write data/npc_placements.json' });
  }
});

app.get('/api/maps', (req, res) => {
  const maps = readDb(MAPS_FILE);
  res.json(maps);
});

app.post('/api/maps', requireDevAuth, (req, res) => {
  const data = req.body;
  if (!data || typeof data !== 'object') {
    return res.status(400).json({ error: 'Invalid payload' });
  }
  const ok = writeDb(MAPS_FILE, data);
  if (ok) {
    syncMapsToPlacements(data);
    console.log('Auto-saved data/maps.json');
    res.json({ status: 'ok', file: 'data/maps.json' });
  } else {
    res.status(500).json({ error: 'Failed to write data/maps.json' });
  }
});

app.get('/api/npc-config', (req, res) => {
  const dialogues = readDb(DIALOGUES_FILE);
  const npcPlacements = readDb(NPC_PLACEMENTS_FILE);
  res.json({ dialogues, npcPlacements });
});

app.post('/api/npc-config', requireDevAuth, (req, res) => {
  const { dialogues, npcPlacements } = req.body || {};
  let ok = true;
  if (dialogues) {
    ok = writeDb(DIALOGUES_FILE, dialogues) && ok;
    for (const npcId of Object.keys(dialogues)) {
      ensureNpcQuizFile(npcId);
    }
    console.log('Auto-saved data/dialogues.json & ensured individual NPC quiz files');
  }
  if (npcPlacements) {
    ok = writeDb(NPC_PLACEMENTS_FILE, npcPlacements) && ok;
    syncPlacementsToMaps(npcPlacements);
    console.log('Auto-saved data/npc_placements.json');
  }
  if (ok) {
    res.json({ status: 'ok', message: 'Saved NPC dialogues, quiz files, and placements to JSON' });
  } else {
    res.status(500).json({ error: 'Failed to save NPC configuration' });
  }
});


// NusaTTSE (Hugging Face Space) Integration Endpoints with detailed logging & HF_TOKEN support
const HF_SPACE_URL = process.env.HF_SPACE_URL || 'https://maselonn-nusattse.hf.space';
const HF_TOKEN = process.env.HF_TOKEN || '';

app.post('/api/tts', async (req, res) => {
  const startTime = Date.now();
  try {
    const { text, voice, speed = 1.0, pitch = 0 } = req.body || {};
    if (!text) {
      console.warn('[NusaTTSE API] /api/tts called without text payload.');
      return res.status(400).json({ error: 'text is required' });
    }

    const voiceId = voice || 'jv-ID-SitiNeural';
    console.log(`\n========================================`);
    console.log(`[NusaTTSE API] 🎙️ Requesting TTS from HF Space (${HF_SPACE_URL})`);
    console.log(`[NusaTTSE API] Text: "${text}" | Voice: ${voiceId} | Speed: ${speed} | Pitch: ${pitch}`);
    console.log(`[NusaTTSE API] HF_TOKEN: ${HF_TOKEN ? 'Configured (Bearer token present)' : 'Not set (Anonymous - Subject to ZeroGPU free rate limit)'}`);

    const headers = { 'Content-Type': 'application/json' };
    if (HF_TOKEN) {
      headers['Authorization'] = `Bearer ${HF_TOKEN}`;
    }

    const callRes = await fetch(`${HF_SPACE_URL}/gradio_api/call/tts_generate`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ data: [text, voiceId, parseFloat(speed) || 1.0, parseInt(pitch) || 0, null] })
    });

    console.log(`[NusaTTSE API] Step 1 (Init Job) Status: ${callRes.status} ${callRes.statusText}`);

    if (!callRes.ok) {
      const errText = await callRes.text();
      console.error(`[NusaTTSE API] ❌ HF Space rejected job: ${errText}`);
      return res.status(callRes.status).json({
        error: `HF Space error (${callRes.status}): ${errText}`,
        isRateLimit: callRes.status === 429 || errText.includes('quota') || errText.includes('ZeroGPU')
      });
    }

    const { event_id } = await callRes.json();
    if (!event_id) {
      console.error(`[NusaTTSE API] ❌ No event_id returned from HF Space.`);
      return res.status(500).json({ error: 'No event_id returned from TTS service' });
    }

    console.log(`[NusaTTSE API] Step 2: Waiting for stream on event_id: ${event_id}...`);
    const streamHeaders = {};
    if (HF_TOKEN) streamHeaders['Authorization'] = `Bearer ${HF_TOKEN}`;

    const eventRes = await fetch(`${HF_SPACE_URL}/gradio_api/call/tts_generate/${event_id}`, {
      headers: streamHeaders
    });
    const streamText = await eventRes.text();

    console.log(`[NusaTTSE API] Stream Response Length: ${streamText.length} bytes`);

    // Check for ZeroGPU rate limit or other errors in stream body
    if (streamText.includes('ZeroGPU') || streamText.includes('quota exceeded') || streamText.includes('event: error')) {
      console.warn(`[NusaTTSE API] ⚠️ HF Space ZeroGPU Rate Limit / Error:`);
      console.warn(streamText.trim());
      return res.status(429).json({
        error: 'ZeroGPU quota exceeded on Hugging Face Spaces. Provide HF_TOKEN in .env to increase quota.',
        isRateLimit: true,
        rawStream: streamText
      });
    }

    const match = streamText.match(/"url":\s*"([^"]+)"/);
    if (match && match[1]) {
      const audioUrl = match[1];
      console.log(`[NusaTTSE API] Step 3: Downloading audio binary from: ${audioUrl}`);
      const audioRes = await fetch(audioUrl);
      if (audioRes.ok) {
        const buffer = await audioRes.arrayBuffer();
        const durationMs = Date.now() - startTime;
        console.log(`[NusaTTSE API] ✅ TTS generation succeeded in ${durationMs}ms (${buffer.byteLength} bytes).`);
        console.log(`========================================\n`);
        res.setHeader('Content-Type', 'audio/mpeg');
        return res.send(Buffer.from(buffer));
      }
    }

    console.error(`[NusaTTSE API] ❌ Could not extract audio URL from stream.`);
    return res.status(500).json({ error: 'TTS audio stream URL not found', rawStream: streamText });
  } catch (err) {
    console.error(`[NusaTTSE API] ❌ Exception in /api/tts:`, err);
    return res.status(500).json({ error: err.message, stack: err.stack });
  }
});

app.post('/api/evaluate-speech', async (req, res) => {
  try {
    console.log(`\n[NusaTTSE API] 🎤 Received speech evaluation request...`);

    const contentType = req.headers['content-type'] || '';
    const chunks = [];
    for await (const chunk of req) {
      chunks.push(chunk);
    }
    const rawBuffer = Buffer.concat(chunks);

    // Parse multipart form data
    const webReq = new Request('http://localhost/api/evaluate-speech', {
      method: 'POST',
      headers: { 'content-type': contentType },
      body: rawBuffer
    });

    const formData = await webReq.formData();
    const referenceText = formData.get('reference_text') || 'Sugeng enjing sedherek sedaya.';
    const audioFile = formData.get('file');

    if (!audioFile) {
      console.warn('[NusaTTSE API] ⚠️ No audio file in form data.');
      return res.status(400).json({ error: 'No audio file provided in form data' });
    }

    console.log(`[NusaTTSE API] Target: "${referenceText}" | Audio Size: ${audioFile.size} bytes`);

    // Step 1: Upload audio file to Gradio Space
    const uploadForm = new FormData();
    uploadForm.append('files', audioFile, 'recording.webm');

    const uploadHeaders = {};
    if (HF_TOKEN) uploadHeaders['Authorization'] = `Bearer ${HF_TOKEN}`;

    const uploadRes = await fetch(`${HF_SPACE_URL}/gradio_api/upload`, {
      method: 'POST',
      headers: uploadHeaders,
      body: uploadForm
    });

    if (!uploadRes.ok) {
      const errText = await uploadRes.text();
      console.warn(`[NusaTTSE API] ⚠️ Gradio upload failed (${uploadRes.status}): ${errText}`);
      return res.status(uploadRes.status).json({ error: 'Failed to upload audio to HF Space', detail: errText });
    }

    const uploadedFiles = await uploadRes.json();
    if (!Array.isArray(uploadedFiles) || !uploadedFiles[0]) {
      return res.status(500).json({ error: 'Invalid upload response from Space' });
    }

    const remoteAudioPath = uploadedFiles[0];
    console.log(`[NusaTTSE API] Uploaded audio path: ${remoteAudioPath}`);

    // Step 2: Call evaluate_audio endpoint
    const callRes = await fetch(`${HF_SPACE_URL}/gradio_api/call/evaluate_audio`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(HF_TOKEN ? { 'Authorization': `Bearer ${HF_TOKEN}` } : {})
      },
      body: JSON.stringify({
        data: [
          { path: remoteAudioPath, meta: { _type: 'gradio.FileData' } },
          referenceText
        ]
      })
    });

    if (!callRes.ok) {
      const errText = await callRes.text();
      console.warn(`[NusaTTSE API] ⚠️ evaluate_audio call failed: ${errText}`);
      return res.status(callRes.status).json({ error: 'HF evaluate_audio call failed', detail: errText });
    }

    const { event_id } = await callRes.json();
    if (!event_id) {
      return res.status(500).json({ error: 'No event_id returned for evaluation' });
    }

    console.log(`[NusaTTSE API] Step 3: Waiting for evaluation stream on event_id: ${event_id}...`);
    const streamRes = await fetch(`${HF_SPACE_URL}/gradio_api/call/evaluate_audio/${event_id}`, {
      headers: HF_TOKEN ? { 'Authorization': `Bearer ${HF_TOKEN}` } : {}
    });

    const streamText = await streamRes.text();
    const completeLine = streamText.split('\n').find(l => l.startsWith('data: ['));

    if (completeLine) {
      const parsedData = JSON.parse(completeLine.slice(5));
      const html0 = parsedData[0] || '';
      const html1 = parsedData[1] || '';
      const html2 = parsedData[2] || '';

      const scoreMatch = html0.match(/(\d+)\s*<span[^>]*>\s*\/\s*100/i);
      const overallScore = scoreMatch ? parseInt(scoreMatch[1]) : 80;

      const ratingMatch = html0.match(/<div style="font-size: 1\.8rem; font-weight: 800; color: #fff;">([^<]+)<\/div>/i);
      const fluencyRating = ratingMatch ? ratingMatch[1].trim() : 'Wis Apik';

      const wordAnalysis = [];
      const chipRegex = /<div style="background:[^"]*" title="([^"]*)"><strong>([^<]+)<\/strong>\s*<span[^>]*>(\d+)%<\/span>/g;
      let match;
      while ((match = chipRegex.exec(html1)) !== null) {
        const tip = match[1];
        const word = match[2];
        const score = parseInt(match[3]);
        let status = 'correct';
        if (score < 50) status = 'missing';
        else if (score < 75) status = 'mispronounced';

        wordAnalysis.push({ word, score, status, tip });
      }

      console.log(`[NusaTTSE API] ✅ Evaluation parsed: Score ${overallScore}/100 (${fluencyRating}), ${wordAnalysis.length} words analyzed.`);
      return res.json({
        overall_score: overallScore,
        fluency_rating: fluencyRating,
        rating_badge: overallScore >= 80 ? 'excellent' : (overallScore >= 60 ? 'good' : 'needs_practice'),
        word_analysis: wordAnalysis.length > 0 ? wordAnalysis : undefined,
        html_report: html0 + html1 + html2
      });
    }

    return res.status(500).json({ error: 'Could not parse evaluation result from Space stream', rawStream: streamText });
  } catch (err) {
    console.error(`[NusaTTSE API] ❌ Exception in /api/evaluate-speech:`, err);
    return res.status(500).json({ error: err.message });
  }
});

if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`\n====================================================`);
    console.log(`🏰 NusaQuest Server running at http://localhost:${PORT}`);
    console.log(`🛠️ Dev Suite: http://localhost:${PORT}/dev/`);
    console.log(`🔒 Dev Suite Security: ${DEV_PASSWORD ? 'Active (Password loaded from .env)' : 'Locked (DEV_SUITE_PASSWORD not set)'}`);
    console.log(`====================================================\n`);
  });
}



app.getNpcMeta = getNpcMeta;
app.generateFallbackQuiz = generateFallbackQuiz;
app.readNpcQuiz = readNpcQuiz;
app.writeNpcQuiz = writeNpcQuiz;
app.ensureNpcQuizFile = ensureNpcQuizFile;
app.app = app;

module.exports = app;
