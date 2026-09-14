/**
 * Cloudflare Pages Function: /api/evaluate-speech
 * Proxies audio evaluation requests to NusaTTSE on Hugging Face Spaces.
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

    const uploadData = await uploadRes.json();
    const remotePath = Array.isArray(uploadData) ? uploadData[0] : (uploadData && uploadData.files ? uploadData.files[0] : null);

    if (!remotePath) {
      return new Response(JSON.stringify({ error: 'Failed to retrieve uploaded audio path from HF Space' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
      });
    }

    // Step 2: Call evaluate_speech endpoint
    const callHeaders = { 'Content-Type': 'application/json' };
    if (HF_TOKEN) callHeaders['Authorization'] = `Bearer ${HF_TOKEN}`;

    const callPayload = {
      data: [
        { path: remotePath, orig_name: 'recording.webm', meta: { _type: 'gradio.FileData' } },
        referenceText
      ]
    };

    const callRes = await fetch(`${HF_SPACE_URL}/gradio_api/call/evaluate_speech`, {
      method: 'POST',
      headers: callHeaders,
      body: JSON.stringify(callPayload)
    });

    if (!callRes.ok) {
      const errText = await callRes.text();
      return new Response(JSON.stringify({ error: `HF Space evaluate rejected: ${errText}` }), {
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
    const streamHeaders = {};
    if (HF_TOKEN) streamHeaders['Authorization'] = `Bearer ${HF_TOKEN}`;

    const eventRes = await fetch(`${HF_SPACE_URL}/gradio_api/call/evaluate_speech/${event_id}`, {
      headers: streamHeaders
    });
    const streamText = await eventRes.text();

    const dataLines = streamText.split('\n').filter(l => l.startsWith('data: '));
    if (dataLines.length > 0) {
      const lastData = dataLines[dataLines.length - 1].replace('data: ', '').trim();
      const parsedData = JSON.parse(lastData);

      let html0 = '', html1 = '', html2 = '';
      if (Array.isArray(parsedData)) {
        html0 = parsedData[0] || '';
        html1 = parsedData[1] || '';
        html2 = parsedData[2] || '';
      }

      let overallScore = 85;
      const scoreMatch = html0.match(/(\d{1,3})\s*\/100/) || html0.match(/(\d{1,3})%/);
      if (scoreMatch && scoreMatch[1]) {
        overallScore = parseInt(scoreMatch[1], 10);
      }

      let fluencyRating = 'Bagus';
      if (overallScore >= 90) fluencyRating = 'Sangat Fasih (Native-like)';
      else if (overallScore >= 80) fluencyRating = 'Lancar & Jelas';
      else if (overallScore >= 65) fluencyRating = 'Cukup Baik';
      else fluencyRating = 'Perlu Latihan';

      const wordAnalysis = [];
      const wordRegex = /<span[^>]*class="([^"]*)"[^>]*title="([^"]*)"[^>]*>([^<]+)<\/span>/g;
      let wMatch;
      while ((wMatch = wordRegex.exec(html2)) !== null) {
        const cls = wMatch[1];
        const tip = wMatch[2];
        const word = wMatch[3].trim();
        let score = 80;
        let status = 'correct';

        if (cls.includes('green') || cls.includes('correct')) { score = 95; status = 'correct'; }
        else if (cls.includes('yellow') || cls.includes('warning')) { score = 70; status = 'fair'; }
        else if (cls.includes('red') || cls.includes('danger')) { score = 45; status = 'incorrect'; }

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

    return new Response(JSON.stringify({ error: 'Could not parse evaluation result from Space stream' }), {
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
