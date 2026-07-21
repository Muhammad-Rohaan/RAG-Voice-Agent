// testEmbedding.js - test batch embedding specifically
import { GoogleGenerativeAIEmbeddings } from '@langchain/google-genai';
import dotenv from 'dotenv';
dotenv.config();

const embedder = new GoogleGenerativeAIEmbeddings({
    apiKey: process.env.GOOGLE_API_KEY,
    model: 'gemini-embedding-2-preview',
});

// Test single
const single = await embedder.embedQuery("test hospital query");
console.log("embedQuery length:", single.length);

// Test batch (this is what was returning empty)
const batch = await embedder.embedDocuments(["test one", "test two"]);
console.log("embedDocuments count:", batch.length);
console.log("embedDocuments[0] length:", batch[0]?.length);