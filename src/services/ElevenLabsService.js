/**
 * Serwis do obsługi ElevenLabs Text-to-Speech API
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
      ...config
    };
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
}