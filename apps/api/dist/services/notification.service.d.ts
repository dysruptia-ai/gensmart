export interface Notification {
    id: string;
    userId: string;
    organizationId: string;
    type: string;
    title: string;
    message: string;
    data: Record<string, unknown> | null;
    read: boolean;
    readAt: string | null;
    emailSent: boolean;
    createdAt: string;
}
export interface CreateNotificationParams {
    userId?: string;
    organizationId: string;
    type: string;
    title: string;
    message: string;
    data?: Record<string, unknown>;
    sendEmail?: boolean;
}
export declare function createNotification(params: CreateNotificationParams): Promise<Notification>;
export declare function listNotifications(userId: string, orgId: string, options?: {
    limit?: number;
    offset?: number;
}): Promise<{
    notifications: Notification[];
    total: number;
}>;
export declare function markAsRead(notificationId: string, userId: string): Promise<void>;
export declare function markAllAsRead(userId: string, orgId: string): Promise<number>;
export declare function getUnreadCount(userId: string, orgId: string): Promise<number>;
//# sourceMappingURL=notification.service.d.ts.map