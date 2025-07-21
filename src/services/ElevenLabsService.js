/**
 * Serwis do obsługi ElevenLabs Text-to-Speech i Speech-to-Text API
 */
export class ElevenLabsService {
  constructor(apiKey, voiceId = 'pNInz6obpgDQGcFmaJgB', config = {}) {
    this.apiKey = apiKey;
    this.voiceId = voiceId; // Adam voice ID (default)
    this.baseUrl = 'https://api.elevenlabs.io/v1';
    this.config = {
      modelId: 'eleven_multilingual_v2',
      stability: 0.5,
      similarityBoost: 0.75,
      style: 0.0,
      useSpeakerBoost: true,
      timeout: 15000,
      // Ustawienia audio
      audioSensitivity: 0.5, // Czułość mikrofonu (0.1 - 1.0)
      autoGainControl: false, // Automatyczne wzmocnienie
      noiseSuppression: true, // Redukcja szumów
      echoCancellation: true, // Redukcja echa
      sampleRate: 16000, // Częstotliwość próbkowania
      channelCount: 1, // Mono audio
      ...config
    };
    
    // Speech-to-Text properties
    this.mediaRecorder = null;
    this.audioChunks = [];
    this.isRecording = false;
  }

  /**
   * Konwertuje tekst na mowę
   * @param {string} text - Tekst do konwersji
   * @param {Object} options - Opcje dodatkowe
   * @returns {Promise<AudioBuffer>} - Buffer audio
   */
  async textToSpeech(text, options = {}) {
    if (!this.apiKey) {
      throw new Error('ElevenLabs API key is required');
    }

    if (!text || text.trim().length === 0) {
      throw new Error('Text is required for text-to-speech conversion');
    }

    const url = `${this.baseUrl}/text-to-speech/${this.voiceId}`;
    
    const requestBody = {
      text: text.trim(),
      model_id: options.modelId || this.config.modelId,
      voice_settings: {
        stability: options.stability ?? this.config.stability,
        similarity_boost: options.similarityBoost ?? this.config.similarityBoost,
        style: options.style ?? this.config.style,
        use_speaker_boost: options.useSpeakerBoost ?? this.config.useSpeakerBoost
      },
      optimize_streaming_latency: 4, // Maksymalna optymalizacja dla szybkości
      output_format: 'mp3_22050_32' // Niższa jakość = szybsza generacja
    };

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), this.config.timeout);
      
      const headers = {
        'Accept': 'audio/mpeg',
        'Content-Type': 'application/json',
        'xi-api-key': this.apiKey
      };
      
  
      
      const response = await fetch(url, {
        method: 'POST',
        headers: headers,
        body: JSON.stringify(requestBody),
        signal: controller.signal
      });
      
      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`ElevenLabs API error: ${response.status} - ${errorText}`);
      }

      const audioArrayBuffer = await response.arrayBuffer();

      
      return audioArrayBuffer;
      
    } catch (error) {
      console.error('ElevenLabs: Text-to-speech conversion failed:', error);
      throw error;
    }
  }

  /**
   * Odtwarza audio z buffera
   * @param {ArrayBuffer} audioBuffer - Buffer audio
   * @returns {Promise<void>}
   */
  async playAudio(audioBuffer) {
    return new Promise((resolve, reject) => {
      try {
        const audioContext = new (window.AudioContext || window.webkitAudioContext)();
        
        audioContext.decodeAudioData(audioBuffer)
          .then(decodedData => {
            const source = audioContext.createBufferSource();
            source.buffer = decodedData;
            source.connect(audioContext.destination);
            
            source.onended = () => {
              resolve();
            };
            
            source.start(0);
          })
          .catch(error => {
            console.error('ElevenLabs: Audio decoding failed:', error);
            reject(error);
          });
          
      } catch (error) {
        console.error('ElevenLabs: Audio playback failed:', error);
        reject(error);
      }
    });
  }

  /**
   * Konwertuje tekst na mowę i od razu odtwarza
   * @param {string} text - Tekst do konwersji i odtworzenia
   * @param {Object} options - Opcje dodatkowe
   * @returns {Promise<void>}
   */
  async speak(text, options = {}) {
    try {
      const audioBuffer = await this.textToSpeech(text, options);
      await this.playAudio(audioBuffer);
    } catch (error) {
      console.error('ElevenLabs: Speak operation failed:', error);
      throw error;
    }
  }

  /**
   * Pobiera listę dostępnych głosów
   * @returns {Promise<Array>} - Lista głosów
   */
  async getVoices() {
    if (!this.apiKey) {
      throw new Error('ElevenLabs API key is required');
    }

    const url = `${this.baseUrl}/voices`;
    
    try {
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'xi-api-key': this.apiKey
        }
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`ElevenLabs API error: ${response.status} - ${errorText}`);
      }

      const data = await response.json();
      return data.voices || [];
      
    } catch (error) {
      console.error('ElevenLabs: Failed to get voices:', error);
      throw error;
    }
  }

  /**
   * Ustawia nowy głos
   * @param {string} voiceId - ID głosu
   */
  setVoice(voiceId) {
    this.voiceId = voiceId;
  }

  /**
   * Sprawdza czy serwis jest skonfigurowany
   * @returns {boolean}
   */
  isConfigured() {
    return !!this.apiKey;
  }

  /**
   * Konwertuje audio na tekst używając ElevenLabs STT API
   * @param {Blob} audioBlob - Blob audio do transkrypcji
   * @param {Object} options - Opcje dodatkowe
   * @returns {Promise<string>} - Transkrypcja tekstu
   */
  async speechToText(audioBlob, options = {}) {
    if (!this.apiKey) {
      throw new Error('ElevenLabs API key is required');
    }

    if (!audioBlob) {
      throw new Error('Audio blob is required for speech-to-text conversion');
    }

    if (audioBlob.size === 0) {
      throw new Error('Audio blob is empty - no audio data recorded');
    }

    // Sprawdź minimalny rozmiar audio (filtruj bardzo krótkie nagrania)
    if (audioBlob.size < 20000) { // Minimum 20KB audio
      throw new Error('Audio recording too short - speak louder or longer');
    }

    console.log('ElevenLabs: Sending audio blob to STT API, size:', audioBlob.size, 'type:', audioBlob.type);

    const url = `${this.baseUrl}/speech-to-text`;
    
    // Walidacja pliku audio
    if (!audioBlob || audioBlob.size === 0) {
      throw new Error('Audio blob is empty or invalid');
    }
    
    if (audioBlob.size < 1000) {
      console.warn('ElevenLabs: Audio blob is very small, might be corrupted');
      throw new Error('Audio file too small - likely corrupted or no audio recorded');
    }
    
    try {
      const formData = new FormData();
      // Określ nazwę pliku na podstawie typu MIME
      let fileName = 'audio.webm';
      if (audioBlob.type.includes('wav')) {
        fileName = 'audio.wav';
      } else if (audioBlob.type.includes('mp4')) {
        fileName = 'audio.mp4';
      }
      
      formData.append('file', audioBlob, fileName);
      formData.append('model_id', options.modelId || 'scribe_v1');
      
      if (options.language) {
        formData.append('language_code', options.language);
      }

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), this.config.timeout * 2); // Dłuższy timeout dla STT
      
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'xi-api-key': this.apiKey
        },
        body: formData,
        signal: controller.signal
      });
      
      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`ElevenLabs STT API error: ${response.status} - ${errorText}`);
      }

      const data = await response.json();
      return data.text || '';
      
    } catch (error) {
      console.error('ElevenLabs: Speech-to-text conversion failed:', error);
      throw error;
    }
  }

  /**
   * Ustawia callback dla aktywności audio
   * @param {Function} callback - Funkcja wywoływana gdy wykryto aktywność
   */
  setActivityCallback(callback) {
    this.activityCallback = callback;
  }

  /**
   * Rozpoczyna nagrywanie audio
   * @returns {Promise<void>}
   */
  async startRecording() {
    if (this.isRecording) {
      console.warn('ElevenLabs: Recording already in progress');
      return;
    }

    try {
      const constraints = {
        audio: {
          echoCancellation: this.config.echoCancellation,
          noiseSuppression: this.config.noiseSuppression,
          autoGainControl: this.config.autoGainControl,
          volume: this.config.audioSensitivity,
          sampleRate: this.config.sampleRate,
          channelCount: this.config.channelCount,
          // Dodatkowe ustawienia dla lepszego echo cancellation
          googEchoCancellation: true,
          googAutoGainControl: false,
          googNoiseSuppression: true,
          googHighpassFilter: true
        }
      };
      
      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      
      // Sprawdź dostępne formaty i wybierz najlepszy
      let mimeType = 'audio/webm;codecs=opus';
      if (MediaRecorder.isTypeSupported('audio/wav')) {
        mimeType = 'audio/wav';
      } else if (MediaRecorder.isTypeSupported('audio/mp4')) {
        mimeType = 'audio/mp4';
      }
      
      this.mediaRecorder = new MediaRecorder(stream, {
        mimeType: mimeType
      });
      
      console.log('ElevenLabs: Using MIME type:', mimeType);
      
      this.audioChunks = [];
      
      this.mediaRecorder.ondataavailable = (event) => {
        console.log('ElevenLabs: Data available, size:', event.data.size);
        // Tylko większe chunki audio (filtruj bardzo małe dźwięki)
        if (event.data.size > 15000) { // Zwiększony próg na 15000 bajtów dla lepszego filtrowania szumów tła
          this.audioChunks.push(event.data);
          
          // Powiadom o aktywności audio (resetuj timer ciszy)
          if (this.activityCallback) {
            this.activityCallback();
          }
        }
      };
      
      this.mediaRecorder.start(1000); // Zbieraj dane co 1 sekundę
      this.isRecording = true;
      
      console.log('ElevenLabs: Recording started with MediaRecorder state:', this.mediaRecorder.state);
      
    } catch (error) {
      console.error('ElevenLabs: Failed to start recording:', error);
      throw error;
    }
  }

  /**
   * Zatrzymuje nagrywanie i zwraca audio blob
   * @returns {Promise<Blob>}
   */
  async stopRecording() {
    if (!this.isRecording || !this.mediaRecorder) {
      throw new Error('No recording in progress');
    }

    return new Promise((resolve, reject) => {
      this.mediaRecorder.onstop = () => {
        console.log('ElevenLabs: MediaRecorder stopped, chunks count:', this.audioChunks.length);
        console.log('ElevenLabs: Chunks sizes:', this.audioChunks.map(chunk => chunk.size));
        
        // Użyj typu MIME z MediaRecorder
        const mimeType = this.mediaRecorder.mimeType || 'audio/webm';
        const audioBlob = new Blob(this.audioChunks, { type: mimeType });
        console.log('ElevenLabs: Created blob, size:', audioBlob.size, 'type:', audioBlob.type);
        
        // Sprawdź czy mamy wystarczająco danych audio
        if (audioBlob.size < 5000) {
          console.warn('ElevenLabs: Audio blob is very small, might not contain speech');
        }
        
        // Zatrzymaj wszystkie ścieżki audio
        this.mediaRecorder.stream.getTracks().forEach(track => track.stop());
        
        this.isRecording = false;
        this.mediaRecorder = null;
        this.audioChunks = [];
        
        console.log('ElevenLabs: Recording stopped');
        resolve(audioBlob);
      };
      
      this.mediaRecorder.onerror = (error) => {
        console.error('ElevenLabs: Recording error:', error);
        this.isRecording = false;
        reject(error);
      };
      
      this.mediaRecorder.stop();
    });
  }

  /**
   * Nagrawa audio i konwertuje na tekst
   * @param {number} duration - Czas nagrywania w milisekundach (opcjonalny)
   * @param {Object} options - Opcje dodatkowe
   * @returns {Promise<string>} - Transkrypcja tekstu
   */
  async recordAndTranscribe(duration = null, options = {}) {
    try {
      await this.startRecording();
      
      if (duration) {
        await new Promise(resolve => setTimeout(resolve, duration));
        const audioBlob = await this.stopRecording();
        return await this.speechToText(audioBlob, options);
      } else {
        // Zwróć Promise, który będzie rozwiązany gdy użytkownik zatrzyma nagrywanie
        return new Promise((resolve, reject) => {
          this._recordingResolve = resolve;
          this._recordingReject = reject;
          this._recordingOptions = options;
        });
      }
      
    } catch (error) {
      console.error('ElevenLabs: Record and transcribe failed:', error);
      throw error;
    }
  }

  /**
   * Kończy nagrywanie i zwraca transkrypcję (dla trybu manualnego)
   * @returns {Promise<string>}
   */
  async finishRecordingAndTranscribe() {
    if (!this.isRecording) {
      throw new Error('No recording in progress');
    }

    try {
      const audioBlob = await this.stopRecording();
      const transcription = await this.speechToText(audioBlob, this._recordingOptions || {});
      
      if (this._recordingResolve) {
        this._recordingResolve(transcription);
        this._recordingResolve = null;
        this._recordingReject = null;
        this._recordingOptions = null;
      }
      
      return transcription;
      
    } catch (error) {
      if (this._recordingReject) {
        this._recordingReject(error);
        this._recordingResolve = null;
        this._recordingReject = null;
        this._recordingOptions = null;
      }
      throw error;
    }
  }

  /**
   * Sprawdza czy nagrywanie jest w toku
   * @returns {boolean}
   */
  getIsRecording() {
    return this.isRecording;
  }
}