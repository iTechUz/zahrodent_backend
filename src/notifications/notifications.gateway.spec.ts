import { Logger } from '@nestjs/common';
import { NotificationsGateway } from './notifications.gateway';

describe('NotificationsGateway', () => {
  let gateway: NotificationsGateway;
  let logSpy: jest.SpyInstance;

  beforeEach(() => {
    gateway = new NotificationsGateway();
    logSpy = jest.spyOn(Logger.prototype, 'log').mockImplementation();
  });

  afterEach(() => jest.restoreAllMocks());

  it('sendNewLead — barcha clientlarga "newLead" emit qiladi', () => {
    const emit = jest.fn();
    gateway.server = { emit } as any;
    const lead = { id: 'l1' };
    gateway.sendNewLead(lead);
    expect(emit).toHaveBeenCalledWith('newLead', lead);
  });

  it('lifecycle hooklari log yozadi', () => {
    gateway.afterInit({} as any);
    gateway.handleConnection({ id: 'c1' } as any);
    gateway.handleDisconnect({ id: 'c1' } as any);
    expect(logSpy).toHaveBeenCalledWith('WebSocket Gateway Initialized');
    expect(logSpy).toHaveBeenCalledWith('Client connected: c1');
    expect(logSpy).toHaveBeenCalledWith('Client disconnected: c1');
  });
});
