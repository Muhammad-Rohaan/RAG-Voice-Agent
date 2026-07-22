import express from 'express';
import { chatWithAgent, getAllMessages } from '../Controllers/chat.controller.js';
import { protect } from '../Middlewares/auth.middleware.js';


const router = express.Router();

router.post('/chat', protect, chatWithAgent);
router.get('/msgs', protect, getAllMessages)


export default router;