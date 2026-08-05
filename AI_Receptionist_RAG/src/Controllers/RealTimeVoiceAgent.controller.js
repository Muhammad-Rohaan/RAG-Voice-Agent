import dotenv from "dotenv";
import { WebSocket } from "ws";
import { queryChroma } from '../Pipes/QueryPipeline.js';
import { wss } from "../app.js";

dotenv.config();

// OpenAI Realtime model name, configurable via environment variable
const OPENAI_REALTIME_MODEL = process.env.OPENAI_REALTIME_MODEL ?? "gpt-4o-realtime";

let latestContext = "";

export const startVoiceAgentSession = async (userQuery) => {
    try {
        const baseQuery = "Aga Khan Hospital departments dentistry dermatology emergency ent gastroenterology nephrology urology neurology ophthalmology orthopaedics psychiatry radiology doctors timings fees";
        const searchQuery = (userQuery && typeof userQuery === 'string' && userQuery.trim())
            ? `${userQuery.trim()} ${baseQuery}`
            : baseQuery;

        console.log("\n-----------------Search Query: ", searchQuery);

        const relevantChunks = await queryChroma(searchQuery, 10);

        latestContext = relevantChunks
            .map((chunk, idx) => `[Source ${idx + 1}]: ${chunk.text}`)
            .join('\n\n');

        return "Voice session initialized";
    } catch (error) {
        console.error("Error in startVoiceAgentSession():", error);
        const errorMessage = error.response?.data?.error || error.message;
        throw new Error(`Error in startVoiceAgentSession(): ${errorMessage}`);
    }
};

// Global WS connection handler - registered ONCE

wss.on("connection", (clientWs) => {
    console.log("📱 Browser connected to backend WS");

    const sendToClient = (payload) => {
        if (clientWs.readyState === WebSocket.OPEN) {
            clientWs.send(JSON.stringify(payload));
        }
    };

    // Open single WS to OpenAI Realtime API
    const openaiWs = new WebSocket(
        `wss://api.openai.com/v1/realtime?model=${OPENAI_REALTIME_MODEL}`,
        {
            headers: {
                Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
            },
        }
    );

    let sessionReady = false;

    openaiWs.on("open", () => {
        console.log("🔌 Connected to OpenAI Realtime WS");

        const sessionUpdate = {
            type: "session.update",
            session: {
                type: "realtime",
                instructions: `- Role and Persona
You are a professional, empathetic, and polite AI Voice Receptionist for the **Aga Khan Hospital**. Your primary objective is to assist patients and visitors by answering inquiries regarding hospital services, departments, doctors, fees, and timings using strictly approved knowledge base sources, and to guide them through booking appointments.

- Communication Style & Call Mannerisms
1. Speak naturally, warmly, and concisely like a real receptionist on a phone call.
2. Keep responses brief (1-3 sentences) so the user can easily respond without long monologues.
3. Use the provided HOSPITAL KNOWLEDGE BASE CONTEXT for all details on departments, doctors, fees, and timings.
4. If a user asks a general question or greeting, respond politely and assist them with Aga Khan Hospital services.

- Core Behavioral Guidelines
1. Professional Demeanor: Communicate warmly, clearly, and politely, mimicking a professional hospital receptionist. 
2. Strict RAG Reliance: Answer hospital-related questions ONLY using the retrieved data context provided from the knowledge base.
3. Medical Disclaimer Safety:
   - Never diagnose diseases.
   - Never prescribe medication.
   - Never provide medical advice.
   - If a user describes acute symptoms (e.g., severe chest pain, shortness of breath), immediately advise them to proceed to the Emergency Room.
4. Clarity and Simplicity: Use simple language. Avoid complex technical medical terminology unless absolutely necessary.

- Capabilities & Functions
* Hospital Information: Provide accurate details on hospital introduction, operational timings, emergency services, laboratory services, radiology services, pharmacy, insurance details, and parking facilities.
* Department & Doctor Lookup: Explain department overviews, available services, operating locations, and specific doctor profiles, specializations, consultation fees, and schedules.

HOSPITAL KNOWLEDGE BASE CONTEXT:
${latestContext}`,
                audio: {
                    input: {
                        format: { type: "audio/pcm", rate: 24000 },
                        transcription: { model: "whisper-1" },
                        turn_detection: {
                            type: "server_vad",
                            threshold: 0.6,
                            prefix_padding_ms: 300,
                            silence_duration_ms: 500
                        }
                    },
                    output: {
                        format: { type: "audio/pcm", rate: 24000 },
                        voice: "sage"
                    }
                }
            }
        };

        openaiWs.send(JSON.stringify(sessionUpdate));
    });

    openaiWs.on("message", (message) => {
        try {
            const event = JSON.parse(message.toString());

            if (event.type === "session.created" || event.type === "session.updated") {
                if (!sessionReady) {
                    sessionReady = true;
                    sendToClient({ type: "session.ready" });
                }
            }

            if (event.type === "input_audio_buffer.speech_started") {
                sendToClient({ type: "speech_started" });
                // Cancel the ongoing AI response so it stops sending audio chunks (barge-in)
                if (openaiWs.readyState === WebSocket.OPEN) {
                    openaiWs.send(JSON.stringify({ type: "response.cancel" }));
                    console.log("🛑 User interrupted – sent response.cancel to OpenAI");
                }
            }

            if (event.type === "conversation.item.input_audio_transcription.completed") {
                sendToClient({ type: "user_transcript", text: event.transcript });
            }

            // Stream AI text transcript - pick single exact event to prevent duplicate text
            if (event.type === "response.audio_transcript.delta" || (event.type === "response.output_audio_transcript.delta" && !event.response?.output?.[0]?.content?.[0]?.transcript)) {
                if (event.delta) {
                    sendToClient({ type: "ai_transcript_delta", delta: event.delta });
                }
            }

            // Stream AI audio PCM chunks - single exact event to prevent duplicate audio packets
            if (event.type === "response.output_audio.delta" || event.type === "response.audio.delta") {
                if (event.delta) {
                    sendToClient({ type: "audio_delta", delta: event.delta });
                }
            }

            if (event.type === "response.audio_transcript.done" || event.type === "response.output_audio_transcript.done") {
                sendToClient({ type: "ai_transcript_done" });
            }

            if (event.type === "error") {
                console.error("OpenAI Error:", JSON.stringify(event.error, null, 2));
                sendToClient({ type: "error", message: event.error?.message });
            }
        } catch (err) {
            console.error("Error parsing OpenAI WS message:", err);
        }
    });

    openaiWs.on("error", (err) => {
        console.error("OpenAI WS Error:", err.message);
        sendToClient({ type: "error", message: "Failed to connect to OpenAI." });
        clientWs.close();
    });

    clientWs.on("message", (message) => {
        try {
            const event = JSON.parse(message.toString());
            if (event.type === "audio_buffer" && openaiWs.readyState === WebSocket.OPEN) {
                openaiWs.send(JSON.stringify({
                    type: "input_audio_buffer.append",
                    audio: event.audio
                }));
            }
        } catch (err) {
            console.error("Error processing client WS message:", err);
        }
    });

    clientWs.on("close", () => {
        console.log("📱 Browser disconnected");
        if (openaiWs.readyState === WebSocket.OPEN) {
            openaiWs.close();
        }
    });
});