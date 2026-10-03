import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { sendEmail, emailTemplate } from '../config/email';
import { AppError } from '../middleware/errorHandler';
import { escapeHtml, stripLineBreaks } from '../utils/html';

const router = Router();

const contactSalesSchema = z.object({
  name: z.string().min(1).max(200),
  email: z.string().email().max(300),
  company: z.string().max(200).optional().default(''),
  message: z.string().min(1).max(5000),
});

// POST /api/contact-sales — public, no auth required
router.post(
  '/',
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const parsed = contactSalesSchema.safeParse(req.body);
      if (!parsed.success) {
        throw new AppError(400, 'Invalid form data', 'VALIDATION_ERROR');
      }

      const { name, email, company, message } = parsed.data;

      const html = emailTemplate(`
        <h2 style="color: #1A1A1A; font-size: 18px; margin: 0 0 16px;">Enterprise Inquiry</h2>
        <table style="width: 100%; border-collapse: collapse; font-size: 14px;">
          <tr>
            <td style="padding: 8px 0; color: #6B7280; width: 100px;">Name</td>
            <td style="padding: 8px 0; color: #1A1A1A; font-weight: 500;">${escapeHtml(name)}</td>
          </tr>
          <tr>
            <td style="padding: 8px 0; color: #6B7280;">Email</td>
            <td style="padding: 8px 0; color: #1A1A1A;"><a href="mailto:${escapeHtml(email)}" style="color: #25D366;">${escapeHtml(email)}</a></td>
          </tr>
          ${company ? `<tr><td style="padding: 8px 0; color: #6B7280;">Company</td><td style="padding: 8px 0; color: #1A1A1A;">${escapeHtml(company)}</td></tr>` : ''}
        </table>
        <div style="margin-top: 16px; padding: 16px; background: #F5F0EB; border-radius: 8px;">
          <p style="color: #6B7280; font-size: 12px; margin: 0 0 4px;">Message</p>
          <p style="color: #1A1A1A; font-size: 14px; margin: 0; white-space: pre-wrap;">${escapeHtml(message)}</p>
        </div>
      `);

      await sendEmail({
        to: 'dysruptia1000@gmail.com',
        subject: `GenSmart Enterprise Inquiry from ${stripLineBreaks(name)}`,
        html,
      });

      res.json({ success: true });
    } catch (err) {
      next(err);
    }
  }
);

export default router;
