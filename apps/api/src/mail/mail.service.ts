import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';

interface EmailOptions {
  to: string;
  subject: string;
  html: string;
}

@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);
  private transporter: nodemailer.Transporter | null = null;

  constructor(private configService: ConfigService) {
    this.initializeTransporter();
  }

  private initializeTransporter() {
    const host = this.configService.get<string>('SMTP_HOST');
    const port = this.configService.get<number>('SMTP_PORT');
    const user = this.configService.get<string>('SMTP_USER');
    const pass = this.configService.get<string>('SMTP_PASS');

    if (host && user && pass) {
      this.transporter = nodemailer.createTransport({
        host,
        port: port || 587,
        secure: port === 465,
        auth: {
          user,
          pass,
        },
      });
      this.logger.log('Email transporter initialized');
    } else {
      this.logger.warn('Email not configured - emails will be logged to console');
    }
  }

  async sendEmail(options: EmailOptions): Promise<void> {
    const from = this.configService.get<string>('MAIL_FROM') || 'noreply@nova.app';

    if (this.transporter) {
      try {
        await this.transporter.sendMail({
          from,
          to: options.to,
          subject: options.subject,
          html: options.html,
        });
        this.logger.log(`Email sent to ${options.to}`);
      } catch (error) {
        this.logger.error(`Failed to send email to ${options.to}`, error);
        throw error;
      }
    } else {
      // Log email content in development
      this.logger.log('===== EMAIL (DEV MODE) =====');
      this.logger.log(`To: ${options.to}`);
      this.logger.log(`Subject: ${options.subject}`);
      this.logger.log(`Body: ${options.html}`);
      this.logger.log('===== END EMAIL =====');
    }
  }

  async sendPasswordResetEmail(to: string, resetToken: string): Promise<void> {
    const frontendUrl = this.configService.get<string>('FRONTEND_URL') || 'http://localhost:3000';
    const resetUrl = `${frontendUrl}/reset-password?token=${resetToken}&email=${encodeURIComponent(to)}`;

    await this.sendEmail({
      to,
      subject: 'NOVA - Restablecer contraseña',
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
        </head>
        <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: #0f172a; color: #e2e8f0; padding: 40px 20px;">
          <div style="max-width: 600px; margin: 0 auto; background: linear-gradient(135deg, #1e293b 0%, #0f172a 100%); border-radius: 16px; padding: 40px; border: 1px solid #334155;">
            <div style="text-align: center; margin-bottom: 32px;">
              <h1 style="color: #a855f7; margin: 0; font-size: 32px;">NOVA</h1>
              <p style="color: #94a3b8; margin-top: 8px;">Tu coach de deficit calorico</p>
            </div>

            <h2 style="color: #f8fafc; font-size: 24px; margin-bottom: 16px;">Restablecer contraseña</h2>

            <p style="color: #cbd5e1; line-height: 1.6; margin-bottom: 24px;">
              Recibimos una solicitud para restablecer la contraseña de tu cuenta. Haz clic en el botón de abajo para crear una nueva contraseña:
            </p>

            <div style="text-align: center; margin: 32px 0;">
              <a href="${resetUrl}" style="display: inline-block; background: linear-gradient(135deg, #a855f7 0%, #6366f1 100%); color: white; text-decoration: none; padding: 14px 32px; border-radius: 8px; font-weight: 600; font-size: 16px;">
                Restablecer contraseña
              </a>
            </div>

            <p style="color: #94a3b8; font-size: 14px; margin-top: 24px;">
              Este enlace expira en 1 hora. Si no solicitaste este cambio, puedes ignorar este email.
            </p>

            <hr style="border: none; border-top: 1px solid #334155; margin: 32px 0;">

            <p style="color: #64748b; font-size: 12px; text-align: center;">
              Este email fue enviado por NOVA. Si tienes preguntas, contactanos.
            </p>
          </div>
        </body>
        </html>
      `,
    });
  }

  async sendWelcomeEmail(to: string, name: string): Promise<void> {
    const frontendUrl = this.configService.get<string>('FRONTEND_URL') || 'http://localhost:3000';

    await this.sendEmail({
      to,
      subject: 'Bienvenido a NOVA',
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
        </head>
        <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: #0f172a; color: #e2e8f0; padding: 40px 20px;">
          <div style="max-width: 600px; margin: 0 auto; background: linear-gradient(135deg, #1e293b 0%, #0f172a 100%); border-radius: 16px; padding: 40px; border: 1px solid #334155;">
            <div style="text-align: center; margin-bottom: 32px;">
              <h1 style="color: #a855f7; margin: 0; font-size: 32px;">NOVA</h1>
              <p style="color: #94a3b8; margin-top: 8px;">Tu coach de deficit calorico</p>
            </div>

            <h2 style="color: #f8fafc; font-size: 24px; margin-bottom: 16px;">Hola ${name}!</h2>

            <p style="color: #cbd5e1; line-height: 1.6; margin-bottom: 24px;">
              Bienvenido a NOVA. Estoy aqui para ayudarte a alcanzar tus objetivos de salud y bienestar.
            </p>

            <p style="color: #cbd5e1; line-height: 1.6; margin-bottom: 24px;">
              Con NOVA puedes:
            </p>

            <ul style="color: #cbd5e1; line-height: 1.8; padding-left: 20px;">
              <li>Registrar tus comidas y ejercicio de forma natural</li>
              <li>Recibir coaching personalizado para tu deficit calorico</li>
              <li>Seguir tu progreso de peso</li>
              <li>Obtener recomendaciones inteligentes</li>
            </ul>

            <div style="text-align: center; margin: 32px 0;">
              <a href="${frontendUrl}/chat" style="display: inline-block; background: linear-gradient(135deg, #a855f7 0%, #6366f1 100%); color: white; text-decoration: none; padding: 14px 32px; border-radius: 8px; font-weight: 600; font-size: 16px;">
                Comenzar ahora
              </a>
            </div>

            <hr style="border: none; border-top: 1px solid #334155; margin: 32px 0;">

            <p style="color: #64748b; font-size: 12px; text-align: center;">
              Este email fue enviado por NOVA. Si tienes preguntas, contactanos.
            </p>
          </div>
        </body>
        </html>
      `,
    });
  }
}
