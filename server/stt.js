const fs = require('fs');
const fetch = require('node-fetch');
const { GOOGLE_API_KEY } = process.env;

async function transcribeAudio(filePath) {
  const audioBytes = fs.readFileSync(filePath).toString('base64');

  const res = await fetch(`https://speech.googleapis.com/v1/speech:recognize?key=${GOOGLE_API_KEY}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      config: {
        encoding: 'WEBM_OPUS',
        sampleRateHertz: 48000,
        languageCode: 'pl-PL',
      },
      audio: {
        content: audioBytes,
      }
    }),
  });

  fs.unlinkSync(filePath); // czyścimy

  const data = await res.json();
  const transcript = data.results?.[0]?.alternatives?.[0]?.transcript || '';
  return transcript;
}

module.exports = { transcribeAudio };
