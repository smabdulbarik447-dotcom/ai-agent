import { matchRule } from '@/lib/agent';
import { guard, json, body } from '@/lib/api';

export const runtime = 'nodejs';

export const POST = guard(async (req, _p, user) => json({ rule: (await matchRule(user.id, (await body(req)).text || '')) }));
