/**
 * Mobile-Optimized Booking Form
 * Touch-friendly booking experience with swipe navigation
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { motion } from 'framer-motion';
import { Swiper, SwiperSlide } from 'swiper/react';
import { Navigation, Pagination } from 'swiper/modules';
import BookingPhotos from '../Camera/BookingPhotos';
import { useRouter } from 'next/router';
import { useGestures, usePullToRefresh } from '../../lib/mobile/useGestures';
import GestureHint, { useGestureHints } from './GestureHint';

// Import Swiper styles
import 'swiper/css';
import 'swiper/css/navigation';
import 'swiper/css/pagination';

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

export default function MobileBookingForm() {
  const router = useRouter();
  const swiperRef = useRef<any>(null);

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
    if (selectedDate && selectedService) {
      fetchAvailableTimeSlots();
    }
  }, [selectedDate, selectedService, fetchAvailableTimeSlots]);

  const nextStep = () => {
    if (currentStep < steps.length - 1) {
      setCurrentStep(currentStep + 1);
      swiperRef.current?.slideNext();
    }
  };

  const prevStep = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
      swiperRef.current?.slidePrev();
    }
  };

  const canProceed = (step: number) => {
    switch (step) {
      case 0: return !!selectedService;
      case 1: return !!selectedDate && !!selectedTime;
      case 2: return !!vehicleType && !!customerInfo.name && !!customerInfo.email && !!customerInfo.phone;
      case 3: return true; // Photos are optional
      case 4: return true;
      default: return false;
    }
  };

  const handleBooking = async () => {
    setLoading(true);
    setError('');

    try {
      // Create booking
      const bookingResponse = await fetch('/api/bookings/create', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
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

      // Redirect to simple success page with booking confirmation
      window.location.href = `/booking/success?booking=${bookingData.data.booking.confirmationCode}`;
    } catch (error: any) {
      setError(error.message);
      setLoading(false);
    }
  };

  const formatPrice = (priceCents: number) => {
    return `${(priceCents / 100).toFixed(0)}€`;
  };

  const formatDuration = (minutes: number) => {
    if (minutes < 60) {
      return `${minutes} min`;
    }
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return mins > 0 ? `${hours}h ${mins}min` : `${hours}h`;
  };

  const selectedServiceData = services.find(s => s.id === selectedService);

  // Gesture hints
  const {
    showHintIfNew,
    hideHintAndMarkSeen,
    isHintVisible,
  } = useGestureHints();

  // Show gesture hints on first load
  useEffect(() => {
    showHintIfNew('swipe', 2000);
  }, [showHintIfNew]);

  // Show pull-to-refresh hint when user can refresh
  useEffect(() => {
    if (currentStep === 0 || (currentStep === 1 && selectedDate && selectedService)) {
      showHintIfNew('pull', 3000);
    }
  }, [currentStep, selectedDate, selectedService, showHintIfNew]);

  // Gesture handlers
  const { gestureHandlers, hapticFeedback } = useGestures({
    onSwipeLeft: () => {
      if (canProceed(currentStep)) {
        nextStep();
      }
    },
    onSwipeRight: () => {
      prevStep();
    },
    enableHapticFeedback: true,
  });

  // Pull to refresh
  const { pullToRefreshHandlers, isPulling, pullProgress } = usePullToRefresh(() => {
    // Refresh services or availability
    if (currentStep === 0) {
      fetchServices();
    } else if (currentStep === 1 && selectedDate && selectedService) {
      fetchAvailableTimeSlots();
    }
  });

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
          <motion.div
            className="bg-gradient-to-r from-blue-500 to-blue-600 h-2 rounded-full"
            initial={{ width: '0%' }}
            animate={{ width: `${((currentStep + 1) / steps.length) * 100}%` }}
            transition={{ duration: 0.3 }}
          />
        </div>
      </div>

      {/* Pull to Refresh Indicator */}
      {isPulling && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="absolute top-16 left-1/2 transform -translate-x-1/2 z-20 bg-white rounded-full p-2 shadow-lg"
        >
          <motion.div
            animate={{ rotate: pullProgress * 360 }}
            className="w-6 h-6"
          >
            <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
          </motion.div>
        </motion.div>
      )}

      {/* Content Area */}
      <div
        className="flex-1 overflow-hidden"
        {...gestureHandlers}
        {...pullToRefreshHandlers}
      >
        <Swiper
          ref={swiperRef}
          modules={[Navigation, Pagination]}
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
                  <motion.div
                    key={service.id}
                    whileTap={{ scale: 0.98 }}
                    whileHover={{ scale: 1.02 }}
                    className={`p-4 rounded-2xl border-2 cursor-pointer transition-all ${
                      selectedService === service.id
                        ? 'border-blue-500 bg-blue-50 shadow-lg'
                        : 'border-gray-200 bg-white hover:border-blue-200'
                    }`}
                    onClick={() => {
                      setSelectedService(service.id);
                      hapticFeedback([10]); // Light haptic feedback
                    }}
                  >
                    <div className="flex justify-between items-start mb-3">
                      <h3 className="text-lg font-bold text-gray-900">{service.titleFi}</h3>
                      <div className="text-right">
                        <div className="text-2xl font-bold text-blue-600">{formatPrice(service.priceCents)}</div>
                        <div className="text-sm text-gray-500">{formatDuration(service.durationMinutes)}</div>
                      </div>
                    </div>
                    <p className="text-gray-600 text-sm">{service.descriptionFi}</p>
                  </motion.div>
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
                        <motion.button
                          key={slot.time}
                          whileTap={{ scale: 0.95 }}
                          whileHover={{ scale: slot.available ? 1.05 : 1 }}
                          disabled={!slot.available}
                          className={`p-3 text-sm rounded-xl border-2 font-medium transition-all ${
                            selectedTime === slot.time
                              ? 'bg-blue-500 text-white border-blue-500'
                              : slot.available
                              ? 'bg-white text-gray-700 border-gray-300 hover:border-blue-300'
                              : 'bg-gray-100 text-gray-400 border-gray-200 cursor-not-allowed'
                          }`}
                          onClick={() => {
                            if (slot.available) {
                              setSelectedTime(slot.time);
                              hapticFeedback([15]); // Medium haptic feedback
                            }
                          }}
                        >
                          {slot.time}
                        </motion.button>
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
        <motion.button
          whileTap={{ scale: 0.95 }}
          onClick={() => {
            prevStep();
            hapticFeedback([10]);
          }}
          disabled={currentStep === 0}
          className="flex items-center space-x-2 px-6 py-3 text-gray-600 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          <span>Takaisin</span>
        </motion.button>

        {currentStep < steps.length - 1 ? (
          <motion.button
            whileTap={{ scale: 0.95 }}
            onClick={() => {
              if (canProceed(currentStep)) {
                nextStep();
                hapticFeedback([15]);
              }
            }}
            disabled={!canProceed(currentStep)}
            className="flex items-center space-x-2 bg-blue-600 text-white px-6 py-3 rounded-xl font-medium disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <span>Seuraava</span>
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </motion.button>
        ) : (
          <motion.button
            whileTap={{ scale: 0.95 }}
            whileHover={{ scale: 1.02 }}
            onClick={() => {
              if (!loading) {
                handleBooking();
                hapticFeedback([30, 10, 30]); // Strong success haptic
              }
            }}
            disabled={loading}
            className="flex items-center space-x-2 bg-green-600 text-white px-8 py-3 rounded-xl font-bold text-lg disabled:opacity-50 disabled:cursor-not-allowed shadow-lg"
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
          </motion.button>
        )}
      </div>

      {/* Gesture Hints */}
      <GestureHint
        show={isHintVisible('swipe')}
        onDismiss={() => hideHintAndMarkSeen('swipe')}
        type="swipe"
        message="Pyyhkäise vasemmalle siirtyäksesi seuraavaan vaiheeseen"
      />

      <GestureHint
        show={isHintVisible('pull')}
        onDismiss={() => hideHintAndMarkSeen('pull')}
        type="pull"
        message="Vedä alaspäin päivittääksesi tiedot"
      />
    </div>
  );
}