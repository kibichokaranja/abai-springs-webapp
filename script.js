// Splash Screen Auto-Hide
document.addEventListener('DOMContentLoaded', function() {
  const splashOverlay = document.getElementById('splash-overlay');
  
  if (splashOverlay) {
    // Auto-hide after 3 seconds
    setTimeout(() => {
      splashOverlay.classList.add('fade-out');
    }, 3000);
    
    // Also allow manual hide on click/tap
    splashOverlay.addEventListener('click', () => {
      splashOverlay.classList.add('fade-out');
    });
    
    // Allow hide on scroll
    document.addEventListener('wheel', () => {
      splashOverlay.classList.add('fade-out');
    });
  }
});

// Cart data
let cart = [];
let currentUser = null;

// Global data
let outlets = [];
let products = [];
let selectedOutlet = null;

// API Base URL
const API_BASE_URL = 'http://localhost:3001/api';

// Add to Cart function is now defined later in the file with proper brand support

// Update Cart UI
function updateCartUI() {
  const cartCount = document.getElementById("cart-count");
  const cartTotal = document.getElementById("cart-total");

  if (cartCount) cartCount.textContent = cart.length;

  // Update floating cart count as well
  const floatingCartCount = document.getElementById("floating-cart-count");
  if (floatingCartCount) floatingCartCount.textContent = cart.length;

  const total = cart.reduce((sum, item) => sum + item.price, 0);
  if (cartTotal) cartTotal.textContent = total;
}

// Load cart from localStorage on page load
function loadCartFromStorage() {
  const savedCart = localStorage.getItem('abaiCart');
  if (savedCart) {
    cart = JSON.parse(savedCart);
    updateCartUI();
  }
}

// Checkout function - redirects to checkout page
function checkout() {
  const cartItems = getCartItems();
  if (cartItems.length === 0) {
    showToast("Your cart is empty!");
    return;
  }

  // Check if user is logged in
  const token = localStorage.getItem('token');
  if (!token) {
    showToast("Please login to proceed to checkout");
    setTimeout(() => {
      window.location.href = 'login.html';
    }, 2000);
    return;
  }

  // Play proceed sound
  playSound('proceed-sound');

  // Redirect to checkout page
  window.location.href = 'checkout.html';
}

// Toggle cart in future (if needed)
function toggleCart() {
  window.scrollTo({ top: document.body.scrollHeight, behavior: "smooth" });
}

// Navigation Menu Functions
function toggleNavMenu() {
  const dropdown = document.getElementById('nav-menu-dropdown');
  if (dropdown) {
    const isVisible = dropdown.style.display !== 'none';
    dropdown.style.display = isVisible ? 'none' : 'block';
    
    // Close products submenu when closing main menu
    if (isVisible) {
      const productsSubmenu = document.getElementById('nav-menu-products-submenu');
      if (productsSubmenu) {
        productsSubmenu.style.display = 'none';
      }
    }
  }
}

function closeNavMenu() {
  const dropdown = document.getElementById('nav-menu-dropdown');
  if (dropdown) {
    dropdown.style.display = 'none';
    const productsSubmenu = document.getElementById('nav-menu-products-submenu');
    if (productsSubmenu) {
      productsSubmenu.style.display = 'none';
    }
  }
}

function toggleNavProductsDropdown(event) {
  if (event) {
    event.preventDefault();
    event.stopPropagation();
  }
  const submenu = document.getElementById('nav-menu-products-submenu');
  if (submenu) {
    const isVisible = submenu.style.display !== 'none';
    submenu.style.display = isVisible ? 'none' : 'block';
  }
}

// Close menu when clicking outside
document.addEventListener('click', function(event) {
  const menuButton = document.querySelector('.nav-menu-button');
  const dropdown = document.getElementById('nav-menu-dropdown');
  
  if (dropdown && menuButton && !menuButton.contains(event.target) && !dropdown.contains(event.target)) {
    closeNavMenu();
  }
});

// Hide navigation bar - use menu button instead
function hideNavBar() {
  const navLinks = document.querySelector('.nav-links');
  const navToggle = document.querySelector('.nav-toggle');
  const mainNav = document.querySelector('.main-nav');
  
  if (navLinks) {
    navLinks.style.display = 'none';
    navLinks.style.visibility = 'hidden';
    navLinks.style.opacity = '0';
  }
  if (navToggle) {
    navToggle.style.display = 'none';
    navToggle.style.visibility = 'hidden';
    navToggle.style.opacity = '0';
    navToggle.style.width = '0';
    navToggle.style.height = '0';
    navToggle.style.overflow = 'hidden';
  }
  if (mainNav) {
    mainNav.style.display = 'none';
    mainNav.style.visibility = 'hidden';
    mainNav.style.opacity = '0';
  }
}

// Run immediately and on various events to hide nav bar
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', hideNavBar);
} else {
  hideNavBar();
}
window.addEventListener('load', hideNavBar);
window.addEventListener('resize', hideNavBar);
setTimeout(hideNavBar, 100);
setTimeout(hideNavBar, 500);
setTimeout(hideNavBar, 1000);

// Play sound utility
function playSound(id) {
  const audio = document.getElementById(id);
  if (audio) {
    audio.currentTime = 0;
    audio.play();
  }
}

// Show splash on every page load
window.addEventListener('DOMContentLoaded', () => {
  // Load cart from localStorage
  loadCartFromStorage();
  
  const overlay = document.getElementById('splash-overlay');
  if (!overlay) return;
  overlay.style.display = 'flex';
  overlay.classList.remove('hide');
  // Bubbles
  const bubblesContainer = overlay.querySelector('.splash-bubbles');
  if (bubblesContainer) {
    bubblesContainer.innerHTML = '';
    for (let i = 0; i < 16 + Math.floor(Math.random() * 5); i++) {
      const bubble = document.createElement('div');
      bubble.className = 'splash-bubble';
      const size = 16 + Math.random() * 38;
      bubble.style.width = `${size}px`;
      bubble.style.height = `${size}px`;
      bubble.style.left = `${5 + Math.random() * 90}%`;
      bubble.style.animationDuration = `${1.5 + Math.random() * 1.7}s`;
      bubble.style.opacity = 0.4 + Math.random() * 0.6;
      bubblesContainer.appendChild(bubble);
    }
  }
  // Ripples
  const ripple = overlay.querySelector('.splash-ripple');
  if (ripple) {
    ripple.classList.remove('slow');
    ripple.style.animation = 'none';
    void ripple.offsetWidth;
    ripple.style.animation = '';
  }
  // Add a second, slower ripple
  let slowRipple = overlay.querySelector('.splash-ripple.slow');
  if (!slowRipple) {
    slowRipple = document.createElement('div');
    slowRipple.className = 'splash-ripple slow';
    overlay.insertBefore(slowRipple, bubblesContainer);
  } else {
    slowRipple.style.animation = 'none';
    void slowRipple.offsetWidth;
    slowRipple.style.animation = '';
  }
  setTimeout(() => {
    overlay.classList.add('hide');
    if (bubblesContainer) bubblesContainer.innerHTML = '';
    setTimeout(() => {
      overlay.style.display = 'none';
      if (slowRipple) slowRipple.remove();
    }, 1100);
  }, 2700);
});

// Splash for Shop Now and Proceed to Payment
function showSplashAndNavigate(href, callback, soundId) {
  if (soundId) playSound(soundId);
  const overlay = document.getElementById('splash-overlay');
  if (!overlay) return;
  overlay.style.display = 'flex';
  overlay.classList.remove('hide');
  // Bubbles
  const bubblesContainer = overlay.querySelector('.splash-bubbles');
  if (bubblesContainer) {
    bubblesContainer.innerHTML = '';
    for (let i = 0; i < 12 + Math.floor(Math.random() * 4); i++) {
      const bubble = document.createElement('div');
      bubble.className = 'splash-bubble';
      const size = 18 + Math.random() * 32;
      bubble.style.width = `${size}px`;
      bubble.style.height = `${size}px`;
      bubble.style.left = `${10 + Math.random() * 80}%`;
      bubble.style.animationDuration = `${1.2 + Math.random() * 1.2}s`;
      bubble.style.opacity = 0.5 + Math.random() * 0.5;
      bubblesContainer.appendChild(bubble);
    }
  }
  // Ripples
  const ripple = overlay.querySelector('.splash-ripple');
  if (ripple) {
    ripple.classList.remove('slow');
    ripple.style.animation = 'none';
    void ripple.offsetWidth;
    ripple.style.animation = '';
  }
  // Add a second, slower ripple
  let slowRipple = overlay.querySelector('.splash-ripple.slow');
  if (!slowRipple) {
    slowRipple = document.createElement('div');
    slowRipple.className = 'splash-ripple slow';
    overlay.insertBefore(slowRipple, bubblesContainer);
  } else {
    slowRipple.style.animation = 'none';
    void slowRipple.offsetWidth;
    slowRipple.style.animation = '';
  }
  setTimeout(() => {
    overlay.classList.add('hide');
    if (bubblesContainer) bubblesContainer.innerHTML = '';
    setTimeout(() => {
      overlay.style.display = 'none';
      if (slowRipple) slowRipple.remove();
      if (callback) callback();
      if (href) window.location.href = href;
    }, 1100);
  }, 2700);
}

const shopNowBtn = document.querySelector('.hero-cta');
if (shopNowBtn) {
  shopNowBtn.addEventListener('click', function(e) {
    const href = this.getAttribute('href') || '#home';
    e.preventDefault();
    showSplashAndNavigate(href, null, 'shop-now-sound');
  });
}

const proceedBtn = document.querySelector('.proceed-payment');
if (proceedBtn) {
  proceedBtn.addEventListener('click', function(e) {
    e.preventDefault();
    showSplashAndNavigate(null, () => {
      checkout();
    }, 'proceed-sound');
  });
}

// Animate 'Our Products' heading on load
window.addEventListener('DOMContentLoaded', function() {
  const productsHeading = document.querySelector('.products-section h2');
  if (productsHeading) {
    setTimeout(() => {
      productsHeading.classList.add('animate-in');
    }, 100);
  }
});

// Scroll-in animation for product cards
window.addEventListener('DOMContentLoaded', function() {
  const cards = document.querySelectorAll('.product-card');
  const observer = new window.IntersectionObserver((entries, obs) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add('scroll-in');
        obs.unobserve(entry.target);
      }
    });
  }, { threshold: 0.18 });
  cards.forEach(card => observer.observe(card));
});

// Ripple effect for product cards on hover and click
function createRipple(e, card) {
  const rect = card.getBoundingClientRect();
  const ripple = document.createElement('span');
  ripple.className = 'ripple';
  const size = Math.max(rect.width, rect.height) * 0.7;
  ripple.style.width = ripple.style.height = size + 'px';
  ripple.style.left = (e.clientX - rect.left - size / 2) + 'px';
  ripple.style.top = (e.clientY - rect.top - size / 2) + 'px';
  card.appendChild(ripple);
  ripple.addEventListener('animationend', () => ripple.remove());
}

document.addEventListener('DOMContentLoaded', function() {
  document.querySelectorAll('.product-card').forEach(card => {
    // Remove mouseenter ripple
    card.removeEventListener('mouseenter', function(e) {
      createRipple(e, card);
    });
    // Keep click ripple
    card.addEventListener('click', function(e) {
      createRipple(e, card);
    });
  });
});

// Sticky/shrink navbar on scroll
window.addEventListener('scroll', function() {
  if (window.scrollY > 10) {
    document.body.classList.add('scrolled');
  } else {
    document.body.classList.remove('scrolled');
  }
});
// Ensure ripple effect for nav links (in case of dynamic nav)
function enableNavRipples() {
  document.querySelectorAll('.ripple-link').forEach(link => {
    link.removeEventListener('click', createRipple);
    link.addEventListener('click', createRipple);
  });
}
document.addEventListener('DOMContentLoaded', enableNavRipples);

// Outlet Dropdown Logic for Navbar and Main Selector
function toggleNavOutletDropdown(event) {
  event.preventDefault();
  event.stopPropagation();
  const menu = document.getElementById('nav-outlet-dropdown-menu');
  menu.style.display = (menu.style.display === 'none' || menu.style.display === '') ? 'block' : 'none';
  document.addEventListener('click', closeOutletDropdownOnClick);
}
function closeOutletDropdownOnClick(e) {
  const menu = document.getElementById('nav-outlet-dropdown-menu');
  if (!menu.contains(e.target) && e.target.id !== 'nav-outlet-link') {
    menu.style.display = 'none';
    document.removeEventListener('click', closeOutletDropdownOnClick);
  }
}
function selectOutlet(outlet) {
  // Set the select above products
  const select = document.getElementById('outlet-selector');
  if (select) {
    select.value = outlet;
  }
  document.getElementById('nav-outlet-dropdown-menu').style.display = 'none';
}
// Sync select above products with nav dropdown
const outletSelect = document.getElementById('outlet-selector');
if (outletSelect) {
  outletSelect.addEventListener('change', function() {
    // Optionally, update nav UI or filter products here
  });
}

function showSelectedOutletBadge(value) {
  let badge = document.getElementById('nav-outlet-selected-badge');
  const link = document.getElementById('nav-outlet-link');
  if (!badge) {
    badge = document.createElement('span');
    badge.id = 'nav-outlet-selected-badge';
    badge.className = 'nav-outlet-selected-badge';
    link.parentNode.insertBefore(badge, link.nextSibling);
  }
  badge.textContent = value ? ` (${value})` : '';
  badge.style.display = value ? 'inline-block' : 'none';
}

function highlightSelectedOutletOption(select, value) {
  if (!select) return;
  for (let i = 0; i < select.options.length; i++) {
    if (select.options[i].value === value) {
      select.options[i].classList.add('selected-outlet-option');
    } else {
      select.options[i].classList.remove('selected-outlet-option');
    }
  }
}

// Sync on change
window.addEventListener('DOMContentLoaded', function() {
  const navSel = document.getElementById('nav-outlet-selector');
  const mainSel = document.getElementById('outlet-selector');
  if (navSel && mainSel) {
    navSel.addEventListener('change', function() {
      syncOutletSelectors(this.value);
    });
    mainSel.addEventListener('change', function() {
      syncOutletSelectors(this.value);
    });
  }
});

// --- Slide-in Cart Sidebar Logic ---
let cartSidebarOpen = false;

function toggleCartSidebar(forceClose = false) {
  const sidebar = document.getElementById('cart-sidebar');
  const overlay = document.getElementById('cart-overlay');
  if (forceClose || cartSidebarOpen) {
    sidebar.style.display = 'none';
    overlay.style.display = 'none';
    sidebar.classList.remove('open');
    cartSidebarOpen = false;
  } else {
    renderCartSidebar();
    sidebar.style.display = 'flex';
    overlay.style.display = 'block';
    setTimeout(() => sidebar.classList.add('open'), 10);
    cartSidebarOpen = true;
  }
}

document.getElementById('cart-overlay').onclick = () => toggleCartSidebar(true);

// Patch cart icon to open sidebar
const cartIcon = document.querySelector('.cart-icon');
if (cartIcon) {
  cartIcon.onclick = () => toggleCartSidebar();
}

function renderCartSidebar() {
  const cartItems = getCartItems();
  const itemsContainer = document.getElementById('cart-sidebar-items');
  const subtotalElem = document.getElementById('cart-sidebar-subtotal');
  
  if (!itemsContainer || !subtotalElem) return;
  
  itemsContainer.innerHTML = '';
  let subtotal = 0;
  if (!cartItems.length) {
    itemsContainer.innerHTML = '<div class="cart-sidebar-empty">Your cart is empty.</div>';
    subtotalElem.textContent = 'Ksh 0';
    return;
  }
  cartItems.forEach((item, idx) => {
    subtotal += item.price * item.qty;
    const div = document.createElement('div');
    div.className = 'cart-sidebar-item';
    // Use brand from cart item
    let brand = item.brand || 'Abai Springs';
    // The item name is just the size, e.g., "500ml"
    let quantity = item.name;
    div.innerHTML = `
      <div class="cart-item-img-col">
        <img src="${item.img}" alt="${brand} ${quantity}" class="cart-item-img" />
      </div>
      <div class="cart-item-info-col">
        <div class="cart-item-title-row">
          <span class="cart-item-title">${brand} ${quantity}</span>
          <span class="cart-item-remove" onclick="removeCartItem(${idx})">&times;</span>
        </div>
        <div class="cart-item-desc">${quantity}</div>
        <div class="cart-item-qty-row">
          <button class="cart-item-qty-btn" onclick="updateCartQty(${idx}, -1)">-</button>
          <span class="cart-item-qty">${item.qty}</span>
          <button class="cart-item-qty-btn" onclick="updateCartQty(${idx}, 1)">+</button>
        </div>
        <div class="cart-item-price">Ksh ${item.price}</div>
      </div>
    `;
    itemsContainer.appendChild(div);
  });
  subtotalElem.textContent = `Ksh ${subtotal}`;
}

// Toast Notification Utility
function showToast(message) {
  const container = document.getElementById('toast-container');
  if (!container) return;
  const toast = document.createElement('div');
  toast.className = 'toast';
  toast.textContent = message;
  container.appendChild(toast);
  setTimeout(() => {
    toast.style.opacity = 0;
    setTimeout(() => container.removeChild(toast), 600);
  }, 3000);
}

// --- Cart Data Logic (uses localStorage for demo) ---
function getCartItems() {
  // Example: [{name, price, qty, img}]
  let cart = localStorage.getItem('abaiCart');
  if (!cart) return [];
  try { return JSON.parse(cart); } catch { return []; }
}
function setCartItems(items) {
  localStorage.setItem('abaiCart', JSON.stringify(items));
  updateCartCount();
}
function updateCartCount() {
  const cart = getCartItems();
  const cartCount = document.getElementById('cart-count');
  if (cartCount) cartCount.textContent = cart.reduce((sum, i) => sum + i.qty, 0);
}
function addToCart(name, price, brand) {
  let cart = getCartItems();
  // Find image for product
  let img = '';
  const abaiImgs = {
    '500ml': 'images/500ml.png',
    '1 Litre': 'images/1l.png',
    '5 Litre': 'images/5l.png',
    '10 Litre': 'images/10l.png',
    '20 Litre': 'images/20l.png',
  };
  const sprinkleImgs = {
    '500ml': 'images/sprinkle-500ml.png',
    '1 Litre': 'images/sprinkle-1l.png',
    '5 Litre': 'images/sprinkle-5l.png',
    '10 Litre': 'images/sprinkle-10l.png',
    '20 Litre': 'images/sprinkle-20l.png',
  };
  if (brand === 'Sprinkle') img = sprinkleImgs[name];
  else img = abaiImgs[name];
  // Add or update (merge by name + brand only; outlet no longer used)
  let idx = cart.findIndex(i => i.name === name && i.brand === brand);
  if (idx > -1) {
    cart[idx].qty += 1;
    showToast('Increased quantity in cart.');
  } else {
    cart.push({ name, price, qty: 1, img, brand });
    showToast('Added to cart!');
  }
  setCartItems(cart);
  updateCartCount();
  renderCartSidebar();
  // Pulse cart count
  const cartCount = document.getElementById('cart-count');
  if (cartCount) {
    cartCount.classList.remove('cart-count-pulse');
    void cartCount.offsetWidth; // force reflow
    cartCount.classList.add('cart-count-pulse');
  }
}

// View Product function - scrolls to product and highlights it
function viewProduct(name, price, brand) {
  // Find the product card in the DOM
  const productCards = document.querySelectorAll('.product-card-modern');
  let targetCard = null;
  
  productCards.forEach(card => {
    const cardName = card.querySelector('h3')?.textContent.trim();
    const cardPrice = card.querySelector('.product-price')?.textContent;
    if (cardName === name && cardPrice.includes(price.toString())) {
      targetCard = card;
    }
  });
  
  if (targetCard) {
    // Scroll to the product card
    targetCard.scrollIntoView({ behavior: 'smooth', block: 'center' });
    
    // Highlight the product card
    targetCard.style.transition = 'all 0.3s';
    targetCard.style.transform = 'scale(1.05)';
    targetCard.style.boxShadow = '0 8px 48px #1976d244, 0 4px 16px #4fc3f7cc';
    
    // Remove highlight after 2 seconds
    setTimeout(() => {
      targetCard.style.transform = '';
      targetCard.style.boxShadow = '';
    }, 2000);
    
    showToast(`Viewing ${name} - ${brand}`);
  } else {
    // If on mobile, just add to cart as fallback
    addToCart(name, price, brand);
  }
}

// Carousel navigation functions
function scrollProductsLeft(gridId) {
  const grid = document.getElementById(gridId);
  if (!grid) return;
  
  const cardWidth = grid.querySelector('.product-card-modern')?.offsetWidth || 0;
  const gap = 24; // 1.5em gap in pixels (approximately)
  const scrollAmount = cardWidth + gap;
  
  grid.scrollBy({
    left: -scrollAmount,
    behavior: 'smooth'
  });
}

function scrollProductsRight(gridId) {
  const grid = document.getElementById(gridId);
  if (!grid) return;
  
  const cardWidth = grid.querySelector('.product-card-modern')?.offsetWidth || 0;
  const gap = 24; // 1.5em gap in pixels (approximately)
  const scrollAmount = cardWidth + gap;
  
  grid.scrollBy({
    left: scrollAmount,
    behavior: 'smooth'
  });
}
function updateCartQty(idx, delta) {
  let cart = getCartItems();
  if (!cart[idx]) return;
  cart[idx].qty += delta;
  if (cart[idx].qty < 1) cart[idx].qty = 1;
  setCartItems(cart);
  renderCartSidebar();
}
function removeCartItem(idx) {
  let cart = getCartItems();
  cart.splice(idx, 1);
  setCartItems(cart);
  renderCartSidebar();
  showToast('Removed from cart.');
}
window.addEventListener('DOMContentLoaded', updateCartCount);

// Smooth scroll and glow for Products nav link
const productsNavLink = document.querySelector('a[href="#products"]');
if (productsNavLink) {
  productsNavLink.addEventListener('click', function(e) {
    e.preventDefault();
    const section = document.getElementById('products');
    if (section) {
      section.scrollIntoView({ behavior: 'smooth', block: 'start' });
      section.classList.add('products-section-glow');
      setTimeout(() => section.classList.remove('products-section-glow'), 1500);
    }
  });
}

// Smooth scroll and glow for Contact nav link
const contactNavLink = document.querySelector('a[href="#contact"]');
if (contactNavLink) {
  contactNavLink.addEventListener('click', function(e) {
    e.preventDefault();
    const section = document.getElementById('contact');
    if (section) {
      section.scrollIntoView({ behavior: 'smooth', block: 'start' });
      section.classList.add('contact-section-glow');
      setTimeout(() => section.classList.remove('contact-section-glow'), 1500);
    }
  });
}

// Login Modal Logic
function toggleLoginModal(forceClose = false) {
  const modal = document.getElementById('login-modal');
  if (!modal) return;
  
  if (forceClose || modal.style.display === 'flex' || modal.style.display === 'block') {
    // Close the modal
    modal.style.display = 'none';
    document.body.style.overflow = '';
  } else {
    // Open the modal
    modal.style.display = 'flex';
    document.body.style.overflow = 'hidden';
    setTimeout(() => {
      const emailInput = document.getElementById('login-email');
      if (emailInput) emailInput.focus();
    }, 100);
  }
}
const loginBtn = document.getElementById('login-btn');
if (loginBtn) {
  loginBtn.onclick = () => toggleLoginModal();
}
// Close modal on overlay click or Escape key
window.addEventListener('keydown', function(e) {
  if (e.key === 'Escape') toggleLoginModal(true);
});
document.addEventListener('mousedown', function(e) {
  const modal = document.getElementById('login-modal');
  if (!modal || modal.style.display === 'none') return;
  if (e.target === modal) toggleLoginModal(true);
});

// --- Fetch and Render Outlets from Backend ---
async function loadOutlets() {
  try {
    const response = await fetch(`${API_BASE_URL}/outlets`, {
      headers: { 'x-cache-disabled': 'true' }
    });
    
    const data = await response.json();
    
    if (data.success) {
      const newOutlets = data.data.filter(outlet => outlet.isActive);
      const outletsChanged = JSON.stringify(newOutlets) !== JSON.stringify(outlets);
      outlets = newOutlets;
      updateOutletDropdowns();
      
      if (outletsChanged) {
        // Removed toast notification for cleaner user experience
      }
    } else {
      console.error('Failed to load outlets:', data.message);
    }
  } catch (error) {
    console.error('Error loading outlets:', error);
  }
}

// Manual refresh function for the frontend
async function manualRefresh() {
  console.log('🔄 Manual refresh triggered');
  
  // Get the refresh button and show loading state
  const refreshBtn = document.getElementById('refresh-data-btn');
  const originalText = refreshBtn.innerHTML;
  refreshBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Refreshing...';
  refreshBtn.disabled = true;
  
  try {
      // Refresh outlets
  await loadOutlets();
    console.log('✅ Manual refresh completed successfully');
    showToast('Data refreshed successfully!', 'success');
  } catch (error) {
    console.error('❌ Error during manual refresh:', error);
    showToast('Failed to refresh data', 'error');
  } finally {
    // Restore button state
    refreshBtn.innerHTML = originalText;
    refreshBtn.disabled = false;
  }
}



function updateOutletDropdowns() {
  const outletSelector = document.getElementById('outlet-selector');
  const navDropdown = document.getElementById('nav-outlet-dropdown-menu');
  
  if (outletSelector) {
    // Clear existing options except the first one
    while (outletSelector.options.length > 1) {
      outletSelector.remove(1);
    }
    
    // Add outlet options
    outlets.forEach(outlet => {
      const option = document.createElement('option');
      option.value = outlet._id;
      option.textContent = outlet.name;
      outletSelector.appendChild(option);
    });
  }
  
  if (navDropdown) {
    // Clear existing outlet buttons
    const existingButtons = navDropdown.querySelectorAll('.outlet-dropdown-btn');
    existingButtons.forEach(btn => btn.remove());
    
    // Add outlet buttons
    outlets.forEach(outlet => {
      const button = document.createElement('button');
      button.className = 'outlet-dropdown-btn';
      button.textContent = outlet.name;
      button.onclick = () => {
        selectedOutlet = outlet._id;
        // Update the main outlet selector to match
        const outletSelector = document.getElementById('outlet-selector');
        if (outletSelector) {
          outletSelector.value = outlet._id;
        }
        navDropdown.style.display = 'none';
      };
      navDropdown.appendChild(button);
    });
  }
}



// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
  console.log('🚀 Initializing Abai Springs frontend...');
  
  // Load data from backend
  loadOutlets();
  
  // Update displays after data loads
  setTimeout(() => {
    updateOutletDropdowns();
    
    // Check for specific product sections
    const abaiProducts = document.getElementById('abai-products');
    const sprinkleProducts = document.getElementById('sprinkle-products');
    
    if (abaiProducts) {
      abaiProducts.style.display = 'block';
    }
    if (sprinkleProducts) {
      sprinkleProducts.style.display = 'none';
    }
    
    // Check outlet selector
    const outletSelector = document.getElementById('outlet-selector');
    if (outletSelector && outletSelector.options.length > 1) {
      // Outlets loaded successfully
    }
  }, 1000);
  
  // Set up periodic refresh for outlets
  // Refresh every 30 seconds to keep outlet data in sync with admin dashboard
  setInterval(() => {
    console.log('🔄 Periodic refresh triggered');
    loadOutlets();
  }, 30000); // 30 seconds
  
  console.log('✅ Frontend initialization complete');
});

function switchBrand(brand) {
  const abaiProducts = document.getElementById('abai-products');
  const sprinkleProducts = document.getElementById('sprinkle-products');
  
  if (brand === 'abai') {
    if (abaiProducts) {
      abaiProducts.style.display = 'block';
    }
    if (sprinkleProducts) {
      sprinkleProducts.style.display = 'none';
    }
  } else if (brand === 'sprinkle') {
    if (abaiProducts) {
      abaiProducts.style.display = 'none';
    }
    if (sprinkleProducts) {
      sprinkleProducts.style.display = 'block';
    }
  }
}

// --- User Registration/Login: Connect to Backend ---

// Handle login form submission
async function handleLogin(event) {
  event.preventDefault();
  
  const email = document.getElementById('login-email').value;
  const password = document.getElementById('login-password').value;
  
  // Show loading state
  const submitBtn = event.target.querySelector('button[type="submit"]');
  const btnText = submitBtn.querySelector('.btn-text');
  const btnLoading = submitBtn.querySelector('.btn-loading');
  
  if (btnText && btnLoading) {
    btnText.style.display = 'none';
    btnLoading.style.display = 'flex';
  }
  
  try {
    // For demo: try login first, if fails, try register
    let res = await fetch(`${API_BASE_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password })
    });
    let data = await res.json();
    
    if (!data.success) {
      // Show message that account doesn't exist and suggest registration
      showToast('Account not found. Please use the "Create Account" option to register.');
      
      // Reset button state
      if (btnText && btnLoading) {
        btnText.style.display = 'block';
        btnLoading.style.display = 'none';
      }
      return;
    }
    
    if (data.success && data.data && data.data.token) {
      localStorage.setItem('token', data.data.token);
      localStorage.setItem('user', JSON.stringify(data.data.user));
      showToast('Login successful!');
      
      // Close modal immediately
      toggleLoginModal(true);
      
      // Update the UI to show logged in state
      checkAuthStatus();
      
      // Reset form
      event.target.reset();
    } else {
      showToast(data.message || 'Login/Registration failed');
    }
  } catch (error) {
    console.error('Login error:', error);
    showToast('Login failed. Please try again.');
  } finally {
    // Reset button state
    if (btnText && btnLoading) {
      btnText.style.display = 'block';
      btnLoading.style.display = 'none';
    }
  }
}

// Handle register form submission
async function handleRegister(event) {
  event.preventDefault();
  
  const name = document.getElementById('register-name').value;
  const email = document.getElementById('register-email').value;
  const phone = document.getElementById('register-phone').value;
  const password = document.getElementById('register-password').value;
  const confirmPassword = document.getElementById('register-confirm-password').value;
  
  // Validate passwords match
  if (password !== confirmPassword) {
    showToast('Passwords do not match');
    return;
  }
  
  // Show loading state
  const submitBtn = event.target.querySelector('button[type="submit"]');
  const btnText = submitBtn.querySelector('.btn-text');
  const btnLoading = submitBtn.querySelector('.btn-loading');
  
  if (btnText && btnLoading) {
    btnText.style.display = 'none';
    btnLoading.style.display = 'flex';
  }
  
  try {
    const res = await fetch(`${API_BASE_URL}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, email, phone, password })
    });
    
    const data = await res.json();
    
    // Check if response is successful
    if (res.ok && data.success && data.data && data.data.token) {
      localStorage.setItem('token', data.data.token);
      localStorage.setItem('user', JSON.stringify(data.data.user));
      showToast('Account created successfully!');
      
      // Close modal immediately
      toggleLoginModal(true);
      
      // Update the UI to show logged in state
      checkAuthStatus();
      
      // Reset form
      event.target.reset();
    } else {
      // Handle error response
      let errorMessage = 'Registration failed';
      
      if (data.message) {
        errorMessage = data.message;
      } else if (data.error) {
        errorMessage = data.error;
      } else if (data.details) {
        // Handle validation errors
        if (data.details.errors && Array.isArray(data.details.errors)) {
          errorMessage = data.details.errors.map(e => {
            if (typeof e === 'string') return e;
            if (e.message) return e.message;
            if (e.field && e.message) return `${e.field}: ${e.message}`;
            return JSON.stringify(e);
          }).join(', ');
        } else if (typeof data.details === 'string') {
          errorMessage = data.details;
        }
      } else if (data.code === 'VALIDATION_ERROR') {
        errorMessage = 'Please check your input and try again';
      }
      
      console.error('Registration failed:', data);
      showToast(errorMessage);
    }
  } catch (error) {
    console.error('Registration error:', error);
    showToast('Network error. Please check your connection and try again.');
  } finally {
    // Reset button state
    if (btnText && btnLoading) {
      btnText.style.display = 'block';
      btnLoading.style.display = 'none';
    }
  }
}

// Toggle between login and register forms
function toggleRegisterForm() {
  const loginForm = document.getElementById('login-form');
  const registerForm = document.getElementById('register-form');
  const toggleLink = document.getElementById('toggle-register');
  const passwordRequirements = document.getElementById('password-requirements');
  
  if (loginForm && registerForm && toggleLink) {
    if (loginForm.style.display === 'none') {
      // Show login form
      loginForm.style.display = 'block';
      registerForm.style.display = 'none';
      toggleLink.textContent = 'Create Account';
      // Hide password requirements when showing login form
      if (passwordRequirements) {
        passwordRequirements.style.display = 'none';
      }
    } else {
      // Show register form
      loginForm.style.display = 'none';
      registerForm.style.display = 'block';
      toggleLink.textContent = 'Login';
      // Show password requirements if password field has value
      const passwordInput = document.getElementById('register-password');
      if (passwordRequirements && passwordInput && passwordInput.value) {
        passwordRequirements.style.display = 'block';
        validatePasswordRealtime(passwordInput.value);
      }
    }
  }
}

// Real-time password validation
function validatePasswordRealtime(password) {
  const requirements = {
    length: password.length >= 8,
    uppercase: /[A-Z]/.test(password),
    lowercase: /[a-z]/.test(password),
    number: /\d/.test(password),
    special: /[!@#$%^&*(),.?":{}|<>]/.test(password)
  };

  // Update requirement indicators
  const reqLength = document.getElementById('req-length');
  const reqUppercase = document.getElementById('req-uppercase');
  const reqLowercase = document.getElementById('req-lowercase');
  const reqNumber = document.getElementById('req-number');
  const reqSpecial = document.getElementById('req-special');

  if (reqLength) {
    reqLength.className = `password-req-item ${requirements.length ? 'valid' : 'invalid'}`;
  }
  if (reqUppercase) {
    reqUppercase.className = `password-req-item ${requirements.uppercase ? 'valid' : 'invalid'}`;
  }
  if (reqLowercase) {
    reqLowercase.className = `password-req-item ${requirements.lowercase ? 'valid' : 'invalid'}`;
  }
  if (reqNumber) {
    reqNumber.className = `password-req-item ${requirements.number ? 'valid' : 'invalid'}`;
  }
  if (reqSpecial) {
    reqSpecial.className = `password-req-item ${requirements.special ? 'valid' : 'invalid'}`;
  }

  return Object.values(requirements).every(req => req);
}

// Add event listener for toggle register link
document.addEventListener('DOMContentLoaded', function() {
  const toggleRegisterLink = document.getElementById('toggle-register');
  if (toggleRegisterLink) {
    toggleRegisterLink.addEventListener('click', function(e) {
      e.preventDefault();
      toggleRegisterForm();
    });
  }

  // Add real-time password validation
  const passwordInput = document.getElementById('register-password');
  const passwordRequirements = document.getElementById('password-requirements');
  
  if (passwordInput && passwordRequirements) {
    // Show requirements when password field is focused
    passwordInput.addEventListener('focus', function() {
      passwordRequirements.style.display = 'block';
    });

    // Hide requirements when password field is empty and not focused
    passwordInput.addEventListener('blur', function() {
      if (!passwordInput.value) {
        passwordRequirements.style.display = 'none';
      }
    });

    // Real-time validation as user types
    passwordInput.addEventListener('input', function() {
      const password = passwordInput.value;
      if (password) {
        passwordRequirements.style.display = 'block';
        validatePasswordRealtime(password);
      } else {
        // Reset all requirements to invalid when empty
        const reqItems = passwordRequirements.querySelectorAll('.password-req-item');
        reqItems.forEach(item => {
          item.className = 'password-req-item invalid';
        });
      }
    });
  }
});

// Note: Event listener is handled by HTML onsubmit attribute

// Products dropdown logic
function toggleProductsDropdown(event) {
  event.preventDefault(); // Prevent default anchor scroll
  event.stopPropagation();
  const menu = document.getElementById('nav-products-dropdown-menu');
  menu.style.display = (menu.style.display === 'none' || menu.style.display === '') ? 'block' : 'none';
  // Close on outside click
  document.addEventListener('click', closeProductsDropdownOnClick);
}
function closeProductsDropdownOnClick(e) {
  const menu = document.getElementById('nav-products-dropdown-menu');
  if (!menu.contains(e.target) && e.target.id !== 'nav-products-link') {
    menu.style.display = 'none';
    document.removeEventListener('click', closeProductsDropdownOnClick);
  }
}
function showBrandProducts(brand) {
  const abaiProducts = document.getElementById('abai-products');
  const abaiContainer = abaiProducts?.closest('.products-carousel-container');
  const sprinkleProducts = document.getElementById('sprinkle-products');
  const sprinkleContainer = sprinkleProducts?.closest('.products-carousel-container');
  const productsTitle = document.getElementById('products-title');
  
  if (brand === 'sprinkle') {
    // Hide Abai products and show Sprinkle products
    if (abaiContainer) {
      abaiContainer.style.display = 'none';
      abaiContainer.style.visibility = 'hidden';
    }
    if (sprinkleContainer) {
      sprinkleContainer.style.display = 'flex';
      sprinkleContainer.style.visibility = 'visible';
    }
    if (sprinkleProducts) {
      sprinkleProducts.style.display = 'flex';
      sprinkleProducts.style.visibility = 'visible';
    }
    if (productsTitle) productsTitle.textContent = 'Our Products (Sprinkle)';
  } else {
    // Show Abai products and hide Sprinkle products
    if (abaiContainer) {
      abaiContainer.style.display = 'flex';
      abaiContainer.style.visibility = 'visible';
    }
    if (abaiProducts) {
      abaiProducts.style.display = 'grid';
      abaiProducts.style.visibility = 'visible';
    }
    if (sprinkleContainer) {
      sprinkleContainer.style.display = 'none';
      sprinkleContainer.style.visibility = 'hidden';
    }
    if (sprinkleProducts) {
      sprinkleProducts.style.display = 'none';
      sprinkleProducts.style.visibility = 'hidden';
    }
    if (productsTitle) productsTitle.textContent = 'Our Products';
  }
  // Always scroll to products section
  document.getElementById('products').scrollIntoView({ behavior: 'smooth' });
  // Hide the products dropdown menu
  var dropdown = document.getElementById('nav-products-dropdown-menu');
  if (dropdown) dropdown.style.display = 'none';
}

// Creative View Cart button behavior
const viewCartBtn = document.getElementById('view-cart-btn');
const navCartIcon = document.querySelector('.cart-icon');

if (viewCartBtn && navCartIcon) {
  viewCartBtn.addEventListener('click', function(e) {
    e.preventDefault();
    window.scrollTo({ top: 0, behavior: 'smooth' });
    // Add creative bounce and glow
    navCartIcon.classList.add('cart-dingle-glow');
    setTimeout(() => navCartIcon.classList.remove('cart-dingle-glow'), 1200);
  });
}

window.addEventListener('DOMContentLoaded', function() {
  // Always enable Add to Cart buttons (no outlet required)
  document.querySelectorAll('.modern-add-to-cart').forEach(btn => {
    btn.disabled = false;
    btn.classList.remove('disabled-add-to-cart');
  });
});

// Authentication Functions

// Check authentication status on page load
function checkAuthStatus() {
  const token = localStorage.getItem('token');
  const user = localStorage.getItem('user');
  
  const authNavItem = document.getElementById('auth-nav-item');
  const userMenu = document.getElementById('user-menu');
  const loginLink = document.getElementById('login-link');
  const userName = document.getElementById('user-name');
  
  if (token && user) {
    // User is logged in
    const userData = JSON.parse(user);
    
    // Hide login link, show user menu
    if (authNavItem) authNavItem.style.display = 'none';
    if (userMenu) {
      userMenu.style.display = 'block';
      if (userName) userName.textContent = userData.name || 'User';
    }
  } else {
    // User is not logged in
    if (authNavItem) authNavItem.style.display = 'block';
    if (userMenu) userMenu.style.display = 'none';
  }
}

// Toggle user dropdown menu
function toggleUserMenu() {
  const dropdown = document.getElementById('user-dropdown');
  if (dropdown) {
    dropdown.classList.toggle('show');
  }
}

// Close user dropdown when clicking outside
document.addEventListener('click', function(event) {
  const userMenu = document.getElementById('user-menu');
  const dropdown = document.getElementById('user-dropdown');
  
  if (userMenu && !userMenu.contains(event.target)) {
    if (dropdown) dropdown.classList.remove('show');
  }
});

// Show user profile
async function showProfile() {
  const user = localStorage.getItem('user');
  const token = localStorage.getItem('token');
  
  if (user && token) {
    let userData = JSON.parse(user);
    
    try {
      // Fetch fresh user data from backend
      const response = await fetch(`${API_BASE_URL}/auth/profile`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });
      
      if (response.ok) {
        const profileData = await response.json();
        if (profileData.success && profileData.data) {
          // Update localStorage with fresh data
          localStorage.setItem('user', JSON.stringify(profileData.data));
          userData = profileData.data;
        }
      }
    } catch (error) {
      console.error('Error fetching profile:', error);
      // Continue with cached data if fetch fails
    }
    
    // Populate profile modal with user data
    document.getElementById('profile-name').textContent = userData.name || 'Not provided';
    document.getElementById('profile-email').textContent = userData.email || 'Not provided';
    document.getElementById('profile-phone').textContent = userData.phone || 'Not provided';
    
    // Show the profile modal
    openProfileModal();
  }
}

// Open edit profile modal
function openEditProfileModal() {
  const token = localStorage.getItem('token');
  const user = localStorage.getItem('user');
  
  if (!token || !user) {
    showToast('Please log in to update your profile');
    return;
  }
  
  const userData = JSON.parse(user);
  
  // Populate the edit form with current data
  document.getElementById('edit-profile-name').value = userData.name || '';
  document.getElementById('edit-profile-phone').value = userData.phone || '';
  
  // Show the edit modal
  const modal = document.getElementById('edit-profile-modal');
  if (!modal) return;

  modal.style.display = 'flex';
  document.body.style.overflow = 'hidden';

  // Add fade-in animation
  setTimeout(() => {
    modal.classList.add('show');
  }, 10);
}

// Close edit profile modal
function closeEditProfileModal() {
  const modal = document.getElementById('edit-profile-modal');
  if (!modal) return;

  modal.classList.remove('show');
  setTimeout(() => {
    modal.style.display = 'none';
    document.body.style.overflow = '';
  }, 300);
}

// Handle edit profile form submission
async function handleEditProfileSubmit(event) {
  event.preventDefault();
  
  const token = localStorage.getItem('token');
  const user = localStorage.getItem('user');
  
  if (!token || !user) {
    showToast('Please log in to update your profile');
    return;
  }
  
  const newName = document.getElementById('edit-profile-name').value.trim();
  const newPhone = document.getElementById('edit-profile-phone').value.trim();
  
  if (!newName || !newPhone) {
    showToast('Please fill in all fields');
    return;
  }
  
  // Show loading state
  const submitBtn = event.target.querySelector('button[type="submit"]');
  const btnText = submitBtn.querySelector('.btn-text');
  const btnLoading = submitBtn.querySelector('.btn-loading');
  
  if (btnText && btnLoading) {
    btnText.style.display = 'none';
    btnLoading.style.display = 'flex';
  }
  
  submitBtn.disabled = true;
  
  try {
    const response = await fetch(`${API_BASE_URL}/auth/profile`, {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        name: newName,
        phone: newPhone
      })
    });
    
    const data = await response.json();
    
    if (data.success) {
      // Update localStorage with new data
      const userData = JSON.parse(user);
      const updatedUserData = {
        ...userData,
        name: newName,
        phone: newPhone
      };
      localStorage.setItem('user', JSON.stringify(updatedUserData));
      
      // Update UI
      checkAuthStatus();
      showToast('Profile updated successfully!');
      
      // Close edit modal
      closeEditProfileModal();
      
      // Refresh profile modal if it's open
      if (document.getElementById('profile-modal').style.display === 'flex') {
        showProfile();
      }
    } else {
      showToast(data.message || 'Failed to update profile');
    }
  } catch (error) {
    console.error('Error updating profile:', error);
    showToast('Failed to update profile. Please try again.');
  } finally {
    // Reset button state
    if (btnText && btnLoading) {
      btnText.style.display = 'flex';
      btnLoading.style.display = 'none';
    }
    submitBtn.disabled = false;
  }
}

// Update user profile (legacy function - now opens the edit modal)
function updateProfile() {
  openEditProfileModal();
}

// Open profile modal
function openProfileModal() {
  const modal = document.getElementById('profile-modal');
  if (!modal) return;

  modal.style.display = 'flex';
  document.body.style.overflow = 'hidden';

  // Hide chatbot when profile modal opens
  if (window.abaiChatbot && typeof window.abaiChatbot.closeChatbot === 'function') {
    window.abaiChatbot.closeChatbot();
  }

  // Also hide the chatbot container (toggle button)
  const chatbotContainer = document.getElementById('chatbot-container');
  if (chatbotContainer) {
    chatbotContainer.style.display = 'none';
  }

  // Add fade-in animation
  setTimeout(() => {
    modal.classList.add('show');
  }, 10);
}

// Close profile modal
function closeProfileModal() {
  const modal = document.getElementById('profile-modal');
  if (!modal) return;

  modal.classList.remove('show');
  setTimeout(() => {
    modal.style.display = 'none';
    document.body.style.overflow = '';

    // Show chatbot again when profile modal closes
    const chatbotContainer = document.getElementById('chatbot-container');
    if (chatbotContainer) {
      chatbotContainer.style.display = 'block';
    }

    if (window.abaiChatbot && typeof window.abaiChatbot.showChatbot === 'function') {
      // Small delay to ensure smooth transition
      setTimeout(() => {
        window.abaiChatbot.showChatbot();
      }, 100);
    }
  }, 300);
}

// Show user orders
function showOrders() {
  openOrdersModal();
}

// Open orders modal
function openOrdersModal() {
  const modal = document.getElementById('orders-modal');
  if (!modal) return;

  modal.style.display = 'flex';
  document.body.style.overflow = 'hidden';

  // Hide chatbot when orders modal opens
  if (window.abaiChatbot && typeof window.abaiChatbot.closeChatbot === 'function') {
    window.abaiChatbot.closeChatbot();
  }

  // Also hide the chatbot container (toggle button)
  const chatbotContainer = document.getElementById('chatbot-container');
  if (chatbotContainer) {
    chatbotContainer.style.display = 'none';
  }

  // Add fade-in animation
  setTimeout(() => {
    modal.classList.add('show');
  }, 10);

  // Load orders
  loadUserOrders();
}

// Close orders modal
function closeOrdersModal() {
  const modal = document.getElementById('orders-modal');
  if (!modal) return;

  modal.classList.remove('show');
  setTimeout(() => {
    modal.style.display = 'none';
    document.body.style.overflow = '';

    // Show chatbot again when orders modal closes
    const chatbotContainer = document.getElementById('chatbot-container');
    if (chatbotContainer) {
      chatbotContainer.style.display = 'block';
    }

    if (window.abaiChatbot && typeof window.abaiChatbot.showChatbot === 'function') {
      // Small delay to ensure smooth transition
      setTimeout(() => {
        window.abaiChatbot.showChatbot();
      }, 100);
    }
  }, 500);
}

// Load user orders
async function loadUserOrders() {
  const loadingEl = document.getElementById('orders-loading');
  const ordersListEl = document.getElementById('orders-list');
  const emptyEl = document.getElementById('orders-empty');

  try {
    // Show loading state
    loadingEl.style.display = 'flex';
    ordersListEl.style.display = 'none';
    emptyEl.style.display = 'none';

    // Get user token
    const token = localStorage.getItem('token');
    if (!token) {
      showEmptyOrders();
      return;
    }

    // Fetch orders from API
    const response = await fetch('/api/orders', {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      throw new Error('Failed to fetch orders');
    }

    const orders = await response.json();
    
    if (orders.length === 0) {
      showEmptyOrders();
    } else {
      displayOrders(orders);
    }

  } catch (error) {
    console.error('Error loading orders:', error);
    showEmptyOrders();
  }
}

// Display orders
function displayOrders(orders) {
  const loadingEl = document.getElementById('orders-loading');
  const ordersListEl = document.getElementById('orders-list');
  const emptyEl = document.getElementById('orders-empty');

  loadingEl.style.display = 'none';
  ordersListEl.style.display = 'block';
  emptyEl.style.display = 'none';

  // Sort orders by date (newest first)
  orders.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

  // Display only the 5 most recent orders
  const recentOrders = orders.slice(0, 5);

  ordersListEl.innerHTML = recentOrders.map(order => {
    const orderDate = new Date(order.createdAt).toLocaleDateString();
    const statusClass = order.status.toLowerCase();
    const itemsText = order.items.length === 1 
      ? `${order.items[0].quantity} ${order.items[0].name || order.items[0].product?.name || 'item'}`
      : `${order.items.length} items`;

    return `
      <div class="order-item">
        <div class="order-header">
          <div>
            <div class="order-number">#${order.orderNumber || order._id.slice(-8)}</div>
            <div class="order-date">${orderDate}</div>
          </div>
          <div class="order-status ${statusClass}">${order.status}</div>
        </div>
        <div class="order-details">
          <div class="order-items">${itemsText}</div>
          <div class="order-total">Ksh ${order.totalAmount || 0}</div>
        </div>
      </div>
    `;
  }).join('');

  // Add "View All Orders" button if there are more than 5 orders
  if (orders.length > 5) {
    const viewAllBtn = document.createElement('div');
    viewAllBtn.className = 'order-item';
    viewAllBtn.style.textAlign = 'center';
    viewAllBtn.style.cursor = 'pointer';
    viewAllBtn.innerHTML = `
      <div style="color: #1976d2; font-weight: 600;">
        View All ${orders.length} Orders →
      </div>
    `;
    viewAllBtn.onclick = () => {
      closeOrdersModal();
      window.location.href = 'orders.html';
    };
    ordersListEl.appendChild(viewAllBtn);
  }
}

// Show empty orders state
function showEmptyOrders() {
  const loadingEl = document.getElementById('orders-loading');
  const ordersListEl = document.getElementById('orders-list');
  const emptyEl = document.getElementById('orders-empty');

  loadingEl.style.display = 'none';
  ordersListEl.style.display = 'none';
  emptyEl.style.display = 'flex';
}

// Logout function
function logout() {
  // Clear authentication data
  localStorage.removeItem('token');
  localStorage.removeItem('user');
  
  // Update UI
  checkAuthStatus();
  
  // Show success message
  showToast('Logged out successfully');
  
  // Close dropdown if open
  const dropdown = document.getElementById('user-dropdown');
  if (dropdown) dropdown.classList.remove('show');
}

// Initialize authentication on page load
document.addEventListener('DOMContentLoaded', function() {
  checkAuthStatus();
});

// Newsletter subscription handler
function handleNewsletterSubscribe(event) {
  event.preventDefault();

  const emailInput = document.getElementById('newsletter-email');
  const email = emailInput.value.trim();

  if (!email) {
    alert('Please enter a valid email address.');
    return;
  }

  // Simple email validation
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    alert('Please enter a valid email address.');
    return;
  }

  // Show custom subscription success modal
  showSubscriptionModal();

  // Clear the input
  emailInput.value = '';

  // Optional: You could send this to a backend API here
  // For now, it's just a frontend notification
}

// Show subscription success modal
function showSubscriptionModal() {
  const modal = document.getElementById('subscription-modal');
  if (!modal) return;

  modal.style.display = 'flex';
  document.body.style.overflow = 'hidden';

  // Hide chatbot when subscription modal opens
  if (window.abaiChatbot && typeof window.abaiChatbot.closeChatbot === 'function') {
    window.abaiChatbot.closeChatbot();
  }

  // Also hide the chatbot container (toggle button)
  const chatbotContainer = document.getElementById('chatbot-container');
  if (chatbotContainer) {
    chatbotContainer.style.display = 'none';
  }

  // Add fade-in animation
  setTimeout(() => {
    modal.classList.add('show');
  }, 10);
}

// Close subscription modal
function closeSubscriptionModal() {
  const modal = document.getElementById('subscription-modal');
  if (!modal) return;

  modal.classList.remove('show');
  setTimeout(() => {
    modal.style.display = 'none';
    document.body.style.overflow = '';

    // Show chatbot again when subscription modal closes
    const chatbotContainer = document.getElementById('chatbot-container');
    if (chatbotContainer) {
      chatbotContainer.style.display = 'block';
    }

    if (window.abaiChatbot && typeof window.abaiChatbot.showChatbot === 'function') {
      // Small delay to ensure smooth transition
      setTimeout(() => {
        window.abaiChatbot.showChatbot();
      }, 100);
    }
  }, 500);
}

// Add event listeners for subscription modal
document.addEventListener('DOMContentLoaded', function() {
  const subscriptionModal = document.getElementById('subscription-modal');
  
  if (subscriptionModal) {
    // Close modal when clicking on overlay
    subscriptionModal.addEventListener('click', function(event) {
      if (event.target === subscriptionModal) {
        closeSubscriptionModal();
      }
    });

    // Close modal with Escape key
    document.addEventListener('keydown', function(event) {
      if (event.key === 'Escape' && subscriptionModal.style.display === 'flex') {
        closeSubscriptionModal();
      }
    });
  }

  // Add event listeners for profile modal
  const profileModal = document.getElementById('profile-modal');
  
  if (profileModal) {
    // Close modal when clicking on overlay
    profileModal.addEventListener('click', function(event) {
      if (event.target === profileModal) {
        closeProfileModal();
      }
    });

    // Close modal with Escape key
    document.addEventListener('keydown', function(event) {
      if (event.key === 'Escape' && profileModal.style.display === 'flex') {
        closeProfileModal();
      }
    });
  }

  // Add event listeners for edit profile modal
  const editProfileModal = document.getElementById('edit-profile-modal');
  const editProfileForm = document.getElementById('edit-profile-form');
  
  if (editProfileModal) {
    // Close modal when clicking on overlay
    editProfileModal.addEventListener('click', function(event) {
      if (event.target === editProfileModal) {
        closeEditProfileModal();
      }
    });

    // Close modal with Escape key
    document.addEventListener('keydown', function(event) {
      if (event.key === 'Escape' && editProfileModal.style.display === 'flex') {
        closeEditProfileModal();
      }
    });
  }

  if (editProfileForm) {
    editProfileForm.addEventListener('submit', handleEditProfileSubmit);
  }

  // Add event listeners for orders modal
  const ordersModal = document.getElementById('orders-modal');
  
  if (ordersModal) {
    // Close modal when clicking on overlay
    ordersModal.addEventListener('click', function(event) {
      if (event.target === ordersModal) {
        closeOrdersModal();
      }
    });

    // Close modal with Escape key
    document.addEventListener('keydown', function(event) {
      if (event.key === 'Escape' && ordersModal.style.display === 'flex') {
        closeOrdersModal();
      }
    });
  }
});

// WhatsApp Contact Popup Functions
function openWhatsAppPopup() {
  const modal = document.getElementById('whatsapp-modal');
  if (!modal) return;
  
  modal.style.display = 'flex';
  document.body.style.overflow = 'hidden';
  
  // Hide chatbot when popup opens
  if (window.abaiChatbot && typeof window.abaiChatbot.closeChatbot === 'function') {
    window.abaiChatbot.closeChatbot();
  }
  
  // Also hide the chatbot container (toggle button)
  const chatbotContainer = document.getElementById('chatbot-container');
  if (chatbotContainer) {
    chatbotContainer.style.display = 'none';
  }
  
  // Add fade-in animation
  setTimeout(() => {
    modal.classList.add('show');
  }, 10);
}

function closeWhatsAppPopup() {
  const modal = document.getElementById('whatsapp-modal');
  if (!modal) return;
  
  modal.classList.remove('show');
  setTimeout(() => {
    modal.style.display = 'none';
    document.body.style.overflow = '';
    
    // Show chatbot again when popup closes
    const chatbotContainer = document.getElementById('chatbot-container');
    if (chatbotContainer) {
      chatbotContainer.style.display = 'block';
    }
    
    if (window.abaiChatbot && typeof window.abaiChatbot.showChatbot === 'function') {
      // Small delay to ensure smooth transition
      setTimeout(() => {
        window.abaiChatbot.showChatbot();
      }, 100);
    }
  }, 300);
}

// Close modal on overlay click or Escape key
document.addEventListener('keydown', function(e) {
  if (e.key === 'Escape') closeWhatsAppPopup();
});

document.addEventListener('mousedown', function(e) {
  const modal = document.getElementById('whatsapp-modal');
  if (!modal || modal.style.display === 'none') return;
  if (e.target === modal) closeWhatsAppPopup();
});