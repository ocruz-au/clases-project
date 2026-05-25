import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class ClassesService {
  constructor(private readonly prisma: PrismaService) {}

  async list(page = 1, limit = 20) {
    const [classes, total] = await Promise.all([
      this.prisma.class.findMany({
        skip: (page - 1) * limit,
        take: limit,
        include: { category: true, cancellationPolicy: true },
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.class.count(),
    ]);
    return { items: classes, total, page };
  }

  async findById(id: string) {
    const cls = await this.prisma.class.findFirst({
      where: { id },
      include: { category: true, cancellationPolicy: true },
    });
    if (!cls) throw new NotFoundException('Class not found');
    return cls;
  }

  async create(data: {
    title: string;
    description?: string;
    categoryId: string;
    priceCents: number;
    currency?: string;
    defaultCapacity: number;
    cancellationPolicyId?: string;
  }) {
    return this.prisma.class.create({
      data: {
        title: data.title,
        description: data.description ?? '',
        categoryId: data.categoryId,
        priceCents: data.priceCents,
        currency: data.currency ?? 'AUD',
        defaultCapacity: data.defaultCapacity,
        cancellationPolicyId: data.cancellationPolicyId ?? null,
      },
      include: { category: true },
    });
  }

  async update(
    id: string,
    data: {
      title?: string;
      description?: string;
      priceCents?: number;
      defaultCapacity?: number;
      cancellationPolicyId?: string;
    },
  ) {
    await this.findById(id);
    return this.prisma.class.update({ where: { id }, data, include: { category: true } });
  }

  async softDelete(id: string) {
    await this.findById(id);
    return this.prisma.class.update({ where: { id }, data: { deletedAt: new Date() } });
  }
}
