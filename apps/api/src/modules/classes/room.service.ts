import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class RoomService {
  constructor(private readonly prisma: PrismaService) {}

  list(locationId?: string) {
    return this.prisma.room.findMany({
      where: { deletedAt: null, ...(locationId ? { locationId } : {}) },
      include: { location: true },
      orderBy: { name: 'asc' },
    });
  }

  async findById(id: string) {
    const room = await this.prisma.room.findFirst({
      where: { id, deletedAt: null },
      include: { location: true },
    });
    if (!room) throw new NotFoundException('Room not found');
    return room;
  }

  create(data: { name: string; capacity: number; locationId: string }) {
    return this.prisma.room.create({
      data: { name: data.name, capacity: data.capacity, locationId: data.locationId },
      include: { location: true },
    });
  }

  async update(id: string, data: { name?: string; capacity?: number }) {
    await this.findById(id);
    return this.prisma.room.update({ where: { id }, data, include: { location: true } });
  }

  async softDelete(id: string) {
    await this.findById(id);
    return this.prisma.room.update({ where: { id }, data: { deletedAt: new Date() } });
  }
}
