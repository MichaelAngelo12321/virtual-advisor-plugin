export class SpeechProcessor {
  constructor() {
    this.isProcessing = false;
  }

  // Metoda processAudio została usunięta - używamy teraz bezpośrednio endpointów w voiceAssistant.js

  async getReply(userText, sessionId) {
    if (!sessionId) {
      throw new Error('SessionId is required for chat API');
    }
    
    const response = await fetch('http://localhost:8001/api/chat/answer.json', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        sessionId: sessionId,
        answer: userText 
      })
    });
    
    if (!response.ok) {
      throw new Error(`Chat API error! status: ${response.status}`);
    }
    
    const data = await response.json();
    return data; // Zwracamy pełne dane z API
  }

  async synthesizeSpeech(text) {
    const response = await fetch('/api/tts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text })
    });
    
    if (!response.ok) {
      throw new Error(`TTS error! status: ${response.status}`);
    }
    
    const audioBlob = await response.blob();
    return URL.createObjectURL(audioBlob);
  }

  reset() {
    this.isProcessing = false;
  }
}