const DIALOGUES = {};

function initDialogues() {
  if (typeof localStorage !== 'undefined' && localStorage.getItem('NUSAQUEST_DIALOGUES')) {
    try {
      const savedDialogues = JSON.parse(localStorage.getItem('NUSAQUEST_DIALOGUES'));
      if (savedDialogues && typeof savedDialogues === 'object') {
        Object.assign(DIALOGUES, savedDialogues);
      }
    } catch (e) {}
  }

  if (typeof fetch !== 'undefined') {
    fetch('/api/dialogues')
      .then(res => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json();
      })
      .catch(() => fetch('/data/dialogues.json').then(r => r.json()))
      .then(data => {
        if (data && Object.keys(data).length > 0) {
          // Merge server data while retaining any locally added/edited dialogues
          for (const [id, d] of Object.entries(data)) {
            if (!DIALOGUES[id]) {
              DIALOGUES[id] = d;
            } else {
              DIALOGUES[id] = Object.assign({}, d, DIALOGUES[id]);
            }
          }
          console.log('NusaQuest: Synced DIALOGUES from API/KV');
        }
      })
      .catch(() => {});
  }
}

initDialogues();

async function fetchNpcQuiz(npcId) {
  try {
    const res = await fetch('/api/npc/quiz', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ npcId })
    });

    if (!res.ok) throw new Error(`HTTP error ${res.status}`);
    const data = await res.json();

    if (data && data.quiz) {
      console.log(`[Quiz] 🧠 Loaded quiz for ${npcId} (Source: ${data.source || 'server'})`);
      return data.quiz;
    }
  } catch (err) {
    console.warn(`[API] Could not fetch quiz from server (${err.message}). Using local fallback.`);
  }

  const dialogData = DIALOGUES[npcId] || {};
  const npcName = dialogData.name || (npcId ? npcId.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ') : 'NPC');
  
  const candidates = [];

  if (Array.isArray(dialogData.lines)) {
    dialogData.lines.forEach(l => {
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

  if (Array.isArray(dialogData.vocab)) {
    dialogData.vocab.forEach(v => {
      candidates.push({
        question: `Apa tegese tembung "${v.word}"?`,
        correct: v.meaning,
        explanation: `"${v.word}" tegese ${v.meaning}.`,
        word: v.word
      });
    });
  }

  const genericDefaults = [
    { question: 'Apa tegese tembung "sugeng" ing basa Indonesia?', correct: 'Selamat', explanation: '"Sugeng" tegese selamat.', word: 'sugeng' },
    { question: 'Kepriye ngandhakake "Terima kasih" ing basa Jawa?', correct: 'Matur nuwun', explanation: '"Matur nuwun" tegese terima kasih.', word: 'matur nuwun' },
    { question: 'Unen-unen "pripun kabare" tegese apa?', correct: 'Apa kabar', explanation: '"Pripun kabare" artine apa kabar.', word: 'pripun kabare' }
  ];

  genericDefaults.forEach(gd => {
    if (candidates.length < 3 && !candidates.some(c => c.question === gd.question)) {
      candidates.push(gd);
    }
  });

  const distractorPool = ['Selamat', 'Terima kasih', 'Berapa', 'Keluarga', 'Baik / Sehat', 'Sawah / Ladang', 'Padi', 'Air', 'Sepuluh (10)', 'Harganya'];

  const shuffle = (arr) => {
    const a = [...arr];
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  };

  const selectedCandidates = [];
  const usedQ = new Set();
  for (const c of candidates) {
    if (!usedQ.has(c.question)) {
      usedQ.add(c.question);
      selectedCandidates.push(c);
    }
    if (selectedCandidates.length >= 3) break;
  }

  const questions = selectedCandidates.map((cand, idx) => {
    const opts = [cand.correct];
    const pool = shuffle(distractorPool);
    for (const d of pool) {
      if (opts.length >= 4) break;
      if (d.toLowerCase() !== cand.correct.toLowerCase() && !opts.includes(d)) {
        opts.push(d);
      }
    }
    while (opts.length < 4) opts.push(`Pilihan ${opts.length + 1}`);

    const shuffledOpts = shuffle(opts);
    const ansIdx = shuffledOpts.indexOf(cand.correct);

    return {
      id: idx + 1,
      question: cand.question,
      options: shuffledOpts,
      answer: ansIdx,
      explanation: cand.explanation,
      teaches: { word: cand.word, meaning: cand.correct }
    };
  });

  return {
    npcId,
    title: `Kuis Kosakata — ${npcName}`,
    questions
  };
}

