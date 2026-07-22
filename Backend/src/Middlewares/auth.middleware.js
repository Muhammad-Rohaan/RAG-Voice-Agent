import jwt from 'jsonwebtoken';
import UserModel from "../Models/users.model.js";

export const protect = async (req, res, next) => {
    try {
        const token = req.cookies.access_token;
        // console.log("auth.middleware.js token: " + token);
        if (!token) {
            return res.status(401).json({ success: false, message: "Access denied. No token provided." });
        }

        try {
            const verified = jwt.verify(token, process.env.JWT_SECRET);
            req.user = verified;

            next();

        } catch (error) {
            res.status(400).send('Invalid Token');
        }


    } catch (error) {
        res.status(500).json(error);
    }
}


