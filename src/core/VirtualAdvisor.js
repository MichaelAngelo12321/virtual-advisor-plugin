import { EventEmitter } from '../utils/eventEmitter.js';
import { VoiceButton } from '../components/VoiceButton.js';
import { Modal } from '../components/Modal.js';
import { ElevenLabsService } from '../services/ElevenLabsService.js';
import { STATES, EVENTS, DEFAULT_CONFIG, ERRORS } from '../utils/constants.js';

/**
 * Główna klasa Virtual Advisor Plugin
 */
export class VirtualAdvisor {
  constructor(options = {}) {
    // Merge config with defaults
    this.config = this.mergeConfig(DEFAULT_CONFIG, options);
    
    // Initialize properties
    this.state = STATES.IDLE;
    this.events = new EventEmitter();
    this.container = null;
    this.voiceButton = null;
    this.modal = null;
    this.elevenLabsService = null;
    this.isInitialized = false;
    this.sessionId = null; // ID sesji czatu
    
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
  
      
      // Sprawdź wsparcie przeglądarki
      this.checkBrowserSupport();
      
      // Utwórz container
      this.createContainer();
      
      // Utwórz komponenty
    this.createComponents();
    
    // Inicjalizuj serwisy
    this.initServices();
    
    // Binduj eventy
    this.bindEvents();
      
      // Sprawdź uprawnienia mikrofonu
      await this.checkMicrophonePermissions();
      
      this.isInitialized = true;
      this.events.emit('initialized');
      
  
      
    } catch (error) {
      console.error('VirtualAdvisor: Initialization failed:', error);
      this.handleError(error);
    }
  }

  /**
   * Sprawdza wsparcie przeglądarki
   */
  checkBrowserSupport() {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      throw new Error('Browser does not support microphone access');
    }
    
    if (!window.AudioContext && !window.webkitAudioContext) {
      throw new Error('Browser does not support Web Audio API');
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
    this.voiceButton = new VoiceButton(this.container, this.config, this.events);
    
    // Utwórz modal
    this.modal = new Modal(this.container, this.config, this.events);
    

  }

  /**
   * Binduje eventy
   */
  bindEvents() {
    // Eventy z przycisku
    this.events.on(EVENTS.LISTENING_START, () => {
      this.startListening();
    });
    
    // Event automatycznego powitania po otwarciu modala
    this.events.on('conversation:start-with-greeting', async () => {
      await this.startConversationWithGreeting();
    });

    this.events.on(EVENTS.LISTENING_STOP, () => {
      this.stopListening();
    });

    // Eventy stanu
    this.events.on(EVENTS.STATE_CHANGE, (newState) => {
  
    });


  }

  /**
   * Sprawdza uprawnienia mikrofonu
   */
  async checkMicrophonePermissions() {
    try {
      const permission = await navigator.permissions.query({ name: 'microphone' });
      
      if (permission.state === 'denied') {
        console.warn('VirtualAdvisor: Microphone permission denied');
        return false;
      }
      

      return true;
      
    } catch (error) {
      console.warn('VirtualAdvisor: Could not check microphone permissions:', error);
      return true; // Assume it's OK if we can't check
    }
  }

  /**
   * Rozpoczyna rozmowę z powitaniem z API
   */
  async startConversationWithGreeting() {
    if (this.state !== STATES.IDLE) {
      console.warn('VirtualAdvisor: Cannot start conversation, not in idle state');
      return;
    }

    try {
  
      this.changeState(STATES.PROCESSING);
      
      // Wywołaj endpoint /api/chat/start
      const response = await fetch(`${this.config.apiUrl}/chat/start`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error(`API error: ${response.status}`);
      }

      const data = await response.json();
      const greetingMessage = data.data.attributes.message;
      this.sessionId = data.data.attributes.sessionId; // Zapisz sessionId
      

      
      // Dodaj wiadomość do transkrypcji
      this.addAssistantMessage(greetingMessage);
      
      // Przeczytaj wiadomość głośno (automatycznie rozpocznie nasłuchiwanie po zakończeniu)
      await this.speakResponse(greetingMessage);
      
    } catch (error) {
      console.error('VirtualAdvisor: Failed to start conversation with greeting:', error);
      this.addAssistantMessage('⚠️ Nie udało się połączyć z serwerem. Spróbuj ponownie.');
      this.changeState(STATES.IDLE);
      this.handleError(error);
    }
  }

  /**
   * Rozpoczyna słuchanie
   */
  async startListening() {
    if (this.state !== STATES.IDLE) {
      console.warn('VirtualAdvisor: Cannot start listening, not in idle state');
      return;
    }

    try {
  
      this.changeState(STATES.LISTENING);
      
      // Inicjalizuj rozpoznawanie mowy
      this.initSpeechRecognition();
      
    } catch (error) {
      console.error('VirtualAdvisor: Failed to start listening:', error);
      this.handleError(error);
    }
  }

  /**
   * Zatrzymuje słuchanie
   */
  stopListening() {
    if (this.state !== STATES.LISTENING) {
      console.warn('VirtualAdvisor: Cannot stop listening, not in listening state');
      return;
    }


    
    // Zatrzymaj rozpoznawanie mowy
    if (this.speechRecognition) {
      this.speechRecognition.stop();
    }
    
    this.changeState(STATES.PROCESSING);
    
    // Przetwarzanie rozpocznie się automatycznie w addUserMessage po otrzymaniu transkrypcji
  }

  /**
   * Inicjalizuje rozpoznawanie mowy
   */
  initSpeechRecognition() {
    if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) {
      console.error('VirtualAdvisor: Speech recognition not supported');
      this.handleError(new Error('Rozpoznawanie mowy nie jest obsługiwane w tej przeglądarce'));
      return;
    }

    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    this.speechRecognition = new SpeechRecognition();
    
    this.speechRecognition.continuous = false;
    this.speechRecognition.interimResults = true;
    this.speechRecognition.lang = 'pl-PL';
    
    this.speechRecognition.onstart = () => {

    };
    
    this.speechRecognition.onresult = (event) => {
      let finalTranscript = '';
      let interimTranscript = '';
      
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const transcript = event.results[i][0].transcript;
        if (event.results[i].isFinal) {
          finalTranscript += transcript;
        } else {
          interimTranscript += transcript;
        }
      }
      
      if (finalTranscript) {
  
        this.addUserMessage(finalTranscript);
        this.stopListening();
      }
    };
    
    this.speechRecognition.onerror = (event) => {
      console.error('VirtualAdvisor: Speech recognition error:', event.error);
      this.handleError(new Error(`Błąd rozpoznawania mowy: ${event.error}`));
    };
    
    this.speechRecognition.onend = () => {

      if (this.state === STATES.LISTENING) {
        // Jeśli nadal jesteśmy w stanie słuchania, ale rozpoznawanie się zakończyło
        // przejdź do stanu przetwarzania - przetwarzanie rozpocznie się automatycznie w addUserMessage
        this.changeState(STATES.PROCESSING);
      }
    };
    
    this.speechRecognition.start();
  }

  /**
   * Dodaje wiadomość użytkownika do transkrypcji i rozpoczyna przetwarzanie
   */
  async addUserMessage(message) {
    if (this.modal) {
      this.modal.addTranscriptMessage('user', message);
    }

    
    // Automatycznie przetwórz wiadomość użytkownika
    await this.processUserMessage(message);
  }
  
  /**
   * Dodaje odpowiedź asystenta do transkrypcji
   */
  addAssistantMessage(message) {
    if (this.modal) {
      this.modal.addTranscriptMessage('assistant', message);
    }

  }

  /**
   * Inicjalizuje serwisy
   */
  initServices() {
    
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
  }

  /*   * Pobiera wyniki rozmowy z API
   */
  async fetchConversationResults() {
    if (!this.sessionId) {
      console.error('VirtualAdvisor: No session ID for fetching results');
      return;
    }

    try {
      const response = await fetch(`${this.config.apiUrl}/chat/mortgage-offers/${this.sessionId}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
      });

      if (!response.ok) {
        throw new Error(`API error: ${response.status}`);
      }

      const results = await response.json();

      console.log(results);
      this.displayConversationResults(results);
      
    } catch (error) {
      console.error('VirtualAdvisor: Failed to fetch conversation results:', error);
      this.addAssistantMessage('⚠️ Nie udało się pobrać wyników rozmowy.');
    }
  }

  /**
   * Wyświetla wyniki rozmowy w osobnej sekcji
   */
  displayConversationResults(results) {
     // Utwórz overlay tło
     let overlay = document.querySelector('.results-overlay');
     if (!overlay) {
       overlay = document.createElement('div');
       overlay.className = 'results-overlay';
       overlay.style.cssText = `
         position: fixed;
         top: 0;
         left: 0;
         width: 100%;
         height: 100%;
         background: rgba(0, 0, 0, 0.7);
         z-index: 10000;
         backdrop-filter: blur(5px);
       `;
       document.body.appendChild(overlay);
     }
     
     // Utwórz sekcję wyników jeśli nie istnieje
     let resultsSection = document.querySelector('.conversation-results');
     if (!resultsSection) {
      resultsSection = document.createElement('div');
      resultsSection.className = 'conversation-results';
      resultsSection.innerHTML = `
         <div class="results-header" style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 20px; border-radius: 16px 16px 0 0; display: flex; justify-content: space-between; align-items: center; box-shadow: 0 2px 10px rgba(0,0,0,0.1);">
           <h3 style="margin: 0; font-size: 20px; font-weight: 600;">📊 Wyniki analizy</h3>
           <button class="close-results" style="background: rgba(255,255,255,0.2); border: none; color: white; width: 32px; height: 32px; border-radius: 50%; cursor: pointer; font-size: 18px; display: flex; align-items: center; justify-content: center; transition: all 0.2s ease;">✕</button>
         </div>
         <div class="results-content"></div>
       `;
      
      // Dodaj style
       resultsSection.style.cssText = `
         position: fixed;
         top: 50%;
         left: 50%;
         transform: translate(-50%, -50%);
         background: #ffffff;
         border: 2px solid #e0e0e0;
         border-radius: 16px;
         box-shadow: 0 25px 50px rgba(0,0,0,0.5), 0 0 0 1px rgba(255,255,255,0.8);
         max-width: 700px;
         max-height: 85vh;
         overflow-y: auto;
         z-index: 10001;
         padding: 0;
         backdrop-filter: blur(10px);
       `;
      
      document.body.appendChild(resultsSection);
      
      // Obsługa zamykania
       const closeResults = () => {
         resultsSection.remove();
         const overlay = document.querySelector('.results-overlay');
         if (overlay) overlay.remove();
       };
       
       resultsSection.querySelector('.close-results').addEventListener('click', closeResults);
       
       // Zamknij po kliknięciu w overlay
       const overlay = document.querySelector('.results-overlay');
       if (overlay) {
         overlay.addEventListener('click', closeResults);
       }
    }
    
    // Wypełnij zawartość
      const content = resultsSection.querySelector('.results-content');
      
      // Sprawdź czy są oferty w odpowiedzi
      const offers = results?.offers?.items || [];
      
      if (offers.length > 0) {
        const offersHtml = offers.map(offer => {
          const bank = offer.bank || {};
          const logoUrl = bank.logo?.medium || '';
          const bankName = bank.name || 'Nieznany bank';
          const title = offer.title || 'Brak nazwy oferty';
          const creditValue = offer.cost?.creditValue || 0;
          const monthlyInstallment = offer.installment?.equal?.monthly || 0;
          const interestRate = offer.interest?.value || 0;
          
          return `
            <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; padding: 20px; margin-bottom: 16px; box-shadow: 0 2px 4px rgba(0,0,0,0.05);">
              <div style="display: flex; align-items: center; margin-bottom: 16px;">
                ${logoUrl ? `<img src="${logoUrl}" alt="${bankName}" style="max-height: 40px; margin-right: 16px; border-radius: 4px;">` : ''}
                <h4 style="margin: 0; color: #1a202c; font-size: 18px; font-weight: 600;">${bankName}</h4>
              </div>
              <h5 style="margin: 0 0 12px 0; color: #2d3748; font-size: 16px; line-height: 1.4;">${title}</h5>
              <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 12px; margin-top: 16px;">
                <div style="background: white; padding: 12px; border-radius: 8px; border-left: 4px solid #4299e1;">
                  <div style="font-size: 12px; color: #718096; margin-bottom: 4px;">Kwota kredytu</div>
                  <div style="font-size: 18px; font-weight: 600; color: #2d3748;">${creditValue.toLocaleString('pl-PL')} zł</div>
                </div>
                <div style="background: white; padding: 12px; border-radius: 8px; border-left: 4px solid #48bb78;">
                  <div style="font-size: 12px; color: #718096; margin-bottom: 4px;">Rata miesięczna</div>
                  <div style="font-size: 18px; font-weight: 600; color: #2d3748;">${monthlyInstallment.toLocaleString('pl-PL', {minimumFractionDigits: 2, maximumFractionDigits: 2})} zł</div>
                </div>
                <div style="background: white; padding: 12px; border-radius: 8px; border-left: 4px solid #ed8936;">
                  <div style="font-size: 12px; color: #718096; margin-bottom: 4px;">Oprocentowanie</div>
                  <div style="font-size: 18px; font-weight: 600; color: #2d3748;">${interestRate.toFixed(2)}%</div>
                </div>
              </div>
            </div>
          `;
        }).join('');
        
        content.innerHTML = `
          <div style="padding: 25px;">
            <div style="margin-bottom: 20px;">
              <h4 style="margin: 0 0 8px 0; color: #2d3748; font-size: 18px;">Znalezione oferty kredytowe (${offers.length})</h4>
              <p style="margin: 0; color: #718096; font-size: 14px;">Poniżej przedstawiamy najlepsze oferty dopasowane do Twoich potrzeb:</p>
            </div>
            ${offersHtml}
          </div>
        `;
      } else {
        content.innerHTML = `
          <div style="padding: 25px; text-align: center;">
            <div style="color: #718096; font-size: 16px;">Brak dostępnych ofert</div>
            <pre style="background: #2d3748; color: #e2e8f0; padding: 20px; border-radius: 12px; overflow-x: auto; white-space: pre-wrap; font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace; font-size: 14px; line-height: 1.5; border: 1px solid #4a5568; box-shadow: inset 0 2px 4px rgba(0,0,0,0.1); margin-top: 16px; text-align: left;">${JSON.stringify(results, null, 2)}</pre>
          </div>
        `;
      }
     
     // Dodaj hover effect dla przycisku zamykania
     const closeBtn = resultsSection.querySelector('.close-results');
     closeBtn.addEventListener('mouseenter', () => {
       closeBtn.style.background = 'rgba(255,255,255,0.3)';
       closeBtn.style.transform = 'scale(1.1)';
     });
     closeBtn.addEventListener('mouseleave', () => {
       closeBtn.style.background = 'rgba(255,255,255,0.2)';
       closeBtn.style.transform = 'scale(1)';
     });
  }

  /**
   * Symuluje przetwarzanie (temporary)
   */
  async processUserMessage(userMessage) {

    
    if (!this.sessionId) {
      console.error('VirtualAdvisor: No session ID available');
      this.addAssistantMessage('⚠️ Błąd sesji. Spróbuj ponownie.');
      this.changeState(STATES.IDLE);
      return;
    }

    try {
      const response = await fetch(`${this.config.apiUrl}/chat/answer`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        body: JSON.stringify({
          sessionId: this.sessionId,
          answer: userMessage
        })
      });

      if (!response.ok) {
        throw new Error(`API error: ${response.status}`);
      }

      const data = await response.json();
      const assistantMessage = data.question;
      
      // Sprawdź czy rozmowa się zakończyła
      const isCompleted = data.data?.attributes?.isCompleted || assistantMessage.includes('Analizuję Twoje dane i przygotowuję oferty');
      
      if (isCompleted) {
        this.changeState(STATES.SPEAKING);
        this.addAssistantMessage(assistantMessage);
        await this.speakResponse(assistantMessage);
        
        // Po zakończeniu mowy pobierz wyniki
        await this.fetchConversationResults();
      } else {
        this.changeState(STATES.SPEAKING);
        this.addAssistantMessage(assistantMessage);
        await this.speakResponse(assistantMessage);
      }
      
    } catch (error) {
      console.error('VirtualAdvisor: Failed to process message:', error);
      this.addAssistantMessage('⚠️ Nie udało się przetworzyć wiadomości. Spróbuj ponownie.');
      this.changeState(STATES.IDLE);
    }
  }

  /**
   * Odtwarza odpowiedź głosową
   */
  async speakResponse(text) {
    if (!this.elevenLabsService || !this.elevenLabsService.isConfigured()) {
      console.warn('VirtualAdvisor: ElevenLabs not configured, using fallback');
      this.addAssistantMessage('⚠️ Text-to-speech niedostępny. Używam trybu tekstowego.');
      this.simulateSpeaking();
      return;
    }

    try {

      await this.elevenLabsService.speak(text);
      
      // Po zakończeniu mówienia wróć do stanu idle i rozpocznij nasłuchiwanie
      this.changeState(STATES.IDLE);
      await this.startListening();

      
    } catch (error) {
      console.error('VirtualAdvisor: Speech synthesis failed:', error);
      
      // Sprawdź typ błędu i pokaż odpowiedni komunikat
      if (error.message.includes('401') || error.message.includes('invalid_api_key')) {
        this.addAssistantMessage('⚠️ Błąd autoryzacji ElevenLabs API. Sprawdź klucz API.');
      } else if (error.message.includes('quota') || error.message.includes('limit')) {
        this.addAssistantMessage('⚠️ Przekroczono limit ElevenLabs API. Używam trybu tekstowego.');
      } else {
        this.addAssistantMessage('⚠️ Błąd syntezy mowy. Używam trybu tekstowego.');
      }
      
      // Fallback do symulacji
      this.simulateSpeaking();
    }
  }

  /**
   * Symuluje mówienie (fallback)
   */
  async simulateSpeaking() {

    
    setTimeout(async () => {
      this.changeState(STATES.IDLE);
      await this.startListening();

    }, 3000);
  }

  /**
   * Zmienia stan aplikacji
   */
  changeState(newState) {
    if (this.state === newState) return;
    
    const oldState = this.state;
    this.state = newState;
    
    this.events.emit(EVENTS.STATE_CHANGE, newState, oldState);
    
    // Emituj szczegółowe eventy
    switch (newState) {
      case STATES.LISTENING:
        this.events.emit(EVENTS.LISTENING_START);
        break;
      case STATES.PROCESSING:
        this.events.emit(EVENTS.PROCESSING_START);
        break;
      case STATES.SPEAKING:
        this.events.emit(EVENTS.SPEAKING_START);
        break;
      case STATES.IDLE:
        this.events.emit(EVENTS.PROCESSING_COMPLETE);
        break;
    }
  }

  /**
   * Obsługuje błędy
   */
  handleError(error) {
    console.error('VirtualAdvisor: Error occurred:', error);
    
    this.changeState(STATES.ERROR);
    this.events.emit(EVENTS.ERROR, error);
    
    // Wróć do stanu idle po 3 sekundach
    setTimeout(() => {
      if (this.state === STATES.ERROR) {
        this.changeState(STATES.IDLE);
      }
    }, 3000);
  }

  /**
   * Publiczne API - dodaje event listener
   */
  on(event, callback) {
    this.events.on(event, callback);
  }

  /**
   * Publiczne API - usuwa event listener
   */
  off(event, callback) {
    this.events.off(event, callback);
  }

  /**
   * Publiczne API - emituje event
   */
  emit(event, ...args) {
    this.events.emit(event, ...args);
  }

  /**
   * Publiczne API - pobiera aktualny stan
   */
  getState() {
    return this.state;
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
      this.voiceButton.updateState(this.state);
    }
  }

  /**
   * Publiczne API - uruchamia nasłuch programowo
   */
  async startConversation() {
    if (this.state === STATES.IDLE) {
      await this.startListening();
    }
  }

  /**
   * Publiczne API - zatrzymuje nasłuch programowo
   */
  stopConversation() {
    if (this.state === STATES.LISTENING) {
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
    return this.isInitialized;
  }

  /**
   * Czyści plugin
   */
  destroy() {

    
    // Zatrzymaj wszystkie operacje
    this.changeState(STATES.IDLE);
    
    // Usuń komponenty
    if (this.voiceButton) {
      this.voiceButton.destroy();
      this.voiceButton = null;
    }
    
    if (this.modal) {
      this.modal.destroy();
      this.modal = null;
    }
    
    // Usuń container
    if (this.container) {
      this.container.remove();
      this.container = null;
    }
    
    // Wyczyść eventy
    this.events.removeAllListeners();
    
    this.isInitialized = false;

  }
}