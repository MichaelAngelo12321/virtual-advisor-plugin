const express = require('express');
const multer = require('multer');
const cors = require('cors');
const path = require('path');
const fetch = require('node-fetch');
require('dotenv').config();

const { transcribeAudio } = require('./stt');
const { generateSpeech } = require('./tts');

// Przechowywanie sessionId
let currentSessionId = null;

const app = express();
const upload = multer({ dest: 'uploads/' });

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, '..', 'public')));

// Chat start endpoint
app.get('/api/chat/start', async (req, res) => {
  try {
    const chatApiUrl = process.env.CHAT_API_URL || 'http://localhost:8001/api';
    const response = await fetch(`${chatApiUrl}/chat/start.json`);
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    const data = await response.json();
    currentSessionId = data.sessionId;
    
    res.json({
      message: data.message,
      sessionId: data.sessionId,
      createdAt: data.createdAt
    });
  } catch (error) {
    console.error('Error connecting to chat API:', error);
    res.status(500).json({ 
      error: 'Failed to connect to chat API',
      message: 'Cześć! Jestem twoim asystentem głosowym. W czym mogę ci pomóc?' // fallback message
    });
  }
});

// STT endpoint
app.post('/api/stt', upload.single('audio'), async (req, res) => {
  const transcript = await transcribeAudio(req.file.path);
  res.json({ transcript });
});

// Chat answer endpoint
app.post('/api/chat/answer', async (req, res) => {
  try {
    const { sessionId, answer } = req.body;
    
    if (!sessionId || !answer) {
      return res.status(400).json({ error: 'SessionId and answer are required' });
    }
    
    const chatApiUrl = process.env.CHAT_API_URL || 'http://localhost:8001/api';
    const response = await fetch(`${chatApiUrl}/chat/answer.json`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sessionId, answer })
    });
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    const data = await response.json();
    
    res.json({
      sessionId: data.sessionId,
      question: data.question,
      category: data.category,
      questionNumber: data.questionNumber,
      totalQuestions: data.totalQuestions,
      isCompleted: data.isCompleted,
      createdAt: data.createdAt,
      creditInformation: data.creditInformation || null
    });
  } catch (error) {
    console.error('Error connecting to chat API:', error);
    res.status(500).json({ 
      error: 'Failed to connect to chat API',
      question: 'Przepraszam, wystąpił błąd. Spróbuj ponownie.' // fallback question
    });
  }
});

// TTS endpoint
app.post('/api/tts', async (req, res) => {
  const { text } = req.body;
  const audioStream = await generateSpeech(text);
  audioStream.pipe(res);
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on http://localhost:${PORT}`));
