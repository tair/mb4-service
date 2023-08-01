
import { SESClient, SendRawEmailCommand } from "@aws-sdk/client-ses";
import { validationResult } from 'express-validator';
import { config } from 'dotenv';
import path from 'path';

config({ path: path.join(process.cwd(), '../.env') });

// Configure AWS
const ses = new SESClient({
  region: process.env.AWS_REGION,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  },
});

async function sendForm(req, res, next) {
  const errors = validationResult(req.body);
  if (!errors.isEmpty()) {
    const error = new Error('Validation failed.');
    error.statusCode = 422;
    error.data = errors.array();
    throw error;
  }

const { form } = req.body;

const dateSubmitted = new Date().toLocaleString('en-US', { timeZone: 'America/Los_Angeles', hour12: true }) + ' PST';;

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
      <tr><td><strong>Media or Matrix numbers affected:</strong></td><td>${form.media}</td></tr>
      <tr><td><strong>Project Number:</strong></td><td>${form.projectNumber}</td></tr>
      <tr><td><strong>Published:</strong></td><td>${form.published ? 'Yes' : 'No'}</td></tr>
    </table>
  </body>
</html>`;

const sender = 'kartik.khosa@phxbio.org';
const recipient = 'kartik.khosa@phxbio.org';
const subject = 'MorphoBank Bug Report';

const attachmentPart = form.attachment ? `
--NextPart
Content-Type: application/octet-stream; name="${form.attachment.name}"
Content-Disposition: attachment; filename="${form.attachment.name}"
Content-Transfer-Encoding: base64

${form.attachment.file.trim()}
` : '';

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

${attachmentPart}
--NextPart--`;

const params = new SendRawEmailCommand({
  Destinations: [recipient],
  RawMessage: {
    Data: Buffer.from(emailData.trim()),
  },
});



  try {
    const data = await ses.send(params);
    res.status(200).json({ message: 'Email sent', messageId: data.MessageId });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Failed to send email' });
  }
}

export { sendForm };