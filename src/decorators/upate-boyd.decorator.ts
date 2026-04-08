import { applyDecorators } from '@nestjs/common';
import { ApiBody, ApiOperation } from '@nestjs/swagger';

export function UpdateDecorator<T>(dtoClass: new () => T) {
  return applyDecorators(
    ApiOperation({ summary: 'Update item' }),
    ApiBody({ type: dtoClass }),
  );
}