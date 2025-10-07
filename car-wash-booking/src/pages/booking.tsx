import { useRouter } from 'next/router';
import { useState, useEffect, useCallback } from 'react';
import Footer from '../components/Footer';
import Header from '../components/Header';
import SEO from '../components/SEO';
import FloatingContact from '../components/FloatingContact';
// Camera component removed to reduce memory usage
import { siteConfig } from '../lib/siteConfig';
// Use database API instead of static files
interface Service {
  id: number;
  titleFi: string;
  titleEn: string;
  descriptionFi: string;
  descriptionEn: string;
  priceCents: number;
  durationMinutes: number;
  isActive: boolean;
}

interface TimeSlot {
  time: string;
  available: boolean;
}

// Define a proper type for photos for better type safety
interface Photo {
  id: string;
  url: string;
  timestamp: number;
}

export default function Booking() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [services, setServices] = useState<Service[]>([]);
  const [timeSlots, setTimeSlots] = useState<TimeSlot[]>([]);

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
  const [showPhotos, setShowPhotos] = useState(false);
  // FIXED: Used the specific Photo[] type instead of any[]
  const [bookingPhotos, setBookingPhotos] = useState<Photo[]>([]);
  // NOTE: This state is for a future backend implementation.
  // The ID would be fetched from the server *before* showing the photo component.
  const [bookingId, setBookingId] = useState<string | undefined>(undefined);

  const vehicleTypes = [
    'Henkilöauto (pieni)',
    'Henkilöauto (keskikokoinen)',
    'Henkilöauto (suuri)',
    'Maastoauto/SUV',
    'Pakettiauto',
    'Muu'
  ];

  const loadServices = useCallback(async () => {
    try {
      const response = await fetch('/api/services?active=true');
      const data = await response.json();

      if (data.success) {
        setServices(data.data);
      } else {
        throw new Error('Palveluiden lataus epäonnistui');
      }
    } catch (error) {
      console.error('Failed to load services:', error);
      setError('Palveluiden lataus epäonnistui. Päivitä sivu.');
    }
  }, []);

  const loadAvailableTimeSlots = useCallback(() => {
    if (!selectedDate || !selectedService) return;

    try {
      // Generate simple time slots (9:00-17:00, 1-hour intervals)
      const slots: TimeSlot[] = [];
      for (let hour = 9; hour <= 17; hour++) {
        const time = `${hour.toString().padStart(2, '0')}:00`;
        slots.push({
          time,
          available: true // For simplicity, show all slots as available
        });
      }
      setTimeSlots(slots);
      setError(''); // Clear any previous errors
    } catch (error) {
      console.error('Failed to generate time slots:', error);
      setError('Ei voitu hakea vapaita aikoja. Yritä uudelleen.');
      setTimeSlots([]);
    }
  }, [selectedDate, selectedService]);

  useEffect(() => {
    loadServices();
  }, [loadServices]);

  useEffect(() => {
    loadAvailableTimeSlots();
  }, [loadAvailableTimeSlots]);

  const handleBooking = async () => {
    setLoading(true);
    setError('');

    try {
      // Validate required fields
      if (!selectedService || !selectedDate || !selectedTime || !vehicleType ||
          !customerInfo.name || !customerInfo.email || !customerInfo.phone) {
        throw new Error('Kaikki pakolliset kentät täytyy täyttää');
      }

      // Create booking via database API (same as mobile forms)
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

    } catch (error) {
      const message = error instanceof Error ? error.message : 'Tuntematon virhe tapahtui';
      setError(message);
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

  return (
    <>
      <SEO
        title={`Varaa aika - ${siteConfig.name}`}
        description="Varaa aika autopesuun. Helppo online-varaus, ammattitaitoinen palvelu."
      />
      <Header />

      <main className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 pt-20">
        {/* Hero Section */}
        <section className="bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 py-16 relative overflow-hidden">
          <div className="absolute inset-0 bg-[url('https://images.unsplash.com/photo-1558618666-fcd25c85cd64?q=80&w=1920&auto=format&fit=crop')] bg-cover bg-center opacity-20"></div>
          <div className="relative container mx-auto px-4 text-center">
            <h1 className="font-display text-4xl md:text-6xl font-bold text-white mb-6">
              Varaa
              <span className="block bg-gradient-to-r from-amber-400 to-amber-200 bg-clip-text text-transparent">
                Autopesuaika
              </span>
            </h1>
            <p className="text-xl md:text-2xl text-slate-200 mb-8 max-w-3xl mx-auto">
              Ammattitaitoinen palvelu, 100% tyytyväisyystakuu, helppo online-varaus
            </p>
          </div>
        </section>

        {/* Booking Form */}
        <section className="py-16">
          <div className="container mx-auto px-4 max-w-4xl">
            <div className="bg-white rounded-3xl shadow-2xl overflow-hidden">
              {/* Progress Steps */}
              <div className="bg-slate-900 px-4 md:px-8 py-6">
                <div className="flex items-center justify-between text-white text-xs sm:text-sm md:text-base">
                  {/* Step 1 */}
                  <div className="flex items-center space-x-1 sm:space-x-2">
                    <div className="w-7 h-7 sm:w-8 sm:h-8 bg-amber-500 rounded-full flex items-center justify-center text-slate-900 font-bold text-xs sm:text-sm flex-shrink-0">1</div>
                    <span className="font-medium hidden sm:inline">Valitse palvelu</span>
                    <span className="font-medium sm:hidden">Palvelu</span>
                  </div>
                  <div className="hidden md:block w-16 h-0.5 bg-slate-600"></div>
                  {/* Step 2 */}
                  <div className={`flex items-center space-x-1 sm:space-x-2 ${selectedService && selectedDate ? '' : 'opacity-50'}`}>
                    <div className={`w-7 h-7 sm:w-8 sm:h-8 rounded-full flex items-center justify-center font-bold text-xs sm:text-sm flex-shrink-0 ${selectedService && selectedDate ? 'bg-amber-500 text-slate-900' : 'bg-slate-600 text-white'}`}>2</div>
                    <span className="font-medium hidden sm:inline">Aika & päivä</span>
                    <span className="font-medium sm:hidden">Aika</span>
                  </div>
                  <div className="hidden md:block w-16 h-0.5 bg-slate-600"></div>
                   {/* Step 3 */}
                  <div className={`flex items-center space-x-1 sm:space-x-2 ${selectedService && selectedDate && selectedTime ? '' : 'opacity-50'}`}>
                    <div className={`w-7 h-7 sm:w-8 sm:h-8 rounded-full flex items-center justify-center font-bold text-xs sm:text-sm flex-shrink-0 ${selectedService && selectedDate && selectedTime ? 'bg-amber-500 text-slate-900' : 'bg-slate-600 text-white'}`}>3</div>
                    <span className="font-medium hidden sm:inline">Yhteystiedot</span>
                    <span className="font-medium sm:hidden">Tiedot</span>
                  </div>
                </div>
              </div>

              <div className="p-4 sm:p-6 md:p-8">
                {error && (
                  <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg text-red-600">
                    {error}
                  </div>
                )}

                {/* Service Selection */}
                <div className="mb-8 md:mb-12">
                  <h2 className="text-xl md:text-2xl font-bold text-slate-900 mb-4 md:mb-6">Valitse palvelu</h2>
                  <div className="grid md:grid-cols-2 gap-4 md:gap-6">
                    {services.map((service) => (
                      <div
                        key={service.id}
                        className={`block p-4 md:p-6 rounded-2xl border-2 transition-all duration-300 text-left cursor-pointer ${
                          selectedService === service.id
                            ? 'border-purple-500 bg-purple-50 shadow-lg ring-2 ring-purple-300'
                            : 'border-slate-200 hover:border-slate-300 hover:shadow-md active:border-purple-400 active:bg-purple-50'
                        }`}
                        style={{
                          touchAction: 'manipulation',
                          WebkitTapHighlightColor: 'transparent',
                          userSelect: 'none',
                          WebkitUserSelect: 'none',
                          MozUserSelect: 'none',
                          msUserSelect: 'none',
                          minHeight: '100px',
                          display: 'block',
                          width: '100%'
                        }}
                        onClick={() => {
                          console.log('Service clicked:', service.id);
                          setSelectedService(service.id);
                        }}
                        onTouchStart={() => {}}
                        role="button"
                        tabIndex={0}
                        aria-pressed={selectedService === service.id}
                      >
                        <div className="flex justify-between items-start mb-3">
                          <h3 className="text-xl font-bold text-slate-900">{service.titleFi}</h3>
                          <div className="text-right">
                            <div className="text-2xl font-bold text-slate-900">{formatPrice(service.priceCents)}</div>
                            <div className="text-sm text-slate-600">{formatDuration(service.durationMinutes)}</div>
                          </div>
                        </div>
                        <p className="text-slate-600 mb-4">{service.descriptionFi}</p>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Date & Time Selection */}
                {selectedService && (
                  <div className="mb-12">
                    <h2 className="text-2xl font-bold text-slate-900 mb-6">Valitse päivä ja aika</h2>
                    <div className="grid md:grid-cols-2 gap-8">
                      <div>
                        <label className="block text-sm font-medium text-slate-700 mb-2">Päivämäärä</label>
                        <input
                          type="date"
                          className="w-full px-4 py-3 border border-slate-300 rounded-xl focus:ring-2 focus:ring-amber-500 focus:border-amber-500 text-base"
                          value={selectedDate}
                          onChange={(e) => setSelectedDate(e.target.value)}
                          min={new Date().toISOString().split('T')[0]}
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-slate-700 mb-2">Aika</label>
                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                          {timeSlots.map((slot) => (
                            <button
                              key={slot.time}
                              disabled={!slot.available}
                              className={`p-3 text-base rounded-lg border transition-all ${
                                selectedTime === slot.time
                                  ? 'bg-amber-500 text-white border-amber-500'
                                  : slot.available
                                  ? 'bg-white text-slate-700 border-slate-300 hover:border-amber-300'
                                  : 'bg-slate-100 text-slate-400 border-slate-200 cursor-not-allowed'
                              }`}
                              onClick={() => slot.available && setSelectedTime(slot.time)}
                            >
                              {slot.time}
                            </button>
                          ))}
                        </div>
                        {/* FIXED: Better conditional messages for time slots */}
                        {!selectedDate && (
                          <p className="text-sm text-slate-500 mt-2">Valitse päivämäärä nähdäksesi vapaat ajat.</p>
                        )}
                        {selectedDate && timeSlots.length === 0 && (
                          <p className="text-sm text-slate-500 mt-2">Valitulle päivälle ei löytynyt vapaita aikoja.</p>
                        )}
                      </div>
                    </div>
                  </div>
                )}

                {/* Vehicle & Contact Info */}
                {selectedService && selectedDate && selectedTime && (
                  <div className="mb-12">
                    <h2 className="text-2xl font-bold text-slate-900 mb-6">Auton tiedot ja yhteystiedot</h2>
                    <div className="grid md:grid-cols-2 gap-6">
                      <div>
                        <label className="block text-sm font-medium text-slate-700 mb-2">Ajoneuvon tyyppi *</label>
                        <select
                          className="w-full px-4 py-3 border border-slate-300 rounded-xl focus:ring-2 focus:ring-amber-500 focus:border-amber-500 text-base"
                          value={vehicleType}
                          onChange={(e) => setVehicleType(e.target.value)}
                          required
                        >
                          <option value="">Valitse ajoneuvon tyyppi</option>
                          {vehicleTypes.map((type) => (
                            <option key={type} value={type}>{type}</option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-slate-700 mb-2">Rekisterinumero</label>
                        <input
                          type="text"
                          className="w-full px-4 py-3 border border-slate-300 rounded-xl focus:ring-2 focus:ring-amber-500 focus:border-amber-500 text-base"
                          placeholder="ABC-123"
                          value={customerInfo.licensePlate}
                          onChange={(e) => setCustomerInfo({...customerInfo, licensePlate: e.target.value})}
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-slate-700 mb-2">Nimi *</label>
                        <input
                          type="text"
                          required
                          className="w-full px-4 py-3 border border-slate-300 rounded-xl focus:ring-2 focus:ring-amber-500 focus:border-amber-500 text-base"
                          placeholder="Etunimi Sukunimi"
                          value={customerInfo.name}
                          onChange={(e) => setCustomerInfo({...customerInfo, name: e.target.value})}
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-slate-700 mb-2">Puhelinnumero *</label>
                        <input
                          type="tel"
                          required
                          className="w-full px-4 py-3 border border-slate-300 rounded-xl focus:ring-2 focus:ring-amber-500 focus:border-amber-500 text-base"
                          placeholder="+358 40 123 4567"
                          value={customerInfo.phone}
                          onChange={(e) => setCustomerInfo({...customerInfo, phone: e.target.value})}
                        />
                      </div>
                      <div className="md:col-span-2">
                        <label className="block text-sm font-medium text-slate-700 mb-2">Sähköposti *</label>
                        <input
                          type="email"
                          required
                          className="w-full px-4 py-3 border border-slate-300 rounded-xl focus:ring-2 focus:ring-amber-500 focus:border-amber-500 text-base"
                          placeholder="etunimi.sukunimi@email.com"
                          value={customerInfo.email}
                          onChange={(e) => setCustomerInfo({...customerInfo, email: e.target.value})}
                        />
                      </div>
                      <div className="md:col-span-2">
                        <label className="block text-sm font-medium text-slate-700 mb-2">Lisätiedot</label>
                        <textarea
                          className="w-full px-4 py-3 border border-slate-300 rounded-xl focus:ring-2 focus:ring-amber-500 focus:border-amber-500 text-base"
                          rows={3}
                          placeholder="Erityistoiveet tai lisätiedot autosta..."
                          value={customerInfo.notes}
                          onChange={(e) => setCustomerInfo({...customerInfo, notes: e.target.value})}
                        ></textarea>
                      </div>
                    </div>
                  </div>
                )}

                {/* Photo section removed to reduce memory usage and simplify booking */}

                {/* Book Now Button */}
                <div className="text-center">
                  <button
                    className="group relative bg-gradient-to-r from-purple-500 to-purple-600 hover:from-purple-600 hover:to-purple-700 text-white font-bold py-5 px-16 rounded-xl text-xl transition-all duration-300 transform hover:scale-105 shadow-xl hover:shadow-glow-lg ring-2 ring-purple-400/50 hover:ring-purple-300 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none disabled:ring-0"
                    disabled={!selectedService || !selectedDate || !selectedTime || !vehicleType || !customerInfo.name || !customerInfo.email || !customerInfo.phone || loading}
                    onClick={handleBooking}
                  >
                    <span className="relative z-10 flex items-center gap-2 justify-center">
                      {loading ? (
                        <>
                          <svg className="animate-spin h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                          </svg>
                          Käsitellään...
                        </>
                      ) : (
                        <>
                          Vahvista varaus
                          <svg className="w-5 h-5 group-hover:translate-x-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                          </svg>
                        </>
                      )}
                    </span>
                    <div className="absolute inset-0 bg-gradient-to-r from-purple-400 to-purple-500 rounded-xl opacity-0 group-hover:opacity-30 transition-opacity duration-300 blur-sm"></div>
                  </button>
                  <p className="text-sm text-slate-600 mt-4">
                    ✅ Saat vahvistuksen sähköpostilla ja tekstiviestillä
                  </p>
                </div>
              </div>
            </div>
          </div>
        </section>
      </main>

      <Footer />
      <FloatingContact />
    </>
  );
}
