import mongoose from "mongoose";

const connectDB = async () => {
    try {
        await mongoose.connect(process.env.DB_URL, {});
        console.log("DB connected Successfully");
        
    } catch (error) {
        console.log(`Error connecting DB ${error}`);
        
    }
}

export default connectDB;