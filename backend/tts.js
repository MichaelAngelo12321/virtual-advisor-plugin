/**
 * ElevenLabs Text-to-Speech streaming client
 */

const EventEmitter = require('events');
const WebSocket = require('ws');

class TtsClient extends EventEmitter {
    constructor() {
        super();
        
        this.apiKey = process.env.ELEVENLABS_API_KEY;
        this.voiceId = process.env.ELEVENLABS_VOICE_ID || '21m00Tcm4TlvDq8ikWAM'; // Default Rachel voice
        this.wsUrl = 'wss://api.elevenlabs.io/v1/text-to-speech';
        
        this.ws = null;
        this.isConnected = false;
        this.isSynthesizing = false;
        this.currentText = '';
        
        if (!this.apiKey) {
            console.error('ElevenLabs API key not provided');
        }
        
        this.voiceSettings = {
            stability: 0.5,
            similarity_boost: 0.75,
            style: 0.5,
            use_speaker_boost: true
        };
    }

    async synthesizeStream(text) {
        if (!this.apiKey) {
            throw new Error('ElevenLabs API key not configured');
        }

        this.currentText = text;
        
        try {
            await this.connectWebSocket();
            await this.sendTextForSynthesis(text);
        } catch (error) {
            console.error('TTS synthesis error:', error);
            this.emit('error', error);
            throw error;
        }
    }

    async connectWebSocket() {
        if (this.isConnected && this.ws) {
            return;
        }

        return new Promise((resolve, reject) => {
            const wsUrl = `${this.wsUrl}/${this.voiceId}/stream-input?model_id=eleven_turbo_v2`;
            
            this.ws = new WebSocket(wsUrl, {
                headers: {
                    'xi-api-key': this.apiKey
                }
            });

            this.ws.on('open', () => {
                console.log('ElevenLabs WebSocket connected');
                this.isConnected = true;
                
                // Send initial BOS (Beginning of Stream) message
                const bosMessage = {
                    text: ' ',
                    voice_settings: this.voiceSettings,
                    generation_config: {
                        chunk_length_schedule: [120, 160, 250, 290]
                    }
                };
                
                this.ws.send(JSON.stringify(bosMessage));
                resolve();
            });

            this.ws.on('message', (data) => {
                this.handleWebSocketMessage(data);
            });

            this.ws.on('error', (error) => {
                console.error('ElevenLabs WebSocket error:', error);
                this.isConnected = false;
                this.emit('error', error);
                reject(error);
            });

            this.ws.on('close', () => {
                console.log('ElevenLabs WebSocket closed');
                this.isConnected = false;
                this.isSynthesizing = false;
                this.emit('ttsEnd');
            });
        });
    }

    handleWebSocketMessage(data) {
        try {
            const message = JSON.parse(data);
            
            if (message.audio) {
                // Received audio chunk
                const audioBuffer = Buffer.from(message.audio, 'base64');
                this.emit('audioChunk', audioBuffer);
            } else if (message.isFinal) {
                // End of synthesis
                this.isSynthesizing = false;
                this.emit('ttsEnd');
            } else if (message.normalizedAlignment) {
                // Word-level timing information (optional)
                console.log('Alignment data:', message.normalizedAlignment);
            }
        } catch (error) {
            console.error('Error parsing WebSocket message:', error);
        }
    }

    async sendTextForSynthesis(text) {
        if (!this.isConnected || !this.ws) {
            throw new Error('WebSocket not connected');
        }

        this.isSynthesizing = true;
        this.emit('ttsStart');

        // Split text into smaller chunks for better streaming
        const chunks = this.splitTextIntoChunks(text);
        
        for (const chunk of chunks) {
            if (!this.isSynthesizing) break; // Stop if synthesis was cancelled
            
            const message = {
                text: chunk + ' ',
                try_trigger_generation: chunks.indexOf(chunk) === chunks.length - 1
            };
            
            this.ws.send(JSON.stringify(message));
            
            // Small delay between chunks
            await new Promise(resolve => setTimeout(resolve, 50));
        }

        // Send EOS (End of Stream) message
        const eosMessage = {
            text: ''
        };
        this.ws.send(JSON.stringify(eosMessage));
    }

    splitTextIntoChunks(text, maxChunkLength = 100) {
        const sentences = text.split(/[.!?]+/).filter(s => s.trim());
        const chunks = [];
        
        for (const sentence of sentences) {
            if (sentence.length <= maxChunkLength) {
                chunks.push(sentence.trim());
            } else {
                // Split long sentences by words
                const words = sentence.trim().split(' ');
                let currentChunk = '';
                
                for (const word of words) {
                    if ((currentChunk + word).length <= maxChunkLength) {
                        currentChunk += (currentChunk ? ' ' : '') + word;
                    } else {
                        if (currentChunk) chunks.push(currentChunk);
                        currentChunk = word;
                    }
                }
                
                if (currentChunk) chunks.push(currentChunk);
            }
        }
        
        return chunks.length > 0 ? chunks : [text];
    }

    stopSynthesis() {
        if (this.isSynthesizing) {
            this.isSynthesizing = false;
            
            if (this.ws && this.isConnected) {
                // Send flush message to stop generation
                const flushMessage = {
                    text: '',
                    flush: true
                };
                this.ws.send(JSON.stringify(flushMessage));
            }
            
            this.emit('ttsEnd');
            console.log('TTS synthesis stopped');
        }
    }

    disconnect() {
        if (this.ws) {
            this.isConnected = false;
            this.isSynthesizing = false;
            this.ws.close();
            this.ws = null;
        }
    }

    destroy() {
        this.stopSynthesis();
        this.disconnect();
        this.removeAllListeners();
    }
}

module.exports = TtsClient;