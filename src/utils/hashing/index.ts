import { Injectable } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { createHash } from 'node:crypto';

@Injectable()
export class HashingService {
  saltOrRounds: number = 10;
  constructor() {}

  async hashPassword(password: string) {
    const salt = await bcrypt.genSalt(this.saltOrRounds);
    return await bcrypt.hash(password, salt);
  }
  async comparePassword(password: string, hashedPassword: string) {
    return await bcrypt.compare(password, hashedPassword);
  }
}