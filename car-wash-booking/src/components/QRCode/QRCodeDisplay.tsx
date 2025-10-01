/**
 * QR Code Display Component
 * Displays QR codes with various styling options and actions
 */

import React, { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import {
  generateBookingQR,
  generateContactQR,
  generateUrlQR,
  generateQuickBookingQR,
  downloadQRCode,
  BookingQRData,
  ContactQRData,
} from '../../lib/qrcode';

interface QRCodeDisplayProps {
  type: 'booking' | 'contact' | 'url' | 'quick-booking';
  data: BookingQRData | ContactQRData | string | { serviceId: number; serviceName: string };
  size?: number;
  showDownload?: boolean;
  showShare?: boolean;
  className?: string;
  title?: string;
  description?: string;
}

export default function QRCodeDisplay({
  type,
  data,
  size = 256,
  showDownload = true,
  showShare = true,
  className = '',
  title,
  description,
}: QRCodeDisplayProps) {
  const [qrCodeUrl, setQrCodeUrl] = useState<string>('');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string>('');

  const generateQRCode = useCallback(async () => {
    setIsLoading(true);
    setError('');

    try {
      let qrUrl = '';

      switch (type) {
        case 'booking':
          qrUrl = await generateBookingQR(data as BookingQRData, { size });
          break;

        case 'contact':
          qrUrl = await generateContactQR(data as ContactQRData, { size });
          break;

        case 'url':
          qrUrl = await generateUrlQR(data as string, { size });
          break;

        case 'quick-booking':
          const { serviceId, serviceName } = data as { serviceId: number; serviceName: string };
          qrUrl = await generateQuickBookingQR(serviceId, serviceName, { size });
          break;

        default:
          throw new Error('Invalid QR code type');
      }

      setQrCodeUrl(qrUrl);
    } catch (err: any) {
      setError(err.message || 'Failed to generate QR code');
    } finally {
      setIsLoading(false);
    }
  }, [type, data, size]);

  useEffect(() => {
    generateQRCode();
  }, [generateQRCode]);

  const handleDownload = () => {
    if (!qrCodeUrl) return;

    const filename = getFileName();
    downloadQRCode(qrCodeUrl, filename);
  };

  const handleShare = async () => {
    if (!qrCodeUrl || !navigator.share) return;

    try {
      // Convert data URL to blob
      const response = await fetch(qrCodeUrl);
      const blob = await response.blob();
      const file = new File([blob], getFileName(), { type: 'image/png' });

      await navigator.share({
        title: title || 'QR Code',
        text: description || 'Scan this QR code',
        files: [file],
      });
    } catch (err) {
      console.error('Failed to share QR code:', err);
      // Fallback to copying URL
      if (navigator.clipboard) {
        try {
          await navigator.clipboard.writeText(getShareUrl());
        } catch {
          // Silent fail
        }
      }
    }
  };

  const getFileName = (): string => {
    const timestamp = new Date().toISOString().split('T')[0];
    switch (type) {
      case 'booking':
        const bookingData = data as BookingQRData;
        return `booking-qr-${bookingData.confirmationCode}-${timestamp}.png`;
      case 'contact':
        return `contact-qr-${timestamp}.png`;
      case 'url':
        return `url-qr-${timestamp}.png`;
      case 'quick-booking':
        const { serviceName } = data as { serviceId: number; serviceName: string };
        return `booking-qr-${serviceName.replace(/\s+/g, '-').toLowerCase()}-${timestamp}.png`;
      default:
        return `qr-code-${timestamp}.png`;
    }
  };

  const getShareUrl = (): string => {
    switch (type) {
      case 'booking':
        const bookingData = data as BookingQRData;
        return bookingData.url;
      case 'url':
        return data as string;
      case 'quick-booking':
        const { serviceId } = data as { serviceId: number; serviceName: string };
        return `${process.env.NEXT_PUBLIC_SITE_URL}/booking?service=${serviceId}`;
      default:
        return process.env.NEXT_PUBLIC_SITE_URL || 'https://kiiltoloisto.fi';
    }
  };

  if (isLoading) {
    return (
      <div className={`bg-white rounded-2xl p-6 shadow-sm border ${className}`}>
        <div className="text-center space-y-4">
          <div className="mx-auto w-64 h-64 bg-gray-100 rounded-xl flex items-center justify-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          </div>
          <p className="text-gray-500">Luodaan QR-koodia...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className={`bg-white rounded-2xl p-6 shadow-sm border border-red-200 ${className}`}>
        <div className="text-center space-y-4">
          <div className="mx-auto w-64 h-64 bg-red-50 rounded-xl flex items-center justify-center">
            <svg className="w-12 h-12 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
            </svg>
          </div>
          <div>
            <p className="text-red-600 font-medium">QR-koodin luonti epäonnistui</p>
            <p className="text-red-500 text-sm">{error}</p>
          </div>
          <button
            onClick={generateQRCode}
            className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg transition-colors"
          >
            Yritä uudelleen
          </button>
        </div>
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.3 }}
      className={`bg-white rounded-2xl p-6 shadow-sm border ${className}`}
    >
      <div className="text-center space-y-4">
        {/* Title */}
        {title && (
          <h3 className="text-lg font-semibold text-gray-900">{title}</h3>
        )}

        {/* Description */}
        {description && (
          <p className="text-gray-600 text-sm">{description}</p>
        )}

        {/* QR Code */}
        <div className="inline-block p-4 bg-white rounded-xl border-2 border-gray-100">
          <img
            src={qrCodeUrl}
            alt="QR Code"
            className="mx-auto"
            style={{ width: size, height: size }}
          />
        </div>

        {/* Scan Instructions */}
        <div className="bg-blue-50 rounded-lg p-3">
          <div className="flex items-center justify-center space-x-2 text-blue-700">
            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
              <path d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span className="text-sm font-medium">
              Skannaa kameralla tai QR-lukijalla
            </span>
          </div>
        </div>

        {/* Actions */}
        {(showDownload || showShare) && (
          <div className="flex flex-col sm:flex-row gap-2 justify-center">
            {showDownload && (
              <button
                onClick={handleDownload}
                className="flex items-center justify-center space-x-2 bg-gray-100 hover:bg-gray-200 text-gray-700 px-4 py-2 rounded-lg transition-colors"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                <span>Lataa</span>
              </button>
            )}

            {showShare && typeof navigator !== 'undefined' && 'share' in navigator && (
              <button
                onClick={handleShare}
                className="flex items-center justify-center space-x-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg transition-colors"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.367 2.684 3 3 0 00-5.367-2.684z" />
                </svg>
                <span>Jaa</span>
              </button>
            )}
          </div>
        )}

        {/* Quick Info */}
        {type === 'booking' && (
          <div className="text-left bg-gray-50 rounded-lg p-3 space-y-1">
            <div className="text-xs text-gray-500 uppercase tracking-wide">Varauksen tiedot</div>
            <div className="text-sm text-gray-700">
              {(data as BookingQRData).serviceName}
            </div>
            <div className="text-sm text-gray-600">
              {(data as BookingQRData).date} kello {(data as BookingQRData).time}
            </div>
            <div className="text-xs text-gray-500">
              Varausnumero: {(data as BookingQRData).confirmationCode}
            </div>
          </div>
        )}
      </div>
    </motion.div>
  );
}

// Specialized components for different QR code types
export function BookingQRCode({
  bookingData,
  size = 256,
  showDownload = true,
  showShare = true,
  className = '',
}: {
  bookingData: BookingQRData;
  size?: number;
  showDownload?: boolean;
  showShare?: boolean;
  className?: string;
}) {
  return (
    <QRCodeDisplay
      type="booking"
      data={bookingData}
      size={size}
      showDownload={showDownload}
      showShare={showShare}
      className={className}
      title="Varauksen QR-koodi"
      description="Näytä tämä koodi saapuessasi autopesulaan"
    />
  );
}

export function ContactQRCode({
  contactData,
  size = 256,
  showDownload = true,
  showShare = true,
  className = '',
}: {
  contactData: ContactQRData;
  size?: number;
  showDownload?: boolean;
  showShare?: boolean;
  className?: string;
}) {
  return (
    <QRCodeDisplay
      type="contact"
      data={contactData}
      size={size}
      showDownload={showDownload}
      showShare={showShare}
      className={className}
      title="Yhteystiedot"
      description="Skannaa tallentaaksesi yhteystiedot"
    />
  );
}

export function QuickBookingQRCode({
  serviceId,
  serviceName,
  size = 256,
  showDownload = true,
  showShare = true,
  className = '',
}: {
  serviceId: number;
  serviceName: string;
  size?: number;
  showDownload?: boolean;
  showShare?: boolean;
  className?: string;
}) {
  return (
    <QRCodeDisplay
      type="quick-booking"
      data={{ serviceId, serviceName }}
      size={size}
      showDownload={showDownload}
      showShare={showShare}
      className={className}
      title={`Pikavarauksio: ${serviceName}`}
      description="Skannaa varataksesi tämän palvelun nopeasti"
    />
  );
}