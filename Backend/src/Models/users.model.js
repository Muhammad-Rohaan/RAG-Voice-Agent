import mongoose from 'mongoose';

const UserSchema = new mongoose.Schema(
    {
        username: {
            type: String,
            required: [true, "Your username is required"]
        },
        email: {
            type: String,
            required: [true, "Your email address is required"],
            unique: true
        },
        password: {
            type: String,
            required: [true, "Your password is required"]
        }

    }, 
    
    {timestamps: true}
);

const User = mongoose.model('users', UserSchema);

export default User;