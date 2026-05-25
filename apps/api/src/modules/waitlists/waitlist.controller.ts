import { Body, Controller, Get, Param, Post, Request, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { WaitlistService } from './waitlist.service';

interface AuthRequest extends Request {
  user: { userId: string };
}

@Controller('waitlist')
@UseGuards(JwtAuthGuard)
export class WaitlistController {
  constructor(private readonly waitlistService: WaitlistService) {}

  @Post()
  async join(@Request() req: AuthRequest, @Body() body: { classSessionId: string }) {
    return this.waitlistService.joinWaitlist(req.user.userId, body.classSessionId);
  }

  @Get('session/:sessionId')
  async getQueue(@Param('sessionId') sessionId: string) {
    return this.waitlistService.getQueueForSession(sessionId);
  }

  @Get('session/:sessionId/my-entry')
  async getMyEntry(@Request() req: AuthRequest, @Param('sessionId') sessionId: string) {
    return this.waitlistService.getMyEntry(req.user.userId, sessionId);
  }
}
