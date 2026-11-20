import axios from "axios";
import { createContext, useState, useContext, useEffect, useRef } from "react";
import i18n from './i18n';
import { loginWithWelloServiceDesk } from './services/welloAuthService';

// ---- Session management -------------------------------------------------
// Without "Remember me": session lives in sessionStorage, expires after
// SESSION_IDLE_TIMEOUT_MS without activity or SESSION_ABSOLUTE_TIMEOUT_MS after login.
// With "Remember me": session lives in localStorage for REMEMBER_ME_TIMEOUT_MS after login.
export const SESSION_IDLE_TIMEOUT_MS = 60 * 60 * 1000; // 60 minutes
export const SESSION_ABSOLUTE_TIMEOUT_MS = 12 * 60 * 60 * 1000; // 12 hours
export const REMEMBER_ME_TIMEOUT_MS = 14 * 24 * 60 * 60 * 1000; // 14 days
const ACTIVITY_WRITE_THROTTLE_MS = 30 * 1000;
const EXPIRY_CHECK_INTERVAL_MS = 30 * 1000;
const ACTIVITY_EVENTS = ["click", "keydown", "mousemove", "scroll", "touchstart"];

const LOGOUT_BROADCAST_KEY = "auth:logout";

const getStorage = (persist) => (persist ? localStorage : sessionStorage);

export const isSessionExpired = (stored, now = Date.now()) => {
  // Sessions saved before this mechanism existed have no loginAt: force a fresh login.
  if (!stored || !stored.loginAt) return true;
  if (stored.persist) return now - stored.loginAt > REMEMBER_ME_TIMEOUT_MS;
  return (
    now - stored.loginAt > SESSION_ABSOLUTE_TIMEOUT_MS ||
    now - (stored.lastActiveAt || stored.loginAt) > SESSION_IDLE_TIMEOUT_MS
  );
};

// Returns the stored session of the given storage, or null (removing it if expired/corrupt).
const readFrom = (storage) => {
  try {
    const raw = storage.getItem("auth");
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (isSessionExpired(parsed)) {
      storage.removeItem("auth");
      return null;
    }
    return parsed;
  } catch (error) {
    console.error("Failed to read auth data from storage:", error);
    return null;
  }
};

export const readStoredAuth = () => readFrom(localStorage) || readFrom(sessionStorage);

const clearStoredAuth = () => {
  try {
    localStorage.removeItem("auth");
    sessionStorage.removeItem("auth");
  } catch (error) {
    console.error("Failed to clear auth data:", error);
  }
};

const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [auth, setAuth] = useState(() => readStoredAuth());
  const authRef = useRef(auth);
  useEffect(() => {
    authRef.current = auth;
  }, [auth]);

  const [colorPrimary, setColorPrimary] = useState(() => {
    try {
      return (window.welloServiceDesk && window.welloServiceDesk.color_primary) || null;
    } catch (e) {
      return null;
    }
  });

  useEffect(() => {
    if (window.welloServiceDesk) {
      const { color_primary } = window.welloServiceDesk || {};
      setColorPrimary(color_primary || null);
    }
  }, []);

  // Sync logout across tabs.
  // - "Remember me" sessions share localStorage, so removing "auth" reaches every tab.
  // - sessionStorage sessions are per-tab, so an explicit logout also writes a
  //   LOGOUT_BROADCAST_KEY value to localStorage; its "storage" event reaches the other tabs.
  useEffect(() => {
    const handleStorageChange = (event) => {
      if (event.key === "auth" && event.newValue === null && authRef.current?.persist) {
        setAuth(null);
      } else if (event.key === LOGOUT_BROADCAST_KEY && event.newValue && authRef.current) {
        try {
          sessionStorage.removeItem("auth");
        } catch (error) {
          console.error("Failed to clear session auth:", error);
        }
        setAuth(null);
      }
    };
    window.addEventListener("storage", handleStorageChange);
    return () => window.removeEventListener("storage", handleStorageChange);
  }, []);

  const isLoggedIn = !!auth;
  const isPersistent = !!auth?.persist;

  // Idle tracking (non "Remember me" sessions): refresh lastActiveAt on user activity
  useEffect(() => {
    if (!isLoggedIn || isPersistent) return undefined;
    let lastWrite = 0;
    const onActivity = () => {
      const now = Date.now();
      if (now - lastWrite < ACTIVITY_WRITE_THROTTLE_MS) return;
      lastWrite = now;
      try {
        const raw = sessionStorage.getItem("auth");
        if (!raw) return;
        const current = JSON.parse(raw);
        if (isSessionExpired(current, now)) return; // the expiry check below logs out
        sessionStorage.setItem("auth", JSON.stringify({ ...current, lastActiveAt: now }));
      } catch (error) {
        console.error("Failed to update session activity:", error);
      }
    };
    ACTIVITY_EVENTS.forEach((evt) => window.addEventListener(evt, onActivity, { passive: true }));
    return () => ACTIVITY_EVENTS.forEach((evt) => window.removeEventListener(evt, onActivity));
  }, [isLoggedIn, isPersistent]);

  // Expiry check: periodically, and when the tab becomes visible/focused again
  useEffect(() => {
    if (!isLoggedIn) return undefined;
    const check = () => {
      if (!readFrom(getStorage(isPersistent))) setAuth(null);
    };
    const onVisibility = () => {
      if (document.visibilityState === "visible") check();
    };
    const id = setInterval(check, EXPIRY_CHECK_INTERVAL_MS);
    window.addEventListener("focus", check);
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      clearInterval(id);
      window.removeEventListener("focus", check);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [isLoggedIn, isPersistent]);

  // Invalid/expired credentials on the server side: sign the user out
  useEffect(() => {
    const id = axios.interceptors.response.use(
      (response) => response,
      (error) => {
        if (error?.response?.status === 401 && authRef.current && !error.config?.skipAuthRedirect) {
          clearStoredAuth();
          setAuth(null);
        }
        return Promise.reject(error);
      }
    );
    return () => axios.interceptors.response.eject(id);
  }, []);

  // WordPress plugin login: the contact is authenticated with the service access token configured in
  // the plugin settings (window.welloServiceDesk.service_access_token, see includes/assets.php).
  // The API returns an auth_token that is then sent as "Authorization: Basic <auth_token>".
  // Returns the API response (PasswordUpdate reads response.data.auth_token).
  const login = async (email, password, remember) => {
    try {
      if (!email || !password) {
        throw new Error("All fields must be filled out.");
      }

      const authEmail = email.trim();
      const response = await loginWithWelloServiceDesk(authEmail, password);

      if (response?.data) {
        const { firstname, lastname, id, db_language_iso_code, auth_token } = response.data;
        if (!auth_token) {
          throw new Error("Login failed. Please check your credentials.");
        }
        // "Remember me" decides where/how long the session lives; re-auth keeps the current mode.
        const persist = remember ?? authRef.current?.persist ?? false;
        const now = Date.now();
        const authData = {
          authKey: auth_token,
          userId: id,
          userName: `${firstname} ${lastname}`,
          authEmail,
          userLang: db_language_iso_code,
          persist,
          loginAt: now,
          lastActiveAt: now
        };
        clearStoredAuth();
        getStorage(persist).setItem("auth", JSON.stringify(authData));
        setAuth(authData);
      }

      return response;
    } catch (error) {
      console.error("Login failed:", error);
      const apiMessage =
        error?.response?.data?.message ||
        error?.response?.data?.error ||
        error?.message ||
        "Login failed. Please check your credentials.";
      throw new Error(apiMessage);
    }
  };

  const logout = () => {
    setAuth(null);
    clearStoredAuth();
    try {
      // Tell the other open tabs to sign out too (value must change to fire the event)
      localStorage.setItem(LOGOUT_BROADCAST_KEY, String(Date.now()));
    } catch (error) {
      console.error("Failed to broadcast logout:", error);
    }
  };

  const updateAuthToken = (newToken) => {
    setAuth(prev => {
      const updated = { ...prev, authKey: newToken, lastActiveAt: Date.now() };
      getStorage(prev?.persist).setItem("auth", JSON.stringify(updated)); // ✅ persist update
      return updated;
    });
  };

  // Change the UI language chosen from the sidebar and remember it in the current session
  const updateLanguage = (lng) => {
    if (!lng) return;
    try {
      localStorage.setItem('i18nextLng', lng);
    } catch (e) {
      console.error("Failed to save language:", e);
    }
    setAuth((prev) => {
      if (!prev) return prev;
      const updated = { ...prev, userLang: lng };
      try {
        getStorage(prev.persist).setItem("auth", JSON.stringify(updated));
      } catch (e) {
        console.error("Failed to persist language:", e);
      }
      return updated;
    });
  };

  // Apply the user's language only when it really changes. i18next emits "languageChanged" even when
  // the language is set to its current value, which gives every useTranslation() a new `t` and re-runs
  // the effects that depend on it (e.g. the ticket / work order detail pages fetched their data twice).
  const userLang = auth?.userLang;
  useEffect(() => {
    if (!userLang || i18n.language === userLang) return;
    try {
      i18n.changeLanguage(userLang);
      localStorage.setItem('i18nextLng', userLang);
    } catch (e) {
      console.error("Failed to set language from auth:", e);
    }
  }, [userLang]);

  return (
    <AuthContext.Provider value={{ auth, login, logout, updateAuthToken, updateLanguage, color_primary: colorPrimary }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
};