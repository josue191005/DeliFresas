
/* --- STATE --- */
let currentStep = 0;
let selection = { cup: null, liquids: [], creams: [], fruits: [], toppings: [] };
let cart = [];
let staticSelections = {};
let tempConfig = {}; // Para el modal de configuración avanzada

/* --- CATÁLOGO ADMINISTRADO POR VCI --- */
let managedCatalog = [];
const normalizeCatalogName = value => value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().toLowerCase();

function catalogProduct(name) {
    const target = normalizeCatalogName(name);
    return managedCatalog.find(item => {
        const current = normalizeCatalogName(item.name || '');
        return current === target || target.startsWith(current) || current.startsWith(target);
    });
}

function priceFor(productName, variantName, fallback) {
    const product = catalogProduct(productName);
    if (!product) return Number(fallback);
    const targetVariant = normalizeCatalogName(variantName || '');
    const variant = (product.variants || []).find(item => normalizeCatalogName(item.name || '') === targetVariant);
    return Number(variant?.price ?? product.price ?? fallback);
}

function managedImage(productName) {
    return catalogProduct(productName)?.images?.[0]?.url || '';
}

async function loadManagedCatalog() {
    const apiBase = location.hostname.endsWith('vci-agencia.online') ? '' : 'https://www.vci-agencia.online';
    try {
        const response = await fetch(apiBase + '/api/public/restaurant-catalog?slug=deli-fresas', { mode: 'cors' });
        if (!response.ok) return;
        const payload = await response.json();
        if (Array.isArray(payload.items)) managedCatalog = payload.items;
    } catch { /* El catálogo local sigue disponible si la API está temporalmente fuera. */ }
}

function hydrateManagedCatalog() {
    cups.forEach(cup => {
        const product = catalogProduct(cup.name);
        if (product) {
            cup.price = Number(product.price);
            cup.img = product.images?.[0]?.url || cup.img;
        }
    });
    const sectionProducts = {
        frapes: 'Frapé Clásico', jugos: 'Jugo Clásico', donas: 'Mini Donitas',
        crepas: 'Crepa Clásica', waffles: 'Waffle Clásico', helados: 'Helado Soft'
    };
    Object.entries(sectionProducts).forEach(([sectionId, productName]) => {
        const image = managedImage(productName);
        const node = document.querySelector('#' + sectionId + ' .main-product-img img');
        if (image && node) node.src = image;
    });
    document.querySelectorAll('.variant-block').forEach(block => {
        const name = block.querySelector('.variant-title')?.textContent?.trim();
        const product = name ? catalogProduct(name) : null;
        const price = block.querySelector('.variant-price');
        if (product && price) price.textContent = (product.variants?.length ? 'Desde ' : '') + 'S/ ' + Number(product.price).toFixed(2);
    });
    document.querySelectorAll('.static-card').forEach(card => {
        const name = card.querySelector('h3')?.textContent?.trim();
        const product = name ? catalogProduct(name) : null;
        if (!product) return;
        const price = card.querySelector('.static-price-tag');
        const image = card.querySelector('img');
        if (price) price.textContent = (product.variants?.length ? 'Desde ' : '') + 'S/ ' + Number(product.price).toFixed(2);
        if (image && product.images?.[0]?.url) image.src = product.images[0].url;
    });
}

/* --- INIT --- */
async function init() {
    await loadManagedCatalog();
    hydrateManagedCatalog();
    // Render Cups
    document.getElementById('grid-cups').innerHTML = cups.map(c => `
        <div class="option-card" onclick="selectCup(${c.id})">
            ${c.id === 1
                /* Vaso Chiky: Tamaño normal */
                ? `<img loading="lazy" decoding="async" src="${c.img}" class="option-img" style="object-fit: cover;">`

                : (c.id === 4
                    /* Vaso Grande: Aumentado un 10% (scale 1.1) */
                    ? `<img loading="lazy" decoding="async" src="${c.img}" class="option-img" style="object-fit: cover; transform: scale(1.15);">`

                    /* Vasos Pequeño y Mediano: Aumentados un 5% */
                    : `<img loading="lazy" decoding="async" src="${c.img}" class="option-img" style="object-fit: cover; transform: scale(1.07);">`
                )
            }
            <div class="option-details">
                <span class="option-name">${c.name}</span>
                <span class="option-price">S/ ${c.price.toFixed(2)}</span>
            </div>
        </div>
    `).join('');

    // Render Grids Genericos
    renderGrid('grid-liquids', liquids, 'liquids');
    renderGrid('grid-creams', creams, 'creams');
    renderGrid('grid-fruits', fruits, 'fruits');
    renderGrid('grid-toppings', toppings, 'toppings');

    // Iniciar Carrusel de Clientes en Móvil
    startClientCarousel();
}

function renderGrid(elementId, items, category) {
    document.getElementById(elementId).innerHTML = items.map(item => `
        <div class="option-card" onclick="toggleSelection('${category}', '${item.name}')" data-cat="${category}" data-name="${item.name}">
            ${item.img ? `<img loading="lazy" decoding="async" src="${item.img}" class="option-img">` : '<div style="height:100px; background:#eee; display:flex; align-items:center; justify-content:center; font-size:0.7rem; color:#999">FOTO</div>'}
            <div class="option-details"><span class="option-name">${item.name}</span></div>
        </div>
    `).join('');
}

/* --- NAVIGATION BUILDER --- */
function changeStep(newStepIndex) {
    const currentEl = document.getElementById(`step-${currentStep}`);
    const nextEl = document.getElementById(`step-${newStepIndex}`);

    if (currentStep === 0 && !selection.cup && newStepIndex > 0) {
        alert("Por favor selecciona un vaso primero.");
        return;
    }

    currentEl.classList.add('fade-out');
    setTimeout(() => {
        currentEl.classList.remove('active', 'fade-out');
        document.getElementById('catalogo').scrollIntoView({behavior: 'smooth'});
        nextEl.classList.add('active');
        currentStep = newStepIndex;
    }, 400);
}

function resetBuilder() {
    selection = { cup: null, liquids: [], creams: [], fruits: [], toppings: [] };
    document.querySelectorAll('.option-card').forEach(el => el.classList.remove('selected'));
    changeStep(0);
}

/* --- LOGIC SELECTION BUILDER --- */
function selectCup(id) {
    selection.cup = cups.find(c => c.id === id);

    document.getElementById('jelly-info-text').innerText = `Elige hasta ${selection.cup.limits.jelly} jaleas`;
    document.getElementById('cream-info-text').innerText = `Elige hasta ${selection.cup.limits.cream} cremas`;
    document.getElementById('fruit-info-text').innerText = `Elige hasta ${selection.cup.limits.fruit} frutas`;
    document.getElementById('toppings-info-text').innerText = `Elige hasta ${selection.cup.limits.topping} toppings`;

    changeStep(1);
}

function toggleSelection(category, name) {
    if (!selection.cup) return;

    let limitKey = '';
    if (category === 'liquids') limitKey = 'jelly';
    else if (category === 'creams') limitKey = 'cream';
    else if (category === 'fruits') limitKey = 'fruit';
    else if (category === 'toppings') limitKey = 'topping';

    const limit = selection.cup.limits[limitKey];
    const array = selection[category];
    const el = document.querySelector(`.option-card[data-cat="${category}"][data-name="${name}"]`);

    if (array.includes(name)) {
        const index = array.indexOf(name);
        if (index > -1) array.splice(index, 1);
        el.classList.remove('selected');
    } else {
        if (array.length >= limit) {
            const removed = array.shift();
            const removedEl = document.querySelector(`.option-card[data-cat="${category}"][data-name="${removed}"]`);
            if(removedEl) removedEl.classList.remove('selected');
        }
        array.push(name);
        el.classList.add('selected');
    }
}

/* --- STATIC CATALOG LOGIC (CHIPS) --- */
function selectStaticOption(blockId, optionName, price, btnElement) {
    // Guardar selección
    staticSelections[blockId] = { name: optionName, price: price };

    // Actualizar visualmente los botones dentro del bloque
    const container = document.getElementById(blockId).querySelector('.chip-container');
    const buttons = container.querySelectorAll('.chip-btn');
    buttons.forEach(btn => btn.classList.remove('selected'));
    btnElement.classList.add('selected');

    // Actualizar precio visual si es necesario
    const priceTag = document.getElementById(`price-${blockId}`);
    if(priceTag) {
        priceTag.innerText = `S/ ${price.toFixed(2)}`;
    }
}

function addStaticToCartWithValidation(productName, defaultPrice, blockId) {
    // Verificar si se seleccionó una opción
    if (!staticSelections[blockId]) {
        const btn = document.querySelector(`#${blockId} .btn-primary`);
        btn.classList.add('shake-btn');
        setTimeout(() => btn.classList.remove('shake-btn'), 500);
        if(navigator.vibrate) navigator.vibrate(200);
        alert("⚠️ Por favor, selecciona un sabor u opción antes de agregar.");
        return;
    }

    const selected = staticSelections[blockId];

    cart.push({
        name: `${productName} - ${selected.name}`,
        price: selected.price, // Usar precio seleccionado
        details: null,
        cartId: Date.now()
    });

    updateCartBar();
    renderCartList();
    openCartModal();
}

function addSimpleStaticToCart(name, price) {
    cart.push({
        name: name,
        price: price,
        details: null,
        cartId: Date.now()
    });
    updateCartBar();
    renderCartList();
    openCartModal();
}

/* --- COMPLEX CONFIG MODAL (CREPES/WAFFLES/DONUTS) --- */
function openConfigModal(productName, variantName, price) {
    price = priceFor(productName, variantName, price);
    tempConfig = {
        productName: productName,
        variant: variantName,
        basePrice: price,
        price: price,
        base: [],
        fruits: [],
        iceCream: [],
        toppings: [],
        liquids: [], // Para donitas
        extraCream: false // Para donitas
    };

    document.getElementById('config-modal-title').innerText = `${productName} - ${variantName}`;
    document.getElementById('config-modal-subtitle').innerText = `Precio: S/ ${price.toFixed(2)}`;

    let html = '';

    // --- LÓGICA PARA DONITAS ---
    if(productName.includes("Donitas")) {
        // Limite Jaleas
        let jellyLimit = 2;
        if(variantName.includes("Grande")) jellyLimit = 3;

        html += `
        <div class="config-section">
            <span class="config-title">Elige Jaleas (${jellyLimit}):</span>
            <div class="chip-container">
                ${liquids.map(l => `<button class="chip-btn" onclick="toggleConfig('liquids', '${l.name}', ${jellyLimit}, this)">${l.name}</button>`).join('')}
            </div>
        </div>`;

        // Limite Toppings
        let toppingLimit = 2;
        if(variantName.includes("Mediano")) toppingLimit = 3;
        if(variantName.includes("Grande")) toppingLimit = 4;

        html += `
        <div class="config-section">
            <span class="config-title">Elige Toppings (${toppingLimit}):</span>
            <div class="chip-container">
                ${toppings.map(t => `<button class="chip-btn" onclick="toggleConfig('toppings', '${t.name}', ${toppingLimit}, this)">${t.name}</button>`).join('')}
            </div>
        </div>`;

        // Botón Extra Crema
        html += `
        <div class="config-section" style="border-top:1px dashed #eee; padding-top:10px;">
            <button class="chip-btn" id="btn-extra-cream" onclick="toggleExtraCream(this)" style="width:100%; text-align:center; font-weight:bold;">
                + Agregar Crema Adicional (S/ 2.00)
            </button>
        </div>`;

    } else {
        // --- LÓGICA PARA CREPAS Y WAFFLES ---

        // 1. BASE (Siempre para Clásica, implícito en Nutella)
        if(productName.includes("Clásic")) {
            html += `
            <div class="config-section">
                <span class="config-title">Elige Base (1):</span>
                <div class="chip-container">
                    <button class="chip-btn" onclick="toggleConfig('base', 'Fosh', 1, this)">Fosh</button>
                    <button class="chip-btn" onclick="toggleConfig('base', 'Manjar', 1, this)">Manjar</button>
                </div>
            </div>`;
        }

        // 2. FRUTAS (Depende de variante)
        let fruitLimit = variantName.includes("1 Fruta") ? 1 : 2;
        html += `
        <div class="config-section">
            <span class="config-title">Elige Fruta(s) (${fruitLimit}):</span>
            <div class="chip-container">
                ${fruits.map(f => `<button class="chip-btn" onclick="toggleConfig('fruits', '${f.name}', ${fruitLimit}, this)">${f.name}</button>`).join('')}
            </div>
        </div>`;

        // 3. HELADO Y TOPPING (Solo si es FULL o Waffles avanzados)
        if(variantName.includes("Full") || (productName.includes("Waffle") && variantName.includes("Full"))) {
            html += `
            <div class="config-section">
                <span class="config-title">Elige Helado/Crema (1):</span>
                <div class="chip-container">
                    <button class="chip-btn" onclick="toggleConfig('iceCream', 'Vainilla', 1, this)">Vainilla</button>
                    <button class="chip-btn" onclick="toggleConfig('iceCream', 'Chocolate', 1, this)">Chocolate</button>
                    <button class="chip-btn" onclick="toggleConfig('iceCream', 'Mixto', 1, this)">Mixto</button>
                </div>
            </div>`;
        }

        // 4. TOPPINGS (Si corresponde)
        // Lógica: Waffles Full lleva 2, Crepas Full lleva 1, Clásicas llevan 1 (si es waffle) o 0
        let toppingLimit = 0;
        if(variantName.includes("Full") && productName.includes("Waffle")) toppingLimit = 2;
        else if(variantName.includes("Full") || productName.includes("Waffle")) toppingLimit = 1;

        if(toppingLimit > 0) {
            html += `
            <div class="config-section">
                <span class="config-title">Elige Topping(s) (${toppingLimit}):</span>
                <div class="chip-container">
                    ${toppings.map(t => `<button class="chip-btn" onclick="toggleConfig('toppings', '${t.name}', ${toppingLimit}, this)">${t.name}</button>`).join('')}
                </div>
            </div>`;
        }
    }

    document.getElementById('config-form-container').innerHTML = html;
    document.getElementById('configModal').classList.add('open');
}

function toggleConfig(type, value, limit, btn) {
    const arr = tempConfig[type];
    if(arr.includes(value)) {
        arr.splice(arr.indexOf(value), 1);
        btn.classList.remove('selected');
    } else {
        if(arr.length >= limit) {
            // FIFO logic visually
            const btns = btn.parentNode.querySelectorAll('.chip-btn');
            const firstVal = arr.shift();
            // Buscar el boton visual que tiene ese texto y quitar selected
            btns.forEach(b => { if(b.innerText === firstVal) b.classList.remove('selected'); });
        }
        arr.push(value);
        btn.classList.add('selected');
    }
}

function toggleExtraCream(btn) {
    tempConfig.extraCream = !tempConfig.extraCream;
    if(tempConfig.extraCream) {
        btn.classList.add('selected');
        tempConfig.price = tempConfig.basePrice + 2;
    } else {
        btn.classList.remove('selected');
        tempConfig.price = tempConfig.basePrice;
    }
    document.getElementById('config-modal-subtitle').innerText = `Precio: S/ ${tempConfig.price.toFixed(2)}`;
}

function closeConfigModal() { document.getElementById('configModal').classList.remove('open'); }

function finishConfigAndAdd() {
    // Validaciones básicas
    if(tempConfig.productName.includes("Clásic") && !tempConfig.productName.includes("Waffle") && tempConfig.base.length === 0) {
        // Excepcion para donitas que no tienen base, ni waffles que ya tienen
        if(!tempConfig.productName.includes("Donitas")) {
            alert("Elige una base"); return;
        }
    }

    // Construir descripcion
    let detailsText = "";
    if(tempConfig.base.length) detailsText += `Base: ${tempConfig.base.join(', ')} | `;
    if(tempConfig.liquids.length) detailsText += `Jaleas: ${tempConfig.liquids.join(', ')} | `;
    if(tempConfig.fruits.length) detailsText += `Fruta: ${tempConfig.fruits.join(', ')} | `;
    if(tempConfig.iceCream.length) detailsText += `Helado: ${tempConfig.iceCream.join(', ')} | `;
    if(tempConfig.toppings.length) detailsText += `Toppings: ${tempConfig.toppings.join(', ')}`;
    if(tempConfig.extraCream) detailsText += ` | + CREMA ADICIONAL`;

    cart.push({
        name: `${tempConfig.productName} (${tempConfig.variant})`,
        price: tempConfig.price,
        details: { isConfig: true, text: detailsText },
        cartId: Date.now()
    });

    closeConfigModal();
    updateCartBar();
    renderCartList();
    openCartModal();
}

/* --- CART LOGIC --- */
function addToCart() {
    cart.push({
        name: selection.cup.name,
        price: selection.cup.price,
        details: JSON.parse(JSON.stringify(selection)),
        cartId: Date.now()
    });
    updateCartBar();
    resetBuilder();
    renderCartList();
    openCartModal();
}

function updateCartBar() {
    const total = cart.reduce((sum, item) => sum + item.price, 0);
    document.getElementById('items-count').innerText = `${cart.length} items`;
    document.getElementById('total-price').innerText = `S/ ${total.toFixed(2)}`;
}

function renderCartList() {
    const container = document.getElementById('cart-items-container');
    if (cart.length === 0) {
        container.innerHTML = "<p style='text-align:center; color:#999'>Tu carrito está vacío.</p>";
        return;
    }
    container.innerHTML = cart.map(item => {
        let desc = "";
        if(item.details && !item.details.isConfig) {
            desc = `
                <div style="font-size:0.8rem; color:#666; margin-top:5px;">
                    Jaleas: ${item.details.liquids.join(', ') || '-'} <br>
                    Cremas: ${item.details.creams.join(', ') || '-'} <br>
                    Frutas: ${item.details.fruits.join(', ') || '-'} <br>
                    Toppings: ${item.details.toppings.join(', ') || 'Ninguno'}
                </div>`;
        } else if (item.details && item.details.isConfig) {
            desc = `<div style="font-size:0.8rem; color:#666; margin-top:5px;">${item.details.text}</div>`;
        } else {
            desc = `<div style="font-size:0.8rem; color:#999; margin-top:5px;">Opción seleccionada</div>`;
        }

        return `
        <div style="border-bottom:1px solid #eee; padding:10px 0; display:flex; justify-content:space-between; align-items:center;">
            <div style="max-width: 85%;">
                <strong>${item.name}</strong> <span style="color:var(--primary-color)">S/ ${item.price.toFixed(2)}</span>
                ${desc}
            </div>
            <i class="fa-solid fa-trash" style="color:red; cursor:pointer;" onclick="removeFromCart(${item.cartId})"></i>
        </div>`;
    }).join('');
}

function removeFromCart(id) {
    cart = cart.filter(x => x.cartId !== id);
    updateCartBar();
    renderCartList();
}

function openCartModal() { renderCartList(); document.getElementById('cartModal').classList.add('open'); }
function closeCartModal() { document.getElementById('cartModal').classList.remove('open'); }

function checkoutWhatsApp() {
    if (cart.length === 0) return;
    const phone = "51920080186";
    let msg = "Hola, D'Eli Fresa. Quisiera realizar este pedido:\n\n";
    let total = 0;
    cart.forEach((item) => {
        total += item.price;
        let details = '';
        if(item.details && !item.details.isConfig) {
            details = [
                `Jaleas: ${item.details.liquids.join(', ') || '-'}`,
                `Cremas: ${item.details.creams.join(', ') || '-'}`,
                `Frutas: ${item.details.fruits.join(', ') || '-'}`,
                `Toppings: ${item.details.toppings.join(', ') || '-'}`
            ].join('; ');
        } else if (item.details && item.details.isConfig) {
            details = item.details.text;
        }
        msg += `- 1 × ${item.name} — S/ ${Number(item.price).toFixed(2)}${details ? ' | ' + details : ''}\n`;
    });
    msg += `\nTotal: S/ ${total.toFixed(2)}`;
    window.open(`https://wa.me/${phone}?text=${encodeURIComponent(msg)}`, '_blank');
}

function toggleMenu() { document.getElementById('navLinks').classList.toggle('active'); }

// Función para el carrusel automático en móvil
function startClientCarousel() {
    const carousel = document.getElementById('clientsCarousel');
    if (window.innerWidth > 768) return; // Solo en móvil

    setInterval(() => {
        const scrollAmount = carousel.offsetWidth;
        const maxScroll = carousel.scrollWidth - carousel.clientWidth;

        if (carousel.scrollLeft + scrollAmount >= maxScroll) {
            carousel.scrollTo({ left: 0, behavior: 'smooth' });
        } else {
            carousel.scrollBy({ left: scrollAmount, behavior: 'smooth' });
        }
    }, 2500); // Cambia cada 2.5 segundos
}

init();

