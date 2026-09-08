import { ipPointsFor } from './rate-limit.constants';

describe('ipPointsFor', () => {
  it('uses the explicit ipPoints override when given, ignoring identifierField/points', () => {
    expect(
      ipPointsFor({
        points: 5,
        durationSeconds: 60,
        identifierField: 'email',
        ipPoints: 99,
      }),
    ).toBe(99);
  });

  it('defaults to points * 4 when an identifierField is configured', () => {
    expect(
      ipPointsFor({ points: 5, durationSeconds: 60, identifierField: 'email' }),
    ).toBe(20);
  });

  it('defaults to plain points when there is no identifierField — IP is the only dimension', () => {
    expect(ipPointsFor({ points: 5, durationSeconds: 60 })).toBe(5);
  });
});
