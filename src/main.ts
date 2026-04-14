import 'dotenv/config';
import { Logger, ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module';
import { AllExceptionsFilter } from './common/filters/http-exception.filter';
import {
  buildCorsOptions,
  getListenHost,
  getPublicBaseUrl,
  isProduction,
  isSwaggerEnabled,
  parsePort,
  enforceProductionJwtSecret,
  warnWeakJwtSecret,
} from './bootstrap/env-config';

const SWAGGER_PATH = 'swagger';

async function bootstrap() {
  const prod = isProduction();
  const port = parsePort();
  const host = getListenHost();
  const logger = new Logger('Bootstrap');

  warnWeakJwtSecret(prod);
  enforceProductionJwtSecret();

  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    bufferLogs: true,
    logger: prod ? ['error', 'warn', 'log'] : undefined,
  });

  if (process.env.TRUST_PROXY === '1' || process.env.TRUST_PROXY === 'true') {
    app.set('trust proxy', 1);
    logger.log('TRUST_PROXY: yoqildi (nginx / load balancer ortida)');
  }

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
    }),
  );
  app.useGlobalFilters(new AllExceptionsFilter());
  app.enableCors(buildCorsOptions(prod));

  const swaggerOn = isSwaggerEnabled(prod);
  if (swaggerOn) {
    const swaggerConfig = new DocumentBuilder()
      .setTitle('Zahro Dental API')
      .setDescription(
        "Zahro Dental klinika boshqaruv REST API. Avval **POST /auth/login** orqali token oling, so'ng **Authorize** tugmasiga JWT ni kiriting.",
      )
      .setVersion('1.0')
      .addBearerAuth(
        { type: 'http', scheme: 'bearer', bearerFormat: 'JWT', in: 'header' },
        'JWT',
      )
      .addTag('auth', 'Tizimga kirish')
      .addTag('patients', 'Bemorlar')
      .addTag('doctors', 'Shifokorlar')
      .addTag('bookings', 'Qabullar')
      .addTag('visits', 'Tashriflar')
      .addTag('services', 'Xizmatlar katalogi')
      .addTag('payments', "To'lovlar")
      .addTag('notifications', 'Bildirishnomalar')
      .build();

    const document = SwaggerModule.createDocument(app, swaggerConfig);
    SwaggerModule.setup(SWAGGER_PATH, app, document, {
      swaggerOptions: {
        persistAuthorization: true,
      },
    });

    const expressApp = app.getHttpAdapter().getInstance();
    expressApp.get('/docs', (_req, res) => {
      res.redirect(301, `/${SWAGGER_PATH}`);
    });
  } else {
    logger.log(
      `Swagger UI o'chirilgan (NODE_ENV=production). Yoqish: SWAGGER_ENABLED=true — keyin /${SWAGGER_PATH}`,
    );
  }

  await app.listen(port, host);

  const publicUrl = getPublicBaseUrl(port);
  const listenLabel =
    host === '0.0.0.0' ? `0.0.0.0:${port} (barcha interfeyslar)` : `${host}:${port}`;

  logger.log(
    [
      '',
      '──────── Zahro Dental API ────────',
      `  Muhit:     ${prod ? 'production' : process.env.NODE_ENV || 'development'}`,
      `  Tinglash:  ${listenLabel}`,
      `  API URL:   ${publicUrl}`,
      swaggerOn ? `  Swagger:   ${publicUrl}/${SWAGGER_PATH}` : `  Swagger:   (o'chirilgan)`,
      `  Eski /docs → /${SWAGGER_PATH} ${swaggerOn ? '(301 redirect)' : '(swagger yo\'q)'}`,
      '──────────────────────────────────',
    ].join('\n'),
  );
}

bootstrap().catch((err: unknown) => {
  const logger = new Logger('Bootstrap');
  logger.error(err instanceof Error ? err.stack ?? err.message : String(err));
  process.exit(1);
});
