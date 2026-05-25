import { Body, Controller, Delete, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { InstructorService } from './instructor.service';

@Controller('admin/instructors')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN', 'SUPER_ADMIN')
export class InstructorController {
  constructor(private readonly instructorService: InstructorService) {}

  @Get()
  list() {
    return this.instructorService.list();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.instructorService.findById(id);
  }

  @Post()
  create(@Body() body: { userId: string; bio?: string }) {
    return this.instructorService.create(body);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() body: { bio?: string }) {
    return this.instructorService.update(id, body);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.instructorService.softDelete(id);
  }
}
