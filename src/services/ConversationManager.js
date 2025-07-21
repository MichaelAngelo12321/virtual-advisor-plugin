import { EventEmitter } from '../utils/eventEmitter.js';

/**
 * Menedżer rozmowy
 */
export class ConversationManager {
  constructor(apiService, stateManager, elevenLabsService) {
    this.apiService = apiService;
    this.stateManager = stateManager;
    this.elevenLabsService = elevenLabsService;
    this.events = new EventEmitter();
    this.currentAudioContext = null;
    this.currentAudioSource = null;
  }

  /**
   * Rozpoczyna rozmowę z powitaniem
   */
  async startConversationWithGreeting() {
    if (!this.stateManager.canStartListening()) {
      console.warn('ConversationManager: Cannot start conversation, not in idle state');
      return;
    }

    try {
      this.stateManager.changeState('processing');
      
      const data = await this.apiService.startChat();
      const greetingMessage = data.message;
      this.stateManager.setSessionId(data.sessionId);
      
      this.events.emit('message:assistant', greetingMessage);
      
      await this.speakResponse(greetingMessage);
      
    } catch (error) {
      console.error('ConversationManager: Failed to start conversation with greeting:', error);
      this.events.emit('message:assistant', '⚠️ Nie udało się połączyć z serwerem. Spróbuj ponownie.');
      this.stateManager.handleError(error);
    }
  }

  /**
   * Przetwarza wiadomość użytkownika
   */
  async processUserMessage(userMessage) {
    const sessionId = this.stateManager.getSessionId();
    

    
    if (!sessionId) {
      console.error('ConversationManager: No session ID available');
      this.events.emit('message:assistant', '⚠️ Błąd sesji. Spróbuj ponownie.');
      this.stateManager.changeState('idle');
      return;
    }
    
    if (!userMessage || userMessage.trim().length === 0) {
      console.warn('ConversationManager: Empty user message, ignoring');
      return;
    }

    try {
      this.events.emit('message:user', userMessage);
      
      const data = await this.apiService.sendMessage(sessionId, userMessage);
      const assistantMessage = data.question;
      
      const isCompleted = data.isCompleted || assistantMessage.includes('Analizuję Twoje dane i przygotowuję oferty');
      

      
      this.stateManager.changeState('speaking');
      this.events.emit('message:assistant', assistantMessage);
      
      await this.speakResponse(assistantMessage, isCompleted);
      
      if (isCompleted) {

        await this.fetchAndDisplayResults();
        this.stateManager.changeState('idle');
      }
      
    } catch (error) {
      console.error('ConversationManager: Failed to process message:', error);
      this.events.emit('message:assistant', '⚠️ Nie udało się przetworzyć wiadomości. Spróbuj ponownie.');
      this.stateManager.changeState('idle');
    }
  }

  /**
   * Pobiera i wyświetla wyniki rozmowy
   */
  async fetchAndDisplayResults() {
    const sessionId = this.stateManager.getSessionId();
    
    if (!sessionId) {
      console.error('ConversationManager: No session ID for fetching results');
      return;
    }

    try {
      const results = await this.apiService.getMortgageOffers(sessionId);
      this.events.emit('results:ready', results);
      
    } catch (error) {
      console.error('ConversationManager: Failed to fetch conversation results:', error);
      this.events.emit('message:assistant', '⚠️ Nie udało się pobrać wyników rozmowy.');
    }
  }

  /**
   * Przerywa aktualnie odtwarzane audio
   */
  stopCurrentSpeech() {
    if (this.currentAudioSource) {
      this.currentAudioSource.stop();
      this.currentAudioSource = null;
    }
    if (this.currentAudioContext) {
      this.currentAudioContext.close();
      this.currentAudioContext = null;
    }
  }

  /**
   * Odtwarza odpowiedź głosową z możliwością przerywania
   */
  async speakResponse(text, isCompleted = false) {
    if (!this.elevenLabsService || !this.elevenLabsService.isConfigured()) {
      console.warn('ConversationManager: ElevenLabs not configured, using fallback');
      this.events.emit('message:assistant', '⚠️ Text-to-speech niedostępny. Używam trybu tekstowego.');
      this.simulateSpeaking();
      return;
    }

    try {
      // Przerwij poprzednie audio jeśli odtwarza
      this.stopCurrentSpeech();
      
      // ZATRZYMAJ nasłuchiwanie przed rozpoczęciem mówienia
      this.events.emit('listening:should-stop');
      
      const audioBuffer = await this.elevenLabsService.textToSpeech(text);
      
      // Ustaw stan na 'speaking' przed odtwarzaniem
      this.stateManager.changeState('speaking');
      
      // Odtwórz audio BEZ równoległego nasłuchiwania
      await this.playInterruptibleAudio(audioBuffer);
      
      // Uruchom nasłuch tylko jeśli rozmowa nie została zakończona
      if (!isCompleted) {
        setTimeout(() => {
          this.events.emit('listening:should-start');
          this.stateManager.changeState('listening');
        }, 500); // 500ms opóźnienia
      }
      
    } catch (error) {
      console.error('ConversationManager: Speech synthesis failed:', error);
      
      if (error.message.includes('401') || error.message.includes('invalid_api_key')) {
        this.events.emit('message:assistant', '⚠️ Błąd autoryzacji ElevenLabs API. Sprawdź klucz API.');
      } else if (error.message.includes('quota') || error.message.includes('limit')) {
        this.events.emit('message:assistant', '⚠️ Przekroczono limit ElevenLabs API. Używam trybu tekstowego.');
      } else {
        this.events.emit('message:assistant', '⚠️ Błąd syntezy mowy. Używam trybu tekstowego.');
      }
      
      this.simulateSpeaking(isCompleted);
    }
  }

  /**
   * Odtwarza audio z możliwością przerywania
   */
  async playInterruptibleAudio(audioBuffer) {
    return new Promise((resolve, reject) => {
      try {
        this.currentAudioContext = new (window.AudioContext || window.webkitAudioContext)();
        
        this.currentAudioContext.decodeAudioData(audioBuffer)
          .then(decodedData => {
            this.currentAudioSource = this.currentAudioContext.createBufferSource();
            this.currentAudioSource.buffer = decodedData;
            this.currentAudioSource.connect(this.currentAudioContext.destination);
            
            this.currentAudioSource.onended = () => {
              this.currentAudioSource = null;
              this.currentAudioContext = null;
              resolve();
            };
            
            this.currentAudioSource.start(0);
          })
          .catch(error => {
            console.error('ConversationManager: Audio decoding failed:', error);
            reject(error);
          });
          
      } catch (error) {
        console.error('ConversationManager: Audio playback failed:', error);
        reject(error);
      }
    });
  }

  /**
   * Symuluje mówienie (fallback)
   */
  async simulateSpeaking(isCompleted = false) {
    // ZATRZYMAJ nasłuchiwanie przed symulowanym mówieniem
    this.events.emit('listening:should-stop');
    
    setTimeout(() => {
      // Uruchom nasłuch tylko jeśli rozmowa nie została zakończona
      if (!isCompleted) {
        setTimeout(() => {
          this.events.emit('listening:should-start');
          this.stateManager.changeState('listening');
        }, 500); // 500ms dodatkowego opóźnienia
      }
    }, 3000);
  }

  /**
   * Przerywa mówienie gdy użytkownik zacznie mówić
   */
  handleInterimTranscript(transcript) {
    if (this.stateManager.getState() === 'speaking' && transcript.trim().length > 0) {

      this.stopCurrentSpeech();
      this.stateManager.changeState('listening');
    }
  }

  /**
   * Dodaje event listener
   */
  on(event, callback) {
    this.events.on(event, callback);
  }

  /**
   * Usuwa event listener
   */
  off(event, callback) {
    this.events.off(event, callback);
  }

  /**
   * Czyści menedżer
   */
  destroy() {
    this.events.removeAllListeners();
  }
}