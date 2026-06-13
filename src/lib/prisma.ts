// Re-export from db.ts to avoid duplicate PrismaClient instances
// Both `prisma` and `db` point to the same singleton
export { db as prisma, db as default } from './db'
