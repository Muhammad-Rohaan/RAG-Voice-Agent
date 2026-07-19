import mongoose from "mongoose";

const connectDB = async () => {
    try {

        console.log("Vector DB connected Successfully");
        
    } catch (error) {
        console.log(`Error connecting Vector DB ${error}`);
        
    }
}

export default connectDB;