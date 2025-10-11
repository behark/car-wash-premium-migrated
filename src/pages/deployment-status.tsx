import { useState, useEffect } from 'react';
import Head from 'next/head';

interface ConfigStatus {
  status: string;
  environment: {
    context: string;
    nodeEnv: string;
    siteUrl: string;
    authUrl: string;
  };
  services: {
    database: { configured: boolean; type: string };
    authentication: { configured: boolean; hasSecret: boolean };
    admin: { configured: boolean; email: string };
    email: { configured: boolean; provider: string; senderEmail: string };
    sms: { configured: boolean; provider: string; fromNumber: string };
  };
  validation: {
    isValid: boolean;
    missing: string[];
    warnings: string[];
  };
  nextSteps: string[];
}

export default function DeploymentStatus() {
  const [status, setStatus] = useState<ConfigStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [setupLoading, setSetupLoading] = useState(false);
  const [setupResult, setSetupResult] = useState<any>(null);

  useEffect(() => {
    fetchStatus();
  }, []);

  const fetchStatus = async () => {
    try {
      const response = await fetch('/api/config');
      const data = await response.json();
      setStatus(data);
    } catch (error) {
      console.error('Failed to fetch status:', error);
    } finally {
      setLoading(false);
    }
  };

  const runSetup = async () => {
    setSetupLoading(true);
    try {
      const response = await fetch('/api/setup', { method: 'POST' });
      const data = await response.json();
      setSetupResult(data);
      await fetchStatus(); // Refresh status
    } catch (error) {
      console.error('Setup failed:', error);
      setSetupResult({ error: 'Setup failed' });
    } finally {
      setSetupLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading deployment status...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <Head>
        <title>Deployment Status - Car Wash Booking</title>
      </Head>

      <div className="max-w-4xl mx-auto px-4">
        <div className="bg-white rounded-lg shadow p-6">
          <h1 className="text-3xl font-bold text-gray-900 mb-6">
            🚀 Deployment Status
          </h1>

          {status && (
            <>
              {/* Overall Status */}
              <div className={`p-4 rounded-lg mb-6 ${
                status.status === 'ready' ? 'bg-green-50 border border-green-200' : 'bg-yellow-50 border border-yellow-200'
              }`}>
                <h2 className="text-xl font-semibold mb-2">
                  {status.status === 'ready' ? '✅ Ready for Production' : '⚠️ Configuration Needed'}
                </h2>
                <p className="text-gray-600">
                  Environment: {status.environment.context} | Node: {status.environment.nodeEnv}
                </p>
                <p className="text-gray-600">
                  Site URL: <a href={status.environment.siteUrl} className="text-blue-600 underline">
                    {status.environment.siteUrl}
                  </a>
                </p>
              </div>

              {/* Services Status */}
              <div className="grid md:grid-cols-2 gap-4 mb-6">
                <ServiceCard
                  title="Database"
                  configured={status.services.database.configured}
                  details={`Type: ${status.services.database.type}`}
                />
                <ServiceCard
                  title="Authentication"
                  configured={status.services.authentication.configured}
                  details={`Secret: ${status.services.authentication.hasSecret ? 'Set' : 'Missing'}`}
                />
                <ServiceCard
                  title="Admin User"
                  configured={status.services.admin.configured}
                  details={`Email: ${status.services.admin.email}`}
                />
                <ServiceCard
                  title="Email Service"
                  configured={status.services.email.configured}
                  details={`${status.services.email.provider} | ${status.services.email.senderEmail}`}
                />
                <ServiceCard
                  title="SMS Service"
                  configured={status.services.sms.configured}
                  details={`${status.services.sms.provider} | ${status.services.sms.fromNumber}`}
                />
              </div>

              {/* Missing Configuration */}
              {status.validation.missing.length > 0 && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
                  <h3 className="text-lg font-semibold text-red-800 mb-2">
                    ❌ Missing Configuration
                  </h3>
                  <ul className="list-disc list-inside text-red-700">
                    {status.validation.missing.map((item, index) => (
                      <li key={index}>{item}</li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Warnings */}
              {status.validation.warnings.length > 0 && (
                <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-6">
                  <h3 className="text-lg font-semibold text-yellow-800 mb-2">
                    ⚠️ Warnings
                  </h3>
                  <ul className="list-disc list-inside text-yellow-700">
                    {status.validation.warnings.map((item, index) => (
                      <li key={index}>{item}</li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Next Steps */}
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
                <h3 className="text-lg font-semibold text-blue-800 mb-2">
                  📋 Next Steps
                </h3>
                <ul className="list-disc list-inside text-blue-700">
                  {status.nextSteps.map((step, index) => (
                    <li key={index}>{step}</li>
                  ))}
                </ul>
              </div>

              {/* Setup Button */}
              {status.status !== 'ready' && status.validation.isValid && (
                <div className="text-center">
                  <button
                    onClick={runSetup}
                    disabled={setupLoading}
                    className="bg-blue-600 text-white px-6 py-3 rounded-lg font-semibold hover:bg-blue-700 disabled:opacity-50"
                  >
                    {setupLoading ? 'Setting up...' : '🛠️ Run Database Setup'}
                  </button>
                </div>
              )}

              {/* Setup Result */}
              {setupResult && (
                <div className={`mt-6 p-4 rounded-lg ${
                  setupResult.error ? 'bg-red-50 border border-red-200' : 'bg-green-50 border border-green-200'
                }`}>
                  <h3 className="font-semibold mb-2">
                    {setupResult.error ? '❌ Setup Failed' : '✅ Setup Complete'}
                  </h3>
                  <pre className="text-sm overflow-auto">
                    {JSON.stringify(setupResult, null, 2)}
                  </pre>
                </div>
              )}

              {/* Quick Actions */}
              <div className="mt-8 grid md:grid-cols-3 gap-4">
                <a
                  href="/"
                  className="block text-center bg-green-600 text-white py-3 px-4 rounded-lg hover:bg-green-700"
                >
                  🏠 Visit Homepage
                </a>
                <a
                  href="/admin/bookings"
                  className="block text-center bg-blue-600 text-white py-3 px-4 rounded-lg hover:bg-blue-700"
                >
                  👨‍💼 Admin Panel
                </a>
                <a
                  href="/booking"
                  className="block text-center bg-purple-600 text-white py-3 px-4 rounded-lg hover:bg-purple-700"
                >
                  📅 Test Booking
                </a>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function ServiceCard({ title, configured, details }: {
  title: string;
  configured: boolean;
  details: string;
}) {
  return (
    <div className={`p-4 rounded-lg border ${
      configured ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'
    }`}>
      <div className="flex items-center justify-between mb-2">
        <h3 className="font-semibold">{title}</h3>
        <span className="text-2xl">{configured ? '✅' : '❌'}</span>
      </div>
      <p className="text-sm text-gray-600">{details}</p>
    </div>
  );
}