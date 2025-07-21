export class AudioManager {
  constructor(config = {}) {
    this.sampleDuration = config.sampleDuration || 6000;
    this.fftSize = config.fftSize || 512;
    
    this.stream = null;
    this.context = null;
    this.analyser = null;
    this.source = null;
    this.mediaRecorder = null;
    this.audioChunks = [];
    this.isListening = false;
  }

  async cleanup() {
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

  async startRecording(threshold = 40, onRecordingComplete) {
    if (this.isListening) {
      console.log("Nagrywanie już trwa, ignoruję żądanie");
      return;
    }
    
    await this.cleanup();
    this.isListening = true;

    this.stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    this.context = new AudioContext();
    this.source = this.context.createMediaStreamSource(this.stream);
    this.analyser = this.context.createAnalyser();
    this.analyser.fftSize = this.fftSize;
    this.source.connect(this.analyser);

    // Rozgrzewka – daj mikrofonowi moment na aktywację
    await new Promise(resolve => setTimeout(resolve, 500));

    this.audioChunks = [];
    this.mediaRecorder = new MediaRecorder(this.stream);
    this.mediaRecorder.ondataavailable = e => this.audioChunks.push(e.data);
    this.mediaRecorder.onstop = () => {
      this.isListening = false;
      const audioBlob = this.createAudioBlob();
      if (onRecordingComplete) {
        onRecordingComplete(audioBlob);
      }
    };
    
    // Rozpocznij monitorowanie głośności
    this.monitorVoiceActivity(threshold);

    return this.analyser;
  }
  
  monitorVoiceActivity(threshold) {
    const dataArray = new Uint8Array(this.analyser.frequencyBinCount);
    let silenceStart = null;
    let speechDetected = false;
    const silenceDelay = 700;
    const maxRecordingTime = this.sampleDuration || 6000;
    const recordingStartTime = Date.now();
    
    // Rozpocznij nagrywanie od razu
    console.log("Rozpoczynam nagrywanie...");
    this.mediaRecorder.start();
    
    const checkVolume = () => {
      if (!this.isListening) return;
      
      this.analyser.getByteFrequencyData(dataArray);
      const avg = dataArray.reduce((a, b) => a + b) / dataArray.length;
      
      if (avg > threshold) {
        speechDetected = true;
        silenceStart = null;
      } else {
        if (speechDetected && !silenceStart) {
          silenceStart = Date.now();
        }
        if (speechDetected && silenceStart && Date.now() - silenceStart > silenceDelay) {
          console.log("Cisza wykryta - kończę nagrywanie");
          this.stopRecording();
          return;
        }
      }
      
      // Sprawdź maksymalny czas nagrywania
      if (Date.now() - recordingStartTime > maxRecordingTime) {
        console.log("Maksymalny czas minął – przerywam nagrywanie");
        this.stopRecording();
        return;
      }
      
      requestAnimationFrame(checkVolume);
    };
    
    checkVolume();
  }

  stopRecording() {
    if (this.mediaRecorder && (this.mediaRecorder.state === "recording" || this.mediaRecorder.state === "paused")) {
      this.mediaRecorder.stop();
    }
    this.isListening = false;
  }

  getAudioLevel() {
    if (!this.analyser) return 0;
    
    const dataArray = new Uint8Array(this.analyser.frequencyBinCount);
    this.analyser.getByteFrequencyData(dataArray);
    return dataArray.reduce((a, b) => a + b) / dataArray.length;
  }

  createAudioBlob() {
    return new Blob(this.audioChunks, { type: 'audio/webm' });
  }
}