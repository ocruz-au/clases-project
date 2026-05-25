import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import type { RoleKey } from '@prisma/client';

export interface AuthenticatedUser {
  id: string;
  email: string;
  name: string;
  roles: RoleKey[];
}

export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): AuthenticatedUser => {
    const request = ctx.switchToHttp().getRequest<{ user: AuthenticatedUser }>();
    return request.user;
  },
);
