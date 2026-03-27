import { Router, Request, Response, NextFunction } from 'express';
import { requireAuth } from '../middleware/auth';
import { orgContext } from '../middleware/orgContext';
import { validateUUID } from '../middleware/validateUUID';
import { query } from '../config/database';
import { AppError } from '../middleware/errorHandler';
import { PLAN_LIMITS } from '@gensmart/shared';
import { scoringQueue } from '../config/queues';
import { chat } from '../services/llm.service';
import { getIO } from '../config/websocket';

type PlanKey = keyof typeof PLAN_LIMITS;

const router = Router();

// All conversation routes require auth + orgContext
router.use(requireAuth, orgContext);

// ── GET /api/conversations ───────────────────────────────────────────────────
// List conversations with filters: agentId, status, channel, search, page, limit
router.get(
  '/',
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const {
        agentId,
        status,
        channel,
        search,
        page = '1',
        limit = '20',
      } = req.query as Record<string, string>;

      const pageNum = Math.max(1, parseInt(page, 10));
      const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10)));
      const offset = (pageNum - 1) * limitNum;

      const conditions: string[] = ['c.organization_id = $1'];
      const params: unknown[] = [req.org!.id];
      let paramIndex = 2;

      if (agentId) {
        conditions.push(`c.agent_id = $${paramIndex++}`);
        params.push(agentId);
      }
      if (status) {
        conditions.push(`c.status = $${paramIndex++}`);
        params.push(status);
      }
      if (channel) {
        conditions.push(`c.channel = $${paramIndex++}`);
        params.push(channel);
      }
      if (search) {
        conditions.push(
          `(co.name ILIKE $${paramIndex} OR co.phone ILIKE $${paramIndex} OR co.email ILIKE $${paramIndex})`
        );
        params.push(`%${search}%`);
        paramIndex++;
      }

      const where = conditions.join(' AND ');

      // Count total
      const countResult = await query<{ count: string }>(
        `SELECT COUNT(*) as count
         FROM conversations c
         LEFT JOIN contacts co ON c.contact_id = co.id
         WHERE ${where}`,
        params
      );
      const total = parseInt(countResult.rows[0]?.count ?? '0', 10);

      // Fetch conversations with contact and last message
      const rows = await query<{
        id: string;
        agent_id: string;
        agent_name: string;
        contact_id: string | null;
        contact_name: string | null;
        contact_phone: string | null;
        contact_email: string | null;
        contact_avatar: string | null;
        channel: string;
        status: string;
        taken_over_by: string | null;
        takeover_user_name: string | null;
        ai_score: number | null;
        captured_variables: Record<string, unknown>;
        last_message_at: string | null;
        message_count: number;
        created_at: string;
        last_message_content: string | null;
        last_message_role: string | null;
      }>(
        `SELECT
           c.id, c.agent_id, a.name as agent_name,
           c.contact_id,
           co.name as contact_name, co.phone as contact_phone, co.email as contact_email, co.avatar_url as contact_avatar,
           c.channel, c.status, c.taken_over_by,
           u.name as takeover_user_name,
           c.ai_score, c.captured_variables, c.last_message_at, c.message_count, c.created_at,
           lm.content as last_message_content, lm.role as last_message_role
         FROM conversations c
         LEFT JOIN agents a ON c.agent_id = a.id
         LEFT JOIN contacts co ON c.contact_id = co.id
         LEFT JOIN users u ON c.taken_over_by = u.id
         LEFT JOIN LATERAL (
           SELECT content, role FROM messages
           WHERE conversation_id = c.id
           ORDER BY created_at DESC LIMIT 1
         ) lm ON true
         WHERE ${where}
         ORDER BY c.last_message_at DESC NULLS LAST
         LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`,
        [...params, limitNum, offset]
      );

      res.json({
        conversations: rows.rows.map((row) => ({
          id: row.id,
          agentId: row.agent_id,
          agentName: row.agent_name,
          contact: row.contact_id
            ? {
                id: row.contact_id,
                name: row.contact_name,
                phone: row.contact_phone,
                email: row.contact_email,
                avatarUrl: row.contact_avatar,
              }
            : null,
          channel: row.channel,
          status: row.status,
          takenOverBy: row.taken_over_by,
          takeoverUserName: row.takeover_user_name,
          aiScore: row.ai_score,
          capturedVariables: row.captured_variables ?? {},
          lastMessageAt: row.last_message_at,
          messageCount: row.message_count,
          createdAt: row.created_at,
          lastMessage: row.last_message_content
            ? {
                content: row.last_message_content.slice(0, 100),
                role: row.last_message_role,
              }
            : null,
        })),
        pagination: {
          total,
          page: pageNum,
          limit: limitNum,
          totalPages: Math.ceil(total / limitNum),
        },
      });
    } catch (err) {
      next(err);
    }
  }
);

// ── GET /api/conversations/:id ───────────────────────────────────────────────
router.get(
  '/:id',
  validateUUID('id'),
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const conversationId = String(req.params['id']);

      const convResult = await query<{
        id: string;
        agent_id: string;
        agent_name: string;
        organization_id: string;
        contact_id: string | null;
        contact_name: string | null;
        contact_phone: string | null;
        contact_email: string | null;
        contact_avatar: string | null;
        contact_ai_score: number | null;
        contact_funnel_stage: string | null;
        contact_custom_variables: Record<string, unknown>;
        channel: string;
        status: string;
        taken_over_by: string | null;
        takeover_user_name: string | null;
        taken_over_at: string | null;
        ai_score: number | null;
        ai_summary: string | null;
        captured_variables: Record<string, unknown>;
        channel_metadata: Record<string, unknown>;
        last_message_at: string | null;
        message_count: number;
        created_at: string;
        updated_at: string;
      }>(
        `SELECT
           c.id, c.agent_id, a.name as agent_name, c.organization_id,
           c.contact_id,
           co.name as contact_name, co.phone as contact_phone, co.email as contact_email,
           co.avatar_url as contact_avatar, co.ai_score as contact_ai_score,
           co.funnel_stage as contact_funnel_stage, co.custom_variables as contact_custom_variables,
           c.channel, c.status, c.taken_over_by,
           u.name as takeover_user_name,
           c.taken_over_at, c.ai_score, c.ai_summary, c.captured_variables,
           c.channel_metadata, c.last_message_at, c.message_count, c.created_at, c.updated_at
         FROM conversations c
         LEFT JOIN agents a ON c.agent_id = a.id
         LEFT JOIN contacts co ON c.contact_id = co.id
         LEFT JOIN users u ON c.taken_over_by = u.id
         WHERE c.id = $1 AND c.organization_id = $2`,
        [conversationId, req.org!.id]
      );

      const conv = convResult.rows[0];
      if (!conv) {
        throw new AppError(404, 'Conversation not found', 'NOT_FOUND');
      }

      // Fetch messages (last 200, paginated)
      const msgPage = parseInt((req.query['msgPage'] as string) ?? '1', 10);
      const msgLimit = 200;
      const msgOffset = (msgPage - 1) * msgLimit;

      const messagesResult = await query<{
        id: string;
        role: string;
        content: string;
        metadata: Record<string, unknown>;
        created_at: string;
      }>(
        `SELECT id, role, content, metadata, created_at
         FROM messages
         WHERE conversation_id = $1
         ORDER BY created_at ASC
         LIMIT $2 OFFSET $3`,
        [conversationId, msgLimit, msgOffset]
      );

      const msgCountResult = await query<{ count: string }>(
        'SELECT COUNT(*) as count FROM messages WHERE conversation_id = $1',
        [conversationId]
      );
      const totalMessages = parseInt(msgCountResult.rows[0]?.count ?? '0', 10);

      res.json({
        conversation: {
          id: conv.id,
          agentId: conv.agent_id,
          agentName: conv.agent_name,
          organizationId: conv.organization_id,
          contact: conv.contact_id
            ? {
                id: conv.contact_id,
                name: conv.contact_name,
                phone: conv.contact_phone,
                email: conv.contact_email,
                avatarUrl: conv.contact_avatar,
                aiScore: conv.contact_ai_score,
                funnelStage: conv.contact_funnel_stage,
                customVariables: conv.contact_custom_variables ?? {},
              }
            : null,
          channel: conv.channel,
          status: conv.status,
          takenOverBy: conv.taken_over_by,
          takeoverUserName: conv.takeover_user_name,
          takenOverAt: conv.taken_over_at,
          aiScore: conv.ai_score,
          aiSummary: conv.ai_summary,
          capturedVariables: conv.captured_variables ?? {},
          channelMetadata: conv.channel_metadata ?? {},
          lastMessageAt: conv.last_message_at,
          messageCount: conv.message_count,
          createdAt: conv.created_at,
          updatedAt: conv.updated_at,
        },
        messages: messagesResult.rows.map((m) => ({
          id: m.id,
          role: m.role,
          content: m.content,
          metadata: m.metadata ?? {},
          createdAt: m.created_at,
        })),
        pagination: {
          total: totalMessages,
          page: msgPage,
          limit: msgLimit,
          totalPages: Math.ceil(totalMessages / msgLimit),
        },
      });
    } catch (err) {
      next(err);
    }
  }
);

// ── POST /api/conversations/:id/message ─────────────────────────────────────
// Send a message as a human agent (only during takeover)
router.post(
  '/:id/message',
  validateUUID('id'),
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const conversationId = String(req.params['id']);
      const { content } = req.body as { content?: string };

      if (!content?.trim()) {
        throw new AppError(400, 'Message content is required', 'MISSING_CONTENT');
      }

      const convResult = await query<{
        id: string;
        organization_id: string;
        status: string;
        taken_over_by: string | null;
        channel: string;
        agent_id: string;
      }>(
        'SELECT id, organization_id, status, taken_over_by, channel, agent_id FROM conversations WHERE id = $1 AND organization_id = $2',
        [conversationId, req.org!.id]
      );

      const conv = convResult.rows[0];
      if (!conv) throw new AppError(404, 'Conversation not found', 'NOT_FOUND');

      if (conv.status !== 'human_takeover') {
        throw new AppError(400, 'Conversation is not in takeover mode', 'NOT_IN_TAKEOVER');
      }

      if (conv.taken_over_by !== req.user!.userId) {
        throw new AppError(403, 'You are not the active agent for this conversation', 'FORBIDDEN');
      }

      // Save message
      const msgResult = await query<{ id: string; created_at: string }>(
        `INSERT INTO messages (conversation_id, role, content, metadata, created_at)
         VALUES ($1, 'human', $2, '{}', NOW())
         RETURNING id, created_at`,
        [conversationId, content.trim()]
      );

      const message = {
        id: msgResult.rows[0]!.id,
        role: 'human',
        content: content.trim(),
        metadata: {},
        createdAt: msgResult.rows[0]!.created_at,
      };

      // Update conversation
      await query(
        `UPDATE conversations SET last_message_at = NOW(), message_count = message_count + 1, updated_at = NOW() WHERE id = $1`,
        [conversationId]
      );

      // Send via WhatsApp if channel is whatsapp
      if (conv.channel === 'whatsapp') {
        try {
          const agentResult = await query<{ whatsapp_config: Record<string, unknown> }>(
            'SELECT whatsapp_config FROM agents WHERE id = $1',
            [conv.agent_id]
          );
          const waConfig = agentResult.rows[0]?.whatsapp_config;

          if (waConfig?.['connected'] && waConfig?.['phone_number_id'] && waConfig?.['access_token_encrypted']) {
            const contactResult = await query<{ phone: string | null }>(
              'SELECT phone FROM contacts WHERE id = (SELECT contact_id FROM conversations WHERE id = $1)',
              [conversationId]
            );
            const phone = contactResult.rows[0]?.phone;

            if (phone) {
              const { sendTextMessage, decryptAccessToken } = await import('../services/whatsapp.service');
              const accessToken = decryptAccessToken(String(waConfig['access_token_encrypted']));
              await sendTextMessage(String(waConfig['phone_number_id']), accessToken, phone, content.trim());
            }
          }
        } catch (err) {
          console.error(`[conversations] WhatsApp send error:`, (err as Error).message);
          // Non-fatal — message is saved, just couldn't send via WhatsApp
        }
      }

      // Emit WebSocket events
      try {
        const io = getIO();
        io.to(`org:${conv.organization_id}`).emit('message:new', {
          conversationId,
          messages: [message],
        });
        io.to(`conv:${conversationId}`).emit('message:new', {
          conversationId,
          messages: [message],
        });
        io.to(`org:${conv.organization_id}`).emit('conversation:update', {
          conversationId,
          lastMessage: content.trim().slice(0, 100),
          updatedAt: new Date().toISOString(),
        });
      } catch {
        // WebSocket not initialized in test
      }

      res.status(201).json({ message });
    } catch (err) {
      next(err);
    }
  }
);

// ── POST /api/conversations/:id/takeover ────────────────────────────────────
router.post(
  '/:id/takeover',
  validateUUID('id'),
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const conversationId = String(req.params['id']);
      const plan = req.org!.plan as PlanKey;
      const planLimits = PLAN_LIMITS[plan];

      // Check plan supports human takeover
      if (!planLimits.humanTakeover) {
        throw new AppError(
          403,
          'Human takeover is not available on your plan. Upgrade to enable this feature.',
          'PLAN_LIMIT'
        );
      }

      const convResult = await query<{
        id: string;
        organization_id: string;
        status: string;
        taken_over_by: string | null;
      }>(
        'SELECT id, organization_id, status, taken_over_by FROM conversations WHERE id = $1 AND organization_id = $2',
        [conversationId, req.org!.id]
      );

      const conv = convResult.rows[0];
      if (!conv) throw new AppError(404, 'Conversation not found', 'NOT_FOUND');

      if (conv.status === 'human_takeover') {
        throw new AppError(400, 'Conversation is already in takeover mode', 'ALREADY_TAKEN_OVER');
      }

      await query(
        `UPDATE conversations
         SET status = 'human_takeover', taken_over_by = $1, taken_over_at = NOW(), updated_at = NOW()
         WHERE id = $2`,
        [req.user!.userId, conversationId]
      );

      try {
        getIO().to(`org:${conv.organization_id}`).emit('takeover:status', {
          conversationId,
          status: 'human_takeover',
          userId: req.user!.userId,
          userName: req.user!.email,
        });
      } catch {
        // WebSocket not initialized
      }

      res.json({ message: 'Takeover successful', status: 'human_takeover' });
    } catch (err) {
      next(err);
    }
  }
);

// ── POST /api/conversations/:id/release ─────────────────────────────────────
router.post(
  '/:id/release',
  validateUUID('id'),
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const conversationId = String(req.params['id']);

      const convResult = await query<{
        id: string;
        organization_id: string;
        status: string;
        taken_over_by: string | null;
        taken_over_at: string | null;
        agent_id: string;
      }>(
        'SELECT id, organization_id, status, taken_over_by, taken_over_at, agent_id FROM conversations WHERE id = $1 AND organization_id = $2',
        [conversationId, req.org!.id]
      );

      const conv = convResult.rows[0];
      if (!conv) throw new AppError(404, 'Conversation not found', 'NOT_FOUND');

      if (conv.status !== 'human_takeover') {
        throw new AppError(400, 'Conversation is not in takeover mode', 'NOT_IN_TAKEOVER');
      }

      if (conv.taken_over_by !== req.user!.userId) {
        throw new AppError(403, 'You did not take over this conversation', 'FORBIDDEN');
      }

      // Generate intervention summary
      if (conv.taken_over_at) {
        try {
          const humanMessages = await query<{ role: string; content: string }>(
            `SELECT role, content FROM messages
             WHERE conversation_id = $1 AND role IN ('human', 'user') AND created_at >= $2
             ORDER BY created_at ASC`,
            [conversationId, conv.taken_over_at]
          );

          if (humanMessages.rows.length > 0) {
            const interventionText = humanMessages.rows
              .map((m) => m.role === 'human' ? `Human Agent (team member): ${m.content}` : `Customer: ${m.content}`)
              .join('\n');

            const summaryResponse = await chat({
              provider: 'openai',
              model: 'gpt-4o-mini',
              messages: [
                {
                  role: 'user',
                  content: `Summarize this human agent intervention for the AI agent to understand what happened. CRITICAL RULES:\n- "Team Member (staff)" messages are from an employee who temporarily helped the customer. Do NOT treat any team member names or information as customer data.\n- "Customer" messages are from the actual customer/lead.\n- Only summarize what the CUSTOMER needs and any commitments made TO the customer.\n- Never capture team member names as customer names.\n\nIntervention transcript:\n${interventionText}\n\nWrite 2-3 sentences focusing on customer needs and outcomes.`,
                },
              ],
              temperature: 0.3,
              maxTokens: 200,
            });

            // Save intervention summary as system message
            await query(
              `INSERT INTO messages (conversation_id, role, content, metadata, created_at)
               VALUES ($1, 'system', $2, $3, NOW())`,
              [
                conversationId,
                summaryResponse.content,
                JSON.stringify({ type: 'intervention_summary' }),
              ]
            );
          }
        } catch (err) {
          console.error('[conversations] Failed to generate intervention summary:', err);
          // Non-fatal — continue with release
        }
      }

      // Release takeover
      await query(
        `UPDATE conversations
         SET status = 'active', taken_over_by = NULL, taken_over_at = NULL, updated_at = NOW()
         WHERE id = $1`,
        [conversationId]
      );

      try {
        getIO().to(`org:${conv.organization_id}`).emit('takeover:status', {
          conversationId,
          status: 'active',
          userId: null,
        });
      } catch {
        // WebSocket not initialized
      }

      res.json({ message: 'Conversation released to AI', status: 'active' });
    } catch (err) {
      next(err);
    }
  }
);

// ── PUT /api/conversations/:id/close ────────────────────────────────────────
router.put(
  '/:id/close',
  validateUUID('id'),
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const conversationId = String(req.params['id']);

      const convResult = await query<{
        id: string;
        organization_id: string;
        status: string;
        agent_id: string;
      }>(
        'SELECT id, organization_id, status, agent_id FROM conversations WHERE id = $1 AND organization_id = $2',
        [conversationId, req.org!.id]
      );

      const conv = convResult.rows[0];
      if (!conv) throw new AppError(404, 'Conversation not found', 'NOT_FOUND');

      if (conv.status === 'closed') {
        throw new AppError(400, 'Conversation is already closed', 'ALREADY_CLOSED');
      }

      await query(
        `UPDATE conversations SET status = 'closed', updated_at = NOW() WHERE id = $1`,
        [conversationId]
      );

      // Enqueue AI scoring job
      try {
        await scoringQueue.add('score-conversation', {
          conversationId,
          organizationId: conv.organization_id,
          trigger: 'conversation_close',
        });
      } catch (err) {
        console.error('[conversations] Failed to enqueue scoring job:', err);
        // Non-fatal
      }

      try {
        getIO().to(`org:${conv.organization_id}`).emit('conversation:update', {
          conversationId,
          status: 'closed',
          updatedAt: new Date().toISOString(),
        });
      } catch {
        // WebSocket not initialized
      }

      res.json({ message: 'Conversation closed' });
    } catch (err) {
      next(err);
    }
  }
);

// ── POST /api/conversations (create from widget/API) ────────────────────────
router.post(
  '/',
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { agentId, channel = 'web', channelMetadata = {} } = req.body as {
        agentId: string;
        channel?: string;
        channelMetadata?: Record<string, unknown>;
      };

      if (!agentId) {
        throw new AppError(400, 'agentId is required', 'MISSING_AGENT_ID');
      }

      // Verify agent belongs to org and is published
      const agentResult = await query<{ id: string; status: string }>(
        `SELECT id, status FROM agents WHERE id = $1 AND organization_id = $2`,
        [agentId, req.org!.id]
      );

      if (!agentResult.rows[0]) {
        throw new AppError(404, 'Agent not found', 'AGENT_NOT_FOUND');
      }

      const result = await query<{ id: string; created_at: string }>(
        `INSERT INTO conversations (agent_id, organization_id, channel, status, channel_metadata, created_at, updated_at)
         VALUES ($1, $2, $3, 'active', $4, NOW(), NOW())
         RETURNING id, created_at`,
        [agentId, req.org!.id, channel, JSON.stringify(channelMetadata)]
      );

      res.status(201).json({
        conversation: {
          id: result.rows[0]!.id,
          agentId,
          channel,
          status: 'active',
          createdAt: result.rows[0]!.created_at,
        },
      });
    } catch (err) {
      next(err);
    }
  }
);

export default router;
