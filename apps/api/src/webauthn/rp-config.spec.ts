import { ConfigService } from '@nestjs/config';
import { rpConfig } from './rp-config';

function configWith(values: Record<string, string>): ConfigService {
  return {
    getOrThrow: jest.fn((key: string) => {
      if (!(key in values)) {
        throw new Error(`config key "${key}" not set`);
      }
      return values[key];
    }),
  } as unknown as ConfigService;
}

describe('rpConfig', () => {
  it('reads rpID/rpName/origin from RP_ID/RP_NAME/RP_ORIGIN', () => {
    const config = configWith({
      RP_ID: 'bagheera.app',
      RP_NAME: 'Bagheera',
      RP_ORIGIN: 'https://bagheera.app',
    });
    expect(rpConfig(config)).toEqual({
      rpID: 'bagheera.app',
      rpName: 'Bagheera',
      origin: 'https://bagheera.app',
    });
  });

  it('propagates the throw when a required env var is missing', () => {
    const config = configWith({ RP_ID: 'bagheera.app', RP_NAME: 'Bagheera' });
    expect(() => rpConfig(config)).toThrow(/RP_ORIGIN/);
  });
});
