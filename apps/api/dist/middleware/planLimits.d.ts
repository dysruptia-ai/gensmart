import { Request, Response, NextFunction } from 'express';
export declare function checkAgentLimit(): (req: Request, res: Response, next: NextFunction) => Promise<void>;
export declare function checkContactLimit(): (req: Request, res: Response, next: NextFunction) => Promise<void>;
export declare function checkKnowledgeLimit(): (req: Request, res: Response, next: NextFunction) => Promise<void>;
export declare function checkChannelAccess(channel: string): (req: Request, res: Response, next: NextFunction) => Promise<void>;
export declare function checkHumanTakeover(): (req: Request, res: Response, next: NextFunction) => Promise<void>;
export declare function checkByoKeyAccess(): (req: Request, res: Response, next: NextFunction) => Promise<void>;
export declare function checkSubAccountLimit(): (req: Request, res: Response, next: NextFunction) => Promise<void>;
//# sourceMappingURL=planLimits.d.ts.map