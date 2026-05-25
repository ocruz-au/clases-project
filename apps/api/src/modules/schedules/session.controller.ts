import { Controller, Get, Param, Query } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { SessionService } from './session.service';

@ApiTags('Catalog')
@Controller('classes/sessions')
export class SessionController {
  constructor(private readonly sessionService: SessionService) {}

  @Get()
  @ApiOperation({ summary: 'List bookable class sessions with filters' })
  list(
    @Query('dateFrom') dateFrom?: string,
    @Query('dateTo') dateTo?: string,
    @Query('categoryId') categoryId?: string,
    @Query('instructorId') instructorId?: string,
    @Query('locationId') locationId?: string,
    @Query('page') page?: string,
  ) {
    return this.sessionService.list({
      dateFrom,
      dateTo,
      categoryId,
      instructorId,
      locationId,
      page: page ? parseInt(page) : 1,
    });
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a session with live seat availability' })
  findOne(@Param('id') id: string) {
    return this.sessionService.findById(id);
  }
}
