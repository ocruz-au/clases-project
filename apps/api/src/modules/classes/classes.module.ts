import { Module } from '@nestjs/common';
import { PrismaModule } from '../../prisma/prisma.module';
import { CategoryService } from './category.service';
import { ClassesController } from './classes.controller';
import { ClassesService } from './classes.service';

@Module({
  imports: [PrismaModule],
  controllers: [ClassesController],
  providers: [ClassesService, CategoryService],
  exports: [ClassesService, CategoryService],
})
export class ClassesModule {}
