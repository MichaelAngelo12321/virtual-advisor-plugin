# Virtual Advisor Plugin

Wtyczka voice-first z real-time STT (Google Cloud Speech) i TTS (ElevenLabs) z możliwością przerywania konwersacji. Dostępna jako CDN do integracji z dowolną stroną internetową.

## 🚀 Funkcje

- **Real-time Speech-to-Text** - Google Cloud Speech z interim results
- **Real-time Text-to-Speech** - ElevenLabs streaming audio
- **Voice Activity Detection** - Automatyczne wykrywanie mowy użytkownika
- **Inteligentne przerywanie** - TTS zatrzymuje się gdy użytkownik zaczyna mówić
- **System pluginów** - Hooki dla zewnętrznych rozszerzeń
- **WebSocket streaming** - Niska latencja komunikacji
- **Cross-browser support** - Działa w Chrome, Firefox, Safari, Edge
- **CDN Ready** - Gotowa do użycia jako wtyczka na dowolnej stronie

## 📋 Wymagania

### Dla serwera (backend)
- Node.js 18.0.0+
- Konto Google Cloud z włączonym Speech-to-Text API
- Klucz API ElevenLabs

### Dla klienta (frontend)
- Nowoczesna przeglądarka z WebRTC support
- Mikrofon i głośniki/słuchawki
- HTTPS (wymagane w produkcji)

## ⚙️ Instalacja serwera

### 1. Zainstaluj dependencies

```bash
yarn install
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

### 5. Uruchomienie serwera

```bash
yarn start
```

Serwer będzie dostępny pod adresem: **http://localhost:3000**

## 🔌 Użycie wtyczki na stronie

Zobacz folder `dist/` dla gotowej wersji CDN wtyczki.

### Podstawowa integracja

```html
<!DOCTYPE html>
<html>
<head>
    <link rel="stylesheet" href="https://your-cdn.com/virtual-advisor-plugin.css">
</head>
<body>
    <div id="virtual-advisor-container"></div>
    
    <script src="https://your-cdn.com/virtual-advisor-plugin.js"></script>
    <script>
        const advisor = new VirtualAdvisorPlugin({
            serverUrl: 'ws://your-server.com:3001',
            apiUrl: 'http://your-server.com:8001',
            containerId: 'virtual-advisor-container'
        });
        
        advisor.init();
    </script>
</body>
</html>
```

## 🔧 Architektura

### Backend (Node.js)

- **server.js** - Główny serwer Express + WebSocket
- **backend/stt.js** - Klient Google Cloud Speech-to-Text
- **backend/tts.js** - Klient ElevenLabs TTS
- **backend/plugins.js** - System zarządzania pluginami

### Frontend (Wtyczka)

- **dist/virtual-advisor-plugin.js** - Zbudowana wtyczka (19.3 KB)
- **dist/virtual-advisor-plugin.css** - Style wtyczki (13.2 KB)
- **dist/virtual-advisor-plugin.html** - Template HTML (4.6 KB)

### API wtyczki

```javascript
// Inicjalizacja wtyczki
const advisor = new VirtualAdvisorPlugin({
    serverUrl: 'ws://localhost:3001',
    apiUrl: 'http://localhost:8001',
    containerId: 'virtual-advisor-container',
    autoStart: false
});

// Metody
await advisor.init();    // Inicjalizacja
advisor.start();         // Uruchomienie
advisor.stop();          // Zatrzymanie
advisor.destroy();       // Zniszczenie
```

## 🔌 System pluginów

### Rejestracja pluginu (backend)

```javascript
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

### Problemy z serwerem
- Sprawdź czy plik service account Google Cloud jest poprawny
- Upewnij się że Speech-to-Text API jest włączone
- Sprawdź poprawność klucza API ElevenLabs
- Sprawdź czy serwer działa na porcie 3000

## 🚀 Budowanie wtyczki

Aby zbudować wtyczkę do folderu `dist/`:

```bash
yarn build
```

To utworzy pliki:
- `dist/virtual-advisor-plugin.js` (19.3 KB)
- `dist/virtual-advisor-plugin.css` (13.2 KB) 
- `dist/virtual-advisor-plugin.html` (4.6 KB)

## 📚 Konfiguracja

### Zmienne środowiskowe serwera

```env
# Google Cloud Speech-to-Text
GOOGLE_APPLICATION_CREDENTIALS=./backend/config/service-account-key.json

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

### Opcje wtyczki

```javascript
const options = {
    serverUrl: 'ws://localhost:3001',     // URL serwera WebSocket
    apiUrl: 'http://localhost:8001',      // URL API HTTP
    containerId: 'virtual-advisor-container', // ID kontenera HTML
    autoStart: false                      // Czy automatycznie uruchomić
};
```

## 📄 Licencja

MIT License

## 🤝 Kontakt

W przypadku problemów sprawdź logi w konsoli przeglądarki i terminalu Node.js.