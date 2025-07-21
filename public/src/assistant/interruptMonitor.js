export class InterruptMonitor {
  constructor(config = {}) {
    this.interruptThreshold = config.interruptThreshold || 40;
    this.fftSize = config.fftSize || 512;
    
    this.interruptStream = null;
    this.interruptContext = null;
    this.isMonitoring = false;
    this.onInterruptCallback = null;
    this.audioPlayer = null;
  }

  async start(onInterrupt, audioPlayer = null) {
    if (this.isMonitoring || this.interruptStream) return;
    
    this.onInterruptCallback = onInterrupt;
    this.audioPlayer = audioPlayer;
    this.isMonitoring = true;

    try {
      this.interruptStream = await navigator.mediaDevices.getUserMedia({ audio: true });
      this.interruptContext = new AudioContext();
      const source = this.interruptContext.createMediaStreamSource(this.interruptStream);
      const analyser = this.interruptContext.createAnalyser();
      analyser.fftSize = this.fftSize;
      source.connect(analyser);
      const dataArray = new Uint8Array(analyser.frequencyBinCount);

      const checkVolume = () => {
        if (!this.interruptStream || !this.isMonitoring) return;
        
        analyser.getByteFrequencyData(dataArray);
        const avg = dataArray.reduce((a, b) => a + b) / dataArray.length;

        // Sprawdź czy asystent aktualnie mówi przed przerwaniem
        if (avg > this.interruptThreshold && this.audioPlayer && this.audioPlayer.isSpeaking) {
          console.log("Wykryto mowę użytkownika — przerywam!");
          this.stop();
          if (this.onInterruptCallback) {
            this.onInterruptCallback();
          }
        } else if (this.isMonitoring) {
          requestAnimationFrame(checkVolume);
        }
      };

      checkVolume();
    } catch (err) {
      console.error("Błąd podczas uruchamiania monitorowania przerwań:", err);
      this.isMonitoring = false;
    }
  }

  stop() {
    this.isMonitoring = false;
    
    if (this.interruptStream) {
      this.interruptStream.getTracks().forEach(track => track.stop());
      this.interruptStream = null;
    }
    if (this.interruptContext && this.interruptContext.state !== "closed") {
      this.interruptContext.close();
      this.interruptContext = null;
    }
  }

  cleanup() {
    this.stop();
    this.onInterruptCallback = null;
  }
}