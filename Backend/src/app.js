import express from "express";
import dotenv from "dotenv";
import cors from "cors";
import cookieParser from "cookie-parser";
import connectDB from "./Config/dbConfig.js";
import authRoutes from "./Routes/auth.route.js";

const app = express();

dotenv.config();

const port = process.env.PORT || 8000;

app.use(express.json());
app.use(cookieParser());

// app.use(cors({
//     origin:"http://localhost:5173",
//     methods: ["GET", "POST", "PUT", "DELETE"],
//     credentials:true,
//     allowedHeaders: ["Content-Type", "Authorization"]
// }));


connectDB();

app.get('/', (req, res) => {
    res.send('Welcome');
})



app.listen(port, () => {
    console.log(`Server Running on: http://localhost:${port}`);
    
})