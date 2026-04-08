import { applyDecorators } from '@nestjs/common';
import { ApiBody, ApiOperation } from '@nestjs/swagger';

export function CreateDecorator<T>(dtoClass: new () => T) {
  return applyDecorators(
    ApiOperation({ summary: 'Create new item' }),
    ApiBody({ type: dtoClass }),
  );
}
