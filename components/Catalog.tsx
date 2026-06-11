"use client";

import { useState, useEffect } from 'react';
import Image from 'next/image';
import { useLanguage } from '@/context/LanguageContext';

const DEFAULT_WHATSAPP_NUMBER = '+59175873118';

interface Category {
  _id: string;
  name: string | { es: string; en?: string };
  slug: string;
}

const DEFAULT_CATEGORIES: Category[] = [
  { _id: '1', name: { es: 'Aretes', en: 'Earrings' }, slug: 'aretes' },
  { _id: '2', name: { es: 'Anillos', en: 'Rings' }, slug: 'anillos' },
  { _id: '3', name: { es: 'Dijes', en: 'Pendants' }, slug: 'dijes' },
  { _id: '4', name: { es: 'Manillas', en: 'Bracelets' }, slug: 'manillas' },
];

export default function Catalog({ 
  products, 
  categories = [], 
  whatsappNumber,
  whatsappButtonText,
  heroButtonText,
  heroButtonTarget,
  heroImageUrl
}: { 
  products: any[]; 
  categories?: Category[]; 
  whatsappNumber?: string;
  whatsappButtonText?: any;
  heroButtonText?: any;
  heroButtonTarget?: string;
  heroImageUrl?: string;
}) {
  const [currentCategory, setCurrentCategory] = useState<string>('all');
  const [lightboxProduct, setLightboxProduct] = useState<any | null>(null);
  const [visibleCount, setVisibleCount] = useState<number>(21);
  const { language, t } = useLanguage();

  const getWhatsAppButtonText = () => {
    const customText = getLocalized(whatsappButtonText);
    return customText || t('orderWhatsApp');
  };

  const getHeroButtonText = () => {
    const customText = getLocalized(heroButtonText);
    return customText || t('heroButton');
  };

  const activeHeroButtonTarget = heroButtonTarget === 'home-categories' ? '#home-categories' : '#catalogo';
  
  const activeWhatsapp = whatsappNumber || DEFAULT_WHATSAPP_NUMBER;
  const activeCategories = categories.length > 0 ? categories : DEFAULT_CATEGORIES;
  
  useEffect(() => {
    if (lightboxProduct) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'auto';
    }
    
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setLightboxProduct(null);
    };
    
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [lightboxProduct]);

  // Resuelve textos traducibles con compatibilidad para textos viejos (string simple)
  const getLocalized = (val: any) => {
    if (typeof val === 'string') return val;
    if (val && typeof val === 'object') {
      return val[language] || val['es'] || '';
    }
    return '';
  };

  const getWhatsAppLink = (product: any) => {
    const name = getLocalized(product.name);
    const priceText = product.showPrice !== false ? ` (${product.price})` : '';
    const message = `${t('waMessageStart')} *${name}*${priceText}. ${t('waMessageEnd')}`;
    // Limpiamos el número de espacios, guiones, etc., dejando solo números y el símbolo +
    const cleanNumber = activeWhatsapp.replace(/[^\d+]/g, '');
    return `https://wa.me/${cleanNumber}?text=${encodeURIComponent(message)}`;
  };

  const handleCategorySelect = (category: string) => {
    setCurrentCategory(category);
    setVisibleCount(21);
    if (category !== 'all') {
      document.getElementById('catalogo')?.scrollIntoView({ behavior: 'smooth' });
    } else {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  let displayedProducts = products;
  if (currentCategory === 'all') {
    displayedProducts = products.slice(0, visibleCount);
  } else {
    displayedProducts = products.filter(p => p.category === currentCategory);
  }

  // Resolvemos el título de la categoría activa
  const activeCategoryObj = activeCategories.find(c => c.slug === currentCategory);
  const categoryTitle = currentCategory === 'all' 
    ? t('fullCollection') 
    : (activeCategoryObj ? getLocalized(activeCategoryObj.name) : currentCategory.charAt(0).toUpperCase() + currentCategory.slice(1));

  // Aplicación dinámica del fondo del hero si se configuró en Sanity
  const heroBgStyle = heroImageUrl
    ? { background: `linear-gradient(rgba(10,10,10,0.6), rgba(10,10,10,0.9)), url(${heroImageUrl}) center/cover fixed` }
    : {};

  return (
    <>
      <section className="hero" id="hero" style={heroBgStyle}>
        <div className="hero-content">
          <h1>{t('heroTitle')}</h1>
          <p>{t('heroSubtitle')}</p>
          <a href={activeHeroButtonTarget} className="btn-primary">{getHeroButtonText()}</a>
        </div>
      </section>

      {currentCategory === 'all' && (
        <div id="home-categories">
          <h2 className="section-title">{t('ourCategories')}</h2>
          <div className="categories-grid">
            {activeCategories.map(cat => {
              // Busca la primera imagen de un producto que pertenezca a esta categoría
              const sampleProduct = products.find(p => p.category === cat.slug);
              const catName = getLocalized(cat.name);
              return (
                <div key={cat._id} className="category-card" onClick={() => handleCategorySelect(cat.slug)}>
                  {sampleProduct && sampleProduct.imageUrl ? (
                    <Image 
                      src={sampleProduct.imageUrl} 
                      alt={`${catName} de Plata`} 
                      width={400} 
                      height={300} 
                      style={{objectFit: 'cover'}} 
                      unoptimized={true}
                    />
                  ) : (
                    <div style={{ 
                      width: '100%', 
                      height: '300px', 
                      backgroundColor: 'rgba(255,255,255,0.03)', 
                      display: 'flex', 
                      alignItems: 'center', 
                      justifyContent: 'center', 
                      color: '#a3a3a3',
                      border: '1px solid rgba(255,255,255,0.05)',
                      borderRadius: '8px',
                      fontSize: '1rem',
                      letterSpacing: '1px'
                    }}>
                      {t('comingSoon')}
                    </div>
                  )}
                  <h3 className="category-title">{catName}</h3>
                </div>
              );
            })}
          </div>
        </div>
      )}

      <section className="products-container" id="catalogo">
        <h2 className="section-title">
          {categoryTitle}
        </h2>
        
        {currentCategory !== 'all' && (
          <div className="filter-buttons">
            <button className={`filter-btn ${currentCategory === 'all' ? 'active' : ''}`} onClick={() => handleCategorySelect('all')}>{t('all')}</button>
            {activeCategories.map(cat => (
              <button 
                key={cat._id} 
                className={`filter-btn ${currentCategory === cat.slug ? 'active' : ''}`} 
                onClick={() => handleCategorySelect(cat.slug)}
              >
                {getLocalized(cat.name)}
              </button>
            ))}
          </div>
        )}

        <div className="products-grid">
          {displayedProducts.map(product => {
            const productName = getLocalized(product.name);
            const productDesc = getLocalized(product.description);
            return (
              <div className="product-card" key={product._id}>
                <div className="product-image-container" onClick={() => setLightboxProduct(product)}>
                  {product.imageUrl && (
                    <Image 
                      src={product.imageUrl} 
                      alt={productName} 
                      fill
                      style={{objectFit: 'cover'}}
                      className="product-image"
                      unoptimized={true} // Sanity URL
                    />
                  )}
                  {product.isOnSale && (
                    <div className="product-sale-tag">
                      {t('sale')}
                    </div>
                  )}
                  {product.showPrice !== false && <div className="product-price">{product.price}</div>}
                </div>
                <div className="product-info">
                  <h3 className="product-title">{productName}</h3>
                  <p className="product-desc">{productDesc}</p>
                  <a href={getWhatsAppLink(product)} target="_blank" rel="noopener noreferrer" className="btn-whatsapp">
                    <svg viewBox="0 0 24 24"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.878-.788-1.46-1.761-1.633-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51a12.8 12.8 0 0 0-.57-.01c-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 0 1-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 0 1-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 0 1 2.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0 0 12.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 0 0 5.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 0 0-3.48-8.413Z"/></svg>
                    {getWhatsAppButtonText()}
                  </a>
                </div>
              </div>
            );
          })}
        </div>
        {currentCategory === 'all' && products.length > visibleCount && (
          <div style={{ display: 'flex', justifyContent: 'center', marginTop: '3rem' }}>
            <button 
              className="btn-primary" 
              onClick={() => setVisibleCount(prev => prev + 21)}
            >
              {t('showMore')}
            </button>
          </div>
        )}
      </section>

      {/* Lightbox */}
      <div 
        className={`modal ${lightboxProduct ? 'active' : ''}`} 
        onClick={(e) => { if (e.target === e.currentTarget) setLightboxProduct(null); }}
      >
        {lightboxProduct && (
          <div className="modal-content">
            <button className="modal-close" onClick={() => setLightboxProduct(null)}>&times;</button>
            <div className="modal-layout">
              <div className="modal-image-container-zoom">
                <Image 
                  src={lightboxProduct.imageUrl} 
                  alt={getLocalized(lightboxProduct.name)}
                  fill
                  style={{ objectFit: 'contain' }}
                  unoptimized={true}
                />
              </div>
              <div className="modal-info-side">
                <h2 className="modal-product-title">{getLocalized(lightboxProduct.name)}</h2>
                {lightboxProduct.showPrice !== false && (
                  <div className="modal-product-price">{lightboxProduct.price}</div>
                )}
                <div className="modal-divider"></div>
                <div className="modal-product-description-container">
                  <p className="modal-product-desc">{getLocalized(lightboxProduct.description)}</p>
                </div>
                <div className="modal-actions-container">
                  <a href={getWhatsAppLink(lightboxProduct)} target="_blank" rel="noopener noreferrer" className="btn-whatsapp">
                    <svg viewBox="0 0 24 24"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.878-.788-1.46-1.761-1.633-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51a12.8 12.8 0 0 0-.57-.01c-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 0 1-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 0 1-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 0 1 2.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0 0 12.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 0 0 5.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 0 0-3.48-8.413Z"/></svg>
                    {getWhatsAppButtonText()}
                  </a>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  );
}
