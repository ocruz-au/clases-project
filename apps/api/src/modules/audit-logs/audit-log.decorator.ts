import { SetMetadata } from '@nestjs/common';
import type { AuditMetadata } from './audit-log.interceptor';
import { AUDIT_ACTION_KEY } from './audit-log.interceptor';

export const AuditLog = (metadata: AuditMetadata) => SetMetadata(AUDIT_ACTION_KEY, metadata);
