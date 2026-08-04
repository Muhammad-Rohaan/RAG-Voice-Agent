import express from "express";
import { login, register, getUsers, logout, googleAuth } from "../Controllers/auth.controller.js";
import { protect } from "../Middlewares/auth.middleware.js";

const router = express.Router();

router.post('/register-user', register);
router.post('/login', login);
router.get('/users', protect, getUsers);
router.post('/logout', protect, logout);

//Google Auth
router.post('/google', googleAuth);

export default router;