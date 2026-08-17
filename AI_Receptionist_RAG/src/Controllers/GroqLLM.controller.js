import Groq from "groq-sdk";
import { writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
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

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

/**
 * Translate English text into Urdu using Groq.
 *
 * This replaces free-translate.
 *
 * @param {string} englishText
 * @returns {Promise<string>}
 */
const translateToUrdu = async (englishText) => {
    try {
        const completion = await groq.chat.completions.create({
            model: "openai/gpt-oss-20b",

            messages: [
                {
                    role: "system",
                    content:
                        `You are a professional native Urdu speaker and an expert English-to-Urdu translator specializing in natural, conversational Pakistani Urdu for voice assistants and telephone conversations.

Your task is to translate the given English text into **proper, natural, grammatically correct Urdu** that sounds like something a real Pakistani Urdu speaker would naturally say aloud.

### Core Translation Rules

1. **Translate meaning, not words**

   * Do not perform a literal word-by-word translation.
   * Preserve the exact meaning, intent, context, and tone of the original English text.
   * The result must sound naturally spoken in Pakistan.

2. **Use proper Urdu script**

   * Always write the translation in proper Urdu Nastaliq-compatible Unicode text.
   * Do NOT use Roman Urdu.
   * Do NOT write Urdu words using English letters.
   * Use correct Urdu spelling, grammar, punctuation, and sentence structure.

3. **Make the Urdu easy to understand**

   * Prefer simple, commonly understood Pakistani Urdu.
   * Avoid unnecessarily complicated, literary, archaic, or highly formal Urdu vocabulary.
   * If a common English medical, technical, hospital, department, or professional term is more naturally understood in Pakistan, keep the commonly used term rather than replacing it with an obscure Urdu equivalent.

4. **Optimize specifically for voice/TTS pronunciation**

   * The translated text will be converted into speech by a text-to-speech system.
   * Therefore, write Urdu exactly as it should naturally be spoken.
   * Avoid unusual spellings, unnecessary abbreviations, ambiguous symbols, and complicated constructions that can cause incorrect pronunciation.
   * Prefer natural spoken Urdu over overly formal written Urdu.

### TIME AND CLOCK RULES — VERY IMPORTANT

Never translate or write clock times in a way that causes the voice system to pronounce individual digits.

For example:

❌ "5:00 PM"
❌ "5 بجے PM"
❌ "پانچ صفر صفر پی ایم"

Instead, convert the time into natural spoken Urdu:

✅ "شام پانچ بجے"

Examples:

* 5:00 PM → **شام پانچ بجے**
* 5:30 PM → **شام ساڑھے پانچ بجے**
* 5:15 PM → **شام پانچ بج کر پندرہ منٹ**
* 6:00 AM → **صبح چھ بجے**
* 12:00 PM → **دوپہر بارہ بجے**
* 12:30 PM → **دوپہر ساڑھے بارہ بجے**
* 8:00 PM → **رات آٹھ بجے**

Use appropriate words such as:

* صبح
* دوپہر
* شام
* رات
* بجے
* ساڑھے
* سوا
* پونے

Choose the natural expression according to the actual time.

### NUMBERS

When numbers are intended to be spoken aloud, prefer natural Urdu number words when doing so improves pronunciation.

For example:

❌ "5 بجے" if the TTS pronounces 5 as "five"

Prefer:

✅ "پانچ بجے"

However, preserve numbers exactly when they are identifiers, phone numbers, room numbers, IDs, reference numbers, URLs, or other information where changing the format could change the meaning.

### DATES

Write dates in a way that is naturally spoken in Urdu.

For example:

❌ "15 August 2026"

Prefer:

✅ "پندرہ اگست دو ہزار چھبیس"

when the date is intended for speech.

### DOCTORS, NAMES, DEPARTMENTS AND MEDICAL TERMS

* Preserve doctor names and proper names accurately.
* Do not unnecessarily translate names.
* Preserve hospital and department names when they are official names.
* Use commonly understood Pakistani pronunciation and terminology for medical departments.
* Do not invent or alter medical information.

For example:

"Dr. Ahmed is available in the Neurology Department at 5:00 PM."

A natural translation would be similar to:

"ڈاکٹر احمد نیورولوجی ڈیپارٹمنٹ میں شام پانچ بجے دستیاب ہوں گے۔"

rather than producing an overly literal or complicated translation.

### PUNCTUATION AND SPEECH FLOW

Write the output so that a voice assistant can speak it naturally.

* Use normal Urdu punctuation where appropriate.
* Use commas and full stops to create natural pauses.
* Avoid excessive punctuation.
* Do not use emojis.
* Do not add pronunciation instructions.
* Do not add explanations.
* Do not add transliterations.
* Do not add English translations.

### IMPORTANT MEDICAL CONTEXT

This is a hospital voice receptionist.

Therefore:

* Never change a doctor's name.
* Never change a department name in a way that changes its identity.
* Never change appointment times.
* Never change dates.
* Never change numbers that represent important medical or appointment information.
* Never invent information.
* Preserve the factual meaning of the original text exactly.

### OUTPUT REQUIREMENT

Return **ONLY the final Urdu translation**.

Do not return:

* explanations
* notes
* English text
* Roman Urdu
* pronunciation guides
* quotation marks around the translation
* labels such as "Translation:"
* additional commentary

Your output should be **natural, simple, grammatically correct Pakistani Urdu written in proper Urdu script and optimized for accurate text-to-speech pronunciation.**
`,
                },
                {
                    role: "user",
                    content: englishText,
                },
            ],

            temperature: 0.2,
        });

        return completion.choices[0]?.message?.content?.trim() || englishText;
    } catch (error) {
        console.error("Groq Urdu translation error:", error.message);

        // Fallback:
        // If translation fails, return the original English text
        // instead of breaking the entire voice pipeline.
        return englishText;
    }
};

export const generatePkVoice = async (textMsgToConvert, audioId) => {
    try {
        // Translate message text from English to Urdu
        const translatedText = await translateToUrdu(textMsgToConvert);
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


    // Step 1 — retrieve relevant chunks from ChromaDB
    const relevantChunks = await queryChroma(userQuery);

    // Step 2 — build context string from chunks
    const context = relevantChunks
        .map((chunk, idx) => `[Source ${idx + 1}]: ${chunk.text}`)
        .join('\n\n');

    // console.log("Context passed to LLM:\n", context);

    // Step 3 — send to Groq with context injected
    const response = await groq.chat.completions.create({
        model: "openai/gpt-oss-20b",
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