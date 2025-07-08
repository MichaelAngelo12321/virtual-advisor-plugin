/**
 * Prosty Event Emitter do komunikacji między komponentami
 */
export class EventEmitter {
  constructor() {
    this.events = {};
  }

  /**
   * Dodaje listener dla określonego eventu
   * @param {string} event - Nazwa eventu
   * @param {function} callback - Funkcja callback
   */
  on(event, callback) {
    if (!this.events[event]) {
      this.events[event] = [];
    }
    this.events[event].push(callback);
  }

  /**
   * Dodaje listener który wykona się tylko raz
   * @param {string} event - Nazwa eventu
   * @param {function} callback - Funkcja callback
   */
  once(event, callback) {
    const onceCallback = (...args) => {
      callback(...args);
      this.off(event, onceCallback);
    };
    this.on(event, onceCallback);
  }

  /**
   * Usuwa listener dla określonego eventu
   * @param {string} event - Nazwa eventu
   * @param {function} callback - Funkcja callback do usunięcia
   */
  off(event, callback) {
    if (!this.events[event]) return;

    const index = this.events[event].indexOf(callback);
    if (index > -1) {
      this.events[event].splice(index, 1);
    }
  }

  /**
   * Emituje event z opcjonalnymi danymi
   * @param {string} event - Nazwa eventu
   * @param {...any} args - Argumenty przekazane do callbacków
   */
  emit(event, ...args) {
    if (!this.events[event]) return;

    this.events[event].forEach(callback => {
      try {
        callback(...args);
      } catch (error) {
        console.error(`Error in event listener for ${event}:`, error);
      }
    });
  }

  /**
   * Usuwa wszystkie listenery dla eventu lub wszystkie
   * @param {string} [event] - Opcjonalna nazwa eventu
   */
  removeAllListeners(event) {
    if (event) {
      delete this.events[event];
    } else {
      this.events = {};
    }
  }

  /**
   * Sprawdza czy event ma jakiekolwiek listenery
   * @param {string} event - Nazwa eventu
   * @returns {boolean}
   */
  hasListeners(event) {
    return !!(this.events[event] && this.events[event].length > 0);
  }
}