/**
 * Google Cloud Speech-to-Text streaming client
 */

const speech = require('@google-cloud/speech');
const EventEmitter = require('events');

class SttClient extends EventEmitter {
    constructor() {
        super();
        
        this.client = new speech.SpeechClient();
        this.recognizeStream = null;
        this.isStreaming = false;
        this.restartTimeoutId = null;
        
        // Audio configuration
        this.sampleRate = parseInt(process.env.SAMPLE_RATE) || 16000;
        this.languageCode = 'pl-PL'; // Polish language
        
        this.request = {
            config: {
                encoding: 'LINEAR16',
                sampleRateHertz: this.sampleRate,
                languageCode: this.languageCode,
                enableAutomaticPunctuation: true,
                enableWordTimeOffsets: false,
                model: 'latest_long',
                useEnhanced: true,
                maxAlternatives: 1,
                // Dodaj Speaker Diarization
                diarizationConfig: {
                    enableSpeakerDiarization: true,
                    minSpeakerCount: 1,
                    maxSpeakerCount: 2 // Ty + ewentualnie inne osoby
                },
                speechContexts: [{
                    phrases: ['virtual advisor', 'asystent', 'pomoc'],
                    boost: 10.0
                }]
            },
            interimResults: true,
            singleUtterance: false,
        };
    }

    startStreaming() {
        if (this.isStreaming) {
            console.log('STT already streaming');
            return;
        }

        try {
            this.createRecognizeStream();
            this.isStreaming = true;
            console.log('STT streaming started');
        } catch (error) {
            console.error('Error starting STT stream:', error);
            this.emit('error', error);
        }
    }

    createRecognizeStream() {
        this.recognizeStream = this.client
            .streamingRecognize(this.request)
            .on('data', (data) => {
                this.handleSpeechData(data);
            })
            .on('error', (error) => {
                console.error('STT stream error:', error);
                this.emit('error', error);
                this.restartStream();
            })
            .on('end', () => {
                console.log('STT stream ended');
                this.restartStream();
            });
    }

    handleSpeechData(data) {
        if (data.results && data.results.length > 0) {
            const result = data.results[0];
            const transcript = result.alternatives[0].transcript;
            const isFinal = result.isFinal;
            
            if (transcript && transcript.trim()) {
                this.emit('transcript', transcript, isFinal);
                
                // Log for debugging
                console.log(`STT ${isFinal ? 'FINAL' : 'INTERIM'}: "${transcript}"`);
            }
        }
    }

    writeAudio(audioBuffer) {
        if (this.recognizeStream && this.isStreaming) {
            try {
                this.recognizeStream.write(audioBuffer);
            } catch (error) {
                console.error('Error writing audio to STT stream:', error);
                this.emit('error', error);
            }
        }
    }

    restartStream() {
        if (this.restartTimeoutId) {
            clearTimeout(this.restartTimeoutId);
        }

        // Restart after a short delay to avoid rapid restarts
        this.restartTimeoutId = setTimeout(() => {
            if (this.isStreaming) {
                console.log('Restarting STT stream...');
                this.createRecognizeStream();
            }
        }, 1000);
    }

    stopStreaming() {
        this.isStreaming = false;
        
        if (this.restartTimeoutId) {
            clearTimeout(this.restartTimeoutId);
            this.restartTimeoutId = null;
        }
        
        if (this.recognizeStream) {
            try {
                this.recognizeStream.end();
            } catch (error) {
                console.error('Error ending STT stream:', error);
            }
            this.recognizeStream = null;
        }
        
        console.log('STT streaming stopped');
    }

    destroy() {
        this.stopStreaming();
        this.removeAllListeners();
    }
}

module.exports = SttClient;