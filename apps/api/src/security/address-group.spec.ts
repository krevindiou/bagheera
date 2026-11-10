import { rateLimitAddress, sameAddressGroup } from './address-group';

describe('rateLimitAddress', () => {
  it.each(['203.0.113.7', '127.0.0.1', 'unknown'])('keeps %s as is', (address) => {
    expect(rateLimitAddress(address)).toBe(address);
  });

  it.each([
    ['2001:db8:1:2:3:4:5:6', '2001:db8:1:2::/64'],
    ['2001:0DB8:0001:0002:ffff:ffff:ffff:ffff', '2001:db8:1:2::/64'],
    ['2001:db8:1:2::', '2001:db8:1:2::/64'],
    ['2001:db8::1', '2001:db8:0:0::/64'],
    ['::1', '0:0:0:0::/64'],
    ['fe80::1%eth0', 'fe80:0:0:0::/64'],
    ['2001:db8:1:2::192.0.2.1', '2001:db8:1:2::/64'],
  ])('groups %s by its /64', (address, prefix) => {
    expect(rateLimitAddress(address)).toBe(prefix);
  });

  it('gives every address of one /64 the same key, and other /64s their own', () => {
    expect(rateLimitAddress('2001:db8:a:b::1')).toBe(rateLimitAddress('2001:db8:a:b:dead:beef::9'));
    expect(rateLimitAddress('2001:db8:a:b::1')).not.toBe(rateLimitAddress('2001:db8:a:c::1'));
  });

  // Otherwise every IPv4 client of a dual-stack socket would share ::/64.
  it.each([
    ['::ffff:203.0.113.7', '203.0.113.7'],
    ['::ffff:cb00:7107', '203.0.113.7'],
  ])('counts the IPv4-mapped %s as its IPv4 address', (address, ipv4) => {
    expect(rateLimitAddress(address)).toBe(ipv4);
  });
});

describe('sameAddressGroup', () => {
  it('matches addresses of one IPv4 client or one IPv6 /64 only', () => {
    expect(sameAddressGroup('203.0.113.7', '::ffff:203.0.113.7')).toBe(true);
    expect(sameAddressGroup('2001:db8:a:b::1', '2001:db8:a:b:dead:beef::9')).toBe(true);
    expect(sameAddressGroup('203.0.113.7', '203.0.113.8')).toBe(false);
    expect(sameAddressGroup('2001:db8:a:b::1', '2001:db8:a:c::1')).toBe(false);
  });
});
