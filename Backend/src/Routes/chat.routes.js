import express from 'express';
import { chatWithAgent } from '../Controllers/chat.controller';


const router = express.Router();

router.post('/chat', chatWithAgent);



export default router;