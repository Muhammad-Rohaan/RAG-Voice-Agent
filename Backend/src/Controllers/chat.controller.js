import axios from 'axios';
import ChatModel from '../Models/chat.model.js';


export const chatWithAgent = async (req, res) => {
    try {
        const { userQuery } = req.body;

        if (!userQuery) {
            return res.status(400).json({ err: "userQuery is required" });
        }

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

        const ragServiceResponse = await axios.post(`${ragApiUrl}/chat`, {
            userQuery,
        }, {
            timeout: 60000,
        });

        const agentResponse = ragServiceResponse.data.answer;
        const audioId = ragServiceResponse.data.audioId;

        const chat = new ChatModel({
            userId: req.user?.id,
            message: agentResponse,
            userMessage: userQuery
        });

        await chat.save();

        const proto = req.headers['x-forwarded-proto'] || req.protocol;
        const host = req.get('host');
        const audioUrl = audioId 
            ? `${proto}://${host}/speech/${audioId}.mp3` 
            : `${proto}://${host}/speech.mp3`;

        res.status(201).json({
            _id: chat._id,
            message: agentResponse,
            userMessage: userQuery,
            audioUrl: audioUrl,
            createdAt: chat.createdAt
        });

    } catch (error) {
        console.error("Error in chatWithAgent():", error);
        const errorMessage = error.response?.data?.error || error.message;
        res.status(500).json({
            err: `Error in chatWithAgent(): ${errorMessage}`
        });
    }
}


export const getAllMessages = async (req, res) => {
    try {
        const query = req.user?.id ? { userId: req.user.id } : {};
        const allMsgs = await ChatModel.find(query).sort({ createdAt: 1 });
        res.status(200).json(allMsgs)
    } catch (error) {
        console.error("Error in getAllMessages():", error);
        res.status(500).json({
            err: `Error in getAllMessages(): ${error.message}`
        });
    }
}


export const talkWithAgent = async (req, res) => {
    try {
        const { userQuery } = req.body;

        const queryToSend = (userQuery && typeof userQuery === 'string' && userQuery.trim())
            ? userQuery.trim()
            : "Aga Khan Hospital departments doctors timings fees";

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
        const ragServiceResponse = await axios.post(`${ragApiUrl}/voice/start-session`, {
            userQuery: queryToSend,
        }, {
            timeout: 60000,
        });

        const agentResponse = ragServiceResponse.data?.answer || "Voice session initialized";

        res.status(200).json({
            message: agentResponse,
            userMessage: userQuery
        });

    } catch (error) {
        console.error("Error in talkWithAgent():", error);
        const errorMessage = error.response?.data?.error || error.message;
        res.status(500).json({
            err: `Error in talkWithAgent(): ${errorMessage}`
        });
    }
}
