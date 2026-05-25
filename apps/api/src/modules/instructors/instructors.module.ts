import { Module } from '@nestjs/common';
import { PrismaModule } from '../../prisma/prisma.module';
import { InstructorService } from './instructor.service';
import { InstructorController } from './instructor.controller';
import { InstructorSessionsController } from './instructor-sessions.controller';
import { AttendanceService } from './attendance.service';

@Module({
  imports: [PrismaModule],
  controllers: [InstructorController, InstructorSessionsController],
  providers: [InstructorService, AttendanceService],
  exports: [InstructorService, AttendanceService],
})
export class InstructorsModule {}
