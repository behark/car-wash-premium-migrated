declare module 'nodemailer' {
  interface MailOptions {
    from?: string;
    to?: string;
    subject?: string;
    text?: string;
    html?: string;
  }

  interface Transporter {
    sendMail(mailOptions: MailOptions): Promise<any>;
  }

  interface TransporterConfig {
    host?: string;
    port?: number;
    secure?: boolean;
    auth?: {
      user?: string;
      pass?: string;
    };
    tls?: {
      rejectUnauthorized?: boolean;
    };
  }

  function createTransport(config: TransporterConfig): Transporter;

  const nodemailer = { createTransport };
  export = nodemailer;
  export default nodemailer;
}