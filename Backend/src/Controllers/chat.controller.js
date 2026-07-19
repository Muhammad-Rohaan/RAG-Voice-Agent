import ChatModelSchema from '../Models/chat.model.js';


export const chatWithAgent = async (req, res) => {
    try {

    } catch (error) {
        console.log("Error in chatWithAgent():", error);
        res.status(500).json({
            err: `Error in chatWithAgent(): ${error.message}`
        });
    }
}



