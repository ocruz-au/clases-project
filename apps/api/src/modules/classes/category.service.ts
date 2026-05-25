import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class CategoryService {
  constructor(private readonly prisma: PrismaService) {}

  async list() {
    return this.prisma.category.findMany({ orderBy: { name: 'asc' } });
  }

  async findById(id: string) {
    const cat = await this.prisma.category.findFirst({ where: { id } });
    if (!cat) throw new NotFoundException('Category not found');
    return cat;
  }

  async create(data: { name: string; slug: string; description?: string }) {
    return this.prisma.category.create({ data });
  }

  async update(id: string, data: { name?: string; description?: string }) {
    await this.findById(id);
    return this.prisma.category.update({ where: { id }, data });
  }

  async softDelete(id: string) {
    await this.findById(id);
    return this.prisma.category.update({ where: { id }, data: { deletedAt: new Date() } });
  }
}
