import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class LocationService {
  constructor(private readonly prisma: PrismaService) {}

  list() {
    return this.prisma.location.findMany({
      where: { deletedAt: null },
      include: { rooms: { where: { deletedAt: null } } },
      orderBy: { name: 'asc' },
    });
  }

  async findById(id: string) {
    const loc = await this.prisma.location.findFirst({ where: { id, deletedAt: null } });
    if (!loc) throw new NotFoundException('Location not found');
    return loc;
  }

  create(data: { name: string; address: string; timezone?: string }) {
    return this.prisma.location.create({
      data: { name: data.name, address: data.address, timezone: data.timezone ?? 'Australia/Perth' },
    });
  }

  async update(id: string, data: { name?: string; address?: string; timezone?: string }) {
    await this.findById(id);
    return this.prisma.location.update({ where: { id }, data });
  }

  async softDelete(id: string) {
    await this.findById(id);
    return this.prisma.location.update({ where: { id }, data: { deletedAt: new Date() } });
  }
}
