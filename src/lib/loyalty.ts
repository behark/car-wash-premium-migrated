import { prisma } from './prisma-simple';

// Loyalty tier configuration
export const LOYALTY_TIERS = {
  BRONZE: { name: 'Bronze', minPoints: 0, discount: 0, color: '#CD7F32' },
  SILVER: { name: 'Silver', minPoints: 150, discount: 0.05, color: '#C0C0C0' },
  GOLD: { name: 'Gold', minPoints: 300, discount: 0.10, color: '#FFD700' },
  PLATINUM: { name: 'Platinum', minPoints: 600, discount: 0.15, color: '#E5E4E2' },
} as const;

export type LoyaltyTier = keyof typeof LOYALTY_TIERS;

// Points earning: 1 point per €1 spent
export const POINTS_PER_EURO = 1;

export interface LoyaltyStatus {
  currentPoints: number;
  tier: LoyaltyTier;
  discount: number;
  nextTier?: {
    name: string;
    pointsNeeded: number;
  };
  totalSpent: number;
  visitCount: number;
}

/**
 * Calculate loyalty tier based on points
 */
export function calculateTier(points: number): LoyaltyTier {
  if (points >= LOYALTY_TIERS.PLATINUM.minPoints) return 'PLATINUM';
  if (points >= LOYALTY_TIERS.GOLD.minPoints) return 'GOLD';
  if (points >= LOYALTY_TIERS.SILVER.minPoints) return 'SILVER';
  return 'BRONZE';
}

/**
 * Get or create customer record
 */
export async function getOrCreateCustomer(
  name: string,
  email: string,
  phone?: string
) {
  let customer = await prisma.customer.findUnique({
    where: { email },
  });

  if (!customer) {
    customer = await prisma.customer.create({
      data: {
        name,
        email,
        phone,
        loyaltyPoints: 0,
        totalSpent: 0,
        visitCount: 0,
        loyaltyTier: 'BRONZE',
      },
    });
    console.log('🆕 New customer created:', email);
  }

  return customer;
}

/**
 * Award loyalty points for a booking
 */
export async function awardLoyaltyPoints(
  customerId: number,
  amountCents: number
): Promise<LoyaltyStatus> {
  const pointsEarned = Math.floor(amountCents / 100) * POINTS_PER_EURO;

  const updatedCustomer = await prisma.customer.update({
    where: { id: customerId },
    data: {
      loyaltyPoints: { increment: pointsEarned },
      totalSpent: { increment: amountCents },
      visitCount: { increment: 1 },
      lastVisit: new Date(),
    },
  });

  // Update tier based on new points
  const newTier = calculateTier(updatedCustomer.loyaltyPoints);
  if (newTier !== updatedCustomer.loyaltyTier) {
    await prisma.customer.update({
      where: { id: customerId },
      data: { loyaltyTier: newTier },
    });
    console.log(`🎉 Customer ${customerId} promoted to ${newTier} tier!`);
  }

  return getLoyaltyStatus(updatedCustomer.loyaltyPoints, newTier, updatedCustomer.totalSpent, updatedCustomer.visitCount);
}

/**
 * Get customer loyalty status
 */
export function getLoyaltyStatus(
  points: number,
  tier: string,
  totalSpent: number,
  visitCount: number
): LoyaltyStatus {
  const currentTier = tier as LoyaltyTier;
  const tierInfo = LOYALTY_TIERS[currentTier];

  // Calculate next tier
  let nextTier;
  const tiers = Object.entries(LOYALTY_TIERS);
  const currentTierIndex = tiers.findIndex(([key]) => key === currentTier);

  if (currentTierIndex < tiers.length - 1) {
    const [nextTierKey, nextTierInfo] = tiers[currentTierIndex + 1];
    nextTier = {
      name: nextTierInfo.name,
      pointsNeeded: nextTierInfo.minPoints - points,
    };
  }

  return {
    currentPoints: points,
    tier: currentTier,
    discount: tierInfo.discount,
    nextTier,
    totalSpent,
    visitCount,
  };
}

/**
 * Calculate discount for customer
 */
export async function calculateCustomerDiscount(
  email: string,
  originalPrice: number
): Promise<{ discountedPrice: number; discount: number; loyaltyStatus?: LoyaltyStatus }> {
  try {
    const customer = await prisma.customer.findUnique({
      where: { email },
    });

    if (!customer) {
      return { discountedPrice: originalPrice, discount: 0 };
    }

    const loyaltyStatus = getLoyaltyStatus(
      customer.loyaltyPoints,
      customer.loyaltyTier,
      customer.totalSpent,
      customer.visitCount
    );

    const discountAmount = originalPrice * loyaltyStatus.discount;
    const discountedPrice = Math.round(originalPrice - discountAmount);

    return {
      discountedPrice,
      discount: loyaltyStatus.discount,
      loyaltyStatus,
    };
  } catch (error) {
    console.error('Error calculating customer discount:', error);
    return { discountedPrice: originalPrice, discount: 0 };
  }
}

/**
 * Get loyalty tier display info
 */
export function getTierDisplayInfo(tier: LoyaltyTier) {
  const tierInfo = LOYALTY_TIERS[tier];
  return {
    name: tierInfo.name,
    color: tierInfo.color,
    discount: Math.round(tierInfo.discount * 100), // Convert to percentage
    minPoints: tierInfo.minPoints,
  };
}