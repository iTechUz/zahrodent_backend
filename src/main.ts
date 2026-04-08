import { ValidationPipe } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { NestFactory } from '@nestjs/core'
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger'
import * as express from 'express'
import expressBasicAuth from 'express-basic-auth'
import { AppModule } from './app.module'

async function bootstrap() {
	const app = await NestFactory.create(AppModule, {
		logger: ['error', 'warn', 'log', 'debug', 'verbose']
	})

	const configService = app.get(ConfigService)
	app.useGlobalPipes(
		new ValidationPipe({
			transform: true,
			transformOptions: { enableImplicitConversion: false },
			forbidNonWhitelisted: false,
			whitelist: true
		})
	)

	app.use(express.urlencoded({ extended: false }))
	app.use(express.json())
	app.setGlobalPrefix('api', { exclude: ['/'] })
	app.enableCors({
		origin: '*'
		// credentials: true
	})

	app.use(
		['/swagger'],
		expressBasicAuth({
			challenge: true,
			users: {
				eljahon: '1315'
			}
		})
	)

	const config = new DocumentBuilder()
		.setTitle('Itech Quiz Up API')
		.setDescription('API documentation for the Itech Quiz Up platform')
		.setVersion('1.0')
		.addTag('auth', 'Authentication endpoints')
		.addTag('users', 'User management endpoints')
		.addBearerAuth(
			{
				type: 'http',
				scheme: 'bearer',
				bearerFormat: 'JWT',
				name: 'JWT',
				description: 'Enter JWT token',
				in: 'header'
			},
			'JWT-auth'
		)
		.build()

	const document = SwaggerModule.createDocument(app, config)
	SwaggerModule.setup('swagger', app, document)

	const port = configService.get<number>('PORT')

	await app.listen(port, () => {
		console.log(`Server is running on port ${port}`)
	})
}
bootstrap()
