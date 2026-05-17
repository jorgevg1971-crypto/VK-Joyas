// WhatsApp Number Config
const WHATSAPP_NUMBER = '+59175873118';

// DOM Elements
const productsGrid = document.getElementById('products-grid');
const navLinks = document.querySelectorAll('.nav-links a');
const categoryCards = document.querySelectorAll('.category-card');
const homeCategories = document.getElementById('home-categories');
const catalogoTitle = document.getElementById('catalogo-title');
const filterButtonsContainer = document.getElementById('filter-buttons');
const filterBtns = document.querySelectorAll('.filter-btn');
const hamburger = document.getElementById('hamburger');
const navMenu = document.getElementById('nav-links');

// Lightbox Elements
const lightbox = document.getElementById('lightbox');
const lightboxImg = document.getElementById('lightbox-img');
const lightboxCaption = document.getElementById('lightbox-caption');
const modalClose = document.getElementById('modal-close');

// App State
let currentCategory = 'all';

// Initialize App
function init() {
    renderProducts(currentCategory);
    setupEventListeners();
}

// Generate WhatsApp Link
function getWhatsAppLink(product) {
    const message = `Hola VK Joyas, me interesa comprar el producto: *${product.name}* (${product.price}). ¿Me podrían brindar información sobre los métodos de pago (transferencia/efectivo)?`;
    return `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(message)}`;
}

// Render Products
function renderProducts(category) {
    productsGrid.innerHTML = '';
    
    let filteredProducts = products;
    
    if (category !== 'all') {
        filteredProducts = products.filter(p => p.category === category);
        homeCategories.style.display = 'none';
        filterButtonsContainer.style.display = 'flex';
        catalogoTitle.textContent = category.charAt(0).toUpperCase() + category.slice(1);
    } else {
        homeCategories.style.display = 'block';
        filterButtonsContainer.style.display = 'none';
        catalogoTitle.textContent = 'Colección Completa';
        // Solo mostramos unos cuantos productos destacados en el inicio
        filteredProducts = [products[0], products[5], products[10], products[15], products[20], products[1], products[6], products[11]];
    }

    filteredProducts.forEach(product => {
        const card = document.createElement('div');
        card.className = 'product-card';
        
        card.innerHTML = `
            <div class="product-image-container" onclick="openLightbox('${product.image}', '${product.name}')">
                <img src="${product.image}" alt="${product.name}" class="product-image">
                <div class="product-price">${product.price}</div>
            </div>
            <div class="product-info">
                <h3 class="product-title">${product.name}</h3>
                <p class="product-desc">${product.description}</p>
                <a href="${getWhatsAppLink(product)}" target="_blank" rel="noopener noreferrer" class="btn-whatsapp">
                    <svg viewBox="0 0 24 24"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.878-.788-1.46-1.761-1.633-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51a12.8 12.8 0 0 0-.57-.01c-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 0 1-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 0 1-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 0 1 2.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0 0 12.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 0 0 5.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 0 0-3.48-8.413Z"/></svg>
                    Pedir por WhatsApp
                </a>
            </div>
        `;
        
        productsGrid.appendChild(card);
    });
}

// Lightbox Logic
function openLightbox(imgSrc, caption) {
    lightboxImg.src = imgSrc;
    lightboxCaption.textContent = caption;
    lightbox.classList.add('active');
    document.body.style.overflow = 'hidden';
}

function closeLightbox() {
    lightbox.classList.remove('active');
    document.body.style.overflow = 'auto';
}

// Event Listeners setup
function setupEventListeners() {
    // Navigation Links
    navLinks.forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            navLinks.forEach(l => l.classList.remove('active'));
            link.classList.add('active');
            
            currentCategory = link.dataset.filter;
            renderProducts(currentCategory);
            
            // Close mobile menu if open
            navMenu.classList.remove('active');
            
            // Scroll to catalog section if not 'all'
            if (currentCategory !== 'all') {
                document.getElementById('catalogo').scrollIntoView({ behavior: 'smooth' });
            }
        });
    });

    // Category Cards (Home)
    categoryCards.forEach(card => {
        card.addEventListener('click', () => {
            currentCategory = card.dataset.category;
            
            // Update active state in nav
            navLinks.forEach(l => {
                if (l.dataset.filter === currentCategory) {
                    l.classList.add('active');
                } else {
                    l.classList.remove('active');
                }
            });
            
            renderProducts(currentCategory);
            document.getElementById('catalogo').scrollIntoView({ behavior: 'smooth' });
        });
    });

    // Filter Buttons (Catalog View)
    filterBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            filterBtns.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            
            currentCategory = btn.dataset.filter;
            renderProducts(currentCategory);
        });
    });

    // Mobile Menu
    hamburger.addEventListener('click', () => {
        navMenu.classList.toggle('active');
    });

    // Lightbox Close
    modalClose.addEventListener('click', closeLightbox);
    lightbox.addEventListener('click', (e) => {
        if (e.target === lightbox) {
            closeLightbox();
        }
    });
    
    // Close lightbox on Escape key
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && lightbox.classList.contains('active')) {
            closeLightbox();
        }
    });
}

// Run app
document.addEventListener('DOMContentLoaded', init);
