import { Body, Controller, Get, NotFoundException, Param, Put, UseGuards } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { z } from 'zod';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { CurrentUser, AuthenticatedUser } from '../auth/current-user.decorator';
import { SettingsService } from './settings.service';

const upsertSettingSchema = z.object({
  value: z.unknown(),
  scope: z.enum(['GLOBAL', 'SECURITY']).optional(),
});

@ApiTags('Settings')
@Controller('settings')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('SUPER_ADMIN')
export class SettingsController {
  constructor(private readonly settings: SettingsService) {}

  @Get()
  @ApiOperation({ summary: 'List all settings' })
  list() {
    return this.settings.getAll();
  }

  @Get(':key')
  @ApiOperation({ summary: 'Get setting by key' })
  async findOne(@Param('key') key: string) {
    const row = await this.settings.getByKey(key);
    if (!row) throw new NotFoundException(`Setting '${key}' not found`);
    return row;
  }

  @Put(':key')
  @ApiOperation({ summary: 'Upsert a setting' })
  upsert(
    @Param('key') key: string,
    @Body(new ZodValidationPipe(upsertSettingSchema)) body: z.infer<typeof upsertSettingSchema>,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.settings.set(key, body.value, user.id);
  }
}
