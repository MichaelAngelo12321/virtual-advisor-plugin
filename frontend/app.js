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
        this.isListeningBlocked = false; // Flaga blokady nasłuchiwania
        
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
        
        document.addEventListener('ui:send-email', (event) => {
            this.handleSendEmail(event.detail.email);
        });
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
            
            // Sprawdź czy odpowiedź zawiera dane kredytowe
            if (backendData.creditInformation) {
                // Wyświetl dane kredytowe zamiast standardowej transkrypcji
                this.ui.displayCreditInformation(backendData.creditInformation);
                
                // Wyślij question do TTS (jeśli istnieje)
                if (backendData.question) {
                    this.session.requestTTS(backendData.question);
                }
            } else {
                // Fallback: standardowa transkrypcja jeśli brak danych kredytowych
                if (backendData.question) {
                    this.ui.addTranscript('assistant', backendData.question);
                    this.session.requestTTS(backendData.question);
                }
            }
            
            // Opcjonalnie: obsługa dodatkowych pól z odpowiedzi
            if (backendData.isCompleted !== undefined) {
                if (backendData.isCompleted) {
                    console.log('Conversation completed - blocking listening');
                    this.isListeningBlocked = true;
                    this.mic.stopStreaming();
                } else {
                    console.log('Conversation not completed - unblocking listening');
                    this.isListeningBlocked = false;
                    this.mic.startStreaming();
                }
            }
            
            if (backendData.shouldEndConversation) {
                console.log('Should end conversation - closing modal and stopping session');
                // Zamknij modal i zakończ sesję
                this.ui.hideModal();
                this.stop();
                return; // Zakończ wykonywanie metody
            }
            
            if (backendData.currentState) {
                console.log('Current state:', backendData.currentState);
                
                // Automatyczne wyszukiwanie ofert gdy currentState=offer_search i isCompleted=true
                if (backendData.currentState === 'offer_search' && backendData.isCompleted === true) {
                    console.log('Auto-triggering offer search');
                    // Automatycznie wyślij zapytanie o wyszukiwanie ofert
                    setTimeout(() => {
                        this.handleUserAnswer('Dobrze czy na podstawie podanych danych kredytowych jesteś w stanie znaleźć mi jakieś oferty');
                    }, 1000); // Krótkie opóźnienie dla lepszego UX
                }
            }
            
            if (backendData.availableActions) {
                console.log('Available actions:', backendData.availableActions);
                console.log('Current state:', backendData.currentState);
                console.log('Is array?', Array.isArray(backendData.availableActions));
                console.log('Includes email?', backendData.availableActions.includes('email'));
                
                // Pokaż formularz email gdy currentState=waiting_for_email i availableActions zawiera email
                const shouldShowEmailForm = (
                    backendData.currentState === 'waiting_for_email' &&
                    (
                        (Array.isArray(backendData.availableActions) && backendData.availableActions.includes('email')) ||
                        (typeof backendData.availableActions === 'string' && backendData.availableActions === 'email')
                    )
                );
                
                // Pokaż oferty gdy currentState=offer_presentation i availableActions zawiera display
                const shouldShowOffers = (
                    backendData.currentState === 'offer_presentation' &&
                    (
                        (Array.isArray(backendData.availableActions) && backendData.availableActions.includes('display')) ||
                        (typeof backendData.availableActions === 'string' && backendData.availableActions === 'display')
                    )
                );
                
                if (shouldShowEmailForm) {
                    console.log('Showing email form');
                    this.ui.showEmailForm();
                } else if (shouldShowOffers) {
                    console.log('Showing mortgage offers');
                    this.handleShowOffers();
                } else {
                    console.log('Email form conditions not met:', {
                        currentState: backendData.currentState,
                        expectedState: 'waiting_for_email',
                        availableActions: backendData.availableActions,
                        isArray: Array.isArray(backendData.availableActions),
                        includesEmail: backendData.availableActions ? backendData.availableActions.includes('email') : false
                    });
                }
            }
            
        } catch (error) {
            this.ui.showError(error.message);
        }
    }

    async handleSendEmail(email) {
        try {
            this.ui.setEmailButtonLoading(true);
            this.ui.hideEmailStatus();
            
            const result = await this.session.sendOffersEmail(email, 'Oto Twoje oferty kredytowe');
            this.ui.showEmailStatus('✅ Oferty zostały wysłane na podany adres email!', true);
            console.log('Email sent successfully:', result);
            
            // Ukryj formularz po 3 sekundach
            setTimeout(() => {
                this.ui.hideEmailForm();
            }, 3000);
            
        } catch (error) {
            console.error('Error sending email:', error);
            this.ui.showEmailStatus('❌ Błąd połączenia z serwerem', false);
        } finally {
            this.ui.setEmailButtonLoading(false);
        }
    }

    async handleShowOffers() {
        try {
            console.log('Fetching mortgage offers...');
            const offersData = await this.session.getMortgageOffers();
            console.log('Offers data received:', offersData);
            
            // Wyświetl modal z ofertami
            this.ui.showOffersModal(offersData);
            
        } catch (error) {
            console.error('Error fetching offers:', error);
            this.ui.showError('Błąd podczas pobierania ofert: ' + error.message);
        }
    }

    onVadStart() {
        // Sprawdź czy nasłuchiwanie nie jest zablokowane
        if (this.isListeningBlocked) {
            console.log('Listening is blocked - ignoring VAD start');
            return;
        }
        
        // Stop TTS immediately on user speech detection
        this.session.stopTTS();
        this.plugins.emit('onUserStartedSpeaking');
    }

    onVadStop() {
        // Sprawdź czy nasłuchiwanie nie jest zablokowane
        if (this.isListeningBlocked) {
            console.log('Listening is blocked - ignoring VAD stop');
            return;
        }
        
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