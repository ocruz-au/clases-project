/**
 * T063 — Unit test: CancellationPolicyService.computeRefundPercent
 */
import { CancellationPolicyService } from './cancellation-policy.service';
import { PrismaService } from '../../prisma/prisma.service';

describe('CancellationPolicyService.computeRefundPercent', () => {
  let service: CancellationPolicyService;

  beforeEach(() => {
    service = new CancellationPolicyService({} as PrismaService);
  });

  const tieredPolicy = {
    rules: [
      { hoursBefore: 48, refundPercent: 100 },
      { hoursBefore: 24, refundPercent: 50 },
      { hoursBefore: 0, refundPercent: 0 },
    ],
  };

  it('returns 100% when cancelled more than 48h before session', () => {
    // Session at 09:00 Perth (01:00 UTC) on June 10
    const sessionStart = new Date('2026-06-10T01:00:00Z');
    // Cancel 72h before
    const cancelledAt = new Date('2026-06-07T01:00:00Z');
    expect(service.computeRefundPercent(tieredPolicy, sessionStart, cancelledAt)).toBe(100);
  });

  it('returns 100% when cancelled exactly 48h before', () => {
    const sessionStart = new Date('2026-06-10T01:00:00Z');
    const cancelledAt = new Date('2026-06-08T01:00:00Z');
    expect(service.computeRefundPercent(tieredPolicy, sessionStart, cancelledAt)).toBe(100);
  });

  it('returns 50% when cancelled 24–48h before', () => {
    const sessionStart = new Date('2026-06-10T01:00:00Z');
    const cancelledAt = new Date('2026-06-08T13:00:00Z'); // 36h before
    expect(service.computeRefundPercent(tieredPolicy, sessionStart, cancelledAt)).toBe(50);
  });

  it('returns 0% when cancelled less than 24h before', () => {
    const sessionStart = new Date('2026-06-10T01:00:00Z');
    const cancelledAt = new Date('2026-06-09T13:00:00Z'); // 12h before
    expect(service.computeRefundPercent(tieredPolicy, sessionStart, cancelledAt)).toBe(0);
  });

  it('returns 0 for empty rules', () => {
    expect(service.computeRefundPercent({ rules: [] }, new Date(), new Date())).toBe(0);
  });

  it('returns 0 when cancelled after the session starts', () => {
    const sessionStart = new Date('2026-06-10T01:00:00Z');
    const cancelledAt = new Date('2026-06-11T01:00:00Z');
    expect(service.computeRefundPercent(tieredPolicy, sessionStart, cancelledAt)).toBe(0);
  });

  it('handles Perth midnight boundary — session at 00:30 Perth (16:30 UTC previous day)', () => {
    // 00:30 Perth on June 10 = 16:30 UTC on June 9
    const sessionStart = new Date('2026-06-09T16:30:00Z');
    // Cancel exactly 72h before → 100%
    const cancelledAt = new Date('2026-06-06T16:30:00Z');
    expect(service.computeRefundPercent(tieredPolicy, sessionStart, cancelledAt)).toBe(100);
  });

  it('uses the highest matching bracket', () => {
    const singleRulePolicy = {
      rules: [{ hoursBefore: 24, refundPercent: 75 }],
    };
    const sessionStart = new Date('2026-06-10T01:00:00Z');
    const cancelledAt = new Date('2026-06-08T01:00:00Z'); // 48h before
    expect(service.computeRefundPercent(singleRulePolicy, sessionStart, cancelledAt)).toBe(75);
  });
});
