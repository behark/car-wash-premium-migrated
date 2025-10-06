/**
 * Mobile-Optimized Booking Form with Code Splitting
 * Touch-friendly booking experience with swipe navigation and optimized loading
 */

import React, { useState, useEffect, useRef, useCallback, memo } from 'react';
import dynamic from 'next/dynamic';
import { useRouter } from 'next/router';

// Lazy load heavy dependencies (currently unused but may be needed for future animations)
// const MotionDiv = dynamic(
//   () => import('framer-motion').then(mod => ({ default: mod.motion.div })),
//   { ssr: false }
// );

// const MotionButton = dynamic(
//   () => import('framer-motion').then(mod => ({ default: mod.motion.button })),
//   { ssr: false }
// );

// Lazy load Swiper components
const Swiper = dynamic(
  () => import('swiper/react').then(mod => mod.Swiper),
  { ssr: false }
);

const SwiperSlide = dynamic(
  () => import('swiper/react').then(mod => mod.SwiperSlide),
  { ssr: false }
);

// Lazy load Camera components
const BookingPhotos = dynamic(
  () => import('../Camera/BookingPhotos'),
  {
    loading: () => <div className="h-64 bg-gray-100 rounded-xl animate-pulse" />,
    ssr: false
  }
);

// Lazy load gesture components (currently unused but may be needed for future features)
// const GestureHint = dynamic(
//   () => import('./GestureHint'),
//   { ssr: false }
// );

// Import core styles that are needed immediately
import 'swiper/css';

// Lazy load additional Swiper styles
const loadSwiperStyles = async () => {
  // These CSS imports are commented out as they may not have TypeScript declarations
  // await import('swiper/css/navigation');
  // await import('swiper/css/pagination');
};

interface Service {
  id: number;
  titleFi: string;
  titleEn: string;
  descriptionFi: string;
  descriptionEn: string;
  priceCents: number;
  durationMinutes: number;
  capacity: number;
  image?: string;
  isActive: boolean;
}

interface TimeSlot {
  time: string;
  available: boolean;
}

// Memoized components for better performance
const ServiceCard = memo(({
  service,
  selected,
  onClick,
  formatPrice,
  formatDuration
}: {
  service: Service;
  selected: boolean;
  onClick: () => void;
  formatPrice: (_price: number) => string;
  formatDuration: (_duration: number) => string;
}) => (
  <div
    className={`p-4 rounded-2xl border-2 cursor-pointer transition-all transform active:scale-95 ${
      selected
        ? 'border-blue-500 bg-blue-50 shadow-lg'
        : 'border-gray-200 bg-white hover:border-blue-200'
    }`}
    onClick={onClick}
  >
    <div className="flex justify-between items-start mb-3">
      <h3 className="text-lg font-bold text-gray-900">{service.titleFi}</h3>
      <div className="text-right">
        <div className="text-2xl font-bold text-blue-600">{formatPrice(service.priceCents)}</div>
        <div className="text-sm text-gray-500">{formatDuration(service.durationMinutes)}</div>
      </div>
    </div>
    <p className="text-gray-600 text-sm">{service.descriptionFi}</p>
  </div>
));

ServiceCard.displayName = 'ServiceCard';

const TimeSlotButton = memo(({
  slot,
  selected,
  onClick
}: {
  slot: TimeSlot;
  selected: boolean;
  onClick: () => void;
}) => (
  <button
    disabled={!slot.available}
    className={`p-3 text-sm rounded-xl border-2 font-medium transition-all transform active:scale-95 ${
      selected
        ? 'bg-blue-500 text-white border-blue-500'
        : slot.available
        ? 'bg-white text-gray-700 border-gray-300 hover:border-blue-300'
        : 'bg-gray-100 text-gray-400 border-gray-200 cursor-not-allowed'
    }`}
    onClick={() => slot.available && onClick()}
  >
    {slot.time}
  </button>
));

TimeSlotButton.displayName = 'TimeSlotButton';

export default function MobileBookingFormOptimized() {
  const router = useRouter();
  const swiperRef = useRef<any>(null);
  const [stylesLoaded, setStylesLoaded] = useState(false);

  // States
  const [currentStep, setCurrentStep] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [services, setServices] = useState<Service[]>([]);
  const [timeSlots, setTimeSlots] = useState<TimeSlot[]>([]);

  // Form data
  const [selectedService, setSelectedService] = useState<number | null>(null);
  const [selectedDate, setSelectedDate] = useState('');
  const [selectedTime, setSelectedTime] = useState('');
  const [vehicleType, setVehicleType] = useState('');
  const [customerInfo, setCustomerInfo] = useState({
    name: '',
    email: '',
    phone: '',
    licensePlate: '',
    notes: ''
  });
  const [bookingPhotos, setBookingPhotos] = useState<any[]>([]);

  const vehicleTypes = [
    'Henkilöauto (pieni)',
    'Henkilöauto (keskikokoinen)',
    'Henkilöauto (suuri)',
    'Maastoauto/SUV',
    'Pakettiauto',
    'Muu'
  ];

  const steps = [
    { title: 'Palvelu', icon: '🚗' },
    { title: 'Aika', icon: '📅' },
    { title: 'Tiedot', icon: '👤' },
    { title: 'Kuvat', icon: '📸' },
    { title: 'Vahvista', icon: '✅' }
  ];

  // Load Swiper styles asynchronously
  useEffect(() => {
    loadSwiperStyles().then(() => setStylesLoaded(true));
  }, []);

  const fetchServices = useCallback(async () => {
    try {
      const response = await fetch('/api/services?active=true');
      const data = await response.json();
      if (data.success) {
        setServices(data.services);
      }
    } catch (error) {
      console.error('Failed to fetch services:', error);
    }
  }, []);

  const fetchAvailableTimeSlots = useCallback(async () => {
    if (!selectedDate || !selectedService) return;

    try {
      const response = await fetch(
        `/api/bookings/availability?date=${selectedDate}&serviceId=${selectedService}`
      );
      const data = await response.json();
      if (data.success) {
        setTimeSlots(data.timeSlots);
      }
    } catch (error) {
      console.error('Failed to fetch availability:', error);
    }
  }, [selectedDate, selectedService]);

  useEffect(() => {
    fetchServices();
  }, [fetchServices]);

  useEffect(() => {
    fetchAvailableTimeSlots();
  }, [fetchAvailableTimeSlots]);

  const nextStep = useCallback(() => {
    if (currentStep < steps.length - 1) {
      setCurrentStep(prev => prev + 1);
      swiperRef.current?.slideNext();
    }
  }, [currentStep, steps.length]);

  const prevStep = useCallback(() => {
    if (currentStep > 0) {
      setCurrentStep(prev => prev - 1);
      swiperRef.current?.slidePrev();
    }
  }, [currentStep]);

  const canProceed = useCallback((step: number) => {
    switch (step) {
      case 0: return !!selectedService;
      case 1: return !!selectedDate && !!selectedTime;
      case 2: return !!vehicleType && !!customerInfo.name && !!customerInfo.email && !!customerInfo.phone;
      case 3: return true; // Photos are optional
      case 4: return true;
      default: return false;
    }
  }, [selectedService, selectedDate, selectedTime, vehicleType, customerInfo]);

  const handleBooking = async () => {
    setLoading(true);
    setError('');

    try {
      // Create booking
      const bookingResponse = await fetch('/api/bookings/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          serviceId: selectedService,
          vehicleType,
          date: selectedDate,
          startTime: selectedTime,
          customerName: customerInfo.name,
          customerEmail: customerInfo.email,
          customerPhone: customerInfo.phone,
          licensePlate: customerInfo.licensePlate,
          notes: customerInfo.notes,
          photos: bookingPhotos,
        }),
      });

      const bookingData = await bookingResponse.json();

      if (!bookingResponse.ok) {
        throw new Error(bookingData.error || 'Varauksen tekeminen epäonnistui');
      }

      // Haptic feedback
      if ('vibrate' in navigator) {
        navigator.vibrate([100, 50, 100]);
      }

      // Redirect to success page with booking confirmation
      window.location.href = `/booking/confirmation?booking=${bookingData.data.booking.confirmationCode}`;
    } catch (error: any) {
      setError(error.message);
      setLoading(false);
    }
  };

  const formatPrice = useCallback((priceCents: number) => {
    return `${(priceCents / 100).toFixed(0)}€`;
  }, []);

  const formatDuration = useCallback((minutes: number) => {
    if (minutes < 60) {
      return `${minutes} min`;
    }
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return mins > 0 ? `${hours}h ${mins}min` : `${hours}h`;
  }, []);

  const selectedServiceData = services.find(s => s.id === selectedService);

  // Render loading state while Swiper styles are loading
  if (!stylesLoaded) {
    return <div className="h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center">
      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
    </div>;
  }

  return (
    <div className="h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex flex-col">
      {/* Header */}
      <div className="bg-white shadow-sm px-4 py-3 flex items-center justify-between">
        <button
          onClick={() => router.back()}
          className="p-2 text-gray-600 hover:bg-gray-100 rounded-full transition-colors"
        >
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <h1 className="text-lg font-semibold text-gray-900">Varaa aika</h1>
        <div className="w-10" />
      </div>

      {/* Progress Bar */}
      <div className="bg-white px-4 py-3 border-b">
        <div className="flex items-center justify-between mb-2">
          {steps.map((step, index) => (
            <div
              key={index}
              className={`flex items-center space-x-1 ${
                index === currentStep ? 'text-blue-600' : index < currentStep ? 'text-green-600' : 'text-gray-400'
              }`}
            >
              <span className="text-lg">{step.icon}</span>
              <span className="text-xs font-medium hidden sm:inline">{step.title}</span>
            </div>
          ))}
        </div>
        <div className="w-full bg-gray-200 rounded-full h-2">
          <div
            className="bg-gradient-to-r from-blue-500 to-blue-600 h-2 rounded-full transition-all duration-300"
            style={{ width: `${((currentStep + 1) / steps.length) * 100}%` }}
          />
        </div>
      </div>

      {/* Content Area */}
      <div className="flex-1 overflow-hidden">
        <Swiper
          onSwiper={(swiper) => { swiperRef.current = swiper; }}
          spaceBetween={0}
          slidesPerView={1}
          allowTouchMove={false}
          className="h-full"
          onSlideChange={(swiper) => setCurrentStep(swiper.activeIndex)}
        >
          {/* Step 1: Service Selection */}
          <SwiperSlide>
            <div className="h-full overflow-y-auto p-4">
              <div className="space-y-4">
                <div className="text-center mb-6">
                  <h2 className="text-2xl font-bold text-gray-900 mb-2">Valitse palvelu</h2>
                  <p className="text-gray-600">Mikä palvelu sopii sinulle parhaiten?</p>
                </div>

                {services.map((service) => (
                  <ServiceCard
                    key={service.id}
                    service={service}
                    selected={selectedService === service.id}
                    onClick={() => setSelectedService(service.id)}
                    formatPrice={formatPrice}
                    formatDuration={formatDuration}
                  />
                ))}
              </div>
            </div>
          </SwiperSlide>

          {/* Step 2: Date & Time Selection */}
          <SwiperSlide>
            <div className="h-full overflow-y-auto p-4">
              <div className="space-y-6">
                <div className="text-center mb-6">
                  <h2 className="text-2xl font-bold text-gray-900 mb-2">Valitse aika</h2>
                  <p className="text-gray-600">Milloin haluaisit tulla pesulaan?</p>
                </div>

                {selectedServiceData && (
                  <div className="bg-blue-50 rounded-xl p-4 mb-6">
                    <div className="flex items-center space-x-3">
                      <div className="text-2xl">🚗</div>
                      <div>
                        <div className="font-semibold text-gray-900">{selectedServiceData.titleFi}</div>
                        <div className="text-sm text-gray-600">
                          {formatPrice(selectedServiceData.priceCents)} • {formatDuration(selectedServiceData.durationMinutes)}
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Päivämäärä</label>
                  <input
                    type="date"
                    className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-lg"
                    value={selectedDate}
                    onChange={(e) => setSelectedDate(e.target.value)}
                    min={new Date().toISOString().split('T')[0]}
                  />
                </div>

                {selectedDate && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-3">Vapaat ajat</label>
                    <div className="grid grid-cols-3 gap-3">
                      {timeSlots.map((slot) => (
                        <TimeSlotButton
                          key={slot.time}
                          slot={slot}
                          selected={selectedTime === slot.time}
                          onClick={() => setSelectedTime(slot.time)}
                        />
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </SwiperSlide>

          {/* Step 3: Customer Info */}
          <SwiperSlide>
            <div className="h-full overflow-y-auto p-4">
              <div className="space-y-6">
                <div className="text-center mb-6">
                  <h2 className="text-2xl font-bold text-gray-900 mb-2">Tiedot</h2>
                  <p className="text-gray-600">Kerro meille yhteystietosi ja auton tiedot</p>
                </div>

                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Ajoneuvon tyyppi *</label>
                    <select
                      className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-lg"
                      value={vehicleType}
                      onChange={(e) => setVehicleType(e.target.value)}
                      required
                    >
                      <option value="">Valitse tyyppi</option>
                      {vehicleTypes.map((type) => (
                        <option key={type} value={type}>{type}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Rekisterinumero</label>
                    <input
                      type="text"
                      className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-lg"
                      placeholder="ABC-123"
                      value={customerInfo.licensePlate}
                      onChange={(e) => setCustomerInfo({...customerInfo, licensePlate: e.target.value})}
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Nimi *</label>
                    <input
                      type="text"
                      required
                      className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-lg"
                      placeholder="Etunimi Sukunimi"
                      value={customerInfo.name}
                      onChange={(e) => setCustomerInfo({...customerInfo, name: e.target.value})}
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Sähköposti *</label>
                    <input
                      type="email"
                      required
                      className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-lg"
                      placeholder="etunimi.sukunimi@email.com"
                      value={customerInfo.email}
                      onChange={(e) => setCustomerInfo({...customerInfo, email: e.target.value})}
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Puhelinnumero *</label>
                    <input
                      type="tel"
                      required
                      className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-lg"
                      placeholder="+358 40 123 4567"
                      value={customerInfo.phone}
                      onChange={(e) => setCustomerInfo({...customerInfo, phone: e.target.value})}
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Lisätiedot</label>
                    <textarea
                      className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-lg"
                      rows={3}
                      placeholder="Erityistoiveet tai lisätiedot..."
                      value={customerInfo.notes}
                      onChange={(e) => setCustomerInfo({...customerInfo, notes: e.target.value})}
                    />
                  </div>
                </div>
              </div>
            </div>
          </SwiperSlide>

          {/* Step 4: Photos */}
          <SwiperSlide>
            <div className="h-full overflow-y-auto p-4">
              <div className="space-y-6">
                <div className="text-center mb-6">
                  <h2 className="text-2xl font-bold text-gray-900 mb-2">Kuvat (valinnainen)</h2>
                  <p className="text-gray-600">Dokumentoi pesuprosessi kuvilla</p>
                </div>

                <BookingPhotos
                  bookingId={undefined}
                  onPhotosChange={setBookingPhotos}
                  showInstructions={false}
                  className="min-h-0"
                />
              </div>
            </div>
          </SwiperSlide>

          {/* Step 5: Confirmation */}
          <SwiperSlide>
            <div className="h-full overflow-y-auto p-4">
              <div className="space-y-6">
                <div className="text-center mb-6">
                  <h2 className="text-2xl font-bold text-gray-900 mb-2">Vahvista varaus</h2>
                  <p className="text-gray-600">Tarkista tiedot ennen maksua</p>
                </div>

                {/* Booking Summary */}
                <div className="bg-white rounded-2xl p-6 shadow-sm border">
                  <div className="space-y-4">
                    {selectedServiceData && (
                      <div className="flex justify-between items-center pb-4 border-b">
                        <div>
                          <h3 className="font-semibold text-gray-900">{selectedServiceData.titleFi}</h3>
                          <p className="text-sm text-gray-600">{formatDuration(selectedServiceData.durationMinutes)}</p>
                        </div>
                        <div className="text-2xl font-bold text-blue-600">
                          {formatPrice(selectedServiceData.priceCents)}
                        </div>
                      </div>
                    )}

                    <div className="flex justify-between">
                      <span className="text-gray-600">Päivämäärä:</span>
                      <span className="font-medium">{selectedDate}</span>
                    </div>

                    <div className="flex justify-between">
                      <span className="text-gray-600">Aika:</span>
                      <span className="font-medium">{selectedTime}</span>
                    </div>

                    <div className="flex justify-between">
                      <span className="text-gray-600">Ajoneuvo:</span>
                      <span className="font-medium">{vehicleType}</span>
                    </div>

                    <div className="flex justify-between">
                      <span className="text-gray-600">Asiakas:</span>
                      <span className="font-medium">{customerInfo.name}</span>
                    </div>

                    {bookingPhotos.length > 0 && (
                      <div className="flex justify-between">
                        <span className="text-gray-600">Kuvat:</span>
                        <span className="font-medium">{bookingPhotos.length} kpl</span>
                      </div>
                    )}
                  </div>
                </div>

                {error && (
                  <div className="bg-red-50 border border-red-200 rounded-xl p-4">
                    <p className="text-red-600 text-sm">{error}</p>
                  </div>
                )}
              </div>
            </div>
          </SwiperSlide>
        </Swiper>
      </div>

      {/* Navigation Buttons */}
      <div className="bg-white border-t px-4 py-4 flex justify-between items-center">
        <button
          onClick={prevStep}
          disabled={currentStep === 0}
          className="flex items-center space-x-2 px-6 py-3 text-gray-600 disabled:opacity-50 disabled:cursor-not-allowed transform active:scale-95"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          <span>Takaisin</span>
        </button>

        {currentStep < steps.length - 1 ? (
          <button
            onClick={nextStep}
            disabled={!canProceed(currentStep)}
            className="flex items-center space-x-2 bg-blue-600 text-white px-6 py-3 rounded-xl font-medium disabled:opacity-50 disabled:cursor-not-allowed transform active:scale-95"
          >
            <span>Seuraava</span>
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </button>
        ) : (
          <button
            onClick={handleBooking}
            disabled={loading}
            className="flex items-center space-x-2 bg-green-600 text-white px-8 py-3 rounded-xl font-bold text-lg disabled:opacity-50 disabled:cursor-not-allowed shadow-lg transform active:scale-95"
          >
            {loading ? (
              <>
                <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                <span>Käsitellään...</span>
              </>
            ) : (
              <>
                <span>Siirry maksamaan</span>
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </>
            )}
          </button>
        )}
      </div>
    </div>
  );
}