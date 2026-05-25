import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Observable, tap } from 'rxjs';
import { AuditLogService } from './audit-log.service';

export const AUDIT_ACTION_KEY = 'audit:action';
export const AUDIT_RESOURCE_KEY = 'audit:resource';

export interface AuditMetadata {
  action: string;
  resourceType: string;
  resourceIdExtractor?: (result: unknown) => string;
}

/**
 * Global interceptor: automatically writes an AuditLog entry for any handler
 * decorated with @AuditLog({ action, resourceType }).
 * For finer-grained before/after capture, services call AuditLogService.log()
 * directly inside their transactions.
 */
@Injectable()
export class AuditLogInterceptor implements NestInterceptor {
  constructor(
    private readonly reflector: Reflector,
    private readonly auditLog: AuditLogService,
  ) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const metadata = this.reflector.getAllAndOverride<AuditMetadata>(AUDIT_ACTION_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (!metadata) return next.handle();

    const req = context.switchToHttp().getRequest<{
      user?: { id?: string };
      ip?: string;
    }>();
    const actorId = req.user?.id;
    const ipAddress = req.ip;

    return next.handle().pipe(
      tap((result) => {
        const resourceId = metadata.resourceIdExtractor
          ? metadata.resourceIdExtractor(result)
          : (result as Record<string, unknown>)?.['id']?.toString() ?? 'unknown';

        void this.auditLog.log({
          actorId,
          action: metadata.action,
          resourceType: metadata.resourceType,
          resourceId,
          afterState: result as Record<string, unknown>,
          ipAddress,
        });
      }),
    );
  }
}
