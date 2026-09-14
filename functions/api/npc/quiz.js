/**
 * Cloudflare Pages Function: /api/npc/quiz
 * Generates dynamic RPG quizzes using Groq API (qwen/qwen3.8-27b),
 * dynamically reading NPC dialogue and vocabulary from Cloudflare KV.
 */

export async function onRequestPost(context) {
  const { request, env } = context;

  try {
    const body = await request.json().catch(() => ({}));
    const { npcId = 'mbok_sari' } = body;

    // 1. Fetch live dialogues data from Cloudflare KV
    let allDialogues = {};
    if (env.NUSAQUEST_STORAGE) {
      try {
        const storedDialogues = await env.NUSAQUEST_STORAGE.get('dialogues', 'json');
        if (storedDialogues && typeof storedDialogues === 'object') {
          allDialogues = storedDialogues;
        }
      } catch (e) {}
    }

    const npcData = allDialogues[npcId] || {
      id: npcId,
      name: npcId ? npcId.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ') : 'NPC',
      role: 'Warga Desa',
      lines: []
    };

    // Extract vocabulary taught by this NPC
    const vocabList = [];
    const dialogueLinesText = (npcData.lines || []).map((l, i) => {
      let txt = `${i + 1}. Jawa: "${l.javanese || ''}" | Indonesia: "${l.indonesian || ''}"`;
      if (l.teaches && l.teaches.word && l.teaches.meaning) {
        vocabList.push({ word: l.teaches.word, meaning: l.teaches.meaning });
        txt += ` [Mengajarkan: ${l.teaches.word} = ${l.teaches.meaning}]`;
      }
      return txt;
    }).join('\n');

    if (vocabList.length === 0) {
      (npcData.lines || []).forEach(l => {
        if (l.javanese && l.indonesian) {
          vocabList.push({ word: l.javanese, meaning: l.indonesian });
        }
      });
    }

    // 2. Read previous quiz history from Cloudflare KV
    const kvKey = `quizzes_${npcId}`;
    let previousQuizzes = [];
    if (env.NUSAQUEST_STORAGE) {
      try {
        const stored = await env.NUSAQUEST_STORAGE.get(kvKey, 'json');
        if (Array.isArray(stored)) previousQuizzes = stored;
      } catch (e) {}
    }

    const previousQuestions = [];
    previousQuizzes.forEach(qSet => {
      if (qSet && Array.isArray(qSet.questions)) {
        qSet.questions.forEach(q => {
          if (q && q.question) previousQuestions.push(q.question);
        });
      }
    });

    let generatedQuiz = null;

    // 3. Generate via Groq LLM if API Key exists
    if (env.GROQ_API_KEY && env.GROQ_API_KEY.trim() !== '') {
      const vocabText = vocabList.length > 0
        ? vocabList.map(v => `- ${v.word}: ${v.meaning}`).join('\n')
        : `(Dialog umum bersama ${npcData.name})`;

      let prevHistoryText = '(Belum ada pertanyaan sebelumnya)';
      if (previousQuestions.length > 0) {
        prevHistoryText = previousQuestions.slice(-3).map((q, i) => `${i + 1}. "${q}"`).join('\n');
      }

      const prompt = `Anda adalah tutor RPG bahasa Jawa. Buat 3 soal kuis pilihan ganda yang VARIATIF dan MENARIK untuk NPC "${npcData.name}" (${npcData.role}).

KOSAKATA & DIALOG:
${vocabText}

VARIASIKAN BENTUK SOAL (JANGAN SEMUA TANYA ARTI KATA):
1. Soal melengkapi kalimat dialog rumpang (contoh: titik-titik kalimat)
2. Soal situasi / percakapan RPG (contoh: jika ingin menyapa/menjawab)
3. Soal pemahaman arti kata/tata krama

SOAL SEBELUMNYA (JANGAN DUPLIKASI):
${prevHistoryText}

Buat jawaban singkat padat dalam format JSON valid:
{
  "title": "Tantangan Kosakata — ${npcData.name}",
  "questions": [
    {
      "id": 1,
      "question": "Lengkapana ukara: ...",
      "options": ["Opsi 1", "Opsi 2", "Opsi 3", "Opsi 4"],
      "answer": 0,
      "explanation": "Penjelasan 1 kalimat singkat.",
      "teaches": {
        "word": "kata_jawa",
        "meaning": "arti_indonesia"
      }
    }
  ]
}`;

      try {
        const groqRes = await fetch('https://api.groq.com/openai/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${env.GROQ_API_KEY}`
          },
          body: JSON.stringify({
            model: 'qwen/qwen3.8-27b',
            messages: [
              { role: 'system', content: 'You are a concise RPG language quiz generator. Output strictly valid JSON. Keep explanations to 1 short sentence.' },
              { role: 'user', content: prompt }
            ],
            max_tokens: 450,
            temperature: 0.85,
            response_format: { type: 'json_object' }
          })
        });

        if (groqRes.ok) {
          const groqData = await groqRes.json();
          const content = groqData.choices && groqData.choices[0] && groqData.choices[0].message && groqData.choices[0].message.content;
          if (content) {
            const parsed = JSON.parse(content);
            if (parsed && Array.isArray(parsed.questions) && parsed.questions.length > 0) {
              generatedQuiz = {
                id: `quiz_groq_${Date.now()}`,
                npcId,
                title: parsed.title || `Kuis Kosakata — ${npcData.name}`,
                generatedAt: new Date().toISOString(),
                modelUsed: 'qwen/qwen3.8-27b',
                questions: parsed.questions.map((q, idx) => ({
                  id: q.id || (idx + 1),
                  question: q.question,
                  options: q.options,
                  answer: typeof q.answer === 'number' ? q.answer : (typeof q.correctIndex === 'number' ? q.correctIndex : 0),
                  explanation: q.explanation || '',
                  teaches: q.teaches || { word: '', meaning: '' }
                }))
              };
            }
          }
        }
      } catch (groqErr) {
        console.warn('Groq generation error:', groqErr);
      }
    }

    // 4. Fallback if Groq was unavailable
    if (!generatedQuiz) {
      const fallbackQuestions = [];
      const usableVocab = vocabList.length > 0 ? vocabList : [
        { word: 'sugeng', meaning: 'selamat' },
        { word: 'matur nuwun', meaning: 'terima kasih' },
        { word: 'kanca', meaning: 'teman' }
      ];

      usableVocab.slice(0, 3).forEach((item, idx) => {
        const wrongPool = ['selamat jalan', 'makan', 'minum', 'rumah', 'jalan', 'pasar', 'sawah'];
        const wrong = wrongPool.filter(w => w !== item.meaning).slice(0, 3);
        const opts = [item.meaning, ...wrong].sort(() => Math.random() - 0.5);
        const correctIdx = opts.indexOf(item.meaning);

        fallbackQuestions.push({
          id: idx + 1,
          question: `Apa tegese tembung "${item.word}" ing basa Indonesia?`,
          options: opts,
          answer: correctIdx,
          explanation: `Tembung "${item.word}" tegese ${item.meaning}.`,
          teaches: { word: item.word, meaning: item.meaning }
        });
      });

      generatedQuiz = {
        id: `quiz_fallback_${Date.now()}`,
        npcId,
        title: `Kuis Kosakata — ${npcData.name}`,
        generatedAt: new Date().toISOString(),
        questions: fallbackQuestions
      };
    }

    // 5. Save to Cloudflare KV history
    if (env.NUSAQUEST_STORAGE && generatedQuiz) {
      try {
        previousQuizzes.push(generatedQuiz);
        if (previousQuizzes.length > 20) previousQuizzes = previousQuizzes.slice(-20);
        await env.NUSAQUEST_STORAGE.put(kvKey, JSON.stringify(previousQuizzes));
      } catch (kvErr) {}
    }

    return new Response(JSON.stringify({
      source: env.GROQ_API_KEY && generatedQuiz && !generatedQuiz.id.startsWith('quiz_fallback_') ? 'groq_ai' : 'fallback_generator',
      quiz: generatedQuiz
    }), {
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      }
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
    });
  }
}
