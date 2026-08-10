import express from "express";
import dotenv from "dotenv";
import cors from "cors";
import http from "http";
import path from "path";
import { WebSocketServer } from "ws";

import {
    createChunks,
    loadDocs,
} from "./Controllers/RAG.controller.js";

import {
    generatePkVoice,
    sendQueryToGroqLLM,
} from "./Controllers/GroqLLM.controller.js";

import { embedding } from "./Pipes/IngestionPipeline.js";

import {
    startVoiceAgentSession,
    registerRealtimeVoiceAgent,
} from "./Controllers/RealTimeVoiceAgent.controller.js";

dotenv.config();

const app = express();

const PORT = Number(process.env.PORT || 9000);

/*
|--------------------------------------------------------------------------
| HTTP server
|--------------------------------------------------------------------------
*/

const server = http.createServer(app);

/*
|--------------------------------------------------------------------------
| WebSocket server
|--------------------------------------------------------------------------
*/

export const wss = new WebSocketServer({
    server,
});

/*
|--------------------------------------------------------------------------
| Middleware
|--------------------------------------------------------------------------
*/

app.use(express.json());

app.use(
    express.static(path.resolve("."))
);

const allowedOrigins = (
    process.env.BACKEND_URL ||
    "http://localhost:5173,http://localhost:8000,http://localhost:5000"
)
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);

app.use(
    cors({
        origin: function (origin, callback) {
            /*
            |--------------------------------------------------------------------------
            | Allow requests without an Origin header
            |--------------------------------------------------------------------------
            */

            if (!origin) {
                return callback(null, true);
            }

            /*
            |--------------------------------------------------------------------------
            | Development-friendly CORS
            |--------------------------------------------------------------------------
            */

            if (allowedOrigins.includes(origin)) {
                return callback(null, true);
            }

            /*
            |--------------------------------------------------------------------------
            | Keep development flexible
            |--------------------------------------------------------------------------
            */

            return callback(null, true);
        },

        methods: [
            "GET",
            "POST",
            "PUT",
            "DELETE",
            "OPTIONS",
        ],

        credentials: true,

        allowedHeaders: [
            "Content-Type",
            "Authorization",
        ],
    })
);

/*
|--------------------------------------------------------------------------
| RAG indexing pipeline
|--------------------------------------------------------------------------
*/

async function indexingPipeline() {
    try {
        const docs = await loadDocs();

        console.log(
            `DONE 1: Loaded ${docs.length} documents.`
        );

        const chunks = await createChunks(docs);

        console.log(
            `DONE 2: Created ${chunks.length} chunks.`
        );

        await embedding(chunks);

        console.log(
            "DONE 3: All chunks stored in ChromaDB."
        );
    } catch (error) {
        console.error(
            "❌ Indexing pipeline failed:",
            error
        );
    }
}

/*
|--------------------------------------------------------------------------
| DO NOT automatically run indexing every server restart.
|--------------------------------------------------------------------------
|
| Run it manually once when your documents change.
|
*/

// await indexingPipeline();

/*
|--------------------------------------------------------------------------
| Register Realtime Voice Agent
|--------------------------------------------------------------------------
|
| IMPORTANT:
| Register this exactly once when the server starts.
|
*/

registerRealtimeVoiceAgent(wss);

/*
|--------------------------------------------------------------------------
| Health
|--------------------------------------------------------------------------
*/

app.get("/", (req, res) => {
    res.send("Welcome to AKUH RAG Service");
});

app.get("/health", (req, res) => {
    res.status(200).json({
        status: "ok",
        service: "rag-backend",
        realtime: "enabled",
    });
});

/*
|--------------------------------------------------------------------------
| Speech MP3
|--------------------------------------------------------------------------
*/

app.get("/speech.mp3", (req, res) => {
    res.sendFile(
        path.resolve("speech.mp3"),
        {
            headers: {
                "Content-Type": "audio/mpeg",
            },
        }
    );
});

/*
|--------------------------------------------------------------------------
| Normal text chat
|--------------------------------------------------------------------------
*/

app.post("/chat", async (req, res) => {
    try {
        const { userQuery } = req.body;

        if (
            !userQuery ||
            typeof userQuery !== "string" ||
            !userQuery.trim()
        ) {
            return res.status(400).json({
                error: "userQuery is required",
            });
        }

        const answer = await sendQueryToGroqLLM(
            userQuery.trim()
        );

        /*
        |--------------------------------------------------------------------------
        | Optional Pakistan voice generation
        |--------------------------------------------------------------------------
        */

        try {
            await generatePkVoice(answer);
        } catch (voiceError) {
            console.error(
                "⚠️ PK voice generation failed:",
                voiceError.message
            );
        }

        return res.status(200).json({
            answer,
        });
    } catch (error) {
        console.error(
            "❌ Error in /chat endpoint:",
            error
        );

        return res.status(500).json({
            error: "Internal Server Error",
            details: error.message,
        });
    }
});

/*
|--------------------------------------------------------------------------
| Voice session initialization
|--------------------------------------------------------------------------
|
| This endpoint is kept for compatibility with your existing frontend.
|
| IMPORTANT:
| Actual ChromaDB retrieval for voice happens after OpenAI transcribes
| the user's spoken question.
|
*/

app.post(
    "/voice/start-session",
    async (req, res) => {
        try {
            const result =
                await startVoiceAgentSession(
                    req.body?.userQuery
                );

            return res.status(200).json({
                answer:
                    result || "Voice session initialized",
            });
        } catch (error) {
            console.error(
                "❌ Error in /voice/start-session:",
                error
            );

            return res.status(500).json({
                error: "Internal Server Error",
                details: error.message,
            });
        }
    }
);

/*
|--------------------------------------------------------------------------
| Start server
|--------------------------------------------------------------------------
*/

server.listen(PORT, () => {
    console.log("");
    console.log(
        "================================================"
    );
    console.log(
        `🚀 AKUH RAG Server Running on http://localhost:${PORT}`
    );
    console.log(
        `🎙️ Realtime WS Running on ws://localhost:${PORT}`
    );
    console.log(
        `🤖 Realtime Model: ${process.env.OPENAI_REALTIME_MODEL ||
        "gpt-realtime-2.1"
        }`
    );
    console.log(
        `🔊 Realtime Voice: ${process.env.OPENAI_REALTIME_VOICE ||
        "marin"
        }`
    );
    console.log(
        "================================================"
    );
    console.log("");
});