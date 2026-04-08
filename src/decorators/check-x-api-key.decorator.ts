import { SetMetadata } from "@nestjs/common";
import { apiKeyConfig, ApiKeyEnum } from "src/config/api-key-config";
const apiKeys = 'HIKIVISTION';
export const ApiKeyEnums = (key: ApiKeyEnum) =>
  SetMetadata(apiKeys, key);