const nodemailer = require("nodemailer");
const handlebars = require("handlebars");
const fs = require("fs");
const path = require("path");
const config = require("../config/config");
const logger = require("../utils/logger");

class EmailService {
  constructor() {
    this.transporter = nodemailer.createTransport({
      host: config.email.host,
      port: config.email.port,
      secure: false,
      auth: {
        user: config.email.user,
        pass: config.email.pass,
      },
    });
  }

  // send email with separate template
  async sendEmail(options) {
    try {
      const mailOptions = {
        from: `3rd Hand Art Marketplace <${config.email.user}>`,
        to: options.email,
        subject: options.subject,
        html: options.html,
        text: options.text,
      };

      await this.transporter.sendMail(mailOptions);
      logger.info(
        `Email sent to ${options.email} with subject: ${options.subject}`
      );
    } catch (error) {
      logger.error(`Error sending email: ${error.message}`);
      throw new Error("Email could not be sent");
    }
  }

  // send OTP verification email
  async sendOTPVerification(email, username, otp) {
    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #333;">Welcome to 3rd Hand Art Marketplace!</h2>
        <p>Hello ${username},</p>
        <p>Thank you for registering with 3rd Hand. Please verify your email address using the OTP below:</p>
        <div style="background-color: #f4f4f4; padding: 20px; text-align: center; margin: 20px 0;">
          <h1 style="color: #007bff; font-size: 32px; margin: 0;">${otp}</h1>
        </div>
        <p>This OTP will expire in 10 minutes.</p>
        <p>If you didn't create an account with us, please ignore this email.</p>
        <p>Best regards,<br>3rd Hand Art Marketplace Team</p>
      </div>
    `;

    await this.sendEmail({
      email,
      subject: "Verify Your Email - 3rd Hand Art Marketplace",
      html,
    });
  }

  // send password reset email
  async sendPasswordReset(email, username, resetURL) {
    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #333;">Password Reset Request</h2>
        <p>Hello ${username},</p>
        <p>You requested a password reset for your 3rd Hand Art Marketplace account.</p>
        <p>Click the button below to reset your password:</p>
        <div style="text-align: center; margin: 30px 0;">
          <a href="${resetURL}" style="background-color: #007bff; color: white; padding: 15px 30px; text-decoration: none; border-radius: 5px; display: inline-block;">Reset Password</a>
        </div>
        <p>This link will expire in 10 minutes.</p>
        <p>If you didn't request a password reset, please ignore this email.</p>
        <p>Best regards,<br>3rd Hand Art Marketplace Team</p>
      </div>
    `;

    await this.sendEmail({
      email,
      subject: "Password Reset - 3rd Hand Art Marketplace",
      html,
    });
  }

  // Send welcome email after verification
  async sendWelcomeEmail(email, username, role) {
    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #333;">Welcome to 3rd Hand Art Marketplace!</h2>
        <p>Hello ${username},</p>
        <p>Your account has been successfully verified! Welcome to the 3rd Hand community.</p>
        ${
          role === "artist"
            ? "<p>As an artist, you can now start uploading your artwork and reach art lovers worldwide. Remember, there's a €1 listing fee for each artwork you post.</p>"
            : "<p>As a buyer, you can now browse and purchase amazing artwork from talented artists around the world.</p>"
        }
        <div style="text-align: center; margin: 30px 0;">
          <a href="${
            config.frontendUrl
          }/dashboard" style="background-color: #28a745; color: white; padding: 15px 30px; text-decoration: none; border-radius: 5px; display: inline-block;">Go to Dashboard</a>
        </div>
        <p>If you have any questions, feel free to contact our support team.</p>
        <p>Best regards,<br>3rd Hand Art Marketplace Team</p>
      </div>
    `;

    await this.sendEmail({
      email,
      subject: "Welcome to 3rd Hand Art Marketplace!",
      html,
    });
  }
}

module.exports = new EmailService();
