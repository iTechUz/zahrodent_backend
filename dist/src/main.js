"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
const core_1 = require("@nestjs/core");
const swagger_1 = require("@nestjs/swagger");
const express = require("express");
const expressBasicAuth = require("express-basic-auth");
const app_module_1 = require("./app.module");
async function bootstrap() {
    const app = await core_1.NestFactory.create(app_module_1.AppModule, {
        logger: ['error', 'warn', 'log', 'debug', 'verbose']
    });
    const configService = app.get(config_1.ConfigService);
    app.useGlobalPipes(new common_1.ValidationPipe({
        transform: true,
        transformOptions: { enableImplicitConversion: false },
        forbidNonWhitelisted: false,
        whitelist: true
    }));
    app.use(express.urlencoded({ extended: false }));
    app.use(express.json());
    app.setGlobalPrefix('api', { exclude: ['/'] });
    app.enableCors({
        origin: '*'
    });
    app.use(['/swagger'], expressBasicAuth({
        challenge: true,
        users: {
            eljahon: '1315'
        }
    }));
    const config = new swagger_1.DocumentBuilder()
        .setTitle('Itech Quiz Up API')
        .setDescription('API documentation for the Itech Quiz Up platform')
        .setVersion('1.0')
        .addTag('auth', 'Authentication endpoints')
        .addTag('users', 'User management endpoints')
        .addBearerAuth({
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        name: 'JWT',
        description: 'Enter JWT token',
        in: 'header'
    }, 'JWT-auth')
        .build();
    const document = swagger_1.SwaggerModule.createDocument(app, config);
    swagger_1.SwaggerModule.setup('swagger', app, document);
    const port = configService.get('PORT');
    await app.listen(port, () => {
        console.log(`Server is running on port ${port}`);
    });
}
bootstrap();
//# sourceMappingURL=main.js.map