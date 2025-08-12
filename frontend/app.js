// Virtual Advisor Frontend - Voice-first client

class MicrophoneStreamer {
    constructor({ wsUrl, onAudioChunk, onVadStart, onVadStop, vadThreshold = 0.02 }) {
        this.wsUrl = wsUrl;
        this.onAudioChunk = onAudioChunk;
        this.onVadStart = onVadStart;
        this.onVadStop = onVadStop;
        this.vadThreshold = vadThreshold; // Simple RMS threshold
        
        this.mediaStream = null;
        this.audioContext = null;
        this.processor = null;
        this.source = null;
        this.analyser = null;
        this.vadActive = false;
        
        this.sampleRate = 16000; // Target sample rate for STT
        this.downsampleBuffer = this.downsampleBuffer.bind(this);
        this.visualize = this.visualize.bind(this);
        this.vadCheckInterval = null;
        this.audioDataQueue = [];
        this.isStreaming = false;
        
        // UI elements for visualization
        this.canvas = document.getElementById('voice-canvas');
        this.canvasCtx = this.canvas.getContext('2d');
        this.volumeBar = document.getElementById('volume-bar');
    }

    async init() {
        try {
            this.mediaStream = await navigator.mediaDevices.getUserMedia({ audio: true });
            this.audioContext = new (window.AudioContext || window.webkitAudioContext)({ sampleRate: 48000 });
            this.source = this.audioContext.createMediaStreamSource(this.mediaStream);
            this.analyser = this.audioContext.createAnalyser();
            this.analyser.fftSize = 2048;
            
            // Use AudioWorkletNode for better performance (when available)
            if (this.audioContext.audioWorklet) {
                try {
                    await this.audioContext.audioWorklet.addModule('data:text/javascript;base64,' + btoa(`
                        class AudioProcessor extends AudioWorkletProcessor {
                            process(inputs, outputs, parameters) {
                                const input = inputs[0];
                                if (input.length > 0) {
                                    this.port.postMessage(input[0]);
                                }
                                return true;
                            }
                        }
                        registerProcessor('audio-processor', AudioProcessor);
                    `));
                    
                    this.processor = new AudioWorkletNode(this.audioContext, 'audio-processor');
                    this.processor.port.onmessage = (event) => {
                        const inputBuffer = event.data;
                        this.processAudioData(inputBuffer);
                    };
                } catch (e) {
                    console.warn('AudioWorklet not supported, falling back to ScriptProcessor');
                    this.setupScriptProcessor();
                }
            } else {
                this.setupScriptProcessor();
            }
            
            this.source.connect(this.analyser);
            this.analyser.connect(this.processor);
            this.processor.connect(this.audioContext.destination);
            
            this.startVisualizer();
            return true;
        } catch (error) {
            console.error('Microphone init error:', error);
            throw error;
        }
    }

    setupScriptProcessor() {
        this.processor = this.audioContext.createScriptProcessor(4096, 1, 1);
        this.processor.onaudioprocess = (event) => {
            const inputBuffer = event.inputBuffer.getChannelData(0);
            this.processAudioData(inputBuffer);
        };
    }

    processAudioData(inputBuffer) {
        const pcm16 = this.downsampleBuffer(inputBuffer, this.audioContext.sampleRate, this.sampleRate);
        
        if (pcm16) {
            this.audioDataQueue.push(pcm16);
            if (this.onAudioChunk && this.isStreaming) {
                this.onAudioChunk(pcm16);
            }
        }
        
        this.updateVisualizer(inputBuffer);
        this.checkVad(inputBuffer);
    }

    startStreaming() {
        this.isStreaming = true;
    }

    stopStreaming() {
        this.isStreaming = false;
    }

    stop() {
        this.stopStreaming();
        if (this.processor) {
            this.processor.disconnect();
            this.processor = null;
        }
        if (this.analyser) {
            this.analyser.disconnect();
            this.analyser = null;
        }
        if (this.source) {
            this.source.disconnect();
            this.source = null;
        }
        if (this.audioContext) {
            this.audioContext.close();
            this.audioContext = null;
        }
        if (this.mediaStream) {
            this.mediaStream.getTracks().forEach(track => track.stop());
            this.mediaStream = null;
        }
        this.vadActive = false;
    }

    downsampleBuffer(buffer, inputSampleRate, outputSampleRate) {
        if (outputSampleRate === inputSampleRate) {
            return this.floatTo16BitPCM(buffer);
        }
        if (outputSampleRate > inputSampleRate) {
            console.warn('Downsampling to a higher sample rate is not supported');
            return null;
        }
        const sampleRateRatio = inputSampleRate / outputSampleRate;
        const newLength = Math.round(buffer.length / sampleRateRatio);
        const result = new Float32Array(newLength);
        let offsetResult = 0;
        let offsetBuffer = 0;
        while (offsetResult < result.length) {
            const nextOffsetBuffer = Math.round((offsetResult + 1) * sampleRateRatio);
            let accum = 0, count = 0;
            for (let i = offsetBuffer; i < nextOffsetBuffer && i < buffer.length; i++) {
                accum += buffer[i];
                count++;
            }
            result[offsetResult] = accum / count;
            offsetResult++;
            offsetBuffer = nextOffsetBuffer;
        }
        return this.floatTo16BitPCM(result);
    }

    floatTo16BitPCM(float32Array) {
        const buffer = new ArrayBuffer(float32Array.length * 2);
        const view = new DataView(buffer);
        let offset = 0;
        for (let i = 0; i < float32Array.length; i++, offset += 2) {
            let s = Math.max(-1, Math.min(1, float32Array[i]));
            view.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7FFF, true);
        }
        return new Uint8Array(buffer);
    }

    startVisualizer() {
        if (!this.canvasCtx) return;
        this.canvasCtx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        this.visualize();
    }

    visualize() {
        if (!this.analyser || !this.canvasCtx) return;

        requestAnimationFrame(this.visualize);

        const bufferLength = this.analyser.fftSize;
        const dataArray = new Uint8Array(bufferLength);
        this.analyser.getByteTimeDomainData(dataArray);

        this.canvasCtx.fillStyle = '#f8f9fa';
        this.canvasCtx.fillRect(0, 0, this.canvas.width, this.canvas.height);
		
        this.canvasCtx.lineWidth = 2;
        this.canvasCtx.strokeStyle = '#007bff';
        
        this.canvasCtx.beginPath();

        const sliceWidth = this.canvas.width * 1.0 / bufferLength;
        let x = 0;

        for (let i = 0; i < bufferLength; i++) {
            const v = dataArray[i] / 128.0;
            const y = v * this.canvas.height / 2;

            if (i === 0) {
                this.canvasCtx.moveTo(x, y);
            } else {
                this.canvasCtx.lineTo(x, y);
            }

            x += sliceWidth;
        }

        this.canvasCtx.lineTo(this.canvas.width, this.canvas.height / 2);
        this.canvasCtx.stroke();
    }

    updateVisualizer(inputBuffer) {
        // Calculate simple RMS for volume bar
        let sum = 0;
        for (let i = 0; i < inputBuffer.length; i++) {
            sum += inputBuffer[i] * inputBuffer[i];
        }
        const rms = Math.sqrt(sum / inputBuffer.length);
        const volumePercent = Math.min(100, Math.max(0, Math.round(rms * 200)));
        this.volumeBar.style.width = `${volumePercent}%`;
    }

    checkVad(inputBuffer) {
        // Simple VAD based on RMS threshold
        let sum = 0;
        for (let i = 0; i < inputBuffer.length; i++) {
            sum += inputBuffer[i] * inputBuffer[i];
        }
        const rms = Math.sqrt(sum / inputBuffer.length);
        const speaking = rms > this.vadThreshold;

        if (speaking && !this.vadActive) {
            this.vadActive = true;
            this.onVadStart && this.onVadStart();
        } else if (!speaking && this.vadActive) {
            this.vadActive = false;
            this.onVadStop && this.onVadStop();
        }
    }
}

class PlaybackController {
    constructor() {
        this.audioEl = document.getElementById('tts-audio');
        this.mediaSource = null;
        this.sourceBuffer = null;
        this.queue = [];
        this.isPlaying = false;
        this.mimeType = 'audio/mpeg'; // ElevenLabs typically returns MP3
    }

    init() {
        if ('MediaSource' in window) {
            this.mediaSource = new MediaSource();
            this.audioEl.src = URL.createObjectURL(this.mediaSource);
            this.mediaSource.addEventListener('sourceopen', this.onSourceOpen.bind(this));
        } else {
            console.warn('MediaSource API not supported, falling back to simple audio playback');
        }
    }

    onSourceOpen() {
        if (!MediaSource.isTypeSupported(this.mimeType)) {
            console.warn(`MIME type ${this.mimeType} not supported, trying audio/wav`);
            this.mimeType = 'audio/wav';
        }
        this.sourceBuffer = this.mediaSource.addSourceBuffer(this.mimeType);
        this.sourceBuffer.addEventListener('updateend', () => {
            if (this.queue.length > 0 && !this.sourceBuffer.updating) {
                const chunk = this.queue.shift();
                this.sourceBuffer.appendBuffer(chunk);
            }
        });
    }

    async playChunk(audioBuffer) {
        // For simplicity, we fallback to creating Blob and appending to audio element
        const blob = new Blob([audioBuffer], { type: this.mimeType });
        const url = URL.createObjectURL(blob);
        
        // Stop current playback before setting new source
        if (this.isPlaying) {
            this.audioEl.pause();
            this.audioEl.currentTime = 0;
        }
        
        this.audioEl.src = url;
        
        try {
            await this.audioEl.play();
            this.isPlaying = true;
        } catch (error) {
            if (error.name !== 'AbortError') {
                console.error('Error playing audio chunk:', error);
            }
            // AbortError is expected when play() is interrupted by a new load
        }
    }

    stop() {
        this.audioEl.pause();
        this.audioEl.currentTime = 0;
        this.isPlaying = false;
        // Detach src to stop streaming
        this.audioEl.src = '';
    }
}

class PluginManagerClient {
    constructor() {
        this.plugins = [];
    }

    register(plugin) {
        this.plugins.push(plugin);
    }

    emit(event, data) {
        for (const plugin of this.plugins) {
            const handler = plugin[event];
            if (typeof handler === 'function') {
                try { handler(data); } catch (e) { console.error('Plugin handler error:', e); }
            }
        }
    }
}

class App {
    constructor() {
        this.ws = null;
        this.sessionId = null;
        this.wsUrl = null;

        this.ui = this.setupUI();
        this.playback = new PlaybackController();
        this.plugins = new PluginManagerClient();
        
        // Setup mic streamer
        this.mic = new MicrophoneStreamer({
            wsUrl: null,
            onAudioChunk: (pcm16) => this.sendAudio(pcm16),
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
    }

    setupUI() {
        const ui = {
            connectionStatus: document.getElementById('connection-status'),
            sessionStatus: document.getElementById('session-status'),
            micStatus: document.getElementById('mic-status'),
            ttsStatus: document.getElementById('tts-status'),
            transcriptContainer: document.getElementById('transcript-container'),
            startBtn: document.getElementById('start-btn'),
            stopBtn: document.getElementById('stop-btn'),
            stopTtsBtn: document.getElementById('stop-tts-btn'),
            errorPanel: document.getElementById('error-panel'),
            errorMessage: document.getElementById('error-message'),
            dismissErrorBtn: document.getElementById('dismiss-error')
        };

        ui.startBtn.addEventListener('click', () => this.start());
        ui.stopBtn.addEventListener('click', () => this.stop());
        ui.stopTtsBtn.addEventListener('click', () => this.stopTts());
        ui.dismissErrorBtn.addEventListener('click', () => this.hideError());

        return ui;
    }

    async init() {
        this.playback.init();
        await this.mic.init();
        this.ui.micStatus.textContent = 'Ready';
        this.ui.micStatus.classList.remove('inactive');
        this.ui.micStatus.classList.add('active');
        this.connectWs();
    }

    connectWs() {
        const protocol = location.protocol === 'https:' ? 'wss' : 'ws';
        this.wsUrl = `${protocol}://${location.hostname}:3001`; // WS runs on separate port
        this.ws = new WebSocket(this.wsUrl);

        this.ws.onopen = () => {
            this.setConnectionStatus(true);
            this.ui.startBtn.disabled = false;
        };

        this.ws.onmessage = (event) => this.handleMessage(event);
        this.ws.onerror = (err) => this.showError('WebSocket error: ' + err.message);
        this.ws.onclose = () => {
            this.setConnectionStatus(false);
            this.ui.startBtn.disabled = true;
            this.ui.stopBtn.disabled = true;
            this.ui.stopTtsBtn.disabled = true;
            setTimeout(() => this.connectWs(), 2000);
        };
    }

    setConnectionStatus(connected) {
        this.ui.connectionStatus.textContent = connected ? 'Connected' : 'Disconnected';
        this.ui.connectionStatus.classList.toggle('connected', connected);
        this.ui.connectionStatus.classList.toggle('disconnected', !connected);
    }

    async start() {
        try {
            this.ws.send(JSON.stringify({ type: 'start-session' }));
            this.mic.startStreaming();
            this.ui.sessionStatus.textContent = 'Active';
            this.ui.sessionStatus.classList.remove('inactive');
            this.ui.sessionStatus.classList.add('active');
            this.ui.stopBtn.disabled = false;
            this.addTranscript('system', 'Session started. Speak to the assistant.');
        } catch (error) {
            this.showError('Failed to start session: ' + error.message);
        }
    }

    stop() {
        try {
            this.ws.send(JSON.stringify({ type: 'stop-session' }));
            this.mic.stopStreaming();
            this.ui.sessionStatus.textContent = 'Inactive';
            this.ui.sessionStatus.classList.remove('active');
            this.ui.sessionStatus.classList.add('inactive');
            this.ui.stopBtn.disabled = true;
            this.ui.stopTtsBtn.disabled = true;
            this.addTranscript('system', 'Session stopped.');
        } catch (error) {
            this.showError('Failed to stop session: ' + error.message);
        }
    }

    stopTts() {
        this.ws.send(JSON.stringify({ type: 'user-started-speaking' }));
    }

    sendAudio(pcm16) {
        if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;
        const base64 = btoa(String.fromCharCode(...pcm16));
        this.ws.send(JSON.stringify({ type: 'audio-data', audio: base64 }));
    }

    onVadStart() {
        // Stop TTS immediately on user speech detection
        this.ws.send(JSON.stringify({ type: 'user-started-speaking' }));
        this.plugins.emit('onUserStartedSpeaking');
    }

    onVadStop() {
        this.ws.send(JSON.stringify({ type: 'user-stopped-speaking' }));
    }

    handleMessage(event) {
        try {
            const message = JSON.parse(event.data);
            switch (message.type) {
                case 'session-started':
                    this.sessionId = message.sessionId;
                    this.ui.startBtn.disabled = true;
                    this.ui.stopBtn.disabled = false;
                    break;
                case 'session-stopped':
                    this.sessionId = null;
                    this.ui.startBtn.disabled = false;
                    this.ui.stopBtn.disabled = true;
                    break;
                case 'partial-transcript':
                    this.plugins.emit('onPartialTranscript', message.text);
                    this.addTranscript('user', message.text, true);
                    break;
                case 'final-transcript':
                    this.plugins.emit('onTranscript', message.text);
                    this.addTranscript('user', message.text, false);
                    break;
                case 'tts-start':
                    this.ui.ttsStatus.textContent = 'Playing';
                    this.ui.ttsStatus.classList.remove('inactive');
                    this.ui.ttsStatus.classList.add('playing');
                    this.ui.stopTtsBtn.disabled = false;
                    this.plugins.emit('onTTSStart');
                    break;
                case 'tts-end':
                    this.ui.ttsStatus.textContent = 'Inactive';
                    this.ui.ttsStatus.classList.remove('playing');
                    this.ui.ttsStatus.classList.add('inactive');
                    this.ui.stopTtsBtn.disabled = true;
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
                    this.addTranscript('assistant', '[Playing audio chunk...]');
                    break;
                case 'user-speaking':
                    if (message.speaking) {
                        this.ui.ttsStatus.textContent = 'Interrupted';
                        this.ui.ttsStatus.classList.remove('playing');
                        this.ui.ttsStatus.classList.add('inactive');
                        this.playback.stop();
                    }
                    break;
                case 'error':
                    this.showError(`${message.type}: ${message.message}`);
                    break;
            }
        } catch (error) {
            console.error('Error handling message:', error);
        }
    }

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
            const existing = this.ui.transcriptContainer.querySelector('.transcript-item.partial');
            if (existing) {
                this.ui.transcriptContainer.removeChild(existing);
            }
        }

        this.ui.transcriptContainer.appendChild(item);
        this.ui.transcriptContainer.scrollTop = this.ui.transcriptContainer.scrollHeight;
    }

    showError(message) {
        this.ui.errorMessage.textContent = message;
        this.ui.errorPanel.classList.remove('hidden');
    }

    hideError() {
        this.ui.errorPanel.classList.add('hidden');
        this.ui.errorMessage.textContent = '';
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