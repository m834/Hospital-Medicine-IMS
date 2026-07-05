import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { NotificationType, UserRole, Prisma } from '@prisma/client';
import { NotificationsGateway } from './notifications.gateway';
import { CreateDirectNotificationDto } from './dto/create-direct-notification.dto';

type AuthUser = { id?: string; hospitalId?: string; pharmacyId?: string; role?: UserRole };

export interface NotificationPayload {
  hospitalId?: string | null;
  senderId?: string | null;
  type?: NotificationType;
  title: string;
  message: string;
  entityType?: string;
  entityId?: string;
  link?: string;
}

@Injectable()
export class NotificationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly gateway: NotificationsGateway,
  ) {}

  // ---- Fan-out helpers (used by systematic/event-driven notifications) ----

  /** Create one notification per recipient and push each in real time. */
  async notifyUsers(recipientIds: string[], payload: NotificationPayload) {
    const unique = [...new Set(recipientIds.filter(Boolean))];
    if (unique.length === 0) return;

    await Promise.all(
      unique.map(async (recipientId) => {
        const notification = await this.prisma.notification.create({
          data: {
            recipientId,
            hospitalId: payload.hospitalId ?? null,
            senderId: payload.senderId ?? null,
            type: payload.type ?? NotificationType.SYSTEM,
            title: payload.title,
            message: payload.message,
            entityType: payload.entityType ?? null,
            entityId: payload.entityId ?? null,
            link: payload.link ?? null,
          },
        });
        this.gateway.emitToUser(recipientId, 'notification', notification);
        await this.emitUnreadCount(recipientId);
      }),
    );
  }

  /** Notify every active user in a hospital holding one of the given roles. */
  async notifyRoles(
    hospitalId: string,
    roles: UserRole[],
    payload: NotificationPayload,
    excludeUserId?: string,
  ) {
    const users = await this.prisma.user.findMany({
      where: { hospitalId, role: { in: roles }, status: 'ACTIVE' },
      select: { id: true },
    });
    const ids = users.map((u) => u.id).filter((id) => id !== excludeUserId);
    await this.notifyUsers(ids, { ...payload, hospitalId });
  }

  /** Notify every active user assigned to a pharmacy (optionally by role). */
  async notifyPharmacy(
    pharmacyId: string,
    payload: NotificationPayload,
    opts?: { roles?: UserRole[]; excludeUserId?: string },
  ) {
    const users = await this.prisma.user.findMany({
      where: {
        pharmacyId,
        status: 'ACTIVE',
        ...(opts?.roles ? { role: { in: opts.roles } } : {}),
      },
      select: { id: true },
    });
    const ids = users.map((u) => u.id).filter((id) => id !== opts?.excludeUserId);
    await this.notifyUsers(ids, payload);
  }

  // ---- Direct (manual) notifications ----

  async createDirect(sender: AuthUser, dto: CreateDirectNotificationDto) {
    const recipient = await this.prisma.user.findUnique({
      where: { id: dto.recipientId },
      select: { id: true, hospitalId: true, status: true },
    });
    if (!recipient || recipient.status !== 'ACTIVE') {
      throw new NotFoundException('Recipient not found');
    }
    // Keep messaging within a hospital (super admins, who have no hospital, may cross).
    if (sender.hospitalId && recipient.hospitalId && recipient.hospitalId !== sender.hospitalId) {
      throw new BadRequestException('Recipient belongs to another hospital');
    }

    await this.notifyUsers([recipient.id], {
      hospitalId: recipient.hospitalId,
      senderId: sender.id,
      type: NotificationType.DIRECT,
      title: dto.title,
      message: dto.message,
    });
    return { message: 'Notification sent' };
  }

  /**
   * Users the caller may send a direct notification to: everyone active in the
   * SAME hospital (minus themselves). Open to any authenticated user — direct
   * messaging is hospital-wide by design.
   *
   * Hospital-scoped users are always locked to their own hospital (the param is
   * ignored for them, so they can never target another hospital). Super admins,
   * who have no hospital of their own, may pass the hospital they're working in.
   */
  async listRecipients(user: AuthUser, hospitalIdParam?: string) {
    const hospitalId = user.hospitalId || hospitalIdParam;
    if (!hospitalId) return [];
    return this.prisma.user.findMany({
      where: { hospitalId, status: 'ACTIVE', id: { not: user.id } },
      select: { id: true, fullName: true, role: true },
      orderBy: { fullName: 'asc' },
    });
  }

  // ---- Reads for the current user ----

  async list(userId: string, opts: { limit?: number; unreadOnly?: boolean } = {}) {
    const where: Prisma.NotificationWhereInput = { recipientId: userId };
    if (opts.unreadOnly) where.isRead = false;
    const [items, unreadCount] = await Promise.all([
      this.prisma.notification.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: opts.limit ?? 30,
        include: { sender: { select: { id: true, fullName: true } } },
      }),
      this.prisma.notification.count({ where: { recipientId: userId, isRead: false } }),
    ]);
    return { items, unreadCount };
  }

  async unreadCount(userId: string) {
    const count = await this.prisma.notification.count({
      where: { recipientId: userId, isRead: false },
    });
    return { unreadCount: count };
  }

  async markRead(id: string, userId: string) {
    const notification = await this.prisma.notification.findFirst({
      where: { id, recipientId: userId },
    });
    if (!notification) throw new NotFoundException('Notification not found');
    if (!notification.isRead) {
      await this.prisma.notification.update({
        where: { id },
        data: { isRead: true, readAt: new Date() },
      });
    }
    await this.emitUnreadCount(userId);
    return { success: true };
  }

  async markAllRead(userId: string) {
    await this.prisma.notification.updateMany({
      where: { recipientId: userId, isRead: false },
      data: { isRead: true, readAt: new Date() },
    });
    await this.emitUnreadCount(userId);
    return { success: true };
  }

  private async emitUnreadCount(userId: string) {
    const count = await this.prisma.notification.count({
      where: { recipientId: userId, isRead: false },
    });
    this.gateway.emitToUser(userId, 'unread-count', { unreadCount: count });
  }
}
