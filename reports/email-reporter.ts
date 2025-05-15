import {
  Reporter,
  TestCase,
  TestResult,
  FullConfig,
  Suite,
} from "@playwright/test/reporter";
import * as path from "path";
import * as fs from "fs";
import * as crypto from "crypto";
import * as nodemailer from "nodemailer";
import dotenv from "dotenv";

// Load environment variables
dotenv.config();

//# TEST_TEAM_EMAILS=dev@cheerchampion.com{bug}

// Define our own attachment interface since nodemailer types are not working
interface EmailAttachment {
  filename: string;
  path: string;
  cid: string;
}

interface TestResultWithDetails {
  test: TestCase;
  result: TestResult;
  projectName: string;
  savedAttachments?: {
    screenshot?: string;
    video?: string;
  };
}

interface TestRunSummary {
  totalTests: number;
  passedTests: number;
  failedTests: number;
  skippedTests: number;
  duration: number;
}

// Mailer class implementation
class Mailer {
  private transporter: nodemailer.Transporter;

  constructor() {
  console.log('Setting up email transporter');
  console.log('GMAIL_USER env exists:', !!process.env.GMAIL_USER);
  console.log('GMAIL_APP_PASSWORD env exists:', !!process.env.GMAIL_APP_PASSWORD);
  
  try {
    this.transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: process.env.GMAIL_USER,
        pass: process.env.GMAIL_APP_PASSWORD,
      },
    });
    console.log('Email transporter created successfully');
  } catch (error) {
    console.error('Failed to create email transporter:', error);
    throw error;
  }
}

  isConfigured(): boolean {
  const hasUser = !!process.env.GMAIL_USER;
  const hasPassword = !!process.env.GMAIL_APP_PASSWORD;
  console.log(`Email config check - User: ${hasUser}, Password: ${hasPassword}`);
  return hasUser && hasPassword;
}

  getRecipients(): string[] {
    return process.env.TEST_TEAM_EMAILS?.split(",").filter(Boolean) || [];
  }

  async sendEmail(
    recipients: string[],
    subject: string,
    html: string,
    attachments?: nodemailer.Attachment[]
  ): Promise<void> {
    console.log("Email configuration status:", this.isConfigured());
    console.log("Email recipients:", recipients);
    console.log("GMAIL_USER env variable exists:", !!process.env.GMAIL_USER);
    console.log(
      "GMAIL_APP_PASSWORD env variable exists:",
      !!process.env.GMAIL_APP_PASSWORD
    );
    console.log(
      "TEST_TEAM_EMAILS env variable value:",
      process.env.TEST_TEAM_EMAILS
    );

    if (!this.isConfigured()) {
      throw new Error(
        "Email configuration is not set up. Please check your .env file."
      );
    }

    const mailOptions: nodemailer.SendMailOptions = {
      from: process.env.GMAIL_USER,
      to: recipients.join(","),
      subject,
      html,
      attachments,
    };

    try {
      console.log("Attempting to send email with options:", {
        from: mailOptions.from,
        to: mailOptions.to,
        subject: mailOptions.subject,
        attachmentsCount: mailOptions.attachments?.length || 0,
      });
      const info = await this.transporter.sendMail(mailOptions);
      console.log(`Email sent successfully: ${info.messageId}`);
    } catch (error) {
      console.error("Failed to send email. Error details:", error);
      throw error;
    }
  }
}

// Create a single instance of Mailer
export const mailer = new Mailer();

// EmailReporter implementation
export class EmailReporter implements Reporter {
  private failedTests: TestResultWithDetails[] = [];
  private passedTests: TestResultWithDetails[] = [];
  private skippedTests: TestResultWithDetails[] = [];
  private testRunSummary: TestRunSummary = {
    totalTests: 0,
    passedTests: 0,
    failedTests: 0,
    skippedTests: 0,
    duration: 0,
  };
  private startTime: number = 0;
  private config!: FullConfig;
  private outputDir: string = "";
  private artifactsDir: string = "";

  onBegin(config: FullConfig, suite: Suite) {
    this.config = config;
    this.startTime = Date.now();
    this.testRunSummary.totalTests = suite.allTests().length;

    // Create output directories
    this.outputDir = path.resolve(process.cwd(), "test-results");
    this.artifactsDir = path.join(
      this.outputDir,
      "email-artifacts",
      Date.now().toString()
    );

    // Ensure directories exist
    fs.mkdirSync(this.artifactsDir, { recursive: true });
    console.log(
      `EmailReporter: Artifacts will be saved to ${this.artifactsDir}`
    );
  }

  async onTestEnd(test: TestCase, result: TestResult) {
    const projectName = test.parent.project()?.name || "unknown";
    const testInfo: TestResultWithDetails = { test, result, projectName };

    // Only save attachments for failed tests
    if (result.status === "failed") {
      testInfo.savedAttachments = await this.saveAttachments(test, result);
      this.failedTests.push(testInfo);
      this.testRunSummary.failedTests++;
    } else if (result.status === "passed") {
      this.passedTests.push(testInfo);
      this.testRunSummary.passedTests++;
    } else if (result.status === "skipped") {
      this.skippedTests.push(testInfo);
      this.testRunSummary.skippedTests++;
    }
  }

  async onEnd() {
    // Calculate test run duration
    this.testRunSummary.duration = Date.now() - this.startTime;

    // Check if email configuration is valid
    if (!mailer.isConfigured()) {
      console.error(
        "Email configuration is not set up. Make sure GMAIL_USER and GMAIL_APP_PASSWORD are set in .env"
      );
      return;
    }

    const recipients = mailer.getRecipients();
    if (recipients.length === 0) {
      console.error("No recipient emails specified. Cannot send test reports.");
      return;
    }

    try {
      // Send appropriate report based on test results
      if (this.failedTests.length > 0) {
        await this.sendFailureReport(recipients);
      } else {
        await this.sendSuccessReport(recipients);
      }
    } catch (error) {
      console.error("Failed to send email report:", error);
    }
  }

  private async saveAttachments(
    test: TestCase,
    result: TestResult
  ): Promise<{ screenshot?: string; video?: string }> {
    const savedPaths: { screenshot?: string; video?: string } = {};

    if (!result.attachments || result.attachments.length === 0) {
      return savedPaths;
    }

    // Create a unique folder for this test's attachments
    const testHash = crypto
      .createHash("md5")
      .update(`${test.location.file}-${test.title}-${Date.now()}`)
      .digest("hex")
      .substring(0, 10);

    const testDir = path.join(this.artifactsDir, testHash);
    fs.mkdirSync(testDir, { recursive: true });

    // Process and save each attachment
    for (const attachment of result.attachments) {
      if (!attachment.path || !fs.existsSync(attachment.path)) {
        continue;
      }

      try {
        const originalExt = path.extname(attachment.path);
        const fileExt =
          originalExt ||
          this.getExtensionForContentType(attachment.contentType);
        const fileName = `${attachment.name}${fileExt}`;
        const destPath = path.join(testDir, fileName);

        // Copy file to our artifacts directory
        fs.copyFileSync(attachment.path, destPath);
        console.log(`Saved ${attachment.name} to ${destPath}`);

        // Store the path for the email report
        if (attachment.name === "screenshot") {
          savedPaths.screenshot = destPath;
        } else if (attachment.name === "video") {
          savedPaths.video = destPath;
        }
      } catch (error) {
        console.error(`Failed to save attachment ${attachment.name}:`, error);
      }
    }

    return savedPaths;
  }

  private getExtensionForContentType(contentType?: string): string {
    if (!contentType) return "";

    const contentTypeMap: Record<string, string> = {
      "image/png": ".png",
      "image/jpeg": ".jpg",
      "video/webm": ".webm",
      "video/mp4": ".mp4",
      "text/plain": ".txt",
      "text/html": ".html",
      "application/json": ".json",
    };

    return contentTypeMap[contentType] || "";
  }

  private async sendFailureReport(recipients: string[]) {
    // Create summary section with stats
    const summarySection = this.createSummarySection();

    // Create HTML for failed tests with detailed information
    const failureDetails = await Promise.all(
      this.failedTests.map(
        async ({ test, result, projectName, savedAttachments }) => {
          const error = result.errors[0];
          const errorMessage = error?.message || "Unknown error";
          const stackTrace = error?.stack || "No stack trace available";

          // Format test title chain (including suite titles)
          const titleChain = this.getTitleChain(test);

          // Get attachments (screenshot and video)
          const { screenshotHtml, videoHtml } = await this.getAttachmentsHtml(
            test,
            result,
            savedAttachments
          );

          // Format error message with better highlighting
          const formattedError = this.formatErrorMessage(errorMessage);

          // Format test steps if available
          const stepsHtml = this.formatTestSteps(result);

          // Get retry information
          const retryInfo =
            test.retries > 0
              ? `<div class="retry-info">Retry attempt: ${test.retries}</div>`
              : "";

          return `
        <div class="test-failure">
          <div class="test-header">
            <h3>❌ Failed Test: ${test.title}</h3>
            <div class="test-meta">
              <span class="project-badge">${projectName}</span>
              <span class="duration-badge">${this.formatDuration(
                result.duration
              )}</span>
            </div>
          </div>
          
          <div class="test-path">
            <span class="label">Test Path:</span> ${titleChain}
          </div>

          <div class="test-location">
            <span class="label">File:</span> ${test.location.file}:${
            test.location.line
          }:${test.location.column}
          </div>
          
          ${retryInfo}
          
          <div class="error-section">
            <h4>Error:</h4>
            <div class="error-message">${formattedError}</div>
            <div class="collapsible">
              <input id="stack-${test.id}" class="toggle" type="checkbox">
              <label for="stack-${
                test.id
              }" class="toggle-label">Stack Trace</label>
              <div class="collapsible-content">
                <div class="stack-trace">${this.formatStackTrace(
                  stackTrace
                )}</div>
              </div>
            </div>
          </div>
          
          ${stepsHtml}
          
          <div class="attachments-section">
            ${screenshotHtml}
            ${videoHtml}
          </div>
        </div>
      `;
        }
      )
    );

    // Generate email HTML using the template
    const emailHtml = this.generateEmailTemplate({
      isSuccess: false,
      title: "❌ Playwright Test Failure Report",
      content: `
        ${summarySection}
        
        <div class="failure-details">
          <h2>Failed Tests (${this.failedTests.length})</h2>
          ${failureDetails.join("")}
        </div>
      `,
    });

    // Prepare attachments for the email
    const attachments = await this.prepareEmailAttachments(this.failedTests);

    // Send email
    try {
      await mailer.sendEmail(
        recipients,
        `[TEST FAILURE] ${this.failedTests.length} Playwright test(s) failed`,
        emailHtml,
        attachments
      );
    } catch (error) {
      console.error("Failed to send failure report email:", error);
    }
  }

  private async sendSuccessReport(recipients: string[]) {
    // Create summary section with stats
    const summarySection = this.createSummarySection();

    // Create a list of passed tests with basic details
    const passedTestsHtml = this.passedTests
      .map(({ test, result, projectName }) => {
        return `
        <div class="test-success">
          <div class="test-header">
            <h3>✅ ${test.title}</h3>
            <div class="test-meta">
              <span class="project-badge">${projectName}</span>
              <span class="duration-badge">${this.formatDuration(
                result.duration
              )}</span>
            </div>
          </div>
          <div class="test-location">
            <span class="label">File:</span> ${test.location.file}:${
          test.location.line
        }
          </div>
        </div>
      `;
      })
      .join("");

    // Generate email HTML using the template
    const emailHtml = this.generateEmailTemplate({
      isSuccess: true,
      title: "✅ Playwright Test Success Report",
      content: `
        <div class="success-message">
          <h2>All Tests Passed Successfully! 🎉</h2>
          <p>All ${this.testRunSummary.passedTests} tests have completed successfully without any failures.</p>
        </div>
        
        ${summarySection}
        
        <div class="success-details">
          <h2>Passed Tests (${this.passedTests.length})</h2>
          ${passedTestsHtml}
        </div>
      `,
    });

    // Send email (no attachments for success report)
    try {
      await mailer.sendEmail(
        recipients,
        `[TEST SUCCESS] All ${this.passedTests.length} Playwright test(s) passed`,
        emailHtml
      );
    } catch (error) {
      console.error("Failed to send success report email:", error);
    }
  }

  private async prepareEmailAttachments(
    tests: TestResultWithDetails[]
  ): Promise<EmailAttachment[]> {
    const attachments: EmailAttachment[] = [];

    // Process saved attachments from failed tests
    for (const test of tests) {
      if (!test.savedAttachments) continue;

      // Add screenshot as attachment if it exists
      if (
        test.savedAttachments.screenshot &&
        fs.existsSync(test.savedAttachments.screenshot)
      ) {
        const filename = `screenshot-${path.basename(
          test.savedAttachments.screenshot
        )}`;
        attachments.push({
          filename,
          path: test.savedAttachments.screenshot,
          cid: `screenshot-${test.test.id}`, // Content ID for embedding in HTML
        });
      }

      // Add video as attachment if it exists
      if (
        test.savedAttachments.video &&
        fs.existsSync(test.savedAttachments.video)
      ) {
        const filename = `video-${path.basename(test.savedAttachments.video)}`;
        attachments.push({
          filename,
          path: test.savedAttachments.video,
          cid: `video-${test.test.id}`, // Content ID for embedding in HTML
        });
      }
    }

    return attachments;
  }

  private createSummarySection(): string {
    return `
      <div class="summary">
        <h2 class="summary-title">Test Run Summary</h2>
        <div class="summary-grid">
          <div class="summary-card total">
            <h3>Total Tests</h3>
            <div class="number">${this.testRunSummary.totalTests}</div>
          </div>
          <div class="summary-card passed">
            <h3>Passed</h3>
            <div class="number">${this.testRunSummary.passedTests}</div>
          </div>
          <div class="summary-card failed">
            <h3>Failed</h3>
            <div class="number">${this.testRunSummary.failedTests}</div>
          </div>
          <div class="summary-card skipped">
            <h3>Skipped</h3>
            <div class="number">${this.testRunSummary.skippedTests}</div>
          </div>
        </div>
      </div>
    `;
  }

  private formatDuration(ms: number): string {
    if (ms < 1000) return `${ms}ms`;
    const seconds = Math.floor(ms / 1000);
    if (seconds < 60) return `${seconds}s`;
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}m ${remainingSeconds}s`;
  }

  private getTitleChain(test: TestCase): string {
    const titles: string[] = [];
    let suite: Suite | undefined = test.parent;
    while (suite) {
      if (suite.title) titles.unshift(suite.title);
      suite = suite.parent;
    }
    return titles.length > 0 ? titles.join(" > ") : "Root Suite";
  }

  private async getAttachmentsHtml(
    test: TestCase,
    result: TestResult,
    savedAttachments?: { screenshot?: string; video?: string }
  ): Promise<{ screenshotHtml: string; videoHtml: string }> {
    let screenshotHtml = "";
    let videoHtml = "";

    if (savedAttachments) {
      // Generate HTML for screenshot
      if (savedAttachments.screenshot) {
        screenshotHtml = `
          <div class="screenshot">
            <h4>Screenshot at Failure:</h4>
            <img src="cid:screenshot-${test.id}" alt="Test Failure Screenshot" />
          </div>
        `;
      }

      // Generate HTML for video
      if (savedAttachments.video) {
        videoHtml = `
          <div class="video">
            <h4>Test Execution Video:</h4>
            <div class="video-link">
              <p>Video attachment included. If your email client doesn't display the video below, 
              please check the attachments.</p>
              <video controls width="600">
                <source src="cid:video-${test.id}" type="video/webm">
                Your email client doesn't support embedded videos.
              </video>
            </div>
          </div>
        `;
      }
    }

    return { screenshotHtml, videoHtml };
  }

  private formatErrorMessage(message: string): string {
    // Replace ANSI color codes with HTML styling
    return message
      .replace(/\[31m/g, '<span class="highlight-red">')
      .replace(/\[32m/g, '<span class="highlight-green">')
      .replace(/\[39m/g, "</span>")
      .replace(/\[2m/g, '<span style="opacity: 0.7;">')
      .replace(/\[22m/g, "</span>")
      .replace(/\n/g, "<br>");
  }

  private formatStackTrace(stack: string): string {
    // Highlight file paths and function names in stack trace
    return stack
      .replace(/at\s+(\w+)/g, 'at <span class="highlight">$1</span>')
      .replace(/\(([^)]+)\)/g, '(<span class="highlight">$1</span>)')
      .replace(/\n/g, "<br>");
  }

  private formatTestSteps(result: TestResult): string {
    // If test has steps, format them
    if (!result.steps || result.steps.length === 0) {
      return "";
    }

    const stepsHtml = result.steps
      .map((step, index) => {
        const status = step.error ? "❌" : "✅";
        return `<div class="test-step">${status} ${index + 1}. ${
          step.title
        } (${this.formatDuration(step.duration)})</div>`;
      })
      .join("");

    return `
      <div class="test-steps">
        <h4>Test Steps:</h4>
        ${stepsHtml}
      </div>
    `;
  }

  private generateEmailTemplate({
    isSuccess,
    title,
    content,
  }: {
    isSuccess: boolean;
    title: string;
    content: string;
  }): string {
    const primaryColor = isSuccess ? "#2a9d8f" : "#e63946";

    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <style>
          :root {
            --primary-color: ${primaryColor};
            --secondary-color: #457b9d;
            --background-color: #ffffff;
            --success-color: #2a9d8f;
            --warning-color: #e9c46a;
            --text-color: #1d3557;
            --light-text: #ffffff;
            --border-color: #a8dadc;
            --card-bg: #ffffff;
            --code-bg: #f8f9fa;
            --error-bg: #fff5f5;
            --error-text: #e63946;
            --success-bg: #f0fdf4;
            --success-text: #2a9d8f;
            --warning-bg: #fff7ed;
            --warning-text: #e9c46a;
          }
          
          body {
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            line-height: 1.6;
            color: var(--text-color);
            background-color: var(--background-color);
            margin: 0;
            padding: 0;
          }
          
          .container {
            max-width: 800px;
            margin: 0 auto;
            padding: 20px;
            background-color: white;
            box-shadow: 0 0 10px rgba(0,0,0,0.1);
            text-align: center;
          }

          .header {
            background-color: var(--primary-color);
            color: var(--light-text);
            padding: 20px;
            text-align: center;
            border-radius: 5px 5px 0 0;
            margin-bottom: 20px;
          }
          
          .header h1 {
            margin: 0;
            font-size: 24px;
            color: var(--light-text);
            text-align: center;
          }
          
          .summary {
            background-color: var(--card-bg);
            padding: 15px;
            margin: 0 auto 20px;
            border-radius: 5px;
            border-left: 4px solid var(--secondary-color);
            box-shadow: 0 2px 4px rgba(0,0,0,0.05);
            text-align: center;
            max-width: 600px;
          }
          
          .summary-title {
            text-align: center;
            margin-bottom: 15px;
            color: var(--text-color);
          }
          
          .summary-grid {
            display: grid;
            grid-template-columns: repeat(4, 1fr);
            gap: 10px;
            margin-top: 15px;
          }
          
          .summary-card {
            padding: 10px;
            border-radius: 5px;
            text-align: center;
            box-shadow: 0 2px 4px rgba(0,0,0,0.05);
          }
          
          .summary-card h3 {
            margin: 0;
            font-size: 16px;
            color: inherit;
            text-align: center;
          }
          
          .summary-card .number {
            font-size: 28px;
            font-weight: bold;
            margin: 10px 0;
            color: inherit;
            text-align: center;
          }

          .failure-details, .success-details {
            text-align: left;
            margin: 0 auto;
            max-width: 800px;
          }

          .failure-details h2, .success-details h2 {
            text-align: center;
            margin-bottom: 20px;
          }
          
          .test-failure, .test-success {
            background-color: var(--card-bg);
            margin-bottom: 20px;
            padding: 15px;
            border-radius: 5px;
            border-left: 4px solid ${
              isSuccess ? "var(--success-color)" : "var(--error-text)"
            };
            box-shadow: 0 2px 4px rgba(0,0,0,0.05);
          }
          
          .test-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 10px;
            border-bottom: 1px solid var(--border-color);
            padding-bottom: 10px;
          }
          
          .test-header h3 {
            margin: 0;
            color: ${isSuccess ? "var(--success-color)" : "var(--error-text)"};
            font-size: 18px;
            text-align: left;
          }
          
          .test-meta {
            display: flex;
            gap: 8px;
          }

          .project-badge, .duration-badge {
            padding: 4px 8px;
            border-radius: 4px;
            font-size: 12px;
            color: var(--light-text);
          }
          
          .project-badge {
            background-color: var(--secondary-color);
          }
          
          .duration-badge {
            background-color: var(--text-color);
          }
          
          .test-path, .test-location {
            margin-bottom: 8px;
            font-size: 14px;
            color: var(--text-color);
            text-align: left;
          }

          .label {
            font-weight: bold;
            color: var(--secondary-color);
          }
          
          .retry-info {
            background-color: var(--warning-bg);
            color: var(--warning-text);
            padding: 5px 10px;
            border-radius: 4px;
            display: inline-block;
            margin-bottom: 10px;
            font-size: 14px;
          }
          
          .error-section {
            text-align: left;
            margin: 15px 0;
          }
          
          .error-section h4 {
            text-align: left;
            margin-top: 0;
            margin-bottom: 8px;
            color: var(--secondary-color);
          }
          
          .error-message {
            text-align: left;
            margin: 10px 0;
            background-color: var(--error-bg);
            color: var(--error-text);
            padding: 10px;
            border-radius: 4px;
            white-space: pre-wrap;
            font-family: monospace;
            overflow-x: auto;
          }
          
          .stack-trace {
            text-align: left;
            margin: 10px 0;
            background-color: var(--code-bg);
            padding: 10px;
            border-radius: 4px;
            white-space: pre-wrap;
            font-family: monospace;
            font-size: 12px;
            overflow-x: auto;
            color: var(--text-color);
          }
          
          .test-steps {
            text-align: left;
            margin: 15px 0;
          }
          
          .test-step {
            text-align: left;
            margin: 5px 0;
            padding: 8px;
            border-left: 3px solid var(--secondary-color);
            background-color: var(--code-bg);
            font-family: monospace;
            font-size: 13px;
            color: var(--text-color);
          }
          
          .attachments-section {
            text-align: left;
            margin: 15px 0;
          }
          
          .attachments-section h4 {
            text-align: left;
            margin-top: 0;
            margin-bottom: 8px;
            color: var(--secondary-color);
          }
          
          .screenshot, .video {
            margin: 15px 0;
          }

          .screenshot img {
            max-width: 100%;
            border: 1px solid var(--border-color);
            border-radius: 4px;
            box-shadow: 0 2px 4px rgba(0,0,0,0.1);
          }

          .video video {
            max-width: 100%;
            border: 1px solid var(--border-color);
            border-radius: 4px;
            box-shadow: 0 2px 4px rgba(0,0,0,0.1);
          }
          
          .video-link {
            text-align: left;
            margin: 10px 0;
            background-color: var(--code-bg);
            padding: 10px;
            border-radius: 4px;
            color: var(--text-color);
          }
          
          .footer {
            margin-top: 30px;
            padding-top: 15px;
            border-top: 1px solid var(--border-color);
            font-size: 12px;
            color: var(--text-color);
            text-align: center;
          }
          
          .footer p {
            margin: 5px 0;
            text-align: center;
          }

          .success-message {
            text-align: center;
            margin-bottom: 20px;
          }

          .success-message h2 {
            color: var(--success-color);
          }

          @media (max-width: 600px) {
            .summary-grid {
              grid-template-columns: repeat(2, 1fr);
            }
          }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>${title}</h1>
          </div>
          
          ${content}
          
          <div class="footer">
            <p>This is an automated message from the Playwright Test Runner.</p>
            <p>Generated on: ${new Date().toLocaleString()}</p>
            <p>Test run completed in: ${this.formatDuration(
              this.testRunSummary.duration
            )}</p>
          </div>
        </div>
      </body>
      </html>
    `;
  }
}

export default EmailReporter;
