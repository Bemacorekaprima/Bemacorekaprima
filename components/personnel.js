export function createPersonnelFeature(options = {}) {
  const {
    state,
    notify,
    getCurrentUser,
    getExternalSheetLastLoadedAt,
    loadExternalSheetData,
    renderYearFilterOptions,
    getPersonnelSheet,
    getIntegratedPersonnelRecords,
    getFilteredPersonnelRecords,
    getPersonnelActiveWork,
    getPersonnelName,
    getPersonnelStatus,
    getPersonnelPosition,
    getDataUtamaSheet,
    getRecordValue,
    isSamePersonnelName,
    isFinishedWorkRecord,
    isActiveWorkRecord,
    getRecordYears,
    getComparableDate,
    getRecordDisplayValue,
    includesAny,
    normalizeSearchText,
    escapeHtml,
    humanizeFieldName,
    canManagePersonnel,
    requirePermission,
    togglePersonnelRowMenu,
    closePersonnelMenus,
    renderAssignmentMultiSelect,
    renderPersonnelNameSuggestions,
    bindAssignmentMultiSelects,
    formatHumanDate,
    formatSyncTime,
    printHtmlDocument
  } = options;

  function bindControls() {
    document.querySelectorAll("[data-personnel-source]").forEach(button => {
      button.addEventListener("click", () => selectPersonnelSource(button.dataset.personnelSource));
    });
    document.getElementById("personnelSearch")?.addEventListener("input", event => {
      state.personnelSearch = event.target.value;
      state.personnelPage = 1;
      renderPersonnel();
    });
    document.getElementById("personnelYearFilter")?.addEventListener("change", event => {
      state.personnelYear = event.target.value;
      state.personnelPage = 1;
      renderPersonnel();
    });
    document.getElementById("personnelWorkFilter")?.addEventListener("change", event => {
      state.personnelWorkFilter = event.target.value;
      state.personnelPage = 1;
      renderPersonnel();
    });
    document.getElementById("personnelSort")?.addEventListener("change", event => {
      state.personnelSort = event.target.value;
      renderPersonnel();
    });
    document.getElementById("refreshPersonnelButton")?.addEventListener("click", loadExternalSheetData);
    document.getElementById("resetPersonnelFilters")?.addEventListener("click", resetPersonnelFilters);
    document.getElementById("exportPersonnelExcelButton")?.addEventListener("click", exportPersonnelExcel);
    document.getElementById("exportPersonnelPdfButton")?.addEventListener("click", exportPersonnelPdf);
    document.getElementById("personnelPrevPage")?.addEventListener("click", () => changePersonnelPage(-1));
    document.getElementById("personnelNextPage")?.addEventListener("click", () => changePersonnelPage(1));
    document.getElementById("personnelTableBody")?.addEventListener("click", handlePersonnelTableClick);
    document.getElementById("addPersonnelButton")?.addEventListener("click", () => openPersonnelForm());
    document.getElementById("closePersonnelDetailButton")?.addEventListener("click", closePersonnelDetail);
    document.getElementById("closePersonnelDetailFooter")?.addEventListener("click", closePersonnelDetail);
    document.getElementById("personnelForm")?.addEventListener("submit", savePersonnelRecord);
    document.getElementById("closePersonnelFormButton")?.addEventListener("click", closePersonnelForm);
    document.getElementById("cancelPersonnelFormButton")?.addEventListener("click", closePersonnelForm);
  }

function renderPersonnel() {
  const tableHead = document.getElementById("personnelTableHead");
  const tableBody = document.getElementById("personnelTableBody");
  if (!tableHead || !tableBody) return;
  renderYearFilterOptions();

  document.querySelectorAll("[data-personnel-source]").forEach(button => {
    button.classList.toggle("active", button.dataset.personnelSource === state.personnelSource);
  });

  const bemacoSheet = getPersonnelSheet("personil-bmc");
  const outsourcingSheet = getPersonnelSheet("outsourcing");
  updatePersonnelSourceSummary("personnelBemacoCount", "personnelBemacoActive", bemacoSheet);
  updatePersonnelSourceSummary("personnelOutsourcingCount", "personnelOutsourcingActive", outsourcingSheet);

  const sheet = getPersonnelSheet();
  const sourceName = state.personnelSource === "outsourcing" ? "Personil Outsourcing" : "Personil Bemaco";
  document.getElementById("personnelTableTitle").textContent = sourceName;

  if (!sheet || sheet.status !== "ready") {
    const message = sheet?.status === "loading"
      ? "Sedang memuat data spreadsheet..."
      : sheet?.status === "error"
        ? "Spreadsheet belum dapat dibaca. Periksa Apps Script Bridge lalu klik Refresh."
        : "Menunggu sinkronisasi spreadsheet...";
    document.getElementById("personnelSyncText").textContent = message;
    document.getElementById("personnelResultCount").textContent = "0 data ditemukan";
    document.getElementById("personnelPageInfo").textContent = "Halaman 1 dari 1";
    tableHead.innerHTML = "";
    tableBody.innerHTML = `<tr><td class="personnel-empty">${escapeHtml(message)}</td></tr>`;
    setPersonnelPaginationButtons(1);
    return;
  }

  const integratedRecords = getIntegratedPersonnelRecords(sheet.records);
  const filteredRecords = getFilteredPersonnelRecords();
  const pageCount = Math.max(1, Math.ceil(filteredRecords.length / state.personnelPageSize));
  state.personnelPage = Math.min(Math.max(1, state.personnelPage), pageCount);
  const pageStart = (state.personnelPage - 1) * state.personnelPageSize;
  const pageRecords = filteredRecords.slice(pageStart, pageStart + state.personnelPageSize);
  const columns = getPersonnelColumns(integratedRecords);
  state.personnelVisibleRecords = pageRecords;

  document.getElementById("personnelSyncText").textContent =
    `${sheet.records.length} data tersinkron · kategori ${state.personnelYear === "all" ? "semua tahun" : state.personnelYear} · diperbarui ${formatSyncTime(getExternalSheetLastLoadedAt())}`;
  document.getElementById("personnelResultCount").textContent =
    `${filteredRecords.length} data ditemukan`;
  document.getElementById("personnelPageInfo").textContent =
    `Halaman ${state.personnelPage} dari ${pageCount}`;
  setPersonnelPaginationButtons(pageCount);

  tableHead.innerHTML = `<tr>${columns.map(column =>
    `<th>${escapeHtml(humanizeFieldName(column))}</th>`
  ).join("")}<th>Aksi</th></tr>`;

  tableBody.innerHTML = pageRecords.length
    ? pageRecords.map((record, index) => `
      <tr>
        ${columns.map(column => {
          const value = escapeHtml(getRecordDisplayValue(record, column));
          const isName = includesAny(normalizeSearchText(column), ["nama personil", "nama lengkap"]);
          return `<td data-label="${escapeHtml(humanizeFieldName(column))}">${isName
            ? `<button class="personnel-history-link" type="button" data-personnel-history-index="${index}">${value}</button>`
            : value}</td>`;
        }).join("")}
        <td data-label="Aksi" class="personnel-row-actions">
          <div class="personnel-row-dropdown">
            <button class="secondary-button action-dropdown-button" type="button" data-personnel-menu="${index}" aria-expanded="false">
              Options <span class="dropdown-chevron" aria-hidden="true"></span>
            </button>
            <div class="personnel-row-menu hidden">
              <button type="button" data-personnel-action="detail" data-personnel-index="${index}">View</button>
              ${canManagePersonnel() ? `
                <button type="button" data-personnel-action="edit" data-personnel-index="${index}">Edit</button>
                <button class="danger-text" type="button" data-personnel-action="delete" data-personnel-index="${index}">Delete</button>
              ` : ""}
            </div>
          </div>
        </td>
      </tr>
    `).join("")
    : '<tr><td class="personnel-empty">Tidak ada data yang sesuai dengan filter.</td></tr>';
}

function getPersonnelColumns(records) {
  const columns = [];
  records.forEach(record => {
    Object.keys(record || {}).forEach(key => {
      if (key !== "_Sumber Baris" && !columns.includes(key)) columns.push(key);
    });
  });
  return columns;
}

function updatePersonnelSourceSummary(countId, activeId, sheet) {
  const records = sheet?.status === "ready" ? sheet.records : [];
  const integratedRecords = getIntegratedPersonnelRecords(records);
  document.getElementById(countId).textContent = records.length;
  document.getElementById(activeId).textContent =
    `${integratedRecords.filter(record => getPersonnelActiveWork(record) > 0).length} memiliki pekerjaan aktif`;
}

function selectPersonnelSource(sourceId) {
  state.personnelSource = sourceId;
  state.personnelPage = 1;
  renderPersonnel();
}

function resetPersonnelFilters() {
  state.personnelSearch = "";
  state.personnelYear = "all";
  state.personnelWorkFilter = "all";
  state.personnelSort = "name-asc";
  state.personnelPage = 1;
  document.getElementById("personnelSearch").value = "";
  document.getElementById("personnelYearFilter").value = "all";
  document.getElementById("personnelWorkFilter").value = "all";
  document.getElementById("personnelSort").value = "name-asc";
  renderPersonnel();
}

function changePersonnelPage(offset) {
  const records = getFilteredPersonnelRecords();
  const pageCount = Math.max(1, Math.ceil(records.length / state.personnelPageSize));
  state.personnelPage = Math.min(pageCount, Math.max(1, state.personnelPage + offset));
  renderPersonnel();
}

function setPersonnelPaginationButtons(pageCount) {
  document.getElementById("personnelPrevPage").disabled = state.personnelPage <= 1;
  document.getElementById("personnelNextPage").disabled = state.personnelPage >= pageCount;
}

function handlePersonnelTableClick(event) {
  const historyButton = event.target.closest("[data-personnel-history-index]");
  if (historyButton) {
    const record = state.personnelVisibleRecords?.[Number(historyButton.dataset.personnelHistoryIndex)];
    if (record) openPersonnelDetail(record);
    return;
  }

  const menuButton = event.target.closest("[data-personnel-menu]");
  if (menuButton) {
    togglePersonnelRowMenu(menuButton);
    return;
  }

  const button = event.target.closest("[data-personnel-index]");
  if (!button) return;
  const record = state.personnelVisibleRecords?.[Number(button.dataset.personnelIndex)];
  if (!record) return;
  const action = button.dataset.personnelAction || "detail";
  closePersonnelMenus();
  if (action === "edit") openPersonnelForm(record);
  else if (action === "delete") deletePersonnelRecord(record);
  else openPersonnelDetail(record);
}

function openPersonnelDetail(record) {
  const sourceId = record?._PersonSource || state.personnelSource;
  const sheet = getPersonnelSheet(sourceId);
  const personnelName = getPersonnelName(record);
  const history = getPersonnelWorkHistory(personnelName);
  const activeCount = history.filter(item => item.category === "active").length;
  const finishedCount = history.filter(item => item.category === "finished").length;

  document.getElementById("personnelDetailTitle").textContent = personnelName;
  document.getElementById("personnelDetailSource").textContent =
    `${sheet?.label || "Data Personil"} - histori pekerjaan aktif dan selesai`;
  document.getElementById("personnelDetailBody").innerHTML = `
    <section class="personnel-history-profile">
      <div>
        <span>Status</span>
        <strong>${escapeHtml(getPersonnelStatus({ ...record, _PersonSource: sourceId }))}</strong>
      </div>
      <div>
        <span>Jabatan atau Posisi</span>
        <strong>${escapeHtml(getPersonnelPosition(record))}</strong>
      </div>
      <div>
        <span>Pekerjaan Aktif</span>
        <strong>${activeCount}</strong>
      </div>
      <div>
        <span>Histori Selesai</span>
        <strong>${finishedCount}</strong>
      </div>
      <div>
        <span>Total Histori</span>
        <strong>${history.length}</strong>
      </div>
    </section>
    <section class="personnel-history-section">
      <div class="personnel-history-section-header">
        <div>
          <h3>Histori Pekerjaan</h3>
          <p>Pekerjaan aktif ditampilkan lebih dahulu, diikuti pekerjaan yang telah selesai.</p>
        </div>
      </div>
      <div class="personnel-history-table-wrap">
        <table class="personnel-history-table">
          <thead>
            <tr>
              <th>Pekerjaan</th>
              <th>Tahun</th>
              <th>Tanggal Mulai</th>
              <th>Tanggal Selesai</th>
              <th>Status</th>
              <th>Keterlibatan</th>
              <th>Bobot Individual</th>
            </tr>
          </thead>
          <tbody>
            ${history.length ? history.map(item => `
              <tr>
                <td><strong>${escapeHtml(item.pekerjaan)}</strong></td>
                <td>${escapeHtml(item.tahun)}</td>
                <td>${escapeHtml(item.tanggalMulai)}</td>
                <td>${escapeHtml(item.tanggalSelesai)}</td>
                <td><span class="work-status-badge ${item.category}">${escapeHtml(item.status)}</span></td>
                <td>${escapeHtml(item.keterlibatan)}</td>
                <td>${escapeHtml(item.bobot)}</td>
              </tr>
            `).join("") : '<tr><td class="dashboard-summary-empty" colspan="7">Belum ada histori pekerjaan yang cocok pada DATA UTAMA.</td></tr>'}
          </tbody>
        </table>
      </div>
    </section>
  `;
  document.getElementById("personnelDetailModal").showModal();
}

function getPersonnelWorkHistory(personnelName) {
  const sheet = getDataUtamaSheet();
  if (!sheet || sheet.status !== "ready") return [];

  return sheet.records
    .filter(record => {
      const assignmentName = getRecordValue(record, ["nama personil", "nama lengkap", "nama"]);
      return isSamePersonnelName(personnelName, assignmentName);
    })
    .map(record => {
      const isFinished = isFinishedWorkRecord(record);
      const isActive = isActiveWorkRecord(record);
      const statusValue = getRecordValue(record, ["status pekerjaan", "status project", "status proyek"]);
      const years = getRecordYears(record).sort((left, right) => left - right);
      return {
        pekerjaan: getRecordValue(record, ["pekerjaan", "nama pekerjaan", "project", "proyek"]) || "-",
        tahun: years.length
          ? (years.length === 1 ? String(years[0]) : `${years[0]}-${years[years.length - 1]}`)
          : "-",
        tanggalMulai: getRecordValue(record, ["tanggal mulai", "tgl mulai", "mulai"]) || "-",
        tanggalSelesai: getRecordValue(record, ["tanggal selesai", "tgl selesai", "selesai"]) || "-",
        status: statusValue || (isFinished ? "Selesai" : isActive ? "Aktif" : "Belum ditentukan"),
        keterlibatan: getRecordValue(record, ["keterlibatan"]) || "-",
        bobot: normalizeSearchText(getRecordValue(record, ["keterlibatan"])) === "ya" ? "1" : "0",
        category: isFinished ? "finished" : isActive ? "active" : "neutral",
        sortTime: Math.max(
          getComparableDate(getRecordValue(record, ["tanggal selesai", "tgl selesai", "selesai"])),
          getComparableDate(getRecordValue(record, ["tanggal mulai", "tgl mulai", "mulai"]))
        )
      };
    })
    .sort((left, right) => {
      const rank = { active: 0, neutral: 1, finished: 2 };
      return rank[left.category] - rank[right.category] || right.sortTime - left.sortTime;
    });
}

function closePersonnelDetail() {
  document.getElementById("personnelDetailModal").close();
}

function isComputedPersonnelColumn(column) {
  return includesAny(normalizeSearchText(column), [
    "tahun",
    "pekerjaan aktif",
    "tugas aktif",
    "project aktif",
    "keterlibatan pekerjaan",
    "status selesai",
    "akumulasi"
  ]);
}

function getEditablePersonnelColumns(records) {
  const columns = getPersonnelColumns(records).filter(column => !isComputedPersonnelColumn(column));
  if (!columns.some(column => normalizeSearchText(column).includes("posisi penugasan"))) {
    columns.push("POSISI PENUGASAN");
  }
  return columns;
}

function getPersonnelStatusColumn(columns) {
  return columns.find(column => includesAny(normalizeSearchText(column), ["status"])) || "";
}

function normalizePersonnelSourceFromStatus(value, fallbackSource = state.personnelSource) {
  const text = normalizeSearchText(value);
  if (includesAny(text, ["outsourcing", "out sour", "outsourching", "outsorcing"])) return "outsourcing";
  if (includesAny(text, ["bemaco", "bmc", "rekaprima"])) return "personil-bmc";
  return fallbackSource;
}

function normalizePersonnelStatusLabel(sourceId) {
  return sourceId === "outsourcing" ? "Outsourcing" : "Bemaco";
}

function renderPersonnelInput(column, value, required) {
  const normalized = normalizeSearchText(column);
  const escapedColumn = escapeHtml(column);
  const escapedValue = escapeHtml(value);
  if (includesAny(normalized, ["nama personil", "nama lengkap"])) {
    return `<input name="${escapedColumn}" value="${escapedValue}" list="personnelNameSuggestions" autocomplete="off" placeholder="Pilih atau ketik nama personil" ${required ? "required" : ""}>`;
  }
  if (normalized.includes("posisi penugasan")) {
    return renderAssignmentMultiSelect(column, value);
  }
  const statusColumn = includesAny(normalized, ["status"]);
  if (statusColumn) {
    const selectedSource = normalizePersonnelSourceFromStatus(value, state.personnelSource);
    return `
      <select name="${escapedColumn}" ${required ? "required" : ""}>
        <option value="Bemaco" ${selectedSource === "personil-bmc" ? "selected" : ""}>Bemaco</option>
        <option value="Outsourcing" ${selectedSource === "outsourcing" ? "selected" : ""}>Outsourcing</option>
      </select>
    `;
  }
  return `
    <input
      name="${escapedColumn}"
      value="${escapedValue}"
      autocomplete="off"
      ${required ? "required" : ""}
    >
  `;
}

function openPersonnelForm(record = null) {
  if (!requirePermission(
    canManagePersonnel(),
    "Hanya Super Admin, Editor, atau Author yang dapat mengubah data personil."
  )) return;

  const sheet = getPersonnelSheet();
  if (!sheet || sheet.status !== "ready") {
    notify("Data personil belum selesai dimuat.");
    return;
  }

  const columns = getEditablePersonnelColumns(sheet.records);
  if (!columns.length) {
    notify("Kolom personil belum dapat dikenali.");
    return;
  }

  document.getElementById("personnelFormTitle").textContent =
    record ? "Edit Personil" : "Tambah Personil";
  document.getElementById("personnelFormSource").textContent = sheet.label;
  document.getElementById("personnelFormRow").value = record?.["_Sumber Baris"] || "";
  const personnelFormFields = document.getElementById("personnelFormFields");
  personnelFormFields.innerHTML = `
    <datalist id="personnelNameSuggestions"></datalist>
    ${columns.map((column, index) => `
      <label class="${columns.length % 2 && index === columns.length - 1 ? "full" : ""}">
        <span>${escapeHtml(humanizeFieldName(column))}</span>
        ${renderPersonnelInput(column, record?.[column] || "", index === 0)}
      </label>
    `).join("")}
  `;
  renderPersonnelNameSuggestions();
  bindAssignmentMultiSelects(personnelFormFields);
  document.getElementById("personnelFormModal").showModal();
}

function closePersonnelForm() {
  document.getElementById("personnelFormModal").close();
}

async function savePersonnelRecord(event) {
  event.preventDefault();
  if (!requirePermission(
    canManagePersonnel(),
    "Hanya Super Admin, Editor, atau Author yang dapat menyimpan data personil."
  )) return;

  const form = event.currentTarget;
  const rowNumber = Number(document.getElementById("personnelFormRow").value) || 0;
  const data = Object.fromEntries(
    Array.from(new FormData(form).entries()).map(([key, value]) => [key, String(value).trim()])
  );
  const columns = Object.keys(data);
  const statusColumn = getPersonnelStatusColumn(columns);
  const targetSourceId = normalizePersonnelSourceFromStatus(data[statusColumn], state.personnelSource);
  if (statusColumn) data[statusColumn] = normalizePersonnelStatusLabel(targetSourceId);
  await sendPersonnelMutation(rowNumber ? "update" : "add", {
    rowNumber,
    data,
    targetSourceId
  });
}

async function deletePersonnelRecord(record) {
  if (!requirePermission(
    canManagePersonnel(),
    "Hanya Super Admin, Editor, atau Author yang dapat menghapus data personil."
  )) return;
  const rowNumber = Number(record?.["_Sumber Baris"]) || 0;
  if (!rowNumber) return notify("Nomor baris personil tidak ditemukan.");
  if (!confirm(`Hapus data personil "${getPersonnelName(record)}" dari Google Spreadsheet?`)) return;
  await sendPersonnelMutation("delete", { rowNumber, data: {} });
}

async function sendPersonnelMutation(action, payload) {
  if (!window.PERSONNEL_BRIDGE_URL || !window.PERSONNEL_BRIDGE_TOKEN) {
    notify("Apps Script Bridge belum dikonfigurasi. Ikuti panduan BEMACO-SPREADSHEET-BRIDGE.md.");
    return;
  }
  if (!getCurrentUser()) return notify("Silakan login kembali.");

  const submitButton = document.querySelector("#personnelForm button[type='submit']");
  if (submitButton) submitButton.disabled = true;

  try {
    const firebaseIdToken = await getCurrentUser().getIdToken(true);
    await fetch(window.PERSONNEL_BRIDGE_URL, {
      method: "POST",
      mode: "no-cors",
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: JSON.stringify({
        token: window.PERSONNEL_BRIDGE_TOKEN,
        firebaseIdToken,
        action,
        sourceId: state.personnelSource,
        targetSourceId: payload.targetSourceId || state.personnelSource,
        rowNumber: payload.rowNumber || 0,
        data: payload.data || {}
      })
    });

    closePersonnelForm();
    notify(action === "delete"
      ? "Permintaan hapus dikirim ke Google Spreadsheet."
      : "Data personil dikirim ke Google Spreadsheet.");
    await new Promise(resolve => window.setTimeout(resolve, 1400));
    await loadExternalSheetData();
  } catch (error) {
    notify(`Data personil gagal dikirim: ${error.message}`);
  } finally {
    if (submitButton) submitButton.disabled = false;
  }
}

function getPersonnelExportData() {
  const records = getFilteredPersonnelRecords();
  if (!records.length) {
    notify("Tidak ada data personil untuk diekspor.");
    return null;
  }
  return {
    records,
    columns: getPersonnelColumns(records),
    title: document.getElementById("personnelTableTitle").textContent || "Personil"
  };
}

function buildPersonnelExportTable(data) {
  const header = data.columns.map(column =>
    `<th>${escapeHtml(humanizeFieldName(column))}</th>`
  ).join("");
  const rows = data.records.map(record => `
    <tr>
      ${data.columns.map(column => `<td>${escapeHtml(getRecordDisplayValue(record, column))}</td>`).join("")}
    </tr>
  `).join("");
  return `
    <table>
      <thead><tr>${header}</tr></thead>
      <tbody>${rows}</tbody>
    </table>
  `;
}

function exportPersonnelExcel() {
  const data = getPersonnelExportData();
  if (!data) return;
  const html = `
    <html>
      <head>
        <meta charset="utf-8">
        <style>
          table { border-collapse: collapse; width: 100%; font-family: Arial, sans-serif; font-size: 12px; }
          th { background: #e8eef7; color: #111827; font-weight: 700; }
          th, td { border: 1px solid #cbd5e1; padding: 8px; vertical-align: top; }
          h1 { font-family: Arial, sans-serif; font-size: 18px; }
        </style>
      </head>
      <body>
        <h1>${escapeHtml(data.title)}</h1>
        ${buildPersonnelExportTable(data)}
      </body>
    </html>
  `;
  const blob = new Blob([html], { type: "application/vnd.ms-excel;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `${state.personnelSource}-${state.today}.xls`;
  link.click();
  URL.revokeObjectURL(url);
}

function exportPersonnelPdf() {
  const data = getPersonnelExportData();
  if (!data) return;
  const html = `
    <html>
      <head>
        <title>${escapeHtml(data.title)}</title>
        <style>
          @page { size: A4 landscape; margin: 12mm; }
          body { font-family: Arial, sans-serif; color: #111827; }
          h1 { margin: 0 0 6px; font-size: 20px; }
          p { margin: 0 0 14px; color: #64748b; }
          table { border-collapse: collapse; width: 100%; font-size: 10px; }
          th { background: #e8eef7; color: #111827; font-weight: 700; }
          th, td { border: 1px solid #cbd5e1; padding: 6px; vertical-align: top; word-break: break-word; }
          tr { break-inside: avoid; }
        </style>
      </head>
      <body>
        <h1>${escapeHtml(data.title)}</h1>
        <p>Diekspor ${formatHumanDate(state.today)} - ${data.records.length} data</p>
        ${buildPersonnelExportTable(data)}
      </body>
    </html>
  `;
  printHtmlDocument(html);
}


  return {
    bindControls,
    render: renderPersonnel,
    getColumns: getPersonnelColumns,
    getWorkHistory: getPersonnelWorkHistory,
    resetFilters: resetPersonnelFilters,
    changePage: changePersonnelPage,
    handleTableClick: handlePersonnelTableClick,
    openDetail: openPersonnelDetail,
    closeDetail: closePersonnelDetail,
    openForm: openPersonnelForm,
    closeForm: closePersonnelForm,
    saveRecord: savePersonnelRecord,
    exportExcel: exportPersonnelExcel,
    exportPdf: exportPersonnelPdf
  };
}
