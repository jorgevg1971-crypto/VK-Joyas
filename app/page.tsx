"use client";

import { useState, useEffect } from 'react';
import Image from 'next/image';
import { products, Product } from '@/lib/data';

const WHATSAPP_NUMBER = '+59175873118';

export default function Home() {
  const [currentCategory, setCurrentCategory] = useState<string>('all');
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [lightboxProduct, setLightboxProduct] = useState<Product | null>(null);
  
  // Disable body scroll when lightbox is open
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

  const getWhatsAppLink = (product: Product) => {
    const message = `Hola VK Joyas, me interesa comprar el producto: *${product.name}* (${product.price}). ¿Me podrían brindar información sobre los métodos de pago (transferencia/efectivo)?`;
    return `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(message)}`;
  };

  const handleCategorySelect = (category: string) => {
    setCurrentCategory(category);
    setIsMenuOpen(false);
    if (category !== 'all') {
      document.getElementById('catalogo')?.scrollIntoView({ behavior: 'smooth' });
    }
  };

  let displayedProducts = products;
  if (currentCategory === 'all') {
    // Show highlighted products
    displayedProducts = [products[0], products[5], products[10], products[15], products[20], products[1], products[6], products[11]];
  } else {
    displayedProducts = products.filter(p => p.category === currentCategory);
  }

  return (
    <>
      <nav className="navbar">
        <div className="logo">VK JOYAS</div>
        <button 
          className="hamburger" 
          onClick={() => setIsMenuOpen(!isMenuOpen)}
        >
          ☰
        </button>
        <ul className={`nav-links ${isMenuOpen ? 'active' : ''}`}>
          <li><button className={currentCategory === 'all' ? 'active' : ''} onClick={() => handleCategorySelect('all')}>Inicio</button></li>
          <li><button className={currentCategory === 'aretes' ? 'active' : ''} onClick={() => handleCategorySelect('aretes')}>Aretes</button></li>
          <li><button className={currentCategory === 'anillos' ? 'active' : ''} onClick={() => handleCategorySelect('anillos')}>Anillos</button></li>
          <li><button className={currentCategory === 'dijes' ? 'active' : ''} onClick={() => handleCategorySelect('dijes')}>Dijes</button></li>
          <li><button className={currentCategory === 'manillas' ? 'active' : ''} onClick={() => handleCategorySelect('manillas')}>Manillas</button></li>
          <li><button className={currentCategory === 'otros' ? 'active' : ''} onClick={() => handleCategorySelect('otros')}>Otros</button></li>
        </ul>
      </nav>

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
            <div className="category-card" onClick={() => handleCategorySelect('aretes')}>
              <Image src="/img/aretes_1.png" alt="Aretes de Plata" width={400} height={300} style={{objectFit: 'cover'}} />
              <h3 className="category-title">Aretes</h3>
            </div>
            <div className="category-card" onClick={() => handleCategorySelect('anillos')}>
              <Image src="/img/anillos_1.png" alt="Anillos de Plata" width={400} height={300} style={{objectFit: 'cover'}} />
              <h3 className="category-title">Anillos</h3>
            </div>
            <div className="category-card" onClick={() => handleCategorySelect('dijes')}>
              <Image src="/img/dijes_1.png" alt="Dijes de Plata" width={400} height={300} style={{objectFit: 'cover'}} />
              <h3 className="category-title">Dijes</h3>
            </div>
            <div className="category-card" onClick={() => handleCategorySelect('manillas')}>
              <Image src="/img/manillas_1.png" alt="Manillas de Plata" width={400} height={300} style={{objectFit: 'cover'}} />
              <h3 className="category-title">Manillas</h3>
            </div>
          </div>
        </div>
      )}

      <section className="products-container" id="catalogo">
        <h2 className="section-title">
          {currentCategory === 'all' ? 'Colección Completa' : currentCategory.charAt(0).toUpperCase() + currentCategory.slice(1)}
        </h2>
        
        {currentCategory !== 'all' && (
          <div className="filter-buttons">
            <button className={`filter-btn ${currentCategory === 'all' ? 'active' : ''}`} onClick={() => handleCategorySelect('all')}>Todos</button>
            <button className={`filter-btn ${currentCategory === 'aretes' ? 'active' : ''}`} onClick={() => handleCategorySelect('aretes')}>Aretes</button>
            <button className={`filter-btn ${currentCategory === 'anillos' ? 'active' : ''}`} onClick={() => handleCategorySelect('anillos')}>Anillos</button>
            <button className={`filter-btn ${currentCategory === 'dijes' ? 'active' : ''}`} onClick={() => handleCategorySelect('dijes')}>Dijes</button>
            <button className={`filter-btn ${currentCategory === 'manillas' ? 'active' : ''}`} onClick={() => handleCategorySelect('manillas')}>Manillas</button>
            <button className={`filter-btn ${currentCategory === 'otros' ? 'active' : ''}`} onClick={() => handleCategorySelect('otros')}>Otros</button>
          </div>
        )}

        <div className="products-grid">
          {displayedProducts.map(product => (
            <div className="product-card" key={product.id}>
              <div className="product-image-container" onClick={() => setLightboxProduct(product)}>
                <Image 
                  src={product.image} 
                  alt={product.name} 
                  fill
                  style={{objectFit: 'cover'}}
                  className="product-image"
                />
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
                src={lightboxProduct.image} 
                alt={lightboxProduct.name}
                fill
                style={{ objectFit: 'contain' }}
              />
            </div>
            <div className="modal-caption">{lightboxProduct.name}</div>
          </div>
        )}
      </div>

      <footer>
        <p>&copy; {new Date().getFullYear()} VK Joyas. Todos los derechos reservados. Diseño en Plata Ley 925.</p>
      </footer>
    </>
  );
}
