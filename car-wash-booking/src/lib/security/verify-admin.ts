import { Session } from 'next-auth';
import { prisma } from '@/lib/prisma';

// Define the extended session user type as it's used in the app
interface SessionUser {
  id?: string;
  email?: string | null;
  name?: string | null;
  image?: string | null;
}

// Create an extended Session type that includes our custom fields
interface ExtendedSession extends Session {
  user?: SessionUser;
}

export async function verifyAdmin(session: ExtendedSession | null): Promise<boolean> {
  if (!session?.user?.id) {
    return false;
  }

  // Re-fetch the user from the database to ensure we have trusted data
  const user = await prisma.user.findUnique({
    where: { id: parseInt(session.user.id) }, // Convert string ID to number for Prisma
    select: { role: true }, // Only select what we need
  });

  return user?.role === 'admin';
}

export async function verifyAdminAndThrow(session: ExtendedSession | null): Promise<void> {
  if (!session?.user?.id) {
    throw new Error('Unauthorized: Not logged in');
  }

  const isAdmin = await verifyAdmin(session);
  if (!isAdmin) {
    throw new Error('Unauthorized: Insufficient permissions');
  }
}
