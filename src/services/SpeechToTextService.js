import { EventEmitter } from '../utils/eventEmitter.js';
import { OpenAISpeechService } from './OpenAISpeechService.js';

/**
 * Serwis do obsługi rozpoznawania mowy z wykorzystaniem OpenAI Whisper API
 */
export class SpeechToTextService extends EventEmitter {
  constructor(openAiApiKey, config = {}) {
    super();
    this.events = new EventEmitter();
    
    this.openAiSpeechService = new OpenAISpeechService(openAiApiKey, config);
    this.isListening = false;
    this.isSupported = true; // OpenAI Whisper działa wszędzie gdzie jest MediaRecorder
    this.hasPermission = false;
    this.config = {
      language: 'pl',
      continuous: true,
      interimResults: true,
      maxAlternatives: 1,
      silenceTimeout: 3000, // 3 sekundy ciszy przed automatycznym zatrzymaniem
      activityThreshold: 20000, // Minimalna wielkość chunka audio do uznania za aktywność
      ...config
    };
    
    // Interim results simulation
    this.interimTimer = null;
    this.currentTranscription = '';
    
    // Auto-stop timer
    this.silenceTimer = null;
    this.lastActivityTime = null;
  }

  /**
   * Inicjalizuje serwis
   */
  async init() {
    try {
      // Sprawdź wsparcie dla MediaRecorder
      if (!window.MediaRecorder) {
        this.isSupported = false;
        throw new Error('MediaRecorder not supported');
      }
      
      // Sprawdź uprawnienia mikrofonu
      await this.checkMicrophonePermissions();
      
      // Ustaw próg aktywności w OpenAISpeechService
      if (this.config.activityThreshold) {
        this.openAiSpeechService.setActivityThreshold(this.config.activityThreshold);
      }
  
      return true;
      
    } catch (error) {
      console.error('SpeechToTextService: Initialization failed:', error);
      this.isSupported = false;
      throw error;
    }
  }

  /**
   * Sprawdza wsparcie dla rozpoznawania mowy
   */
  isRecognitionSupported() {
    return this.isSupported && !!this.openAiSpeechService.apiKey;
  }

  /**
   * Sprawdza uprawnienia mikrofonu
   */
  async checkMicrophonePermissions() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      stream.getTracks().forEach(track => track.stop());
      this.hasPermission = true;
      return true;
    } catch (error) {
      console.error('SpeechToTextService: Microphone permission denied:', error);
      this.hasPermission = false;
      throw error;
    }
  }

  /**
   * Rozpoczyna nasłuchiwanie
   */
  async startListening() {
    if (this.isListening) {
      console.warn('SpeechToTextService: Already listening');
      return;
    }

    if (!this.isRecognitionSupported()) {
      const error = new Error('Speech recognition not supported or API key missing');
      this.events.emit('error', error);
      throw error;
    }

    if (!this.hasPermission) {
      try {
        await this.checkMicrophonePermissions();
      } catch (error) {
        this.events.emit('error', error);
        throw error;
      }
    }

    try {
      this.isListening = true;
      this.currentTranscription = '';
      
      console.log('SpeechToTextService: Rozpoczynam nagrywanie...');
      
      // Ustaw callback aktywności audio z dodatkową logiką
      this.openAiSpeechService.setActivityCallback(() => {
        console.log('SpeechToTextService: Wykryto aktywność audio - resetuję timer ciszy');
        this.resetSilenceTimer();
        
        // Emit event o wykryciu aktywności dla UI
        this.events.emit('activity:detected');
      });
      
      // Rozpocznij nagrywanie
      await this.openAiSpeechService.startRecording();
      
      console.log('SpeechToTextService: Nagrywanie rozpoczęte pomyślnie');
      
      this.events.emit('start');
  
      
      // Uruchom timer automatycznego zatrzymywania
      this.startSilenceTimer();
      
      // Symuluj interim results co 500ms
      if (this.config.interimResults) {
        this.startInterimResultsSimulation();
      }
      
    } catch (error) {
      console.error('SpeechToTextService: Failed to start listening:', error);
      this.isListening = false;
      this.events.emit('error', error);
      throw error;
    }
  }

  /**
   * Zatrzymuje nasłuchiwanie
   */
  async stopListening() {
    if (!this.isListening) {
      console.warn('SpeechToTextService: Not currently listening');
      return;
    }

    try {
      this.isListening = false;
      
      // Zatrzymaj timery
      this.stopInterimResultsSimulation();
      this.stopSilenceTimer();
      
      // Wyczyść callback aktywności
      this.openAiSpeechService.setActivityCallback(null);
      
      // Zatrzymaj nagrywanie i uzyskaj transkrypcję
      try {
        const transcription = await this.openAiSpeechService.finishRecordingAndTranscribe();
        
        if (transcription && transcription.trim()) {
          // Emit final result w formacie kompatybilnym z SpeechService
          const event = {
            results: [{
              transcript: transcription.trim(),
              confidence: 0.9,
              isFinal: true
            }],
            resultIndex: 0
          };
          
          this.events.emit('result', event);
          this.events.emit('transcript:final', transcription.trim());
        } else {
          // Brak transkrypcji - prawdopodobnie za krótkie nagranie
          this.events.emit('transcript:final', '');
        }
      } catch (audioError) {
         // Obsłuż błędy związane z audio (za krótkie nagranie, brak dźwięku itp.)
         if (audioError.message.includes('No audio data recorded') || 
             audioError.message.includes('Audio recording too short') ||
             audioError.message.includes('Audio blob is empty')) {
           console.warn('SpeechToTextService: No speech detected or recording too short:', audioError.message);
           this.events.emit('transcript:final', '');
         } else {
           // Inne błędy - przekaż dalej
           console.error('SpeechToTextService: Unexpected audio error:', audioError);
           throw audioError;
         }
       }
      
      this.events.emit('end');
  
      
    } catch (error) {
      console.error('SpeechToTextService: Failed to stop listening:', error);
      this.events.emit('error', error);
      throw error;
    }
  }

  /**
   * Symuluje interim results podczas nagrywania
   */
  startInterimResultsSimulation() {
    if (this.interimTimer) {
      clearInterval(this.interimTimer);
    }
    
    this.interimTimer = setInterval(() => {
      if (!this.isListening) {
        this.stopInterimResultsSimulation();
        return;
      }
      
      // Emit interim result (pusty lub z placeholder)
      const event = {
        results: [{
          transcript: '...', // Placeholder podczas nagrywania
          confidence: 0.5,
          isFinal: false
        }],
        resultIndex: 0
      };
      
      this.events.emit('result', event);
      this.events.emit('transcript:interim', '...');
    }, 1000);
  }

  /**
   * Zatrzymuje symulację interim results
   */
  stopInterimResultsSimulation() {
    if (this.interimTimer) {
      clearInterval(this.interimTimer);
      this.interimTimer = null;
    }
  }

  /**
   * Uruchamia timer automatycznego zatrzymywania po ciszy
   */
  startSilenceTimer() {
    this.lastActivityTime = Date.now();
    console.log(`SpeechToTextService: Uruchomiono timer ciszy (timeout: ${this.config.silenceTimeout}ms)`);
    
    if (this.silenceTimer) {
      clearInterval(this.silenceTimer);
    }
    
    this.silenceTimer = setInterval(() => {
      if (!this.isListening) {
        this.stopSilenceTimer();
        return;
      }
      
      const timeSinceLastActivity = Date.now() - this.lastActivityTime;
      console.log(`SpeechToTextService: Sprawdzam timer ciszy - czas od ostatniej aktywności: ${timeSinceLastActivity}ms (próg: ${this.config.silenceTimeout}ms)`);
      
      if (timeSinceLastActivity >= this.config.silenceTimeout) {
        console.log('SpeechToTextService: Timeout ciszy - zatrzymuję nasłuchiwanie');
        // Sprawdź ponownie czy nadal nasłuchuje przed zatrzymaniem
        if (this.isListening) {
          this.stopListening().catch(console.error);
        }
      }
    }, 500); // Sprawdzaj co 500ms
  }

  /**
   * Zatrzymuje timer automatycznego zatrzymywania
   */
  stopSilenceTimer() {
    if (this.silenceTimer) {
      clearInterval(this.silenceTimer);
      this.silenceTimer = null;
    }
    this.lastActivityTime = null;
  }

  /**
   * Resetuje timer ciszy (wywołane gdy wykryto aktywność)
   */
  resetSilenceTimer() {
    if (this.isListening) {
      const oldTime = this.lastActivityTime;
      this.lastActivityTime = Date.now();
      console.log(`SpeechToTextService: Resetuję timer ciszy (poprzedni czas: ${oldTime}, nowy czas: ${this.lastActivityTime})`);
    }
  }

  /**
   * Sprawdza czy obecnie nasłuchuje
   */
  getIsListening() {
    return this.isListening;
  }

  /**
   * Ustawia język rozpoznawania
   */
  setLanguage(language) {
    this.config.language = language;

  }

  /**
   * Pobiera aktualny język
   */
  getLanguage() {
    return this.config.language;
  }

  /**
   * Ustawia konfigurację
   */
  setConfig(config) {
    this.config = { ...this.config, ...config };
    
    // Jeśli zmieniono ustawienia audio, przekaż je do OpenAI service
    if (config.activityThreshold && this.openAiSpeechService) {
      this.openAiSpeechService.setActivityThreshold(config.activityThreshold);
    }
  }
  
  /**
   * Ustawia timeout ciszy (czas po którym automatycznie zatrzymuje nagrywanie)
   */
  setSilenceTimeout(timeout) {
    this.config.silenceTimeout = timeout;
    console.log(`SpeechToTextService: Ustawiono timeout ciszy na ${timeout}ms`);
  }
  
  /**
   * Ustawia próg aktywności audio (minimalna wielkość chunka do uznania za aktywność)
   */
  setActivityThreshold(threshold) {
    this.config.activityThreshold = threshold;
    if (this.openAiSpeechService) {
      this.openAiSpeechService.setActivityThreshold(threshold);
    }
    console.log(`SpeechToTextService: Ustawiono próg aktywności na ${threshold} bajtów`);
  }

  /**
   * Pobiera aktualną konfigurację
   */
  getConfig() {
    return { ...this.config };
  }

  /**
   * Czyści zasoby
   */
  cleanup() {
    this.stopInterimResultsSimulation();
    
    if (this.isListening) {
      this.stopListening().catch(console.error);
    }
    

  }

  /**
   * Sprawdza czy ma uprawnienia do mikrofonu
   */
  getHasPermission() {
    return this.hasPermission;
  }

  /**
   * Sprawdza czy jest wspierany
   */
  getIsSupported() {
    return this.isSupported;
  }

  /**
   * Dodaje event listener
   */
  addEventListener(event, callback) {
    this.events.on(event, callback);
  }

  /**
   * Usuwa event listener
   */
  removeEventListener(event, callback) {
    this.events.off(event, callback);
  }

  /**
   * Dodaje event listener - deleguje do EventEmitter
   */
  on(event, callback) {
    return this.events.on(event, callback);
  }

  /**
   * Usuwa event listener - deleguje do EventEmitter
   */
  off(event, callback) {
    return this.events.off(event, callback);
  }

  /**
   * Dodaje event listener który wykona się tylko raz - deleguje do EventEmitter
   */
  once(event, callback) {
    return this.events.once(event, callback);
  }

  /**
   * Usuwa wszystkie listenery - deleguje do EventEmitter
   */
  removeAllListeners(event) {
    return this.events.removeAllListeners(event);
  }
}