import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class WaitlistService {
  constructor(private readonly prisma: PrismaService) {}

  async joinWaitlist(userId: string, sessionId: string) {
    const session = await this.prisma.classSession.findFirst({
      where: { id: sessionId, deletedAt: null },
    });
    if (!session) throw new NotFoundException('Session not found');

    // Check for existing active entry
    const existing = await this.prisma.waitlistEntry.findFirst({
      where: {
        classSessionId: sessionId,
        userId,
        status: { notIn: ['REMOVED', 'SKIPPED', 'EXPIRED', 'CONVERTED'] },
      },
    });
    if (existing) throw new ConflictException('Already on waitlist for this session');

    // Next position = max position + 1 (among WAITING entries)
    const maxEntry = await this.prisma.waitlistEntry.findFirst({
      where: { classSessionId: sessionId, status: 'WAITING' },
      orderBy: { position: 'desc' },
    });
    const position = (maxEntry?.position ?? 0) + 1;

    return this.prisma.waitlistEntry.create({
      data: { classSessionId: sessionId, userId, position, status: 'WAITING' },
    });
  }

  async getQueueForSession(sessionId: string) {
    return this.prisma.waitlistEntry.findMany({
      where: { classSessionId: sessionId, deletedAt: null },
      orderBy: { position: 'asc' },
      include: { user: { select: { id: true, name: true, email: true } } },
    });
  }

  async getMyEntry(userId: string, sessionId: string) {
    return this.prisma.waitlistEntry.findFirst({
      where: {
        classSessionId: sessionId,
        userId,
        status: { notIn: ['REMOVED', 'SKIPPED', 'EXPIRED', 'CONVERTED'] },
      },
    });
  }
}
