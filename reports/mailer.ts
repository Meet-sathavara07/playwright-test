import * as nodemailer from 'nodemailer';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

class Mailer {
  private transporter: nodemailer.Transporter;

  constructor() {
    this.transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: process.env.GMAIL_USER,
        pass: process.env.GMAIL_APP_PASSWORD,
      },
    });
  }

  isConfigured(): boolean {
    return !!(process.env.GMAIL_USER && process.env.GMAIL_APP_PASSWORD);
  }

  getRecipients(): string[] {
    return process.env.TEST_TEAM_EMAILS?.split(',').filter(Boolean) || [];
  }

  async sendEmail(
    recipients: string[],
    subject: string,
    html: string,
    attachments?: nodemailer.Attachment[]
  ): Promise<void> {
    if (!this.isConfigured()) {
      throw new Error('Email configuration is not set up. Please check your .env file.');
    }

    const mailOptions: nodemailer.SendMailOptions = {
      from: process.env.GMAIL_USER,
      to: recipients.join(','),
      subject,
      html,
      attachments,
    };

    try {
      const info = await this.transporter.sendMail(mailOptions);
      console.log(`Email sent successfully: ${info.messageId}`);
    } catch (error) {
      console.error('Failed to send email:', error);
      throw error;
    }
  }
}

export const mailer = new Mailer(); 