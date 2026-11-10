import type { Request } from 'express';
import { clientIp } from '../common/client-ip.decorator';
import './session-data';

// Real user agents stay well under this; it only bounds what a client can
// make the store keep.
const USER_AGENT_MAX_LENGTH = 512;

/** Records which browser signed in, for the member's sessions list. Call right after setting memberId. */
export function recordSessionClient(req: Request): void {
  const userAgent = req.get('user-agent');
  req.session.client = {
    userAgent: userAgent ? userAgent.slice(0, USER_AGENT_MAX_LENGTH) : null,
    ip: clientIp(req),
    signedInAt: Date.now(),
  };
}
