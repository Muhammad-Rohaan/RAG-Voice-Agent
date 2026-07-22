import mongoose from "mongoose";

const ChatModelSchema = new mongoose.Schema({
    message: {
        type: String,
        required: true
    }


},
    { timestamps: true }
);

const Chat = mongoose.model('Chat', ChatModelSchema);

export default Chat;