/**
 * Cloudflare Pages Function: /api/evaluate-speech
 * Proxies audio evaluation requests to NusaTTSE on Hugging Face Spaces (Gradio evaluate_audio endpoint).
 */

export async function onRequestPost(context) {
  const { request, env } = context;
  const HF_SPACE_URL = env.HF_SPACE_URL || 'https://maselonn-nusattse.hf.space';
  const HF_TOKEN = env.HF_TOKEN || '';

  try {
    const formData = await request.formData();
    const referenceText = formData.get('reference_text') || 'Sugeng enjing sedherek sedaya.';
    const audioFile = formData.get('file');

    if (!audioFile) {
      return new Response(JSON.stringify({ error: 'No audio file provided in form data' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
      });
    }

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
      return new Response(JSON.stringify({ error: `Upload to HF Space failed: ${errText}` }), {
        status: uploadRes.status,
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
      });
    }

    const uploadedFiles = await uploadRes.json();
    if (!Array.isArray(uploadedFiles) || !uploadedFiles[0]) {
      return new Response(JSON.stringify({ error: 'Invalid upload response from Space' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
      });
    }

    const remoteAudioPath = uploadedFiles[0];

    // Step 2: Call evaluate_audio endpoint on Gradio Space
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
      return new Response(JSON.stringify({ error: `HF Space evaluate_audio failed: ${errText}` }), {
        status: callRes.status,
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
      });
    }

    const { event_id } = await callRes.json();
    if (!event_id) {
      return new Response(JSON.stringify({ error: 'No event_id returned for evaluation' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
      });
    }

    // Step 3: Read result stream
    const streamRes = await fetch(`${HF_SPACE_URL}/gradio_api/call/evaluate_audio/${event_id}`, {
      headers: HF_TOKEN ? { 'Authorization': `Bearer ${HF_TOKEN}` } : {}
    });

    const streamText = await streamRes.text();

    if (streamText.includes('ZeroGPU quota exceeded') || streamText.includes('ZeroGPU runs limit') || streamText.includes('event: error')) {
      return new Response(JSON.stringify({
        error: 'ZeroGPU daily quota exceeded on Hugging Face Spaces.',
        isZeroGpuQuota: true,
        isRateLimit: true
      }), {
        status: 429,
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
      });
    }

    const completeLine = streamText.split('\n').find(l => l.startsWith('data: ['));

    if (completeLine) {
      const parsedData = JSON.parse(completeLine.slice(5));
      const html0 = parsedData[0] || '';
      const html1 = parsedData[1] || '';
      const html2 = parsedData[2] || '';

      const scoreMatch = html0.match(/(\d+)\s*<span[^>]*>\s*\/\s*100/i) || html0.match(/(\d+)\s*\/\s*100/i) || html0.match(/(\d+)%/);
      const overallScore = scoreMatch ? parseInt(scoreMatch[1], 10) : 50;

      const ratingMatch = html0.match(/<div style="font-size: 1\.8rem; font-weight: 800; color: #fff;">([^<]+)<\/div>/i);
      const fluencyRating = ratingMatch ? ratingMatch[1].trim() : (overallScore >= 80 ? 'Bagus Banget' : (overallScore >= 60 ? 'Cukup Apik' : 'Perlu Latihan'));

      const wordAnalysis = [];
      const chipRegex = /<div style="background:[^"]*" title="([^"]*)"><strong>([^<]+)<\/strong>\s*<span[^>]*>(\d+)%<\/span>/g;
      let match;
      while ((match = chipRegex.exec(html1)) !== null) {
        const tip = match[1];
        const word = match[2];
        const score = parseInt(match[3], 10);
        let status = 'correct';
        if (score < 50) status = 'missing';
        else if (score < 75) status = 'mispronounced';

        wordAnalysis.push({ word, score, status, tip });
      }

      return new Response(JSON.stringify({
        overall_score: overallScore,
        fluency_rating: fluencyRating,
        rating_badge: overallScore >= 80 ? 'excellent' : (overallScore >= 60 ? 'good' : 'needs_practice'),
        word_analysis: wordAnalysis.length > 0 ? wordAnalysis : undefined,
        html_report: html0 + html1 + html2
      }), {
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
      });
    }

    return new Response(JSON.stringify({ error: 'Could not parse evaluation result from Space stream', raw: streamText }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
    });
  }
}
