import mongoose from "mongoose";

const ChatModelSchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'users',
        default: null
    },
    userMessage: {
        type: String,
        default: ''
    },
    message: {
        type: String,
        required: true
    }


},
    { timestamps: true }
);

const Chat = mongoose.model('Chat', ChatModelSchema);

export default Chat;