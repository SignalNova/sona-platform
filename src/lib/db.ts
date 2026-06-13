import { PrismaClient } from '@prisma/client'

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

// Determine logging level based on environment
const getLogConfig = () => {
  if (process.env.NODE_ENV === 'development') {
    return [
      { emit: 'stdout' as const, level: 'warn' as const },
      { emit: 'stdout' as const, level: 'error' as const },
    ]
  }
  // Production: log errors with structured output for monitoring
  return [
    {
      emit: 'stdout' as const,
      level: 'error' as const,
    },
  ]
}

export const db =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: getLogConfig(),
    datasources: {
      db: {
        url: process.env.DATABASE_URL,
      },
    },
  })

// Connection timeout - abort queries that take too long
const QUERY_TIMEOUT_MS = 15000

// Helper to run queries with a timeout guard
export async function withTimeout<T>(
  promise: Promise<T>,
  ms: number = QUERY_TIMEOUT_MS,
): Promise<T> {
  let timeoutId: NodeJS.Timeout
  const timeoutPromise = new Promise<never>((_, reject) => {
    timeoutId = setTimeout(
      () => reject(new Error(`Database query timed out after ${ms}ms`)),
      ms,
    )
  })
  return Promise.race([promise, timeoutPromise]).finally(() =>
    clearTimeout(timeoutId),
  )
}

// Graceful shutdown - disconnect Prisma on process exit
if (process.env.NODE_ENV === 'production') {
  process.on('beforeExit', async () => {
    await db.$disconnect()
  })
}

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = db
