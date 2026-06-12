interface UserInfo {
    name: string;
    email: string;
}
export declare function getFrontendUrl(): string;
export declare function emailTemplate(content: string): string;
export declare function sendEmail({ to, subject, html, cc, from, replyTo, }: {
    to: string;
    subject: string;
    html: string;
    cc?: string | string[];
    from?: string;
    replyTo?: string;
}): Promise<{
    messageId: string | null;
}>;
export declare function sendWelcomeEmail(user: UserInfo): Promise<void>;
export declare function sendPasswordResetEmail(user: UserInfo, token: string): Promise<void>;
export declare function sendInvitationEmail(inviterName: string, inviteeEmail: string, orgName: string, setupToken: string): Promise<void>;
export declare function sendHighScoreLeadEmail(user: UserInfo, leadInfo: {
    contactName: string;
    score: number;
    agentName: string;
    conversationUrl: string;
}): Promise<void>;
export declare function sendPlanLimitEmail(user: UserInfo, limitInfo: {
    percent: number;
    used: number;
    limit: number;
    planName: string;
}): Promise<void>;
export {};
//# sourceMappingURL=email.d.ts.map