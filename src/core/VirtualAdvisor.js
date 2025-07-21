import { VoiceButton } from '../components/VoiceButton.js';
import { Modal } from '../components/Modal.js';
import { ElevenLabsService } from '../services/ElevenLabsService.js';
import { ApiService } from '../services/ApiService.js';
import { StateManager } from '../services/StateManager.js';
import { SpeechToTextService } from '../services/SpeechToTextService.js';
import { ConversationManager } from '../services/ConversationManager.js';
import { ResultsDisplayService } from '../services/ResultsDisplayService.js';
import { STATES, EVENTS, DEFAULT_CONFIG, ERRORS } from '../utils/constants.js';

/**
 * Główna klasa Virtual Advisor Plugin
 */
export class VirtualAdvisor {
  constructor(options = {}) {
    // Merge config with defaults
    this.config = this.mergeConfig(DEFAULT_CONFIG, options);
    
    // Initialize properties
    this.container = null;
    this.voiceButton = null;
    this.modal = null;
    this.isInitialized = false;
    
    // Initialize services
    this.apiService = new ApiService(this.config.apiUrl);
    this.stateManager = new StateManager();
    this.speechService = null; // Will be initialized in initServices
    this.elevenLabsService = null;
    this.conversationManager = null;
    this.resultsDisplayService = new ResultsDisplayService();
    
    // Validate config
    this.validateConfig();
    
    // Initialize
    this.init();
  }

  /**
   * Merguje konfigurację z domyślnymi wartościami
   */
  mergeConfig(defaultConfig, userConfig) {
    const merged = { ...defaultConfig };
    
    for (const key in userConfig) {
      if (typeof userConfig[key] === 'object' && !Array.isArray(userConfig[key])) {
        merged[key] = { ...merged[key], ...userConfig[key] };
      } else {
        merged[key] = userConfig[key];
      }
    }
    
    return merged;
  }

  /**
   * Waliduje konfigurację
   */
  validateConfig() {
    if (!this.config.apiUrl) {
      throw new Error(ERRORS.INVALID_CONFIG + ': apiUrl is required');
    }
    
    if (!this.config.elevenLabsKey) {
      console.warn('ElevenLabs API key not provided. Text-to-speech will not work.');
    }
    
    if (!this.config.openAiApiKey) {
      console.warn('OpenAI API key not provided. Speech-to-text will not work.');
    }
    
    // Validate position
    const validPositions = ['bottom-right', 'bottom-left', 'top-right', 'top-left'];
    if (!validPositions.includes(this.config.position)) {
      console.warn(`Invalid position: ${this.config.position}. Using default: bottom-right`);
      this.config.position = 'bottom-right';
    }
  }

  /**
   * Inicjalizuje plugin
   */
  async init() {
    try {
      // Sprawdź podstawowe wsparcie przeglądarki
      this.checkBasicBrowserSupport();
      
      // Utwórz container
      this.createContainer();
      
      // Utwórz komponenty
      this.createComponents();
      
      // Inicjalizuj serwisy
      await this.initServices();
      
      // Sprawdź pełne wsparcie po inicjalizacji serwisów
      this.checkSpeechSupport();
      
      // Binduj eventy
      this.bindEvents();
      
      // Sprawdź uprawnienia mikrofonu
      this.speechService.checkMicrophonePermissions()
        .then(hasPermission => {
          if (!hasPermission) {
            console.warn('VirtualAdvisor: Microphone permission denied');
          }
        });
      
      this.isInitialized = true;
      this.stateManager.emit('initialized');
      
    } catch (error) {
      console.error('VirtualAdvisor: Initialization failed:', error);
      this.stateManager.handleError(error);
    }
  }

  /**
   * Sprawdza podstawowe wsparcie przeglądarki
   */
  checkBasicBrowserSupport() {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      throw new Error('Browser does not support microphone access');
    }
    
    if (!window.AudioContext && !window.webkitAudioContext) {
      throw new Error('Browser does not support Web Audio API');
    }
    
    if (!window.MediaRecorder) {
      throw new Error('Browser does not support MediaRecorder API');
    }
  }

  /**
   * Sprawdza wsparcie rozpoznawania mowy po inicjalizacji serwisów
   */
  checkSpeechSupport() {
    if (!this.speechService || !this.speechService.isRecognitionSupported()) {
      throw new Error('Speech recognition not supported or OpenAI API key missing');
    }
  }

  /**
   * Tworzy główny container
   */
  createContainer() {
    this.container = document.createElement('div');
    this.container.className = `virtual-advisor position-${this.config.position}`;
    this.container.setAttribute('role', 'application');
    this.container.setAttribute('aria-label', 'Virtual Voice Advisor');
    
    document.body.appendChild(this.container);

  }

  /**
   * Tworzy komponenty
   */
  createComponents() {
    // Utwórz przycisk głosowy
    this.voiceButton = new VoiceButton(this.container, this.config, this.stateManager);
    
    // Utwórz modal
    this.modal = new Modal(this.container, this.config, this.stateManager);
  }

  /**
   * Binduje eventy
   */
  bindEvents() {
    // Eventy z przycisku
    this.stateManager.on(EVENTS.LISTENING_START, () => {
      this.startListening();
    });
    
    // Event automatycznego powitania po otwarciu modala
    this.stateManager.on('conversation:start-with-greeting', async () => {
      await this.startConversationWithGreeting();
    });

    // Event automatycznego rozpoczęcia nasłuchu
    this.stateManager.on('listening:should-start', () => {
      this.startListening();
    });

    this.stateManager.on(EVENTS.LISTENING_STOP, () => {
      this.stopListening();
    });

    // Eventy stanu
    this.stateManager.on(EVENTS.STATE_CHANGE, (newState) => {
      this.onStateChanged(newState);
    });


  }

  /**
   * Sprawdza uprawnienia mikrofonu
   */
  async checkMicrophonePermissions() {
    return await this.speechService.checkMicrophonePermissions();
  }

  /**
   * Rozpoczyna rozmowę z powitaniem z API
   */
  async startConversationWithGreeting() {
    await this.conversationManager.startConversationWithGreeting();
  }

  /**
   * Rozpoczyna słuchanie
   */
  startListening() {
    if (!this.speechService.getIsListening()) {
      console.log('VirtualAdvisor: Rozpoczynam nasłuchiwanie');
      this.speechService.startListening();
    } else {
      console.log('VirtualAdvisor: Nasłuchiwanie już aktywne');
    }
  }

  /**
   * Zatrzymuje słuchanie
   */
  stopListening() {
    if (this.speechService.getIsListening()) {
      console.log('VirtualAdvisor: Zatrzymuję nasłuchiwanie');
      this.speechService.stopListening();
    } else {
      console.log('VirtualAdvisor: Nasłuchiwanie już nieaktywne');
    }
  }





  /**
   * Inicjalizuje serwisy
   */
  async initServices() {
    // Initialize speech service
    this.speechService = new SpeechToTextService(
      this.config.openAiApiKey,
      {
        language: this.config.language || 'pl'
      }
    );
    await this.speechService.init();
    
    // Inicjalizuj ElevenLabs jeśli klucz API jest dostępny
    if (this.config.elevenLabsKey) {
      this.elevenLabsService = new ElevenLabsService(
        this.config.elevenLabsKey,
        this.config.voiceId,
        this.config.elevenLabs
      );

    } else {
      console.warn('VirtualAdvisor: ElevenLabs API key not provided, TTS will be disabled');
    }
    
    // Inicjalizuj ConversationManager
    this.conversationManager = new ConversationManager(
      this.apiService,
      this.stateManager,
      this.elevenLabsService
    );
    
    // Binduj zdarzenia z SpeechService do ConversationManager
    this.speechService.on('transcript:final', (transcript) => {
      this.conversationManager.processUserMessage(transcript);
    });
    
    this.speechService.on('transcript:interim', (transcript) => {
      // Bezpośrednio wywołaj obsługę przerywania
      this.conversationManager.handleInterimTranscript(transcript);
      // Emituj zdarzenie dla innych komponentów
      this.conversationManager.events.emit('transcript:interim', transcript);
    });
    
    // Przekaż zdarzenia wiadomości z ConversationManager do StateManager (i dalej do Modal)
    this.conversationManager.events.on('message:user', (message) => {
      this.stateManager.emit('message:user', message);
    });
    
    this.conversationManager.events.on('message:assistant', (message) => {
      this.stateManager.emit('message:assistant', message);
    });
    
    // Binduj zdarzenia automatycznego zarządzania nasłuchem
    this.conversationManager.events.on('listening:should-start', () => {
      this.startListening();
    });
    
    this.conversationManager.events.on('listening:should-stop', () => {
      this.stopListening();
    });
    
    // Obsługa wyników rozmowy
    this.conversationManager.events.on('results:ready', (results) => {
      this.resultsDisplayService.displayResults(results);
    });
  }





  /**
   * Przetwarza wiadomość użytkownika
   */
  async processUserMessage(userMessage) {
    await this.conversationManager.processUserMessage(userMessage);
  }









  /**
   * Publiczne API - dodaje event listener
   */
  on(event, callback) {
    this.stateManager.on(event, callback);
  }

  /**
   * Publiczne API - usuwa event listener
   */
  off(event, callback) {
    this.stateManager.off(event, callback);
  }

  /**
   * Publiczne API - emituje event
   */
  emit(event, ...args) {
    this.stateManager.emit(event, ...args);
  }

  /**
   * Publiczne API - pobiera aktualny stan
   */
  getState() {
    return this.stateManager.getState();
  }

  /**
   * Publiczne API - pobiera konfigurację
   */
  getConfig() {
    return { ...this.config };
  }

  /**
   * Publiczne API - aktualizuje konfigurację
   */
  updateConfig(newConfig) {
    this.config = this.mergeConfig(this.config, newConfig);
    this.validateConfig();
    
    // Przebuduj komponenty jeśli potrzeba
    if (this.voiceButton) {
      this.voiceButton.updateState(this.stateManager.getState());
    }
  }

  /**
   * Publiczne API - uruchamia nasłuch programowo
   */
  async startConversation() {
    if (this.stateManager.getState() === STATES.IDLE) {
      await this.startListening();
    }
  }

  /**
   * Publiczne API - zatrzymuje nasłuch programowo
   */
  stopConversation() {
    if (this.stateManager.getState() === STATES.LISTENING) {
      this.stopListening();
    }
  }

  /**
   * Publiczne API - pokazuje/ukrywa plugin
   */
  toggle(visible = null) {
    if (!this.container) return;
    
    const isVisible = this.container.style.display !== 'none';
    const shouldShow = visible !== null ? visible : !isVisible;
    
    this.container.style.display = shouldShow ? 'block' : 'none';
  }

  /**
   * Publiczne API - sprawdza czy plugin jest zainicjalizowany
   */
  isReady() {
    return this.isInitialized && this.stateManager.getState() !== STATES.ERROR;
  }

  /**
   * Obsługuje kliknięcie przycisku głosowego
   */
  handleVoiceButtonClick() {
    if (this.stateManager.getState() === STATES.IDLE) {
      this.modal.show();
    } else if (this.stateManager.getState() === STATES.LISTENING) {
      this.stopListening();
    }
  }

  /**
   * Callback wywoływany przy zmianie stanu
   */
  onStateChanged(newState) {
    // Aktualizuj UI na podstawie stanu
    if (!this.voiceButton) return;
    
    this.voiceButton.updateState(newState);
  }

  /**
   * Czyści zasoby
   */
  destroy() {
    // Zatrzymaj wszystkie aktywne procesy
    if (this.stateManager.getState() === STATES.LISTENING) {
      this.stopListening();
    }
    
    // Usuń event listenery
    this.stateManager.removeAllListeners();
    
    // Usuń komponenty z DOM
    if (this.container && this.container.parentNode) {
      this.container.parentNode.removeChild(this.container);
    }
    
    // Wyczyść referencje
    this.container = null;
    this.voiceButton = null;
    this.modal = null;
    this.elevenLabsService = null;
    this.conversationManager = null;
    this.isInitialized = false;
  }

}