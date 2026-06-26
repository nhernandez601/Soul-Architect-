import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { registry } from '../../engine/core/ServiceRegistry';
import type { NotificationSystem, Notification, NotificationType } from '../../systems/notification/NotificationSystem';

const TYPE_STYLES: Record<NotificationType, { border: string; text: string; bg: string }> = {
  info:        { border: 'border-blue-400/40',   text: 'text-blue-300',   bg: 'bg-blue-900/30' },
  warn:        { border: 'border-yellow-400/40', text: 'text-yellow-300', bg: 'bg-yellow-900/30' },
  success:     { border: 'border-green-400/40',  text: 'text-green-300',  bg: 'bg-green-900/30' },
  error:       { border: 'border-red-400/40',    text: 'text-red-300',    bg: 'bg-red-900/30' },
  soul:        { border: 'border-gold/40',        text: 'text-gold',       bg: 'bg-gold/10' },
  achievement: { border: 'border-gold/60',        text: 'text-gold',       bg: 'bg-gold/20' },
  item:        { border: 'border-purple-400/40', text: 'text-purple-300', bg: 'bg-purple-900/30' },
};

function Toast({ notif, onDismiss }: { notif: Notification; onDismiss: (id: string) => void }) {
  const style = TYPE_STYLES[notif.type];

  return (
    <motion.div
      layout
      initial={{ opacity: 0, x: 80, scale: 0.92 }}
      animate={{ opacity: 1, x: 0, scale: 1 }}
      exit={{ opacity: 0, x: 80, scale: 0.88 }}
      transition={{ duration: 0.25, ease: 'easeOut' }}
      className={`flex items-start gap-3 px-4 py-3 rounded-lg border backdrop-blur-md shadow-xl ${style.bg} ${style.border}`}
    >
      <div className="flex-1 min-w-0">
        <p className={`text-sm font-medium leading-snug ${style.text}`}>{notif.message}</p>
        {notif.subtext && (
          <p className="text-white/45 text-xs mt-0.5 leading-snug">{notif.subtext}</p>
        )}
      </div>
      <button
        onClick={() => onDismiss(notif.id)}
        className="text-white/25 hover:text-white/60 transition-colors text-xs flex-shrink-0 mt-0.5"
      >
        ✕
      </button>
    </motion.div>
  );
}

export function NotificationToast() {
  const [notifs, setNotifs] = useState<Notification[]>([]);

  useEffect(() => {
    const notifSystem = registry.get<NotificationSystem>('notification');
    const interval = setInterval(() => {
      setNotifs([...notifSystem.getActive()]);
    }, 250);
    return () => clearInterval(interval);
  }, []);

  const dismiss = (id: string) => {
    const notifSystem = registry.get<NotificationSystem>('notification');
    notifSystem.dismiss(id);
    setNotifs((prev) => prev.filter((n) => n.id !== id));
  };

  return (
    <div className="fixed top-4 right-4 z-50 flex flex-col gap-2 w-72 pointer-events-auto">
      <AnimatePresence mode="popLayout">
        {notifs.map((n) => (
          <Toast key={n.id} notif={n} onDismiss={dismiss} />
        ))}
      </AnimatePresence>
    </div>
  );
}
