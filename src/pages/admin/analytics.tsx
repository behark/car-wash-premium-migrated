import { useSession } from 'next-auth/react';
import { useRouter } from 'next/router';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import SEO from '../../components/SEO';
import { siteConfig } from '../../lib/siteConfig';

interface Analytics {
  revenue: {
    total: number;
    confirmed: number;
    average: number;
    growth: number;
  };
  bookings: {
    total: number;
    confirmed: number;
    conversionRate: number;
    statusDistribution: Array<{
      status: string;
      count: number;
      percentage: number;
    }>;
  };
  customers: {
    total: number;
    newThisMonth: number;
    averageVisits: number;
    averageSpent: number;
    repeatCustomers: number;
    retentionRate: number;
  };
  services: {
    popularity: Array<{
      serviceId: number;
      serviceName: string;
      bookings: number;
      revenue: number;
      averagePrice: number;
    }>;
    totalServices: number;
  };
  vehicles: {
    distribution: Array<{
      type: string;
      count: number;
      averagePrice: number;
      percentage: number;
    }>;
  };
  loyalty: {
    distribution: Array<{
      tier: string;
      customers: number;
      averagePoints: number;
      averageSpent: number;
    }>;
  };
  trends: {
    dailyBookings: Array<{
      date: string;
      bookings: number;
      revenue: number;
    }>;
    popularTimeSlots: Array<{
      time: string;
      bookings: number;
    }>;
  };
}

export default function AdminAnalytics() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [analytics, setAnalytics] = useState<Analytics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [timeRange, setTimeRange] = useState('30days');

  useEffect(() => {
    if (status === 'loading') return;
    if (!session) {
      router.push('/admin/login');
      return;
    }

    fetchAnalytics();
  }, [session, status, router, timeRange]);

  const fetchAnalytics = async () => {
    try {
      setLoading(true);
      const response = await fetch(`/api/admin/analytics?timeRange=${timeRange}`);
      const data = await response.json();

      if (data.success) {
        setAnalytics(data.analytics);
      } else {
        setError('Analytiikan lataus epäonnistui');
      }
    } catch (error) {
      console.error('Failed to fetch analytics:', error);
      setError('Virhe analytiikan hakemisessa');
    } finally {
      setLoading(false);
    }
  };

  if (status === 'loading' || loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin h-8 w-8 border-b-2 border-amber-500 rounded-full mx-auto mb-4"></div>
          <p className="text-slate-600">Ladataan analytiikkaa...</p>
        </div>
      </div>
    );
  }

  if (!session || !analytics) return null;

  const getTierColor = (tier: string) => {
    switch (tier) {
      case 'PLATINUM': return 'text-purple-600';
      case 'GOLD': return 'text-yellow-600';
      case 'SILVER': return 'text-gray-600';
      default: return 'text-orange-600';
    }
  };

  return (
    <>
      <SEO
        title={`Analytiikka - Admin - ${siteConfig.name}`}
        description="Liiketoimintaraportit ja analytiikka"
      />

      <div className="min-h-screen bg-slate-50">
        {/* Header */}
        <header className="bg-white shadow-sm border-b border-slate-200">
          <div className="px-4 sm:px-6 lg:px-8">
            <div className="flex items-center justify-between h-16">
              <div className="flex items-center space-x-4">
                <Link
                  href="/admin"
                  className="text-slate-600 hover:text-slate-900"
                >
                  ← Takaisin
                </Link>
                <h1 className="text-xl font-semibold text-slate-900">Liiketoiminta-analytiikka</h1>
              </div>
              <div className="flex items-center space-x-4">
                <select
                  value={timeRange}
                  onChange={(e) => setTimeRange(e.target.value)}
                  className="border border-slate-300 rounded-lg px-3 py-2 text-sm"
                >
                  <option value="30days">Viimeiset 30 päivää</option>
                  <option value="90days">Viimeiset 90 päivää</option>
                  <option value="week">Tämä viikko</option>
                  <option value="month">Tämä kuukausi</option>
                  <option value="year">Tämä vuosi</option>
                </select>
              </div>
            </div>
          </div>
        </header>

        <main className="px-4 sm:px-6 lg:px-8 py-8">
          {error && (
            <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg text-red-600">
              {error}
            </div>
          )}

          {/* Revenue Overview */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
            <div className="bg-white rounded-lg shadow p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-slate-600">Kokonaisliikevaihto</p>
                  <p className="text-3xl font-bold text-green-600">{analytics.revenue.total}€</p>
                </div>
                <div className="bg-green-100 rounded-lg p-3">
                  <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
              </div>
              <p className="text-xs text-slate-500 mt-2">Vahvistettu: {analytics.revenue.confirmed}€</p>
            </div>

            <div className="bg-white rounded-lg shadow p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-slate-600">Varauksia yhteensä</p>
                  <p className="text-3xl font-bold text-blue-600">{analytics.bookings.total}</p>
                </div>
                <div className="bg-blue-100 rounded-lg p-3">
                  <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                </div>
              </div>
              <p className="text-xs text-slate-500 mt-2">Vahvistettu: {analytics.bookings.confirmed}</p>
            </div>

            <div className="bg-white rounded-lg shadow p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-slate-600">Kanta-asiakkaat</p>
                  <p className="text-3xl font-bold text-purple-600">{analytics.customers.repeatCustomers}</p>
                </div>
                <div className="bg-purple-100 rounded-lg p-3">
                  <svg className="w-6 h-6 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                  </svg>
                </div>
              </div>
              <p className="text-xs text-slate-500 mt-2">Säilyvyysaste: {analytics.customers.retentionRate}%</p>
            </div>

            <div className="bg-white rounded-lg shadow p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-slate-600">Keskihinta</p>
                  <p className="text-3xl font-bold text-amber-600">{analytics.revenue.average}€</p>
                </div>
                <div className="bg-amber-100 rounded-lg p-3">
                  <svg className="w-6 h-6 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                  </svg>
                </div>
              </div>
              <p className="text-xs text-slate-500 mt-2">Keskikäynteja: {analytics.customers.averageVisits}</p>
            </div>
          </div>

          {/* Service Popularity */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
            <div className="bg-white rounded-lg shadow p-6">
              <h3 className="text-lg font-semibold text-slate-900 mb-4">Palveluiden suosio</h3>
              <div className="space-y-3">
                {analytics.services.popularity.slice(0, 5).map((service, index) => (
                  <div key={service.serviceId} className="flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                      <div className="text-sm font-medium text-slate-900">
                        #{index + 1} {service.serviceName}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-sm font-semibold text-slate-900">{service.bookings} varausta</div>
                      <div className="text-xs text-slate-500">{service.revenue / 100}€ liikevaihdosta</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-white rounded-lg shadow p-6">
              <h3 className="text-lg font-semibold text-slate-900 mb-4">Asiakastasot</h3>
              <div className="space-y-3">
                {analytics.loyalty.distribution.map((tier) => (
                  <div key={tier.tier} className="flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                      <div className={`text-sm font-medium ${getTierColor(tier.tier)}`}>
                        {tier.tier}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-sm font-semibold text-slate-900">{tier.customers} asiakasta</div>
                      <div className="text-xs text-slate-500">Keskispent: {tier.averageSpent}€</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Vehicle Types and Time Slots */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
            <div className="bg-white rounded-lg shadow p-6">
              <h3 className="text-lg font-semibold text-slate-900 mb-4">Ajoneuvotyypit</h3>
              <div className="space-y-3">
                {analytics.vehicles.distribution.map((vehicle) => (
                  <div key={vehicle.type} className="flex items-center justify-between">
                    <div className="text-sm text-slate-900">{vehicle.type}</div>
                    <div className="text-right">
                      <div className="text-sm font-semibold text-slate-900">{vehicle.count} ({vehicle.percentage}%)</div>
                      <div className="text-xs text-slate-500">Keskihinta: {vehicle.averagePrice}€</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-white rounded-lg shadow p-6">
              <h3 className="text-lg font-semibold text-slate-900 mb-4">Suosituimmat ajat</h3>
              <div className="space-y-2">
                {analytics.trends.popularTimeSlots.slice(0, 8).map((slot, index) => (
                  <div key={slot.time} className="flex items-center justify-between">
                    <div className="text-sm text-slate-900">{slot.time}</div>
                    <div className="text-sm font-semibold text-slate-900">{slot.bookings} varausta</div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Booking Status Distribution */}
          <div className="bg-white rounded-lg shadow p-6 mb-8">
            <h3 className="text-lg font-semibold text-slate-900 mb-4">Varausten tilat</h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {analytics.bookings.statusDistribution.map((status) => {
                const getStatusColor = (s: string) => {
                  switch (s) {
                    case 'CONFIRMED': return 'text-green-600 bg-green-100';
                    case 'PENDING': return 'text-yellow-600 bg-yellow-100';
                    case 'COMPLETED': return 'text-blue-600 bg-blue-100';
                    case 'CANCELLED': return 'text-red-600 bg-red-100';
                    default: return 'text-slate-600 bg-slate-100';
                  }
                };

                return (
                  <div key={status.status} className={`rounded-lg p-4 text-center ${getStatusColor(status.status)}`}>
                    <div className="text-2xl font-bold">{status.count}</div>
                    <div className="text-sm">{status.status}</div>
                    <div className="text-xs">{status.percentage}%</div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Key Performance Indicators */}
          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="text-lg font-semibold text-slate-900 mb-6">Keskeiset mittarit (KPI)</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="text-center p-4 bg-gradient-to-br from-green-50 to-green-100 rounded-lg">
                <div className="text-3xl font-bold text-green-600">{analytics.bookings.conversionRate}%</div>
                <div className="text-sm text-slate-600">Varausten valmistumisaste</div>
                <div className="text-xs text-slate-500 mt-1">Kuinka monta varausta viedään loppuun</div>
              </div>

              <div className="text-center p-4 bg-gradient-to-br from-blue-50 to-blue-100 rounded-lg">
                <div className="text-3xl font-bold text-blue-600">{analytics.customers.averageSpent}€</div>
                <div className="text-sm text-slate-600">Asiakkaan keskiarvo</div>
                <div className="text-xs text-slate-500 mt-1">Kuinka paljon asiakas kuluttaa keskimäärin</div>
              </div>

              <div className="text-center p-4 bg-gradient-to-br from-purple-50 to-purple-100 rounded-lg">
                <div className="text-3xl font-bold text-purple-600">{analytics.customers.retentionRate}%</div>
                <div className="text-sm text-slate-600">Asiakasuskollisuus</div>
                <div className="text-xs text-slate-500 mt-1">Kuinka monta % asiakkaista palaa</div>
              </div>
            </div>
          </div>

          {/* Action Items */}
          <div className="mt-8 bg-gradient-to-r from-amber-50 to-amber-100 border-l-4 border-amber-500 p-6 rounded-lg">
            <h3 className="text-lg font-semibold text-slate-900 mb-4">💡 Suositukset liiketoiminnan kehittämiseen</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
              <div>
                <h4 className="font-semibold text-slate-900 mb-2">Lyhyen aikavälin toimenpiteet:</h4>
                <ul className="space-y-1 text-slate-700">
                  <li>• Markkinoi suosituimpia palveluita sosiaalisessa mediassa</li>
                  <li>• Tarjoa alennuksia hiljaisimmille ajankohdille</li>
                  <li>• Seuraa PENDING-varauksia ja vahvista ne nopeasti</li>
                  <li>• Ota yhteyttä kertakäyttöasiakkaisiin</li>
                </ul>
              </div>
              <div>
                <h4 className="font-semibold text-slate-900 mb-2">Pitkän aikavälin strategiat:</h4>
                <ul className="space-y-1 text-slate-700">
                  <li>• Kehitä kanta-asiakasohjelmaa lisäeduilla</li>
                  <li>• Luo kausipaketteja talvi/kesärengaspalveluille</li>
                  <li>• Lisää kapasiteettia suosituimmille ajoille</li>
                  <li>• Optimoi hinnoittelu ajoneuvotyypin mukaan</li>
                </ul>
              </div>
            </div>
          </div>
        </main>
      </div>
    </>
  );
}