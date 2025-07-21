// Stałe konfiguracyjne
export const STATES = {
  IDLE: 'idle',
  LISTENING: 'listening',
  PROCESSING: 'processing',
  SPEAKING: 'speaking',
  ERROR: 'error'
};

export const EVENTS = {
  STATE_CHANGE: 'stateChange',
  LISTENING_START: 'listeningStart',
  LISTENING_STOP: 'listeningStop',
  PROCESSING_START: 'processingStart',
  PROCESSING_COMPLETE: 'processingComplete',
  SPEAKING_START: 'speakingStart',
  SPEAKING_COMPLETE: 'speakingComplete',
  ERROR: 'error'
};

export const DEFAULT_CONFIG = {
  // Pozycja przycisku
  position: 'bottom-right',
  
  // Klucze API
  apiUrl: '',
  elevenLabsKey: 'sk_072b349dcc92f48edd4349098b02dcdfd321192d2d1479f7',
  openAiApiKey: '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',
  voiceId: 'pNInz6obpgDQGcFmaJgB', // Adam voice ID
  
  // Ustawienia nagrywania
  recording: {
    maxDuration: 30000, // 30 sekund
    silenceTimeout: 3000, // 3 sekundy ciszy przed automatycznym zatrzymaniem
    activityThreshold: 20000, // Minimalna wielkość chunka audio do uznania za aktywność (w bajtach) - wyższy próg = mniej czuły
    sampleRate: 16000,
    channels: 1
  },
  
  // Ustawienia API
  api: {
    timeout: 10000, // 10 sekund
    retries: 3
  },
  
  // Ustawienia ElevenLabs - zoptymalizowane dla szybkości
  elevenLabs: {
    timeout: 8000, // Zmniejszony timeout
    modelId: 'eleven_multilingual_v2', // Szybszy model
    stability: 0.5,
    similarityBoost: 0.75,
    useSpeakerBoost: true // Wyłączone dla szybkości
  },
  
  // Ustawienia UI
  ui: {
    theme: 'light',
    animations: true,
    showVisualizer: true
  },
  
  // Bezpieczeństwo
  security: {
    validateOrigin: true,
    maxFileSize: 10 * 1024 * 1024, // 10MB
    allowedMimeTypes: ['audio/webm', 'audio/wav', 'audio/mp3']
  }
};

export const ERRORS = {
  MICROPHONE_ACCESS_DENIED: 'Dostęp do mikrofonu został odmówiony',
  RECORDING_FAILED: 'Nagrywanie nie powiodło się',
  API_ERROR: 'Błąd komunikacji z API',
  ELEVENLABS_ERROR: 'Błąd syntezy mowy',
  NETWORK_ERROR: 'Błąd połączenia sieciowego',
  INVALID_CONFIG: 'Nieprawidłowa konfiguracja'
};