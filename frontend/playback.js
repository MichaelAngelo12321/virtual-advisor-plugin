// Playback Controller Module - TTS audio playback handling

export class PlaybackController {
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