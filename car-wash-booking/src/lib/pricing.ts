/**
 * Dynamic Pricing System for Vehicle Sizes
 * Increases revenue by charging appropriately for larger vehicles
 */

// Vehicle size multipliers - larger vehicles require more work
export const VEHICLE_PRICING = {
  'Henkilöauto (pieni)': { multiplier: 1.0, label: 'Pieni auto' },
  'Henkilöauto (keskikokoinen)': { multiplier: 1.2, label: 'Keskikokoinen auto' },
  'Henkilöauto (suuri)': { multiplier: 1.4, label: 'Suuri auto' },
  'Maastoauto/SUV': { multiplier: 1.6, label: 'SUV/Maastoauto' },
  'Pakettiauto': { multiplier: 1.8, label: 'Pakettiauto' },
  'Muu': { multiplier: 1.3, label: 'Muu ajoneuvo' },
} as const;

export type VehicleType = keyof typeof VEHICLE_PRICING;

/**
 * Calculate price based on vehicle size
 */
export function calculateVehiclePrice(
  basePriceCents: number,
  vehicleType: string
): { finalPrice: number; multiplier: number; savings?: number } {
  const vehiclePricing = VEHICLE_PRICING[vehicleType as VehicleType];

  if (!vehiclePricing) {
    return { finalPrice: basePriceCents, multiplier: 1.0 };
  }

  const finalPrice = Math.round(basePriceCents * vehiclePricing.multiplier);

  return {
    finalPrice,
    multiplier: vehiclePricing.multiplier,
  };
}

/**
 * Calculate total price with loyalty discount and vehicle sizing
 */
export function calculateTotalPrice(
  basePriceCents: number,
  vehicleType: string,
  loyaltyDiscount: number = 0
): {
  originalPrice: number;
  vehiclePrice: number;
  loyaltyDiscount: number;
  finalPrice: number;
  savings: number;
  breakdown: {
    basePrice: string;
    vehicleAdjustment: string;
    loyaltyDiscount: string;
    finalPrice: string;
  };
} {
  const vehiclePricing = calculateVehiclePrice(basePriceCents, vehicleType);
  const discountAmount = Math.round(vehiclePricing.finalPrice * loyaltyDiscount);
  const finalPrice = vehiclePricing.finalPrice - discountAmount;
  const totalSavings = (basePriceCents - finalPrice) + discountAmount;

  return {
    originalPrice: basePriceCents,
    vehiclePrice: vehiclePricing.finalPrice,
    loyaltyDiscount: discountAmount,
    finalPrice: Math.max(finalPrice, Math.round(basePriceCents * 0.5)), // Minimum 50% of base price
    savings: totalSavings,
    breakdown: {
      basePrice: `${(basePriceCents / 100).toFixed(0)}€`,
      vehicleAdjustment: vehiclePricing.multiplier !== 1.0
        ? `${vehiclePricing.multiplier > 1.0 ? '+' : ''}${((vehiclePricing.multiplier - 1) * 100).toFixed(0)}% (${((vehiclePricing.finalPrice - basePriceCents) / 100).toFixed(0)}€)`
        : 'Ei lisämaksua',
      loyaltyDiscount: loyaltyDiscount > 0
        ? `-${(loyaltyDiscount * 100).toFixed(0)}% (${(discountAmount / 100).toFixed(0)}€)`
        : 'Ei alennusta',
      finalPrice: `${(finalPrice / 100).toFixed(0)}€`,
    },
  };
}

/**
 * Get vehicle size display information
 */
export function getVehicleDisplayInfo(vehicleType: string) {
  const pricing = VEHICLE_PRICING[vehicleType as VehicleType];

  if (!pricing) {
    return { label: vehicleType, multiplier: 1.0, surcharge: 'Ei lisämaksua' };
  }

  const surchargeText = pricing.multiplier === 1.0
    ? 'Ei lisämaksua'
    : `+${((pricing.multiplier - 1) * 100).toFixed(0)}% lisämaksu`;

  return {
    label: pricing.label,
    multiplier: pricing.multiplier,
    surcharge: surchargeText,
  };
}

/**
 * Get all vehicle types with pricing info
 */
export function getVehicleTypesWithPricing(basePriceCents: number) {
  return Object.entries(VEHICLE_PRICING).map(([type, info]) => {
    const finalPrice = calculateVehiclePrice(basePriceCents, type);
    return {
      type,
      label: info.label,
      multiplier: info.multiplier,
      basePrice: `${(basePriceCents / 100).toFixed(0)}€`,
      finalPrice: `${(finalPrice.finalPrice / 100).toFixed(0)}€`,
      surcharge: info.multiplier !== 1.0
        ? `+${((info.multiplier - 1) * 100).toFixed(0)}%`
        : 'Perushinta',
    };
  });
}