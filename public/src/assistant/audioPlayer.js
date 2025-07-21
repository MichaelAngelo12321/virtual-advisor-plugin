export class AudioPlayer {
  constructor() {
    this.audio = new Audio();
    this.isSpeaking = false;
    this.currentOnEnded = null;
    this.currentOnError = null;
  }

  async play(audioUrl, onEnded, onError) {
    this.isSpeaking = true;
    this.audio.src = audioUrl;
    this.currentOnEnded = onEnded;
    this.currentOnError = onError;

    return new Promise(resolve => {
      this.audio.onended = () => {
        this.isSpeaking = false;
        if (this.currentOnEnded) this.currentOnEnded();
        this.currentOnEnded = null;
        this.currentOnError = null;
        resolve();
      };
      
      // Właściwa obsługa promise dla audio.play()
      const playPromise = this.audio.play();
      if (playPromise !== undefined) {
        playPromise.then(() => {
          // Odtwarzanie rozpoczęte pomyślnie
          console.log("Odtwarzanie rozpoczęte");
          resolve();
        }).catch(error => {
          console.log("Odtwarzanie przerwane:", error.message);
          this.isSpeaking = false;
          if (this.currentOnError) this.currentOnError(error);
          this.currentOnEnded = null;
          this.currentOnError = null;
          resolve();
        });
      }
    });
  }

  pause() {
    this.audio.pause();
    this.audio.currentTime = 0;
    this.isSpeaking = false;
  }

  stop() {
    if (this.isSpeaking) {
      this.pause();
      // Wywołaj callback onEnded po przerwaniu
      if (this.currentOnEnded) {
        this.currentOnEnded();
        this.currentOnEnded = null;
        this.currentOnError = null;
      }
    }
  }

  cleanup() {
    this.stop();
    this.audio.src = '';
  }
}