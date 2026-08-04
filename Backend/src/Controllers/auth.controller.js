import { OAuth2Client } from 'google-auth-library';
import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";
import UserModel from "../Models/users.model.js";

// Register User

const getCookieOptions = () => {
    const isProd = process.env.NODE_ENV === "production";
    return {
        httpOnly: true,
        secure: isProd,
        sameSite: isProd ? "none" : "lax",
        maxAge: 5 * 24 * 60 * 60 * 1000
    };
};

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

        res.cookie("access_token", token, getCookieOptions());

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

            res.cookie("access_token", token, getCookieOptions());

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
        res.clearCookie("access_token", getCookieOptions());
        res.status(200).json({ message: "Logged out successfully" });
    } catch (error) {
        res.status(500).json({ error: "Internal server error" });
    }
}


export const googleAuth = async (req, res) => {
    try {
        const client = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);
        const { token } = req.body;

        if (!token) {
            return res.status(400).json({ message: 'Token is required' });
        }

        const ticket = await client.verifyIdToken({
            idToken: token,
            audience: process.env.GOOGLE_CLIENT_ID
        });

        const payload = ticket.getPayload();
        const { sub: googleId, email, picture } = payload;
        const displayName = payload.name || payload.given_name || (email ? email.split('@')[0] : 'Google User');

        // Check if user already exists in MongoDB
        let user = await UserModel.findOne({ email });

        if (!user) {
            // Create user if they don't exist
            user = await UserModel.create({
                googleId,
                username: displayName,
                email,
                picture,
            });
        } else {
            let updated = false;
            if (!user.googleId) {
                user.googleId = googleId;
                updated = true;
            }
            if (!user.picture && picture) {
                user.picture = picture;
                updated = true;
            }
            if (updated) {
                await user.save();
            }
        }

        // Generate server-side application JWT token
        const appToken = jwt.sign(
            { id: user._id, email: user.email },
            process.env.JWT_SECRET,
            { expiresIn: process.env.JWT_EXPIRY }
        );

        res.cookie("access_token", appToken, getCookieOptions());

        res.status(200).json({
            message: 'Authentication successful',
            token: appToken,
            user: { _id: user._id, username: user.username, email: user.email, picture: user.picture }
        });

    } catch (error) {
        console.error('Token verification error', error);
        res.status(401).json({ message: 'Invalid Google token' });
    }
}

