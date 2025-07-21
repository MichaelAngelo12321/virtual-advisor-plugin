export class VoiceAssistant {
  constructor(config = {}) {
    this.sampleDuration = config.sampleDuration || 6000;
    this.interruptThreshold = config.interruptThreshold || 40;
    this.fftSize = config.fftSize || 512;

    this.audio = new Audio();
    this.isSpeaking = false;
    this.isListening = false;

    this.stream = null;
    this.context = null;
    this.analyser = null;
    this.source = null;
    this.mediaRecorder = null;
    this.audioChunks = [];
  }

  async init() {
    await this.listenLoop();
  }

  async cleanupAudio() {
    if (this.mediaRecorder && this.mediaRecorder.state === "recording") {
      this.mediaRecorder.stop();
    }
    if (this.stream) {
      this.stream.getTracks().forEach(t => t.stop());
      this.stream = null;
    }
    if (this.context && this.context.state !== "closed") {
      await this.context.close();
      this.context = null;
    }
    this.isListening = false;
  }

  async listenLoop() {
    if (this.isSpeaking || this.isListening) return;
    this.isListening = true;

    await this.cleanupAudio();

    this.stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    this.context = new AudioContext();
    this.source = this.context.createMediaStreamSource(this.stream);
    this.analyser = this.context.createAnalyser();
    this.analyser.fftSize = this.fftSize;
    this.source.connect(this.analyser);

    // Rozgrzewka – daj mikrofonowi moment na aktywację
    await new Promise(resolve => setTimeout(resolve, 300));

    this.audioChunks = [];
    this.mediaRecorder = new MediaRecorder(this.stream);
    this.mediaRecorder.ondataavailable = e => this.audioChunks.push(e.data);
    this.mediaRecorder.onstop = () => {
      this.isListening = false;
      this.sendToServer();
    };
    this.mediaRecorder.start();

    const dataArray = new Uint8Array(this.analyser.frequencyBinCount);
    let silenceStart = null;
    const silenceDelay = 700;

    const checkSilence = () => {
      this.analyser.getByteFrequencyData(dataArray);
      const avg = dataArray.reduce((a, b) => a + b) / dataArray.length;

      if (avg < 20) {
        if (!silenceStart) silenceStart = Date.now();
        if (Date.now() - silenceStart > silenceDelay && this.mediaRecorder.state === "recording") {
          console.log("Cisza wykryta – przerywam nagrywanie");
          this.mediaRecorder.stop();
          this.cleanupAudio();
          return;
        }
      } else {
        silenceStart = null;
      }

      if (this.mediaRecorder.state === "recording") {
        requestAnimationFrame(checkSilence);
      }
    };

    requestAnimationFrame(checkSilence);

    setTimeout(() => {
      if (this.mediaRecorder.state === "recording") {
        console.log("Maksymalny czas minął – przerywam nagrywanie");
        this.mediaRecorder.stop();
        this.cleanupAudio();
      }
    }, this.sampleDuration);
  }

  async sendToServer() {
    const blob = new Blob(this.audioChunks, { type: 'audio/webm' });
    const formData = new FormData();
    formData.append('audio', blob);

    try {
      const res = await fetch('/api/stt', { method: 'POST', body: formData });
      const { transcript } = await res.json();
      console.log("Użytkownik powiedział:", transcript);

      if (!transcript || transcript.trim().length === 0) {
        this.listenLoop(); // nic nie powiedziano – restartuj słuchanie
        return;
      }

      const replyRes = await fetch('/api/reply', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userText: transcript }),
      });
      const { reply } = await replyRes.json();

      this.speak(reply);
    } catch (err) {
      console.error("Błąd przetwarzania:", err);
      this.listenLoop();
    }
  }

  async speak(text) {
    this.isSpeaking = true;

    await this.cleanupAudio();

    try {
      const res = await fetch('/api/tts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text }),
      });

      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      this.audio.src = url;

      return new Promise(resolve => {
        this.audio.onended = () => {
          this.isSpeaking = false;
          this.listenLoop();
          resolve();
        };
        this.audio.play();

        this.monitorUserInterrupt();
      });
    } catch (err) {
      console.error("Błąd podczas mówienia:", err);
      this.isSpeaking = false;
      this.listenLoop();
    }
  }

  async monitorUserInterrupt() {
    if (this.isListening) return;

    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    const context = new AudioContext();
    const source = context.createMediaStreamSource(stream);
    const analyser = context.createAnalyser();
    analyser.fftSize = this.fftSize;
    source.connect(analyser);
    const dataArray = new Uint8Array(analyser.frequencyBinCount);

    const checkVolume = () => {
      analyser.getByteFrequencyData(dataArray);
      const avg = dataArray.reduce((a, b) => a + b) / dataArray.length;

      if (avg > this.interruptThreshold) {
        console.log("Wykryto mowę użytkownika — przerywam!");
        this.audio.pause();
        this.audio.currentTime = 0;
        stream.getTracks().forEach(track => track.stop());
        context.close();
        this.isSpeaking = false;
        this.listenLoop();
      } else if (!this.audio.paused) {
        requestAnimationFrame(checkVolume);
      } else {
        stream.getTracks().forEach(track => track.stop());
        context.close();
        this.isSpeaking = false;
        this.listenLoop();
      }
    };

    checkVolume();
  }
}
