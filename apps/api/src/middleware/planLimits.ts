import { Request, Response, NextFunction } from 'express';
import { PLAN_LIMITS } from '@gensmart/shared';

type PlanKey = keyof typeof PLAN_LIMITS;

export function checkPlanLimit(limitKey: keyof typeof PLAN_LIMITS[PlanKey]) {
  return async (_req: Request, _res: Response, next: NextFunction): Promise<void> => {
    // Placeholder - full implementation in Phase 8
    void limitKey;
    next();
  };
}
