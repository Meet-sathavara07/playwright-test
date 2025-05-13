import * as nodemailer from 'nodemailer';
import * as dotenv from 'dotenv';

// Load environment variables
dotenv.config();

/**
 * A utility class for handling email operations in test reporting
 */
class Mailer {
  private transporter: nodemailer.Transporter;
  
  constructor() {
    this.transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: process.env.GMAIL_USER,
        pass: process.env.GMAIL_APP_PASSWORD,
      },
      // Enable debugging for troubleshooting
      ...(process.env.DEBUG_EMAIL ? { debug: true } : {}),
    });
  }

  /**
   * Sends an email with the provided details
   * 
   * @param recipients - Array of email addresses to send to
   * @param subject - Email subject line
   * @param htmlContent - HTML content for the email body
   * @param attachments - Optional email attachments
   * @returns Promise resolving to the send result
   */
  async sendEmail(
    recipients: string[],
    subject: string,
    htmlContent: string,
    attachments?: nodemailer.Attachment[]
  ): Promise<nodemailer.SentMessageInfo> {
    try {
      const mailOptions: nodemailer.SendMailOptions = {
        from: {
          name: 'Playwright Test Runner',
          address: process.env.GMAIL_USER || '',
        },
        to: recipients.join(','),
        subject,
        html: htmlContent,
      };

      // Add attachments if provided
      if (attachments && attachments.length > 0) {
        mailOptions.attachments = attachments;
      }

      // Send email and return result
      const info = await this.transporter.sendMail(mailOptions);
      console.log(`Email sent: ${info.messageId}`);
      return info;
    } catch (error) {
      console.error('Failed to send email:', error);
      throw error;
    }
  }

  /**
   * Checks if the email configuration is valid
   * @returns boolean indicating if the mailer is properly configured
   */
  isConfigured(): boolean {
    return !!(process.env.GMAIL_USER && process.env.GMAIL_APP_PASSWORD);
  }

  /**
   * Returns a list of recipient emails from environment variables
   * @returns Array of email addresses
   */
  getRecipients(): string[] {
    return (process.env.TEST_TEAM_EMAILS || '').split(',').filter(email => email.trim() !== '');
  }
}

// Export singleton instance
export const mailer = new Mailer();