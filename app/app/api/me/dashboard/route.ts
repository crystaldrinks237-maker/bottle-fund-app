import { handler } from '@/lib/api';
import { requireUser } from '@/lib/session';
import { investorDashboard } from '@/lib/services/admin';

export const GET = handler(async () => investorDashboard((await requireUser()).id));
