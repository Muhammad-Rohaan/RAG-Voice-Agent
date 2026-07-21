import express from "express";
import dotenv from "dotenv";
import cors from "cors";
import { createChunks, loadDocs } from "./Controllers/rag.controller.js";
import { embedding } from "./Config/vectorDbConfig.js";


const app = express();

dotenv.config();

const port = process.env.PORT || 9000;

app.use(express.json());


// app.use(cors({
//     origin:"http://localhost:5173",
//     methods: ["GET", "POST", "PUT", "DELETE"],
//     credentials:true,
//     allowedHeaders: ["Content-Type", "Authorization"]
// }));


async function indexingPipeline() {
    const docs = await loadDocs();
    console.log(`DONE 1: Loaded ${docs.length} documents.`);

    const chunks = await createChunks(docs);
    console.log(`DONE 2: Created ${chunks.length} chunks.`);

    await embedding(chunks);
    console.log("DONE 3: All chunks stored in ChromaDB.");
}
await indexingPipeline();



app.get('/', (req, res) => {
    res.send('Welcome');
})



app.listen(port, () => {
    console.log(`AKUH RAG Server Running on: http://localhost:${port}`);
    
})