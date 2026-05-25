import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class InstructorService {
  constructor(private readonly prisma: PrismaService) {}

  async list() {
    return this.prisma.instructorProfile.findMany({
      where: { deletedAt: null },
      include: { user: { select: { id: true, name: true, email: true, status: true } } },
      orderBy: { createdAt: 'asc' },
    });
  }

  async findById(id: string) {
    const profile = await this.prisma.instructorProfile.findFirst({
      where: { id, deletedAt: null },
      include: { user: { select: { id: true, name: true, email: true, status: true } } },
    });
    if (!profile) throw new NotFoundException('Instructor not found');
    return profile;
  }

  async create(data: { userId: string; bio?: string }) {
    const user = await this.prisma.user.findFirst({ where: { id: data.userId, deletedAt: null } });
    if (!user) throw new NotFoundException('User not found');

    const existing = await this.prisma.instructorProfile.findFirst({
      where: { userId: data.userId, deletedAt: null },
    });
    if (existing) throw new ConflictException('Instructor profile already exists for this user');

    return this.prisma.instructorProfile.create({
      data: { userId: data.userId, bio: data.bio ?? '' },
      include: { user: { select: { id: true, name: true, email: true } } },
    });
  }

  async update(id: string, data: { bio?: string }) {
    await this.findById(id);
    return this.prisma.instructorProfile.update({
      where: { id },
      data: { bio: data.bio },
      include: { user: { select: { id: true, name: true, email: true } } },
    });
  }

  async softDelete(id: string) {
    await this.findById(id);
    return this.prisma.instructorProfile.update({
      where: { id },
      data: { deletedAt: new Date() },
    });
  }
}
