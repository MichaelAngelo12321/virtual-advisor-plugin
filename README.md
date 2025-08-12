# Virtual Advisor Plugin

Aplikacja voice-first z real-time STT (Google Cloud Speech) i TTS (ElevenLabs) z możliwością przerywania konwersacji. Zbudowana jako modularny system pluginów.

## 🚀 Funkcje

- **Real-time Speech-to-Text** - Google Cloud Speech z interim results
- **Real-time Text-to-Speech** - ElevenLabs streaming audio
- **Voice Activity Detection** - Automatyczne wykrywanie mowy użytkownika
- **Inteligentne przerywanie** - TTS zatrzymuje się gdy użytkownik zaczyna mówić
- **System pluginów** - Hooki dla zewnętrznych rozszerzeń
- **WebSocket streaming** - Niska latencja komunikacji
- **Cross-browser support** - Działa w Chrome, Firefox, Safari, Edge

## 📋 Wymagania

- Node.js 18.0.0+
- Konto Google Cloud z włączonym Speech-to-Text API
- Klucz API ElevenLabs
- Mikrofon i głośniki/słuchawki
- Nowoczesna przeglądarka z WebRTC support

## ⚙️ Instalacja i konfiguracja

### 1. Zainstaluj dependencies

```bash
npm install
```

### 2. Konfiguracja Google Cloud

1. Utwórz projekt w [Google Cloud Console](https://console.cloud.google.com/)
2. Włącz Speech-to-Text API
3. Utwórz Service Account i pobierz plik JSON z kluczami
4. Umieść plik jako `backend/config/service-account-key.json`

### 3. Konfiguracja ElevenLabs

1. Załóż konto na [ElevenLabs](https://elevenlabs.io/)
2. Skopiuj API key z dashboard
3. Opcjonalnie: skopiuj Voice ID preferowanego głosu

### 4. Zmienne środowiskowe

Skopiuj `.env.example` do `.env` i uzupełnij:

```bash
cp .env.example .env
```

Edytuj `.env`:

```env
# Google Cloud Speech-to-Text
GOOGLE_APPLICATION_CREDENTIALS=./backend/config/service-account-key.json
GOOGLE_CLOUD_PROJECT_ID=twoj-project-id

# ElevenLabs TTS
ELEVENLABS_API_KEY=twoj-elevenlabs-api-key
ELEVENLABS_VOICE_ID=21m00Tcm4TlvDq8ikWAM

# Server Configuration
PORT=3000
WS_PORT=3001
NODE_ENV=development

# Audio Configuration
SAMPLE_RATE=16000
CHUNK_SIZE=1024
```

## 🚀 Uruchomienie

### Tryb rozwojowy (development)

```bash
npm run dev
```

### Tryb produkcyjny

```bash
npm start
```

Aplikacja będzie dostępna pod adresem: **http://localhost:3000**

## 🎯 Jak używać

1. Otwórz http://localhost:3000 w przeglądarce
2. Pozwól na dostęp do mikrofonu
3. Kliknij "Start Voice Session"
4. Mów do mikrofonu - transkrypcja pojawi się na żywo
5. Asystent odpowie głosowo
6. Możesz przerwać TTS mówiąc w trakcie odpowiedzi

## 🔧 Architektura

### Backend (Node.js)

- **server.js** - Główny serwer Express + WebSocket
- **backend/stt.js** - Klient Google Cloud Speech-to-Text
- **backend/tts.js** - Klient ElevenLabs TTS
- **backend/plugins.js** - System zarządzania pluginami

### Frontend (Vanilla JS)

- **frontend/app.js** - Główna logika aplikacji
  - `MicrophoneStreamer` - Nagrywanie i streaming audio
  - `PlaybackController` - Odtwarzanie TTS
  - `PluginManagerClient` - Obsługa pluginów po stronie klienta
- **frontend/index.html** - Interfejs użytkownika
- **frontend/styles.css** - Stylowanie UI

### Klasy i komponenty

#### Backend

```javascript
// STT Client - Google Cloud Speech streaming
class SttClient extends EventEmitter {
  startStreaming()
  writeAudio(audioBuffer)
  stopStreaming()
}

// TTS Client - ElevenLabs WebSocket streaming  
class TtsClient extends EventEmitter {
  synthesizeStream(text)
  stopSynthesis()
}

// Plugin Manager - System hooków
class PluginManager extends EventEmitter {
  register(plugin)
  emit(eventType, data)
}
```

#### Frontend

```javascript
// Microphone streaming z VAD
class MicrophoneStreamer {
  init()
  startStreaming()
  stopStreaming()
}

// Audio playback dla TTS chunks
class PlaybackController {
  playChunk(audioBuffer)
  stop()
}
```

## 🔌 System pluginów

### Rejestracja pluginu

```javascript
// Backend
pluginManager.register({
  name: 'my-plugin',
  onTranscript: (transcript) => {
    console.log('Final transcript:', transcript);
  },
  onPartialTranscript: (transcript) => {
    console.log('Partial:', transcript);
  },
  onTTSStart: () => {
    console.log('TTS started');
  },
  onTTSStop: () => {
    console.log('TTS stopped');
  },
  onUserStartedSpeaking: () => {
    console.log('User interrupted');
  },
  onError: (error) => {
    console.error('Error:', error);
  }
});
```

### Dostępne hooki

- `onTranscript(text)` - Finalna transkrypcja
- `onPartialTranscript(text)` - Interim transkrypcja (real-time)
- `onTTSStart()` - Rozpoczęcie odtwarzania TTS
- `onTTSStop()` - Zakończenie TTS
- `onUserStartedSpeaking()` - Wykrycie mowy użytkownika
- `onError(error)` - Obsługa błędów

## 🔍 Troubleshooting

### Problemy z mikrofonem

- Sprawdź czy przeglądarka ma dostęp do mikrofonu
- Użyj HTTPS dla produkcji (wymagane przez WebRTC)
- Sprawdź konsole na błędy WebAudio API

### Problemy z Google Cloud

- Sprawdź czy plik service account jest poprawny
- Upewnij się że Speech-to-Text API jest włączone
- Sprawdź quotas i billing w Google Cloud Console

### Problemy z ElevenLabs

- Sprawdź poprawność API key
- Sprawdź limity na koncie ElevenLabs
- Weryfikuj czy Voice ID istnieje

### Problemy z WebSocket

- Sprawdź czy port 3001 jest dostępny
- Dla produkcji użyj wss:// zamiast ws://
- Sprawdź firewall i proxy settings

## 🚀 Deployment

### Lokalna produkcja

```bash
NODE_ENV=production npm start
```

### Docker (opcjonalne)

```dockerfile
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY . .
EXPOSE 3000 3001
CMD ["npm", "start"]
```

### Zmienne produkcyjne

```env
NODE_ENV=production
PORT=3000
WS_PORT=3001
```

## 📚 API Reference

### WebSocket Messages

#### Klient → Server

```javascript
// Start sesji
{ type: 'start-session' }

// Stop sesji  
{ type: 'stop-session' }

// Audio data (base64)
{ type: 'audio-data', audio: 'base64-encoded-pcm' }

// Użytkownik zaczął mówić
{ type: 'user-started-speaking' }
```

#### Server → Klient

```javascript
// Sesja rozpoczęta
{ type: 'session-started', sessionId: 'uuid' }

// Partial transkrypcja
{ type: 'partial-transcript', text: 'tekst...' }

// Finalna transkrypcja
{ type: 'final-transcript', text: 'tekst...' }

// TTS chunk audio
{ type: 'tts-chunk', audio: 'base64-audio-data' }

// TTS events
{ type: 'tts-start' }
{ type: 'tts-end' }

// Błędy
{ type: 'error', type: 'stt|tts|websocket', message: 'opis błędu' }
```

## 🔧 Konfiguracja zaawansowana

### Audio Settings

```env
SAMPLE_RATE=16000        # Sample rate dla STT
CHUNK_SIZE=1024          # Rozmiar chunk audio
```

### Google Cloud Settings

- **Model**: `latest_long` (najlepszy dla konwersacji)
- **Language**: `pl-PL` (polski)
- **Encoding**: `WEBM_OPUS` (z przeglądarki)

### ElevenLabs Settings

- **Model**: `eleven_turbo_v2` (najniższa latencja)
- **Voice Settings**: stability=0.5, similarity_boost=0.75

## 📄 Licencja

MIT License - zobacz plik LICENSE dla szczegółów.

## 🤝 Kontakt

W przypadku problemów lub pytań, sprawdź logi w konsoli przeglądarki i terminalu Node.js.