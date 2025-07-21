const fetch = require('node-fetch');

async function generateSpeech(text) {
  const response = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${process.env.ELEVEN_VOICE_ID}`, {
    method: 'POST',
    headers: {
      'xi-api-key': process.env.ELEVEN_API_KEY,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      text,
      model_id: "eleven_multilingual_v2",
      voice_settings: {
        stability: 0.4,
        similarity_boost: 0.8,
      },
    }),
  });

  return response.body; // Stream
}

module.exports = { generateSpeech };
