import mongoose from "mongoose";

const ChatModelSchema = new mongoose.Schema({
    message: {
        type: String,
        required: true
    }


},
    { timestamps: true }
);