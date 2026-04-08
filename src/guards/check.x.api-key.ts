import {
  CanActivate,
  ExecutionContext,
  Injectable,
  ForbiddenException,
  Logger,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ApiKeyEnum } from 'src/config/api-key-config';
import { decodeUUID } from 'src/constantis';

@Injectable()
export class CheckXApiKeyGuard implements CanActivate {
  private readonly apiKeyHikivistion = process.env.X_API_KEY_HIKIVISTION;
  private readonly logger = new Logger(CheckXApiKeyGuard.name);

  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredKeys = this.reflector.getAllAndOverride<ApiKeyEnum[]>(
      'HIKIVISTION',
      [context.getHandler(), context.getClass()],
    );

    const request = context.switchToHttp().getRequest();
    const apiKey = request.headers['x-api-key'];

    this.logger.log(
      `ApiKey: ${apiKey}`,
    );

      if (!apiKey) {
      throw new ForbiddenException('YOUR NOT ACCESS TO THIS RESOURCE');
    }
    const hashXApiKey = decodeUUID(apiKey);

    if (!hashXApiKey) {
      throw new ForbiddenException('YOUR NOT ACCESS TO THIS RESOURCE');
    }

    if (hashXApiKey === this.apiKeyHikivistion) {
      return true;
    }

    this.logger.warn(`Invalid API Key: ${apiKey}`);

    throw new ForbiddenException('YOUR NOT ACCESS TO THIS RESOURCE');
  }
}


