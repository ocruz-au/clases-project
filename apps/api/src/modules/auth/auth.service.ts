import {
  BadRequestException,
  ConflictException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as argon2 from 'argon2';
import { TOTP } from 'otpauth';
import { PrismaService } from '../../prisma/prisma.service';
import type { JwtPayload } from './jwt.strategy';

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
  ) {}

  async register(email: string, password: string, name: string) {
    const existing = await this.prisma.user.findFirst({ where: { email } });
    if (existing) throw new ConflictException('Email already registered');

    const passwordHash = await argon2.hash(password);
    const studentRole = await this.prisma.role.findUniqueOrThrow({ where: { key: 'STUDENT' } });

    const user = await this.prisma.user.create({
      data: {
        email,
        name,
        passwordHash,
        userRoles: { create: { roleId: studentRole.id } },
      },
      include: { userRoles: { include: { role: true } } },
    });

    return this.signToken(user);
  }

  async login(email: string, password: string, mfaCode?: string) {
    const user = await this.prisma.user.findFirst({
      where: { email },
      include: { userRoles: { include: { role: true } } },
    });
    if (!user || !user.passwordHash) throw new UnauthorizedException('Invalid credentials');

    const valid = await argon2.verify(user.passwordHash, password);
    if (!valid) throw new UnauthorizedException('Invalid credentials');

    if (user.status === 'DISABLED') throw new UnauthorizedException('Account disabled');

    const roles = user.userRoles.map((ur) => ur.role.key);
    const requiresMfa = user.mfaEnabled && (roles.includes('ADMIN') || roles.includes('SUPER_ADMIN'));

    if (requiresMfa) {
      if (!mfaCode) return { mfaRequired: true };
      if (!user.mfaSecret) throw new UnauthorizedException('MFA not configured');
      const totp = new TOTP({ secret: user.mfaSecret });
      if (totp.validate({ token: mfaCode, window: 1 }) === null) {
        throw new UnauthorizedException('Invalid MFA code');
      }
    }

    return this.signToken(user);
  }

  private signToken(user: { id: string; email: string; userRoles: { role: { key: string } }[] }) {
    const roles = user.userRoles.map((ur) => ur.role.key);
    const payload: JwtPayload = { sub: user.id, email: user.email, roles };
    return { token: this.jwt.sign(payload), roles };
  }

  async setupMfa(userId: string) {
    const secret = new TOTP({ issuer: 'BookingPlatform', label: userId }).secret.base32;
    await this.prisma.user.update({
      where: { id: userId },
      data: { mfaSecret: secret, mfaEnabled: false },
    });
    return { secret, otpauthUrl: `otpauth://totp/BookingPlatform:${userId}?secret=${secret}&issuer=BookingPlatform` };
  }

  async confirmMfa(userId: string, code: string) {
    const user = await this.prisma.user.findUniqueOrThrow({ where: { id: userId } });
    if (!user.mfaSecret) throw new BadRequestException('MFA not set up');
    const totp = new TOTP({ secret: user.mfaSecret });
    if (totp.validate({ token: code, window: 1 }) === null) throw new BadRequestException('Invalid code');
    await this.prisma.user.update({ where: { id: userId }, data: { mfaEnabled: true } });
    return { enabled: true };
  }
}
