// Import CSS
import './plugin.css';

// Import all frontend modules
import { SessionManager } from '../frontend/session.js';
import { UIManager } from '../frontend/ui.js';
import { MicrophoneStreamer } from '../frontend/microphone.js';
import { PlaybackController } from '../frontend/playback.js';

/**
 * Virtual Advisor Plugin - Główna klasa wtyczki
 * Umożliwia łatwe dodanie asystenta głosowego do dowolnej strony internetowej
 */
class VirtualAdvisorPlugin {
    constructor(options = {}) {
        this.options = {
            serverUrl: options.serverUrl || 'ws://localhost:3001',
            apiUrl: options.apiUrl || 'http://localhost:8001',
            containerId: options.containerId || 'virtual-advisor-container',
            autoStart: options.autoStart || false,
            ...options
        };
        
        this.sessionManager = null;
        this.uiManager = null;
        this.microphoneStreamer = null;
        this.playbackController = null;
        this.isInitialized = false;
    }

    /**
     * Inicjalizuje wtyczkę
     */
    async init() {
        if (this.isInitialized) {
            console.warn('Virtual Advisor Plugin już został zainicjalizowany');
            return;
        }

        try {
            // Sprawdź czy kontener istnieje
            const container = document.getElementById(this.options.containerId);
            if (!container) {
                throw new Error(`Kontener o ID '${this.options.containerId}' nie został znaleziony`);
            }

            // Wstrzyknij HTML wtyczki
            await this.injectHTML(container);

            // Inicjalizuj managery
            this.sessionManager = new SessionManager(this.options.serverUrl, this.options.apiUrl);
            this.uiManager = new UIManager();
            this.microphoneStreamer = new MicrophoneStreamer();
            this.playbackController = new PlaybackController();

            // Połącz komponenty
            this.setupEventHandlers();

            this.isInitialized = true;
            console.log('Virtual Advisor Plugin został pomyślnie zainicjalizowany');

            if (this.options.autoStart) {
                this.start();
            }
        } catch (error) {
            console.error('Błąd podczas inicjalizacji Virtual Advisor Plugin:', error);
            throw error;
        }
    }

    /**
     * Wstrzykuje HTML wtyczki do kontenera
     */
    async injectHTML(container) {
        const htmlResponse = await fetch('/dist/virtual-advisor-plugin.html');
        const htmlContent = await htmlResponse.text();
        container.innerHTML = htmlContent;
    }

    /**
     * Konfiguruje obsługę zdarzeń między komponentami
     */
    setupEventHandlers() {
        // Tutaj będzie logika łącząca wszystkie komponenty
        // podobnie jak w app.js
    }

    /**
     * Uruchamia asystenta
     */
    start() {
        if (!this.isInitialized) {
            throw new Error('Wtyczka nie została zainicjalizowana. Wywołaj najpierw init()');
        }
        
        console.log('Uruchamianie Virtual Advisor Plugin...');
        // Logika uruchamiania
    }

    /**
     * Zatrzymuje asystenta
     */
    stop() {
        console.log('Zatrzymywanie Virtual Advisor Plugin...');
        // Logika zatrzymywania
    }

    /**
     * Niszczy instancję wtyczki
     */
    destroy() {
        this.stop();
        
        if (this.sessionManager) {
            this.sessionManager.disconnect();
        }
        
        const container = document.getElementById(this.options.containerId);
        if (container) {
            container.innerHTML = '';
        }
        
        this.isInitialized = false;
        console.log('Virtual Advisor Plugin został zniszczony');
    }
}

// Eksportuj klasę dla użycia jako moduł
export default VirtualAdvisorPlugin;

// Udostępnij globalnie dla użycia przez CDN
if (typeof window !== 'undefined') {
    window.VirtualAdvisorPlugin = VirtualAdvisorPlugin;
}