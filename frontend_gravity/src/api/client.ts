import axios from 'axios';

// Base API instance
export const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://10.111.238.136:8000',
  //baseURL: "https://lasandra-irrevocable-marian.ngrok-free.dev",
  headers: {
    'Content-Type': 'application/json',
    //'ngrok-skip-browser-warning': 'true',
  },
});

// Interceptor to inject auth headers from localized storage or store
api.interceptors.request.use((config) => {
  // We'll read from localStorage to avoid circular dependencies with Zustand
  const auth = localStorage.getItem('industrix-auth');
  if (auth) {
    try {
      const parsed = JSON.parse(auth);
      if (parsed.state && parsed.state.teamId && parsed.state.pin) {
        // Spec: headers must be exactly x-team-id and x-team-pin
        config.headers['x-team-id'] = parsed.state.teamId;
        config.headers['x-team-pin'] = parsed.state.pin;
      }
    } catch (e) {
      console.error("Failed to parse auth", e);
    }
  }
  return config;
});

export default api;
