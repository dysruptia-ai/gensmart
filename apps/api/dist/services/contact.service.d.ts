export interface ContactFilters {
    search?: string;
    agentId?: string;
    funnelStage?: string;
    scoreMin?: number;
    scoreMax?: number;
    sortBy?: string;
    sortOrder?: 'asc' | 'desc';
    page?: number;
    limit?: number;
}
export interface ContactRow {
    id: string;
    organization_id: string;
    agent_id: string | null;
    agent_name?: string | null;
    name: string | null;
    phone: string | null;
    email: string | null;
    avatar_url: string | null;
    ai_summary: string | null;
    ai_score: number | null;
    ai_service: string | null;
    funnel_stage: string;
    funnel_updated_at: string | null;
    custom_variables: Record<string, unknown>;
    source_channel: string | null;
    tags: string[];
    notes: string | null;
    created_at: string;
    updated_at: string;
}
export interface UpdateContactData {
    name?: string;
    phone?: string;
    email?: string;
    funnel_stage?: string;
    tags?: string[];
    notes?: string;
}
export declare function getContacts(orgId: string, filters: ContactFilters): Promise<{
    contacts: ContactRow[];
    total: number;
    page: number;
    limit: number;
    totalPages: number;
}>;
export declare function getContactById(orgId: string, contactId: string): Promise<ContactRow | null>;
export declare function updateContact(orgId: string, contactId: string, data: UpdateContactData): Promise<ContactRow | null>;
export declare function deleteContact(orgId: string, contactId: string): Promise<boolean>;
export declare function getContactConversations(orgId: string, contactId: string): Promise<{
    id: string;
    agent_id: string;
    agent_name: string | null;
    channel: string;
    status: string;
    message_count: number;
    last_message_at: string | null;
    created_at: string;
}[]>;
export declare function getContactTimeline(orgId: string, contactId: string): Promise<{
    type: string;
    description: string;
    date: string;
    metadata?: Record<string, unknown>;
}[]>;
export declare function updateContactStage(orgId: string, contactId: string, newStage: string): Promise<ContactRow | null>;
export declare function exportContactsCSV(orgId: string, filters: ContactFilters): Promise<string>;
export declare function checkContactLimit(orgId: string, plan: string): Promise<{
    allowed: boolean;
    current: number;
    limit: number;
}>;
//# sourceMappingURL=contact.service.d.ts.map