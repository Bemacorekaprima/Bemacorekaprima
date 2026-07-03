export function createInventoryFeature(options = {}) {
  const {
    state,
    cacheKey,
    notify,
    setView,
    escapeHtml,
    safeClassToken,
    normalizeSearchText,
    setTextContent,
    getCurrentProfile,
    getCurrentSummaryYear,
    getAllIntegratedPersonnelRecords,
    getPersonnelName
  } = options;

  if (!state) throw new Error("Inventory feature membutuhkan state aplikasi.");

  function bindControls() {
    document.getElementById("dashInventorySummary")?.addEventListener("click", handleSummaryClick);
    document.getElementById("dashInventoryUsageButton")?.remove();
    document.getElementById("dashInventoryAddButton")?.addEventListener("click", () => openUsageModal({ mode: "add" }));
    document.getElementById("inventoryAddItemButton")?.addEventListener("click", () => openUsageModal({ mode: "add" }));
    document.getElementById("inventoryDetailUsageButton")?.addEventListener("click", () => openUsageModal({ mode: "usage", record: getSelectedRecord() }));
    document.getElementById("inventoryDetailEditButton")?.addEventListener("click", () => openUsageModal({ mode: "edit", record: getSelectedRecord() }));
    document.getElementById("inventoryDetailHistoryButton")?.addEventListener("click", () => openUsageModal({ mode: "history", record: getSelectedRecord() }));
    document.getElementById("inventorySearch")?.addEventListener("input", event => {
      state.inventorySearch = event.target.value;
      renderWorkspace();
    });
    document.getElementById("inventoryStatusFilter")?.addEventListener("change", event => {
      state.inventoryStatusFilter = event.target.value;
      renderWorkspace();
    });
    document.getElementById("inventoryTableBody")?.addEventListener("click", handleTableClick);
    document.getElementById("inventoryPageHistory")?.addEventListener("click", handleTableClick);
    document.getElementById("inventoryUsageForm")?.addEventListener("submit", saveUsage);
    document.getElementById("inventoryAvailableSelect")?.addEventListener("change", handleAvailableSelectChange);
    document.getElementById("closeInventoryUsageButton")?.addEventListener("click", closeUsageModal);
    document.getElementById("cancelInventoryUsageButton")?.addEventListener("click", closeUsageModal);
  }

  function initializeState() {
    state.inventoryRecords = loadCache();
    state.selectedInventoryId = state.inventoryRecords.find(item => item.status === "Dipakai")?.id ||
      state.inventoryRecords[0]?.id ||
      "";
  }

  function resetState() {
    state.inventoryRecords = [];
    state.selectedInventoryId = "";
    state.inventorySearch = "";
    state.inventoryStatusFilter = "all";
  }

  function createDefaultRecords() {
    const base = {
      user: "",
      purpose: "",
      destination: "Kantor",
      departTime: "",
      returnTime: "",
      condition: "Baik",
      notes: "",
      history: []
    };
    const item = (id, name, type, status = "Tersedia", extra = {}) => ({ ...base, id, name, type, status, ...extra });
    return [
      item("inventory-car-a", "Kendaraan Mobil - Merek A", "Kendaraan", "Dipakai", {
        user: "Bpk A",
        purpose: "Mobilisasi personil proyek",
        destination: "Kantor -> Proyek Topografi",
        departTime: `${state.today}T08:30`,
        returnTime: `${state.today}T16:30`,
        notes: "Unit prioritas untuk mobilisasi lapangan.",
        history: [
          {
            at: `${state.today}T08:30`,
            action: "Gunakan Inventaris",
            user: "Bpk A",
            note: "Berangkat untuk mobilisasi personil proyek."
          }
        ]
      }),
      item("inventory-car-b", "Kendaraan Mobil - Merek B", "Kendaraan", "Dipakai", {
        user: "Bpk B",
        purpose: "Survey lapangan",
        destination: "Kantor -> Proyek Supervisi",
        departTime: `${state.today}T09:00`,
        returnTime: `${state.today}T17:00`
      }),
      item("inventory-camera-01", "Kamera Dokumentasi - Unit 01", "Peralatan Lapangan", "Dipakai", {
        user: "Tim Dokumentasi",
        purpose: "Dokumentasi pekerjaan",
        destination: "Area proyek",
        departTime: `${state.today}T10:00`,
        returnTime: `${state.today}T15:00`
      }),
      item("inventory-laptop-survey", "Laptop Survey - Unit 01", "Elektronik"),
      item("inventory-laptop-admin", "Laptop Administrasi - Unit 02", "Elektronik"),
      item("inventory-printer-office", "Printer Administrasi", "Peralatan Kantor", "Tersedia", {
        destination: "Ruang Administrasi"
      }),
      item("inventory-projector-01", "Proyektor Meeting - Unit 01", "Peralatan Kantor"),
      item("inventory-gps-02", "GPS Geodetik - Unit 02", "Peralatan Lapangan"),
      item("inventory-total-station", "Total Station - Unit 01", "Peralatan Lapangan"),
      item("inventory-drone-01", "Drone Survey - Unit 01", "Peralatan Lapangan"),
      item("inventory-radio-01", "Radio Komunikasi - Set 01", "Peralatan Lapangan"),
      item("inventory-gps-01", "GPS Geodetik - Unit 01", "Peralatan Lapangan", "Perawatan", {
        user: "Tim Teknis",
        purpose: "Kalibrasi alat",
        destination: "Workshop",
        condition: "Perlu dicek",
        notes: "Menunggu pemeriksaan baterai."
      })
    ];
  }

  function getRecords() {
    if (!Array.isArray(state.inventoryRecords) || !state.inventoryRecords.length) {
      state.inventoryRecords = createDefaultRecords();
      saveCache(state.inventoryRecords);
    }
    return state.inventoryRecords;
  }

  function getSelectedRecord() {
    const records = getRecords();
    return records.find(item => item.id === state.selectedInventoryId) ||
      records.find(item => item.status === "Dipakai") ||
      records[0] ||
      null;
  }

  function getRecordById(id) {
    return getRecords().find(item => item.id === id) || null;
  }

  function getStatusByDashboardFilter(filter = "all") {
    return {
      all: "all",
      used: "Dipakai",
      available: "Tersedia",
      maintenance: "Perawatan"
    }[filter] || "all";
  }

  function openViewWithFilter(filter = "all", viewOptions = {}) {
    const { scroll = "top" } = viewOptions || {};
    const statusFilter = getStatusByDashboardFilter(filter);
    const records = getRecords();
    state.inventorySearch = "";
    state.inventoryStatusFilter = statusFilter;
    const selected = statusFilter === "all"
      ? records[0]
      : records.find(item => (item.status || "Tersedia") === statusFilter);
    state.selectedInventoryId = selected?.id || "";
    if (!setView("inventory", { scroll })) return;
    renderWorkspace();
  }

  function renderDashboard() {
    const records = getRecords();
    const usedRecords = records.filter(item => item.status === "Dipakai");
    const selected = usedRecords.find(item => item.id === state.selectedInventoryId) || usedRecords[0] || null;
    const counts = getCounts(records);

    const summary = document.getElementById("dashInventorySummary");
    if (summary) {
      summary.innerHTML = [
        { key: "all", label: "Total", count: counts.total, note: "Semua inventaris", icon: "briefcase" },
        { key: "used", label: "Dipakai", count: counts.used, note: "Sedang digunakan", icon: "car-front" },
        { key: "available", label: "Tersedia", count: counts.available, note: "Siap digunakan", icon: "check" },
        { key: "maintenance", label: "Perawatan", count: counts.maintenance, note: "Dalam perawatan", icon: "wrench" }
      ].map(item => `
        <button type="button" data-inventory-status-filter="${escapeHtml(item.key)}">
          <i data-lucide="${escapeHtml(item.icon)}" aria-hidden="true"></i>
          <span>
            <small>${escapeHtml(item.label)}</small>
            <strong>${item.count}</strong>
            <em>${escapeHtml(item.note)}</em>
          </span>
        </button>
      `).join("");
    }

    const container = document.getElementById("dashInventoryItem");
    if (!container) return;
    if (!usedRecords.length) {
      container.innerHTML = `
        <div class="dashboard-inventory-filter-list dashboard-inventory-used-list">
          <div class="dashboard-inventory-filter-head">
            <div>
              <strong>Inventaris Sedang Digunakan</strong>
              <span>0 item</span>
            </div>
          </div>
          <p class="dashboard-empty">Belum ada inventaris yang sedang digunakan.</p>
        </div>
      `;
      return;
    }

    if (usedRecords.length > 1) {
      container.innerHTML = `
        <div class="dashboard-inventory-filter-list dashboard-inventory-used-list">
          <div class="dashboard-inventory-filter-head">
            <div>
              <strong>Inventaris Sedang Digunakan</strong>
              <span>${usedRecords.length} item</span>
            </div>
          </div>
          ${usedRecords.map(item => {
            const time = [formatTime(item.departTime), formatTime(item.returnTime)]
              .filter(value => value && value !== "-")
              .join(" - ") || "-";
            return `
              <article class="dashboard-inventory-filter-row">
                <button type="button" data-inventory-action="detail" data-inventory-id="${escapeHtml(item.id)}">
                  <strong>${escapeHtml(item.name || "Inventaris Kantor")}</strong>
                  <span>${escapeHtml([item.user || "-", time].join(" | "))}</span>
                </button>
                <em class="inventory-status dipakai">Sedang Digunakan</em>
              </article>
            `;
          }).join("")}
        </div>
      `;
      window.lucide?.createIcons?.();
      return;
    }

    const statusClass = safeClassToken(selected.status || "Tersedia");
    const progress = getUsageProgress(selected);
    const usageHours = getUsageHours(selected);
    container.innerHTML = `
      <button class="dashboard-inventory-main" type="button" data-inventory-action="detail" data-inventory-id="${escapeHtml(selected.id)}">
        <span class="inventory-photo-frame">
          <img src="assets/inventory-car.svg" alt="${escapeHtml(selected.name || "Inventaris kantor")}">
        </span>
        <span class="inventory-content">
          <span class="inventory-item-topline">
            <strong>${escapeHtml(selected.name || "Inventaris")}</strong>
            <em class="inventory-status ${statusClass}">${escapeHtml(getStatusLabel(selected.status))}</em>
          </span>
          <span class="inventory-info-grid">
            <span class="inventory-info-cell">
              <i data-lucide="target" aria-hidden="true"></i>
              <span><small>Tujuan</small><b>${escapeHtml(selected.purpose || "-")}</b></span>
            </span>
            <span class="inventory-info-cell">
              <i data-lucide="clock" aria-hidden="true"></i>
              <span><small>Berangkat</small><b>${escapeHtml(formatTime(selected.departTime))}</b></span>
            </span>
            <span class="inventory-info-cell">
              <i data-lucide="map-pin" aria-hidden="true"></i>
              <span><small>Lokasi / Tujuan</small><b>${escapeHtml(selected.destination || "-")}</b></span>
            </span>
            <span class="inventory-info-cell">
              <i data-lucide="user-round" aria-hidden="true"></i>
              <span><small>Pengguna / Driver</small><b>${escapeHtml(selected.user || "-")}</b></span>
            </span>
            <span class="inventory-info-cell">
              <i data-lucide="clock-3" aria-hidden="true"></i>
              <span><small>Estimasi Kembali</small><b>${escapeHtml(formatTime(selected.returnTime))}</b></span>
            </span>
            <span class="inventory-info-cell inventory-progress-cell">
              <i data-lucide="car-front" aria-hidden="true"></i>
              <span>
                <small>Progress Penggunaan</small>
                <span class="inventory-time-track"><i style="width:${progress}%"></i></span>
                <em>${progress}%${usageHours ? ` (${escapeHtml(usageHours)})` : ""}</em>
              </span>
            </span>
          </span>
        </span>
      </button>
    `;
    window.lucide?.createIcons?.();
  }

  function getCounts(records = getRecords()) {
    return records.reduce((summary, item) => {
      summary.total += 1;
      if (item.status === "Dipakai") summary.used += 1;
      else if (item.status === "Perawatan") summary.maintenance += 1;
      else summary.available += 1;
      return summary;
    }, { total: 0, used: 0, available: 0, maintenance: 0 });
  }

  function getFilteredRecords() {
    const keyword = normalizeSearchText(state.inventorySearch);
    const status = state.inventoryStatusFilter || "all";
    return getRecords().filter(item => {
      const matchesStatus = status === "all" || (item.status || "Tersedia") === status;
      const haystack = normalizeSearchText([
        item.name,
        item.type,
        item.user,
        item.purpose,
        item.destination,
        item.condition,
        item.notes
      ].join(" "));
      return matchesStatus && (!keyword || haystack.includes(keyword));
    });
  }

  function renderWorkspace() {
    const records = getRecords();
    const counts = getCounts(records);
    setTextContent("inventoryStatTotal", counts.total);
    setTextContent("inventoryStatUsed", counts.used);
    setTextContent("inventoryStatAvailable", counts.available);
    setTextContent("inventoryStatMaintenance", counts.maintenance);
    setTextContent("inventorySyncStatus", `Tersinkron realtime - ${counts.total} item`);

    const search = document.getElementById("inventorySearch");
    if (search && document.activeElement !== search) search.value = state.inventorySearch || "";
    const filter = document.getElementById("inventoryStatusFilter");
    if (filter) filter.value = state.inventoryStatusFilter || "all";

    const filtered = getFilteredRecords();
    if (!records.some(item => item.id === state.selectedInventoryId)) {
      state.selectedInventoryId = records[0]?.id || "";
    }
    if (filtered.length && !filtered.some(item => item.id === state.selectedInventoryId)) {
      state.selectedInventoryId = filtered[0].id;
    }

    const body = document.getElementById("inventoryTableBody");
    if (body) {
      body.innerHTML = filtered.length ? filtered.map(item => {
        const isSelected = item.id === state.selectedInventoryId;
        const status = item.status || "Tersedia";
        const canUse = isAvailable(item);
        const time = [formatTime(item.departTime), formatTime(item.returnTime)]
          .filter(value => value && value !== "-")
          .join(" - ") || "-";
        return `
          <tr class="${isSelected ? "selected" : ""}" data-inventory-id="${escapeHtml(item.id)}">
            <td>
              <button class="inventory-row-title" type="button" data-inventory-id="${escapeHtml(item.id)}">
                <strong>${escapeHtml(item.name || "Inventaris Kantor")}</strong>
                <small>${escapeHtml(item.type || "Lainnya")}</small>
              </button>
            </td>
            <td>${escapeHtml(item.user || "-")}</td>
            <td>${escapeHtml(time)}</td>
            <td><span class="inventory-table-status ${escapeHtml(safeClassToken(status))}">${escapeHtml(getStatusLabel(status))}</span></td>
            <td>
              ${canUse ? `<button class="text-button" type="button" data-inventory-row-action="usage" data-inventory-id="${escapeHtml(item.id)}">Gunakan</button>` : ""}
              <button class="text-button" type="button" data-inventory-row-action="edit" data-inventory-id="${escapeHtml(item.id)}">Edit</button>
            </td>
          </tr>
        `;
      }).join("") : '<tr><td colspan="5" class="dashboard-empty">Belum ada inventaris yang cocok.</td></tr>';
    }

    renderDetail(filtered.length ? getSelectedRecord() : null);
    window.lucide?.createIcons?.();
  }

  function renderDetail(record) {
    const empty = document.getElementById("inventoryEmptyState");
    const content = document.getElementById("inventoryDetailContent");
    if (!empty || !content) return;
    empty.classList.toggle("hidden", !!record);
    content.classList.toggle("hidden", !record);
    if (!record) return;

    const status = record.status || "Tersedia";
    const statusLabel = getStatusLabel(status);
    const statusClass = safeClassToken(status);
    const progress = getUsageProgress(record);
    const usageHours = getUsageHours(record);
    setTextContent("inventoryDetailStatus", statusLabel);
    setTextContent("inventoryDetailTitle", record.name || "Inventaris Kantor");
    setTextContent("inventoryDetailMeta", record.type || "Lainnya");
    setTextContent("inventoryDetailItemName", record.name || "Inventaris Kantor");
    setTextContent("inventoryDetailStatusPill", statusLabel);
    const detailStatus = document.getElementById("inventoryDetailStatus");
    const detailStatusPill = document.getElementById("inventoryDetailStatusPill");
    if (detailStatus) detailStatus.className = `inventory-detail-badge ${statusClass}`;
    if (detailStatusPill) detailStatusPill.className = `inventory-status ${statusClass}`;
    setTextContent("inventoryDetailProgressLabel", `${progress}%${usageHours ? ` (${usageHours})` : ""}`);
    const progressBar = document.getElementById("inventoryDetailProgressBar");
    if (progressBar) progressBar.style.width = `${progress}%`;

    const info = document.getElementById("inventoryDetailInfoGrid");
    if (info) {
      info.innerHTML = [
        { icon: "target", label: "Tujuan", value: record.purpose || "-" },
        { icon: "user-round", label: "Pengguna / Driver", value: record.user || "-" },
        { icon: "clock", label: "Berangkat", value: formatTime(record.departTime) },
        { icon: "clock-3", label: "Estimasi Kembali", value: formatTime(record.returnTime) },
        { icon: "map-pin", label: "Lokasi / Tujuan", value: record.destination || "-" },
        { icon: "badge-check", label: "Kondisi", value: record.condition || "-" }
      ].map(item => `
        <span class="inventory-info-cell">
          <i data-lucide="${escapeHtml(item.icon)}" aria-hidden="true"></i>
          <span><small>${escapeHtml(item.label)}</small><b>${escapeHtml(item.value)}</b></span>
        </span>
      `).join("");
    }

    const history = document.getElementById("inventoryPageHistory");
    if (history) {
      const rows = Array.isArray(record.history) ? record.history.slice(0, 5) : [];
      history.innerHTML = `
        <div class="inventory-page-history-head">
          <strong>Riwayat Terakhir</strong>
          <button class="text-button" type="button" data-inventory-row-action="history" data-inventory-id="${escapeHtml(record.id)}">Lihat Semua</button>
        </div>
        ${rows.length ? rows.map(item => `
          <div class="inventory-page-history-row">
            <span>${escapeHtml(formatDateTime(item.at))}</span>
            <b>${escapeHtml(item.action || "-")}</b>
            <small>${escapeHtml([item.user, item.note].filter(Boolean).join(" - ") || "-")}</small>
          </div>
        `).join("") : '<p>Belum ada riwayat pemakaian.</p>'}
      `;
    }
  }

  function handleTableClick(event) {
    const actionButton = event.target.closest("[data-inventory-row-action]");
    if (actionButton) {
      event.preventDefault();
      handleTableAction(actionButton);
      return;
    }

    const rowTarget = event.target.closest(".inventory-row-title[data-inventory-id], tr[data-inventory-id]");
    const id = rowTarget?.dataset.inventoryId || "";
    if (!id) return;
    const record = getRecords().find(item => item.id === id);
    if (!record) return;
    const scrollState = captureScrollState();
    state.selectedInventoryId = id;
    renderWorkspace();
    restoreScrollState(scrollState);
  }

  function handleTableAction(actionButton) {
    const id = actionButton.dataset.inventoryId || "";
    if (!id) return;
    const record = getRecords().find(item => item.id === id);
    if (!record) return;
    const scrollState = captureScrollState();
    state.selectedInventoryId = id;
    const action = actionButton.dataset.inventoryRowAction;
    if (action === "usage") openUsageModal({ mode: "usage", record });
    else if (action === "history") openUsageModal({ mode: "history", record });
    else if (action === "edit") openUsageModal({ mode: "edit", record });
    else openUsageModal({ mode: "detail", record });
    renderWorkspace();
    restoreScrollState(scrollState);
  }

  function handleAction(action, inventoryId = "") {
    const selected = inventoryId ? getRecordById(inventoryId) : getSelectedRecord();
    if (selected) state.selectedInventoryId = selected.id;
    if (action === "list") {
      openViewWithFilter("all");
      return;
    }
    if (action === "collapse") {
      renderDashboard();
      return;
    }
    if (!selected && action !== "usage") return openUsageModal({ mode: "add" });
    if (action === "usage") return openUsageModal({ mode: "usage", record: selected });
    if (action === "edit") return openUsageModal({ mode: "edit", record: selected });
    if (action === "status") return cycleStatus(selected);
    if (action === "maintenance") return openUsageModal({ mode: "maintenance", record: selected });
    if (action === "history") return openUsageModal({ mode: "history", record: selected });
    return openUsageModal({ mode: "detail", record: selected });
  }

  function handleSummaryClick(event) {
    const button = event.target.closest("[data-inventory-status-filter]");
    if (!button) return;
    event.preventDefault();
    const filter = button.dataset.inventoryStatusFilter || "all";
    openViewWithFilter(filter);
  }

  function openUsageModal(modalOptions = {}) {
    const scrollState = captureScrollState();
    const mode = modalOptions.mode || "usage";
    const usageRecord = isAvailable(modalOptions.record) ? modalOptions.record : {};
    const record = mode === "usage" ? usageRecord : (modalOptions.record || getSelectedRecord() || {});
    const modal = document.getElementById("inventoryUsageModal");
    if (!modal) return;
    modal.setAttribute("tabindex", "-1");
    state.inventoryFormMode = mode;

    setTextContent("inventoryUsageTitle", mode === "add" ? "Tambah Inventaris Kantor" :
      mode === "edit" ? "Edit Inventaris Kantor" :
      mode === "maintenance" ? "Jadwalkan Perawatan Inventaris" :
      mode === "history" ? "Riwayat Pemakaian Inventaris" :
      mode === "detail" ? "Rincian Inventaris Kantor" :
      "Gunakan Inventaris");
    setTextContent("inventoryUsageSubtitle", mode === "usage"
      ? "Pilih item yang tersedia, isi pengguna dan tujuan. Setelah disimpan, status berubah menjadi Dipakai."
      : mode === "add"
        ? "Tambah jenis/item/barang inventaris baru. Data penggunaan diisi melalui tombol Gunakan."
        : "Data tersimpan lokal pada web. Nanti dapat diarahkan ke Sheet INVENTARIS.");
    setInputValue("inventoryRecordId", record.id || "");
    setInputValue("inventoryItemName", record.name || "");
    setInputValue("inventoryItemType", record.type || "Kendaraan");
    setInputValue("inventoryStatus", mode === "add" ? "Tersedia" :
      mode === "maintenance" ? "Perawatan" :
      mode === "usage" ? "Dipakai" :
      (record.status || "Tersedia"));
    setInputValue("inventoryUser", record.user || "");
    setInputValue("inventoryPurpose", mode === "maintenance" ? "Perawatan berkala" : (record.purpose || ""));
    setInputValue("inventoryDestination", record.destination || "");
    setInputValue("inventoryDepartTime", toDatetimeLocalValue(record.departTime) || (mode === "usage" ? toDatetimeLocalValue(new Date()) : ""));
    setInputValue("inventoryReturnTime", toDatetimeLocalValue(record.returnTime));
    setInputValue("inventoryCondition", record.condition || "Baik");
    setInputValue("inventoryNotes", record.notes || "");
    setInputValue("inventoryAvailableSelect", "");
    setFormMode(mode);
    renderAvailableOptions();
    if (mode === "usage" && record.id) setInputValue("inventoryAvailableSelect", record.id);
    populateDatalists();
    renderHistoryPreview(record);
    modal.setAttribute("open", "");
    modal.querySelector(".inventory-form-card")?.focus?.({ preventScroll: true });
    restoreScrollState(scrollState);
  }

  function closeUsageModal() {
    const modal = document.getElementById("inventoryUsageModal");
    if (modal?.open) modal.removeAttribute("open");
  }

  function captureScrollState() {
    const selectors = [".main", ".dashboard-inventory-filter-list", "#dashInventoryItem"];
    const containers = selectors.map(selector => {
      const element = document.querySelector(selector);
      return element ? {
        selector,
        top: element.scrollTop || 0,
        left: element.scrollLeft || 0
      } : null;
    }).filter(Boolean);
    return {
      windowX: window.scrollX || 0,
      windowY: window.scrollY || 0,
      documentTop: document.scrollingElement?.scrollTop || 0,
      documentLeft: document.scrollingElement?.scrollLeft || 0,
      containers
    };
  }

  function restoreScrollState(stateSnapshot) {
    if (!stateSnapshot) return;
    const restore = () => {
      if (document.scrollingElement) {
        document.scrollingElement.scrollTop = stateSnapshot.documentTop;
        document.scrollingElement.scrollLeft = stateSnapshot.documentLeft;
      }
      stateSnapshot.containers?.forEach(item => {
        const element = document.querySelector(item.selector);
        if (!element) return;
        element.scrollTop = item.top;
        element.scrollLeft = item.left;
      });
      window.scrollTo(stateSnapshot.windowX, stateSnapshot.windowY);
    };
    restore();
    requestAnimationFrame(restore);
    window.setTimeout(restore, 0);
    window.setTimeout(restore, 80);
    window.setTimeout(restore, 240);
  }

  function saveUsage(event) {
    event.preventDefault();
    const records = getRecords();
    const selectedName = getInputValue("inventoryItemName");
    const formMode = state.inventoryFormMode || "usage";
    const masterMode = formMode === "add" || formMode === "edit";
    const selectedAvailableId = getInputValue("inventoryAvailableSelect");
    if (formMode === "usage" && !selectedAvailableId) {
      notify("Pilih inventaris yang tersedia terlebih dahulu.", { type: "warning" });
      return;
    }
    const id = formMode === "usage"
      ? selectedAvailableId
      : (document.getElementById("inventoryRecordId")?.value || createId());
    const existingIndex = records.findIndex(item => item.id === id);
    const existing = existingIndex >= 0 ? records[existingIndex] : { id, history: [] };
    if (formMode === "usage" && !isAvailable(existing)) {
      notify("Inventaris ini tidak tersedia untuk digunakan. Pilih item lain.", { type: "warning" });
      renderAvailableOptions();
      return;
    }
    const status = formMode === "usage" ? "Dipakai" :
      formMode === "add" ? "Tersedia" :
      (getInputValue("inventoryStatus") || "Tersedia");
    const nextRecord = {
      ...existing,
      id,
      name: formMode === "usage" ? existing.name : (selectedName || existing.name || "Inventaris Kantor"),
      type: getInputValue("inventoryItemType") || existing.type || "Lainnya",
      status,
      user: masterMode ? (existing.user || "") : getInputValue("inventoryUser"),
      purpose: masterMode ? (existing.purpose || "") : getInputValue("inventoryPurpose"),
      destination: masterMode ? (existing.destination || "Kantor") : getInputValue("inventoryDestination"),
      departTime: masterMode ? (existing.departTime || "") : getInputValue("inventoryDepartTime"),
      returnTime: masterMode ? (existing.returnTime || "") : getInputValue("inventoryReturnTime"),
      condition: getInputValue("inventoryCondition") || "Baik",
      notes: getInputValue("inventoryNotes"),
      updatedAt: new Date().toISOString()
    };
    nextRecord.history = [
      {
        at: new Date().toISOString(),
        action: formMode === "add" ? "Tambah Inventaris" :
          formMode === "edit" || formMode === "detail" ? "Edit Inventaris" :
          status === "Perawatan" ? "Jadwalkan Perawatan" : "Gunakan Inventaris",
        user: nextRecord.user,
        note: [nextRecord.purpose, nextRecord.destination].filter(Boolean).join(" - ") || nextRecord.notes
      },
      ...(Array.isArray(existing.history) ? existing.history : [])
    ].slice(0, 12);

    if (existingIndex >= 0) records[existingIndex] = nextRecord;
    else records.unshift(nextRecord);
    state.inventoryRecords = records;
    state.selectedInventoryId = nextRecord.id;
    saveCache(records);
    renderDashboard();
    renderWorkspace();
    closeUsageModal();
    notify("Data inventaris kantor tersimpan.");
  }

  function setFormMode(mode) {
    const usageMode = mode === "usage";
    const addMode = mode === "add";
    const editMode = mode === "edit";
    const masterMode = addMode || editMode;
    const historyMode = mode === "history";
    const detailMode = mode === "detail";
    document.getElementById("inventoryAvailableField")?.classList.toggle("hidden", !usageMode);
    document.getElementById("inventoryItemNameField")?.classList.toggle("hidden", usageMode || historyMode);
    document.getElementById("inventoryItemTypeField")?.classList.toggle("hidden", usageMode || historyMode);
    document.getElementById("inventoryStatusField")?.classList.toggle("hidden", usageMode || addMode || historyMode);
    document.getElementById("inventoryUserField")?.classList.toggle("hidden", masterMode || historyMode);
    document.getElementById("inventoryPurposeField")?.classList.toggle("hidden", masterMode || historyMode);
    document.getElementById("inventoryDestinationField")?.classList.toggle("hidden", masterMode || historyMode);
    document.getElementById("inventoryDepartTimeField")?.classList.toggle("hidden", masterMode || historyMode);
    document.getElementById("inventoryReturnTimeField")?.classList.toggle("hidden", masterMode || historyMode);
    document.getElementById("inventoryConditionField")?.classList.toggle("hidden", historyMode);
    document.getElementById("inventoryNotesField")?.classList.toggle("hidden", historyMode);

    const itemName = document.getElementById("inventoryItemName");
    const availableSelect = document.getElementById("inventoryAvailableSelect");
    const user = document.getElementById("inventoryUser");
    const purpose = document.getElementById("inventoryPurpose");
    const saveButton = document.getElementById("saveInventoryUsageButton");
    if (itemName) itemName.required = !usageMode && !historyMode;
    if (availableSelect) availableSelect.required = usageMode;
    if (user) user.required = usageMode;
    if (purpose) purpose.required = usageMode;
    if (saveButton) {
      saveButton.classList.toggle("hidden", historyMode || detailMode);
      saveButton.textContent = usageMode ? "Gunakan" :
        addMode ? "Simpan Item" :
        editMode ? "Simpan Perubahan" :
        "Simpan";
    }
    if (detailMode) {
      [
        "inventoryItemName",
        "inventoryItemType",
        "inventoryStatus",
        "inventoryUser",
        "inventoryPurpose",
        "inventoryDestination",
        "inventoryDepartTime",
        "inventoryReturnTime",
        "inventoryCondition",
        "inventoryNotes"
      ].forEach(id => document.getElementById(id)?.setAttribute("readonly", "readonly"));
    } else {
      [
        "inventoryItemName",
        "inventoryUser",
        "inventoryPurpose",
        "inventoryDestination",
        "inventoryDepartTime",
        "inventoryReturnTime",
        "inventoryNotes"
      ].forEach(id => document.getElementById(id)?.removeAttribute("readonly"));
    }
    ["inventoryItemType", "inventoryStatus", "inventoryCondition"].forEach(id => {
      const field = document.getElementById(id);
      if (field) field.disabled = detailMode;
    });
  }

  function renderAvailableOptions() {
    const select = document.getElementById("inventoryAvailableSelect");
    if (!select) return;
    const available = getRecords().filter(isAvailable);
    select.innerHTML = `
      <option value="">-- Pilih inventaris yang tersedia --</option>
      ${available.map(item => `<option value="${escapeHtml(item.id)}">${escapeHtml(item.name)} (Tersedia)</option>`).join("")}
    `;
  }

  function isAvailable(item) {
    return !item?.status || item.status === "Tersedia";
  }

  function handleAvailableSelectChange() {
    const selected = getRecords().find(item => item.id === getInputValue("inventoryAvailableSelect"));
    if (!selected) {
      renderHistoryPreview({});
      return;
    }
    setInputValue("inventoryItemName", selected.name);
    setInputValue("inventoryItemType", selected.type || "Kendaraan");
    setInputValue("inventoryDestination", selected.destination || "");
    setInputValue("inventoryCondition", selected.condition || "Baik");
    renderHistoryPreview(selected);
  }

  function cycleStatus(record) {
    if (!record) return;
    const sequence = ["Tersedia", "Dipakai", "Perawatan"];
    const nextStatus = sequence[(sequence.indexOf(record.status) + 1) % sequence.length] || "Tersedia";
    record.status = nextStatus;
    record.updatedAt = new Date().toISOString();
    record.history = [
      { at: record.updatedAt, action: "Ubah Status", user: getCurrentProfile?.()?.displayName || "", note: getStatusLabel(nextStatus) },
      ...(Array.isArray(record.history) ? record.history : [])
    ].slice(0, 12);
    saveCache(state.inventoryRecords);
    renderDashboard();
    renderWorkspace();
    notify(`Status inventaris menjadi ${getStatusLabel(nextStatus)}.`);
  }

  function renderHistoryPreview(record = {}) {
    const container = document.getElementById("inventoryHistoryPreview");
    if (!container) return;
    const history = Array.isArray(record.history) ? record.history.slice(0, 4) : [];
    container.innerHTML = `
      <strong>Riwayat Pemakaian</strong>
      ${history.length ? history.map(item => `
        <div>
          <span>${escapeHtml(formatDateTime(item.at))}</span>
          <b>${escapeHtml(item.action || "-")}</b>
          <small>${escapeHtml([item.user, item.note].filter(Boolean).join(" - ") || "-")}</small>
        </div>
      `).join("") : '<p>Belum ada riwayat pemakaian.</p>'}
    `;
  }

  function populateDatalists() {
    const names = document.getElementById("inventoryNameSuggestions");
    if (names) {
      const records = state.inventoryFormMode === "usage"
        ? getRecords().filter(item => item.status === "Tersedia")
        : getRecords();
      names.innerHTML = records.map(item => `<option value="${escapeHtml(item.name)}">${escapeHtml(item.status || "Tersedia")}</option>`).join("");
    }
    const people = document.getElementById("inventoryPersonSuggestions");
    if (people) {
      const suggestions = new Set([
        ...getAllIntegratedPersonnelRecords(getCurrentSummaryYear()).map(getPersonnelName).filter(Boolean),
        ...getRecords().map(item => item.user).filter(Boolean)
      ]);
      people.innerHTML = Array.from(suggestions).slice(0, 80).map(name => `<option value="${escapeHtml(name)}"></option>`).join("");
    }
  }

  function getUsageProgress(record) {
    const start = new Date(record.departTime || "").getTime();
    const end = new Date(record.returnTime || "").getTime();
    if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) return record.status === "Dipakai" ? 50 : 0;
    return Math.max(0, Math.min(100, Math.round(((Date.now() - start) / (end - start)) * 100)));
  }

  function getUsageHours(record) {
    const start = new Date(record.departTime || "").getTime();
    const end = new Date(record.returnTime || "").getTime();
    if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) return "";
    const totalHours = Math.max(1, Math.round((end - start) / 3600000));
    const usedHours = Math.max(0, Math.min(totalHours, Math.round((Date.now() - start) / 3600000)));
    return `${usedHours} / ${totalHours} jam`;
  }

  function getStatusLabel(status) {
    if (status === "Dipakai") return "Sedang Digunakan";
    return status || "Tersedia";
  }

  function formatDateTime(value) {
    if (!value) return "-";
    const date = new Date(value);
    if (!Number.isFinite(date.getTime())) return String(value);
    return new Intl.DateTimeFormat("id-ID", {
      day: "2-digit",
      month: "short",
      hour: "2-digit",
      minute: "2-digit"
    }).format(date);
  }

  function formatTime(value) {
    if (!value) return "-";
    const date = new Date(value);
    if (!Number.isFinite(date.getTime())) return String(value);
    return new Intl.DateTimeFormat("id-ID", { hour: "2-digit", minute: "2-digit" }).format(date);
  }

  function toDatetimeLocalValue(value) {
    if (!value) return "";
    const date = value instanceof Date ? value : new Date(value);
    if (!Number.isFinite(date.getTime())) return "";
    const offsetDate = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
    return offsetDate.toISOString().slice(0, 16);
  }

  function setInputValue(id, value) {
    const input = document.getElementById(id);
    if (input) input.value = value || "";
  }

  function getInputValue(id) {
    return document.getElementById(id)?.value?.trim() || "";
  }

  function createId() {
    return `inventory-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  }

  function loadCache() {
    try {
      const records = JSON.parse(localStorage.getItem(cacheKey) || "[]");
      if (!Array.isArray(records) || !records.length) return createDefaultRecords();
      if (isLegacyDefaultRecords(records)) {
        const defaults = createDefaultRecords();
        saveCache(defaults);
        return defaults;
      }
      return records;
    } catch (error) {
      return createDefaultRecords();
    }
  }

  function isLegacyDefaultRecords(records) {
    const legacyIds = ["inventory-car-a", "inventory-laptop-survey", "inventory-printer-office", "inventory-gps-01"];
    return records.length === legacyIds.length && legacyIds.every(id => records.some(item => item?.id === id));
  }

  function saveCache(records) {
    localStorage.setItem(cacheKey, JSON.stringify(Array.isArray(records) ? records : []));
  }

  return {
    bindControls,
    initializeState,
    resetState,
    createDefaultRecords,
    getRecords,
    getSelectedRecord,
    handleAction,
    openViewWithFilter,
    renderDashboard,
    renderWorkspace
  };
}
