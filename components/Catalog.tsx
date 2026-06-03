"use client";

import { useState, useEffect } from 'react';
import Image from 'next/image';

const DEFAULT_WHATSAPP_NUMBER = '+59175873118';

interface Category {
  _id: string;
  name: string;
  slug: string;
}

const DEFAULT_CATEGORIES: Category[] = [
  { _id: '1', name: 'Aretes', slug: 'aretes' },
  { _id: '2', name: 'Anillos', slug: 'anillos' },
  { _id: '3', name: 'Dijes', slug: 'dijes' },
  { _id: '4', name: 'Manillas', slug: 'manillas' },
];

export default function Catalog({ 
  products, 
  categories = [], 
  whatsappNumber 
}: { 
  products: any[]; 
  categories?: Category[]; 
  whatsappNumber?: string;
}) {
  const [currentCategory, setCurrentCategory] = useState<string>('all');
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [lightboxProduct, setLightboxProduct] = useState<any | null>(null);
  
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

  const getWhatsAppLink = (product: any) => {
    const message = `Hola VK Joyas, me interesa comprar el producto: *${product.name}* (${product.price}). ¿Me podrían brindar información sobre los métodos de pago (transferencia/efectivo)?`;
    // Limpiamos el número de espacios, guiones, etc., dejando solo números y el símbolo +
    const cleanNumber = activeWhatsapp.replace(/[^\d+]/g, '');
    return `https://wa.me/${cleanNumber}?text=${encodeURIComponent(message)}`;
  };

  const handleCategorySelect = (category: string) => {
    setCurrentCategory(category);
    setIsMenuOpen(false);
    if (category !== 'all') {
      document.getElementById('catalogo')?.scrollIntoView({ behavior: 'smooth' });
    } else {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  let displayedProducts = products;
  if (currentCategory === 'all') {
    // Muestra hasta 8 productos destacados en la página de inicio
    displayedProducts = products.slice(0, 8);
  } else {
    displayedProducts = products.filter(p => p.category === currentCategory);
  }

  // Resolvemos el título de la categoría activa
  const activeCategoryObj = activeCategories.find(c => c.slug === currentCategory);
  const categoryTitle = currentCategory === 'all' 
    ? 'Colección Completa' 
    : (activeCategoryObj ? activeCategoryObj.name : currentCategory.charAt(0).toUpperCase() + currentCategory.slice(1));

  return (
    <>
      <section className="hero" id="hero">
        <div className="hero-content">
          <h1>Elegancia en Plata 925</h1>
          <p>Joyas hechas a mano diseñadas para resaltar tu belleza natural con diseños únicos y exclusivos.</p>
          <a href="#catalogo" className="btn-primary">Ver Colección</a>
        </div>
      </section>

      {currentCategory === 'all' && (
        <div id="home-categories">
          <h2 className="section-title">Nuestras Categorías</h2>
          <div className="categories-grid">
            {activeCategories.map(cat => {
              // Busca la primera imagen de un producto que pertenezca a esta categoría
              const sampleProduct = products.find(p => p.category === cat.slug);
              return (
                <div key={cat._id} className="category-card" onClick={() => handleCategorySelect(cat.slug)}>
                  {sampleProduct && sampleProduct.imageUrl ? (
                    <Image 
                      src={sampleProduct.imageUrl} 
                      alt={`${cat.name} de Plata`} 
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
                      Próximamente
                    </div>
                  )}
                  <h3 className="category-title">{cat.name}</h3>
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
            <button className={`filter-btn ${currentCategory === 'all' ? 'active' : ''}`} onClick={() => handleCategorySelect('all')}>Todos</button>
            {activeCategories.map(cat => (
              <button 
                key={cat._id} 
                className={`filter-btn ${currentCategory === cat.slug ? 'active' : ''}`} 
                onClick={() => handleCategorySelect(cat.slug)}
              >
                {cat.name}
              </button>
            ))}
          </div>
        )}

        <div className="products-grid">
          {displayedProducts.map(product => (
            <div className="product-card" key={product._id}>
              <div className="product-image-container" onClick={() => setLightboxProduct(product)}>
                {product.imageUrl && (
                  <Image 
                    src={product.imageUrl} 
                    alt={product.name} 
                    fill
                    style={{objectFit: 'cover'}}
                    className="product-image"
                    unoptimized={true} // Sanity URL
                  />
                )}
                <div className="product-price">{product.price}</div>
              </div>
              <div className="product-info">
                <h3 className="product-title">{product.name}</h3>
                <p className="product-desc">{product.description}</p>
                <a href={getWhatsAppLink(product)} target="_blank" rel="noopener noreferrer" className="btn-whatsapp">
                  <svg viewBox="0 0 24 24"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.878-.788-1.46-1.761-1.633-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51a12.8 12.8 0 0 0-.57-.01c-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 0 1-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 0 1-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 0 1 2.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0 0 12.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 0 0 5.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 0 0-3.48-8.413Z"/></svg>
                  Pedir por WhatsApp
                </a>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Lightbox */}
      <div 
        className={`modal ${lightboxProduct ? 'active' : ''}`} 
        onClick={(e) => { if (e.target === e.currentTarget) setLightboxProduct(null); }}
      >
        {lightboxProduct && (
          <div className="modal-content">
            <button className="modal-close" onClick={() => setLightboxProduct(null)}>&times;</button>
            <div style={{ position: 'relative', width: '90vw', height: '80vh', maxWidth: '800px' }}>
              <Image 
                src={lightboxProduct.imageUrl} 
                alt={lightboxProduct.name}
                fill
                style={{ objectFit: 'contain' }}
                unoptimized={true}
              />
            </div>
            <div className="modal-caption">{lightboxProduct.name}</div>
          </div>
        )}
      </div>
    </>
  );
}
