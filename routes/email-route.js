import express from 'express'
import { sendContactUsForm } from '../controllers/email-controller.js'

const emailRouter = express.Router()

emailRouter.post('/contact-us-submit', sendContactUsForm)

export default emailRouter
