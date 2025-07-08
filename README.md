# Virtual Advisor Plugin

Plugin do integracji z Virtual Advisor API - asystent głosowy do analizy ofert kredytów hipotecznych.

## Instalacja

1. Sklonuj repozytorium:
```bash
git clone <>
cd virtual-advisor-plugin
```

2. Zainstaluj zależności:
```bash
npm install
```

## Uruchomienie

### Tryb deweloperski
```bash
npm run dev
```

### Budowanie projektu
```bash
npm run build
```

Pliki zostaną wygenerowane w folderze `dist/`:
- `virtual-advisor.es.js` - moduł ES
- `virtual-advisor.umd.js` - moduł UMD
- `style.css` - style CSS

### Testowanie
Otwórz plik `test/example.html` w przeglądarce lub uruchom lokalny serwer:
```bash
npm run preview
```

## Konfiguracja

### Podstawowa inicjalizacja
```javascript
const advisor = new VirtualAdvisor({
  apiUrl: 'http://localhost:8000/api',
  elevenLabsApiKey: 'your-api-key',
  voiceId: 'voice-id'
});

advisor.init();
```

### Parametry konfiguracji
- `apiUrl` - URL do API backendu
- `elevenLabsApiKey` - klucz API do ElevenLabs (opcjonalny)
- `voiceId` - ID głosu ElevenLabs (opcjonalny)

## Struktura projektu

```
src/
├── components/          # Komponenty UI
│   ├── Modal.js
│   └── VoiceButton.js
├── core/               # Główna logika
│   └── VirtualAdvisor.js
├── services/           # Usługi zewnętrzne
│   └── ElevenLabsService.js
├── styles/             # Style CSS
│   └── main.css
└── utils/              # Narzędzia pomocnicze
    ├── constants.js
    └── eventEmitter.js
```

## API

Plugin komunikuje się z następującymi endpointami:
- `POST /chat/message` - wysyłanie wiadomości
- `GET /chat/mortgage-offers/{sessionId}.json` - pobieranie ofert kredytowych

## Funkcjonalności

- 🎤 Rozpoznawanie mowy
- 🔊 Synteza mowy (ElevenLabs)
- 💬 Chat z AI
- 🏦 Wyświetlanie ofert kredytów hipotecznych
- 📱 Responsywny design

## Wymagania

- Node.js 16+
- Nowoczesna przeglądarka z obsługą Web Speech API
- Backend API zgodny z dokumentacją

## Licencja

MIT