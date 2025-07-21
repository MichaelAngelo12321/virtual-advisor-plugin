import { STATES, EVENTS } from '../utils/constants.js';

/**
 * Komponent modala rozmowy
 */
export class Modal {
  constructor(container, config, eventEmitter) {
    this.container = container;
    this.config = config;
    this.events = eventEmitter;
    this.state = STATES.IDLE;
    this.element = null;
    this.isVisible = false;
    
    this.init();
    this.bindEvents();
  }

  /**
   * Inicjalizuje komponent
   */
  init() {
    this.createElement();
  }

  /**
   * Tworzy element HTML modala
   */
  createElement() {
    this.element = document.createElement('div');
    this.element.className = 'virtual-advisor-modal';
    this.element.style.display = 'none';
    
    this.element.innerHTML = `
      <div class="modal-overlay">
        <div class="modal-content">
          <div class="modal-header">
            <h2>Asystent Głosowy</h2>
            <button class="modal-close" aria-label="Zamknij">
              <svg viewBox="0 0 24 24" width="24" height="24">
                <line x1="18" y1="6" x2="6" y2="18"></line>
                <line x1="6" y1="6" x2="18" y2="18"></line>
              </svg>
            </button>
          </div>
          
          <div class="modal-body">
            <div class="conversation-status">
              <div class="status-icon">
                <svg class="icon icon-mic" viewBox="0 0 24 24">
                  <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/>
                  <path d="M19 10v2a7 7 0 0 1-14 0v-2"/>
                  <line x1="12" y1="19" x2="12" y2="23"/>
                  <line x1="8" y1="23" x2="16" y2="23"/>
                </svg>
                <svg class="icon icon-listening" viewBox="0 0 24 24" style="display: none;">
                  <circle cx="12" cy="12" r="3"/>
                  <path d="M12 1v6M12 17v6M4.22 4.22l4.24 4.24M15.54 15.54l4.24 4.24M1 12h6M17 12h6M4.22 19.78l4.24-4.24M15.54 8.46l4.24-4.24"/>
                </svg>
                <svg class="icon icon-processing" viewBox="0 0 24 24" style="display: none;">
                  <circle cx="12" cy="12" r="10"/>
                  <path d="M8 12l2 2 4-4"/>
                </svg>
                <svg class="icon icon-speaking" viewBox="0 0 24 24" style="display: none;">
                  <path d="M11 5L6 9H2v6h4l5 4V5z"/>
                  <path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07"/>
                </svg>
              </div>
              
              <div class="status-text">
                <h3 class="status-title">Gotowy do rozmowy</h3>
                <p class="status-description">Kliknij przycisk poniżej aby rozpocząć rozmowę</p>
              </div>
            </div>
            
            <div class="conversation-controls">
              <button class="conversation-button state-idle">
                <span class="button-text">Rozpocznij rozmowę</span>
              </button>
            </div>
            
            <div class="conversation-transcript">
              <div class="transcript-header">Transkrypcja rozmowy:</div>
              <div class="transcript-content">
                <div class="transcript-empty">Rozmowa jeszcze się nie rozpoczęła...</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    `;
    
    document.body.appendChild(this.element);
  }

  /**
   * Binduje eventy
   */
  bindEvents() {
    // Zamknięcie modala
    const closeButton = this.element.querySelector('.modal-close');
    closeButton.addEventListener('click', () => {
      this.hide();
    });

    // Zamknięcie przez kliknięcie w overlay
    const overlay = this.element.querySelector('.modal-overlay');
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) {
        this.hide();
      }
    });

    // Przycisk rozmowy
    const conversationButton = this.element.querySelector('.conversation-button');
    conversationButton.addEventListener('click', () => {
      this.handleConversationButtonClick();
    });

    // Eventy z głównego komponentu
    this.events.on('modal:show', () => {
      this.show();
    });

    this.events.on('modal:hide', () => {
      this.hide();
    });

    this.events.on(EVENTS.STATE_CHANGE, (newState) => {
      this.updateState(newState);
    });

    // Obsługa wiadomości w transkrypcji
    this.events.on('message:user', (message) => {
      this.addTranscriptMessage('user', message);
    });

    this.events.on('message:assistant', (message) => {
      this.addTranscriptMessage('assistant', message);
    });

    // Escape key
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && this.isVisible) {
        this.hide();
      }
    });
  }

  /**
   * Obsługuje kliknięcie przycisku rozmowy
   */
  handleConversationButtonClick() {
    if (this.state === STATES.IDLE) {
      this.events.emit(EVENTS.LISTENING_START);
    } else if (this.state === STATES.LISTENING) {
      this.events.emit(EVENTS.LISTENING_STOP);
    }
  }

  /**
   * Pokazuje modal
   */
  show() {
    this.element.style.display = 'flex';
    this.isVisible = true;
    
    // Animacja wejścia
    requestAnimationFrame(() => {
      this.element.classList.add('modal-visible');
    });
    
    // Zablokuj scroll na body
    document.body.style.overflow = 'hidden';
    
    // Automatycznie rozpocznij rozmowę z powitaniem
    setTimeout(() => {
      this.events.emit('conversation:start-with-greeting');
    }, 500); // Krótkie opóźnienie dla animacji
  }

  /**
   * Ukrywa modal
   */
  hide() {
    this.element.classList.remove('modal-visible');
    
    setTimeout(() => {
      this.element.style.display = 'none';
      this.isVisible = false;
    }, 300);
    
    // Przywróć scroll na body
    document.body.style.overflow = '';
    
    // Zatrzymaj rozmowę jeśli trwa
    if (this.state === STATES.LISTENING) {
      this.events.emit(EVENTS.LISTENING_STOP);
    }
  }

  /**
   * Aktualizuje stan modala
   */
  updateState(newState) {
    if (this.state === newState) return;
    
    const oldState = this.state;
    this.state = newState;
    
    this.updateStatusIcon();
    this.updateStatusText();
    this.updateConversationButton();
    
    
  }

  /**
   * Aktualizuje ikonę statusu
   */
  updateStatusIcon() {
    const icons = this.element.querySelectorAll('.status-icon .icon');
    icons.forEach(icon => {
      icon.style.display = 'none';
    });

    let iconClass = 'icon-mic';
    switch (this.state) {
      case STATES.IDLE:
        iconClass = 'icon-mic';
        break;
      case STATES.LISTENING:
        iconClass = 'icon-listening';
        break;
      case STATES.PROCESSING:
        iconClass = 'icon-processing';
        break;
      case STATES.SPEAKING:
        iconClass = 'icon-speaking';
        break;
    }

    const activeIcon = this.element.querySelector(`.status-icon .${iconClass}`);
    if (activeIcon) {
      activeIcon.style.display = 'block';
    }
  }

  /**
   * Aktualizuje tekst statusu
   */
  updateStatusText() {
    const title = this.element.querySelector('.status-title');
    const description = this.element.querySelector('.status-description');
    
    const statusTexts = {
      [STATES.IDLE]: {
        title: 'Gotowy do rozmowy',
        description: 'Kliknij przycisk poniżej aby rozpocząć rozmowę'
      },
      [STATES.LISTENING]: {
        title: 'Słucham...',
        description: 'Mów teraz, słucham Cię uważnie'
      },
      [STATES.PROCESSING]: {
        title: 'Przetwarzam...',
        description: 'Analizuję Twoją wiadomość i przygotowuję odpowiedź'
      },
      [STATES.SPEAKING]: {
        title: 'Odpowiadam...',
        description: 'Słuchaj mojej odpowiedzi'
      },
      [STATES.ERROR]: {
        title: 'Wystąpił błąd',
        description: 'Spróbuj ponownie za chwilę'
      }
    };

    const status = statusTexts[this.state] || statusTexts[STATES.IDLE];
    title.textContent = status.title;
    description.textContent = status.description;
  }

  /**
   * Aktualizuje przycisk rozmowy
   */
  updateConversationButton() {
    const button = this.element.querySelector('.conversation-button');
    const buttonText = button.querySelector('.button-text');
    
    button.className = `conversation-button state-${this.state}`;
    
    const buttonTexts = {
      [STATES.IDLE]: 'Rozpocznij rozmowę',
      [STATES.LISTENING]: 'Zatrzymaj nagrywanie',
      [STATES.PROCESSING]: 'Przetwarzam...',
      [STATES.SPEAKING]: 'Słuchaj odpowiedzi',
      [STATES.ERROR]: 'Spróbuj ponownie'
    };

    buttonText.textContent = buttonTexts[this.state] || buttonTexts[STATES.IDLE];
    
    // Wyłącz przycisk podczas przetwarzania i mówienia
    button.disabled = this.state === STATES.PROCESSING || this.state === STATES.SPEAKING;
  }

  /**
   * Dodaje wiadomość do transkrypcji
   */
  addTranscriptMessage(type, message) {
    const transcriptContent = this.element.querySelector('.transcript-content');
    const emptyMessage = transcriptContent.querySelector('.transcript-empty');
    
    if (emptyMessage) {
      emptyMessage.remove();
    }
    
    const messageElement = document.createElement('div');
    messageElement.className = `transcript-message ${type}`;
    messageElement.innerHTML = `
      <div class="message-label">${type === 'user' ? 'Ty:' : 'Asystent:'}</div>
      <div class="message-text">${message}</div>
    `;
    
    transcriptContent.appendChild(messageElement);
    transcriptContent.scrollTop = transcriptContent.scrollHeight;
  }

  /**
   * Czyści transkrypcję
   */
  clearTranscript() {
    const transcriptContent = this.element.querySelector('.transcript-content');
    transcriptContent.innerHTML = '<div class="transcript-empty">Rozmowa jeszcze się nie rozpoczęła...</div>';
  }

  /**
   * Niszczy komponent
   */
  destroy() {
    if (this.element) {
      this.element.remove();
      this.element = null;
    }
    
    // Przywróć scroll na body
    document.body.style.overflow = '';
  }
}