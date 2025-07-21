import { AudioManager } from './audioManager.js';
import { InterruptMonitor } from './interruptMonitor.js';
import { SpeechProcessor } from './speechProcessor.js';
import { AudioPlayer } from './audioPlayer.js';

export class VoiceAssistant {
  constructor(config = {}) {
    this.config = config;
    this.sampleDuration = config.sampleDuration || 6000;
    
    // Inicjalizacja modułów
    this.audioManager = new AudioManager(config);
    this.interruptMonitor = new InterruptMonitor(config);
    this.speechProcessor = new SpeechProcessor();
    this.audioPlayer = new AudioPlayer();
    
    // Stany
    this.isActive = false;
    this.isListeningActive = false;
  }

  async init() {
    this.isActive = true;
    await this.greetUser();
  }

  async greetUser() {
    const greetingMessage = "Cześć! Jestem twoim asystentem głosowym. W czym mogę ci pomóc?";
    await this.speak(greetingMessage);
  }

  async cleanup() {
    this.isActive = false;
    this.isListeningActive = false;
    await this.audioManager.cleanup();
    this.interruptMonitor.cleanup();
    this.audioPlayer.cleanup();
    this.speechProcessor.reset();
  }

  async listenLoop() {
    if (!this.isActive || this.isListeningActive) return;
    
    this.isListeningActive = true;
    
    try {
      await this.audioManager.startRecording(
        this.config.interruptThreshold || 40,
        async (audioBlob) => {
          // Callback wywoływany po zakończeniu nagrywania
          this.isListeningActive = false;
          await this.processUserInput(audioBlob);
        }
      );
    } catch (err) {
      console.error("Błąd podczas nasłuchiwania:", err);
      this.isListeningActive = false;
    }
  }

  async processUserInput(audioBlob) {
    try {
      const userText = await this.speechProcessor.processAudio(audioBlob);
      
      if (userText && userText.trim()) {
        console.log("Rozpoznany tekst:", userText);
        const reply = await this.speechProcessor.getReply(userText);
        console.log("Odpowiedź asystenta:", reply);
        await this.speak(reply);
      } else {
        console.log("Nie rozpoznano tekstu, kontynuuję nasłuchiwanie...");
        this.listenLoop();
      }
    } catch (error) {
      console.error("Błąd podczas przetwarzania:", error);
      this.listenLoop();
    }
  }

  async speak(text) {
    try {
      const audioUrl = await this.speechProcessor.synthesizeSpeech(text);
      
      await this.audioPlayer.play(
        audioUrl,
        () => {
          // Callback po zakończeniu odtwarzania
          this.interruptMonitor.stop();
          URL.revokeObjectURL(audioUrl);
          this.listenLoop();
        },
        (error) => {
          // Callback w przypadku błędu
          this.interruptMonitor.stop();
          console.error("Błąd odtwarzania:", error);
          URL.revokeObjectURL(audioUrl);
          this.listenLoop();
        }
      );
      
      // Uruchom monitorowanie przerwań po rozpoczęciu odtwarzania
      this.interruptMonitor.start(() => {
        this.audioPlayer.stop();
        // Dodaj krótkie opóźnienie przed rozpoczęciem nasłuchiwania
        // aby dać użytkownikowi czas na rozpoczęcie mówienia
        setTimeout(() => {
          this.listenLoop();
        }, 200);
      }, this.audioPlayer);
      
    } catch (error) {
      console.error("Błąd podczas syntezy mowy:", error);
      this.listenLoop();
    }
  }

}
