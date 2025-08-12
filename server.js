/**
 * Main server file - Express + WebSocket server for voice streaming
 */

require('dotenv').config();
const express = require('express');
const WebSocket = require('ws');
const cors = require('cors');
const path = require('path');
const { v4: uuidv4 } = require('uuid');

const SttClient = require('./backend/stt');
const TtsClient = require('./backend/tts');
const PluginManager = require('./backend/plugins');

const app = express();
const PORT = process.env.PORT || 3000;
const WS_PORT = process.env.WS_PORT || 3001;

// Express middleware
app.use(cors());
app.use(express.json());
app.use(express.static('frontend'));

// Serve frontend
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'frontend', 'index.html'));
});

// Health check
app.get('/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// WebSocket server for voice streaming
const wss = new WebSocket.Server({ port: WS_PORT });

class VoiceSession {
    constructor(ws) {
        this.id = null; // Will be set when session starts
        this.ws = ws;
        this.isActive = false;
        this.isSpeaking = false;
        this.isTtsPlaying = false;
        
        // Initialize clients
        this.sttClient = new SttClient();
        this.ttsClient = new TtsClient();
        this.pluginManager = new PluginManager();
        
        // Setup event handlers
        this.setupEventHandlers();
        
        console.log(`New voice session created (waiting for sessionId)`);
    }

    setupEventHandlers() {
        // STT events
        this.sttClient.on('transcript', (transcript, isFinal) => {
            if (isFinal) {
                this.pluginManager.emit('onTranscript', transcript);
                this.handleFinalTranscript(transcript);
            } else {
                this.pluginManager.emit('onPartialTranscript', transcript);
                this.handlePartialTranscript(transcript);
            }
        });

        this.sttClient.on('error', (error) => {
            this.pluginManager.emit('onError', { type: 'stt', error: error.message });
            this.sendToClient('error', { type: 'stt', message: error.message });
        });

        // TTS events
        this.ttsClient.on('audioChunk', (audioData) => {
            this.sendToClient('tts-chunk', { audio: { data: audioData.toString('base64') } });
        });

        this.ttsClient.on('ttsStart', () => {
            this.isTtsPlaying = true;
            this.pluginManager.emit('onTTSStart');
            this.sendToClient('tts-start');
        });

        this.ttsClient.on('ttsEnd', () => {
            this.isTtsPlaying = false;
            this.pluginManager.emit('onTTSStop');
            this.sendToClient('tts-end');
        });

        this.ttsClient.on('error', (error) => {
            this.pluginManager.emit('onError', { type: 'tts', error: error.message });
            this.sendToClient('error', { type: 'tts', message: error.message });
        });

        // Register example plugin
        this.registerExamplePlugin();
    }

    handlePartialTranscript(transcript) {
        // If we have partial transcript and TTS is playing, stop TTS
        if (transcript.trim() && this.isTtsPlaying) {
            this.stopTts();
            this.handleUserStartedSpeaking();
        }
        
        this.sendToClient('partial-transcript', { text: transcript });
    }

    handleFinalTranscript(transcript) {
        this.sendToClient('final-transcript', { text: transcript });
        
        // Process the transcript (this would typically generate a response)
        this.processUserInput(transcript);
    }

    handleUserStartedSpeaking() {
        this.isSpeaking = true;
        this.pluginManager.emit('onUserStartedSpeaking');
        this.sendToClient('user-speaking', { speaking: true });
    }

    async processUserInput(text) {
        // Simple echo response for demo - replace with your AI/logic
        const response = "Cześć co u Ciebie słychać miło mi Cię poznać jestem twoim Fanem";
        
        try {
            await this.generateTtsResponse(response);
        } catch (error) {
            console.error('Error generating TTS response:', error);
        }
    }

    async generateTtsResponse(text) {
        try {
            await this.ttsClient.synthesizeStream(text);
        } catch (error) {
            console.error('TTS synthesis error:', error);
            this.sendToClient('error', { type: 'tts', message: error.message });
        }
    }

    stopTts() {
        if (this.isTtsPlaying) {
            this.ttsClient.stopSynthesis();
            this.isTtsPlaying = false;
        }
    }

    startSession(sessionId = null) {
        if (sessionId) {
            this.id = sessionId;
            console.log(`Voice session started with sessionId: ${this.id}`);
        }
        this.isActive = true;
        this.sttClient.startStreaming();
        this.sendToClient('session-started', { sessionId: this.id });
    }

    stopSession() {
        this.isActive = false;
        this.sttClient.stopStreaming();
        this.stopTts();
        this.sendToClient('session-stopped');
    }

    handleAudioData(audioData) {
        if (this.isActive) {
            this.sttClient.writeAudio(audioData);
        }
    }

    sendToClient(type, data = {}) {
        if (this.ws.readyState === WebSocket.OPEN) {
            this.ws.send(JSON.stringify({ type, ...data, timestamp: Date.now() }));
        }
    }

    registerExamplePlugin() {
        this.pluginManager.register({
            name: 'echo-plugin',
            onTranscript: (transcript) => {
                console.log(`[Plugin] Final transcript: ${transcript}`);
            },
            onPartialTranscript: (transcript) => {
                console.log(`[Plugin] Partial transcript: ${transcript}`);
            },
            onTTSStart: () => {
                console.log('[Plugin] TTS started');
            },
            onTTSStop: () => {
                console.log('[Plugin] TTS stopped');
            },
            onUserStartedSpeaking: () => {
                console.log('[Plugin] User started speaking');
            },
            onError: (error) => {
                console.log(`[Plugin] Error: ${error.type} - ${error.error}`);
            }
        });
    }

    destroy() {
        this.stopSession();
        this.sttClient.destroy();
        this.ttsClient.destroy();
    }
}

// WebSocket connection handling
wss.on('connection', (ws) => {
    const session = new VoiceSession(ws);

    ws.on('message', (data) => {
        try {
            const message = JSON.parse(data);
            
            switch (message.type) {
                case 'start-session':
                    session.startSession(message.sessionId);
                    break;
                    
                case 'stop-session':
                    session.stopSession();
                    break;
                    
                case 'audio-data':
                    const audioBuffer = Buffer.from(message.audio, 'base64');
                    session.handleAudioData(audioBuffer);
                    break;
                    
                case 'user-started-speaking':
                    session.handleUserStartedSpeaking();
                    break;
                    
                case 'user-stopped-speaking':
                    session.isSpeaking = false;
                    session.sendToClient('user-speaking', { speaking: false });
                    break;
                    
                case 'tts-request':
                    if (message.text) {
                        session.generateTtsResponse(message.text);
                    }
                    break;
                    
                default:
                    console.log('Unknown message type:', message.type);
            }
        } catch (error) {
            console.error('Error processing WebSocket message:', error);
            session.sendToClient('error', { type: 'websocket', message: error.message });
        }
    });

    ws.on('close', () => {
        console.log(`Voice session ended: ${session.id}`);
        session.destroy();
    });

    ws.on('error', (error) => {
        console.error('WebSocket error:', error);
        session.destroy();
    });
});

// Start servers
app.listen(PORT, () => {
    console.log(`HTTP Server running on port ${PORT}`);
    console.log(`WebSocket Server running on port ${WS_PORT}`);
    console.log(`Open http://localhost:${PORT} to access the application`);
});

process.on('SIGINT', () => {
    console.log('\nShutting down servers...');
    wss.close();
    process.exit(0);
});