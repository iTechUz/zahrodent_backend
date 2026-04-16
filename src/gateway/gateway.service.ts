import { Injectable } from '@nestjs/common'
import { Server } from 'socket.io'

export enum WsEvent {
  // Booking
  BOOKING_CREATED = 'booking:created',
  BOOKING_UPDATED = 'booking:updated',
  BOOKING_CONFIRMED = 'booking:confirmed',
  BOOKING_CANCELLED = 'booking:cancelled',
  BOOKING_COMPLETED = 'booking:completed',
  // Patient
  PATIENT_CREATED = 'patient:created',
  PATIENT_UPDATED = 'patient:updated',
  // Payment
  PAYMENT_CREATED = 'payment:created',
  PAYMENT_CONFIRMED = 'payment:confirmed',
  // Notification
  NOTIFICATION_NEW = 'notification:new',
  // Medical
  MEDICAL_RECORD_CREATED = 'medical:created',
}

@Injectable()
export class GatewayService {
  private server: Server

  setServer(server: Server) {
    this.server = server
  }

  // Branch xonasiga event yuborish
  emitToBranch(branchId: string, event: WsEvent, data: any) {
    if (!this.server) return
    this.server.to(`branch:${branchId}`).emit(event, data)
  }

  // Shifokor xonasiga event yuborish
  emitToDoctor(doctorId: string, event: WsEvent, data: any) {
    if (!this.server) return
    this.server.to(`doctor:${doctorId}`).emit(event, data)
  }

  // Bitta foydalanuvchiga event yuborish
  emitToUser(userId: string, event: WsEvent, data: any) {
    if (!this.server) return
    this.server.to(`user:${userId}`).emit(event, data)
  }

  // Barcha ulangan clientlarga yuborish
  emitToAll(event: WsEvent, data: any) {
    if (!this.server) return
    this.server.emit(event, data)
  }
}
