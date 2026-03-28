const STORAGE_KEY = "tindahan-tracker-state-v1";
const currencyFormatter = new Intl.NumberFormat("en-PH", {
  style: "currency",
  currency: "PHP",
});
const numberFormatter = new Intl.NumberFormat("en-PH", {
  maximumFractionDigits: 2,
});
const dateTimeFormatter = new Intl.DateTimeFormat("en-PH", {
  dateStyle: "medium",
  timeStyle: "short",
});
const dayFormatter = new Intl.DateTimeFormat("en-PH", {
  weekday: "long",
  month: "long",
  day: "numeric",
  year: "numeric",
});

let state = loadState();
const filters = {
  search: "",
  category: "all",
  stock: "all",
};

let feedbackTimer;

const elements = {
  todayLabel: document.querySelector("#today-label"),
  feedbackMessage: document.querySelector("#feedback-message"),
  totalSkus: document.querySelector("#total-skus"),
  totalUnitsFoot: document.querySelector("#total-units-foot"),
  inventoryValue: document.querySelector("#inventory-value"),
  stockValueFoot: document.querySelector("#stock-value-foot"),
  todaySales: document.querySelector("#today-sales"),
  todaySalesFoot: document.querySelector("#today-sales-foot"),
  lowStockCount: document.querySelector("#low-stock-count"),
  lowStockFoot: document.querySelector("#low-stock-foot"),
  inventorySummaryText: document.querySelector("#inventory-summary-text"),
  inventoryValueNote: document.querySelector("#inventory-value-note"),
  searchInput: document.querySelector("#search-input"),
  categoryFilter: document.querySelector("#category-filter"),
  stockFilter: document.querySelector("#stock-filter"),
  inventoryBody: document.querySelector("#inventory-body"),
  productFormTitle: document.querySelector("#product-form-title"),
  productForm: document.querySelector("#product-form"),
  productId: document.querySelector("#product-id"),
  productName: document.querySelector("#product-name"),
  productCategory: document.querySelector("#product-category"),
  productUnit: document.querySelector("#product-unit"),
  productPrice: document.querySelector("#product-price"),
  productStock: document.querySelector("#product-stock"),
  productReorder: document.querySelector("#product-reorder"),
  productSku: document.querySelector("#product-sku"),
  productSubmit: document.querySelector("#product-submit"),
  productClear: document.querySelector("#product-clear"),
  saleForm: document.querySelector("#sale-form"),
  saleProduct: document.querySelector("#sale-product"),
  saleQuantity: document.querySelector("#sale-quantity"),
  saleNote: document.querySelector("#sale-note"),
  salePreview: document.querySelector("#sale-preview"),
  restockForm: document.querySelector("#restock-form"),
  restockProduct: document.querySelector("#restock-product"),
  restockQuantity: document.querySelector("#restock-quantity"),
  restockNote: document.querySelector("#restock-note"),
  restockPreview: document.querySelector("#restock-preview"),
  reorderBoard: document.querySelector("#reorder-board"),
  hotSellers: document.querySelector("#hot-sellers"),
  categoryMix: document.querySelector("#category-mix"),
  recentActivity: document.querySelector("#recent-activity"),
  exportData: document.querySelector("#export-data"),
  importTrigger: document.querySelector("#import-trigger"),
  importFile: document.querySelector("#import-file"),
  resetDemo: document.querySelector("#reset-demo"),
};

setupEventListeners();
renderAll();

function setupEventListeners() {
  elements.searchInput.addEventListener("input", (event) => {
    filters.search = event.target.value.trim().toLowerCase();
    renderInventory();
  });

  elements.categoryFilter.addEventListener("change", (event) => {
    filters.category = event.target.value;
    renderInventory();
  });

  elements.stockFilter.addEventListener("change", (event) => {
    filters.stock = event.target.value;
    renderInventory();
  });

  elements.productForm.addEventListener("submit", handleProductSubmit);
  elements.productClear.addEventListener("click", resetProductForm);
  elements.saleForm.addEventListener("submit", handleSaleSubmit);
  elements.restockForm.addEventListener("submit", handleRestockSubmit);

  elements.saleProduct.addEventListener("change", updateSalePreview);
  elements.saleQuantity.addEventListener("input", updateSalePreview);
  elements.restockProduct.addEventListener("change", updateRestockPreview);
  elements.restockQuantity.addEventListener("input", updateRestockPreview);

  elements.inventoryBody.addEventListener("click", handleInventoryActions);
  elements.reorderBoard.addEventListener("click", handleReorderActions);

  elements.exportData.addEventListener("click", exportState);
  elements.importTrigger.addEventListener("click", () => elements.importFile.click());
  elements.importFile.addEventListener("change", importStateFromFile);
  elements.resetDemo.addEventListener("click", resetToDemoState);
}

function loadState() {
  const saved = localStorage.getItem(STORAGE_KEY);

  if (!saved) {
    return buildDefaultState();
  }

  try {
    return normalizeState(JSON.parse(saved));
  } catch (error) {
    console.warn("Unable to parse saved state. Loading demo data.", error);
    return buildDefaultState();
  }
}

function buildDefaultState() {
  const products = [
    buildProduct({
      id: "prod-sardines",
      sku: "CG-001",
      name: "Mega Sardines 155g",
      category: "Canned Goods",
      unit: "can",
      price: 27.5,
      stock: 36,
      reorderLevel: 15,
      minutesAgo: 180,
    }),
    buildProduct({
      id: "prod-noodles",
      sku: "PN-012",
      name: "Lucky Me Pancit Canton",
      category: "Noodles",
      unit: "pack",
      price: 18,
      stock: 52,
      reorderLevel: 20,
      minutesAgo: 140,
    }),
    buildProduct({
      id: "prod-rice",
      sku: "ST-101",
      name: "Premium Rice",
      category: "Staples",
      unit: "kg",
      price: 56,
      stock: 24,
      reorderLevel: 10,
      minutesAgo: 280,
    }),
    buildProduct({
      id: "prod-coffee",
      sku: "BV-018",
      name: "3-in-1 Coffee Mix",
      category: "Beverages",
      unit: "sachet",
      price: 14,
      stock: 64,
      reorderLevel: 24,
      minutesAgo: 50,
    }),
    buildProduct({
      id: "prod-shampoo",
      sku: "PC-032",
      name: "Shampoo Sachet",
      category: "Personal Care",
      unit: "sachet",
      price: 8,
      stock: 18,
      reorderLevel: 22,
      minutesAgo: 24,
    }),
    buildProduct({
      id: "prod-softdrinks",
      sku: "BV-026",
      name: "Soft Drinks 1.5L",
      category: "Beverages",
      unit: "bottle",
      price: 72,
      stock: 12,
      reorderLevel: 8,
      minutesAgo: 95,
    }),
    buildProduct({
      id: "prod-eggs",
      sku: "FR-004",
      name: "Fresh Eggs",
      category: "Fresh Goods",
      unit: "piece",
      price: 9,
      stock: 30,
      reorderLevel: 24,
      minutesAgo: 18,
    }),
  ];

  const transactions = [
    buildTransaction("sale", products[3], 6, "Morning coffee rush", 135),
    buildTransaction("sale", products[6], 12, "Breakfast buyers", 75),
    buildTransaction("sale", products[0], 4, "Lunch items", 55),
    buildTransaction("restock", products[4], 20, "Weekly supplier refill", 26 * 60),
    buildTransaction("restock", products[1], 24, "Added noodle packs", 14 * 60),
  ];

  const activity = [
    buildActivity("snapshot", "Demo sari-sari store loaded and ready to use.", null, 5),
    buildActivity("sale", "Logged sale for 6 sachet of 3-in-1 Coffee Mix.", products[3], 135),
    buildActivity("sale", "Logged sale for 12 piece of Fresh Eggs.", products[6], 75),
    buildActivity("restock", "Restocked 20 sachet of Shampoo Sachet.", products[4], 26 * 60),
  ];

  return {
    products,
    transactions,
    activity,
  };
}

function buildProduct(product) {
  return {
    id: product.id || uid("product"),
    sku: `${product.sku || ""}`.trim(),
    name: `${product.name || ""}`.trim(),
    category: `${product.category || "General"}`.trim(),
    unit: `${product.unit || "pc"}`.trim(),
    price: roundNumber(product.price),
    stock: roundNumber(product.stock),
    reorderLevel: roundNumber(product.reorderLevel),
    updatedAt: minutesAgoToIso(product.minutesAgo || 0),
  };
}

function buildTransaction(type, product, quantity, note, minutesAgo) {
  return {
    id: uid("txn"),
    type,
    productId: product.id,
    productName: product.name,
    quantity: roundNumber(quantity),
    unit: product.unit,
    unitPrice: roundNumber(product.price),
    total: roundMoney(quantity * product.price),
    note: `${note || ""}`.trim(),
    occurredAt: minutesAgoToIso(minutesAgo),
  };
}

function buildActivity(kind, message, product, minutesAgo) {
  return {
    id: uid("activity"),
    kind,
    message: `${message || ""}`.trim(),
    productId: product?.id || "",
    productName: product?.name || "",
    occurredAt: minutesAgoToIso(minutesAgo || 0),
  };
}

function minutesAgoToIso(minutesAgo) {
  return new Date(Date.now() - minutesAgo * 60 * 1000).toISOString();
}

function normalizeState(input) {
  return {
    products: Array.isArray(input?.products)
      ? input.products.map(normalizeProduct).filter(Boolean)
      : [],
    transactions: Array.isArray(input?.transactions)
      ? input.transactions.map(normalizeTransaction).filter(Boolean)
      : [],
    activity: Array.isArray(input?.activity)
      ? input.activity.map(normalizeActivity).filter(Boolean)
      : [],
  };
}

function normalizeProduct(product) {
  if (!product || typeof product.name !== "string" || !product.name.trim()) {
    return null;
  }

  return {
    id: `${product.id || uid("product")}`,
    sku: `${product.sku || ""}`.trim(),
    name: product.name.trim(),
    category: `${product.category || "General"}`.trim() || "General",
    unit: `${product.unit || "pc"}`.trim() || "pc",
    price: roundNumber(product.price),
    stock: roundNumber(product.stock),
    reorderLevel: roundNumber(product.reorderLevel),
    updatedAt: normalizeDate(product.updatedAt),
  };
}

function normalizeTransaction(transaction) {
  if (!transaction || !transaction.productId || !transaction.type) {
    return null;
  }

  return {
    id: `${transaction.id || uid("txn")}`,
    type: transaction.type === "restock" ? "restock" : "sale",
    productId: `${transaction.productId}`,
    productName: `${transaction.productName || "Unknown product"}`.trim(),
    quantity: roundNumber(transaction.quantity),
    unit: `${transaction.unit || "pc"}`.trim() || "pc",
    unitPrice: roundNumber(transaction.unitPrice),
    total: roundMoney(transaction.total),
    note: `${transaction.note || ""}`.trim(),
    occurredAt: normalizeDate(transaction.occurredAt),
  };
}

function normalizeActivity(activity) {
  if (!activity || typeof activity.message !== "string" || !activity.message.trim()) {
    return null;
  }

  return {
    id: `${activity.id || uid("activity")}`,
    kind: `${activity.kind || "note"}`,
    message: activity.message.trim(),
    productId: `${activity.productId || ""}`,
    productName: `${activity.productName || ""}`,
    occurredAt: normalizeDate(activity.occurredAt),
  };
}

function normalizeDate(value) {
  const candidate = new Date(value);
  return Number.isNaN(candidate.getTime()) ? new Date().toISOString() : candidate.toISOString();
}

function saveState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function renderAll() {
  elements.todayLabel.textContent = `Today is ${dayFormatter.format(new Date())}`;
  renderStats();
  populateCategoryFilter();
  populateProductSelectors();
  renderInventory();
  renderReorderBoard();
  renderHotSellers();
  renderCategoryMix();
  renderRecentActivity();
  updateSalePreview();
  updateRestockPreview();
}

function renderStats() {
  const totalProducts = state.products.length;
  const totalUnits = sum(state.products.map((product) => product.stock));
  const retailValue = sum(state.products.map((product) => product.stock * product.price));
  const todaySalesTransactions = state.transactions.filter(
    (transaction) => transaction.type === "sale" && isToday(transaction.occurredAt)
  );
  const todaySales = sum(todaySalesTransactions.map((transaction) => transaction.total));
  const lowStockItems = state.products.filter((product) => {
    const status = getProductStatus(product).key;
    return status === "reorder" || status === "out";
  });

  elements.totalSkus.textContent = numberFormatter.format(totalProducts);
  elements.totalUnitsFoot.textContent = `${formatQuantity(totalUnits)} total units on hand`;
  elements.inventoryValue.textContent = currencyFormatter.format(retailValue);
  elements.todaySales.textContent = currencyFormatter.format(todaySales);
  elements.todaySalesFoot.textContent = `${todaySalesTransactions.length} sale${
    todaySalesTransactions.length === 1 ? "" : "s"
  } logged today`;
  elements.lowStockCount.textContent = numberFormatter.format(lowStockItems.length);
  elements.lowStockFoot.textContent = lowStockItems.length
    ? `${lowStockItems.filter((item) => getProductStatus(item).key === "out").length} item(s) are out of stock`
    : "All products look healthy";

  if (totalProducts) {
    const topCategory = getCategorySummaries()[0];
    elements.stockValueFoot.textContent = topCategory
      ? `${topCategory.name} holds the biggest stock value`
      : "Based on your selling price";
  } else {
    elements.stockValueFoot.textContent = "Add products to compute stock value";
  }
}

function populateCategoryFilter() {
  const currentValue = filters.category;
  const categories = [...new Set(state.products.map((product) => product.category))].sort((left, right) =>
    left.localeCompare(right)
  );

  populateSelect(
    elements.categoryFilter,
    [{ value: "all", label: "All categories" }].concat(
      categories.map((category) => ({ value: category, label: category }))
    ),
    categories.includes(currentValue) || currentValue === "all" ? currentValue : "all"
  );

  filters.category = elements.categoryFilter.value;
}

function populateProductSelectors() {
  const sortedProducts = [...state.products].sort((left, right) => left.name.localeCompare(right.name));
  const options = [{ value: "", label: "Choose a product" }].concat(
    sortedProducts.map((product) => ({
      value: product.id,
      label: `${product.name} (${formatQuantity(product.stock)} ${product.unit} left)`,
    }))
  );

  populateSelect(elements.saleProduct, options, elements.saleProduct.value || "");
  populateSelect(elements.restockProduct, options, elements.restockProduct.value || "");
}

function populateSelect(selectElement, options, selectedValue) {
  selectElement.replaceChildren();

  options.forEach((option) => {
    const optionElement = document.createElement("option");
    optionElement.value = option.value;
    optionElement.textContent = option.label;
    optionElement.selected = option.value === selectedValue;
    selectElement.append(optionElement);
  });

  if (!Array.from(selectElement.options).some((option) => option.selected)) {
    selectElement.selectedIndex = 0;
  }
}

function renderInventory() {
  const products = getFilteredProducts();
  const visibleValue = sum(products.map((product) => product.stock * product.price));

  if (!products.length) {
    elements.inventoryBody.innerHTML = `
      <tr>
        <td colspan="7">
          <div class="empty-state">
            No products match your current search. Try another category or add a new item.
          </div>
        </td>
      </tr>
    `;
  } else {
    elements.inventoryBody.innerHTML = products
      .map((product) => {
        const status = getProductStatus(product);
        return `
          <tr>
            <td>
              <div class="product-cell">
                <span class="product-name">${escapeHtml(product.name)}</span>
                <span class="product-meta">${escapeHtml(product.sku || "No SKU")}</span>
              </div>
            </td>
            <td>
              <div class="product-cell">
                <span>${escapeHtml(product.category)}</span>
                <span class="product-meta">${escapeHtml(product.unit)}</span>
              </div>
            </td>
            <td>${currencyFormatter.format(product.price)}</td>
            <td>
              <div class="product-cell">
                <span>${formatQuantity(product.stock)} ${escapeHtml(product.unit)}</span>
                <span class="product-meta">Reorder at ${formatQuantity(product.reorderLevel)}</span>
              </div>
            </td>
            <td><span class="status-pill ${status.key}">${status.label}</span></td>
            <td>${dateTimeFormatter.format(new Date(product.updatedAt))}</td>
            <td>
              <div class="mini-actions">
                <button class="mini-button" type="button" data-action="edit" data-product-id="${escapeHtml(product.id)}">Edit</button>
                <button class="mini-button warn" type="button" data-action="delete" data-product-id="${escapeHtml(product.id)}">Delete</button>
              </div>
            </td>
          </tr>
        `;
      })
      .join("");
  }

  elements.inventorySummaryText.textContent = `Showing ${products.length} of ${state.products.length} product${
    state.products.length === 1 ? "" : "s"
  }`;
  elements.inventoryValueNote.textContent = `Visible stock value: ${currencyFormatter.format(visibleValue)}`;
}

function renderReorderBoard() {
  const lowStockProducts = [...state.products]
    .filter((product) => {
      const key = getProductStatus(product).key;
      return key === "reorder" || key === "out";
    })
    .sort((left, right) => {
      const scoreDifference = getStatusScore(getProductStatus(left).key) - getStatusScore(getProductStatus(right).key);
      return scoreDifference || left.stock - right.stock || left.name.localeCompare(right.name);
    });

  if (!lowStockProducts.length) {
    elements.reorderBoard.innerHTML = `
      <div class="empty-state">
        Nice work. Nothing is below reorder level right now.
      </div>
    `;
    return;
  }

  elements.reorderBoard.innerHTML = lowStockProducts
    .slice(0, 6)
    .map((product) => {
      const status = getProductStatus(product);
      const suggestedRestock = Math.max(roundNumber(product.reorderLevel * 2 - product.stock), product.reorderLevel);
      return `
        <article class="list-card">
          <strong>${escapeHtml(product.name)}</strong>
          <div class="list-meta">
            <span>${escapeHtml(product.category)}</span>
            <span>${formatQuantity(product.stock)} ${escapeHtml(product.unit)} left</span>
            <span>${status.label}</span>
          </div>
          <div class="list-meta">
            <span>Suggested refill: ${formatQuantity(suggestedRestock)} ${escapeHtml(product.unit)}</span>
            <span>Price: ${currencyFormatter.format(product.price)}</span>
          </div>
          <button class="mini-button" type="button" data-action="edit" data-product-id="${escapeHtml(product.id)}">
            Update Item
          </button>
        </article>
      `;
    })
    .join("");
}

function renderHotSellers() {
  const salesByProduct = new Map();

  state.transactions
    .filter((transaction) => transaction.type === "sale")
    .forEach((transaction) => {
      const current = salesByProduct.get(transaction.productId) || {
        name: transaction.productName,
        unit: transaction.unit,
        quantity: 0,
        revenue: 0,
      };
      current.quantity += transaction.quantity;
      current.revenue += transaction.total;
      salesByProduct.set(transaction.productId, current);
    });

  const topSellers = [...salesByProduct.values()].sort((left, right) => {
    return right.quantity - left.quantity || right.revenue - left.revenue;
  });

  if (!topSellers.length) {
    elements.hotSellers.innerHTML = `
      <div class="empty-state">
        Sales will appear here once you start logging product movement.
      </div>
    `;
    return;
  }

  elements.hotSellers.innerHTML = topSellers
    .slice(0, 5)
    .map(
      (seller) => `
        <article class="list-card">
          <strong>${escapeHtml(seller.name)}</strong>
          <div class="list-meta">
            <span>Sold: ${formatQuantity(seller.quantity)} ${escapeHtml(seller.unit)}</span>
            <span>Revenue: ${currencyFormatter.format(seller.revenue)}</span>
          </div>
        </article>
      `
    )
    .join("");
}

function renderCategoryMix() {
  const categories = getCategorySummaries();

  if (!categories.length) {
    elements.categoryMix.innerHTML = `
      <div class="empty-state">
        Add products to see how your stock value is spread across categories.
      </div>
    `;
    return;
  }

  const highestValue = categories[0].value || 1;

  elements.categoryMix.innerHTML = categories
    .map(
      (category) => `
        <div class="bar-row">
          <div class="bar-header">
            <span>${escapeHtml(category.name)}</span>
            <span>${currencyFormatter.format(category.value)}</span>
          </div>
          <div class="bar-track">
            <div class="bar-fill" style="width: ${(category.value / highestValue) * 100}%"></div>
          </div>
        </div>
      `
    )
    .join("");
}

function renderRecentActivity() {
  const activities = [...state.activity].sort(
    (left, right) => new Date(right.occurredAt) - new Date(left.occurredAt)
  );

  if (!activities.length) {
    elements.recentActivity.innerHTML = `
      <div class="empty-state">
        Your latest sales, restocks, and product changes will show up here.
      </div>
    `;
    return;
  }

  elements.recentActivity.innerHTML = activities
    .slice(0, 8)
    .map(
      (activity) => `
        <article class="activity-card">
          <strong>${escapeHtml(activity.message)}</strong>
          <div class="activity-meta">
            <span>${dateTimeFormatter.format(new Date(activity.occurredAt))}</span>
            <span>${escapeHtml(formatActivityLabel(activity.kind))}</span>
          </div>
        </article>
      `
    )
    .join("");
}

function handleProductSubmit(event) {
  event.preventDefault();

  const productId = elements.productId.value.trim();
  const product = {
    id: productId || uid("product"),
    name: elements.productName.value.trim(),
    category: elements.productCategory.value.trim(),
    unit: elements.productUnit.value.trim(),
    price: roundMoney(elements.productPrice.value),
    stock: roundNumber(elements.productStock.value),
    reorderLevel: roundNumber(elements.productReorder.value),
    sku: elements.productSku.value.trim(),
    updatedAt: new Date().toISOString(),
  };

  if (!product.name || !product.category || !product.unit) {
    setFeedback("Please complete the product form before saving.", "danger");
    return;
  }

  if (product.stock < 0 || product.price < 0 || product.reorderLevel < 0) {
    setFeedback("Stock, price, and reorder level cannot be negative.", "danger");
    return;
  }

  const existingIndex = state.products.findIndex((item) => item.id === productId);

  if (existingIndex >= 0) {
    state.products[existingIndex] = product;
    addActivity("product-updated", `Updated product details for ${product.name}.`, product);
    saveAndRefresh(`${product.name} was updated.`, "success");
  } else {
    state.products.unshift(product);
    addActivity("product-created", `Added ${product.name} to your product list.`, product);
    saveAndRefresh(`${product.name} was added to inventory.`, "success");
  }

  resetProductForm();
}

function handleSaleSubmit(event) {
  event.preventDefault();

  const product = getProductById(elements.saleProduct.value);
  const quantity = roundNumber(elements.saleQuantity.value);
  const note = elements.saleNote.value.trim();

  if (!product) {
    setFeedback("Choose a product before recording a sale.", "danger");
    return;
  }

  if (quantity <= 0) {
    setFeedback("Sale quantity must be greater than zero.", "danger");
    return;
  }

  if (product.stock < quantity) {
    setFeedback(`Only ${formatQuantity(product.stock)} ${product.unit} of ${product.name} are left in stock.`, "danger");
    return;
  }

  product.stock = roundNumber(product.stock - quantity);
  product.updatedAt = new Date().toISOString();

  state.transactions.unshift({
    id: uid("txn"),
    type: "sale",
    productId: product.id,
    productName: product.name,
    quantity,
    unit: product.unit,
    unitPrice: product.price,
    total: roundMoney(quantity * product.price),
    note,
    occurredAt: new Date().toISOString(),
  });

  addActivity(
    "sale",
    `Logged sale for ${formatQuantity(quantity)} ${product.unit} of ${product.name}.`,
    product
  );

  saveAndRefresh(`${product.name} sale saved.`, "success");
  elements.saleForm.reset();
  updateSalePreview();
}

function handleRestockSubmit(event) {
  event.preventDefault();

  const product = getProductById(elements.restockProduct.value);
  const quantity = roundNumber(elements.restockQuantity.value);
  const note = elements.restockNote.value.trim();

  if (!product) {
    setFeedback("Choose a product before recording a restock.", "danger");
    return;
  }

  if (quantity <= 0) {
    setFeedback("Restock quantity must be greater than zero.", "danger");
    return;
  }

  product.stock = roundNumber(product.stock + quantity);
  product.updatedAt = new Date().toISOString();

  state.transactions.unshift({
    id: uid("txn"),
    type: "restock",
    productId: product.id,
    productName: product.name,
    quantity,
    unit: product.unit,
    unitPrice: product.price,
    total: roundMoney(quantity * product.price),
    note,
    occurredAt: new Date().toISOString(),
  });

  addActivity(
    "restock",
    `Restocked ${formatQuantity(quantity)} ${product.unit} of ${product.name}.`,
    product
  );

  saveAndRefresh(`${product.name} restock saved.`, "success");
  elements.restockForm.reset();
  updateRestockPreview();
}

function handleInventoryActions(event) {
  const button = event.target.closest("button[data-action]");
  if (!button) {
    return;
  }

  const productId = button.dataset.productId;

  if (button.dataset.action === "edit") {
    startEditingProduct(productId);
    return;
  }

  if (button.dataset.action === "delete") {
    deleteProduct(productId);
  }
}

function handleReorderActions(event) {
  const button = event.target.closest("button[data-action='edit']");
  if (!button) {
    return;
  }

  startEditingProduct(button.dataset.productId);
}

function startEditingProduct(productId) {
  const product = getProductById(productId);

  if (!product) {
    setFeedback("That product could not be found anymore.", "warning");
    return;
  }

  elements.productFormTitle.textContent = "Edit product";
  elements.productSubmit.textContent = "Update Product";
  elements.productId.value = product.id;
  elements.productName.value = product.name;
  elements.productCategory.value = product.category;
  elements.productUnit.value = product.unit;
  elements.productPrice.value = product.price;
  elements.productStock.value = product.stock;
  elements.productReorder.value = product.reorderLevel;
  elements.productSku.value = product.sku;
  elements.productForm.scrollIntoView({ behavior: "smooth", block: "start" });
}

function deleteProduct(productId) {
  const product = getProductById(productId);

  if (!product) {
    setFeedback("That product was already removed.", "warning");
    return;
  }

  const confirmed = window.confirm(`Delete ${product.name} from your tracker?`);
  if (!confirmed) {
    return;
  }

  state.products = state.products.filter((item) => item.id !== productId);
  addActivity("product-deleted", `Removed ${product.name} from your product list.`, product);
  saveAndRefresh(`${product.name} was deleted.`, "warning");

  if (elements.productId.value === productId) {
    resetProductForm();
  }
}

function resetProductForm() {
  elements.productForm.reset();
  elements.productId.value = "";
  elements.productFormTitle.textContent = "Add a product";
  elements.productSubmit.textContent = "Save Product";
}

function updateSalePreview() {
  const product = getProductById(elements.saleProduct.value);
  const quantity = roundNumber(elements.saleQuantity.value);

  if (!product) {
    elements.salePreview.textContent = "Choose a product to preview the sale amount.";
    return;
  }

  if (quantity <= 0) {
    elements.salePreview.textContent = `${product.name} sells for ${currencyFormatter.format(product.price)} each. ${formatQuantity(product.stock)} ${product.unit} in stock.`;
    return;
  }

  const total = roundMoney(quantity * product.price);
  const remaining = roundNumber(product.stock - quantity);
  elements.salePreview.textContent = `Sale total: ${currencyFormatter.format(total)}. Stock after sale: ${formatQuantity(
    Math.max(remaining, 0)
  )} ${product.unit}.`;
}

function updateRestockPreview() {
  const product = getProductById(elements.restockProduct.value);
  const quantity = roundNumber(elements.restockQuantity.value);

  if (!product) {
    elements.restockPreview.textContent = "Choose a product to preview the new stock level.";
    return;
  }

  if (quantity <= 0) {
    elements.restockPreview.textContent = `${product.name} currently has ${formatQuantity(product.stock)} ${product.unit} in stock.`;
    return;
  }

  elements.restockPreview.textContent = `New stock after restock: ${formatQuantity(product.stock + quantity)} ${
    product.unit
  }. Added value: ${currencyFormatter.format(quantity * product.price)}.`;
}

function exportState() {
  const payload = JSON.stringify(
    {
      ...state,
      exportedAt: new Date().toISOString(),
    },
    null,
    2
  );
  const blob = new Blob([payload], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `tindahan-tracker-backup-${new Date().toISOString().slice(0, 10)}.json`;
  document.body.append(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
  setFeedback("Backup downloaded successfully.", "success");
}

function importStateFromFile(event) {
  const file = event.target.files?.[0];
  if (!file) {
    return;
  }

  const reader = new FileReader();
  reader.onload = () => {
    try {
      const parsed = normalizeState(JSON.parse(`${reader.result || "{}"}`));
      state = parsed;
      addActivity("import", "Imported a backup file into this tracker.", null);
      saveAndRefresh("Backup imported successfully.", "success");
      resetProductForm();
    } catch (error) {
      console.error("Unable to import backup.", error);
      setFeedback("That backup file could not be imported. Please use a valid JSON export.", "danger");
    } finally {
      elements.importFile.value = "";
    }
  };
  reader.readAsText(file);
}

function resetToDemoState() {
  const confirmed = window.confirm("Reload the demo sari-sari store data? This replaces your current saved data.");
  if (!confirmed) {
    return;
  }

  state = buildDefaultState();
  addActivity("reset", "Reloaded the demo sari-sari store snapshot.", null);
  saveAndRefresh("Demo store reloaded.", "warning");
  resetProductForm();
}

function saveAndRefresh(message, tone) {
  saveState();
  renderAll();
  setFeedback(message, tone);
}

function addActivity(kind, message, product) {
  state.activity.unshift({
    id: uid("activity"),
    kind,
    message,
    productId: product?.id || "",
    productName: product?.name || "",
    occurredAt: new Date().toISOString(),
  });

  state.activity = state.activity.slice(0, 80);
  state.transactions = state.transactions.slice(0, 160);
}

function getFilteredProducts() {
  return [...state.products]
    .filter((product) => {
      const haystack = `${product.name} ${product.category} ${product.sku}`.toLowerCase();
      const matchesSearch = !filters.search || haystack.includes(filters.search);
      const matchesCategory = filters.category === "all" || product.category === filters.category;
      const matchesStatus = filters.stock === "all" || getProductStatus(product).key === filters.stock;
      return matchesSearch && matchesCategory && matchesStatus;
    })
    .sort((left, right) => {
      const statusDifference = getStatusScore(getProductStatus(left).key) - getStatusScore(getProductStatus(right).key);
      return statusDifference || right.stock - left.stock || left.name.localeCompare(right.name);
    });
}

function getProductStatus(product) {
  if (product.stock <= 0) {
    return { key: "out", label: "Out of stock" };
  }

  if (product.stock <= product.reorderLevel) {
    return { key: "reorder", label: "Reorder now" };
  }

  if (product.stock <= product.reorderLevel * 1.5) {
    return { key: "watch", label: "Watch closely" };
  }

  return { key: "healthy", label: "Healthy stock" };
}

function getStatusScore(status) {
  return {
    out: 0,
    reorder: 1,
    watch: 2,
    healthy: 3,
  }[status] ?? 4;
}

function getProductById(productId) {
  return state.products.find((product) => product.id === productId);
}

function getCategorySummaries() {
  const totals = new Map();

  state.products.forEach((product) => {
    totals.set(product.category, (totals.get(product.category) || 0) + product.price * product.stock);
  });

  return [...totals.entries()]
    .map(([name, value]) => ({ name, value: roundMoney(value) }))
    .sort((left, right) => right.value - left.value);
}

function isToday(isoDate) {
  const candidate = new Date(isoDate);
  const today = new Date();
  return (
    candidate.getFullYear() === today.getFullYear() &&
    candidate.getMonth() === today.getMonth() &&
    candidate.getDate() === today.getDate()
  );
}

function formatActivityLabel(kind) {
  return {
    sale: "Sale",
    restock: "Restock",
    "product-created": "New item",
    "product-updated": "Product edit",
    "product-deleted": "Removed item",
    import: "Backup import",
    reset: "Demo reload",
    snapshot: "Store setup",
  }[kind] || "Update";
}

function setFeedback(message, tone = "default") {
  window.clearTimeout(feedbackTimer);
  elements.feedbackMessage.textContent = message;

  if (tone === "default") {
    delete elements.feedbackMessage.dataset.tone;
  } else {
    elements.feedbackMessage.dataset.tone = tone;
  }

  feedbackTimer = window.setTimeout(() => {
    elements.feedbackMessage.textContent = "Ready to track your products.";
    delete elements.feedbackMessage.dataset.tone;
  }, 4200);
}

function sum(values) {
  return roundMoney(values.reduce((total, value) => total + value, 0));
}

function roundMoney(value) {
  const numeric = Number.parseFloat(value);
  if (!Number.isFinite(numeric)) {
    return 0;
  }
  return Number(numeric.toFixed(2));
}

function roundNumber(value) {
  const numeric = Number.parseFloat(value);
  if (!Number.isFinite(numeric)) {
    return 0;
  }
  return Number(numeric.toFixed(2));
}

function formatQuantity(value) {
  return numberFormatter.format(roundNumber(value));
}

function escapeHtml(value) {
  return `${value || ""}`
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function uid(prefix) {
  if (window.crypto?.randomUUID) {
    return `${prefix}-${window.crypto.randomUUID()}`;
  }

  return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}
