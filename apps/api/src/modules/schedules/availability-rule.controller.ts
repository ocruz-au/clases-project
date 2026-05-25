import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { AvailabilityRuleService } from './availability-rule.service';

@Controller('admin/availability-rules')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN', 'SUPER_ADMIN')
export class AvailabilityRuleController {
  constructor(private readonly service: AvailabilityRuleService) {}

  @Get()
  list(@Query('classId') classId?: string) {
    return this.service.list(classId);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.service.findById(id);
  }

  @Post()
  create(
    @Body()
    body: {
      classId: string;
      roomId: string;
      instructorId: string;
      rrule: string;
      startTimeLocal: string;
      durationMin: number;
      capacityOverride?: number;
      activeFrom: string;
      activeUntil?: string;
    },
  ) {
    return this.service.create(body);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() body: Record<string, unknown>) {
    return this.service.update(id, body as Parameters<AvailabilityRuleService['update']>[1]);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.service.softDelete(id);
  }

  @Post(':id/generate')
  generate(@Param('id') id: string) {
    return this.service.generateSessions(id);
  }
}
