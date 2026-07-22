import axios from 'axios';
import ChatModel from '../Models/chat.model.js';


export const chatWithAgent = async (req, res) => {
    try {
        const { userQuery } = req.body;

        if (!userQuery) {
            return res.status(400).json({ err: "userQuery is required" });
        }

        // The RAG service runs on port 9000
        const ragServiceResponse = await axios.post('http://localhost:9090/chat', {
            userQuery,
        });

        const agentResponse = ragServiceResponse.data.answer;

        const chat = new ChatModel({
            message: agentResponse
        });

        await chat.save();

        res.status(201).json(chat);

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
        const allMsgs = await ChatModel.find({});
        res.status(200).json(allMsgs)
    } catch (error) {
        console.error("Error in getAllMessages():", error);
        res.status(500).json({
            err: `Error in getAllMessages(): ${error.message}`
        });
    }
}
