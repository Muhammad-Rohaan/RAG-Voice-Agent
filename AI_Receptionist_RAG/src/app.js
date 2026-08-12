import express from "express";
import dotenv from "dotenv";
import cors from "cors";
import http from "http";
import path from "path";
import os from "os";
import { existsSync } from "fs";
import { WebSocketServer } from "ws";
import { createChunks, loadDocs } from "./Controllers/RAG.controller.js";
import { generatePkVoice, sendQueryToGroqLLM } from "./Controllers/GroqLLM.controller.js";
// Dynamic import of startVoiceAgentSession will be done in the route handler
import { embedding } from "./Pipes/IngestionPipeline.js";
import { registerRealtimeWSS } from "./Controllers/RealTimeVoiceAgent.controller.js";


dotenv.config();

const app = express();

const port = process.env.PORT || 9000;

const allowedOrigins = (process.env.BACKEND_URL ?? "http://localhost:5000,http://localhost:8000,http://localhost:5173")
    .split(",")
    .map(origin => origin.trim())
    .filter(Boolean);

app.use(cors({
    origin: function (origin, callback) {
        if (!origin) return callback(null, true);
        if (allowedOrigins.indexOf(origin) !== -1 || process.env.NODE_ENV !== 'production') {
            callback(null, true);
        } else {
            callback(null, true);
        }
    },
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    credentials: true,
    allowedHeaders: ["Content-Type", "Authorization", "Accept", "X-Requested-With"]
}));

app.use(express.json());

// for Voice Session:
const server = http.createServer(app);
const wss = new WebSocketServer({ server });

// Wire up the OpenAI Realtime WS proxy at startup
registerRealtimeWSS(wss);

app.get('/', (req, res) => {
    res.send('Welcome to AKUH RAG Service');
})

app.get('/health', (req, res) => {
    res.status(200).json({ status: 'ok', service: 'rag-backend' });
})

app.get('/speech.mp3', (req, res) => {
    const tmpPath = path.join(os.tmpdir(), 'speech.mp3');
    const localPath = path.resolve('speech.mp3');
    const filePath = existsSync(tmpPath) ? tmpPath : (existsSync(localPath) ? localPath : null);

    if (req.headers.origin) {
        res.setHeader('Access-Control-Allow-Origin', req.headers.origin);
    } else {
        res.setHeader('Access-Control-Allow-Origin', '*');
    }
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    res.setHeader('Content-Type', 'audio/mpeg');

    if (filePath) {
        res.sendFile(filePath, { headers: { 'Content-Type': 'audio/mpeg' } });
    } else {
        res.status(404).json({ error: 'Speech audio not found' });
    }
});

app.use(express.static(path.resolve('.')));


// app.post('/chat', async (req, res) => {
//     try {
//         const { userQuery } = req.body;
//         if (!userQuery) {
//             return res.status(400).json({ error: 'userQuery is required' });
//         }

//         const answer = await sendQueryToGroqLLM(userQuery);

//         // Fire-and-forget: voice generation runs in background so the text
//         // response is returned immediately without hitting Render's request
//         // timeout. Translation + TTS can take 5-15 s; the frontend polls with
//         // retries (see useSpeechSynthesis.js) and plays once ready.
//         generatePkVoice(answer).catch(err =>
//             console.error('Background generatePkVoice() failed:', err.message)
//         );

//         res.status(200).json({ answer });
//     } catch (error) {
//         console.error("Error in /chat endpoint:", error);
//         res.status(500).json({ error: 'Internal Server Error', details: error.message });
//     }
// });




app.post('/chat', async (req, res) => {
    try {
        const { userQuery } = req.body;
        if (!userQuery) {
            return res.status(400).json({ error: 'userQuery is required' });
        }

        const answer = await sendQueryToGroqLLM(userQuery);
        const audioId = Date.now().toString();

        try {
            await generatePkVoice(answer, audioId);
        } catch (ttsErr) {
            console.error('generatePkVoice() failed (text response will still be sent):', ttsErr.message);
        }

        // Return the answer text and unique audioId (audio file is already on disk)
        return res.status(200).json({ answer, audioId });
    } catch (error) {
        console.error("Error in /chat endpoint:", error);
        return res.status(500).json({ error: 'Internal Server Error', details: error.message });
    }
});

// Dynamic Audio Endpoint with 404 Pending Handling
app.get('/speech/:id.mp3', (req, res) => {
    const audioId = req.params.id;
    const tmpPath = path.join(os.tmpdir(), `speech_${audioId}.mp3`);

    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Credentials', 'true');

    if (existsSync(tmpPath)) {
        res.setHeader('Content-Type', 'audio/mpeg');
        return res.sendFile(tmpPath);
    } else {
        return res.status(404).json({ error: 'Audio file still generating', status: 'pending' });
    }
});


// Voice session endpoint — WS is already wired at startup via registerRealtimeWSS()
// This endpoint exists so the frontend can optionally signal before connecting
app.post('/voice/start-session', async (req, res) => {
    res.status(200).json({ status: 'ok', message: 'Connect to WS to start voice session' });
});

// Start server

server.listen(port, () => {
    console.log(`AKUH RAG Server Running on: http://localhost:${port}`);
});



