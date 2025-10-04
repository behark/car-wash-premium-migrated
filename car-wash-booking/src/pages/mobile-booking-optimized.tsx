/**
 * Mobile Booking Page - Optimized Version
 * Dedicated mobile-optimized booking experience with code splitting
 */

import React, { useEffect } from 'react';
import { useRouter } from 'next/router';
import dynamic from 'next/dynamic';
import SEO from '../components/SEO';
import { siteConfig } from '../lib/siteConfig';

// Lazy load the heavy booking form component
const MobileBookingForm = dynamic(
  () => import('../components/Mobile/MobileBookingForm'),
  {
    loading: () => <BookingFormSkeleton />,
    ssr: false, // Disable SSR for this component to reduce initial bundle
  }
);

// Loading skeleton for better UX
function BookingFormSkeleton() {
  return (
    <div className="h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex flex-col">
      <div className="bg-white shadow-sm px-4 py-3 flex items-center justify-between">
        <div className="w-10 h-10 bg-gray-200 rounded-full animate-pulse" />
        <div className="w-32 h-6 bg-gray-200 rounded animate-pulse" />
        <div className="w-10" />
      </div>

      <div className="bg-white px-4 py-3 border-b">
        <div className="flex items-center justify-between mb-2 space-x-2">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="flex-1 h-8 bg-gray-200 rounded animate-pulse" />
          ))}
        </div>
        <div className="w-full bg-gray-200 rounded-full h-2 animate-pulse" />
      </div>

      <div className="flex-1 p-4">
        <div className="space-y-4">
          <div className="h-20 bg-white rounded-xl shadow-sm animate-pulse" />
          <div className="h-32 bg-white rounded-xl shadow-sm animate-pulse" />
          <div className="h-24 bg-white rounded-xl shadow-sm animate-pulse" />
        </div>
      </div>

      <div className="bg-white border-t px-4 py-4">
        <div className="flex justify-between">
          <div className="w-24 h-12 bg-gray-200 rounded-xl animate-pulse" />
          <div className="w-32 h-12 bg-blue-200 rounded-xl animate-pulse" />
        </div>
      </div>
    </div>
  );
}

export default function MobileBookingOptimized() {
  const router = useRouter();

  // Redirect desktop users to regular booking page
  useEffect(() => {
    const checkDevice = () => {
      const userAgent = navigator.userAgent;
      const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(userAgent);
      const isTablet = /iPad/i.test(userAgent);
      const isSmallScreen = window.innerWidth <= 768;

      if (!isMobile && !isTablet && !isSmallScreen) {
        router.replace('/booking');
      }
    };

    // Check on mount
    checkDevice();

    // Check on resize
    const handleResize = () => checkDevice();
    window.addEventListener('resize', handleResize);

    return () => window.removeEventListener('resize', handleResize);
  }, [router]);

  return (
    <>
      <SEO
        title={`Mobiilivaraus - ${siteConfig.name}`}
        description="Mobiilioptimoitu autopesuvaraus. Helppo käyttää kosketusnäytöllä."
      />

      <MobileBookingForm />
    </>
  );
}