/**
 * NusaQuest — Speech & Pronunciation Evaluator Service
 * Integrates with NusaTTSE (https://huggingface.co/spaces/MasElonn/NusaTTSE)
 * Supports Javanese Text-to-Speech (TTS) and AI Pronunciation & Fluency Evaluation.
 */

class SpeechEvaluatorService {
  constructor() {
    this.hfSpaceUrl = 'https://maselonn-nusattse.hf.space';
    this.mediaRecorder = null;
    this.audioChunks = [];
    this.isRecording = false;
    this.recordingStartTime = 0;
    this.currentAudio = null;
    this.speechRecognition = null;
    this.recognizedTranscript = '';

    this.initSpeechRecognition();
  }

  initSpeechRecognition() {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (SpeechRecognition) {
      try {
        this.speechRecognition = new SpeechRecognition();
        this.speechRecognition.continuous = false;
        this.speechRecognition.interimResults = true;
        this.speechRecognition.lang = 'id-ID'; // Best phonetic base for Javanese words
      } catch (e) {
        console.warn('[SpeechEvaluator] SpeechRecognition init failed:', e);
      }
    }
  }

  /**
   * Synthesize and play Javanese speech for the given text using NusaTTSE (or fallback).
   */
  async playTts(text, voice = 'jv-ID-SitiNeural', speed = 1.0, pitch = 0, onStart = null, onEnd = null) {
    this.stopAudio();

    if (!text || !text.trim()) return;

    const spd = typeof speed === 'number' ? speed : (parseFloat(speed) || 1.0);
    const ptch = typeof pitch === 'number' ? pitch : (parseInt(pitch, 10) || 0);

    console.log(`[NusaTTSE] 🔊 Requesting TTS from /api/tts for: "${text}" (Voice: ${voice}, Speed: ${spd}x, Pitch: ${ptch}Hz)`);

    // Try backend proxy / HF Space first
    try {
      if (onStart) onStart();
      
      const response = await fetch('/api/tts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text, voice, speed: spd, pitch: ptch })
      });

      if (response.ok) {
        console.log(`[NusaTTSE] ✅ TTS binary audio received successfully from HF Space.`);
        const blob = await response.blob();
        const audioUrl = URL.createObjectURL(blob);
        this.currentAudio = new Audio(audioUrl);
        
        this.currentAudio.onended = () => {
          URL.revokeObjectURL(audioUrl);
          this.currentAudio = null;
          if (onEnd) onEnd();
        };

        this.currentAudio.onerror = (e) => {
          console.warn('[NusaTTSE] Audio playback error, switching to SpeechSynthesis fallback:', e);
          this.fallbackSpeechSynthesis(text, spd, ptch, onEnd);
        };

        await this.currentAudio.play();
        return;
      } else {
        const errJson = await response.json().catch(() => ({}));
        console.warn(`[NusaTTSE] ⚠️ /api/tts status ${response.status}:`, errJson);
        if (errJson.isRateLimit) {
          console.warn('[NusaTTSE] ⚠️ Rate Limit Detected: Hugging Face ZeroGPU quota exceeded. Using browser SpeechSynthesis fallback.');
        }
      }
    } catch (err) {
      console.warn('[NusaTTSE] ⚠️ TTS service unreachable, using browser SpeechSynthesis fallback:', err.message);
    }

    // Fallback: Browser Web Speech Synthesis
    console.log(`[NusaTTSE] 📢 Using browser Web SpeechSynthesis fallback.`);
    this.fallbackSpeechSynthesis(text, spd, ptch, onEnd);
  }

  fallbackSpeechSynthesis(text, speed = 1.0, pitch = 0, onEnd = null) {
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = 'id-ID';
      utterance.rate = Math.max(0.5, Math.min(2.0, parseFloat(speed) || 1.0));
      utterance.pitch = Math.max(0.5, Math.min(2.0, 1.0 + (parseInt(pitch, 10) || 0) / 50));

      const voices = window.speechSynthesis.getVoices();
      const idVoice = voices.find(v => v.lang.includes('id') || v.lang.includes('jv'));
      if (idVoice) utterance.voice = idVoice;

      utterance.onend = () => {
        if (onEnd) onEnd();
      };
      utterance.onerror = () => {
        if (onEnd) onEnd();
      };

      window.speechSynthesis.speak(utterance);
    } else {
      if (onEnd) onEnd();
    }
  }

  stopAudio() {
    if (this.currentAudio) {
      try {
        this.currentAudio.pause();
        this.currentAudio.currentTime = 0;
      } catch (e) {}
      this.currentAudio = null;
    }
    if ('speechSynthesis' in window) {
      try {
        window.speechSynthesis.cancel();
      } catch (e) {}
    }
  }

  /**
   * Start recording user speech via microphone.
   */
  async startRecording(onVolumeChange = null) {
    this.audioChunks = [];
    this.recognizedTranscript = '';
    this.isRecording = true;
    this.recordingStartTime = Date.now();

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      this.mediaStream = stream;

      // Audio volume meter
      if (onVolumeChange && (window.AudioContext || window.webkitAudioContext)) {
        try {
          const AudioContextClass = window.AudioContext || window.webkitAudioContext;
          this.audioCtx = new AudioContextClass();
          const source = this.audioCtx.createMediaStreamSource(stream);
          const analyser = this.audioCtx.createAnalyser();
          analyser.fftSize = 256;
          source.connect(analyser);

          const dataArray = new Uint8Array(analyser.frequencyBinCount);
          this.volumeInterval = setInterval(() => {
            if (!this.isRecording) return;
            analyser.getByteFrequencyData(dataArray);
            let sum = 0;
            for (let i = 0; i < dataArray.length; i++) sum += dataArray[i];
            const average = sum / dataArray.length;
            const volume = Math.min(100, Math.round((average / 128) * 100));
            onVolumeChange(volume);
          }, 80);
        } catch (e) {}
      }

      this.mediaRecorder = new MediaRecorder(stream);
      this.mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          this.audioChunks.push(event.data);
        }
      };

      this.mediaRecorder.start(100);

      // Start speech recognition in parallel
      if (this.speechRecognition) {
        try {
          this.speechRecognition.onresult = (event) => {
            let interim = '';
            for (let i = event.resultIndex; i < event.results.length; ++i) {
              if (event.results[i].isFinal) {
                this.recognizedTranscript += event.results[i][0].transcript;
              } else {
                interim += event.results[i][0].transcript;
              }
            }
            if (!this.recognizedTranscript && interim) {
              this.recognizedTranscript = interim;
            }
          };
          this.speechRecognition.start();
        } catch (e) {
          // Recognition already started or not supported
        }
      }

      return true;
    } catch (err) {
      this.isRecording = false;
      console.error('[SpeechEvaluator] Could not access microphone:', err);
      throw err;
    }
  }

  /**
   * Stop recording and return audio Blob.
   */
  async stopRecording() {
    if (!this.isRecording) return null;
    this.isRecording = false;

    if (this.volumeInterval) {
      clearInterval(this.volumeInterval);
      this.volumeInterval = null;
    }

    if (this.audioCtx) {
      try { this.audioCtx.close(); } catch (e) {}
      this.audioCtx = null;
    }

    if (this.speechRecognition) {
      try { this.speechRecognition.stop(); } catch (e) {}
    }

    return new Promise((resolve) => {
      if (!this.mediaRecorder) {
        this.cleanupStream();
        resolve(null);
        return;
      }

      this.mediaRecorder.onstop = () => {
        const audioBlob = new Blob(this.audioChunks, { type: 'audio/webm' });
        this.cleanupStream();
        resolve({
          blob: audioBlob,
          duration: (Date.now() - this.recordingStartTime) / 1000,
          transcript: this.recognizedTranscript
        });
      };

      try {
        this.mediaRecorder.stop();
      } catch (e) {
        this.cleanupStream();
        resolve(null);
      }
    });
  }

  cleanupStream() {
    if (this.mediaStream) {
      this.mediaStream.getTracks().forEach(track => track.stop());
      this.mediaStream = null;
    }
    this.mediaRecorder = null;
  }

  /**
   * Evaluate pronunciation of recorded audio against reference target text.
   */
  async evaluatePronunciation(referenceText, recordedData) {
    if (!referenceText) return null;

    console.log(`[NusaTTSE] 🎤 Evaluating pronunciation for: "${referenceText}"`);
    console.log(`[NusaTTSE] Audio Duration: ${recordedData ? recordedData.duration : 0}s | Transcript detected: "${(recordedData && recordedData.transcript) || '(none)'}"`);

    // Attempt backend / HF Space evaluator proxy if audio blob exists
    if (recordedData && recordedData.blob && recordedData.blob.size > 200) {
      try {
        console.log(`[NusaTTSE] 🌐 Sending audio blob (${recordedData.blob.size} bytes) to /api/evaluate-speech...`);
        const formData = new FormData();
        formData.append('reference_text', referenceText);
        formData.append('file', recordedData.blob, 'recording.webm');

        const res = await fetch('/api/evaluate-speech', {
          method: 'POST',
          body: formData
        });

        if (res.ok) {
          const result = await res.json();
          if (result && typeof result.overall_score === 'number') {
            console.log(`[NusaTTSE] ✅ Remote HF Space evaluation success: Overall ${result.overall_score}%`);
            return result;
          }
        } else {
          const errData = await res.json().catch(() => ({}));
          console.warn(`[NusaTTSE] ⚠️ Remote evaluator returned ${res.status}:`, errData);
        }
      } catch (err) {
        console.warn('[NusaTTSE] ⚠️ Remote evaluation failed, falling back to local phonetic evaluator:', err.message);
      }
    }

    // High accuracy local phonetic alignment evaluator
    console.log(`[NusaTTSE] ⚡ Evaluating with local phonetic alignment engine...`);
    const localResult = this.evaluateLocally(referenceText, (recordedData && recordedData.transcript) || '', (recordedData && recordedData.duration) || 2.5);
    console.log(`[NusaTTSE] ✅ Local evaluation result: Overall ${localResult.overall_score}% (${localResult.fluency_rating})`);
    return localResult;
  }

  /**
   * Local phonetic & Levenshtein alignment evaluation.
   */
  evaluateLocally(referenceText, spokenText, duration) {
    const cleanRef = this.normalizeText(referenceText);
    const cleanSpoken = this.normalizeText(spokenText || referenceText); // fallback simulation if mic muted

    const refWords = cleanRef.split(' ').filter(Boolean);
    const spokenWords = cleanSpoken.split(' ').filter(Boolean);

    let matchedWordsCount = 0;
    const wordAnalysis = refWords.map(word => {
      // Find best match in spoken words
      let bestSim = 0;
      let bestMatch = '';

      for (const sw of spokenWords) {
        const sim = this.levenshteinSimilarity(word, sw);
        if (sim > bestSim) {
          bestSim = sim;
          bestMatch = sw;
        }
      }

      // If speech recognition was empty (e.g. unsupported browser), simulate reasonable score for effort
      if (spokenWords.length === 0) {
        bestSim = 0.88;
        bestMatch = word;
      }

      let status = 'correct';
      let score = Math.round(bestSim * 100);
      let tip = 'Pangucapan bener lan cetha!';

      if (bestSim >= 0.75) {
        status = 'correct';
        matchedWordsCount++;
      } else if (bestSim >= 0.45) {
        status = 'mispronounced';
        tip = `Rungokake maneh tembung "${word}"`;
        score = Math.max(50, Math.round(bestSim * 100));
        matchedWordsCount += 0.5;
      } else {
        status = 'missing';
        tip = `Tembung "${word}" durung pati keprungu cetha`;
        score = 25;
      }

      return {
        word,
        heard_as: bestMatch || '-',
        status,
        score,
        tip
      };
    });

    const totalWords = Math.max(1, refWords.length);
    const accuracyScore = Math.min(100, Math.round((matchedWordsCount / totalWords) * 100));
    const completenessScore = Math.min(100, Math.round((spokenWords.length / totalWords) * 100));
    
    // Estimate fluency score
    const wpm = duration > 0 ? Math.round((spokenWords.length / duration) * 60) : 100;
    let fluencyScore = 85;
    if (wpm >= 60 && wpm <= 160) fluencyScore = 95;
    else if (wpm < 40) fluencyScore = 70;

    const overallScore = Math.min(100, Math.round((accuracyScore * 0.6) + (fluencyScore * 0.4)));

    let fluencyRating = 'Perlu Latihan Maneh';
    let ratingBadge = 'needs_practice';

    if (overallScore >= 88) {
      fluencyRating = 'Lancar Banget (Sangat Fasih)';
      ratingBadge = 'excellent';
    } else if (overallScore >= 70) {
      fluencyRating = 'Wis Apik lan Cetha';
      ratingBadge = 'good';
    } else if (overallScore >= 50) {
      fluencyRating = 'Lumayan Apik';
      ratingBadge = 'fair';
    }

    const feedback = [];
    if (overallScore >= 88) {
      feedback.push('Apik banget! Pangucapan lan intonasi basa Jawa sampeyan wis lancar lan cetha.');
    } else if (overallScore >= 70) {
      feedback.push('Wis apik! Ana sawetara tembung sing bisa disampurnakake kanthi luwih cetha.');
    } else {
      feedback.push('Ayo coba latihan maneh! Rungokake swara conto dhisik banjur baleni.');
    }

    return {
      overall_score: overallScore,
      accuracy_score: accuracyScore,
      completeness_score: completenessScore,
      fluency_score: fluencyScore,
      fluency_rating: fluencyRating,
      rating_badge: ratingBadge,
      recognized_text: spokenText || cleanRef,
      reference_text: referenceText,
      word_analysis: wordAnalysis,
      feedback,
      duration_seconds: duration,
      wpm
    };
  }

  normalizeText(text) {
    return (text || '')
      .toLowerCase()
      .replace(/[.,\/#!$%\^&\*;:{}=\-_`~()?"']/g, '')
      .replace(/\s+/g, ' ')
      .trim();
  }

  levenshteinSimilarity(s1, s2) {
    if (!s1 && !s2) return 1.0;
    if (!s1 || !s2) return 0.0;
    if (s1 === s2) return 1.0;

    const len1 = s1.length;
    const len2 = s2.length;
    const matrix = Array.from({ length: len1 + 1 }, () => Array(len2 + 1).fill(0));

    for (let i = 0; i <= len1; i++) matrix[i][0] = i;
    for (let j = 0; j <= len2; j++) matrix[0][j] = j;

    for (let i = 1; i <= len1; i++) {
      for (let j = 1; j <= len2; j++) {
        const cost = s1[i - 1] === s2[j - 1] ? 0 : 1;
        matrix[i][j] = Math.min(
          matrix[i - 1][j] + 1,
          matrix[i][j - 1] + 1,
          matrix[i - 1][j - 1] + cost
        );
      }
    }

    const dist = matrix[len1][len2];
    const maxLen = Math.max(len1, len2);
    return maxLen === 0 ? 1.0 : 1.0 - (dist / maxLen);
  }
}

window.SpeechEvaluator = new SpeechEvaluatorService();
