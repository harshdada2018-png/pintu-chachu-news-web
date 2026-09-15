import React, { useEffect } from 'react';
import { Languages, X } from 'lucide-react';

export default function ToastNotice({ message, isOpen, onClose, duration = 4000 }) {
  useEffect(() => {
    if (!isOpen) return;
    const timer = setTimeout(() => {
      onClose();
    }, duration);
    return () => clearTimeout(timer);
  }, [isOpen, duration, onClose]);

  if (!isOpen) return null;

  return (
    <div className="fixed bottom-6 right-6 z-50 flex items-center gap-3 px-4 py-3 bg-slate-900/90 text-white rounded-xl shadow-2xl backdrop-blur-md border border-slate-700/50 animate-in fade-in slide-in-from-bottom-4 duration-300 max-w-md">
      <div className="p-2 rounded-lg bg-indigo-500/20 text-indigo-400">
        <Languages className="w-5 h-5" />
      </div>
      <p className="text-sm font-medium leading-snug flex-1">{message}</p>
      <button
        onClick={onClose}
        className="p-1 text-slate-400 hover:text-white rounded-lg transition-colors"
        aria-label="Close notification"
      >
        <X className="w-4 h-4" />
      </button>
    </div>
  );
}
