const express = require('express');
const multer = require('multer');
const cors = require('cors');
const path = require('path');
require('dotenv').config();

const { transcribeAudio } = require('./stt');
const { generateSpeech } = require('./tts');
const { getRandomReply } = require('./responses');

const app = express();
const upload = multer({ dest: 'uploads/' });

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, '..', 'public')));

// STT endpoint
app.post('/api/stt', upload.single('audio'), async (req, res) => {
  const transcript = await transcribeAudio(req.file.path);
  res.json({ transcript });
});

// Losowa odpowiedź (symulacja AI)
app.post('/api/reply', (req, res) => {
  const reply = getRandomReply();
  res.json({ reply });
});

// TTS endpoint
app.post('/api/tts', async (req, res) => {
  const { text } = req.body;
  const audioStream = await generateSpeech(text);
  audioStream.pipe(res);
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on http://localhost:${PORT}`));
