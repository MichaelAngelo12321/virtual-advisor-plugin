// Virtual Advisor Frontend - Voice-first client (Refactored)

import { MicrophoneStreamer } from './microphone.js';
import { PlaybackController } from './playback.js';
import { PluginManagerClient } from './plugins.js';
import { SessionManager } from './session.js';
import { UIManager } from './ui.js';

class App {
    constructor() {
        this.session = new SessionManager();
        this.ui = new UIManager();
        this.playback = new PlaybackController();
        this.plugins = new PluginManagerClient();
        
        // Setup mic streamer
        this.mic = new MicrophoneStreamer({
            wsUrl: null,
            onAudioChunk: (pcm16) => this.session.sendAudio(pcm16),
            onVadStart: () => this.onVadStart(),
            onVadStop: () => this.onVadStop(),
            vadThreshold: 0.02
        });
        
        // Register example plugin
        this.plugins.register({
            name: 'client-logger',
            onPartialTranscript: (text) => console.log('[ClientPlugin] Partial:', text),
            onTranscript: (text) => console.log('[ClientPlugin] Final:', text),
            onTTSStart: () => console.log('[ClientPlugin] TTS start'),
            onTTSStop: () => console.log('[ClientPlugin] TTS stop'),
            onUserStartedSpeaking: () => console.log('[ClientPlugin] User speaking')
        });

        // Setup UI event listeners
        this.setupUIEventListeners();
    }

    setupUIEventListeners() {
        // Setup start button
        this.ui.setupStartButton(() => this.start());
        
        // Listen for UI events
        document.addEventListener('ui:stop-session', () => this.stop());
    }

    async init() {
        // Przywróć sessionId z localStorage jeśli istnieje
        this.session.restoreSession();
        
        this.playback.init();
        await this.mic.init();
        this.ui.setMicrophoneReady();
        this.connectWs();
    }

    connectWs() {
        this.session.connectWebSocket(
            // onOpen
            () => {
                this.ui.setConnectionStatus(true);
            },
            // onMessage
            (event) => this.handleMessage(event),
            // onError
            (err) => this.ui.showError('WebSocket error: ' + err.message),
            // onClose
            () => {
                this.ui.setConnectionStatus(false);
                setTimeout(() => this.connectWs(), 2000);
            }
        );
    }

    async start() {
        try {
            // Pobierz dane startowe z backendu
            const backendData = await this.session.startSession();
            
            // Uruchom sesję WebSocket z sessionId z backendu
            this.session.startWebSocketSession();
            this.mic.startStreaming();
            this.ui.setSessionActive(true);
            
            // Dodaj wiadomość powitalną do transkrypcji
            this.ui.addTranscript('assistant', backendData.message);
            
            // Wyślij wiadomość powitalną do TTS
            this.session.requestTTS(backendData.message);
            
        } catch (error) {
            this.ui.showError(error.message);
        }
    }

    stop() {
        try {
            this.session.stopWebSocketSession();
            this.mic.stopStreaming();
            this.ui.setSessionActive(false);
            this.ui.addTranscript('system', 'Session stopped.');
            
            // Reset session data
            this.session.resetSession();
        } catch (error) {
            this.ui.showError('Failed to stop session: ' + error.message);
        }
    }

    async handleUserAnswer(userText) {
        try {
            // Wyślij odpowiedź użytkownika do backendu
            const backendData = await this.session.sendUserAnswer(userText);
            
            // Dodaj odpowiedź asystenta do transkrypcji
            this.ui.addTranscript('assistant', backendData.question);
            
            // Wyślij question do TTS
            this.session.requestTTS(backendData.question);
            
            // Opcjonalnie: obsługa dodatkowych pól z odpowiedzi
            if (backendData.isCompleted) {
                console.log('Conversation completed');
            }
            
            if (backendData.shouldEndConversation) {
                console.log('Should end conversation');
            }
            
            if (backendData.currentState) {
                console.log('Current state:', backendData.currentState);
            }
            
            if (backendData.availableActions) {
                console.log('Available actions:', backendData.availableActions);
            }
            
        } catch (error) {
            this.ui.showError(error.message);
        }
    }

    onVadStart() {
        // Stop TTS immediately on user speech detection
        this.session.stopTTS();
        this.plugins.emit('onUserStartedSpeaking');
    }

    onVadStop() {
        this.session.userStoppedSpeaking();
    }

    handleMessage(event) {
        try {
            const message = JSON.parse(event.data);
            switch (message.type) {
                case 'session-started':
                    // sessionId już ustawiony z backendu API - nie nadpisujemy
                    break;
                case 'session-stopped':
                    this.session.resetSession();
                    break;
                case 'partial-transcript':
                    this.plugins.emit('onPartialTranscript', message.text);
                    this.ui.addTranscript('user', message.text, true);
                    break;
                case 'final-transcript':
                    this.plugins.emit('onTranscript', message.text);
                    this.ui.addTranscript('user', message.text, false);
                    // Wyślij odpowiedź użytkownika do backendu
                    this.handleUserAnswer(message.text);
                    break;
                case 'tts-start':
                    this.ui.setTTSStatus('playing');
                    this.plugins.emit('onTTSStart');
                    break;
                case 'tts-end':
                    this.ui.setTTSStatus('inactive');
                    this.plugins.emit('onTTSStop');
                    break;
                case 'tts-chunk':
                    // Play chunk immediately
                    const byteCharacters = atob(message.audio.data);
                    const byteNumbers = new Array(byteCharacters.length);
                    for (let i = 0; i < byteCharacters.length; i++) {
                        byteNumbers[i] = byteCharacters.charCodeAt(i);
                    }
                    const byteArray = new Uint8Array(byteNumbers);
                    this.playback.playChunk(byteArray).catch(error => {
                        if (error.name !== 'AbortError') {
                            console.error('Error in TTS playback:', error);
                        }
                    });
                    this.ui.addTranscript('assistant', '[Playing audio chunk...]');
                    break;
                case 'user-speaking':
                    if (message.speaking) {
                        this.ui.setTTSStatus('interrupted');
                        this.playback.stop();
                    }
                    break;
                case 'error':
                    this.ui.showError(`${message.type}: ${message.message}`);
                    break;
            }
        } catch (error) {
            console.error('Error handling message:', error);
        }
    }
}

window.addEventListener('load', async () => {
    const app = new App();
    try {
        await app.init();
    } catch (e) {
        console.error(e);
    }
});