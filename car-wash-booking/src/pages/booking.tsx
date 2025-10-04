import { useRouter } from 'next/router';
import { useState, useEffect, useCallback } from 'react';
import Footer from '../components/Footer';
import Header from '../components/Header';
import SEO from '../components/SEO';
import FloatingContact from '../components/FloatingContact';
import BookingPhotos from '../components/Camera/BookingPhotos';
import { siteConfig } from '../lib/siteConfig';
import { getActiveServices, getServiceById, Service } from '../lib/static-services';
import { generateTimeSlots, saveBooking, TimeSlot } from '../lib/booking-storage';

// Service and TimeSlot interfaces imported from static-services and booking-storage

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
  const [bookingPhotos, setBookingPhotos] = useState<any[]>([]);

  const vehicleTypes = [
    'Henkilöauto (pieni)',
    'Henkilöauto (keskikokoinen)',
    'Henkilöauto (suuri)',
    'Maastoauto/SUV',
    'Pakettiauto',
    'Muu'
  ];

  const loadServices = useCallback(() => {
    try {
      const activeServices = getActiveServices();
      setServices(activeServices);
    } catch (error) {
      console.error('Failed to load services:', error);
    }
  }, []);

  const loadAvailableTimeSlots = useCallback(() => {
    if (!selectedDate || !selectedService) return;

    try {
      const slots = generateTimeSlots(selectedDate, selectedService);
      setTimeSlots(slots);
      setError(''); // Clear any previous errors
    } catch (error) {
      console.error('Failed to generate time slots:', error);
      setError('Ei voitu hakea vapaita aikoja. Yritä uudelleen.');
      setTimeSlots([]);
    }
  }, [selectedDate, selectedService]);

  // Load services on component mount
  useEffect(() => {
    loadServices();
  }, [loadServices]);

  // Load available time slots when date and service are selected
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

      // Get service data
      const service = getServiceById(selectedService);
      if (!service) {
        throw new Error('Palvelua ei löytynyt');
      }

      // Create booking using localStorage
      const booking = saveBooking({
        serviceId: selectedService,
        serviceName: service.titleFi,
        servicePrice: service.price,
        vehicleType,
        date: selectedDate,
        time: selectedTime,
        duration: service.durationMinutes,
        customerName: customerInfo.name,
        customerEmail: customerInfo.email,
        customerPhone: customerInfo.phone,
        licensePlate: customerInfo.licensePlate || undefined,
        notes: customerInfo.notes || undefined,
      });

      console.log('Booking created successfully:', booking);

      // Redirect to confirmation page
      router.push(`/booking/confirmation?booking=${booking.confirmationCode}`);

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
            <div className="inline-flex items-center bg-purple-500/20 backdrop-blur-sm border border-purple-400/30 rounded-full px-6 py-2 mb-8">
              <span className="text-purple-300 text-sm font-medium">
                🚗 Online-varaus
              </span>
            </div>

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
              <div className="bg-slate-900 px-8 py-6">
                <div className="flex items-center justify-between text-white">
                  <div className="flex items-center space-x-2">
                    <div className={`w-8 h-8 ${selectedService ? 'bg-amber-500' : 'bg-amber-500'} rounded-full flex items-center justify-center text-slate-900 font-bold text-sm`}>1</div>
                    <span className="font-medium">Valitse palvelu</span>
                  </div>
                  <div className="hidden md:block w-16 h-0.5 bg-slate-600"></div>
                  <div className={`flex items-center space-x-2 ${selectedService && selectedDate ? '' : 'opacity-50'}`}>
                    <div className={`w-8 h-8 ${selectedService && selectedDate ? 'bg-amber-500' : 'bg-slate-600'} rounded-full flex items-center justify-center text-${selectedService && selectedDate ? 'slate-900' : 'white'} font-bold text-sm`}>2</div>
                    <span className="font-medium">Aika & päivä</span>
                  </div>
                  <div className="hidden md:block w-16 h-0.5 bg-slate-600"></div>
                  <div className={`flex items-center space-x-2 ${selectedService && selectedDate && selectedTime ? '' : 'opacity-50'}`}>
                    <div className={`w-8 h-8 ${selectedService && selectedDate && selectedTime ? 'bg-amber-500' : 'bg-slate-600'} rounded-full flex items-center justify-center text-${selectedService && selectedDate && selectedTime ? 'slate-900' : 'white'} font-bold text-sm`}>3</div>
                    <span className="font-medium">Yhteystiedot</span>
                  </div>
                  <div className="hidden md:block w-16 h-0.5 bg-slate-600"></div>
                  <div className={`flex items-center space-x-2 ${selectedService && selectedDate && selectedTime && vehicleType && customerInfo.name && customerInfo.email && customerInfo.phone ? '' : 'opacity-50'}`}>
                    <div className={`w-8 h-8 ${selectedService && selectedDate && selectedTime && vehicleType && customerInfo.name && customerInfo.email && customerInfo.phone ? 'bg-amber-500' : 'bg-slate-600'} rounded-full flex items-center justify-center text-${selectedService && selectedDate && selectedTime && vehicleType && customerInfo.name && customerInfo.email && customerInfo.phone ? 'slate-900' : 'white'} font-bold text-sm`}>4</div>
                    <span className="font-medium">Kuvat (valinnainen)</span>
                  </div>
                </div>
              </div>

              <div className="p-8">
                {/* Error display */}
                {error && (
                  <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg text-red-600">
                    {error}
                  </div>
                )}

                {/* Service Selection */}
                <div className="mb-12">
                  <h2 className="text-2xl font-bold text-slate-900 mb-6">Valitse palvelu</h2>
                  <div className="grid md:grid-cols-2 gap-6">
                    {services.map((service) => (
                      <div
                        key={service.id}
                        className={`relative p-6 rounded-2xl border-2 cursor-pointer transition-all duration-300 ${
                          selectedService === service.id
                            ? 'border-amber-500 bg-amber-50 shadow-lg'
                            : 'border-slate-200 hover:border-slate-300 hover:shadow-md'
                        }`}
                        onClick={() => setSelectedService(service.id)}
                      >
                        <div className="flex justify-between items-start mb-3">
                          <h3 className="text-xl font-bold text-slate-900">{service.titleFi}</h3>
                          <div className="text-right">
                            <div className="text-2xl font-bold text-slate-900">{formatPrice(service.priceCents)}</div>
                            <div className="text-sm text-slate-600">{formatDuration(service.durationMinutes)}</div>
                          </div>
                        </div>

                        <p className="text-slate-600 mb-4">{service.descriptionFi}</p>

                        <div className="flex items-center space-x-2 text-sm text-green-600">
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                          <span>100% Tyytyväisyystakuu</span>
                        </div>
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
                          className="w-full px-4 py-3 border border-slate-300 rounded-xl focus:ring-2 focus:ring-amber-500 focus:border-amber-500"
                          value={selectedDate}
                          onChange={(e) => setSelectedDate(e.target.value)}
                          min={new Date().toISOString().split('T')[0]}
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-slate-700 mb-2">Aika</label>
                        <div className="grid grid-cols-3 gap-2">
                          {timeSlots.map((slot) => (
                            <button
                              key={slot.time}
                              disabled={!slot.available}
                              className={`p-2 text-sm rounded-lg border transition-all ${
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
                        {timeSlots.length === 0 && selectedDate && (
                          <p className="text-sm text-slate-500 mt-2">Valitse päivämäärä nähdäksesi vapaat ajat</p>
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
                          className="w-full px-4 py-3 border border-slate-300 rounded-xl focus:ring-2 focus:ring-amber-500 focus:border-amber-500"
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
                          className="w-full px-4 py-3 border border-slate-300 rounded-xl focus:ring-2 focus:ring-amber-500 focus:border-amber-500"
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
                          className="w-full px-4 py-3 border border-slate-300 rounded-xl focus:ring-2 focus:ring-amber-500 focus:border-amber-500"
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
                          className="w-full px-4 py-3 border border-slate-300 rounded-xl focus:ring-2 focus:ring-amber-500 focus:border-amber-500"
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
                          className="w-full px-4 py-3 border border-slate-300 rounded-xl focus:ring-2 focus:ring-amber-500 focus:border-amber-500"
                          placeholder="etunimi.sukunimi@email.com"
                          value={customerInfo.email}
                          onChange={(e) => setCustomerInfo({...customerInfo, email: e.target.value})}
                        />
                      </div>

                      <div className="md:col-span-2">
                        <label className="block text-sm font-medium text-slate-700 mb-2">Lisätiedot</label>
                        <textarea
                          className="w-full px-4 py-3 border border-slate-300 rounded-xl focus:ring-2 focus:ring-amber-500 focus:border-amber-500"
                          rows={3}
                          placeholder="Erityistoiveet tai lisätiedot autosta..."
                          value={customerInfo.notes}
                          onChange={(e) => setCustomerInfo({...customerInfo, notes: e.target.value})}
                        ></textarea>
                      </div>
                    </div>
                  </div>
                )}

                {/* Photo Section */}
                {selectedService && selectedDate && selectedTime && vehicleType && customerInfo.name && customerInfo.email && customerInfo.phone && (
                  <div className="mb-12">
                    <div className="flex items-center justify-between mb-6">
                      <h2 className="text-2xl font-bold text-slate-900">Dokumentoi pesuprosessi</h2>
                      <button
                        onClick={() => setShowPhotos(!showPhotos)}
                        className="flex items-center space-x-2 text-amber-600 hover:text-amber-700 transition-colors"
                      >
                        <span className="text-sm font-medium">
                          {showPhotos ? 'Piilota kuvat' : 'Lisää kuvat (valinnainen)'}
                        </span>
                        <svg
                          className={`w-4 h-4 transition-transform ${showPhotos ? 'rotate-180' : ''}`}
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                        </svg>
                      </button>
                    </div>

                    {showPhotos && (
                      <div className="bg-slate-50 rounded-2xl p-6">
                        <BookingPhotos
                          bookingId={undefined} // Will be set after booking creation
                          onPhotosChange={setBookingPhotos}
                          showInstructions={true}
                        />
                      </div>
                    )}

                    {!showPhotos && bookingPhotos.length > 0 && (
                      <div className="bg-green-50 border border-green-200 rounded-xl p-4">
                        <div className="flex items-center space-x-2 text-green-700">
                          <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                          </svg>
                          <span className="font-medium">
                            {bookingPhotos.length} kuva{bookingPhotos.length !== 1 ? 'a' : ''} tallennettu
                          </span>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* Book Now Button */}
                <div className="text-center">
                  <button
                    className="group relative bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-white font-bold py-4 px-12 rounded-xl text-lg transition-all duration-300 transform hover:scale-105 shadow-xl hover:shadow-2xl disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none"
                    disabled={!selectedService || !selectedDate || !selectedTime || !vehicleType || !customerInfo.name || !customerInfo.email || !customerInfo.phone || loading}
                    onClick={handleBooking}
                  >
                    <span className="relative z-10">
                      {loading ? 'Käsitellään...' : 'Vahvista varaus'}
                    </span>
                    <div className="absolute inset-0 bg-gradient-to-r from-amber-400 to-amber-500 rounded-xl opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
                  </button>

                  <p className="text-sm text-slate-600 mt-4">
                    Saat vahvistuksen sähköpostilla ja tekstiviestillä
                  </p>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Contact Info */}
        <section className="bg-slate-900 py-16">
          <div className="container mx-auto px-4 text-center">
            <h2 className="text-3xl font-bold text-white mb-8">Tarvitsetko apua varauksessa?</h2>
            <div className="flex flex-col md:flex-row justify-center items-center space-y-4 md:space-y-0 md:space-x-8">
              <a
                href={`tel:${siteConfig.phone.tel}`}
                className="flex items-center space-x-3 bg-amber-500 hover:bg-amber-600 text-white font-semibold px-6 py-3 rounded-xl transition-all duration-300"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                </svg>
                <span>Soita: {siteConfig.phone.display}</span>
              </a>

              <div className="text-slate-300">
                <div className="font-semibold">Aukioloajat:</div>
                <div className="text-sm">
                  {siteConfig.hours.map((hour, index) => (
                    <div key={index}>{hour.label}: {hour.value}</div>
                  ))}
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