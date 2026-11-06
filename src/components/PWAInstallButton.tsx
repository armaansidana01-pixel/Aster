import React, { useEffect, useState } from 'react';
import { Download, Share, PlusSquare, X, Check, WifiOff, RefreshCw } from 'lucide-react';
import { useRegisterSW } from 'virtual:pwa-register/react';
import { triggerHaptic } from '../utils/haptics';

interface BeforeInstallPromptEvent extends Event {
  readonly platforms: string[];
  readonly userChoice: Promise<{
    outcome: 'accepted' | 'dismissed';
    platform: string;
  }>;
  prompt(): Promise<void>;
}

export function usePWAInstall() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isInstalled, setIsInstalled] = useState(false);
  const [isIOS, setIsIOS] = useState(false);
  const [isAndroid, setIsAndroid] = useState(false);
  const [isInIframe, setIsInIframe] = useState(false);

  useEffect(() => {
    try {
      setIsInIframe(window.self !== window.top);
    } catch {
      setIsInIframe(true);
    }

    if (
      window.matchMedia('(display-mode: standalone)').matches ||
      (window.navigator as any).standalone === true
    ) {
      setIsInstalled(true);
    }

    const userAgent = window.navigator.userAgent.toLowerCase();
    const isIOSDevice = /iphone|ipad|ipod/.test(userAgent);
    const isAndroidDevice = /android/.test(userAgent);
    setIsIOS(isIOSDevice);
    setIsAndroid(isAndroidDevice);

    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };

    const handleAppInstalled = () => {
      setIsInstalled(true);
      setDeferredPrompt(null);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.addEventListener('appinstalled', handleAppInstalled);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', handleAppInstalled);
    };
  }, []);

  const promptInstall = async () => {
    if (!deferredPrompt) return false;
    await deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') {
      setDeferredPrompt(null);
      return true;
    }
    return false;
  };

  return {
    isInstallable: !!deferredPrompt,
    isInstalled,
    isIOS,
    isAndroid,
    isInIframe,
    promptInstall,
  };
}

export const OfflineIndicator: React.FC = () => {
  const [isOffline, setIsOffline] = useState(
    typeof navigator !== 'undefined' ? !navigator.onLine : false
  );

  const {
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    onRegisterError(error) {
      console.warn('SW registration notice:', error);
    },
  });

  useEffect(() => {
    const handleOnline = () => setIsOffline(false);
    const handleOffline = () => setIsOffline(true);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  if (!isOffline && !needRefresh) return null;

  return (
    <div className="fixed top-14 left-1/2 -translate-x-1/2 z-50 flex flex-col gap-2 w-[92vw] max-w-sm pointer-events-auto">
      {isOffline && (
        <div className="bg-amber-600 text-white px-3.5 py-2 rounded-xl shadow-lg flex items-center gap-2.5 text-xs font-medium">
          <WifiOff className="w-4 h-4 shrink-0" />
          <span>Offline mode active — Question Bank & saved sessions remain available.</span>
        </div>
      )}

      {needRefresh && (
        <div className="bg-slate-900 text-white px-3.5 py-2.5 rounded-xl shadow-lg flex items-center justify-between gap-3 text-xs border border-slate-700">
          <span>New version of Aster SAT available.</span>
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => updateServiceWorker(true)}
              className="px-2.5 py-1 bg-indigo-600 hover:bg-indigo-500 rounded-lg font-semibold flex items-center gap-1 cursor-pointer"
            >
              <RefreshCw className="w-3 h-3" />
              Reload
            </button>
            <button
              type="button"
              onClick={() => setNeedRefresh(false)}
              className="px-2 py-1 text-slate-400 hover:text-white cursor-pointer"
            >
              Dismiss
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export const PWAInstallButton: React.FC<{ compact?: boolean }> = ({ compact = false }) => {
  const { isInstallable, isInstalled, isIOS, isAndroid, isInIframe, promptInstall } = usePWAInstall();
  const [showModal, setShowModal] = useState(false);
  const [activePlatformTab, setActivePlatformTab] = useState<'ios' | 'android' | 'desktop'>('ios');

  useEffect(() => {
    if (isIOS) {
      setActivePlatformTab('ios');
    } else if (isAndroid) {
      setActivePlatformTab('android');
    } else {
      setActivePlatformTab('desktop');
    }
  }, [isIOS, isAndroid]);

  if (isInstalled) {
    if (compact) return null;
    return (
      <div className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-emerald-700 bg-emerald-50 dark:bg-emerald-950/50 dark:text-emerald-300 rounded-lg border border-emerald-200 dark:border-emerald-800/50">
        <Check className="w-3.5 h-3.5" />
        <span>Installed as App</span>
      </div>
    );
  }

  const handleInstallClick = () => {
    triggerHaptic('menu_toggle');
    if (isInstallable && !isInIframe) {
      promptInstall();
    } else {
      setShowModal(true);
    }
  };

  return (
    <>
      <button
        type="button"
        onClick={handleInstallClick}
        className={
          compact
            ? 'inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-semibold text-slate-700 dark:text-slate-200 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 rounded-lg transition-colors cursor-pointer'
            : 'inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-500 rounded-xl shadow-xs transition-colors cursor-pointer'
        }
        title="Install Aster SAT App"
      >
        <Download className="w-3.5 h-3.5" />
        <span>{compact ? 'Install' : 'Install App'}</span>
      </button>

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div className="relative w-full max-w-lg p-5 sm:p-6 bg-white dark:bg-slate-900 rounded-2xl shadow-xl border border-slate-200 dark:border-slate-800 max-h-[90vh] overflow-y-auto">
            <button
              type="button"
              onClick={() => setShowModal(false)}
              className="absolute top-4 right-4 p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-lg cursor-pointer"
              aria-label="Close install instructions"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="space-y-1 mb-4 pr-6">
              <span className="text-[11px] font-mono uppercase tracking-widest text-indigo-600 dark:text-indigo-400 font-semibold">
                Mobile &amp; Desktop PWA
              </span>
              <h3 className="text-lg font-bold text-slate-900 dark:text-white font-display">
                Install Aster — SAT Studio
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Install Aster directly onto your home screen for full-screen offline practice, instant haptics, and fast launching.
              </p>
            </div>

            {/* Platform Selector Tabs */}
            <div className="grid grid-cols-3 gap-1 p-1 bg-slate-100 dark:bg-slate-800 rounded-xl mb-4">
              <button
                type="button"
                onClick={() => {
                  triggerHaptic('menu_toggle');
                  setActivePlatformTab('ios');
                }}
                className={`py-1.5 px-2 text-xs font-semibold rounded-lg transition-all cursor-pointer ${
                  activePlatformTab === 'ios'
                    ? 'bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 shadow-2xs'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                iOS (iPhone / iPad)
              </button>
              <button
                type="button"
                onClick={() => {
                  triggerHaptic('menu_toggle');
                  setActivePlatformTab('android');
                }}
                className={`py-1.5 px-2 text-xs font-semibold rounded-lg transition-all cursor-pointer ${
                  activePlatformTab === 'android'
                    ? 'bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 shadow-2xs'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                Android
              </button>
              <button
                type="button"
                onClick={() => {
                  triggerHaptic('menu_toggle');
                  setActivePlatformTab('desktop');
                }}
                className={`py-1.5 px-2 text-xs font-semibold rounded-lg transition-all cursor-pointer ${
                  activePlatformTab === 'desktop'
                    ? 'bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 shadow-2xs'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                Desktop (Chrome / Mac / PC)
              </button>
            </div>

            {isInIframe && (
              <div className="p-3 mb-4 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-300 dark:border-amber-800/60 text-xs text-amber-900 dark:text-amber-200">
                <strong>Note:</strong> Browsers do not permit PWA installation inside an embedded preview iframe. Open Aster in a top-level browser tab first, then follow the instructions below.
              </div>
            )}

            {/* iOS Instructions */}
            {activePlatformTab === 'ios' && (
              <div className="space-y-3 text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                <div className="p-4 bg-slate-50 dark:bg-slate-800/70 rounded-xl border border-slate-200 dark:border-slate-700 space-y-3">
                  <div className="font-semibold text-slate-900 dark:text-white flex items-center gap-2">
                    <span>How to install on Safari (iOS / iPadOS):</span>
                  </div>
                  <ol className="list-decimal list-inside space-y-2.5">
                    <li className="flex items-start gap-2">
                      <span className="font-bold text-slate-900 dark:text-white shrink-0">1.</span>
                      <span>
                        Open this page in <strong>Safari</strong> (Apple only allows PWAs to be installed from Safari).
                      </span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="font-bold text-slate-900 dark:text-white shrink-0">2.</span>
                      <span className="flex-1">
                        Tap the <strong>Share</strong> button at the bottom of Safari{' '}
                        <Share className="w-3.5 h-3.5 inline text-indigo-500 mx-1 align-baseline" />
                        (the box with an arrow pointing up).
                      </span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="font-bold text-slate-900 dark:text-white shrink-0">3.</span>
                      <span className="flex-1">
                        Scroll down and tap <strong>Add to Home Screen</strong>{' '}
                        <PlusSquare className="w-3.5 h-3.5 inline text-indigo-500 mx-1 align-baseline" />.
                      </span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="font-bold text-slate-900 dark:text-white shrink-0">4.</span>
                      <span>
                        Tap <strong>Add</strong> in the top-right corner. Aster will appear as a standalone app on your home screen.
                      </span>
                    </li>
                  </ol>
                </div>
              </div>
            )}

            {/* Android Instructions */}
            {activePlatformTab === 'android' && (
              <div className="space-y-3 text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                <div className="p-4 bg-slate-50 dark:bg-slate-800/70 rounded-xl border border-slate-200 dark:border-slate-700 space-y-3">
                  <div className="font-semibold text-slate-900 dark:text-white">
                    How to install on Chrome or Edge (Android):
                  </div>
                  <ol className="list-decimal list-inside space-y-2.5">
                    <li className="flex items-start gap-2">
                      <span className="font-bold text-slate-900 dark:text-white shrink-0">1.</span>
                      <span>
                        Tap <strong>Install</strong> or look for the banner that appears at the bottom of Chrome.
                      </span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="font-bold text-slate-900 dark:text-white shrink-0">2.</span>
                      <span>
                        If no banner appears, tap the <strong>three vertical dots menu (⋮)</strong> in the top-right corner of Chrome.
                      </span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="font-bold text-slate-900 dark:text-white shrink-0">3.</span>
                      <span>
                        Select <strong>Install app</strong> or <strong>Add to Home screen</strong>.
                      </span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="font-bold text-slate-900 dark:text-white shrink-0">4.</span>
                      <span>
                        Confirm by tapping <strong>Install</strong>. The app icon will be placed directly on your app drawer and home screen.
                      </span>
                    </li>
                  </ol>
                </div>
              </div>
            )}

            {/* Desktop Instructions */}
            {activePlatformTab === 'desktop' && (
              <div className="space-y-3 text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                <div className="p-4 bg-slate-50 dark:bg-slate-800/70 rounded-xl border border-slate-200 dark:border-slate-700 space-y-3">
                  <div className="font-semibold text-slate-900 dark:text-white">
                    How to install on Mac / Windows / Chromebook:
                  </div>
                  <ol className="list-decimal list-inside space-y-2.5">
                    <li className="flex items-start gap-2">
                      <span className="font-bold text-slate-900 dark:text-white shrink-0">1.</span>
                      <span>
                        In Google Chrome, Edge, or Brave, look for the <strong>Install icon</strong>{' '}
                        <Download className="w-3.5 h-3.5 inline text-indigo-500 mx-1 align-baseline" />{' '}
                        on the right side of the address bar.
                      </span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="font-bold text-slate-900 dark:text-white shrink-0">2.</span>
                      <span>
                        Alternatively, click the browser menu (⋮), go to <strong>Save and share</strong> / <strong>Apps</strong>, and select <strong>Install Aster — SAT Studio</strong>.
                      </span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="font-bold text-slate-900 dark:text-white shrink-0">3.</span>
                      <span>
                        Click <strong>Install</strong>. Aster opens in its own focused, standalone window with its own dock/taskbar icon.
                      </span>
                    </li>
                  </ol>
                </div>
              </div>
            )}

            <div className="mt-5 flex justify-end">
              <button
                type="button"
                onClick={() => setShowModal(false)}
                className="px-4 py-2 text-xs font-semibold text-slate-700 dark:text-slate-200 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 rounded-xl transition-colors cursor-pointer"
              >
                Got it
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
