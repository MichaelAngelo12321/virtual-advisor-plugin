// Microphone Streamer Module - Voice input handling with VAD

export class MicrophoneStreamer {
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