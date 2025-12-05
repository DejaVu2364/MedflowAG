// MedFlow AI Logger
const isDebug = import.meta.env.VITE_MEDFLOW_DEBUG === 'true' || import.meta.env.DEV;

export const logDebug = (...args: any[]) => {
  if (isDebug) {
    console.log('[MedFlow DEBUG]', ...args);
  }
};

export const logError = (...args: any[]) => {
  console.error('[MedFlow ERROR]', ...args);
};

export const logInfo = (...args: any[]) => {
    console.log('[MedFlow INFO]', ...args);
};
