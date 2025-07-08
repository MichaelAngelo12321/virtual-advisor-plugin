import { STATES, EVENTS } from '../utils/constants.js';

/**
 * Komponent przycisku głosowego
 */
export class VoiceButton {
  constructor(container, config, eventEmitter) {
    this.container = container;
    this.config = config;
    this.events = eventEmitter;
    this.state = STATES.IDLE;
    this.element = null;
    
    this.init();
    this.bindEvents();
  }

  /**
   * Inicjalizuje komponent
   */
  init() {
    this.createElement();
    this.updateState(STATES.IDLE);
  }

  /**
   * Tworzy element HTML przycisku
   */
  createElement() {
    this.element = document.createElement('button');
    this.element.className = `voice-button theme-${this.config.ui.theme} state-${this.state}`;
    this.element.setAttribute('aria-label', 'Asystent głosowy');
    this.element.setAttribute('data-tooltip', 'Kliknij aby rozpocząć rozmowę');
    
    // Dodaj ikony SVG
    this.element.innerHTML = this.getIconsHTML();
    
    // Dodaj wskaźnik statusu
    const statusIndicator = document.createElement('div');
    statusIndicator.className = 'status-indicator';
    this.element.appendChild(statusIndicator);
    
    this.container.appendChild(this.element);
  }

  /**
   * Zwraca HTML z ikonami SVG
   */
  getIconsHTML() {
    return `
      <svg class="icon icon-mic" viewBox="0 0 24 24" style="display: block;">
        <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/>
        <path d="M19 10v2a7 7 0 0 1-14 0v-2"/>
        <line x1="12" y1="19" x2="12" y2="23"/>
        <line x1="8" y1="23" x2="16" y2="23"/>
      </svg>
      <svg class="icon icon-stop" viewBox="0 0 24 24" style="display: none;">
        <rect x="6" y="6" width="12" height="12" rx="2"/>
      </svg>
      <svg class="icon icon-processing" viewBox="0 0 24 24" style="display: none;">
        <circle cx="12" cy="12" r="3"/>
        <path d="M12 1v6M12 17v6M4.22 4.22l4.24 4.24M15.54 15.54l4.24 4.24M1 12h6M17 12h6M4.22 19.78l4.24-4.24M15.54 8.46l4.24-4.24"/>
      </svg>
      <svg class="icon icon-speaking" viewBox="0 0 24 24" style="display: none;">
        <path d="M11 5L6 9H2v6h4l5 4V5z"/>
        <path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07"/>
      </svg>
      <svg class="icon icon-error" viewBox="0 0 24 24" style="display: none;">
        <circle cx="12" cy="12" r="10"/>
        <line x1="15" y1="9" x2="9" y2="15"/>
        <line x1="9" y1="9" x2="15" y2="15"/>
      </svg>
    `;
  }

  /**
   * Binduje eventy
   */
  bindEvents() {
    // Kliknięcie przycisku
    this.element.addEventListener('click', (e) => {
      e.preventDefault();
      this.handleClick();
    });

    // Eventy z głównego komponentu
    this.events.on(EVENTS.STATE_CHANGE, (newState) => {
      this.updateState(newState);
    });

    // Keyboard support
    this.element.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        this.handleClick();
      }
    });

    // Touch support
    this.element.addEventListener('touchstart', (e) => {
      e.preventDefault();
      this.handleClick();
    });
  }

  /**
   * Obsługuje kliknięcie przycisku
   */
  handleClick() {
    if (this.state === STATES.IDLE) {
      this.events.emit('modal:show');
    } else if (this.state === STATES.LISTENING) {
      this.events.emit(EVENTS.LISTENING_STOP);
    }
  }

  /**
   * Aktualizuje stan przycisku
   */
  updateState(newState) {
    if (this.state === newState) return;
    
    const oldState = this.state;
    this.state = newState;
    
    // Aktualizuj klasy CSS
    this.element.className = `voice-button theme-${this.config.ui.theme} state-${this.state}`;
    
    // Aktualizuj ikony
    this.updateIcons();
    
    // Aktualizuj wskaźnik statusu
    this.updateStatusIndicator();
    
    // Aktualizuj tooltip
    this.updateTooltip();
    
    
  }

  /**
   * Aktualizuje widoczność ikon
   */
  updateIcons() {
    const icons = this.element.querySelectorAll('.icon');
    icons.forEach(icon => {
      icon.style.display = 'none';
    });

    let iconClass = 'icon-mic';
    switch (this.state) {
      case STATES.IDLE:
        iconClass = 'icon-mic';
        break;
      case STATES.LISTENING:
        iconClass = 'icon-stop';
        break;
      case STATES.PROCESSING:
        iconClass = 'icon-processing';
        break;
      case STATES.SPEAKING:
        iconClass = 'icon-speaking';
        break;
      case STATES.ERROR:
        iconClass = 'icon-error';
        break;
    }

    const activeIcon = this.element.querySelector(`.${iconClass}`);
    if (activeIcon) {
      activeIcon.style.display = 'block';
    }
  }

  /**
   * Aktualizuje wskaźnik statusu
   */
  updateStatusIndicator() {
    const indicator = this.element.querySelector('.status-indicator');
    if (indicator) {
      indicator.className = `status-indicator ${this.state}`;
    }
  }

  /**
   * Aktualizuje tooltip
   */
  updateTooltip() {
    const tooltips = {
      [STATES.IDLE]: 'Kliknij aby rozpocząć rozmowę',
      [STATES.LISTENING]: 'Słucham... Kliknij aby zatrzymać',
      [STATES.PROCESSING]: 'Przetwarzam Twoją wiadomość...',
      [STATES.SPEAKING]: 'Odpowiadam...',
      [STATES.ERROR]: 'Wystąpił błąd. Kliknij aby spróbować ponownie'
    };

    this.element.setAttribute('data-tooltip', tooltips[this.state] || '');
  }

  /**
   * Pokazuje błąd z animacją
   */
  showError(message) {
    this.updateState(STATES.ERROR);
    
    // Opcjonalnie pokaż toast z błędem
    if (message) {
      console.error('VoiceButton Error:', message);
      // Można dodać toast notification tutaj
    }
    
    // Automatycznie wróć do stanu idle po 3 sekundach
    setTimeout(() => {
      if (this.state === STATES.ERROR) {
        this.updateState(STATES.IDLE);
      }
    }, 3000);
  }

  /**
   * Czyści komponent
   */
  destroy() {
    if (this.element) {
      this.element.remove();
      this.element = null;
    }
    
    this.events.removeAllListeners();
  }
}