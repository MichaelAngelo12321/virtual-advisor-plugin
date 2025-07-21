import { EventEmitter } from '../utils/eventEmitter.js';
import { STATES, EVENTS } from '../utils/constants.js';

/**
 * Menedżer stanu aplikacji
 */
export class StateManager {
  constructor() {
    this.state = STATES.IDLE;
    this.events = new EventEmitter();
    this.sessionId = null;
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
   * Pobiera aktualny stan
   */
  getState() {
    return this.state;
  }

  /**
   * Ustawia ID sesji
   */
  setSessionId(sessionId) {
    this.sessionId = sessionId;
  }

  /**
   * Pobiera ID sesji
   */
  getSessionId() {
    return this.sessionId;
  }

  /**
   * Sprawdza czy można rozpocząć słuchanie
   */
  canStartListening() {
    return this.state === STATES.IDLE;
  }

  /**
   * Sprawdza czy można zatrzymać słuchanie
   */
  canStopListening() {
    return this.state === STATES.LISTENING;
  }

  /**
   * Obsługuje błędy
   */
  handleError(error) {
    console.error('StateManager: Error occurred:', error);
    
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
   * Emituje event
   */
  emit(event, ...args) {
    this.events.emit(event, ...args);
  }

  /**
   * Czyści wszystkie eventy
   */
  destroy() {
    this.events.removeAllListeners();
  }
}