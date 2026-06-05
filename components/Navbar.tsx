"use client";

import { useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useLanguage } from '@/context/LanguageContext';

type MenuItem = {
  _key: string;
  title: string | { es: string; en?: string };
  linkType: 'url' | 'page';
  url?: string;
  pageRef?: { slug: { current: string } };
  subItems?: MenuItem[];
};

export default function Navbar({ items = [] }: { items: MenuItem[] }) {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [openDropdown, setOpenDropdown] = useState<string | null>(null);
  const { language, setLanguage } = useLanguage();

  const getLinkHref = (item: MenuItem) => {
    if (item.linkType === 'url' && item.url) {
      return item.url;
    }
    if (item.linkType === 'page' && item.pageRef?.slug?.current) {
      return `/${item.pageRef.slug.current}`;
    }
    return '#';
  };

  const handleDropdownClick = (key: string) => {
    setOpenDropdown(openDropdown === key ? null : key);
  };

  // Resuelve el título en base al idioma activo con compatibilidad para textos viejos (string simple)
  const getLocalizedTitle = (title: string | { es: string; en?: string }) => {
    if (typeof title === 'string') return title;
    if (title && typeof title === 'object') {
      return title[language] || title['es'] || '';
    }
    return '';
  };

  return (
    <nav className="navbar" style={{ zIndex: 1000, position: 'sticky', top: 0, width: '100%', backgroundColor: '#000', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.5rem 1.5rem' }}>
      <div className="logo-container" style={{ cursor: 'pointer', display: 'flex', alignItems: 'center' }}>
        <Link href="/">
          <Image 
            src="/logo.jpeg" 
            alt="VK Joyas" 
            width={45} 
            height={45} 
            style={{ 
              filter: 'invert(1) brightness(2)',
              mixBlendMode: 'screen'
            }} 
            unoptimized 
          />
        </Link>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginLeft: 'auto' }}>
        {/* Selector de idioma ES | EN */}
        <div style={{ display: 'flex', gap: '0.2rem', alignItems: 'center', marginRight: '1rem', backgroundColor: 'rgba(255,255,255,0.03)', padding: '0.2rem 0.6rem', borderRadius: '20px', border: '1px solid rgba(255,255,255,0.05)' }}>
          <button 
            onClick={() => setLanguage('es')} 
            style={{
              background: 'none',
              border: 'none',
              color: language === 'es' ? '#ffffff' : '#737373',
              fontWeight: language === 'es' ? 'bold' : 'normal',
              cursor: 'pointer',
              fontSize: '0.85rem',
              transition: 'color 0.2s ease',
              outline: 'none'
            }}
          >
            ES
          </button>
          <span style={{ color: '#404040', fontSize: '0.8rem' }}>|</span>
          <button 
            onClick={() => setLanguage('en')} 
            style={{
              background: 'none',
              border: 'none',
              color: language === 'en' ? '#ffffff' : '#737373',
              fontWeight: language === 'en' ? 'bold' : 'normal',
              cursor: 'pointer',
              fontSize: '0.85rem',
              transition: 'color 0.2s ease',
              outline: 'none'
            }}
          >
            EN
          </button>
        </div>

        <button 
          className="hamburger" 
          onClick={() => setIsMenuOpen(!isMenuOpen)}
          style={{ color: 'white', background: 'none', border: 'none', fontSize: '1.5rem', cursor: 'pointer' }}
        >
          ☰
        </button>
      </div>

      <ul className={`nav-links ${isMenuOpen ? 'active' : ''}`} style={{ listStyle: 'none', display: 'flex', margin: 0, padding: 0 }}>
        {items.map((item) => (
          <li key={item._key} style={{ position: 'relative' }} className="nav-item">
            {item.subItems && item.subItems.length > 0 ? (
              <div 
                style={{ color: 'white', padding: '1rem', cursor: 'pointer' }}
                onClick={() => handleDropdownClick(item._key)}
              >
                {getLocalizedTitle(item.title)} ▾
                {openDropdown === item._key && (
                  <ul className="dropdown-menu" style={{ 
                    position: 'absolute', 
                    top: '100%', 
                    left: 0, 
                    backgroundColor: '#111', 
                    listStyle: 'none', 
                    padding: '0.5rem 0',
                    minWidth: '150px'
                  }}>
                    {item.subItems.map(subItem => (
                      <li key={subItem._key}>
                        <Link 
                          href={getLinkHref(subItem)} 
                          style={{ color: 'white', display: 'block', padding: '0.5rem 1rem', textDecoration: 'none' }}
                          onClick={() => setIsMenuOpen(false)}
                        >
                          {getLocalizedTitle(subItem.title)}
                        </Link>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            ) : (
              <Link 
                href={getLinkHref(item)} 
                style={{ color: 'white', display: 'block', padding: '1rem', textDecoration: 'none' }}
                onClick={() => setIsMenuOpen(false)}
              >
                {getLocalizedTitle(item.title)}
              </Link>
            )}
          </li>
        ))}
      </ul>
      <style jsx>{`
        @media (max-width: 768px) {
          .nav-links {
            display: none !important;
            flex-direction: column;
            position: absolute;
            top: 100%;
            left: 0;
            right: 0;
            background: #000;
          }
          .nav-links.active {
            display: flex !important;
          }
          .dropdown-menu {
            position: static !important;
            padding-left: 2rem !important;
          }
        }
        @media (min-width: 769px) {
          .hamburger {
            display: none !important;
          }
          .nav-item:hover .dropdown-menu {
            display: block !important;
          }
          .dropdown-menu {
            display: none;
          }
        }
      `}</style>
    </nav>
  );
}
