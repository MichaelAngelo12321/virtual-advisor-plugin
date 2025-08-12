// UI Manager Module - User interface handling

export class UIManager {
    constructor() {
        this.elements = this.setupUIElements();
        this.setupEventListeners();
    }

    setupUIElements() {
        return {
            connectionStatus: document.getElementById('connection-status'),
            sessionStatus: document.getElementById('session-status'),
            micStatus: document.getElementById('mic-status'),
            ttsStatus: document.getElementById('tts-status'),
            transcriptContainer: document.getElementById('transcript-container'),
            startBtn: document.getElementById('start-btn'),
            errorPanel: document.getElementById('error-panel'),
            errorMessage: document.getElementById('error-message'),
            dismissErrorBtn: document.getElementById('dismiss-error'),
            // Elementy modala
            modal: document.getElementById('voice-modal'),
            closeModalBtn: document.getElementById('close-modal')
        };
    }

    setupEventListeners() {
        // Event listener dla przycisku dismiss error
        this.elements.dismissErrorBtn.addEventListener('click', () => this.hideError());
        
        // Event listenery dla modala
        this.elements.closeModalBtn.addEventListener('click', () => {
            this.hideModal();
            // Emit custom event for app to handle
            document.dispatchEvent(new CustomEvent('ui:stop-session'));
        });
        
        // Zamknij modal po kliknięciu w tło
        this.elements.modal.addEventListener('click', (e) => {
            if (e.target === this.elements.modal) {
                this.hideModal();
                // Emit custom event for app to handle
                document.dispatchEvent(new CustomEvent('ui:stop-session'));
            }
        });
    }

    // Set up start button event listener (called from main app)
    setupStartButton(onStart) {
        this.elements.startBtn.addEventListener('click', () => {
            this.showModal();
            onStart();
        });
    }

    // Modal management
    showModal() {
        this.elements.modal.classList.remove('hidden');
    }

    hideModal() {
        this.elements.modal.classList.add('hidden');
    }

    // Connection status management
    setConnectionStatus(connected) {
        this.elements.connectionStatus.textContent = connected ? 'Connected' : 'Disconnected';
        this.elements.connectionStatus.classList.toggle('connected', connected);
        this.elements.connectionStatus.classList.toggle('disconnected', !connected);
        this.elements.startBtn.disabled = !connected;
    }

    // Session status management
    setSessionActive(active) {
        this.elements.sessionStatus.textContent = active ? 'Active' : 'Inactive';
        this.elements.sessionStatus.classList.toggle('active', active);
        this.elements.sessionStatus.classList.toggle('inactive', !active);
        this.elements.startBtn.disabled = active;
    }

    // Microphone status management
    setMicrophoneReady() {
        this.elements.micStatus.textContent = 'Ready';
        this.elements.micStatus.classList.remove('inactive');
        this.elements.micStatus.classList.add('active');
    }

    // TTS status management
    setTTSStatus(status) {
        switch (status) {
            case 'playing':
                this.elements.ttsStatus.textContent = 'Playing';
                this.elements.ttsStatus.classList.remove('inactive');
                this.elements.ttsStatus.classList.add('playing');
                break;
            case 'interrupted':
                this.elements.ttsStatus.textContent = 'Interrupted';
                this.elements.ttsStatus.classList.remove('playing');
                this.elements.ttsStatus.classList.add('inactive');
                break;
            case 'inactive':
            default:
                this.elements.ttsStatus.textContent = 'Inactive';
                this.elements.ttsStatus.classList.remove('playing');
                this.elements.ttsStatus.classList.add('inactive');
                break;
        }
    }

    // Transcript management
    addTranscript(speaker, text, isPartial = false) {
        const item = document.createElement('div');
        item.className = `transcript-item ${speaker} ${isPartial ? 'partial' : ''}`;
        
        const timestamp = new Date().toLocaleTimeString();
        item.innerHTML = `
            <span class="timestamp">${timestamp}</span>
            <span class="speaker ${speaker}">${speaker.charAt(0).toUpperCase() + speaker.slice(1)}</span>
            <span class="text">${text}</span>
        `;
        
        if (isPartial) {
            // Replace existing partial
            const existing = this.elements.transcriptContainer.querySelector('.transcript-item.partial');
            if (existing) {
                this.elements.transcriptContainer.removeChild(existing);
            }
        }

        this.elements.transcriptContainer.appendChild(item);
        this.elements.transcriptContainer.scrollTop = this.elements.transcriptContainer.scrollHeight;
    }

    // Error management
    showError(message) {
        this.elements.errorMessage.textContent = message;
        this.elements.errorPanel.classList.remove('hidden');
    }

    hideError() {
        this.elements.errorPanel.classList.add('hidden');
        this.elements.errorMessage.textContent = '';
    }
}