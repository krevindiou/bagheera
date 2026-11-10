import type { Request } from 'express';
import { clientIp } from '../common/client-ip.decorator';
import { USER_AGENT_MAX_LENGTH } from './describe-user-agent';
import './session-data';

/** Records which browser signed in, for the member's sessions list. Call right after setting memberId. */
export function recordSessionClient(req: Request): void {
  const userAgent = req.get('user-agent');
  req.session.client = {
    userAgent: userAgent ? userAgent.slice(0, USER_AGENT_MAX_LENGTH) : null,
    ip: clientIp(req),
    signedInAt: Date.now(),
  };
}
