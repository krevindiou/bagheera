import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { RegisterDto } from './register.dto';

describe('RegisterDto', () => {
  const valid = { email: 'member@example.com', country: 'FR' };

  // RegistrationService drops a zone this server doesn't know, rather than
  // a browser's unexpected zone failing the whole sign-up.
  it('accepts any time zone string, known or not', async () => {
    const dto = plainToInstance(RegisterDto, { ...valid, timeZone: 'Mars/Base' });
    expect(await validate(dto)).toEqual([]);
  });

  it('rejects a time zone longer than the column', async () => {
    const dto = plainToInstance(RegisterDto, { ...valid, timeZone: 'A'.repeat(65) });
    const errors = await validate(dto);
    expect(errors[0]?.constraints).toHaveProperty('maxLength');
  });

  it('accepts a known country code in any case, uppercased', async () => {
    const dto = plainToInstance(RegisterDto, { ...valid, country: 'fr' });
    expect(await validate(dto)).toEqual([]);
    expect(dto.country).toBe('FR');
  });

  it.each(['ZZ', 'FRA', 'F', 42])('rejects %p as a country', async (country) => {
    const dto = plainToInstance(RegisterDto, { ...valid, country });
    const errors = await validate(dto);
    expect(errors[0]?.constraints).toHaveProperty('isIn');
  });
});
