const transporter = require('../config/emailTransporter');
const { MESSAGES } = require('../config/constants');
const ApiError = require('./ApiError');


/**
 * Sends an email using Nodemailer
 * @param {Object} options
 * @param {string} options.to - Receiver email
 * @param {string} options.subject - Email subject
 * @param {string} options.html - Email HTML body
 * @param {string} [options.text] - Email plain text body
 * @returns {Promise<{success: boolean, messageId: string}>}
 */
const sendEmail = async ({ to, subject, html, text }) => {
    try {
        const mailOptions = {
            from: {
                name: MESSAGES.EMAIL.FROM_NAME,
                address: process.env.EMAIL,
            },
            to,
            subject,
            html,
            text,
        };

        const info = await transporter.sendMail(mailOptions);
        return { success: true, messageId: info.messageId };
    } catch (error) {
        console.error('Email sending failed:', error);
        throw new ApiError(500, MESSAGES.EMAIL.SEND_FAILED);
    }
};

module.exports = sendEmail;

