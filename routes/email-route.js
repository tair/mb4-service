import express from 'express';
import { sendForm } from '../controllers/email-controller.js';

const emailRouter = express.Router();

emailRouter.post('/contact-us-submit', sendForm);

export default emailRouter;