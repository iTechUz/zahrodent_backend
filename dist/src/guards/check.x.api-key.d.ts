import { CanActivate, ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
export declare class CheckXApiKeyGuard implements CanActivate {
    private reflector;
    private readonly apiKeyHikivistion;
    private readonly logger;
    constructor(reflector: Reflector);
    canActivate(context: ExecutionContext): boolean;
}
