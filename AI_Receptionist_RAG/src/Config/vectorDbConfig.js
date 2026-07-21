import { ChromaClient } from 'chromadb';
import { embeddingModel } from '../Utils/embeddingModel.js';
import dotenv from 'dotenv';
dotenv.config();

// Connect to ChromaDB Cloud
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

// INDEXING
export const embedding = async (chunks) => {
    if (!chunks || chunks.length === 0) {
        console.log("No chunks to embed. Skipping.");
        return;
    }

    console.log(`Starting embedding of ${chunks.length} chunks...`);

    const client = getChromaClient();

    // Get or create collection
    const collection = await client.getOrCreateCollection({
        name: process.env.CHROMA_COLLECTION_NAME,
        metadata: {
            "hnsw:space": "cosine"
        },
        embeddingFunction: null,
    });

    console.log(`Collection ready: ${collection.name}`);

    // Process in batches to respect Gemini rate limits
    const BATCH_SIZE = 5;

    for (let i = 0; i < chunks.length; i += BATCH_SIZE) {
        const batch = chunks.slice(i, i + BATCH_SIZE);
        console.log(`\nProcessing batch ${Math.floor(i / BATCH_SIZE) + 1} of ${Math.ceil(chunks.length / BATCH_SIZE)}...`);

        // Step 1 — extract text from chunks
        const texts = batch.map(chunk => chunk.pageContent);

        // Step 2 — generate embeddings using Gemini
        const vectors = [];
        for (let j = 0; j < texts.length; j++) {
            const vector = await embeddingModel.embedQuery(texts[j]);
            console.log(`  Chunk ${i + j} embedded — vector length: ${vector.length}`);
            vectors.push(Array.from(vector)); // force plain JS array
            await new Promise(resolve => setTimeout(resolve, 500)); // rate limit
        }

        // Step 3 — prepare records for ChromaDB
        const ids = batch.map((_, idx) => `chunk-${i + idx}-${Date.now()}`);
        const metadatas = batch.map(chunk => ({
            source: chunk.metadata?.source || 'unknown',
            text: chunk.pageContent.slice(0, 512), // store preview in metadata
        }));

        // Step 4 — upsert into ChromaDB
        await collection.upsert({
            ids,
            embeddings: vectors,
            documents: texts,   // full text stored here
            metadatas,
        });

        console.log(`  Batch ${Math.floor(i / BATCH_SIZE) + 1} upserted successfully.`);

        // Delay between batches
        await new Promise(resolve => setTimeout(resolve, 2000));
    }

    console.log(`\nAll ${chunks.length} chunks stored in ChromaDB successfully.`);
};


// // ── QUERYING — retrieve relevant chunks for a user question ────────
// export const queryChroma = async (userQuestion, topK = 5) => {
//     console.log(`Querying ChromaDB for: "${userQuestion}"`);

//     const client = getChromaClient();

//     const collection = await client.getCollection({
//         name: process.env.CHROMA_COLLECTION_NAME || 'akuh_knowledge_base',
//     });

//     // Embed the user question using RETRIEVAL_QUERY task type
//     const { queryEmbeddingModel } = await import('../Utils/embeddingModel.js');
//     const queryVector = await queryEmbeddingModel.embedQuery(userQuestion);

//     // Search ChromaDB for similar chunks
//     const results = await collection.query({
//         queryEmbeddings: [Array.from(queryVector)],
//         nResults: topK,
//         include: ['documents', 'metadatas', 'distances'],
//     });

//     // Format results
//     const relevantChunks = results.documents[0].map((doc, idx) => ({
//         text: doc,
//         source: results.metadatas[0][idx]?.source || 'unknown',
//         score: results.distances[0][idx],
//     }));

//     console.log(`Found ${relevantChunks.length} relevant chunks.`);
//     return relevantChunks;
// };