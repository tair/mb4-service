import { SESClient, SendRawEmailCommand } from '@aws-sdk/client-ses'
import { validationResult } from 'express-validator'
import { config } from 'dotenv'
import path from 'path'

config({ path: path.join(process.cwd(), '../.env') })

// Configure AWS
const ses = new SESClient({
  region: process.env.AWS_REGION,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  },
})

async function sendContactUsForm(req, res, next) {
  const errors = validationResult(req.body)
  if (!errors.isEmpty()) {
    const error = new Error('Validation failed.')
    error.statusCode = 422
    error.data = errors.array()
    throw error
  }

  const form = req.body

  const dateSubmitted =
    new Date().toLocaleString('en-US', {
      timeZone: 'America/Los_Angeles',
      hour12: true,
    }) + ' PST'

  const emailBody = `
<html>
  <head>
    <style>
      body {
        font-family: Arial, sans-serif;
      }
      table {
        width: 100%;
        border-collapse: collapse;
      }
      th, td {
        padding: 8px;
        text-align: left;
        border-bottom: 1px solid #ddd;
      }
    </style>
  </head>
  <body>
    <h3>MorphoBank Bug Report Details</h3>
    <table>
      <tr><td><strong>Name:</strong></td><td>${form.name}</td></tr>
      <tr><td><strong>Email:</strong></td><td>${form.email}</td></tr>
      <tr><td><strong>Date Submitted:</strong></td><td>${dateSubmitted}</td></tr>
      <tr><td><strong>Question:</strong></td><td>${form.question}</td></tr>
      <tr><td><strong>Media or Matrix numbers affected:</strong></td><td>${
        form.media
      }</td></tr>
      <tr><td><strong>Project Number:</strong></td><td>${
        form.projectNumber
      }</td></tr>
      <tr><td><strong>Published:</strong></td><td>${
        form.published ? 'Yes' : 'No'
      }</td></tr>
    </table>
  </body>
</html>`

  const sender = process.env.ASKUS_SENDER
  const recipient = process.env.ASKUS_RECEIVER
  const subject = 'MorphoBank Bug Report'

  let attachmentParts = ''
  if (form.attachments && Array.isArray(form.attachments)) {
    for (let attachment of form.attachments) {
      attachmentParts += `
--NextPart
Content-Type: application/octet-stream; name="${attachment.name}"
Content-Disposition: attachment; filename="${attachment.name}"
Content-Transfer-Encoding: base64

${attachment.file.trim()}
`
    }
  }

  const emailData = `
From: ${sender}
To: ${recipient}
Subject: ${subject}
Reply-To: ${form.email}
MIME-Version: 1.0
Content-Type: multipart/mixed; boundary="NextPart"

--NextPart
Content-Type: text/html; charset=UTF-8
Content-Transfer-Encoding: 7bit

${emailBody}

${attachmentParts}
--NextPart--`

  const params = new SendRawEmailCommand({
    Destinations: [recipient],
    RawMessage: {
      Data: Buffer.from(emailData.trim()),
    },
  })

  try {
    const data = await ses.send(params)
    res.status(200).json({ message: 'Email sent', messageId: data.MessageId })
  } catch (err) {
    console.error(err)
    emailFailure(err)
    res.status(500).json({ message: 'Failed to send email' })
  }
}

async function emailFailure(err, recipient = process.env.ERROR_TECHTEAM) {
  const sender = process.env.ERROR_TECHTEAM // Update this as per your requirement
  const subject = 'Email Send Failure Notification'
  const emailBody = `
    <html>
      <head></head>
      <body>
        <h3>Email Send Failure</h3>
        <p>An attempt to send an email failed. Below are the details:</p>
        <p><strong>Error Message:</strong> ${err.message}</p>
        <p><strong>Error Stack:</strong> ${err.stack}</p>
        <p>Please take the necessary actions.</p>
      </body>
    </html>`

  const emailData = `
From: ${sender}
To: ${recipient}
Subject: ${subject}
MIME-Version: 1.0
Content-Type: text/html; charset=UTF-8
Content-Transfer-Encoding: 7bit

${emailBody}
`

  const params = new SendRawEmailCommand({
    Destinations: [recipient],
    RawMessage: {
      Data: Buffer.from(emailData.trim()),
    },
  })

  try {
    const data = await ses.send(params)
    console.log('Failure notification email sent', data.MessageId)
  } catch (error) {
    console.error('Failed to send failure notification email', error)
  }
}

export { sendContactUsForm }
