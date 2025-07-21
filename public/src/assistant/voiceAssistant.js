import { AudioManager } from './audioManager.js';
import { InterruptMonitor } from './interruptMonitor.js';
import { SpeechProcessor } from './speechProcessor.js';
import { AudioPlayer } from './audioPlayer.js';

export class VoiceAssistant {
  constructor(config = {}) {
    this.config = config;
    this.sampleDuration = config.sampleDuration || 15000;
    this.sessionId = null; // Przechowywanie sessionId z API
    
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
    try {
      const response = await fetch('http://localhost:8001/api/chat/start.json');
      const data = await response.json();
      
      if (response.ok && data.sessionId) {
        // Zapisz sessionId do późniejszego użycia
        this.sessionId = data.sessionId;
        console.log('Chat session started:', data.sessionId);
        // Użyj message z API
        await this.speak(data.message);
      } else {
        console.error('API error or missing sessionId:', data);
        // Fallback do hardkodowanej wiadomości
        await this.speak("Cześć! Jestem twoim asystentem głosowym. W czym mogę ci pomóc?");
      }
    } catch (error) {
      console.error('Error starting chat session:', error);
      // Fallback do hardkodowanej wiadomości
      await this.speak("Cześć! Jestem twoim asystentem głosowym. W czym mogę ci pomóc?");
    }
  }

  async cleanup() {
    this.isActive = false;
    this.isListeningActive = false;
    this.sessionId = null;
    await this.audioManager.cleanup();
    this.interruptMonitor.stop();
    this.audioPlayer.stop();
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
      // STT - rozpoznawanie mowy
      const formData = new FormData();
      formData.append('audio', audioBlob);
      const sttResponse = await fetch('/api/stt', { method: 'POST', body: formData });
      const { transcript } = await sttResponse.json();
      
      if (transcript && transcript.trim()) {
        console.log("Rozpoznany tekst:", transcript);
        
        if (!this.sessionId) {
          console.error("Brak sessionId - nie można wysłać odpowiedzi do API");
          await this.speak("Przepraszam, wystąpił błąd z sesją. Spróbuj ponownie.");
          return;
        }
        
        const apiResponse = await this.speechProcessor.getReply(transcript, this.sessionId);
        console.log("Odpowiedź API:", apiResponse);
        
        // Sprawdź czy ankieta została ukończona
        if (apiResponse.isCompleted) {
          console.log("Ankieta ukończona - wyświetlam oferty");
          await this.speakAndShowOffers(apiResponse.question);
          return;
        }
        
        await this.speak(apiResponse.question);
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
      // TTS - synteza mowy
      const ttsResponse = await fetch('/api/tts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text })
      });
      
      if (!ttsResponse.ok) {
        throw new Error(`TTS error! status: ${ttsResponse.status}`);
      }
      
      const audioBlob = await ttsResponse.blob();
      const audioUrl = URL.createObjectURL(audioBlob);
      
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

  async speakAndShowOffers(text) {
    try {
      // TTS - synteza mowy
      const ttsResponse = await fetch('/api/tts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text })
      });
      
      if (!ttsResponse.ok) {
        throw new Error(`TTS error! status: ${ttsResponse.status}`);
      }
      
      const audioBlob = await ttsResponse.blob();
      const audioUrl = URL.createObjectURL(audioBlob);
      
      await this.audioPlayer.play(
        audioUrl,
        () => {
          // Callback po zakończeniu odtwarzania - wyświetl oferty
          this.interruptMonitor.stop();
          URL.revokeObjectURL(audioUrl);
          this.showOffersSpinner();
        },
        (error) => {
          // Callback w przypadku błędu - wyświetl oferty mimo błędu
          this.interruptMonitor.stop();
          console.error("Błąd odtwarzania:", error);
          URL.revokeObjectURL(audioUrl);
          this.showOffersSpinner();
        }
      );
      
      // Uruchom monitorowanie przerwań po rozpoczęciu odtwarzania
      this.interruptMonitor.start(() => {
        this.audioPlayer.stop();
        // Jeśli użytkownik przerwał, od razu wyświetl oferty
        this.showOffersSpinner();
      }, this.audioPlayer);
      
    } catch (error) {
      console.error("Błąd podczas syntezy mowy:", error);
      // W przypadku błędu, wyświetl oferty
      this.showOffersSpinner();
    }
  }

  async showOffersSpinner() {
    try {
      console.log('showOffersSpinner wywołane z sessionId:', this.sessionId);
      
      // Zapisz sessionId przed cleanup
      const currentSessionId = this.sessionId;
      
      // Wyłącz nasłuchiwanie całkowicie
      this.isActive = false;
      await this.cleanup();
      
      // Otwórz nowe okno z ofertami używając zapisanego sessionId
      const offersUrl = `offers.html?sessionId=${currentSessionId}`;
      console.log('Próba otwarcia URL:', offersUrl);
      
      const newWindow = window.open(offersUrl, '_blank', 'width=900,height=700,scrollbars=yes,resizable=yes');
      
      if (newWindow) {
        console.log('Nowe okno zostało otwarte pomyślnie');
      } else {
        console.error('Nie udało się otworzyć nowego okna - prawdopodobnie zablokowane przez przeglądarkę');
        // Fallback - otwórz w tym samym oknie
        window.location.href = offersUrl;
      }
      
      // Ukryj modal głosowy
      const modal = document.getElementById('voice-modal');
      if (modal) {
        console.log('Usuwanie modalu głosowego');
        modal.remove();
      } else {
        console.log('Modal głosowy nie został znaleziony');
      }
      
    } catch (error) {
      console.error('Błąd podczas otwierania ofert:', error);
    }
  }
}
