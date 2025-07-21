/**
 * Serwis do obsługi OpenAI Whisper Speech-to-Text API
 */
export class OpenAISpeechService {
  constructor(apiKey, config = {}) {
    this.apiKey = apiKey;
    this.baseUrl = 'https://api.openai.com/v1';
    this.config = {
      model: 'whisper-1',
      language: 'pl', // Polski jako domyślny
      temperature: 0,
      timeout: 30000,
      // Ustawienia audio
      audioSensitivity: 0.5,
      autoGainControl: false,
      noiseSuppression: true,
      echoCancellation: true,
      sampleRate: 16000,
      channelCount: 1,
      ...config
    };
    
    // Speech-to-Text properties
    this.mediaRecorder = null;
    this.audioChunks = [];
    this.isRecording = false;
    this.activityCallback = null;
    this.activityThreshold = 20000; // Domyślny próg aktywności w bajtach - wyższy próg dla mniejszej czułości na szumy tła
  }

  /**
   * Konwertuje audio blob do formatu WAV
   * @param {Blob} audioBlob - Oryginalny blob audio
   * @returns {Promise<Blob>} - Blob w formacie WAV
   */
  async convertToWav(audioBlob) {
    return new Promise((resolve, reject) => {
      const audioContext = new (window.AudioContext || window.webkitAudioContext)();
      const fileReader = new FileReader();
      
      fileReader.onload = async (e) => {
        try {
          const arrayBuffer = e.target.result;
          const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
          
          // Konwertuj do WAV
          const wavBlob = this.audioBufferToWav(audioBuffer);
          resolve(wavBlob);
        } catch (error) {
          console.warn('OpenAI: Failed to convert to WAV, using original:', error);
          resolve(audioBlob); // Fallback do oryginalnego
        }
      };
      
      fileReader.onerror = () => {
        console.warn('OpenAI: FileReader error, using original audio');
        resolve(audioBlob); // Fallback do oryginalnego
      };
      
      fileReader.readAsArrayBuffer(audioBlob);
    });
  }
  
  /**
   * Konwertuje AudioBuffer do formatu WAV
   * @param {AudioBuffer} audioBuffer
   * @returns {Blob}
   */
  audioBufferToWav(audioBuffer) {
    const numChannels = audioBuffer.numberOfChannels;
    const sampleRate = audioBuffer.sampleRate;
    const format = 1; // PCM
    const bitDepth = 16;
    
    const bytesPerSample = bitDepth / 8;
    const blockAlign = numChannels * bytesPerSample;
    
    const buffer = audioBuffer.getChannelData(0);
    const length = buffer.length;
    const arrayBuffer = new ArrayBuffer(44 + length * bytesPerSample);
    const view = new DataView(arrayBuffer);
    
    // WAV header
    const writeString = (offset, string) => {
      for (let i = 0; i < string.length; i++) {
        view.setUint8(offset + i, string.charCodeAt(i));
      }
    };
    
    writeString(0, 'RIFF');
    view.setUint32(4, 36 + length * bytesPerSample, true);
    writeString(8, 'WAVE');
    writeString(12, 'fmt ');
    view.setUint32(16, 16, true);
    view.setUint16(20, format, true);
    view.setUint16(22, numChannels, true);
    view.setUint32(24, sampleRate, true);
    view.setUint32(28, sampleRate * blockAlign, true);
    view.setUint16(32, blockAlign, true);
    view.setUint16(34, bitDepth, true);
    writeString(36, 'data');
    view.setUint32(40, length * bytesPerSample, true);
    
    // Convert float samples to 16-bit PCM
    let offset = 44;
    for (let i = 0; i < length; i++) {
      const sample = Math.max(-1, Math.min(1, buffer[i]));
      view.setInt16(offset, sample * 0x7FFF, true);
      offset += 2;
    }
    
    return new Blob([arrayBuffer], { type: 'audio/wav' });
  }

  /**
   * Konwertuje audio na tekst używając OpenAI Whisper
   * @param {Blob} audioBlob - Blob z nagraniem audio
   * @param {Object} options - Opcje dodatkowe
   * @returns {Promise<string>} - Transkrypcja tekstu
   */
  async speechToText(audioBlob, options = {}) {
    const url = `${this.baseUrl}/audio/transcriptions`;
    
    
    
    // Walidacja pliku audio
    if (!audioBlob) {
      throw new Error('Audio blob is null or undefined');
    }
    
    if (audioBlob.size === 0) {
      throw new Error('Audio blob is empty - no audio data recorded');
    }
    
    if (audioBlob.size < 100) {
      console.warn('OpenAI: Audio blob is very small, might be corrupted');
      throw new Error('Audio file too small - likely corrupted or no audio recorded');
    }
    
    try {
      // Spróbuj skonwertować do WAV dla lepszej kompatybilności
      let processedBlob = audioBlob;
      if (!audioBlob.type.includes('wav')) {
        processedBlob = await this.convertToWav(audioBlob);
      }
      
      const formData = new FormData();
      
      // Użyj zawsze nazwy WAV po konwersji
      const fileName = processedBlob.type.includes('wav') ? 'audio.wav' : 'audio.webm';
      
      formData.append('file', processedBlob, fileName);
      formData.append('model', options.model || this.config.model);
      
      if (options.language || this.config.language) {
        formData.append('language', options.language || this.config.language);
      }
      
      if (options.temperature !== undefined) {
        formData.append('temperature', options.temperature.toString());
      } else if (this.config.temperature !== undefined) {
        formData.append('temperature', this.config.temperature.toString());
      }

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), this.config.timeout);
      
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`
        },
        body: formData,
        signal: controller.signal
      });
      
      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorText = await response.text();

        throw new Error(`OpenAI Whisper API error: ${response.status} - ${errorText}`);
      }

      const data = await response.json();
      return data.text || '';
      
    } catch (error) {
      console.error('OpenAI: Speech-to-text conversion failed:', error);
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
      
      // Sprawdź dostępne formaty i wybierz obsługiwany przez Whisper API
      // Wymuś użycie webm, który jest najlepiej obsługiwany przez Whisper
      let mimeType = 'audio/webm'; // Podstawowy webm bez kodeka
      
      // Priorytet formatów obsługiwanych przez Whisper API
      if (MediaRecorder.isTypeSupported('audio/webm')) {
        mimeType = 'audio/webm';
      } else if (MediaRecorder.isTypeSupported('audio/webm;codecs=opus')) {
        mimeType = 'audio/webm;codecs=opus';
      } else if (MediaRecorder.isTypeSupported('audio/ogg;codecs=opus')) {
        mimeType = 'audio/ogg;codecs=opus';
      } else if (MediaRecorder.isTypeSupported('audio/wav')) {
        mimeType = 'audio/wav';
      } else {
        mimeType = 'audio/webm';
      }
      
      this.mediaRecorder = new MediaRecorder(stream, {
        mimeType: mimeType
      });
      
      this.audioChunks = [];
      
      this.mediaRecorder.ondataavailable = (event) => {
        // Zawsze dodaj chunk, nawet jeśli jest mały - może być częścią większego nagrania
        if (event.data && event.data.size > 0) {
          this.audioChunks.push(event.data);
          
          // Powiadom o aktywności audio tylko dla większych chunków (resetuj timer ciszy)
          // Używaj konfigurowalnego progu aktywności aby zmniejszyć czułość na szumy tła
          if (event.data.size > this.activityThreshold && this.activityCallback) {
            console.log(`OpenAI: Wykryto aktywność audio (${event.data.size} bajtów, próg: ${this.activityThreshold})`);
            this.activityCallback();
          }
        }
      };
      
      this.mediaRecorder.start(1000); // Zbieraj dane co 1 sekundę
      this.isRecording = true;
      
    } catch (error) {
      console.error('OpenAI: Failed to start recording:', error);
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
        try {
          // Użyj typu MIME z MediaRecorder
          const mimeType = this.mediaRecorder.mimeType || 'audio/webm';
          const audioBlob = new Blob(this.audioChunks, { type: mimeType });

          // Zatrzymaj wszystkie ścieżki audio
          this.mediaRecorder.stream.getTracks().forEach(track => track.stop());
          
          this.isRecording = false;
          this.mediaRecorder = null;
          this.audioChunks = [];

          // Sprawdź czy mamy wystarczająco danych audio
          if (audioBlob.size === 0) {
            reject(new Error('No audio data recorded - microphone might be muted or no speech detected'));
            return;
          }
          
          if (audioBlob.size < 500) {
            reject(new Error('Audio recording too short - please speak longer or check microphone'));
            return;
          }

          resolve(audioBlob);
        } catch (error) {
          console.error('OpenAI: Błąd podczas zatrzymywania nagrywania:', error);
          reject(error);
        }
      };
      
      this.mediaRecorder.onerror = (error) => {
        console.error('OpenAI: Recording error:', error);
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
      console.error('OpenAI: Record and transcribe failed:', error);
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

  /**
   * Sprawdza czy serwis jest skonfigurowany
   * @returns {boolean}
   */
  isConfigured() {
    return !!this.apiKey;
  }
  
  /**
   * Ustawia próg aktywności audio
   * @param {number} threshold - Próg w bajtach
   */
  setActivityThreshold(threshold) {
    this.activityThreshold = threshold;
    console.log(`OpenAI: Ustawiono próg aktywności na ${threshold} bajtów`);
  }
}