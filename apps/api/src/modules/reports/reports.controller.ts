import { BadRequestException, Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { z } from 'zod';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { ReportsService } from './reports.service';

const dateRangeSchema = z.object({
  from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'from must be YYYY-MM-DD'),
  to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'to must be YYYY-MM-DD'),
});

function parseRange(from?: string, to?: string) {
  const result = dateRangeSchema.safeParse({ from, to });
  if (!result.success) throw new BadRequestException(result.error.issues[0]?.message ?? 'Invalid date range');
  return result.data;
}

@ApiTags('Admin / Reports')
@Controller('admin/reports')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN', 'SUPER_ADMIN')
export class ReportsController {
  constructor(private readonly reports: ReportsService) {}

  @Get('bookings')
  @ApiOperation({ summary: 'Booking count by date range (Perth local)' })
  bookings(@Query('from') from?: string, @Query('to') to?: string) {
    const range = parseRange(from, to);
    return this.reports.bookingsByDateRange(range.from, range.to);
  }

  @Get('revenue')
  @ApiOperation({ summary: 'Revenue total by date range (Perth local)' })
  revenue(@Query('from') from?: string, @Query('to') to?: string) {
    const range = parseRange(from, to);
    return this.reports.revenueByDateRange(range.from, range.to);
  }

  @Get('attendance')
  @ApiOperation({ summary: 'Attendance summary by date range (Perth local)' })
  attendance(@Query('from') from?: string, @Query('to') to?: string) {
    const range = parseRange(from, to);
    return this.reports.attendanceSummary(range.from, range.to);
  }

  @Get('cancellations')
  @ApiOperation({ summary: 'Cancellation count by date range (Perth local)' })
  cancellations(@Query('from') from?: string, @Query('to') to?: string) {
    const range = parseRange(from, to);
    return this.reports.cancellationsByDateRange(range.from, range.to);
  }

  @Get('waitlist-conversion')
  @ApiOperation({ summary: 'Waitlist conversion rate by date range (Perth local)' })
  waitlistConversion(@Query('from') from?: string, @Query('to') to?: string) {
    const range = parseRange(from, to);
    return this.reports.waitlistConversionRate(range.from, range.to);
  }
}
