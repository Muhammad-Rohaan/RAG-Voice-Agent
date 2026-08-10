import express from "express";
import dotenv from "dotenv";
import cors from "cors";
import cookieParser from "cookie-parser";
import connectDB from "./Config/dbConfig.js";
import authRoutes from "./Routes/auth.route.js";
import chatRoutes from "./Routes/chat.routes.js";
import axios from "axios";

const app = express();

dotenv.config();

const port = process.env.PORT || 5000;

const allowedOrigins = (process.env.FRONTEND_URL ?? "http://localhost:5173,http://localhost:8000,http://localhost:9000")
    .split(",")
    .map(origin => origin.trim())
    .filter(Boolean);

app.use(cors({
    origin: function (origin, callback) {
        if (!origin) return callback(null, true);
        if (allowedOrigins.indexOf(origin) !== -1 || process.env.NODE_ENV !== 'production') {
            callback(null, true);
        } else {
            callback(null, true);
        }
    },
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    credentials: true,
    allowedHeaders: ["Content-Type", "Authorization", "Accept", "X-Requested-With"]
}));

app.use(express.json());
app.use(cookieParser());

connectDB();

app.get('/', (req, res) => {
    res.send('Welcome to AKUH Backend API');
})

app.get('/health', (req, res) => {
    res.status(200).json({ status: 'ok', service: 'api-backend' });
})

app.get('/speech.mp3', async (req, res) => {
    let ragApiUrl = process.env.RAG_API_URL ?? "http://localhost:9000";
    if (!/^https?:\/\//i.test(ragApiUrl)) {
        const isPublic = ragApiUrl.includes('onrender.com') || ragApiUrl.includes('.');
        const isInternal = ragApiUrl.includes('akuh-rag-backend') || ragApiUrl.includes('rag_backend');
        if (isPublic && !isInternal) {
            ragApiUrl = `https://${ragApiUrl}`;
        } else {
            ragApiUrl = `http://${ragApiUrl}`;
        }
    }
    
    try {
        const response = await axios({
            method: 'get',
            url: `${ragApiUrl}/speech.mp3`,
            responseType: 'stream'
        });
        res.setHeader('Content-Type', 'audio/mpeg');
        response.data.pipe(res);
    } catch (err) {
        console.error("Error proxying static audio:", err.message);
        res.status(err.response?.status || 500).json({ error: "Failed to stream static audio", details: err.message });
    }
});

// Dynamic audio proxy — routes /speech/{audioId}.mp3 to RAG server
app.get('/speech/:id.mp3', async (req, res) => {
    let ragApiUrl = process.env.RAG_API_URL ?? "http://localhost:9000";
    if (!/^https?:\/\//i.test(ragApiUrl)) {
        const isPublic = ragApiUrl.includes('onrender.com') || ragApiUrl.includes('.');
        const isInternal = ragApiUrl.includes('akuh-rag-backend') || ragApiUrl.includes('rag_backend');
        if (isPublic && !isInternal) {
            ragApiUrl = `https://${ragApiUrl}`;
        } else {
            ragApiUrl = `http://${ragApiUrl}`;
        }
    }

    try {
        const response = await axios({
            method: 'get',
            url: `${ragApiUrl}/speech/${req.params.id}.mp3`,
            responseType: 'stream'
        });
        res.setHeader('Content-Type', 'audio/mpeg');
        response.data.pipe(res);
    } catch (err) {
        console.error("Error proxying audio:", err.message);
        res.status(err.response?.status || 500).json({ error: "Failed to stream audio", details: err.message });
    }
});

app.use('/auth', authRoutes);
app.use('/ai/', chatRoutes);



app.listen(port, () => {
    console.log(`Server Running on: http://localhost:${port}`);

})