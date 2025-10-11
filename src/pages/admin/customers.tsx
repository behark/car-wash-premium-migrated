import { useSession } from 'next-auth/react';
import { useRouter } from 'next/router';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import SEO from '../../components/SEO';
import { siteConfig } from '../../lib/siteConfig';

interface Customer {
  id: number;
  name: string;
  email: string;
  phone: string;
  loyaltyPoints: number;
  totalSpent: number;
  visitCount: number;
  loyaltyTier: string;
  lastVisit: string;
  joinDate: string;
  notes?: string;
}

export default function AdminCustomers() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    if (status === 'loading') return;
    if (!session) {
      router.push('/admin/login');
      return;
    }

    fetchCustomers();
  }, [session, status, router]);

  const fetchCustomers = async () => {
    try {
      const response = await fetch('/api/admin/customers');
      const data = await response.json();

      if (data.success) {
        setCustomers(data.customers || []);
      } else {
        setError('Asiakastietojen lataus epäonnistui');
      }
    } catch (error) {
      console.error('Failed to fetch customers:', error);
      setError('Virhe asiakkaiden hakemisessa');
    } finally {
      setLoading(false);
    }
  };

  const getTierColor = (tier: string) => {
    switch (tier) {
      case 'PLATINUM': return 'bg-purple-100 text-purple-800';
      case 'GOLD': return 'bg-yellow-100 text-yellow-800';
      case 'SILVER': return 'bg-gray-100 text-gray-800';
      default: return 'bg-orange-100 text-orange-800';
    }
  };

  const filteredCustomers = customers.filter(customer =>
    customer.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    customer.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
    customer.phone.includes(searchTerm)
  );

  if (status === 'loading' || loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin h-8 w-8 border-b-2 border-amber-500 rounded-full mx-auto mb-4"></div>
          <p className="text-slate-600">Ladataan asiakkaita...</p>
        </div>
      </div>
    );
  }

  if (!session) return null;

  return (
    <>
      <SEO
        title={`Asiakkaat - Admin - ${siteConfig.name}`}
        description="Hallinnoi asiakastietoja ja kanta-asiakasohjelmaa"
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
                <h1 className="text-xl font-semibold text-slate-900">Asiakashallinta</h1>
              </div>
              <div className="flex items-center space-x-4">
                <input
                  type="text"
                  placeholder="Hae asiakkaita..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="border border-slate-300 rounded-lg px-3 py-2 text-sm"
                />
                <button
                  onClick={fetchCustomers}
                  className="bg-amber-500 hover:bg-amber-600 text-white px-4 py-2 rounded-lg text-sm"
                >
                  Päivitä
                </button>
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

          {/* Customer Stats Overview */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
            <div className="bg-white rounded-lg shadow p-6">
              <div className="text-center">
                <div className="text-3xl font-bold text-blue-600">{customers.length}</div>
                <div className="text-sm text-slate-600">Asiakkaita yhteensä</div>
              </div>
            </div>
            <div className="bg-white rounded-lg shadow p-6">
              <div className="text-center">
                <div className="text-3xl font-bold text-green-600">
                  {customers.filter(c => c.visitCount >= 2).length}
                </div>
                <div className="text-sm text-slate-600">Kanta-asiakkaat</div>
              </div>
            </div>
            <div className="bg-white rounded-lg shadow p-6">
              <div className="text-center">
                <div className="text-3xl font-bold text-yellow-600">
                  {customers.filter(c => c.loyaltyTier === 'GOLD' || c.loyaltyTier === 'PLATINUM').length}
                </div>
                <div className="text-sm text-slate-600">Gold/Platinum</div>
              </div>
            </div>
            <div className="bg-white rounded-lg shadow p-6">
              <div className="text-center">
                <div className="text-3xl font-bold text-purple-600">
                  {Math.round(customers.reduce((sum, c) => sum + c.totalSpent, 0) / 100)}€
                </div>
                <div className="text-sm text-slate-600">Kokonaismyynti</div>
              </div>
            </div>
          </div>

          {/* Customers Table */}
          <div className="bg-white rounded-lg shadow overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-200">
              <h2 className="text-lg font-semibold text-slate-900">
                Asiakkaat ({filteredCustomers.length})
              </h2>
            </div>

            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-slate-200">
                <thead className="bg-slate-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">
                      Asiakas
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">
                      Yhteystiedot
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">
                      Asiakastaso
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">
                      Käynnit & Kulutus
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">
                      Viimeksi
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">
                      Toiminnot
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-slate-200">
                  {filteredCustomers.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="px-6 py-12 text-center text-slate-500">
                        {searchTerm ? 'Ei hakutuloksia' : 'Ei asiakkaita vielä'}
                      </td>
                    </tr>
                  ) : (
                    filteredCustomers.map((customer) => (
                      <tr key={customer.id} className="hover:bg-slate-50">
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div>
                            <div className="text-sm font-medium text-slate-900">
                              {customer.name}
                            </div>
                            <div className="text-sm text-slate-500">ID: {customer.id}</div>
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm text-slate-900">{customer.email}</div>
                          <div className="text-sm text-slate-500">{customer.phone}</div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getTierColor(customer.loyaltyTier)}`}>
                            {customer.loyaltyTier}
                          </span>
                          <div className="text-sm text-slate-500">{customer.loyaltyPoints} pistettä</div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm text-slate-900">{customer.visitCount} käyntiä</div>
                          <div className="text-sm text-slate-500">{(customer.totalSpent / 100).toFixed(0)}€ kulutus</div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-900">
                          {customer.lastVisit
                            ? new Date(customer.lastVisit).toLocaleDateString('fi-FI')
                            : 'Ei vielä'
                          }
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium space-x-2">
                          <a
                            href={`tel:${customer.phone}`}
                            className="text-blue-600 hover:text-blue-900"
                          >
                            📞 Soita
                          </a>
                          <a
                            href={`mailto:${customer.email}`}
                            className="text-green-600 hover:text-green-900"
                          >
                            📧 Email
                          </a>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Loyalty Program Summary */}
          <div className="mt-8 bg-white rounded-lg shadow p-6">
            <h3 className="text-lg font-semibold text-slate-900 mb-4">Kanta-asiakasohjelma yhteenveto</h3>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              {['BRONZE', 'SILVER', 'GOLD', 'PLATINUM'].map((tier) => {
                const tierCustomers = customers.filter(c => c.loyaltyTier === tier);
                const tierSpending = tierCustomers.reduce((sum, c) => sum + c.totalSpent, 0);

                return (
                  <div key={tier} className={`rounded-lg p-4 text-center ${getTierColor(tier)}`}>
                    <div className="text-2xl font-bold">{tierCustomers.length}</div>
                    <div className="text-sm">{tier} asiakasta</div>
                    <div className="text-xs">{Math.round(tierSpending / 100)}€ kulutus</div>
                  </div>
                );
              })}
            </div>
          </div>
        </main>
      </div>
    </>
  );
}