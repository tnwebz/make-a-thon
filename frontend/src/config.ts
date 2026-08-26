export const API_BASE_URL = import.meta.env.VITE_API_URL || `http://${window.location.hostname}:8000/api/v1`;
export const BACKEND_BASE_URL = API_BASE_URL.replace('/api/v1', '');

export const resolveMediaUrl = (url?: string | null): string => {
  if (!url) return '';
  if (url.startsWith('http://') || url.startsWith('https://') || url.startsWith('blob:') || url.startsWith('data:')) {
    return url;
  }
  const cleanPath = url.startsWith('/') ? url : `/${url}`;
  return `${BACKEND_BASE_URL}${cleanPath}`;
};

