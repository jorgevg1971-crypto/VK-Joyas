"use client";

import React, { createContext, useContext, useState, useEffect } from 'react';

type Language = 'es' | 'en';

interface LanguageContextType {
  language: Language;
  setLanguage: (lang: Language) => void;
  t: (key: keyof typeof translations['es']) => string;
}

const translations = {
  es: {
    heroTitle: "Elegancia en Plata 925",
    heroSubtitle: "Joyas hechas a mano diseñadas para resaltar tu belleza natural con diseños únicos y exclusivos.",
    heroButton: "Ver Colección",
    ourCategories: "Nuestras Categorías",
    comingSoon: "Próximamente",
    all: "Todos",
    fullCollection: "Colección Completa",
    orderWhatsApp: "Pedir por WhatsApp",
    copyright: "Todos los derechos reservados. Diseño en Plata 925.",
    waMessageStart: "Hola VK Joyas, me interesa comprar el producto:",
    waMessageEnd: "¿Me podrían brindar información sobre los métodos de pago (transferencia/efectivo)?",
    close: "Cerrar",
    closePage: "Cerrar y volver al inicio",
    sale: "En Oferta",
    showMore: "Ver más",
  },
  en: {
    heroTitle: "Elegance in 925 Silver",
    heroSubtitle: "Handcrafted jewelry designed to highlight your natural beauty with unique and exclusive designs.",
    heroButton: "View Collection",
    ourCategories: "Our Categories",
    comingSoon: "Coming Soon",
    all: "All",
    fullCollection: "Full Collection",
    orderWhatsApp: "Order via WhatsApp",
    copyright: "All rights reserved. Designed in 925 Silver.",
    waMessageStart: "Hello VK Joyas, I'm interested in purchasing the product:",
    waMessageEnd: "Could you please provide information about payment methods (transfer/cash)?",
    close: "Close",
    closePage: "Close and return to home",
    sale: "Sale",
    showMore: "Show more",
  }
};

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [language, setLanguageState] = useState<Language>('es');

  // Cargar idioma guardado en el navegador del usuario al iniciar
  useEffect(() => {
    const savedLang = localStorage.getItem('vk-joyas-lang') as Language;
    if (savedLang === 'es' || savedLang === 'en') {
      setLanguageState(savedLang);
    }
  }, []);

  const setLanguage = (lang: Language) => {
    setLanguageState(lang);
    localStorage.setItem('vk-joyas-lang', lang);
  };

  const t = (key: keyof typeof translations['es']): string => {
    return translations[language][key] || translations['es'][key] || '';
  };

  return (
    <LanguageContext.Provider value={{ language, setLanguage, t }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  const context = useContext(LanguageContext);
  if (context === undefined) {
    throw new Error('useLanguage debe ser utilizado dentro de un LanguageProvider');
  }
  return context;
}
