// lib/prisma-simple.ts

import { PrismaClient } from '@prisma/client';

// Declare a global variable to hold the Prisma Client instance.
// We use 'var' to ensure it's not re-declared on hot reloads in development.
declare global {
  var prisma: PrismaClient | undefined;
}

// Create a single, shared instance of the Prisma Client.
// If 'globalThis.prisma' exists, reuse it. Otherwise, create a new one.
// This prevents creating new connections on every request.
export const prisma = globalThis.prisma || new PrismaClient({
  log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
});

// In development, assign the created prisma instance to the global variable
// to prevent exhausting the database connection limit during hot reloads.
if (process.env.NODE_ENV !== 'production') {
  globalThis.prisma = prisma;
}

