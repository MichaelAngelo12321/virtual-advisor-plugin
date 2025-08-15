// Session Manager Module - Backend communication and session handling

export class SessionManager {
    constructor(serverUrl = null, apiUrl = null) {
        this.sessionId = null;
        this.systemQuestion = null;
        this.ws = null;
        this.wsUrl = null;
        // Konfiguracja URL-ów - można przekazać z zewnątrz lub użyć domyślnych
        this.serverUrl = serverUrl || 'ws://localhost:3001';
        this.apiBaseUrl = apiUrl ? `${apiUrl}/api` : 'http://localhost:8001/api';
    }

    // Przywróć sessionId z localStorage jeśli istnieje
    restoreSession() {
        const savedSessionId = localStorage.getItem('sessionId');
        if (savedSessionId) {
            this.sessionId = savedSessionId;
        }
    }

    // Pobierz dane startowe z backendu
    async startSession() {
        try {
            const response = await fetch(`${this.apiBaseUrl}/chat/start`, {
                method: 'GET',
                headers: {
                    'Content-Type': 'application/json',
                    'Accept': 'application/json'
                },
                credentials: 'include'
            });
            
            if (!response.ok) {
                throw new Error(`Backend error: ${response.status}`);
            }
            
            const backendData = await response.json();
            
            // Zapisz sessionId i systemQuestion z backendu
            this.sessionId = backendData.sessionId;
            this.systemQuestion = backendData.message;
            localStorage.setItem('sessionId', this.sessionId);
            
            return backendData;
        } catch (error) {
            throw new Error('Failed to start session: ' + error.message);
        }
    }

    // Wyślij odpowiedź użytkownika do backendu
    async sendUserAnswer(userText) {
        try {
            const response = await fetch(`${this.apiBaseUrl}/chat/answer`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Accept': 'application/json'
                },
                credentials: 'include',
                body: JSON.stringify({
                    sessionId: this.sessionId,
                    answer: userText,
                    systemQuestion: this.systemQuestion
                })
            });
            
            if (!response.ok) {
                throw new Error(`Backend error: ${response.status}`);
            }
            
            const backendData = await response.json();
            
            // Aktualizuj systemQuestion nową wartością z question
            this.systemQuestion = backendData.question;
            
            return backendData;
        } catch (error) {
            throw new Error('Failed to send answer: ' + error.message);
        }
    }

    // Reset session data
    resetSession() {
        this.sessionId = null;
        this.systemQuestion = null;
        localStorage.removeItem('sessionId');
    }

    // WebSocket connection management
    connectWebSocket(onOpen, onMessage, onError, onClose) {
        // Użyj skonfigurowanego serverUrl lub automatycznie wykryj
        if (this.serverUrl.startsWith('ws://') || this.serverUrl.startsWith('wss://')) {
            this.wsUrl = this.serverUrl;
        } else {
            const protocol = location.protocol === 'https:' ? 'wss' : 'ws';
            this.wsUrl = `${protocol}://${location.hostname}:3001`;
        }
        
        this.ws = new WebSocket(this.wsUrl);

        this.ws.onopen = onOpen;
        this.ws.onmessage = onMessage;
        this.ws.onerror = onError;
        this.ws.onclose = onClose;
    }

    // Send WebSocket message
    sendWebSocketMessage(message) {
        if (this.ws && this.ws.readyState === WebSocket.OPEN) {
            this.ws.send(JSON.stringify(message));
        }
    }

    // Send audio data via WebSocket
    sendAudio(pcm16) {
        if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;
        const base64 = btoa(String.fromCharCode(...pcm16));
        this.sendWebSocketMessage({ type: 'audio-data', audio: base64 });
    }

    // Start WebSocket session
    startWebSocketSession() {
        this.sendWebSocketMessage({ 
            type: 'start-session',
            sessionId: this.sessionId 
        });
    }

    // Stop WebSocket session
    stopWebSocketSession() {
        this.sendWebSocketMessage({ type: 'stop-session' });
    }

    // Send TTS request
    requestTTS(text) {
        this.sendWebSocketMessage({ 
            type: 'tts-request', 
            text: text,
            sessionId: this.sessionId
        });
    }

    // Stop TTS (user started speaking)
    stopTTS() {
        this.sendWebSocketMessage({ type: 'user-started-speaking' });
    }

    // User stopped speaking
    userStoppedSpeaking() {
        this.sendWebSocketMessage({ type: 'user-stopped-speaking' });
    }

    // Wyślij oferty na email
    async sendOffersEmail(email, message) {
        try {
            const response = await fetch(`${this.apiBaseUrl}/chat/send-offers-email`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Accept': 'application/json'
                },
                credentials: 'include',
                body: JSON.stringify({
                    sessionId: this.sessionId,
                    email: email,
                    message: message
                })
            });
            
            if (!response.ok) {
                throw new Error(`Backend error: ${response.status}`);
            }
            
            // Sprawdź czy odpowiedź ma zawartość (204 No Content nie ma body)
            if (response.status === 204) {
                return { success: true, message: 'Email sent successfully' };
            }
            
            const backendData = await response.json();
            return backendData;
        } catch (error) {
            throw new Error('Failed to send offers email: ' + error.message);
        }
    }

    // Pobierz oferty kredytowe
    async getMortgageOffers() {
        try {
            const response = await fetch(`${this.apiBaseUrl}/chat/mortgage-offers/${this.sessionId}`, {
                method: 'GET',
                headers: {
                    'Accept': 'application/json'
                },
                credentials: 'include'
            });
            
            if (!response.ok) {
                throw new Error(`Backend error: ${response.status}`);
            }
            
            const backendData = await response.json();
            return backendData;
        } catch (error) {
            throw new Error('Failed to get mortgage offers: ' + error.message);
        }
    }
}