import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";
import UserModel from "../Models/users.model.js";

// Register User

export const register = async (req, res) => {
    try {
        const { username, email, password } = req.body;

        if (!username || !email || !password) {
            return res.status(400).json({
                err: "All fields are required"
            });
        }

        const existingUser = await UserModel.findOne({ email });
        if (existingUser) {
            return res.status(400).json({ err: "Email already exists" });
        }

        const encryptedPassword = await bcrypt.hash(password, 10);

        const newUser = await UserModel.create({
            username: username,
            email: email,
            password: encryptedPassword
        });

        const token = jwt.sign(
            { id: newUser._id },
            process.env.JWT_SECRET,
            { expiresIn: process.env.JWT_EXPIRY }
        );

        res.cookie('access_token', token, {
            httpOnly: true,
            secure: true,
            sameSite: 'lax',
            maxAge: 5 * 24 * 60 * 60 * 1000
        });

        res.status(201).json({
            msg: "User Registered Successfully",
            user: {
                _id: newUser._id,
                username: newUser.username,
                email: newUser.email
            }
        });

    } catch (error) {
        console.log("Error in register():", error);
        res.status(500).json({
            err: `Error in register(): ${error.message}`
        });
    }
}

export const login = async (req, res) => {
    try {
        const { email, password } = req.body;

        const currUser = await UserModel.findOne({ email });
        if (!currUser) {
            return res.status(404).json({
                msg: "User Not found, Register First."
            });
        }
        
        if (await bcrypt.compare(password, currUser.password)) {
            const token = jwt.sign(
                { id: currUser._id },
                process.env.JWT_SECRET,
                { expiresIn: process.env.JWT_EXPIRY }
            );

            res.cookie('access_token', token, {
                httpOnly: true,
                secure: true,
                sameSite: 'lax',
                maxAge: 5 * 24 * 60 * 60 * 1000
            });

            res.status(200).json({
                message: "Logged in successfully",
                user: {
                    _id: currUser._id,
                    username: currUser.username,
                    email: currUser.email
                }
            });
        } else {
            res.status(400).json({
                msg: "Invalid Credentials."
            })
        }

    } catch (error) {
        console.log("Error in Login():", error);
        res.status(500).json({
            err: `Error in Login(): ${error.message}`
        });
    }
}

export const getUsers = async (req, res) => {
    try {
        const users = await UserModel.find({ _id: { $ne: req.user.id } }).select("-password");
        res.status(200).json(users);
    } catch (error) {
        console.log("Error in getUsers():", error);
        res.status(500).json({ error: "Internal server error" });
    }
}

export const logout = (req, res) => {
    try {
        res.cookie("access_token", "", { maxAge: 0 });
        res.status(200).json({ message: "Logged out successfully" });
    } catch (error) {
        res.status(500).json({ error: "Internal server error" });
    }
}