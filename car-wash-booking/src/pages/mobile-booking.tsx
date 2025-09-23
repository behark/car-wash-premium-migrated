/**
 * Mobile Booking Page
 * Dedicated mobile-optimized booking experience
 */

import React from 'react';
import { useRouter } from 'next/router';
import { useEffect } from 'react';
import SEO from '../components/SEO';
import MobileBookingForm from '../components/Mobile/MobileBookingForm';
import { siteConfig } from '../lib/siteConfig';

export default function MobileBooking() {
  const router = useRouter();

  // Redirect desktop users to regular booking page
  useEffect(() => {
    const userAgent = navigator.userAgent;
    const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(userAgent);
    const isTablet = /iPad/i.test(userAgent);
    const isSmallScreen = window.innerWidth <= 768;

    if (!isMobile && !isTablet && !isSmallScreen) {
      router.replace('/booking');
    }
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