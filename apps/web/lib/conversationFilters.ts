export interface ConversationFilters {
  search: string;
  status: string;
  channel: string;
  agentId: string;
}

const FILTER_KEYS: (keyof ConversationFilters)[] = ['search', 'status', 'channel', 'agentId'];

type ParamsReader = { get(name: string): string | null };

export function readConversationFilters(params: ParamsReader): ConversationFilters {
  return {
    search: params.get('search') ?? '',
    status: params.get('status') ?? '',
    channel: params.get('channel') ?? '',
    agentId: params.get('agentId') ?? '',
  };
}

/** Query string (without "?") with only the filters that have a value. */
export function buildConversationFilterQuery(filters: ConversationFilters): string {
  const query = new URLSearchParams();
  for (const key of FILTER_KEYS) {
    if (filters[key]) query.set(key, filters[key]);
  }
  return query.toString();
}

export function conversationsListHref(filters: ConversationFilters): string {
  const query = buildConversationFilterQuery(filters);
  return query ? `/dashboard/conversations?${query}` : '/dashboard/conversations';
}
