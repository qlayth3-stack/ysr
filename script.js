let newWorker;

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker
      .register("../sw.js")
      .then((registration) => {
        console.log("SW registered: ", registration);

        registration.addEventListener("updatefound", () => {
          newWorker = registration.installing;
          newWorker.addEventListener("statechange", () => {
            if (newWorker.state === "installed") {
              if (navigator.serviceWorker.controller) {
                const updateBar = document.getElementById("update-bar");
                if (updateBar) {
                  updateBar.style.display = "flex";
                }
              }
            }
          });
        });
      })
      .catch((registrationError) => {
        console.log("SW registration failed: ", registrationError);
      });

    let refreshing;
    navigator.serviceWorker.addEventListener("controllerchange", () => {
      if (refreshing) return;
      window.location.reload();
      refreshing = true;
    });
  });
}

document.addEventListener("DOMContentLoaded", () => {
  const btnUpdateNow = document.getElementById("btn-update-now");
  if (btnUpdateNow) {
    btnUpdateNow.addEventListener("click", () => {
      if (newWorker) {
        newWorker.postMessage({ type: "SKIP_WAITING" });
      }
    });
  }
});

function getCategoriesData() {
  const savedCategories = JSON.parse(localStorage.getItem("categories")) || [];
  return [
    {
      id: "all",
      name: "الكل",
      image:
        "https://images.unsplash.com/photo-1472851294608-062f824d29cc?auto=format&fit=crop&w=150&q=80",
      colorClass: "blue",
    },
    ...savedCategories,
  ];
}

async function syncDataWithFirebase() {
  const { doc, collection, onSnapshot } = window.firestore;
  const db = window.db;

  try {
    console.log("Listening to real-time updates from Firestore...");
    
    // 1. استماع فوري للمنتجات وتحديثها مباشرة
    onSnapshot(collection(db, "products"), (snapshot) => {
      const newProducts = snapshot.docs.map((d) => ({
        id: d.id,
        ...d.data(),
      }));
      localStorage.setItem("products", JSON.stringify(newProducts));
      products = newProducts;
      renderProducts();
    });

    // 2. استماع فوري للفئات
    onSnapshot(collection(db, "categories"), (snapshot) => {
      const newCats = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
      localStorage.setItem("categories", JSON.stringify(newCats));
      renderCategories();
    });

    // 3. استماع فوري للبنرات
    onSnapshot(doc(db, "meta", "banners"), (docSnap) => {
      let newBanners = [];
      if (docSnap.exists()) {
          newBanners = docSnap.data().data || [];
      }
      localStorage.setItem("banners", JSON.stringify(newBanners));
      initSlider();
    });

  } catch (e) {
    console.error("Firebase sync error:", e);
  }
}
window.addEventListener("firebaseReady", syncDataWithFirebase);

// تم حذف المنتجات الوهمية لتعتمد فقط على البيانات الحقيقية
let products = JSON.parse(localStorage.getItem("products")) || [];

let cartItems = [];
let activeCategory = "all";
let searchQuery = "";
let showFavoritesOnly = false;

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function getProductImages(product) {
  const images = Array.isArray(product.images) ? product.images.filter(Boolean) : [];
  if (product.image && !images.includes(product.image)) {
    images.unshift(product.image);
  }
  return images.slice(0, 3);
}

function getProductStock(product) {
  const stock = Number(product.stock);
  return Number.isFinite(stock) ? stock : null;
}

function isProductOutOfStock(product) {
  return getProductStock(product) === 0;
}

function renderCategories() {
  const list = document.getElementById("categories-list");
  if (!list) return;

  list.innerHTML = "";
  getCategoriesData().forEach((cat) => {
    const item = document.createElement("div");
    item.className = "category-item";
    if (cat.id === activeCategory) {
      item.classList.add("active");
    }
    item.onclick = () => {
      activeCategory = cat.id;
      renderCategories();
      renderProducts();
    };
    item.innerHTML = `
            <div class="cat-image-container ${cat.colorClass || "blue"}">
                <img src="${cat.image}" alt="${cat.name}" loading="lazy">
            </div>
            <span>${cat.name}</span>
        `;
    list.appendChild(item);
  });
}

function renderProducts() {
  const productsList = document.getElementById("products-list");
  if (!productsList) return;

  productsList.innerHTML = "";

  let filteredProducts =
    activeCategory === "all"
      ? products
      : products.filter((p) => p.category === activeCategory);

  if (searchQuery.trim() !== "") {
    const query = searchQuery.toLowerCase().trim();
    filteredProducts = filteredProducts.filter((p) =>
      p.name.toLowerCase().includes(query),
    );
  }

  if (showFavoritesOnly) {
    let favorites = JSON.parse(localStorage.getItem("favorites")) || [];
    filteredProducts = filteredProducts.filter((p) => favorites.includes(p.id));
  }

  if (filteredProducts.length === 0) {
    productsList.innerHTML =
      '<div style="grid-column: 1/-1; text-align: center; padding: 2rem; color: #64748b;">لا توجد منتجات مطابقة.</div>';
    return;
  }

  filteredProducts.forEach((product) => {
    const card = document.createElement("div");
    card.className = "product-card";

    // Generate stars
    let starsHTML = "";
    for (let i = 0; i < 5; i++) {
      if (i < product.rating) {
        starsHTML += `<svg width="14" height="14" viewBox="0 0 24 24" fill="#fbbf24" stroke="#fbbf24" stroke-width="2"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon></svg>`;
      } else {
        starsHTML += `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#e2e8f0" stroke-width="2"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon></svg>`;
      }
    }

    const inCart = cartItems.some((i) => i.id === product.id);
    const stock = getProductStock(product);
    const outOfStock = isProductOutOfStock(product);
    const stockText = stock === null ? "المتبقي: غير محدد" : `المتبقي: ${stock}`;
    const btnClass = outOfStock ? "btn-add-cart disabled" : inCart ? "btn-add-cart added" : "btn-add-cart";
    const btnText = outOfStock ? "غير متوفر" : inCart ? "تم التحديد" : "إضافة للسلة";
    const btnIcon = inCart
      ? `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"></polyline></svg>`
      : `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="9" cy="21" r="1.5"></circle><circle cx="20" cy="21" r="1.5"></circle><path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"></path></svg>`;

    let favorites = JSON.parse(localStorage.getItem("favorites")) || [];
    const isFavorite = favorites.includes(product.id);
    const heartColor = isFavorite ? "#ef4444" : "#94a3b8";
    const heartFill = isFavorite ? "#ef4444" : "none";

    if (outOfStock) {
      card.classList.add("out-of-stock");
    }

    card.innerHTML = `
            <div class="product-img-wrapper" style="position: relative;">
                <button class="favorite-btn" data-id="${product.id}" style="position: absolute; top: 10px; right: 10px; background: rgba(255, 255, 255, 0.9); border: none; border-radius: 50%; width: 32px; height: 32px; display: flex; align-items: center; justify-content: center; cursor: pointer; z-index: 10; box-shadow: 0 2px 5px rgba(0,0,0,0.1); transition: all 0.2s;">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="${heartFill}" stroke="${heartColor}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"></path>
                    </svg>
                </button>
                <img src="${product.image}" loading="lazy" alt="${product.name}">
                ${outOfStock ? '<div class="unavailable-overlay">غير متوفر</div>' : ""}
            </div>
            <h3 class="product-title">${product.name}</h3>
            <div class="product-price">${product.price}</div>
            <div class="product-stock">${stockText}</div>
            <div class="product-stars">${starsHTML}</div>
            <button class="${btnClass}" id="btn-add-${product.id}">
                ${btnIcon}
                ${btnText}
            </button>
        `;

    productsList.appendChild(card);
    const btn = card.querySelector(`#btn-add-${product.id}`);
    if (btn) {
      btn.disabled = outOfStock;
      btn.onclick = (e) => {
        e.stopPropagation();
        if (!outOfStock) addToCart(product.id);
      };
    }

    card.onclick = () => openProductDetails(product.id);

    const favBtn = card.querySelector(".favorite-btn");
    if (favBtn) {
      favBtn.onclick = (e) => {
        e.stopPropagation();
        toggleFavorite(product.id);
      };
    }
  });
}

function openProductDetails(productId) {
  const product = products.find((p) => p.id === productId);
  if (!product) return;

  const modal = document.getElementById("product-details-modal");
  const body = document.getElementById("product-details-body");
  if (!modal || !body) return;

  const images = getProductImages(product);
  const stock = getProductStock(product);
  const outOfStock = isProductOutOfStock(product);
  const description = product.description || "لا يوجد وصف لهذا المنتج.";
  const stockText = stock === null ? "المتبقي: غير محدد" : `المتبقي: ${stock}`;

  body.innerHTML = `
    <div class="product-details-gallery">
      ${images.map((image) => `<img src="${image}" alt="${escapeHtml(product.name)}">`).join("")}
    </div>
    <h2>${escapeHtml(product.name)}</h2>
    <div class="product-details-price">${escapeHtml(product.price)}</div>
    <div class="product-details-stock ${outOfStock ? "is-empty" : ""}">${stockText}</div>
    <p>${escapeHtml(description)}</p>
    <button class="btn-add-cart ${outOfStock ? "disabled" : ""}" id="details-add-cart-btn" ${outOfStock ? "disabled" : ""}>
      ${outOfStock ? "غير متوفر" : "إضافة للسلة"}
    </button>
  `;

  const detailsAddBtn = document.getElementById("details-add-cart-btn");
  if (detailsAddBtn && !outOfStock) {
    detailsAddBtn.onclick = () => {
      addToCart(product.id);
      modal.classList.remove("active");
    };
  }

  modal.classList.add("active");
}

function initProductDetailsModal() {
  const modal = document.getElementById("product-details-modal");
  const closeBtn = document.getElementById("close-product-details-btn");
  if (!modal) return;

  if (closeBtn) {
    closeBtn.addEventListener("click", () => modal.classList.remove("active"));
  }

  modal.addEventListener("click", (e) => {
    if (e.target === modal) modal.classList.remove("active");
  });
}

function toggleFavorite(productId) {
  let favorites = JSON.parse(localStorage.getItem("favorites")) || [];
  if (favorites.includes(productId)) {
    favorites = favorites.filter((id) => id !== productId);
  } else {
    favorites.push(productId);
  }
  localStorage.setItem("favorites", JSON.stringify(favorites));
  renderProducts();
}

function updateProductButtons() {
  products.forEach((product) => {
    const btn = document.getElementById(`btn-add-${product.id}`);
    if (btn) {
      const inCart = cartItems.some((i) => i.id === product.id);
      const outOfStock = isProductOutOfStock(product);
      if (outOfStock) {
        btn.disabled = true;
        btn.className = "btn-add-cart disabled";
        btn.innerHTML = "غير متوفر";
      } else if (inCart) {
        btn.disabled = false;
        btn.className = "btn-add-cart added";
        btn.innerHTML = `
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <polyline points="20 6 9 17 4 12"></polyline>
                    </svg>
                    تم التحديد
                `;
      } else {
        btn.disabled = false;
        btn.className = "btn-add-cart";
        btn.innerHTML = `
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <circle cx="9" cy="21" r="1.5"></circle>
                        <circle cx="20" cy="21" r="1.5"></circle>
                        <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"></path>
                    </svg>
                    إضافة للسلة
                `;
      }
    }
  });
}

function updateCartBadge() {
  const totalCount = cartItems.reduce((sum, item) => sum + item.quantity, 0);
  const badges = [
    document.getElementById("nav-cart-badge"),
    document.getElementById("top-cart-badge"),
  ];

  badges.forEach((badge) => {
    if (badge) {
      badge.innerText = totalCount;
      if (totalCount > 0) {
        badge.style.transform = "scale(1.2)";
        setTimeout(() => (badge.style.transform = "scale(1)"), 200);
      }
    }
  });
}

function addToCart(productId) {
  const product = products.find((p) => p.id === productId);
  if (!product) return;
  if (isProductOutOfStock(product)) {
    alert("هذا المنتج غير متوفر حالياً.");
    return;
  }

  const existingItemIndex = cartItems.findIndex(
    (item) => item.id === productId,
  );
  if (existingItemIndex > -1) {
    cartItems.splice(existingItemIndex, 1);
  } else {
    cartItems.push({ ...product, quantity: 1 });
  }

  updateCartBadge();
  renderCart();
  updateProductButtons();
}

function updateQuantity(productId, delta) {
  const item = cartItems.find((item) => item.id === productId);
  if (item) {
    const product = products.find((p) => p.id === productId);
    const stock = product ? getProductStock(product) : null;
    if (delta > 0 && stock !== null && item.quantity >= stock) {
      alert("لا يمكن طلب كمية أكثر من المتبقي.");
      return;
    }
    item.quantity += delta;
    if (item.quantity <= 0) {
      cartItems = cartItems.filter((i) => i.id !== productId);
    }
  }
  updateCartBadge();
  renderCart();
  updateProductButtons();
}

function renderCart() {
  const container = document.getElementById("cart-items-container");
  const subtotalEl = document.getElementById("cart-subtotal");
  const totalEl = document.getElementById("cart-total");
  const shippingEl = document.getElementById("cart-shipping");

  if (!container || !subtotalEl || !totalEl) return;

  container.innerHTML = "";

  let subtotal = 0;
  let deliveryCostStr = localStorage.getItem("deliveryCost");
  const shippingFee = deliveryCostStr ? parseInt(deliveryCostStr) : 3000;
  if (shippingEl)
    shippingEl.innerText = shippingFee.toLocaleString("en-US") + " د.ع";

  if (cartItems.length === 0) {
    container.innerHTML =
      '<div style="text-align: center; color: var(--text-muted); padding: 2rem;">السلة فارغة</div>';
  } else {
    cartItems.forEach((item) => {
      const priceNum = parseInt(item.price.replace(/[^\d]/g, ""));
      subtotal += priceNum * item.quantity;

      const itemEl = document.createElement("div");
      itemEl.className = "cart-item";
      itemEl.innerHTML = `
                <img src="${item.image}" alt="${item.name}" class="cart-item-image">
                <div class="cart-item-details">
                    <div class="cart-item-title">${item.name}</div>
                    <div class="cart-item-price">${item.price}</div>
                    <div class="cart-item-actions">
                        <div class="quantity-controls">
                            <button class="quantity-btn quantity-plus" data-id="${item.id}">+</button>
                            <span>${item.quantity}</span>
                            <button class="quantity-btn quantity-minus" data-id="${item.id}">-</button>
                        </div>
                    </div>
                </div>
            `;
      container.appendChild(itemEl);

      itemEl.querySelector(".quantity-plus").onclick = () =>
        updateQuantity(item.id, 1);
      itemEl.querySelector(".quantity-minus").onclick = () =>
        updateQuantity(item.id, -1);
    });
  }

  subtotalEl.innerText = subtotal.toLocaleString("en-US") + " د.ع";
  const total = subtotal > 0 ? subtotal + shippingFee : 0;
  totalEl.innerText = total.toLocaleString("en-US") + " د.ع";
}

function initCartModal() {
  const modal = document.getElementById("cart-modal");
  const closeBtn = document.getElementById("close-cart-btn");
  const topCartBtn = document.getElementById("top-cart-btn");
  const bottomCartBtn = document.querySelector(".cart-nav");

  const openModal = (e) => {
    if (e) e.preventDefault();
    renderCart();
    modal.classList.add("active");
  };

  if (topCartBtn) topCartBtn.addEventListener("click", openModal);
  if (bottomCartBtn) bottomCartBtn.addEventListener("click", openModal);
  if (closeBtn)
    closeBtn.addEventListener("click", () => modal.classList.remove("active"));

  // Checkout flow
  const checkoutBtn = document.getElementById("checkout-btn");
  const checkoutForm = document.getElementById("checkout-form");
  const submitOrderBtn = document.getElementById("submit-order-btn");

  // Load from local storage if available
  const nameInput = document.getElementById("checkout-name");
  const addressInput = document.getElementById("checkout-address");
  const phoneInput = document.getElementById("checkout-phone");

  if (localStorage.getItem("checkoutName")) {
    nameInput.value = localStorage.getItem("checkoutName");
  }
  if (localStorage.getItem("checkoutAddress")) {
    addressInput.value = localStorage.getItem("checkoutAddress");
  }
  if (localStorage.getItem("checkoutPhone")) {
    phoneInput.value = localStorage.getItem("checkoutPhone");
  }

  if (checkoutBtn) {
    checkoutBtn.addEventListener("click", () => {
      if (cartItems.length === 0) {
        alert("السلة فارغة!");
        return;
      }
      checkoutForm.style.display = "block";
      checkoutBtn.style.display = "none";
    });
  }

  if (submitOrderBtn) {
    submitOrderBtn.addEventListener("click", () => {
      const name = nameInput.value;
      const address = addressInput.value;
      const phone = phoneInput.value;

      if (!name || !address || !phone) {
        alert("يرجى ملء جميع معلومات التوصيل");
        return;
      }

      // Save to local storage for future reuse
      localStorage.setItem("checkoutName", name);
      localStorage.setItem("checkoutAddress", address);
      localStorage.setItem("checkoutPhone", phone);

      // Add order to pending local storage list (simulated database) & Firestore
      const newOrderInfo = {
        id: Date.now(),
        items: [...cartItems],
        date: new Date().toISOString(),
        status: "pending", // معلق
        customerName: name,
        customerAddress: address,
        customerPhone: phone,
      };

      if (window.db && window.firestore) {
        window.firestore
          .addDoc(
            window.firestore.collection(window.db, "orders"),
            newOrderInfo,
          )
          .catch((err) =>
            console.error("Error saving order to Firestore", err),
          );
      }

      const pendingOrders = JSON.parse(
        localStorage.getItem("pendingOrders") || "[]",
      );
      pendingOrders.push(newOrderInfo);
      localStorage.setItem("pendingOrders", JSON.stringify(pendingOrders));

      cartItems = [];
      updateCartBadge();
      renderCart();
      updateProductButtons();
      checkoutForm.style.display = "none";
      checkoutBtn.style.display = "block";
      modal.classList.remove("active");

      // Show success modal
      const successModal = document.getElementById("success-modal");
      if (successModal) {
        successModal.classList.add("active");
      }
    });
  }

  // Success Modal Close
  const closeSuccessBtn = document.getElementById("close-success-btn");
  if (closeSuccessBtn) {
    closeSuccessBtn.addEventListener("click", () => {
      const successModal = document.getElementById("success-modal");
      if (successModal) {
        successModal.classList.remove("active");
      }
    });
  }
}

function initSlider() {
  const track = document.getElementById("banner-track");
  const dotsContainer = document.getElementById("banner-dots");
  const slider = document.getElementById("banner-slider");
  
  if (!track || !dotsContainer) return;

  let banners = JSON.parse(localStorage.getItem("banners")) || [];

  track.innerHTML = "";
  dotsContainer.innerHTML = "";

  if (banners.length === 0) {
    if(slider) slider.style.display = "none";
    return;
  } else {
    if(slider) slider.style.display = "";
  }

  banners.forEach((bannerUrl, index) => {
    const slide = document.createElement("div");
    slide.className = "banner";
    slide.innerHTML = `<div class="banner-image-container" style="background-image: url('${bannerUrl}');"></div>`;
    track.appendChild(slide);

    const dot = document.createElement("span");
    dot.className = index === 0 ? "dot active" : "dot";
    dotsContainer.appendChild(dot);
  });

  const dots = document.querySelectorAll("#banner-dots .dot");
  const totalSlides = dots.length;
  let currentSlide = 0;

  function goToSlide(index) {
    currentSlide = index;
    track.style.transform = `translateX(${currentSlide * 100}%)`;

    dots.forEach((dot, i) => {
      if (i === currentSlide) {
        dot.classList.add("active");
      } else {
        dot.classList.remove("active");
      }
    });
  }

  if (window.sliderInterval) {
    clearInterval(window.sliderInterval);
  }

  window.sliderInterval = setInterval(() => {
    let nextSlide = (currentSlide + 1) % totalSlides;
    goToSlide(nextSlide);
  }, 5000);

  dots.forEach((dot, index) => {
    dot.addEventListener("click", () => {
      goToSlide(index);
    });
  });
}

function initTheme() {
  const themeBtn = document.getElementById("theme-toggle");
  if (!themeBtn) return;

  const moonIcon = themeBtn.querySelector(".moon-icon");
  const sunIcon = themeBtn.querySelector(".sun-icon");

  const savedTheme = localStorage.getItem("theme");
  const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;

  let isDark = savedTheme === "dark" || (!savedTheme && prefersDark);

  const applyTheme = (dark) => {
    if (dark) {
      document.documentElement.setAttribute("data-theme", "dark");
      moonIcon.style.display = "none";
      sunIcon.style.display = "block";
    } else {
      document.documentElement.removeAttribute("data-theme");
      moonIcon.style.display = "block";
      sunIcon.style.display = "none";
    }
  };

  applyTheme(isDark);

  themeBtn.addEventListener("click", () => {
    isDark = !isDark;
    localStorage.setItem("theme", isDark ? "dark" : "light");
    applyTheme(isDark);
  });
}

document.addEventListener("DOMContentLoaded", () => {
  updateCartBadge();
  renderCategories();
  renderProducts();
  initSlider();
  initTheme();
  initCartModal();
  initProductDetailsModal();

  const searchInput = document.getElementById("search-input");
  if (searchInput) {
    searchInput.addEventListener("input", (e) => {
      searchQuery = e.target.value;
      renderProducts();
    });
  }

  const navFavorites = document.getElementById("nav-favorites");
  const navHome = document.getElementById("nav-home");
  const navAccount = document.getElementById("nav-account");

  const productsListEl = document.getElementById("products-list");
  const categoriesWrapperEl = document.querySelector(".categories-wrapper");
  const bannerSliderEl = document.getElementById("banner-slider");
  const bannerDotsEl = document.getElementById("banner-dots");
  const searchRowEl = document.querySelector(".search-cart-row");
  const accountViewEl = document.getElementById("account-view");

  const toggleMainViews = (showMain) => {
    if (productsListEl) productsListEl.style.display = showMain ? "" : "none";
    if (categoriesWrapperEl)
      categoriesWrapperEl.style.display = showMain ? "" : "none";
    if (bannerSliderEl && JSON.parse(localStorage.getItem("banners")||"[]").length > 0) bannerSliderEl.style.display = showMain ? "" : "none";
    if (bannerDotsEl) bannerDotsEl.style.display = showMain ? "" : "none";
    if (searchRowEl) searchRowEl.style.display = showMain ? "" : "none";

    if (accountViewEl)
      accountViewEl.style.display = showMain ? "none" : "block";
  };

  const navItems = document.querySelectorAll(".bottom-nav .nav-item");
  navItems.forEach((nav) => {
    if (!nav.id && !nav.classList.contains("cart-nav")) {
      nav.addEventListener("click", (e) => {
        e.preventDefault();
        navItems.forEach((item) => item.classList.remove("active"));
        nav.classList.add("active");
      });
    }
  });

  if (navFavorites && navHome) {
    navFavorites.addEventListener("click", (e) => {
      e.preventDefault();
      let favorites = JSON.parse(localStorage.getItem("favorites")) || [];
      if (favorites.length === 0) {
        const overlay = document.createElement("div");
        overlay.className = "modal-overlay";
        overlay.style.display = "flex";
        overlay.style.alignItems = "center";
        overlay.style.justifyContent = "center";
        overlay.style.zIndex = "1000";

        const content = document.createElement("div");
        content.className = "success-modal-content";
        content.style.textAlign = "center";

        const title = document.createElement("h2");
        title.textContent = "تنبيه";

        const msg = document.createElement("p");
        msg.textContent = "لا توجد منتجات محفوضة";

        const btn = document.createElement("button");
        btn.className = "checkout-btn";
        btn.textContent = "موافق";
        btn.style.width = "100%";

        btn.onclick = () => {
          document.body.removeChild(overlay);
          navHome.click();
        };

        content.appendChild(title);
        content.appendChild(msg);
        content.appendChild(btn);
        overlay.appendChild(content);
        document.body.appendChild(overlay);
        return;
      }
      showFavoritesOnly = true;
      toggleMainViews(true);
      document
        .querySelectorAll(".bottom-nav .nav-item")
        .forEach((item) => item.classList.remove("active"));
      navFavorites.classList.add("active");
      renderProducts();
    });

    navHome.addEventListener("click", (e) => {
      e.preventDefault();
      showFavoritesOnly = false;
      toggleMainViews(true);
      document
        .querySelectorAll(".bottom-nav .nav-item")
        .forEach((item) => item.classList.remove("active"));
      navHome.classList.add("active");
      renderProducts();
    });

    if (navAccount) {
      navAccount.addEventListener("click", (e) => {
        e.preventDefault();
        toggleMainViews(false);
        document
          .querySelectorAll(".bottom-nav .nav-item")
          .forEach((item) => item.classList.remove("active"));
        navAccount.classList.add("active");
      });
    }
  }
});

// Profile, Settings, and Dark Mode Logic
document.addEventListener("DOMContentLoaded", () => {
  // Theme logic
  const themeToggleBtn = document.getElementById("theme-toggle-btn");
  const initTheme = () => {
    const savedTheme = localStorage.getItem("theme");
    if (savedTheme === "dark") {
      document.documentElement.setAttribute("data-theme", "dark");
      if (themeToggleBtn) themeToggleBtn.textContent = "تعطيل";
    } else {
      document.documentElement.removeAttribute("data-theme");
      if (themeToggleBtn) themeToggleBtn.textContent = "تفعيل";
    }
  };
  initTheme();

  if (themeToggleBtn) {
    themeToggleBtn.addEventListener("click", () => {
      if (document.documentElement.getAttribute("data-theme") === "dark") {
        document.documentElement.removeAttribute("data-theme");
        localStorage.setItem("theme", "light");
        themeToggleBtn.textContent = "تفعيل";
      } else {
        document.documentElement.setAttribute("data-theme", "dark");
        localStorage.setItem("theme", "dark");
        themeToggleBtn.textContent = "تعطيل";
      }
    });
  }

  // Settings Modal
  const settingsModal = document.getElementById("settings-modal");
  const btnSettings = document.getElementById("btn-account-settings");
  const closeSettingsModal = document.getElementById("close-settings-modal");

  if (btnSettings && settingsModal) {
    btnSettings.addEventListener("click", (e) => {
      e.preventDefault();
      settingsModal.style.display = "flex";
      settingsModal.style.alignItems = "center";
      settingsModal.style.justifyContent = "center";
    });
  }
  if (closeSettingsModal && settingsModal) {
    closeSettingsModal.addEventListener("click", () => {
      settingsModal.style.display = "none";
    });
  }

  // Address Modal
  const addressModal = document.getElementById("address-modal");
  const btnAddress = document.getElementById("btn-saved-addresses");
  const closeAddressModal = document.getElementById("close-address-modal");
  const addressForm = document.getElementById("address-form");

  const profileName = document.getElementById("profile-name");
  const profilePhone = document.getElementById("profile-phone");
  const profileAddress = document.getElementById("profile-address");

  if (btnAddress && addressModal) {
    btnAddress.addEventListener("click", (e) => {
      e.preventDefault();
      // Load existing data
      if (profileName)
        profileName.value = localStorage.getItem("checkoutName") || "";
      if (profilePhone)
        profilePhone.value = localStorage.getItem("checkoutPhone") || "";
      if (profileAddress)
        profileAddress.value = localStorage.getItem("checkoutAddress") || "";

      addressModal.style.display = "flex";
      addressModal.style.alignItems = "center";
      addressModal.style.justifyContent = "center";
    });
  }

  if (closeAddressModal && addressModal) {
    closeAddressModal.addEventListener("click", () => {
      addressModal.style.display = "none";
    });
  }

  if (addressForm) {
    addressForm.addEventListener("submit", (e) => {
      e.preventDefault();
      if (profileName) localStorage.setItem("checkoutName", profileName.value);
      if (profilePhone)
        localStorage.setItem("checkoutPhone", profilePhone.value);
      if (profileAddress)
        localStorage.setItem("checkoutAddress", profileAddress.value);

      // Update checkout form if it's already rendered
      const checkoutName = document.getElementById("checkout-name");
      const checkoutPhone = document.getElementById("checkout-phone");
      const checkoutAddress = document.getElementById("checkout-address");
      if (checkoutName && profileName) checkoutName.value = profileName.value;
      if (checkoutPhone && profilePhone)
        checkoutPhone.value = profilePhone.value;
      if (checkoutAddress && profileAddress)
        checkoutAddress.value = profileAddress.value;

      alert("تم حفظ العناوين بنجاح!");
      addressModal.style.display = "none";
    });
  }

  // Logout
  const btnLogout = document.getElementById("btn-logout");
  const navHome = document.getElementById("nav-home");
  if (btnLogout) {
    btnLogout.addEventListener("click", () => {
      // Clear profile data (simulating logout)
      localStorage.removeItem("checkoutName");
      localStorage.removeItem("checkoutPhone");
      localStorage.removeItem("checkoutAddress");

      // Clear inputs
      if (profileName) profileName.value = "";
      if (profilePhone) profilePhone.value = "";
      if (profileAddress) profileAddress.value = "";

      const checkoutName = document.getElementById("checkout-name");
      const checkoutPhone = document.getElementById("checkout-phone");
      const checkoutAddress = document.getElementById("checkout-address");
      if (checkoutName) checkoutName.value = "";
      if (checkoutPhone) checkoutPhone.value = "";
      if (checkoutAddress) checkoutAddress.value = "";

      // Reload the page to clear app state and show login screen
      window.location.reload();
    });
  }

  // PWA Install Logic
  let deferredPrompt;
  const installModal = document.getElementById("install-modal");
  const btnInstallApp = document.getElementById("btn-install-app");
  const btnSkipInstall = document.getElementById("btn-skip-install");

  window.addEventListener("beforeinstallprompt", (e) => {
    e.preventDefault();
    deferredPrompt = e;
    if (installModal && !localStorage.getItem("pwaSkipped")) {
      installModal.style.display = "flex";
      installModal.style.alignItems = "center";
      installModal.style.justifyContent = "center";
    }
  });

  if (btnInstallApp) {
    btnInstallApp.addEventListener("click", async () => {
      if (installModal) installModal.style.display = "none";
      if (deferredPrompt) {
        deferredPrompt.prompt();
        const { outcome } = await deferredPrompt.userChoice;
        deferredPrompt = null;
      }
    });
  }

  if (btnSkipInstall) {
    btnSkipInstall.addEventListener("click", () => {
      if (installModal) installModal.style.display = "none";
      localStorage.setItem("pwaSkipped", "true");
    });
  }

  // Login Modal Handling
  const loginModal = document.getElementById("login-modal");
  const loginForm = document.getElementById("login-form");

  if (
    !localStorage.getItem("checkoutName") &&
    !localStorage.getItem("checkoutPhone")
  ) {
    if (loginModal) {
      loginModal.style.display = "flex";
    }
  }

  if (loginForm) {
    loginForm.addEventListener("submit", (e) => {
      e.preventDefault();
      const loginName = document.getElementById("login-name").value;
      const loginAddress = document.getElementById("login-address").value;
      const loginPhone = document.getElementById("login-phone").value;

      if (loginName && loginAddress && loginPhone) {
        localStorage.setItem("checkoutName", loginName);
        localStorage.setItem("checkoutAddress", loginAddress);
        localStorage.setItem("checkoutPhone", loginPhone);

        if (loginModal) {
          loginModal.style.display = "none";
        }

        if (profileName) profileName.value = loginName;
        if (profileAddress) profileAddress.value = loginAddress;
        if (profilePhone) profilePhone.value = loginPhone;

        const checkoutName = document.getElementById("checkout-name");
        const checkoutPhone = document.getElementById("checkout-phone");
        const checkoutAddress = document.getElementById("checkout-address");
        if (checkoutName) checkoutName.value = loginName;
        if (checkoutPhone) checkoutPhone.value = loginPhone;
        if (checkoutAddress) checkoutAddress.value = loginAddress;
      }
    });
  }
});
