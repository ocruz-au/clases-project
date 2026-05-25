import { Module } from '@nestjs/common';
import { PrismaModule } from '../../prisma/prisma.module';
import { CategoryService } from './category.service';
import { ClassesController } from './classes.controller';
import { ClassesService } from './classes.service';
import { LocationService } from './location.service';
import { RoomService } from './room.service';

@Module({
  imports: [PrismaModule],
  controllers: [ClassesController],
  providers: [ClassesService, CategoryService, LocationService, RoomService],
  exports: [ClassesService, CategoryService, LocationService, RoomService],
})
export class ClassesModule {}
