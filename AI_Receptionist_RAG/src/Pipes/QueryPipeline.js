import { ChromaClient } from 'chromadb';
import { queryEmbeddingModel } from '../Utils/EmbeddingModel.js'; // RETRIEVAL_QUERY
import dotenv from 'dotenv';
dotenv.config();

const getChromaClient = () => {
    return new ChromaClient({
        host: process.env.CHROMA_HOST,
        ssl: true,
        headers: {
            "x-chroma-token": process.env.CHROMA_API_KEY,
        },
        tenant: process.env.CHROMA_TENANT,
        database: process.env.CHROMA_DATABASE,
    });
};

export const queryChroma = async (userQuestion, topK = 3) => {

    const client = getChromaClient();
    console.log(`Querying ChromaDB for: "${userQuestion}"`);

    const collection = await client.getCollection({
        name: process.env.CHROMA_COLLECTION_NAME,
    });

    // Use RETRIEVAL_QUERY task type for user questions
    const queryVector = await queryEmbeddingModel.embedQuery(userQuestion);

    const results = await collection.query({
        queryEmbeddings: [Array.from(queryVector)],
        nResults: topK,
        include: ['documents', 'metadatas', 'distances'],
    });

    const relevantChunks = results.documents[0].map((doc, idx) => ({
        text: doc,
        source: results.metadatas[0][idx]?.source || 'unknown',
        score: results.distances[0][idx],
    }));

    console.log(`Found ${relevantChunks.length} relevant chunks.`);
    return relevantChunks;
};