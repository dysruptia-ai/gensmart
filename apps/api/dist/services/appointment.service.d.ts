export interface AppointmentData {
    calendarId: string;
    contactId?: string | null;
    conversationId?: string | null;
    title: string;
    description?: string | null;
    startTime: string;
    endTime: string;
    status?: string;
}
export interface AppointmentRow {
    id: string;
    calendar_id: string;
    contact_id: string | null;
    conversation_id: string | null;
    organization_id: string;
    title: string;
    description: string | null;
    start_time: string;
    end_time: string;
    status: string;
    reminder_sent: boolean;
    created_at: string;
    updated_at: string;
    contact_name?: string | null;
    contact_phone?: string | null;
    calendar_name?: string | null;
    calendar_timezone?: string | null;
    agent_id?: string | null;
    agent_name?: string | null;
}
export interface AppointmentFilters {
    calendarId?: string;
    status?: string;
    fromDate?: string;
    toDate?: string;
    agentId?: string;
}
export declare function createAppointment(orgId: string, data: AppointmentData): Promise<AppointmentRow>;
export declare function getAppointments(orgId: string, filters?: AppointmentFilters): Promise<AppointmentRow[]>;
export declare function getAppointment(orgId: string, appointmentId: string): Promise<AppointmentRow | null>;
export declare function updateAppointment(orgId: string, appointmentId: string, data: Partial<AppointmentData>): Promise<AppointmentRow | null>;
export declare function cancelAppointment(orgId: string, appointmentId: string): Promise<AppointmentRow | null>;
//# sourceMappingURL=appointment.service.d.ts.map