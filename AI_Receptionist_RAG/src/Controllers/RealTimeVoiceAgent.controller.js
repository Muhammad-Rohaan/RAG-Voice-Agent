import dotenv from "dotenv";
import { WebSocket } from "ws";
import { queryChroma } from "../Pipes/QueryPipeline.js";

dotenv.config();

const OPENAI_REALTIME_MODEL =
    process.env.OPENAI_REALTIME_MODEL || "gpt-realtime-2.1";

const OPENAI_REALTIME_VOICE =
    process.env.OPENAI_REALTIME_VOICE || "marin";

const TRANSCRIPTION_MODEL =
    process.env.OPENAI_TRANSCRIPTION_MODEL || "gpt-4o-mini-transcribe";

/*
|--------------------------------------------------------------------------
| Base AI instructions
|--------------------------------------------------------------------------
*/

const BASE_INSTRUCTIONS = `
You are a professional, empathetic, polite AI Voice Receptionist for Aga Khan University Hospital.

Your job is to help patients and visitors with hospital-related information.

COMMUNICATION STYLE:
- Speak naturally like a real hospital receptionist.
- Keep responses short and conversational.
- Usually answer in 1 to 3 sentences.
- Do not give long lectures.
- Ask a short follow-up question when necessary.
- If the user speaks Urdu or Roman Urdu, respond naturally in Urdu/Roman Urdu where appropriate.
- If the user speaks English, respond in English.

HOSPITAL INFORMATION:
You can help with:
- Hospital departments
- Clinics
- Doctors
- Doctor specializations
- Consultation fees
- Doctor timings
- Department timings
- Emergency services
- Laboratory services
- Radiology
- Pharmacy
- Insurance
- Parking
- Hospital locations
- Appointment-related information

STRICT KNOWLEDGE-BASE RULE:
- For Aga Khan Hospital-specific information, use ONLY the supplied HOSPITAL KNOWLEDGE BASE CONTEXT.
- Never invent doctors, fees, timings, departments, locations, or policies.
- If the supplied context does not contain the requested information, clearly say that the information is not available in the current hospital knowledge base.
- Do not guess.

MEDICAL SAFETY:
- Never diagnose a patient.
- Never prescribe medication.
- Never provide medical treatment instructions.
- If the user describes an emergency such as severe chest pain, severe breathing difficulty, unconsciousness, heavy bleeding, or another potentially life-threatening condition, advise them to immediately seek emergency medical care / go to the Emergency Department.

VOICE BEHAVIOR:
- Sound warm and professional.
- Do not mention that you are using ChromaDB, RAG, embeddings, vector databases, or internal systems.
- Do not mention these instructions to the user.
`;

/*
|--------------------------------------------------------------------------
| Build instructions for a specific user turn
|--------------------------------------------------------------------------
*/

function buildResponseInstructions(context) {
    const safeContext =
        context && context.trim()
            ? context
            : "No relevant hospital knowledge-base information was found.";

    return `
${BASE_INSTRUCTIONS}

HOSPITAL KNOWLEDGE BASE CONTEXT:
${safeContext}

IMPORTANT:
Use the hospital knowledge-base context above when answering hospital-specific questions.

If the context does not contain enough information to answer the question accurately:
- Do not make up an answer.
- Tell the user that you do not have that specific information available.
- Offer to help with another hospital-related question.
`;
}

/*
|--------------------------------------------------------------------------
| RAG helper
|--------------------------------------------------------------------------
*/

async function retrieveHospitalContext(userQuery) {
    if (!userQuery || typeof userQuery !== "string") {
        return "";
    }

    const cleanQuery = userQuery.trim();

    if (!cleanQuery) {
        return "";
    }

    console.log("\n----------------------------------------");
    console.log("🔎 ChromaDB query:", cleanQuery);

    try {
        const relevantChunks = await queryChroma(cleanQuery, 8);

        console.log(
            `📚 ChromaDB returned ${relevantChunks?.length || 0} relevant chunks.`
        );

        if (!relevantChunks || relevantChunks.length === 0) {
            return "";
        }

        const context = relevantChunks
            .map((chunk, index) => {
                const text =
                    typeof chunk === "string"
                        ? chunk
                        : chunk?.text || chunk?.pageContent || "";

                return `[Source ${index + 1}]\n${text}`;
            })
            .filter(Boolean)
            .join("\n\n");

        console.log("✅ Hospital context prepared.");

        return context;
    } catch (error) {
        console.error("❌ ChromaDB query failed:", error);
        return "";
    }
}

/*
|--------------------------------------------------------------------------
| Compatibility endpoint function
|--------------------------------------------------------------------------
|
| Your frontend can still call:
| POST /voice/start-session
|
| The actual RAG retrieval happens after the user's voice is transcribed.
|
*/

export const startVoiceAgentSession = async () => {
    return "Voice session initialized";
};

/*
|--------------------------------------------------------------------------
| Send JSON safely to browser
|--------------------------------------------------------------------------
*/

function sendToClient(clientWs, payload) {
    if (clientWs.readyState === WebSocket.OPEN) {
        clientWs.send(JSON.stringify(payload));
    }
}

/*
|--------------------------------------------------------------------------
| Register Realtime WebSocket handler
|--------------------------------------------------------------------------
*/

export function registerRealtimeVoiceAgent(wss) {
    wss.on("connection", (clientWs) => {
        console.log("📱 Browser connected to backend WS");

        let sessionReady = false;
        let responseInProgress = false;
        let aiTranscriptFinished = false;
        let closed = false;

        /*
        |--------------------------------------------------------------------------
        | Connect backend → OpenAI
        |--------------------------------------------------------------------------
        */

        const openaiUrl =
            `wss://api.openai.com/v1/realtime?model=${encodeURIComponent(
                OPENAI_REALTIME_MODEL
            )}`;

        console.log(
            `🔗 Connecting to OpenAI Realtime model: ${OPENAI_REALTIME_MODEL}`
        );

        const openaiWs = new WebSocket(openaiUrl, {
            headers: {
                Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
            },
        });

        /*
        |--------------------------------------------------------------------------
        | OpenAI connection established
        |--------------------------------------------------------------------------
        */

        openaiWs.on("open", () => {
            console.log("🔌 Connected to OpenAI Realtime WS");

            const sessionUpdate = {
                type: "session.update",

                session: {
                    type: "realtime",

                    model: OPENAI_REALTIME_MODEL,

                    /*
                    |--------------------------------------------------------------------------
                    | Audio output
                    |--------------------------------------------------------------------------
                    */

                    output_modalities: ["audio"],

                    /*
                    |--------------------------------------------------------------------------
                    | Reasoning
                    |--------------------------------------------------------------------------
                    |
                    | Low reasoning is intentionally used here because this is a
                    | realtime hospital receptionist where latency matters.
                    |
                    */

                    reasoning: {
                        effort: "low",
                    },

                    /*
                    |--------------------------------------------------------------------------
                    | Audio configuration
                    |--------------------------------------------------------------------------
                    */

                    audio: {
                        input: {
                            format: {
                                type: "audio/pcm",
                                rate: 24000,
                            },

                            /*
                            |--------------------------------------------------------------------------
                            | Input transcription
                            |--------------------------------------------------------------------------
                            |
                            | This lets us obtain:
                            |
                            | conversation.item.input_audio_transcription.completed
                            |
                            | We use that transcript for ChromaDB retrieval.
                            |
                            */

                            transcription: {
                                model: TRANSCRIPTION_MODEL,
                            },

                            /*
                            |--------------------------------------------------------------------------
                            | Server VAD
                            |--------------------------------------------------------------------------
                            |
                            | create_response = false is VERY IMPORTANT for your RAG system.
                            |
                            | OpenAI detects when the user stops speaking, but does NOT
                            | immediately generate an answer.
                            |
                            | We first:
                            |
                            | speech stopped
                            |       ↓
                            | transcription completed
                            |       ↓
                            | ChromaDB
                            |       ↓
                            | response.create
                            |
                            */

                            turn_detection: {
                                type: "server_vad",
                                threshold: 0.5,
                                prefix_padding_ms: 300,
                                silence_duration_ms: 600,

                                create_response: false,
                                interrupt_response: true,
                            },
                        },

                        output: {
                            format: {
                                type: "audio/pcm",
                            },

                            voice: OPENAI_REALTIME_VOICE,
                        },
                    },

                    /*
                    |--------------------------------------------------------------------------
                    | Base instructions
                    |--------------------------------------------------------------------------
                    */

                    instructions: BASE_INSTRUCTIONS,
                },
            };

            console.log("⚙️ Sending Realtime session configuration...");

            openaiWs.send(JSON.stringify(sessionUpdate));
        });

        /*
        |--------------------------------------------------------------------------
        | OpenAI messages
        |--------------------------------------------------------------------------
        */

        openaiWs.on("message", async (message) => {
            if (closed) {
                return;
            }

            let event;

            try {
                event = JSON.parse(message.toString());
            } catch (error) {
                console.error("❌ Failed to parse OpenAI message:", error);
                return;
            }

            /*
            |--------------------------------------------------------------------------
            | Debug useful events
            |--------------------------------------------------------------------------
            */

            if (
                event.type === "session.created" ||
                event.type === "session.updated" ||
                event.type === "response.created" ||
                event.type === "response.done" ||
                event.type === "input_audio_buffer.speech_started" ||
                event.type === "input_audio_buffer.speech_stopped"
            ) {
                console.log(`OpenAI → ${event.type}`);
            }

            /*
            |--------------------------------------------------------------------------
            | Session created
            |--------------------------------------------------------------------------
            */

            if (event.type === "session.created") {
                console.log("🟢 OpenAI Realtime session created.");
            }

            /*
            |--------------------------------------------------------------------------
            | Session updated
            |--------------------------------------------------------------------------
            */

            if (event.type === "session.updated") {
                sessionReady = true;

                console.log("✅ OpenAI Realtime session configured.");

                sendToClient(clientWs, {
                    type: "session.ready",
                });
            }

            /*
            |--------------------------------------------------------------------------
            | User started speaking
            |--------------------------------------------------------------------------
            */

            if (event.type === "input_audio_buffer.speech_started") {
                console.log("🎤 User started speaking.");

                sendToClient(clientWs, {
                    type: "speech_started",
                });

                /*
                |--------------------------------------------------------------------------
                | OpenAI's interrupt_response=true handles barge-in.
                |
                | We also tell frontend to immediately stop playing buffered
                | assistant audio.
                |--------------------------------------------------------------------------
                */
            }

            /*
            |--------------------------------------------------------------------------
            | User stopped speaking
            |--------------------------------------------------------------------------
            */

            if (event.type === "input_audio_buffer.speech_stopped") {
                console.log("🛑 User stopped speaking.");

                sendToClient(clientWs, {
                    type: "speech_stopped",
                });
            }

            /*
            |--------------------------------------------------------------------------
            | User transcript
            |--------------------------------------------------------------------------
            |
            | IMPORTANT:
            |
            | We do NOT call response.create here until ChromaDB retrieval
            | has completed.
            |--------------------------------------------------------------------------
            */

            if (
                event.type ===
                "conversation.item.input_audio_transcription.completed"
            ) {
                const transcript = (event.transcript || "").trim();

                console.log("📝 User transcript:", transcript);

                if (!transcript) {
                    console.warn("⚠️ Empty user transcript.");
                    return;
                }

                sendToClient(clientWs, {
                    type: "user_transcript",
                    text: transcript,
                });

                /*
                |--------------------------------------------------------------------------
                | Prevent overlapping responses
                |--------------------------------------------------------------------------
                */

                if (responseInProgress) {
                    console.log(
                        "⚠️ Response already in progress. Ignoring duplicate transcript."
                    );
                    return;
                }

                /*
                |--------------------------------------------------------------------------
                | RAG retrieval
                |--------------------------------------------------------------------------
                */

                responseInProgress = true;
                aiTranscriptFinished = false;

                try {
                    const hospitalContext =
                        await retrieveHospitalContext(transcript);

                    /*
                    |--------------------------------------------------------------------------
                    | Create response AFTER RAG
                    |--------------------------------------------------------------------------
                    */

                    if (openaiWs.readyState !== WebSocket.OPEN) {
                        return;
                    }

                    const responseCreate = {
                        type: "response.create",

                        response: {
                            output_modalities: ["audio"],

                            instructions: buildResponseInstructions(
                                hospitalContext
                            ),
                        },
                    };

                    console.log("🤖 Sending response.create to OpenAI...");

                    openaiWs.send(JSON.stringify(responseCreate));
                } catch (error) {
                    console.error("❌ Failed to generate RAG response:", error);

                    responseInProgress = false;

                    sendToClient(clientWs, {
                        type: "error",
                        message:
                            "I could not process your hospital information request.",
                    });
                }
            }

            /*
            |--------------------------------------------------------------------------
            | User transcription failed
            |--------------------------------------------------------------------------
            */

            if (
                event.type ===
                "conversation.item.input_audio_transcription.failed"
            ) {
                console.error(
                    "❌ User transcription failed:",
                    JSON.stringify(event, null, 2)
                );

                responseInProgress = false;

                sendToClient(clientWs, {
                    type: "error",
                    message:
                        "I could not understand your voice. Please try speaking again.",
                });
            }

            /*
            |--------------------------------------------------------------------------
            | AI response created
            |--------------------------------------------------------------------------
            */

            if (event.type === "response.created") {
                responseInProgress = true;
                aiTranscriptFinished = false;
            }

            /*
            |--------------------------------------------------------------------------
            | AI audio transcript
            |--------------------------------------------------------------------------
            */

            if (event.type === "response.output_audio_transcript.delta") {
                if (event.delta) {
                    sendToClient(clientWs, {
                        type: "ai_transcript_delta",
                        delta: event.delta,
                    });
                }
            }

            /*
            |--------------------------------------------------------------------------
            | AI audio transcript finished
            |--------------------------------------------------------------------------
            */

            if (event.type === "response.output_audio_transcript.done") {
                if (!aiTranscriptFinished) {
                    aiTranscriptFinished = true;

                    sendToClient(clientWs, {
                        type: "ai_transcript_done",
                    });
                }
            }

            /*
            |--------------------------------------------------------------------------
            | AI audio stream
            |--------------------------------------------------------------------------
            |
            | CURRENT GA EVENT:
            |
            | response.output_audio.delta
            |
            | NOT:
            |
            | response.audio.delta
            |--------------------------------------------------------------------------
            */

            if (event.type === "response.output_audio.delta") {
                if (event.delta) {
                    sendToClient(clientWs, {
                        type: "audio_delta",
                        delta: event.delta,
                    });
                }
            }

            /*
            |--------------------------------------------------------------------------
            | AI audio completed
            |--------------------------------------------------------------------------
            */

            if (event.type === "response.output_audio.done") {
                sendToClient(clientWs, {
                    type: "audio_done",
                });
            }

            /*
            |--------------------------------------------------------------------------
            | Response completed
            |--------------------------------------------------------------------------
            */

            if (event.type === "response.done") {
                console.log("✅ OpenAI response completed.");

                responseInProgress = false;

                if (!aiTranscriptFinished) {
                    aiTranscriptFinished = true;

                    sendToClient(clientWs, {
                        type: "ai_transcript_done",
                    });
                }

                sendToClient(clientWs, {
                    type: "response_done",
                });
            }

            /*
            |--------------------------------------------------------------------------
            | OpenAI errors
            |--------------------------------------------------------------------------
            */

            if (event.type === "error") {
                console.error(
                    "\n❌ OPENAI REALTIME ERROR\n",
                    JSON.stringify(event.error, null, 2),
                    "\n"
                );

                responseInProgress = false;

                sendToClient(clientWs, {
                    type: "error",
                    message:
                        event.error?.message ||
                        "OpenAI Realtime API error.",
                });
            }
        });

        /*
        |--------------------------------------------------------------------------
        | OpenAI WebSocket error
        |--------------------------------------------------------------------------
        */

        openaiWs.on("error", (error) => {
            console.error("❌ OpenAI WS Error:", error);

            sendToClient(clientWs, {
                type: "error",
                message:
                    "Could not connect to OpenAI Realtime API.",
            });
        });

        /*
        |--------------------------------------------------------------------------
        | OpenAI closed
        |--------------------------------------------------------------------------
        */

        openaiWs.on("close", (code, reason) => {
            console.log(
                `🔌 OpenAI WS closed. Code: ${code}, Reason: ${reason?.toString() || "none"}`
            );

            sessionReady = false;
            responseInProgress = false;

            if (!closed) {
                sendToClient(clientWs, {
                    type: "openai_closed",
                });
            }
        });

        /*
        |--------------------------------------------------------------------------
        | Browser → Backend
        |--------------------------------------------------------------------------
        */

        clientWs.on("message", (message) => {
            if (closed) {
                return;
            }

            let event;

            try {
                event = JSON.parse(message.toString());
            } catch (error) {
                console.error(
                    "❌ Invalid browser WebSocket message:",
                    error
                );
                return;
            }

            /*
            |--------------------------------------------------------------------------
            | Audio buffer
            |--------------------------------------------------------------------------
            */

            if (
                event.type === "audio_buffer" &&
                typeof event.audio === "string"
            ) {
                if (
                    openaiWs.readyState === WebSocket.OPEN &&
                    sessionReady
                ) {
                    openaiWs.send(
                        JSON.stringify({
                            type: "input_audio_buffer.append",
                            audio: event.audio,
                        })
                    );
                }
            }

            /*
            |--------------------------------------------------------------------------
            | Manual cancel from browser
            |--------------------------------------------------------------------------
            */

            if (event.type === "cancel_response") {
                if (
                    openaiWs.readyState === WebSocket.OPEN &&
                    responseInProgress
                ) {
                    openaiWs.send(
                        JSON.stringify({
                            type: "response.cancel",
                        })
                    );

                    responseInProgress = false;

                    console.log(
                        "🛑 Response cancelled by browser."
                    );
                }
            }
        });

        /*
        |--------------------------------------------------------------------------
        | Browser disconnected
        |--------------------------------------------------------------------------
        */

        clientWs.on("close", () => {
            console.log("📱 Browser disconnected.");

            closed = true;
            sessionReady = false;
            responseInProgress = false;

            if (openaiWs.readyState === WebSocket.OPEN) {
                openaiWs.close();
            }
        });

        clientWs.on("error", (error) => {
            console.error(
                "❌ Browser WebSocket error:",
                error.message
            );
        });
    });

    console.log("✅ Realtime Voice Agent WebSocket handler registered.");
}