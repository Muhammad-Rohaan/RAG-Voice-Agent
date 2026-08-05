import express from 'express';
import { chatWithAgent, getAllMessages, talkWithAgent } from '../Controllers/chat.controller.js';
import { protect } from '../Middlewares/auth.middleware.js';


const router = express.Router();

router.post('/chat', protect, chatWithAgent);
router.get('/msgs', protect, getAllMessages);
router.post('/voice/start-session', protect, talkWithAgent)


export default router;