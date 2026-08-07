import express from "express";
import dotenv from "dotenv";
import cors from "cors";
import cookieParser from "cookie-parser";
import connectDB from "./Config/dbConfig.js";
import authRoutes from "./Routes/auth.route.js";
import chatRoutes from "./Routes/chat.routes.js";

const app = express();

dotenv.config();

const port = process.env.PORT || 5000;

app.use(express.json());
app.use(cookieParser());

const allowedOrigins = (process.env.FRONTEND_URL ?? "http://localhost:5173,http://localhost:8000")
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

connectDB();

app.get('/', (req, res) => {
    res.send('Welcome to AKUH Backend API');
})

app.get('/health', (req, res) => {
    res.status(200).json({ status: 'ok', service: 'api-backend' });
})

app.get('/speech.mp3', (req, res) => {
    let ragApiUrl = process.env.RAG_API_URL ?? "http://localhost:9000";
    if (!/^https?:\/\//i.test(ragApiUrl)) {
        ragApiUrl = `http://${ragApiUrl}`;
    }
    res.redirect(`${ragApiUrl}/speech.mp3`);
});

app.use('/auth', authRoutes);
app.use('/ai/', chatRoutes);



app.listen(port, () => {
    console.log(`Server Running on: http://localhost:${port}`);

})