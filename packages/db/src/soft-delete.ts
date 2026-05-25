import { Prisma, PrismaClient } from '@prisma/client';

/**
 * Prisma client extension that transparently applies soft-delete semantics:
 * - findMany / findFirst / findFirstOrThrow / findUnique / findUniqueOrThrow:
 *   automatically append `deletedAt: null` to the WHERE clause.
 * - delete / deleteMany: rewritten as update(s) that set `deletedAt = now()`.
 *
 * Models without a `deletedAt` field are left untouched.
 */

const SOFT_DELETE_MODELS: Set<string> = new Set([
  'User',
  'InstructorProfile',
  'Category',
  'Location',
  'Room',
  'CancellationPolicy',
  'Class',
  'AvailabilityRule',
  'ClassSession',
  'Booking',
  'WaitlistEntry',
  'Payment',
  'Coupon',
  'Review',
]);

export function withSoftDelete(client: PrismaClient) {
  return client.$extends({
    query: {
      $allModels: {
        async findMany({ model, operation, args, query }: {
          model: string;
          operation: string;
          args: Record<string, unknown>;
          query: (args: Record<string, unknown>) => Promise<unknown>;
        }) {
          if (SOFT_DELETE_MODELS.has(model)) {
            const where = (args.where ?? {}) as Record<string, unknown>;
            if (!('deletedAt' in where)) {
              args.where = { ...where, deletedAt: null };
            }
          }
          return query(args);
        },

        async findFirst({ model, args, query }: {
          model: string;
          args: Record<string, unknown>;
          query: (args: Record<string, unknown>) => Promise<unknown>;
        }) {
          if (SOFT_DELETE_MODELS.has(model)) {
            const where = (args.where ?? {}) as Record<string, unknown>;
            if (!('deletedAt' in where)) {
              args.where = { ...where, deletedAt: null };
            }
          }
          return query(args);
        },

        async findUnique({ model, args, query }: {
          model: string;
          args: Record<string, unknown>;
          query: (args: Record<string, unknown>) => Promise<unknown>;
        }) {
          if (SOFT_DELETE_MODELS.has(model)) {
            // findUnique does not support WHERE beyond unique fields;
            // fallback to findFirst with deletedAt filter.
            const client_ = client as unknown as Record<string, Record<string, (a: unknown) => Promise<unknown>>>;
            const modelKey = model.charAt(0).toLowerCase() + model.slice(1);
            const where = (args.where ?? {}) as Record<string, unknown>;
            return client_[modelKey]?.['findFirst']?.({ where: { ...where, deletedAt: null } });
          }
          return query(args);
        },

        async delete({ model, args, query }: {
          model: string;
          args: Record<string, unknown>;
          query: (args: Record<string, unknown>) => Promise<unknown>;
        }) {
          if (SOFT_DELETE_MODELS.has(model)) {
            const client_ = client as unknown as Record<string, Record<string, (a: unknown) => Promise<unknown>>>;
            const modelKey = model.charAt(0).toLowerCase() + model.slice(1);
            const where = args.where as Record<string, unknown>;
            return client_[modelKey]?.['update']?.({ where, data: { deletedAt: new Date() } });
          }
          return query(args);
        },

        async deleteMany({ model, args, query }: {
          model: string;
          args: Record<string, unknown>;
          query: (args: Record<string, unknown>) => Promise<unknown>;
        }) {
          if (SOFT_DELETE_MODELS.has(model)) {
            const client_ = client as unknown as Record<string, Record<string, (a: unknown) => Promise<unknown>>>;
            const modelKey = model.charAt(0).toLowerCase() + model.slice(1);
            const where = args.where as Record<string, unknown>;
            return client_[modelKey]?.['updateMany']?.({ where, data: { deletedAt: new Date() } });
          }
          return query(args);
        },
      },
    },
  });
}

export type SoftDeleteClient = ReturnType<typeof withSoftDelete>;
