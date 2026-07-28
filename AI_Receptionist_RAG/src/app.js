
import express from "express";
import dotenv from "dotenv";
import cors from "cors";
import { createChunks, loadDocs } from "./Controllers/rag.controller.js";
import { embedding } from "./DB/ingestionPipeline.js";
import { sendQueryToLLM } from "./Controllers/LLM.controller.js";


const app = express();

dotenv.config();

const port = process.env.PORT || 9000;

app.use(express.json());

const allowedOrigins = (process.env.BACKEND_URL || "http://localhost:5000,http://localhost:8000,http://localhost:5173")
    .split(",")
    .map(origin => origin.trim())
    .filter(Boolean);

app.use(cors({
    origin: function (origin, callback) {
        if (!origin) return callback(null, true);
        if (allowedOrigins.indexOf(origin) !== -1) {
            callback(null, true);
        } else {
            callback(null, true);
        }
    },
    methods: ["GET", "POST", "PUT", "DELETE"],
    credentials: true,
    allowedHeaders: ["Content-Type", "Authorization"]
}));


async function indexingPipeline() {
    const docs = await loadDocs();
    console.log(`DONE 1: Loaded ${docs.length} documents.`);

    const chunks = await createChunks(docs);
    console.log(`DONE 2: Created ${chunks.length} chunks.`);

    await embedding(chunks);
    console.log("DONE 3: All chunks stored in ChromaDB.");
}
// await indexingPipeline();  // for one time only

// const result = await sendQueryToLLM("What are the radiology operating hours?");
// console.log("\n── AI Receptionist Answer ──────────────────");
// console.log(result);
// console.log("────────────────────────────────────────────\n");


app.get('/', (req, res) => {
    res.send('Welcome to AKUH RAG Service');
})

app.get('/health', (req, res) => {
    res.status(200).json({ status: 'ok', service: 'rag-backend' });
})

app.post('/chat', async (req, res) => {
    try {
        const { userQuery } = req.body;
        if (!userQuery) {
            return res.status(400).json({ error: 'userQuery is required' });
        }
        const answer = await sendQueryToLLM(userQuery);
        res.status(200).json({ answer });
    } catch (error) {
        console.error("Error in /chat endpoint:", error);
        res.status(500).json({ error: 'Internal Server Error', details: error.message });
    }
});



app.listen(port, () => {
    console.log(`AKUH RAG Server Running on: http://localhost:${port}`);
    
})