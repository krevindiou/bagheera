import {
  Body,
  Controller,
  ForbiddenException,
  Get,
  INestApplication,
  NotFoundException,
  Post,
  UnprocessableEntityException,
  ValidationPipe,
} from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { IsEmail } from 'class-validator';
import request from 'supertest';
import type { App } from 'supertest/types';
import * as Sentry from '@sentry/node';
import { GlobalExceptionFilter } from './global-exception.filter';
import type { ErrorResponseBody } from './error-response';

jest.mock('@sentry/node', () => ({
  captureException: jest.fn(),
  init: jest.fn(),
}));

class SignInDto {
  @IsEmail()
  email!: string;
}

// Test-only controller — exists solely to exercise GlobalExceptionFilter
// from outside; never registered in the real app.
@Controller('__test-errors')
class TestErrorsController {
  @Get('not-found')
  notFound() {
    throw new NotFoundException('bank not found');
  }

  @Get('forbidden')
  forbidden() {
    throw new ForbiddenException('not your account');
  }

  @Get('unprocessable')
  unprocessable() {
    throw new UnprocessableEntityException('cannot delete active bank');
  }

  @Post('validate')
  validate(@Body() dto: SignInDto) {
    return dto;
  }

  @Get('boom')
  boom() {
    throw new Error('unexpected wiring failure');
  }
}

describe('GlobalExceptionFilter', () => {
  let app: INestApplication<App>;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [TestErrorsController],
    }).compile();

    app = moduleRef.createNestApplication();
    app.useGlobalFilters(new GlobalExceptionFilter());
    app.useGlobalPipes(new ValidationPipe({ whitelist: true }));

    const swaggerDocument = SwaggerModule.createDocument(
      app,
      new DocumentBuilder().setTitle('Test').setVersion('1').build(),
    );
    SwaggerModule.setup('api/docs', app, swaggerDocument, {
      jsonDocumentUrl: 'api/docs-json',
    });

    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('shapes a 404 as "not_found"', async () => {
    const res = await request(app.getHttpServer())
      .get('/__test-errors/not-found')
      .expect(404);
    expect(res.body).toMatchObject({
      statusCode: 404,
      category: 'not_found',
      message: 'bank not found',
      path: '/__test-errors/not-found',
    });
    expect(typeof (res.body as ErrorResponseBody).timestamp).toBe('string');
  });

  it('shapes a 403 as "access_denied"', async () => {
    const res = await request(app.getHttpServer())
      .get('/__test-errors/forbidden')
      .expect(403);
    expect(res.body).toMatchObject({
      statusCode: 403,
      category: 'access_denied',
      message: 'not your account',
    });
  });

  it('shapes a 422 as "access_denied" too', async () => {
    const res = await request(app.getHttpServer())
      .get('/__test-errors/unprocessable')
      .expect(422);
    expect(res.body).toMatchObject({
      statusCode: 422,
      category: 'access_denied',
      message: 'cannot delete active bank',
    });
  });

  it('shapes a ValidationPipe 400 as "validation_error"', async () => {
    const res = await request(app.getHttpServer())
      .post('/__test-errors/validate')
      .send({ email: 'not-an-email' })
      .expect(400);
    expect(res.body).toMatchObject({
      statusCode: 400,
      category: 'validation_error',
    });
    expect(Array.isArray((res.body as ErrorResponseBody).message)).toBe(true);
  });

  it('shapes an unhandled error as a generic 500 without leaking details', async () => {
    const res = await request(app.getHttpServer())
      .get('/__test-errors/boom')
      .expect(500);
    expect(res.body).toMatchObject({
      statusCode: 500,
      category: 'error',
      message: 'Internal server error',
    });
  });

  it('reports unhandled errors to Sentry', async () => {
    await request(app.getHttpServer()).get('/__test-errors/boom').expect(500);

    expect(Sentry.captureException).toHaveBeenCalledWith(
      expect.objectContaining({ message: 'unexpected wiring failure' }),
    );
  });

  it('exposes OpenAPI docs at /api/docs-json and /api/docs', async () => {
    const json = await request(app.getHttpServer())
      .get('/api/docs-json')
      .expect(200);
    expect(json.body as { openapi: string }).toMatchObject({
      openapi: expect.any(String) as string,
    });

    await request(app.getHttpServer()).get('/api/docs').expect(200);
  });
});
