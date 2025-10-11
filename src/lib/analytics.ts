/**
 * Google Analytics Integration for Car Wash Business
 * Tracks bookings, customer behavior, and business metrics
 */

declare global {
  interface Window {
    gtag: (...args: any[]) => void;
  }
}

// Initialize Google Analytics
export const initializeAnalytics = () => {
  if (typeof window === 'undefined') return;

  const GA_ID = process.env.NEXT_PUBLIC_GA_ID;
  if (!GA_ID) {
    console.log('Google Analytics ID not configured');
    return;
  }

  // Load GA script
  const script = document.createElement('script');
  script.src = `https://www.googletagmanager.com/gtag/js?id=${GA_ID}`;
  script.async = true;
  document.head.appendChild(script);

  // Initialize gtag
  window.gtag = window.gtag || function() {
    (window as any).dataLayer = (window as any).dataLayer || [];
    (window as any).dataLayer.push(arguments);
  };

  window.gtag('js', new Date());
  window.gtag('config', GA_ID, {
    page_title: document.title,
    page_location: window.location.href,
  });

  console.log('✅ Google Analytics initialized:', GA_ID);
};

// Track page views
export const trackPageView = (url: string, title: string) => {
  if (typeof window === 'undefined' || !window.gtag) return;

  window.gtag('config', process.env.NEXT_PUBLIC_GA_ID, {
    page_title: title,
    page_location: url,
  });
};

// Track booking events
export const trackBookingEvent = (
  eventName: 'booking_started' | 'booking_completed' | 'booking_failed',
  bookingData: {
    service_id: number;
    service_name: string;
    price: number;
    vehicle_type: string;
    customer_tier?: string;
  }
) => {
  if (typeof window === 'undefined' || !window.gtag) return;

  window.gtag('event', eventName, {
    event_category: 'booking',
    service_id: bookingData.service_id,
    service_name: bookingData.service_name,
    value: bookingData.price / 100, // Convert cents to euros
    currency: 'EUR',
    vehicle_type: bookingData.vehicle_type,
    customer_tier: bookingData.customer_tier || 'unknown',
  });

  console.log('📊 GA Event:', eventName, bookingData);
};

// Track business conversion events
export const trackConversion = (
  eventName: 'purchase' | 'lead' | 'sign_up',
  value: number,
  currency: string = 'EUR'
) => {
  if (typeof window === 'undefined' || !window.gtag) return;

  window.gtag('event', eventName, {
    value: value / 100, // Convert cents to euros
    currency,
  });
};

// Track customer loyalty events
export const trackLoyaltyEvent = (
  eventName: 'tier_upgraded' | 'points_earned' | 'discount_applied',
  loyaltyData: {
    customer_tier: string;
    points_balance: number;
    points_earned?: number;
    discount_amount?: number;
  }
) => {
  if (typeof window === 'undefined' || !window.gtag) return;

  window.gtag('event', eventName, {
    event_category: 'loyalty',
    customer_tier: loyaltyData.customer_tier,
    points_balance: loyaltyData.points_balance,
    points_earned: loyaltyData.points_earned,
    discount_value: loyaltyData.discount_amount ? loyaltyData.discount_amount / 100 : undefined,
  });
};

// Track user engagement
export const trackEngagement = (
  eventName: 'service_view' | 'price_check' | 'contact_click' | 'gallery_view',
  data?: Record<string, any>
) => {
  if (typeof window === 'undefined' || !window.gtag) return;

  window.gtag('event', eventName, {
    event_category: 'engagement',
    ...data,
  });
};

// Track business goals
export const trackBusinessGoal = (
  goalName: 'phone_call' | 'whatsapp_click' | 'repeat_booking' | 'review_submitted',
  value?: number
) => {
  if (typeof window === 'undefined' || !window.gtag) return;

  window.gtag('event', 'business_goal', {
    event_category: 'business',
    goal_type: goalName,
    value: value || 1,
  });
};

// Enhanced page view tracking with business context
export const trackBusinessPageView = (pageName: string, customerType?: string) => {
  if (typeof window === 'undefined' || !window.gtag) return;

  window.gtag('event', 'page_view', {
    page_title: pageName,
    customer_type: customerType || 'anonymous',
    business_type: 'car_wash',
  });
};