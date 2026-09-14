/**
 * Cloudflare Pages Function: /api/npc/quiz
 * Generates dynamic RPG quizzes using Groq API or smart contextual fallback.
 */

const NPC_FALLBACKS = {
  mbok_sari: {
    name: 'Mbok Sari',
    role: 'Penjual Pasar',
    vocab: [
      { word: 'sedasa', meaning: 'sepuluh (10)', wrong: ['lima (5)', 'dua puluh (20)', 'tiga (3)'] },
      { word: 'pinten', meaning: 'berapa', wrong: ['siapa', 'kapan', 'di mana'] },
      { word: 'regine', meaning: 'harganya', wrong: ['namanya', 'warnanya', 'rumahnya'] },
      { word: 'mundhut', meaning: 'membeli', wrong: ['menjual', 'memasak', 'membuang'] },
      { word: 'matur nuwun', meaning: 'terima kasih', wrong: ['sama-sama', 'selamat jalan', 'minta maaf'] }
    ]
  },
  pak_joko: {
    name: 'Pak Joko',
    role: 'Petani Sawah',
    vocab: [
      { word: 'sawah', meaning: 'sawah / ladang', wrong: ['hutan', 'sungai', 'laut'] },
      { word: 'pari', meaning: 'padi / tanaman pangan', wrong: ['jagung', 'cabai', 'bawang'] },
      { word: 'toya', meaning: 'air irigasi', wrong: ['tanah', 'api', 'udara'] },
      { word: 'panen', meaning: 'memetik hasil panen', wrong: ['menanam bibit', 'membajak', 'memupuk'] },
      { word: 'subur', meaning: 'tanah gembur & subur', wrong: ['kering', 'tandus', 'berbatu'] }
    ]
  },
  dimas: {
    name: 'Dimas',
    role: 'Bocah Desa',
    vocab: [
      { word: 'pripun kabare', meaning: 'apa kabar', wrong: ['siapa namamu', 'mau ke mana', 'dari mana'] },
      { word: 'sae', meaning: 'baik / sehat', wrong: ['sakit', 'lelah', 'marah'] },
      { word: 'bal-balan', meaning: 'bermain sepak bola', wrong: ['bersepeda', 'memancing', 'membaca'] },
      { word: 'remen', meaning: 'suka / gemar', wrong: ['benci', 'takut', 'malas'] },
      { word: 'kanca', meaning: 'teman / sahabat', wrong: ['musuh', 'guru', 'orang asing'] }
    ]
  },
  mbah_kakung: {
    name: 'Mbah Kakung',
    role: 'Sesepuh Joglo',
    vocab: [
      { word: 'kulawarga', meaning: 'keluarga', wrong: ['tetangga', 'pedagang', 'tamu'] },
      { word: 'tentrem', meaning: 'tenteram / damai', wrong: ['ramai', 'gaduh', 'kacau'] },
      { word: 'mugi-mugi', meaning: 'semoga / doa', wrong: ['tidak mungkin', 'jangan-jangan', 'kemarin'] },
      { word: 'sugeng', meaning: 'selamat', wrong: ['bahaya', 'terlambat', 'selesai'] }
    ]
  }
};

function generateFallbackQuiz(npcId, round = 1) {
  const npc = NPC_FALLBACKS[npcId] || NPC_FALLBACKS.dimas;
  const questions = [];

  npc.vocab.slice(0, 3).forEach((item, idx) => {
    const opts = [item.meaning, ...item.wrong.slice(0, 3)];
    // Shuffle options
    const shuffled = opts.sort(() => Math.random() - 0.5);
    const correctIdx = shuffled.indexOf(item.meaning);

    questions.push({
      id: `q_${npcId}_${round}_${idx + 1}`,
      question: `Apa arti dari kosakata "${item.word}"?`,
      options: shuffled,
      correctIndex: correctIdx,
      explanation: `Dalam bahasa Jawa, "${item.word}" berarti "${item.meaning}".`,
      targetVocab: item.word
    });
  });

  return {
    npcId,
    roundNumber: round,
    storyPrompt: `Latihan kosakata bersama ${npc.name} (${npc.role})`,
    questions
  };
}

export async function onRequestPost(context) {
  const { request, env } = context;

  try {
    const body = await request.json().catch(() => ({}));
    const { npcId = 'dimas', round = 1, currentVocab = [] } = body;

    // If Groq API Key is available, try generating via Groq LLM
    if (env.GROQ_API_KEY && env.GROQ_API_KEY.trim() !== '') {
      try {
        const npc = NPC_FALLBACKS[npcId] || NPC_FALLBACKS.dimas;
        const prompt = `Anda adalah pembuat kuis edukasi RPG bahasa Jawa untuk NPC "${npc.name}" (${npc.role}).
Buatlah 3 pertanyaan pilihan ganda (4 opsi A, B, C, D) tentang kosakata bahasa Jawa dan tata krama.
Format JSON murni:
{
  "npcId": "${npcId}",
  "roundNumber": ${round},
  "storyPrompt": "Latihan kosakata bersama ${npc.name}",
  "questions": [
    {
      "id": "q1",
      "question": "Apa arti...",
      "options": ["Opsi 1", "Opsi 2", "Opsi 3", "Opsi 4"],
      "correctIndex": 0,
      "explanation": "Penjelasan...",
      "targetVocab": "kata"
    }
  ]
}`;

        const groqRes = await fetch('https://api.groq.com/openai/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${env.GROQ_API_KEY}`
          },
          body: JSON.stringify({
            model: 'qwen/qwen3.8-27b',
            messages: [{ role: 'user', content: prompt }],
            temperature: 0.7,
            response_format: { type: 'json_object' }
          })
        });

        if (groqRes.ok) {
          const groqData = await groqRes.json();
          const content = groqData.choices && groqData.choices[0] && groqData.choices[0].message && groqData.choices[0].message.content;
          if (content) {
            const parsed = JSON.parse(content);
            if (parsed && Array.isArray(parsed.questions) && parsed.questions.length > 0) {
              return new Response(JSON.stringify(parsed), {
                headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
              });
            }
          }
        }
      } catch (groqErr) {
        console.warn('Groq generation fallback:', groqErr);
      }
    }

    // Fallback generation
    const fallbackQuiz = generateFallbackQuiz(npcId, round);
    return new Response(JSON.stringify(fallbackQuiz), {
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
    });
  }
}
