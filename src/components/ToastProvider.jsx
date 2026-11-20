import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState
} from 'react';
import { AlertCircle, AlertTriangle, CheckCircle2, Info, X } from 'lucide-react';

const ToastContext = createContext(null);

function ToastItem({ toast, onDismiss }) {
  useEffect(() => {
    const duration = toast.type === 'error' ? 5000 : 3500;
    const timer = window.setTimeout(() => onDismiss(toast.id), duration);
    return () => window.clearTimeout(timer);
  }, [toast.id, toast.type, onDismiss]);

  const type = toast.type || 'success';

  return (
    <div className={`app-toast app-toast-${type}`} role={type === 'error' ? 'alert' : 'status'}>
      {type === 'error' && <AlertCircle size={19} />}
      {type === 'warning' && <AlertTriangle size={19} />}
      {type === 'info' && <Info size={19} />}
      {type === 'success' && <CheckCircle2 size={19} />}
      <span>{toast.message}</span>
      <button type="button" onClick={() => onDismiss(toast.id)} aria-label="Dismiss notification">
        <X size={16} />
      </button>
    </div>
  );
}

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  const nextId = useRef(0);

  const toast = useCallback((message, type = 'success') => {
    if (!message) return;
    const id = ++nextId.current;
    setToasts(current => [...current, { id, message, type }]);
  }, []);

  const dismiss = useCallback(id => {
    setToasts(current => current.filter(item => item.id !== id));
  }, []);

  return (
    <ToastContext.Provider value={toast}>
      {children}
      <div className="app-toast-container" aria-live="polite" aria-relevant="additions">
        {toasts.map(item => <ToastItem key={item.id} toast={item} onDismiss={dismiss} />)}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const toast = useContext(ToastContext);
  if (!toast) throw new Error('useToast must be used within a ToastProvider.');
  return toast;
}
