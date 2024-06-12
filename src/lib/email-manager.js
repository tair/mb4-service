import * as aws from '@aws-sdk/client-ses'
import nodemailer from 'nodemailer'
import { readFile } from 'node:fs/promises'
import path from 'path'
import process from 'node:process'

const ses = new aws.SESClient({
  region: process.env.AWS_REGION,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  },
})

const transporter = nodemailer.createTransport({
  SES: { ses, aws },
})

const templateFolder = path.join(process.cwd(), 'src/templates')

export class EmailManager {
  async email(template, parameters) {
    const htmlTemplate = await generateTemplate(`${template}.html`, parameters)
    const textTemplate = await generateTemplate(`${template}.txt`, parameters)
    const options = DEFAULT_EMAIL_OPTIONS[template]

    const attachments = []
    if (options.include_logo) {
      const imageAttachment = await readFile(
        `${templateFolder}/morphobank_email_logo.gif`
      )
      attachments.push({
        filename: 'logo.gif',
        content: imageAttachment,
        encoding: 'base64',
        cid: 'logo@morphobank.org',
        contentDisposition: 'inline',
        contentType: 'image/gif',
      })
    }

    const to = []
    if (parameters.to) {
      to.push(parameters.to)
    }
    if (options.to) {
      to.push(options.to)
    }

    const info = await transporter.sendMail({
      from: options.from,
      to: to,
      cc: options.cc,
      bcc: options.bcc,
      subject: options.subject,
      html: htmlTemplate,
      text: textTemplate,
      attachments: attachments,
    })

    return {
      messageId: info.messageId,
    }
  }
}

async function generateTemplate(templatePath, parameters) {
  let template = await readFile(`${templateFolder}/${templatePath}`, 'utf-8')
  for (const [name, value] of Object.entries(parameters)) {
    template = template.replaceAll(`$${name}`, value)
  }
  return template
}

const DEFAULT_EMAIL_OPTIONS = {
  project_duplication_request: {
    subject: 'Morphobank Project Duplication Request',
    from: 'no-reply@morphobank.org',
    to: 'duplication_requests_notifications@morphobank.org',
  },
  project_duplication_request_approved: {
    subject: 'Morphobank Project Duplication Request Approved',
    from: 'no-reply@morphobank.org',
    include_logo: true,
  },
  project_duplication_request_completed: {
    subject: 'Morphobank Project Duplication Completed',
    from: 'no-reply@morphobank.org',
    to: 'duplication_requests_notifications@morphobank.org',
  },
  project_duplication_request_denied: {
    subject: 'Morphobank Project Duplication Request Denied',
    from: 'no-reply@morphobank.org',
    include_logo: true,
  },
}
