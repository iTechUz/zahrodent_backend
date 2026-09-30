import { Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import {
  extractSocketToken,
  NotificationsGateway,
} from './notifications.gateway';
import { AuthService } from '../auth/auth.service';

describe('NotificationsGateway', () => {
  let gateway: NotificationsGateway;
  let jwt: { verifyAsync: jest.Mock };
  let auth: { resolveTokenUser: jest.Mock };
  let logSpy: jest.SpyInstance;

  const socket = (handshake: Record<string, unknown> = {}) => ({
    id: 'c1',
    handshake: { headers: {}, query: {}, auth: {}, ...handshake },
    data: {} as Record<string, unknown>,
    emit: jest.fn(),
    join: jest.fn().mockResolvedValue(undefined),
    disconnect: jest.fn(),
  });

  beforeEach(() => {
    jwt = { verifyAsync: jest.fn() };
    auth = { resolveTokenUser: jest.fn() };
    gateway = new NotificationsGateway(
      jwt as unknown as JwtService,
      auth as unknown as AuthService,
    );
    logSpy = jest.spyOn(Logger.prototype, 'log').mockImplementation();
    jest.spyOn(Logger.prototype, 'warn').mockImplementation();
  });

  afterEach(() => jest.restoreAllMocks());

  it('sendNewLead — faqat admin/receptionist xonalariga "newLead"', () => {
    const emit = jest.fn();
    const to = jest.fn(() => ({ emit }));
    gateway.server = { to } as any;
    const lead = { id: 'l1' };
    gateway.sendNewLead(lead);
    expect(to).toHaveBeenCalledWith(['role:admin', 'role:receptionist']);
    expect(emit).toHaveBeenCalledWith('newLead', lead);
  });

  describe('handleConnection — JWT majburiy', () => {
    it('token yo‘q — uziladi, verify chaqirilmaydi', async () => {
      const c = socket();
      await gateway.handleConnection(c as any);
      expect(c.disconnect).toHaveBeenCalledWith(true);
      expect(jwt.verifyAsync).not.toHaveBeenCalled();
      expect(c.join).not.toHaveBeenCalled();
    });

    it('yaroqsiz/muddati o‘tgan token — uziladi', async () => {
      jwt.verifyAsync.mockRejectedValue(new Error('jwt expired'));
      const c = socket({ auth: { token: 'bad' } });
      await gateway.handleConnection(c as any);
      expect(c.emit).toHaveBeenCalledWith('unauthorized', expect.any(Object));
      expect(c.disconnect).toHaveBeenCalledWith(true);
    });

    it('token to‘g‘ri, lekin user o‘chirilgan — uziladi', async () => {
      jwt.verifyAsync.mockResolvedValue({ sub: 'u1' });
      auth.resolveTokenUser.mockResolvedValue(null);
      const c = socket({ auth: { token: 't' } });
      await gateway.handleConnection(c as any);
      expect(c.disconnect).toHaveBeenCalledWith(true);
    });

    it('to‘g‘ri token — rol xonasiga qo‘shiladi, user saqlanadi', async () => {
      const user = { id: 'u1', role: 'receptionist' };
      jwt.verifyAsync.mockResolvedValue({ sub: 'u1' });
      auth.resolveTokenUser.mockResolvedValue(user);
      const c = socket({ headers: { authorization: 'Bearer good' } });
      await gateway.handleConnection(c as any);
      expect(jwt.verifyAsync).toHaveBeenCalledWith('good');
      expect(c.join).toHaveBeenCalledWith('role:receptionist');
      expect(c.data.user).toBe(user);
      expect(c.disconnect).not.toHaveBeenCalled();
    });
  });

  describe('extractSocketToken', () => {
    it.each([
      [{ auth: { token: 'a1' } }, 'a1'],
      [{ auth: { token: 'Bearer a2' } }, 'a2'],
      [{ headers: { authorization: 'Bearer h1' } }, 'h1'],
      [{ query: { token: 'q1' } }, 'q1'],
      [{ headers: { authorization: 'Basic x' } }, null],
      [{}, null],
    ])('%p → %p', (hs, expected) => {
      const c = socket(hs as Record<string, unknown>);
      expect(extractSocketToken(c as any)).toBe(expected);
    });
  });

  it('lifecycle hooklari log yozadi', () => {
    gateway.afterInit();
    gateway.handleDisconnect({ id: 'c1' } as any);
    expect(logSpy).toHaveBeenCalledWith('WebSocket Gateway Initialized');
    expect(logSpy).toHaveBeenCalledWith('Client disconnected: c1');
  });
});
