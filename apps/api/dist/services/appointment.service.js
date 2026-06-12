"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createAppointment = createAppointment;
exports.getAppointments = getAppointments;
exports.getAppointment = getAppointment;
exports.updateAppointment = updateAppointment;
exports.cancelAppointment = cancelAppointment;
const database_1 = require("../config/database");
async function createAppointment(orgId, data) {
    // Validate no overlap
    const overlapResult = await (0, database_1.query)(`SELECT id FROM appointments
     WHERE calendar_id = $1
       AND status != 'cancelled'
       AND tstzrange(start_time, end_time) && tstzrange($2::timestamptz, $3::timestamptz)`, [data.calendarId, data.startTime, data.endTime]);
    if (overlapResult.rows.length > 0) {
        throw new Error('This time slot is already booked');
    }
    const result = await (0, database_1.query)(`INSERT INTO appointments
       (organization_id, calendar_id, contact_id, conversation_id, title, description,
        start_time, end_time, status)
     VALUES ($1, $2, $3, $4, $5, $6, $7::timestamptz, $8::timestamptz, COALESCE($9, 'scheduled'))
     RETURNING *`, [
        orgId,
        data.calendarId,
        data.contactId ?? null,
        data.conversationId ?? null,
        data.title,
        data.description ?? null,
        data.startTime,
        data.endTime,
        data.status ?? null,
    ]);
    return result.rows[0];
}
async function getAppointments(orgId, filters = {}) {
    const conditions = ['a.organization_id = $1'];
    const values = [orgId];
    let idx = 2;
    if (filters.calendarId) {
        conditions.push(`a.calendar_id = $${idx++}`);
        values.push(filters.calendarId);
    }
    if (filters.status) {
        conditions.push(`a.status = $${idx++}`);
        values.push(filters.status);
    }
    if (filters.fromDate) {
        conditions.push(`a.start_time >= $${idx++}::timestamptz`);
        values.push(filters.fromDate);
    }
    if (filters.toDate) {
        conditions.push(`a.start_time <= $${idx++}::timestamptz`);
        values.push(filters.toDate);
    }
    if (filters.agentId) {
        conditions.push(`cal.agent_id = $${idx++}`);
        values.push(filters.agentId);
    }
    const result = await (0, database_1.query)(`SELECT a.*,
            c.name AS contact_name,
            c.phone AS contact_phone,
            cal.name AS calendar_name,
            COALESCE(cal.timezone, 'UTC') AS calendar_timezone,
            cal.agent_id,
            ag.name AS agent_name
     FROM appointments a
     LEFT JOIN contacts c ON c.id = a.contact_id
     LEFT JOIN calendars cal ON cal.id = a.calendar_id
     LEFT JOIN agents ag ON ag.id = cal.agent_id
     WHERE ${conditions.join(' AND ')}
     ORDER BY a.start_time ASC`, values);
    return result.rows;
}
async function getAppointment(orgId, appointmentId) {
    const result = await (0, database_1.query)(`SELECT a.*,
            c.name AS contact_name,
            c.phone AS contact_phone,
            cal.name AS calendar_name,
            COALESCE(cal.timezone, 'UTC') AS calendar_timezone,
            cal.agent_id,
            ag.name AS agent_name
     FROM appointments a
     LEFT JOIN contacts c ON c.id = a.contact_id
     LEFT JOIN calendars cal ON cal.id = a.calendar_id
     LEFT JOIN agents ag ON ag.id = cal.agent_id
     WHERE a.id = $1 AND a.organization_id = $2`, [appointmentId, orgId]);
    return result.rows[0] ?? null;
}
async function updateAppointment(orgId, appointmentId, data) {
    const setClauses = ['updated_at = NOW()'];
    const values = [];
    let idx = 1;
    if (data.title !== undefined) {
        setClauses.push(`title = $${idx++}`);
        values.push(data.title);
    }
    if (data.description !== undefined) {
        setClauses.push(`description = $${idx++}`);
        values.push(data.description);
    }
    if (data.startTime !== undefined) {
        setClauses.push(`start_time = $${idx++}::timestamptz`);
        values.push(data.startTime);
    }
    if (data.endTime !== undefined) {
        setClauses.push(`end_time = $${idx++}::timestamptz`);
        values.push(data.endTime);
    }
    if (data.status !== undefined) {
        setClauses.push(`status = $${idx++}`);
        values.push(data.status);
    }
    if (data.contactId !== undefined) {
        setClauses.push(`contact_id = $${idx++}`);
        values.push(data.contactId);
    }
    values.push(appointmentId, orgId);
    const result = await (0, database_1.query)(`UPDATE appointments SET ${setClauses.join(', ')}
     WHERE id = $${idx++} AND organization_id = $${idx}
     RETURNING *`, values);
    return result.rows[0] ?? null;
}
async function cancelAppointment(orgId, appointmentId) {
    const result = await (0, database_1.query)(`UPDATE appointments
     SET status = 'cancelled', updated_at = NOW()
     WHERE id = $1 AND organization_id = $2
     RETURNING *`, [appointmentId, orgId]);
    return result.rows[0] ?? null;
}
//# sourceMappingURL=appointment.service.js.map