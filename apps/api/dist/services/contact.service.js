"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getContacts = getContacts;
exports.getContactById = getContactById;
exports.updateContact = updateContact;
exports.deleteContact = deleteContact;
exports.getContactConversations = getContactConversations;
exports.getContactTimeline = getContactTimeline;
exports.updateContactStage = updateContactStage;
exports.exportContactsCSV = exportContactsCSV;
exports.checkContactLimit = checkContactLimit;
const database_1 = require("../config/database");
const shared_1 = require("@gensmart/shared");
async function getContacts(orgId, filters) {
    const { search, agentId, funnelStage, scoreMin, scoreMax, sortBy = 'created_at', sortOrder = 'desc', page = 1, limit = 20, } = filters;
    const pageNum = Math.max(1, page);
    const limitNum = Math.min(100, Math.max(1, limit));
    const offset = (pageNum - 1) * limitNum;
    const conditions = ['c.organization_id = $1'];
    const filterParams = [orgId];
    let paramIndex = 2;
    if (search) {
        conditions.push(`(c.name ILIKE $${paramIndex} OR c.email ILIKE $${paramIndex} OR c.phone ILIKE $${paramIndex})`);
        filterParams.push(`%${search}%`);
        paramIndex++;
    }
    if (agentId) {
        conditions.push(`c.agent_id = $${paramIndex}`);
        filterParams.push(agentId);
        paramIndex++;
    }
    if (funnelStage) {
        conditions.push(`c.funnel_stage = $${paramIndex}`);
        filterParams.push(funnelStage);
        paramIndex++;
    }
    if (scoreMin !== undefined) {
        conditions.push(`c.ai_score >= $${paramIndex}`);
        filterParams.push(scoreMin);
        paramIndex++;
    }
    if (scoreMax !== undefined) {
        conditions.push(`c.ai_score <= $${paramIndex}`);
        filterParams.push(scoreMax);
        paramIndex++;
    }
    const where = conditions.join(' AND ');
    const allowedSort = {
        created_at: 'c.created_at',
        name: 'c.name',
        ai_score: 'c.ai_score',
        funnel_stage: 'c.funnel_stage',
        updated_at: 'c.updated_at',
    };
    const sortColumn = allowedSort[sortBy] ?? 'c.created_at';
    const sortDir = sortOrder === 'asc' ? 'ASC' : 'DESC';
    const countResult = await (0, database_1.query)(`SELECT COUNT(*) as count FROM contacts c WHERE ${where}`, filterParams);
    const total = parseInt(countResult.rows[0]?.count ?? '0', 10);
    const limitIdx = paramIndex;
    const offsetIdx = paramIndex + 1;
    const result = await (0, database_1.query)(`SELECT c.*, a.name as agent_name
     FROM contacts c
     LEFT JOIN agents a ON c.agent_id = a.id
     WHERE ${where}
     ORDER BY ${sortColumn} ${sortDir}
     LIMIT $${limitIdx} OFFSET $${offsetIdx}`, [...filterParams, limitNum, offset]);
    return {
        contacts: result.rows,
        total,
        page: pageNum,
        limit: limitNum,
        totalPages: Math.ceil(total / limitNum),
    };
}
async function getContactById(orgId, contactId) {
    const result = await (0, database_1.query)(`SELECT c.*, a.name as agent_name
     FROM contacts c
     LEFT JOIN agents a ON c.agent_id = a.id
     WHERE c.id = $1 AND c.organization_id = $2`, [contactId, orgId]);
    return result.rows[0] ?? null;
}
async function updateContact(orgId, contactId, data) {
    const setClauses = [];
    const params = [];
    let paramIndex = 1;
    if (data.name !== undefined) {
        setClauses.push(`name = $${paramIndex}`);
        params.push(data.name);
        paramIndex++;
    }
    if (data.phone !== undefined) {
        setClauses.push(`phone = $${paramIndex}`);
        params.push(data.phone);
        paramIndex++;
    }
    if (data.email !== undefined) {
        setClauses.push(`email = $${paramIndex}`);
        params.push(data.email);
        paramIndex++;
    }
    if (data.funnel_stage !== undefined) {
        setClauses.push(`funnel_stage = $${paramIndex}`);
        params.push(data.funnel_stage);
        paramIndex++;
        setClauses.push(`funnel_updated_at = NOW()`);
    }
    if (data.tags !== undefined) {
        setClauses.push(`tags = $${paramIndex}`);
        params.push(JSON.stringify(data.tags));
        paramIndex++;
    }
    if (data.notes !== undefined) {
        setClauses.push(`notes = $${paramIndex}`);
        params.push(data.notes);
        paramIndex++;
    }
    if (setClauses.length === 0) {
        return getContactById(orgId, contactId);
    }
    setClauses.push(`updated_at = NOW()`);
    params.push(contactId, orgId);
    const result = await (0, database_1.query)(`UPDATE contacts SET ${setClauses.join(', ')}
     WHERE id = $${paramIndex} AND organization_id = $${paramIndex + 1}
     RETURNING *`, params);
    return result.rows[0] ?? null;
}
async function deleteContact(orgId, contactId) {
    const client = await (0, database_1.getClient)();
    try {
        await client.query('BEGIN');
        // 1. Delete messages from this contact's conversations
        await client.query(`DELETE FROM messages WHERE conversation_id IN (
        SELECT id FROM conversations WHERE contact_id = $1 AND organization_id = $2
      )`, [contactId, orgId]);
        // 2. Unlink appointments (keep appointments, remove contact + conversation references)
        await client.query(`UPDATE appointments SET contact_id = NULL, conversation_id = NULL
       WHERE contact_id = $1
          OR conversation_id IN (
            SELECT id FROM conversations WHERE contact_id = $1 AND organization_id = $2
          )`, [contactId, orgId]);
        // 3. Delete conversations
        await client.query('DELETE FROM conversations WHERE contact_id = $1 AND organization_id = $2', [contactId, orgId]);
        // 4. Delete the contact
        const result = await client.query('DELETE FROM contacts WHERE id = $1 AND organization_id = $2', [contactId, orgId]);
        await client.query('COMMIT');
        return (result.rowCount ?? 0) > 0;
    }
    catch (err) {
        await client.query('ROLLBACK');
        throw err;
    }
    finally {
        client.release();
    }
}
async function getContactConversations(orgId, contactId) {
    const result = await (0, database_1.query)(`SELECT c.id, c.agent_id, a.name as agent_name, c.channel, c.status,
            c.message_count, c.last_message_at, c.created_at
     FROM conversations c
     LEFT JOIN agents a ON c.agent_id = a.id
     WHERE c.contact_id = $1 AND c.organization_id = $2
     ORDER BY c.created_at DESC`, [contactId, orgId]);
    return result.rows;
}
async function getContactTimeline(orgId, contactId) {
    const check = await (0, database_1.query)('SELECT id FROM contacts WHERE id = $1 AND organization_id = $2', [contactId, orgId]);
    if (!check.rows[0])
        return [];
    const convResult = await (0, database_1.query)(`SELECT id, created_at, channel, status, last_message_at
     FROM conversations WHERE contact_id = $1 ORDER BY created_at DESC`, [contactId]);
    const events = [];
    for (const conv of convResult.rows) {
        events.push({
            type: 'conversation_started',
            description: `Conversation started via ${conv.channel}`,
            date: conv.created_at,
            metadata: { conversationId: conv.id, channel: conv.channel },
        });
        if (conv.status === 'closed' && conv.last_message_at) {
            events.push({
                type: 'conversation_closed',
                description: 'Conversation closed',
                date: conv.last_message_at,
                metadata: { conversationId: conv.id },
            });
        }
    }
    events.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    return events;
}
async function updateContactStage(orgId, contactId, newStage) {
    const validStages = ['lead', 'opportunity', 'customer'];
    if (!validStages.includes(newStage)) {
        throw new Error(`Invalid stage. Must be one of: ${validStages.join(', ')}`);
    }
    const result = await (0, database_1.query)(`UPDATE contacts
     SET funnel_stage = $1, funnel_updated_at = NOW(), updated_at = NOW()
     WHERE id = $2 AND organization_id = $3
     RETURNING *`, [newStage, contactId, orgId]);
    return result.rows[0] ?? null;
}
async function exportContactsCSV(orgId, filters) {
    const { contacts } = await getContacts(orgId, { ...filters, limit: 10000, page: 1 });
    const escape = (val) => {
        const str = String(val ?? '');
        return str.includes(',') || str.includes('"') || str.includes('\n')
            ? `"${str.replace(/"/g, '""')}"`
            : str;
    };
    const header = 'name,phone,email,agent,score,stage,service,source,created_at';
    const rows = contacts.map((c) => [
        escape(c.name),
        escape(c.phone),
        escape(c.email),
        escape(c.agent_name),
        escape(c.ai_score),
        escape(c.funnel_stage),
        escape(c.ai_service),
        escape(c.source_channel),
        escape(c.created_at),
    ].join(','));
    return [header, ...rows].join('\n');
}
async function checkContactLimit(orgId, plan) {
    const planKey = plan;
    const limits = shared_1.PLAN_LIMITS[planKey] ?? shared_1.PLAN_LIMITS.free;
    const contactLimit = limits.contacts;
    const result = await (0, database_1.query)('SELECT COUNT(*) as count FROM contacts WHERE organization_id = $1', [orgId]);
    const current = parseInt(result.rows[0]?.count ?? '0', 10);
    const isAllowed = !isFinite(contactLimit) || current < contactLimit;
    const limitNum = isFinite(contactLimit) ? contactLimit : -1;
    return { allowed: isAllowed, current, limit: limitNum };
}
//# sourceMappingURL=contact.service.js.map