import { Session } from 'next-auth';
import { prisma } from '@/lib/prisma';

export async function verifyAdmin(session: Session | null): Promise<boolean> {
  if (!session?.user?.id) {
    return false;
  }

  // Re-fetch the user from the database to ensure we have trusted data
  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { role: true }, // Only select what we need
  });

  return user?.role === 'admin';
}

export async function verifyAdminAndThrow(session: Session | null): Promise<void> {
  if (!session?.user?.id) {
    throw new Error('Unauthorized: Not logged in');
  }

  const isAdmin = await verifyAdmin(session);
  if (!isAdmin) {
    throw new Error('Unauthorized: Insufficient permissions');
  }
}