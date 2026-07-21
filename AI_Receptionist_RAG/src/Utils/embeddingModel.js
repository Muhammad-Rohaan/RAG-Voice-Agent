import { GoogleGenerativeAIEmbeddings } from '@langchain/google-genai';
import dotenv from 'dotenv';
dotenv.config();

// For indexing PDFs
export const embeddingModel = new GoogleGenerativeAIEmbeddings({
    apiKey: process.env.GOOGLE_API_KEY,
    model: 'gemini-embedding-2-preview',
    taskType: 'RETRIEVAL_DOCUMENT',
});