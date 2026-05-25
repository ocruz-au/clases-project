import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditLogService } from '../audit-logs/audit-log.service';

@Injectable()
export class UsersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditLogService,
  ) {}

  async findById(id: string) {
    const user = await this.prisma.user.findFirst({
      where: { id },
      include: { userRoles: { include: { role: true } } },
    });
    if (!user) throw new NotFoundException('User not found');
    return user;
  }

  async list(page = 1, limit = 20) {
    const [users, total] = await Promise.all([
      this.prisma.user.findMany({
        skip: (page - 1) * limit,
        take: limit,
        include: { userRoles: { include: { role: true } } },
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.user.count(),
    ]);
    return { users, total, page };
  }

  async update(id: string, data: { name?: string; status?: 'ACTIVE' | 'DISABLED' }, actorId: string, ipAddress?: string) {
    const before = await this.findById(id);
    const after = await this.prisma.user.update({ where: { id }, data });
    await this.audit.log({
      actorId,
      action: 'USER_UPDATED',
      resourceType: 'User',
      resourceId: id,
      beforeState: { name: before.name, status: before.status },
      afterState: { name: after.name, status: after.status },
      ipAddress,
    });
    return after;
  }

  async assignRole(userId: string, roleKey: string, actorId: string, ipAddress?: string) {
    const role = await this.prisma.role.findUnique({ where: { key: roleKey as 'STUDENT' | 'INSTRUCTOR' | 'ADMIN' | 'SUPER_ADMIN' } });
    if (!role) throw new NotFoundException('Role not found');
    const userRole = await this.prisma.userRole.upsert({
      where: { userId_roleId: { userId, roleId: role.id } },
      create: { userId, roleId: role.id },
      update: {},
    });
    await this.audit.log({
      actorId,
      action: 'USER_ROLE_ASSIGNED',
      resourceType: 'User',
      resourceId: userId,
      afterState: { roleKey },
      ipAddress,
    });
    return userRole;
  }

  async softDelete(id: string, actorId: string, ipAddress?: string) {
    const before = await this.findById(id);
    await this.prisma.user.update({ where: { id }, data: { deletedAt: new Date(), status: 'DISABLED' } });
    await this.audit.log({
      actorId,
      action: 'USER_DEACTIVATED',
      resourceType: 'User',
      resourceId: id,
      beforeState: { status: before.status },
      afterState: { status: 'DISABLED', deletedAt: new Date() },
      ipAddress,
    });
  }
}
