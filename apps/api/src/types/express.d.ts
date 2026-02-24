import { JwtPayload } from '../middleware/auth';

declare global {
  namespace Express {
    interface Request {
      user?: JwtPayload;
      org?: {
        id: string;
        name: string;
        slug: string;
        plan: string;
        subscription_status: string;
      };
    }
  }
}

export {};
