import Groq from "groq-sdk";
import { writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { translate } from "free-translate";
import { queryChroma } from '../Pipes/QueryPipeline.js';
import dotenv from 'dotenv';
dotenv.config();

// export const generatePkVoice = async (textMsgToConvert) => {
//     try {
//         // Translate from English ('en') to Urdu ('ur')
//         const translatedText = await translate(textMsgToConvert, { from: 'en', to: 'ur' });

//         const res = await fetch("https://api.upliftai.org/v1/synthesis/text-to-speech", {
//             method: "POST",
//             headers: {
//                 Authorization: `Bearer ${process.env.UPLIFT_API}`,
//                 "Content-Type": "application/json",
//             },
//             body: JSON.stringify({
//                 voiceId: "diabetologist",
//                 text: translatedText,
//                 outputFormat: "MP3_22050_128",
//             }),
//         });

//         if (!res.ok) {
//             throw new Error(`UpliftAI API error: ${res.status} ${res.statusText}`);
//         }

//         const audioBuffer = Buffer.from(await res.arrayBuffer());

//         // Use /tmp (writable on Render) instead of CWD (read-only in production)
//         const tmpDir = os.tmpdir();
//         await writeFile(path.join(tmpDir, "speech.mp3"), audioBuffer);
//         await writeFile(path.join(tmpDir, `speech${new Date().getTime()}.mp3`), audioBuffer);

//     } catch (error) {
//         console.log("Error in generatePkVoice():", error.message);
//     }
// }

export const generatePkVoice = async (textMsgToConvert, audioId) => {
    try {
        // Translate message text from English to Urdu
        const translatedText = await translate(textMsgToConvert, { from: 'en', to: 'ur' });
        const textToSynthesize = translatedText.text || translatedText;

        const res = await fetch("https://api.upliftai.org/v1/synthesis/text-to-speech", {
            method: "POST",
            headers: {
                Authorization: `Bearer ${process.env.UPLIFT_API}`,
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                voiceId: "diabetologist",
                text: textToSynthesize,
                outputFormat: "MP3_22050_128",
            }),
        });

        if (!res.ok) {
            throw new Error(`UpliftAI API error: ${res.status} ${res.statusText}`);
        }

        const audioBuffer = Buffer.from(await res.arrayBuffer());
        const tmpDir = os.tmpdir();

        // Save file uniquely using the provided audioId
        await writeFile(path.join(tmpDir, `speech_${audioId}.mp3`), audioBuffer);
    } catch (error) {
        console.error("Error in generatePkVoice():", error.message);
    }
};

export const sendQueryToGroqLLM = async (userQuery) => {

    const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

    // Step 1 — retrieve relevant chunks from ChromaDB
    const relevantChunks = await queryChroma(userQuery);

    // Step 2 — build context string from chunks
    const context = relevantChunks
        .map((chunk, idx) => `[Source ${idx + 1}]: ${chunk.text}`)
        .join('\n\n');

    // console.log("Context passed to LLM:\n", context);

    // Step 3 — send to Groq with context injected
    const response = await groq.chat.completions.create({
        model: "llama-3.1-8b-instant",
        temperature: 0.3,
        messages: [
            {
                role: "system",
                content: `- Role and Persona
You are a professional, empathetic, and polite AI Voice Receptionist for the **Aga Khan Hospital**. Your primary objective is to assist patients and visitors by answering inquiries regarding hospital services, departments, doctors, fees, and timings using strictly approved knowledge base sources, and to guide them through booking appointments.

- Core Behavioral Guidelines
1. Professional Demeanor: Communicate warmly, clearly, and politely, mimicking a professional hospital receptionist. 
2. Strict RAG Reliance: Answer hospital-related questions ONLY using the retrieved data context provided from the knowledge base. Never hardcode facts or generate information outside the knowledge base.
3. Medical Disclaimer Safety:
   - Never diagnose diseases.
   - Never prescribe medication.
   - Never provide medical advice.
   - If a user describes acute symptoms (e.g., severe chest pain, shortness of breath), immediately advise them to proceed to the Emergency Room.
4. Clarity and Simplicity: Use simple language. Avoid complex technical medical terminology unless absolutely necessary.
5. Handling Unknown Information: If the requested information does not exist in the knowledge base, politely inform the user that you do not have that specific information rather than guessing or making assumptions.

- Capabilities & Functions
* Hospital Information: Provide accurate details on hospital introduction, operational timings, emergency services, laboratory services, radiology services, pharmacy, insurance details, and parking facilities.
* Department & Doctor Lookup: Explain department overviews, available services, operating locations, and specific doctor profiles, specializations, consultation fees, and schedules.
* Contextual Conversation: Maintain context throughout the active session to resolve ambiguous references (e.g., understanding "the first one" or "that doctor" based on prior conversation turns).
* Appointment Booking Workflow: 
  - Assist users in booking appointments by collecting required parameters: Patient Name, Phone Number, Doctor/Department Name, Appointment Date, Appointment Time, and Purpose of Visit.
  - Ask targeted follow-up questions if any mandatory information is missing.
  - Always summarize and explicitly confirm all details with the user before triggering the backend function to create a Google Calendar event.
  - Inform the user clearly whether the appointment was successfully booked or if an error occurred.
HOSPITAL KNOWLEDGE BASE CONTEXT:
${context}`,
            },
            {
                role: "user",
                content: userQuery,
            },
        ],
    });

    // Step 4 — extract and return just the text answer
    const answer = response.choices[0].message.content;
    return answer;
};