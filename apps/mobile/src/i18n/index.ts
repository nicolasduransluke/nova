import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import { getLocales } from 'expo-localization';
import es from './locales/es';
import en from './locales/en';

const deviceLanguage = getLocales()[0]?.languageCode ?? 'es';
const defaultLanguage = deviceLanguage.startsWith('en') ? 'en' : 'es';

i18n.use(initReactI18next).init({
  resources: {
    es: { translation: es },
    en: { translation: en },
  },
  lng: defaultLanguage,
  fallbackLng: 'es',
  interpolation: {
    escapeValue: false,
  },
});

export default i18n;
