export class SpeechProcessor {
  constructor() {
    this.isProcessing = false;
  }

  async processAudio(audioBlob, onTranscript, onReply) {
    // Zabezpieczenie przed wielokrotnym wywołaniem
    if (this.isProcessing) return;
    this.isProcessing = true;

    const formData = new FormData();
    formData.append('audio', audioBlob);

    try {
      const res = await fetch('/api/stt', { method: 'POST', body: formData });
      const { transcript } = await res.json();
      console.log("Użytkownik powiedział:", transcript);

      if (onTranscript) onTranscript(transcript);

      if (!transcript || transcript.trim().length === 0) {
        this.isProcessing = false;
        return null;
      }

      const replyRes = await fetch('/api/reply', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userText: transcript }),
      });
      const { reply } = await replyRes.json();

      this.isProcessing = false;
      
      if (onReply) onReply(reply);
      return reply;
    } catch (err) {
      console.error("Błąd przetwarzania:", err);
      this.isProcessing = false;
      throw err;
    }
  }

  async getReply(userText) {
    const response = await fetch('/api/reply', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: userText })
    });
    
    if (!response.ok) {
      throw new Error(`Reply error! status: ${response.status}`);
    }
    
    const data = await response.json();
    return data.reply;
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