import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { ClsService } from 'nestjs-cls';
import { tenantIsolationExtension } from './tenant-isolation.extension';

@Injectable()
export class PrismaService implements OnModuleInit, OnModuleDestroy {
  private _client: any;

  constructor(private readonly cls: ClsService) {
    const client = new PrismaClient();
    this._client = client.$extends(tenantIsolationExtension(this.cls));
  }

  // Delegate all calls to the extended client
  get patient() { return this._client.patient; }
  get patientComment() { return this._client.patientComment; }
  get booking() { return this._client.booking; }
  get payment() { return this._client.payment; }
  get visit() { return this._client.visit; }
  get user() { return this._client.user; }
  get doctor() { return this._client.doctor; }
  get service() { return this._client.service; }
  get lead() { return this._client.lead; }
  get notification() { return this._client.notification; }
  get branch() { return this._client.branch; }
  get auditLog() { return this._client.auditLog; }

  // Transaction support
  get $transaction() { return this._client.$transaction; }
  get $queryRaw() { return this._client.$queryRaw; }
  get $executeRaw() { return this._client.$executeRaw; }

  async onModuleInit() {
    await (this._client as any).$connect();
  }

  async onModuleDestroy() {
    await (this._client as any).$disconnect();
  }
}
