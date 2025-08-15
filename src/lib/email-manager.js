import * as aws from '@aws-sdk/client-ses'
import nodemailer from 'nodemailer'
import { readFile } from 'node:fs/promises'
import path from 'path'
import process from 'node:process'
import config from '../config.js'

const ses = new aws.SESClient({
  region: config.email.region,
  credentials: {
    accessKeyId: config.email.accessKeyId,
    secretAccessKey: config.email.secretAccessKey,
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
      subject: parameters.subject || options.subject,
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
  project_partition_request_approved: {
    subject: 'Morphobank Partition Publish Request Approved',
    from: 'no-reply@morphobank.org',
    include_logo: true,
  },
  reset_password_instruction: {
    subject: '[Morphobank] Resetting your site password',
    from: 'no-reply@morphobank.org',
  },
  reset_password_notification: {
    subject: '[Morphobank] Your password has been reset',
    from: 'no-reply@morphobank.org',
  },
  project_member_invitation: {
    subject: 'Invitation to Morphobank project',
    from: 'no-reply@morphobank.org',
    include_logo: true,
  },
  registration_confirmation: {
    subject: '[Morphobank] Welcome to MorphoBank!',
    from: 'no-reply@morphobank.org',
    include_logo: true,
  },
  publication_notification: {
    subject: 'MorphoBank Publishing Notification',
    from: 'no-reply@morphobank.org',
    to: 'swapp19902@gmail.com',
  },
  publication_media_notification: {
    subject: 'MorphoBank Media Publishing Notification',
    from: 'no-reply@morphobank.org',
    to: 'swapp19902@gmail.com',
  },
}
