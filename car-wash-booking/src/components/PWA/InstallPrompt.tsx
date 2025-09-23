/**
 * PWA Install Prompt Component
 * Shows installation prompts for different platforms and manages the install flow
 */

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  isStandalone,
  isIOS,
  isAndroid,
  canInstallPWA,
  installPWA,
  getInstallInstructions
} from '../../lib/pwa/serviceWorker';

interface InstallPromptProps {
  onClose?: () => void;
  className?: string;
}

export default function InstallPrompt({ onClose, className = '' }: InstallPromptProps) {
  const [showPrompt, setShowPrompt] = useState(false);
  const [isInstalling, setIsInstalling] = useState(false);
  const [installInstructions, setInstallInstructions] = useState('');
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);

  useEffect(() => {
    // Don't show if already running as standalone app
    if (isStandalone()) {
      return;
    }

    // Set platform-specific instructions
    setInstallInstructions(getInstallInstructions());

    // Listen for beforeinstallprompt event
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e);
      setShowPrompt(true);
    };

    // Check if we should show the prompt
    const shouldShow = () => {
      const lastDismissed = localStorage.getItem('pwa-install-dismissed');
      const installCount = localStorage.getItem('pwa-install-count') || '0';

      // Don't show if dismissed in the last 7 days
      if (lastDismissed) {
        const dismissedDate = new Date(lastDismissed);
        const weekAgo = new Date();
        weekAgo.setDate(weekAgo.getDate() - 7);

        if (dismissedDate > weekAgo) {
          return false;
        }
      }

      // Don't show if already shown 3 times
      if (parseInt(installCount) >= 3) {
        return false;
      }

      return true;
    };

    // Show prompt after a delay if conditions are met
    if (shouldShow()) {
      const timer = setTimeout(() => {
        if (!isStandalone() && (canInstallPWA() || isIOS() || isAndroid())) {
          setShowPrompt(true);
        }
      }, 5000); // Show after 5 seconds

      return () => clearTimeout(timer);
    }

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    };
  }, []);

  const handleInstall = async () => {
    if (deferredPrompt) {
      setIsInstalling(true);
      const success = await installPWA();

      if (success) {
        setShowPrompt(false);
        localStorage.setItem('pwa-installed', 'true');
      }

      setIsInstalling(false);
    } else {
      // Show manual instructions for iOS/other browsers
      setShowPrompt(true);
    }
  };

  const handleDismiss = () => {
    setShowPrompt(false);
    localStorage.setItem('pwa-install-dismissed', new Date().toISOString());

    const count = parseInt(localStorage.getItem('pwa-install-count') || '0');
    localStorage.setItem('pwa-install-count', (count + 1).toString());

    onClose?.();
  };

  const handleNeverShow = () => {
    localStorage.setItem('pwa-install-count', '999');
    handleDismiss();
  };

  if (!showPrompt) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: 100 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 100 }}
        transition={{ type: "spring", damping: 20, stiffness: 300 }}
        className={`fixed bottom-4 left-4 right-4 z-50 ${className}`}
      >
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl border border-gray-200 dark:border-gray-700 overflow-hidden">
          {/* Header */}
          <div className="bg-gradient-to-r from-blue-600 to-blue-700 p-4 text-white">
            <div className="flex items-center space-x-3">
              <div className="w-12 h-12 bg-white rounded-xl flex items-center justify-center">
                <svg className="w-8 h-8 text-blue-600" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M12 2L2 7v10c0 5.55 3.84 9.739 9 11 5.16-1.261 9-5.45 9-11V7l-10-5z"/>
                  <path d="M9 12l2 2 4-4" stroke="currentColor" strokeWidth="2" fill="none"/>
                </svg>
              </div>
              <div>
                <h3 className="font-bold text-lg">Asenna sovellus</h3>
                <p className="text-blue-100 text-sm">Nopeampi käyttö offline-tilassa</p>
              </div>
            </div>
          </div>

          {/* Content */}
          <div className="p-4">
            <div className="space-y-3">
              <div className="flex items-start space-x-3">
                <div className="w-6 h-6 bg-green-100 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                  <svg className="w-3 h-3 text-green-600" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                  </svg>
                </div>
                <div>
                  <p className="text-sm text-gray-700 dark:text-gray-300">
                    <strong>Offline-tuki:</strong> Varaa aikoja ilman internetyhteyttä
                  </p>
                </div>
              </div>

              <div className="flex items-start space-x-3">
                <div className="w-6 h-6 bg-blue-100 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                  <svg className="w-3 h-3 text-blue-600" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                  </svg>
                </div>
                <div>
                  <p className="text-sm text-gray-700 dark:text-gray-300">
                    <strong>Push-ilmoitukset:</strong> Saat muistutukset varauksistasi
                  </p>
                </div>
              </div>

              <div className="flex items-start space-x-3">
                <div className="w-6 h-6 bg-purple-100 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                  <svg className="w-3 h-3 text-purple-600" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                  </svg>
                </div>
                <div>
                  <p className="text-sm text-gray-700 dark:text-gray-300">
                    <strong>Nopea käynnistys:</strong> Avautuu suoraan kotinäytöltä
                  </p>
                </div>
              </div>
            </div>

            {/* Install instructions for iOS/manual install */}
            {(isIOS() || !deferredPrompt) && (
              <div className="mt-4 p-3 bg-gray-50 dark:bg-gray-700 rounded-lg">
                <p className="text-sm text-gray-600 dark:text-gray-400 font-medium mb-2">
                  Asennusohjeet:
                </p>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  {installInstructions}
                </p>
              </div>
            )}
          </div>

          {/* Actions */}
          <div className="p-4 bg-gray-50 dark:bg-gray-700 border-t border-gray-200 dark:border-gray-600">
            <div className="flex flex-col space-y-2">
              {deferredPrompt && !isIOS() && (
                <button
                  onClick={handleInstall}
                  disabled={isInstalling}
                  className="w-full bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-medium py-3 px-4 rounded-xl transition-colors flex items-center justify-center space-x-2"
                >
                  {isInstalling ? (
                    <>
                      <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      <span>Asennetaan...</span>
                    </>
                  ) : (
                    <>
                      <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M3 17a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm3.293-7.707a1 1 0 011.414 0L9 10.586V3a1 1 0 112 0v7.586l1.293-1.293a1 1 0 111.414 1.414l-3 3a1 1 0 01-1.414 0l-3-3a1 1 0 010-1.414z" clipRule="evenodd" />
                      </svg>
                      <span>Asenna sovellus</span>
                    </>
                  )}
                </button>
              )}

              <div className="flex space-x-2">
                <button
                  onClick={handleDismiss}
                  className="flex-1 bg-gray-200 hover:bg-gray-300 dark:bg-gray-600 dark:hover:bg-gray-500 text-gray-700 dark:text-gray-300 font-medium py-2.5 px-4 rounded-xl transition-colors"
                >
                  Myöhemmin
                </button>
                <button
                  onClick={handleNeverShow}
                  className="flex-1 bg-gray-200 hover:bg-gray-300 dark:bg-gray-600 dark:hover:bg-gray-500 text-gray-700 dark:text-gray-300 font-medium py-2.5 px-4 rounded-xl transition-colors"
                >
                  Älä näytä
                </button>
              </div>
            </div>
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}

// Floating action button version for persistent install option
export function InstallFAB() {
  const [showButton, setShowButton] = useState(false);

  useEffect(() => {
    const checkShowButton = () => {
      const neverShow = localStorage.getItem('pwa-install-count') === '999';
      const isInstalled = localStorage.getItem('pwa-installed') === 'true';

      if (!neverShow && !isInstalled && !isStandalone()) {
        setShowButton(true);
      }
    };

    checkShowButton();
  }, []);

  const handleClick = () => {
    const event = new CustomEvent('show-install-prompt');
    window.dispatchEvent(event);
  };

  if (!showButton) return null;

  return (
    <motion.button
      initial={{ scale: 0 }}
      animate={{ scale: 1 }}
      whileHover={{ scale: 1.1 }}
      whileTap={{ scale: 0.9 }}
      onClick={handleClick}
      className="fixed bottom-20 right-4 z-40 w-14 h-14 bg-blue-600 hover:bg-blue-700 text-white rounded-full shadow-lg flex items-center justify-center transition-colors"
      title="Asenna sovellus"
    >
      <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 20 20">
        <path fillRule="evenodd" d="M3 17a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm3.293-7.707a1 1 0 011.414 0L9 10.586V3a1 1 0 112 0v7.586l1.293-1.293a1 1 0 111.414 1.414l-3 3a1 1 0 01-1.414 0l-3-3a1 1 0 010-1.414z" clipRule="evenodd" />
      </svg>
    </motion.button>
  );
}