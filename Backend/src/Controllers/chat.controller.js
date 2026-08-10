import axios from 'axios';
import ChatModel from '../Models/chat.model.js';

/**
 * Helper to perform an axios POST with simple exponential backoff retry.
 * Retries on network errors or HTTP 5xx responses (including 502 Bad Gateway).
 * Returns the successful response or throws the last encountered error.
 */
async function axiosPostWithRetry(url, payload, { timeout = 60000, maxRetries = 3, baseDelayMs = 500 } = {}) {
    let lastError;
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
        try {
            const response = await axios.post(url, payload, { timeout });
            // If response is OK (2xx) return it
            return response;
        } catch (err) {
            lastError = err;
            // Retry on network errors or 5xx status codes
            const status = err.response?.status;
            const shouldRetry = !err.response || (status >= 500 && status < 600);
            if (!shouldRetry || attempt === maxRetries) {
                throw err; // rethrow if not retryable or out of attempts
            }
            const delay = Math.min(baseDelayMs * Math.pow(1.5, attempt), 3000);
            await new Promise(r => setTimeout(r, delay));
        }
    }
    throw lastError;
}
export const chatWithAgent = async (req, res) => {
    try {
        const { userQuery } = req.body;

        if (!userQuery) {
            return res.status(400).json({ err: "userQuery is required" });
        }

        let ragApiUrl = process.env.RAG_API_URL ?? "http://localhost:9000";
        if (!/^https?:\/\//i.test(ragApiUrl)) {
            ragApiUrl = (ragApiUrl.includes('localhost') || ragApiUrl.includes('127.0.0.1'))
                ? `http://${ragApiUrl}`
                : `https://${ragApiUrl}`;
        }

        const ragServiceResponse = await axiosPostWithRetry(`${ragApiUrl}/chat`, { userQuery }, { timeout: 60000, maxRetries: 3 });

        const agentResponse = ragServiceResponse.data.answer;
        const audioId = ragServiceResponse.data.audioId;

        const chat = new ChatModel({
            userId: req.user?.id,
            message: agentResponse,
            userMessage: userQuery
        });

        await chat.save();

        res.status(201).json({
            _id: chat._id,
            message: agentResponse,
            userMessage: userQuery,
            audioUrl: audioId ? `${ragApiUrl}/speech/${audioId}.mp3` : `${ragApiUrl}/speech.mp3`,
            createdAt: chat.createdAt
        });

    } catch (error) {
        console.error("Error in chatWithAgent():", error);
        const status = error.response?.status;
        let friendlyMessage = error.message;
        if (status === 502) {
            friendlyMessage = "RAG service is temporarily unavailable (Bad Gateway). Please try again later.";
        } else if (status >= 500) {
            friendlyMessage = "RAG service encountered an error. Please retry later.";
        }
        res.status(500).json({
            err: `Error in chatWithAgent(): ${friendlyMessage}`
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
            ragApiUrl = (ragApiUrl.includes('localhost') || ragApiUrl.includes('127.0.0.1'))
                ? `http://${ragApiUrl}`
                : `https://${ragApiUrl}`;
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
