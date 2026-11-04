import { isIPv4, isIPv6 } from 'node:net';

// Hex groups of an IPv6 address, or null when it doesn't parse.
function ipv6Groups(address: string): number[] | null {
  let text = address.split('%')[0].toLowerCase();
  // A dotted IPv4 tail (`::ffff:1.2.3.4`) stands for the last two groups.
  const lastColon = text.lastIndexOf(':');
  const tail = text.slice(lastColon + 1);
  if (isIPv4(tail)) {
    const [a, b, c, d] = tail.split('.').map(Number);
    text = `${text.slice(0, lastColon + 1)}${((a << 8) | b).toString(16)}:${((c << 8) | d).toString(16)}`;
  }
  const halves = text.split('::');
  if (halves.length > 2) {
    return null;
  }
  const head = halves[0] ? halves[0].split(':') : [];
  const rest = halves.length === 2 && halves[1] ? halves[1].split(':') : [];
  const missing = 8 - head.length - rest.length;
  if (halves.length === 1 ? missing !== 0 : missing < 1) {
    return null;
  }
  const groups = [...head, ...Array<string>(halves.length === 2 ? missing : 0).fill('0'), ...rest];
  const parsed = groups.map((group) => (/^[0-9a-f]{1,4}$/.test(group) ? parseInt(group, 16) : NaN));
  return parsed.some(Number.isNaN) ? null : parsed;
}

/**
 * The address a per-address rate limit counts against: an IPv4 address as
 * is, an IPv6 one by its /64 prefix. A single subscriber usually holds a
 * whole /64, so counting each address separately would let one caller
 * dodge the limit by rotating the host bits.
 */
export function rateLimitAddress(address: string): string {
  if (!isIPv6(address)) {
    return address;
  }
  const groups = ipv6Groups(address);
  if (!groups) {
    return address;
  }
  // IPv4-mapped (`::ffff:a.b.c.d`): the IPv4 client it stands for.
  if (groups.slice(0, 5).every((group) => group === 0) && groups[5] === 0xffff) {
    return [groups[6] >> 8, groups[6] & 0xff, groups[7] >> 8, groups[7] & 0xff].join('.');
  }
  return `${groups
    .slice(0, 4)
    .map((group) => group.toString(16))
    .join(':')}::/64`;
}
