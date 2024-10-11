import { SESClient, SendRawEmailCommand } from '@aws-sdk/client-ses'
import { validationResult } from 'express-validator'
import { config } from 'dotenv'
import path from 'path'
import process from 'node:process'
import { Buffer } from 'node:buffer'
import { readFile } from 'node:fs/promises'

config({ path: path.join(process.cwd(), '../.env') })

// Configure AWS
const ses = new SESClient({
  region: process.env.AWS_REGION,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  },
})

export async function sendContactUsForm(req, res) {
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

  // Get the IP address of the user
  const ip = req.headers['x-forwarded-for'] || req.connection.remoteAddress

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
      <tr><td><strong>User ID:</strong></td><td>${form.userId}</td></tr>
      <tr><td><strong>Name:</strong></td><td>${form.name}</td></tr>
      <tr><td><strong>Email:</strong></td><td>${form.email}</td></tr>
      <tr><td><strong>IP Address:</strong></td><td>${ip}</td></tr>
      <tr><td><strong>Browser/OS Information:</strong></td><td>${
        form.userAgent
      }</td></tr>
      <tr><td><strong>Date Submitted:</strong></td><td>${dateSubmitted}</td></tr>
      <tr><td><strong>Media or Matrix numbers affected:</strong></td><td>${
        form.media
      }</td></tr>
      <tr><td><strong>Project Number:</strong></td><td>${
        form.projectNumber
      }</td></tr>
      <tr><td><strong>Published:</strong></td><td>${
        form.published ? 'Yes' : 'No'
      }</td></tr>
      <tr><td><strong>Description:</strong></td><td>${form.question}</td></tr>
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
    setTimeout(() => {
      sendContactUsReceipt(form.email, form.question)
    }, 2000)
    res.status(200).json({ message: 'Email sent', messageId: data.MessageId })
  } catch (err) {
    console.error(err)
    emailFailure(err)
    res.status(500).json({ message: 'Failed to send email' })
  }
}

async function sendContactUsReceipt(recipientEmail, description) {
  const templateFolder = path.join(process.cwd(), 'src/templates')
  const logoImage = await readFile(
    `${templateFolder}/morphobank_email_logo.gif`,
    { encoding: 'base64' }
  )

  const emailBody = `
    <html>
      <head>
        <style>
          body {
            font-family: Arial, sans-serif;
          }
          .header {
            text-align: center;
            padding-bottom: 20px;
          }
        </style>
      </head>
      <body>
        <div class="header">
          <img src="cid:logo" alt="MorphoBank Logo" width="200">
        </div>
        <h3>MorphoBank Bug Report Details</h3>
        <p>Your email has been sent. MorphoBank will be back in touch with you very shortly!</p>
        <br />
        <p><b>Description:</b> ${description}</p>
        <br />
        <p>MorphoBank is supported by a voluntary institutional membership program wherein institutions become members for an annual fee that is comparable to a journal subscription. Members ensure that everyone in the community has access to this valuable curation and data dissemination platform. MorphoBank will always remain free to all users, and we ask that the community volunteer to contribute a small amount to sustain the site.</p>
        <p>It helps enormously if researchers like you who have data in MorphoBank and understand the value of scientific databases can send a supporting email directly to your librarian about this issue and copy memberships@phxbio.org. We will continue the conversation with them and researcher input is extremely valuable in their decision-making process.</p>
        <br />
        <p>MorphoBank Administration</p>
        </body>
    </html>`

  const sender = 'no-reply@morphobank.org'
  const recipient = recipientEmail
  const subject = 'Receipt of Report by MorphoBank'

  const emailData = `
From: ${sender}
To: ${recipient}
Subject: ${subject}
MIME-Version: 1.0
Content-Type: multipart/mixed; boundary="NextPart"

--NextPart
Content-Type: text/html; charset=UTF-8
Content-Transfer-Encoding: 7bit

${emailBody}

--NextPart
Content-Type: image/gif; name="morphobank-logo.gif"
Content-Transfer-Encoding: base64
Content-ID: <logo>
Content-Disposition: inline; filename="morphobank-logo.gif"

${logoImage}

--NextPart--`

  const params = new SendRawEmailCommand({
    Destinations: [recipient],
    RawMessage: {
      Data: Buffer.from(emailData.trim()),
    },
  })

  try {
    const data = await ses.send(params)
  } catch (err) {
    console.error(err)
    emailFailure(err)
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
