import { handler } from '@/lib/api';
import { requireUser } from '@/lib/session';
import { guarantorDashboard } from '@/lib/services/guarantors';

export const GET = handler(async () => guarantorDashboard(await requireUser('GUARANTOR')));
