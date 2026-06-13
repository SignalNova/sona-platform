import { NextRequest, NextResponse } from 'next/server';
import { getAdminFromRequestOrUserId } from '../middleware';
import prisma from '@/lib/prisma';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');
    await getAdminFromRequestOrUserId(request, userId);

    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '20');
    const action = searchParams.get('action') || '';
    const search = searchParams.get('search') || '';

    const where: any = {};
    if (action) where.action = { contains: action };
    if (search) where.details = { contains: search };

    const [logs, total] = await Promise.all([
      prisma.platformLog.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.platformLog.count({ where }),
    ]);

    return NextResponse.json({
      logs,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Error fetching logs' }, { status: 500 });
  }
}
