import { Controller, Get } from '@nestjs/common'

@Controller()
export class AppController {
  @Get()
  root() {
    return { status: 'ok', app: 'Zahro Dental API' }
  }

  @Get('health')
  health() {
    return { status: 'ok', timestamp: new Date().toISOString() }
  }
}
