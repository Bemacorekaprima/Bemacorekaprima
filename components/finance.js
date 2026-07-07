export function createFinanceFeature(options = {}) {
  const {
    state,
    notify,
    getCurrentUser,
    loadExternalSheetData,
    parseIndonesianNumber,
    getRecordValue,
    normalizeSearchText,
    buildJobsFromAllSources,
    getPortfolioProgress,
    getPortfolioPeople,
    getPortfolioStatusLabel,
    getJobYearLabel,
    getYearFromDateValue,
    getMeaningfulTokens,
    setTextContent,
    escapeHtml,
    safeClassToken,
    humanizeFieldName,
    includesAny,
    requirePermission,
    canManagePersonnel,
    openFinanceDetailRoute
  } = options;

  function bindControls() {
    document.getElementById("refreshFinanceButton")?.addEventListener("click", loadExternalSheetData);
    document.getElementById("financeSearch")?.addEventListener("input", event => {
      state.financeSearch = event.target.value;
      renderFinance();
    });
    document.getElementById("financeStatusFilter")?.addEventListener("change", event => {
      state.financeStatusFilter = event.target.value;
      renderFinance();
    });
    document.getElementById("financeYearFilter")?.addEventListener("change", event => {
      state.financeYear = event.target.value;
      renderFinance();
    });
    document.getElementById("resetFinanceFilters")?.addEventListener("click", resetFinanceFilters);
    document.getElementById("financeTableBody")?.addEventListener("click", handleFinanceTableClick);
    document.getElementById("financeTableBody")?.addEventListener("keydown", handleFinanceTableKeydown);
    document.getElementById("financeMobileList")?.addEventListener("click", handleFinanceMobileClick);
    document.getElementById("financeToolsButton")?.addEventListener("click", toggleFinanceToolsMenu);
    document.getElementById("financeAddRecordButton")?.addEventListener("click", () => handleFinanceAction("add"));
    document.getElementById("financeEditRecordButton")?.addEventListener("click", () => handleFinanceAction("edit"));
    document.getElementById("financeDeleteRecordButton")?.addEventListener("click", () => handleFinanceAction("delete"));
    document.getElementById("financeDetailAddButton")?.addEventListener("click", () => handleFinanceAction("add"));
    document.getElementById("financeDetailEditButton")?.addEventListener("click", () => handleFinanceAction("edit"));
    document.getElementById("financeDetailDeleteButton")?.addEventListener("click", () => handleFinanceAction("delete"));
    document.getElementById("financeDetailBody")?.addEventListener("click", handleFinanceDetailAction);
    document.getElementById("financeRecordForm")?.addEventListener("submit", saveFinanceRecord);
    document.getElementById("financeRecordForm")?.addEventListener("input", handleFinanceRecordFormInput);
    document.getElementById("closeFinanceRecordFormButton")?.addEventListener("click", closeFinanceRecordForm);
    document.getElementById("cancelFinanceRecordFormButton")?.addEventListener("click", closeFinanceRecordForm);
  }

function getFinanceSheet() {
  return state.externalSheets.find(sheet => sheet.id === "finance") || null;
}

function getFinanceAuxSheet(sourceId) {
  return state.externalSheets.find(sheet => sheet.id === sourceId) || null;
}

function parseFinanceNumber(value) {
  const parsed = parseIndonesianNumber(value);
  if (parsed != null) return parsed;

  const numeric = String(value || "").replace(/[^\d,.-]/g, "").trim();
  if (!numeric) return 0;
  const lastComma = numeric.lastIndexOf(",");
  const lastDot = numeric.lastIndexOf(".");
  const decimalSeparator = lastComma > lastDot ? "," : ".";
  const normalized = decimalSeparator === ","
    ? numeric.replace(/\./g, "").replace(",", ".")
    : numeric.replace(/,/g, "");
  const number = Number(normalized);
  return Number.isFinite(number) ? number : 0;
}

function formatFinanceMoney(value) {
  const number = Number(value) || 0;
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0
  }).format(number);
}

function getFinanceRecordJobName(record) {
  return getRecordValue(record, ["pekerjaan", "nama pekerjaan", "project", "proyek"]);
}

function getFinanceJobMatchKey(value) {
  return normalizeSearchText(value)
    .replace(/^(pekerjaan|project|proyek|paket)\s+/g, "")
    .replace(/\s+(pekerjaan|project|proyek|paket)$/g, "")
    .trim();
}

function getFinanceGroupForJob(grouped, jobName) {
  const key = getFinanceJobMatchKey(jobName);
  if (!key) return null;
  if (grouped.has(key)) return grouped.get(key);

  let best = null;
  grouped.forEach(group => {
    if (best) return;
    const financeKey = group.matchKey || getFinanceJobMatchKey(group.pekerjaan);
    if (!financeKey) return;
    const longEnough = key.length >= 18 && financeKey.length >= 18;
    if (longEnough && (key.includes(financeKey) || financeKey.includes(key))) best = group;
  });
  return best;
}

function getFinanceRecordPersonName(record) {
  return getRecordValue(record, ["nama personil", "nama lengkap", "nama"]);
}

function isFinancePersonnelRecord(record) {
  if (getFinanceRecordPersonName(record)) return true;
  return Boolean(getRecordValue(record, [
    "uraian",
    "jabatan",
    "posisi",
    "jumlah bulan",
    "harga satuan",
    "total biaya personil",
    "total harga",
    "pajak pph 21",
    "netto"
  ]));
}

function getFinancePphTaxValue(record) {
  const keys = Object.keys(record || {});
  const exactKey = keys.find(key => {
    const normalized = normalizeSearchText(key);
    return normalized.includes("pajak") && normalized.includes("pph") && normalized.includes("21") && !normalized.includes("tarif");
  });
  if (exactKey) return String(record?.[exactKey] || "").trim();

  const fallbackKey = keys.find(key => {
    const normalized = normalizeSearchText(key);
    return normalized.includes("pph") && normalized.includes("21") && !normalized.includes("tarif");
  });
  return fallbackKey ? String(record?.[fallbackKey] || "").trim() : "";
}

const FINANCE_CONTRACT_ALIASES = [
  "nilai kontrak",
  "kontrak awal",
  "nilai pekerjaan",
  "nilai pagu",
  "pagu anggaran",
  "pagu",
  "nilai hps",
  "hps",
  "harga perkiraan sendiri",
  "nilai kontrak baru",
  "nilai addendum"
];

const FINANCE_CONTRACT_EXCLUDED_KEYWORDS = [
  "total harga",
  "harga satuan",
  "total biaya",
  "biaya personil",
  "pajak",
  "pph",
  "netto",
  "nett",
  "bulan",
  "personil",
  "termin ke",
  "persentase",
  "potongan",
  "nilai bersih",
  "nilai bruto",
  "row",
  "baris"
];

function findFinanceValueColumn(record, aliases, excludedKeywords = []) {
  const normalizedAliases = aliases.map(normalizeSearchText).filter(Boolean);
  const normalizedExcluded = excludedKeywords.map(normalizeSearchText).filter(Boolean);
  const keys = Object.keys(record || {});
  const exactKey = keys.find(key => normalizedAliases.includes(normalizeSearchText(key)));
  if (exactKey) return exactKey;
  return keys.find(key => {
    const normalized = normalizeSearchText(key);
    return normalizedAliases.some(alias => normalized.includes(alias)) &&
      !normalizedExcluded.some(keyword => normalized.includes(keyword));
  }) || "";
}

function getFinanceContractValue(record) {
  const contractKey = findFinanceValueColumn(record, FINANCE_CONTRACT_ALIASES, FINANCE_CONTRACT_EXCLUDED_KEYWORDS);
  return contractKey ? parseFinanceNumber(record?.[contractKey]) : 0;
}

function getPortfolioContractValue(job) {
  return (job?.records || []).reduce((maxValue, record) => {
    const value = getFinanceContractValue(record);
    return Math.max(maxValue, value || 0);
  }, 0);
}

function getFinanceStatusKey(entry) {
  if (!entry.financeRecords.length) return "waiting";
  if (entry.progress >= 100) return "complete";
  return "billing";
}

function getFinanceStatusLabel(entry) {
  return {
    waiting: "Menunggu data Finance",
    complete: "Termin selesai",
    billing: "Tagihan berjalan"
  }[getFinanceStatusKey(entry)] || "Tagihan berjalan";
}

function buildFinanceEntries() {
  const financeSheet = getFinanceSheet();
  const financeRecords = financeSheet?.status === "ready" ? financeSheet.records : [];
  const grouped = new Map();
  financeRecords.forEach(record => {
    const jobName = getFinanceRecordJobName(record) || "Pekerjaan tanpa nama";
    const key = getFinanceJobMatchKey(jobName);
    const group = grouped.get(key) || {
      key,
      matchKey: key,
      pekerjaan: jobName,
      financeRecords: [],
      totalHarga: 0,
      totalBiayaPersonil: 0,
      nilaiKontrak: 0,
      netto: 0,
      pajak: 0,
      pemberiKerja: "",
      tanggalMulai: "",
      tanggalSelesai: ""
    };
    group.financeRecords.push(record);
    const biayaPersonil = parseFinanceNumber(getRecordValue(record, ["total harga", "harga total", "total biaya", "total biaya personil"]));
    const nilaiKontrak = getFinanceContractValue(record);
    group.totalBiayaPersonil += biayaPersonil;
    group.totalHarga = group.totalBiayaPersonil;
    if (nilaiKontrak > group.nilaiKontrak) group.nilaiKontrak = nilaiKontrak;
    group.netto += parseFinanceNumber(getRecordValue(record, ["netto", "nett", "net"]));
    group.pajak += parseFinanceNumber(getFinancePphTaxValue(record));
    group.pemberiKerja ||= getRecordValue(record, ["pemberi kerja", "instansi", "klien", "owner"]);
    group.tanggalMulai ||= getRecordValue(record, ["tanggal mulai", "tgl mulai", "mulai"]);
    group.tanggalSelesai ||= getRecordValue(record, ["tanggal selesai", "tgl selesai", "selesai"]);
    grouped.set(key, group);
  });

  const entries = [];
  const seen = new Set();
  buildJobsFromAllSources().forEach(job => {
    const key = getFinanceJobMatchKey(job.pekerjaan);
    const finance = getFinanceGroupForJob(grouped, job.pekerjaan);
    const progress = getPortfolioProgress(job);
    const people = getPortfolioPeople(job, Infinity);
    const portfolioContractValue = getPortfolioContractValue(job);
    const totalBiayaPersonil = finance?.totalBiayaPersonil || finance?.totalHarga || 0;
    entries.push({
      key,
      pekerjaan: job.pekerjaan,
      job,
      financeRecords: finance?.financeRecords || [],
      totalHarga: totalBiayaPersonil,
      totalBiayaPersonil,
      nilaiKontrak: finance?.nilaiKontrak || portfolioContractValue || totalBiayaPersonil || 0,
      netto: finance?.netto || 0,
      pajak: finance?.pajak || 0,
      pemberiKerja: getRecordValue(job.records?.[0] || {}, ["pemberi kerja", "instansi", "klien", "owner"]) || finance?.pemberiKerja || "",
      tanggalMulai: job.tanggalMulai || "",
      tanggalSelesai: job.tanggalSelesai || "",
      progress,
      status: getPortfolioStatusLabel(job),
      yearLabel: getJobYearLabel(job),
      personil: people,
      source: finance ? "Finance + Portofolio" : "Portofolio"
    });
    if (finance?.matchKey) seen.add(finance.matchKey);
    seen.add(key);
  });

  grouped.forEach((finance, key) => {
    if (seen.has(key)) return;
    entries.push({
      key,
      pekerjaan: finance.pekerjaan,
      job: null,
      financeRecords: finance.financeRecords,
      totalHarga: finance.totalBiayaPersonil || finance.totalHarga,
      totalBiayaPersonil: finance.totalBiayaPersonil || finance.totalHarga,
      nilaiKontrak: finance.nilaiKontrak || finance.totalBiayaPersonil || finance.totalHarga || finance.netto || 0,
      netto: finance.netto,
      pajak: finance.pajak,
      pemberiKerja: finance.pemberiKerja,
      tanggalMulai: finance.tanggalMulai,
      tanggalSelesai: finance.tanggalSelesai,
      progress: 0,
      status: "Finance",
      yearLabel: String(getYearFromDateValue(finance.tanggalMulai) || getYearFromDateValue(finance.tanggalSelesai) || "-"),
      personil: finance.financeRecords.map(getFinanceRecordPersonName).filter(Boolean),
      source: "Finance"
    });
  });

  return entries.sort((a, b) => a.pekerjaan.localeCompare(b.pekerjaan, "id"));
}

function getFilteredFinanceEntries() {
  const query = normalizeSearchText(state.financeSearch);
  const tokens = getMeaningfulTokens(query);
  return buildFinanceEntries().filter(entry => {
    const yearOk = state.financeYear === "all" || String(entry.yearLabel).includes(String(state.financeYear));
    const statusOk = state.financeStatusFilter === "all" || getFinanceStatusKey(entry) === state.financeStatusFilter;
    const haystack = normalizeSearchText([
      entry.pekerjaan,
      entry.pemberiKerja,
      entry.status,
      entry.source,
      entry.personil.join(" "),
      entry.financeRecords.map(record => Object.values(record).join(" ")).join(" ")
    ].join(" "));
    const queryOk = !tokens.length || tokens.every(token => haystack.includes(token));
    return yearOk && statusOk && queryOk;
  });
}

function renderFinanceYearOptions(entries) {
  const select = document.getElementById("financeYearFilter");
  if (!select || document.activeElement === select) return;
  const years = [...new Set(entries.flatMap(entry => String(entry.yearLabel || "").match(/\b(19|20)\d{2}\b/g) || []))]
    .sort((a, b) => Number(b) - Number(a));
  const selected = String(state.financeYear || "all");
  select.innerHTML = ['<option value="all">Semua Tahun</option>', ...years.map(year => `<option value="${year}">${year}</option>`)].join("");
  select.value = years.includes(selected) ? selected : "all";
  state.financeYear = select.value;
}

function renderFinance() {
  const tableBody = document.getElementById("financeTableBody");
  if (!tableBody) return;
  const sheet = getFinanceSheet();
  const allEntries = buildFinanceEntries();
  renderFinanceYearOptions(allEntries);
  const entries = getFilteredFinanceEntries();
  const linkedCount = allEntries.filter(entry => entry.job).length;
  const totalNetto = allEntries.reduce((total, entry) => total + entry.netto, 0);
  const totalTax = allEntries.reduce((total, entry) => total + entry.pajak, 0);
  const activeBills = allEntries.filter(entry => getFinanceStatusKey(entry) === "billing").length;

  setTextContent("financeKpiJobs", allEntries.length);
  setTextContent("financeKpiJobsMeta", `${linkedCount} terhubung portofolio`);
  setTextContent("financeKpiNetto", formatFinanceMoney(totalNetto));
  setTextContent("financeKpiTax", formatFinanceMoney(totalTax));
  setTextContent("financeKpiActiveBills", activeBills);
  setTextContent("financeResultCount", `${entries.length} pekerjaan`);
  setTextContent("financeSyncText", sheet?.status === "ready"
    ? `${sheet.records.length} data tersinkron.`
    : sheet?.status === "loading"
      ? "Memuat data..."
      : sheet?.status === "idle"
        ? "Data belum tersedia. Daftar memakai data Portofolio sebagai kerangka."
        : "Data belum dapat dibaca. Daftar memakai data Portofolio sebagai kerangka.");

  if (!entries.length) {
    tableBody.innerHTML = '<tr><td class="personnel-empty" colspan="8">Tidak ada pekerjaan finance yang cocok.</td></tr>';
  } else {
    tableBody.innerHTML = entries.map(entry => `
      <tr class="clickable-row" data-finance-key="${escapeHtml(entry.key)}" tabindex="0">
        <td data-label="Pekerjaan"><strong>${escapeHtml(entry.pekerjaan)}</strong><small>${escapeHtml(entry.pemberiKerja || entry.source)}</small></td>
        <td data-label="Progress"><div class="finance-progress"><span style="width:${entry.progress}%"></span></div><small>${entry.progress}%</small></td>
        <td data-label="Status"><span class="finance-status ${getFinanceStatusKey(entry)}">${escapeHtml(getFinanceStatusLabel(entry))}</span></td>
        <td data-label="Total Biaya Personil">${formatFinanceMoney(entry.totalBiayaPersonil || entry.totalHarga)}</td>
        <td data-label="Pajak">${formatFinanceMoney(entry.pajak)}</td>
        <td data-label="Netto"><strong>${formatFinanceMoney(entry.netto)}</strong></td>
        <td data-label="Personil">${entry.personil.length || entry.financeRecords.length || 0}</td>
        <td data-label="Aksi"><button class="text-button" type="button" data-finance-open="${escapeHtml(entry.key)}">Rincian</button></td>
      </tr>
    `).join("");
  }
  renderFinanceMobile(entries);
}

function renderFinanceMobile(entries) {
  const container = document.getElementById("financeMobileList");
  if (!container) return;
  container.innerHTML = entries.length ? entries.map(entry => `
    <article class="finance-mobile-card" data-finance-key="${escapeHtml(entry.key)}">
      <header>
        <strong>${escapeHtml(entry.pekerjaan)}</strong>
        <span class="finance-status ${getFinanceStatusKey(entry)}">${escapeHtml(getFinanceStatusLabel(entry))}</span>
      </header>
      <div class="finance-mobile-values">
        <span><small>Netto</small><b>${formatFinanceMoney(entry.netto)}</b></span>
        <span><small>Progress</small><b>${entry.progress}%</b></span>
        <span><small>Personil</small><b>${entry.personil.length || entry.financeRecords.length || 0}</b></span>
      </div>
      <button class="secondary-button" type="button" data-finance-open="${escapeHtml(entry.key)}">Buka rincian</button>
    </article>
  `).join("") : '<p class="portfolio-mobile-empty">Tidak ada pekerjaan finance yang cocok.</p>';
}

function handleFinanceTableClick(event) {
  const key = event.target.closest("[data-finance-open]")?.dataset.financeOpen || event.target.closest("tr[data-finance-key]")?.dataset.financeKey;
  if (!key) return;
  event.preventDefault();
  openFinanceDetail(key);
}

function handleFinanceTableKeydown(event) {
  if (!["Enter", " "].includes(event.key)) return;
  const row = event.target.closest("tr[data-finance-key]");
  if (!row) return;
  event.preventDefault();
  openFinanceDetail(row.dataset.financeKey);
}

function handleFinanceMobileClick(event) {
  const key = event.target.closest("[data-finance-open], [data-finance-key]")?.dataset.financeOpen || event.target.closest("[data-finance-key]")?.dataset.financeKey;
  if (!key) return;
  event.preventDefault();
  openFinanceDetail(key);
}

function openFinanceDetail(key, options = {}) {
  const entry = buildFinanceEntries().find(item => item.key === key);
  if (!entry) return notify("Rincian Finance tidak ditemukan.");
  state.selectedFinanceJobKey = key;
  if (options.route !== false && typeof openFinanceDetailRoute === "function") {
    openFinanceDetailRoute(entry);
    return;
  }
  renderFinanceDetail(entry);
}

function getFinanceEntryIdentifier(entry) {
  return entry?.key || getFinanceJobMatchKey(entry?.pekerjaan || "");
}

function financeRecordMatchesEntry(record, entry) {
  const entryId = getFinanceEntryIdentifier(entry);
  const recordJobId = getFinanceJobMatchKey(getRecordValue(record, ["id pekerjaan", "row key", "id"]));
  const recordJobName = getFinanceJobMatchKey(getRecordValue(record, ["nama pekerjaan", "pekerjaan"]));
  const entryJobName = getFinanceJobMatchKey(entry?.pekerjaan || "");
  return Boolean(
    (entryId && recordJobId && entryId === recordJobId) ||
    (entryJobName && recordJobName && entryJobName === recordJobName)
  );
}

function getFinanceRelatedRecords(sourceId, entry) {
  const sheet = getFinanceAuxSheet(sourceId);
  if (!sheet || sheet.status !== "ready") return [];
  return (sheet.records || []).filter(record => financeRecordMatchesEntry(record, entry));
}

function getFinanceRelatedContractValue(sourceId, entry, aliases = FINANCE_CONTRACT_ALIASES) {
  return getFinanceRelatedRecords(sourceId, entry).reduce((maxValue, record) => {
    const key = findFinanceValueColumn(record, aliases, FINANCE_CONTRACT_EXCLUDED_KEYWORDS);
    const value = key ? parseFinanceNumber(record?.[key]) : 0;
    return Math.max(maxValue, value || 0);
  }, 0);
}

function getResolvedFinanceContractValue(entry) {
  return Number(entry?.nilaiKontrak || 0) ||
    getFinanceRelatedContractValue("finance-addendum", entry, ["nilai kontrak baru", "nilai kontrak", "nilai addendum"]) ||
    getFinanceRelatedContractValue("finance-termin", entry, ["nilai kontrak"]) ||
    getPortfolioContractValue(entry?.job) ||
    Number(entry?.totalBiayaPersonil || entry?.totalHarga || entry?.netto || 0);
}

function getFinanceTerminPlan(entry) {
  const contractValue = getResolvedFinanceContractValue(entry);
  const records = getFinanceRelatedRecords("finance-termin", entry);
  const upfrontRecord = records.find(record => normalizeSearchText(getRecordValue(record, ["tahap pembayaran", "nama termin"])).includes("uang muka"));
  const upfrontPercent = parseFinanceNumber(getRecordValue(upfrontRecord || {}, ["persentase termin", "persentase", "prosentase", "persen"])) || 0;
  const upfrontValue = parseFinanceNumber(getRecordValue(upfrontRecord || {}, ["nilai bruto", "nilai termin", "nominal termin", "nilai bersih", "netto"])) ||
    Math.round(contractValue * upfrontPercent / 100);
  return records
    .map((record, index) => {
      const label = getRecordValue(record, ["tahap pembayaran", "nama termin"]) || `Tahap ${getRecordValue(record, ["termin ke"]) || index + 1}`;
      const isUpfront = normalizeSearchText(label).includes("uang muka");
      const percent = parseFinanceNumber(getRecordValue(record, ["persentase termin", "persentase", "prosentase", "persen"])) || 0;
      const grossValue = parseFinanceNumber(getRecordValue(record, ["nilai bruto", "nilai termin", "nominal termin"])) || Math.round(contractValue * percent / 100);
      const deductionPercent = isUpfront ? 0 : parseFinanceNumber(getRecordValue(record, ["persentase potongan uang muka", "persentase potongan", "potongan persen"])) || 0;
      const deduction = parseFinanceNumber(getRecordValue(record, ["potongan uang muka", "potongan"])) ||
        (deductionPercent ? Math.round(upfrontValue * deductionPercent / 100) : 0);
      const netValue = parseFinanceNumber(getRecordValue(record, ["nilai bersih", "netto"])) || Math.max(0, grossValue - deduction);
      return {
        label,
        percent,
        value: netValue,
        grossValue,
        deduction,
        deductionPercent,
        status: getRecordValue(record, ["status"]) || "Draft",
        className: ["blue", "purple", "green"][index % 3],
        record
      };
    })
    .filter(item => item.label || item.percent || item.grossValue || item.value);
}

function getFinanceTerminPercentTotal(terminPlan) {
  return terminPlan.reduce((total, item) => total + Number(item.percent || 0), 0);
}

function getFinanceTerminValueTotal(terminPlan) {
  return terminPlan.reduce((total, item) => total + Number(item.value || 0), 0);
}

function formatFinanceDeduction(item) {
  if (!item?.deduction) return "-";
  return `${formatFinanceMoney(item.deduction)}${item.deductionPercent ? ` (${item.deductionPercent}%)` : ""}`;
}

function renderFinanceTerminCard(entry, terminPlan, nilaiKontrak) {
  const hasStages = terminPlan.length > 0;
  const terminPercentTotal = getFinanceTerminPercentTotal(terminPlan);
  const terminGrossTotal = terminPlan.reduce((total, item) => total + Number(item.grossValue || item.value || 0), 0);
  const terminValueTotal = getFinanceTerminValueTotal(terminPlan);
  return `
    <article class="finance-termin-card">
      <header class="finance-card-title-row">
        <div>
          <h3>Skema Termin dan Uang Muka</h3>
          <p>${hasStages
            ? "Tahapan pembayaran dihitung dari nilai kontrak dan potongan uang muka."
            : "Belum ada tahapan pembayaran untuk pekerjaan ini."}</p>
        </div>
        <div class="finance-inline-actions">
          <button class="primary-button" type="button" data-finance-termin-action="add">+ Tambah Tahap</button>
          <button class="secondary-button" type="button" data-finance-termin-action="template">Pakai Template</button>
          <button class="secondary-button" type="button" data-finance-termin-action="reset" ${hasStages ? "" : "disabled"}>Reset Skema</button>
        </div>
      </header>
      <div class="finance-termin-kpis">
        <span><small>Nilai Kontrak</small><strong>${formatFinanceMoney(nilaiKontrak)}</strong></span>
        <span><small>Tahapan</small><strong>${terminPlan.length}</strong></span>
        <span><small>Total Bruto</small><strong>${formatFinanceMoney(terminGrossTotal)}</strong></span>
        <span><small>Total Diterima</small><strong>${formatFinanceMoney(terminValueTotal)}</strong></span>
      </div>
      ${hasStages ? `
        <div class="finance-termin-stack" aria-label="Pembagian termin">
          ${terminPlan.map(item => `<span class="${item.className}" style="width:${terminPercentTotal ? Math.max(0, item.percent) / terminPercentTotal * 100 : 0}%"><b>${item.percent}%</b></span>`).join("")}
        </div>
        <div class="table-wrap finance-termin-table-wrap">
          <table class="finance-termin-table">
            <thead>
              <tr><th>Tahap Pembayaran</th><th>Persentase Termin</th><th>Nilai Bruto</th><th>Potongan Uang Muka</th><th>Nilai Bersih</th><th>Status</th><th>Aksi</th></tr>
            </thead>
            <tbody>
              ${terminPlan.map((item, itemIndex) => `
                <tr>
                  <td><strong>${escapeHtml(item.label)}</strong></td>
                  <td>${escapeHtml(item.percent)}%</td>
                  <td>${formatFinanceMoney(item.grossValue || item.value)}</td>
                  <td>${formatFinanceDeduction(item)}</td>
                  <td><strong>${formatFinanceMoney(item.value)}</strong></td>
                  <td><span class="finance-status ${safeClassToken(item.status)}">${escapeHtml(item.status)}</span></td>
                  <td>
                    <button class="text-button" type="button" data-finance-termin-action="edit" data-finance-termin-index="${itemIndex}">Edit</button>
                    <button class="text-button danger-text" type="button" data-finance-termin-action="delete" data-finance-termin-index="${itemIndex}">Hapus</button>
                  </td>
                </tr>
              `).join("")}
            </tbody>
          </table>
        </div>
        <div class="finance-termin-total-note">Total diterima = ${formatFinanceMoney(terminValueTotal)}${nilaiKontrak ? ` dari nilai kontrak ${formatFinanceMoney(nilaiKontrak)}` : ""}.</div>
      ` : `
        <div class="finance-termin-empty">
          <div class="finance-termin-empty-icon" aria-hidden="true">Rp</div>
          <strong>Tahapan belum diisi</strong>
          <p>Tambahkan uang muka, termin, retensi, atau tahap pembayaran lain sesuai kontrak.</p>
        </div>
        <div class="finance-termin-rules">
          <strong>Logika Default</strong>
          <ul>
            <li>Pekerjaan baru tidak membuat termin otomatis.</li>
            <li>Uang muka opsional.</li>
            <li>Total diterima divalidasi terhadap nilai kontrak.</li>
            <li>Persentase boleh fleksibel sesuai kontrak.</li>
          </ul>
        </div>
        <div class="table-wrap finance-termin-table-wrap">
          <table class="finance-termin-table">
            <thead>
              <tr><th>Tahap Pembayaran</th><th>Persentase Termin</th><th>Nilai Bruto</th><th>Potongan Uang Muka</th><th>Nilai Bersih</th><th>Status</th><th>Aksi</th></tr>
            </thead>
            <tbody><tr><td class="personnel-empty" colspan="7">Belum ada data</td></tr></tbody>
          </table>
        </div>
      `}
    </article>
  `;
}

function renderFinanceDetail(entry) {
  const panel = document.getElementById("financeDetailPanel");
  const body = document.getElementById("financeDetailBody");
  if (!panel || !body) return;
  panel.classList.remove("hidden");
  setTextContent("financeDetailTitle", entry.pekerjaan);
  setTextContent("financeDetailMeta", `${entry.source} - ${getFinanceStatusLabel(entry)} - ${entry.progress}% progress`);
  const relatedPersonnel = buildFinanceDetailPersonnel(entry);
  const totalBiayaPersonil = entry.totalBiayaPersonil || entry.totalHarga || 0;
  const nilaiKontrak = getResolvedFinanceContractValue(entry);
  const terminPlan = getFinanceTerminPlan(entry);
  const terminPercentTotal = getFinanceTerminPercentTotal(terminPlan);
  const terminValueTotal = getFinanceTerminValueTotal(terminPlan);
  const terminRemaining = Math.max(0, nilaiKontrak - terminValueTotal);
  const terminReceiptPercent = nilaiKontrak ? Math.round((terminValueTotal / nilaiKontrak) * 100) : terminPercentTotal;
  const terminIsBalanced = Boolean(nilaiKontrak && Math.abs(terminValueTotal - nilaiKontrak) <= 1);
  body.innerHTML = `
    <section class="finance-summary-groups">
      <article class="finance-summary-group contract">
        <header>
          <div>
            <span class="section-eyebrow">KONTRAK DAN TERMIN</span>
          <h3>Nilai Kontrak tersinkron ke termin</h3>
          </div>
          <span class="finance-validation-badge ${terminIsBalanced ? "valid" : "warning"}">${terminReceiptPercent}% diterima</span>
        </header>
        <div class="finance-detail-kpis finance-contract-kpis">
          <article class="primary"><span>Nilai Kontrak</span><strong>${formatFinanceMoney(nilaiKontrak)}</strong><small>Dasar perhitungan termin</small></article>
          <article><span>Total Tahap</span><strong>${terminPercentTotal}%</strong><small>Total persentase bruto</small></article>
          <article><span>Nilai Termin</span><strong>${formatFinanceMoney(terminValueTotal)}</strong><small>Akumulasi rencana termin</small></article>
          <article><span>Sisa Alokasi</span><strong>${formatFinanceMoney(terminRemaining)}</strong><small>Terhadap nilai kontrak</small></article>
        </div>
      </article>
      <article class="finance-summary-group personnel-cost">
        <header>
          <div>
            <span class="section-eyebrow">BIAYA PERSONIL</span>
            <h3>Total biaya personil, PPH 21, dan netto</h3>
          </div>
          <span class="finance-validation-badge neutral">${relatedPersonnel.length} personil</span>
        </header>
        <div class="finance-detail-kpis finance-personnel-kpis">
          <article><span>Total Biaya Personil</span><strong>${formatFinanceMoney(totalBiayaPersonil)}</strong><small>Dari rincian personil</small></article>
          <article><span>PPH 21</span><strong>${formatFinanceMoney(entry.pajak)}</strong><small>Akumulasi pajak personil</small></article>
          <article><span>Netto</span><strong>${formatFinanceMoney(entry.netto)}</strong><small>Total biaya - PPH 21</small></article>
          <article><span>Personil</span><strong>${relatedPersonnel.length}</strong><small>Baris personil terkait</small></article>
        </div>
      </article>
    </section>
    <section class="finance-detail-grid">
      <article class="finance-summary-card">
        <header class="finance-card-title-row">
          <h3>Ringkasan Pekerjaan</h3>
        </header>
        <dl>
          <div><dt>Pemberi Kerja</dt><dd>${escapeHtml(entry.pemberiKerja || "-")}</dd></div>
          <div><dt>Tanggal Mulai</dt><dd>${escapeHtml(entry.tanggalMulai || "-")}</dd></div>
          <div><dt>Tanggal Selesai</dt><dd>${escapeHtml(entry.tanggalSelesai || "-")}</dd></div>
          <div><dt>Status Portofolio</dt><dd>${escapeHtml(entry.status || "-")}</dd></div>
        </dl>
      </article>
      ${renderFinanceTerminCard(entry, terminPlan, nilaiKontrak)}
    </section>
    <section class="finance-personnel-value-section">
      <header class="finance-card-title-row">
        <h3>Personil dan Nilai</h3>
        <button class="secondary-button" type="button" data-finance-record-action="add-personnel">+ Tambah Nilai Personil</button>
      </header>
      <div class="finance-personnel-cost-strip" aria-label="Ringkasan biaya personil">
        <span><small>Total Biaya Personil</small><strong>${formatFinanceMoney(totalBiayaPersonil)}</strong></span>
        <span><small>PPH 21</small><strong>${formatFinanceMoney(entry.pajak)}</strong></span>
        <span><small>Netto</small><strong>${formatFinanceMoney(entry.netto)}</strong></span>
      </div>
      <div class="table-wrap finance-detail-table-wrap">
        <table class="finance-detail-table">
          <thead><tr><th>Nama</th><th>Uraian/Jabatan</th><th>Bulan</th><th>Harga Satuan</th><th>Total Biaya</th><th>Pajak PPH 21</th><th>Netto</th><th>Keterangan</th><th>Aksi</th></tr></thead>
          <tbody>${relatedPersonnel.length ? relatedPersonnel.map((row, rowIndex) => `
            <tr>
              <td data-label="Nama"><strong>${escapeHtml(row.nama)}</strong></td>
              <td data-label="Uraian/Jabatan">${escapeHtml(row.uraian)}</td>
              <td data-label="Bulan">${escapeHtml(row.bulan)}</td>
              <td data-label="Harga Satuan">${row.hasFinance ? formatFinanceMoney(row.hargaSatuan) : "-"}</td>
              <td data-label="Total Biaya">${row.hasFinance ? formatFinanceMoney(row.total) : "-"}</td>
              <td data-label="Pajak PPH 21">${row.hasFinance ? formatFinanceMoney(row.pajak) : "-"}</td>
              <td data-label="Netto">${row.hasFinance ? formatFinanceMoney(row.netto) : "-"}</td>
              <td data-label="Keterangan">${escapeHtml(row.keterangan)}</td>
              <td data-label="Aksi">${row.record ? `<button class="text-button" type="button" data-finance-record-action="edit" data-finance-record-index="${rowIndex}">Edit Nilai</button><button class="text-button danger-text" type="button" data-finance-record-action="delete" data-finance-record-index="${rowIndex}">Hapus</button>` : `<button class="text-button" type="button" data-finance-record-action="complete" data-finance-record-index="${rowIndex}">Tambah Nilai</button>`}</td>
            </tr>
          `).join("") : '<tr><td class="personnel-empty" colspan="9">Belum ada rincian personil Finance untuk pekerjaan ini.</td></tr>'}</tbody>
        </table>
      </div>
    </section>
  `;
}

function getFinanceRecordKey(record) {
  const name = getFinanceRecordPersonName(record);
  return canonicalPersonnelName(name) || normalizeSearchText(name);
}

function getPortfolioFinancePersonRows(entry) {
  const records = entry?.job?.records || [];
  const rows = [];
  const seen = new Set();
  records.forEach(record => {
    const nama = getRecordValue(record, ["nama personil", "nama lengkap", "nama"]);
    const key = canonicalPersonnelName(nama) || normalizeSearchText(nama);
    if (!nama || seen.has(key)) return;
    seen.add(key);
    rows.push({
      key,
      nama,
      uraian: getRecordValue(record, [
        "uraian",
        "jabatan",
        "posisi",
        "posisi/jabatan (kontrak)",
        "posisi/jabatan"
      ]) || "Terhubung dari Portofolio/Personil",
      bulan: getRecordValue(record, ["jumlah bulan", "bulan", "durasi kontrak"]) || "-",
      record
    });
  });
  return rows;
}

function buildFinanceDetailRowFromRecord(record, fallback = {}) {
  return {
    nama: getFinanceRecordPersonName(record) || fallback.nama || "Tanpa nama",
    uraian: getRecordValue(record, ["uraian", "jabatan", "posisi"]) || fallback.uraian || "-",
    bulan: getRecordValue(record, ["jumlah bulan", "bulan", "durasi kontrak"]) || fallback.bulan || "-",
    hargaSatuan: parseFinanceNumber(getRecordValue(record, ["harga satuan", "remunerasi", "rate"])),
    total: parseFinanceNumber(getRecordValue(record, ["total biaya personil", "total harga", "harga total"])),
    tarifPajak: getRecordValue(record, ["tarif pajak", "tarif pph 21", "tarif pph", "pph"]),
    pajak: parseFinanceNumber(getFinancePphTaxValue(record)),
    netto: parseFinanceNumber(getRecordValue(record, ["netto", "nett", "net"])),
    keterangan: getRecordValue(record, ["keterangan", "catatan", "note"]) || "-",
    hasFinance: true,
    record
  };
}

function buildFinanceDetailPersonnel(entry) {
  const financeByName = new Map();
  const personnelRecords = (entry.financeRecords || []).filter(isFinancePersonnelRecord);
  personnelRecords.forEach(record => {
    const key = getFinanceRecordKey(record);
    if (key && !financeByName.has(key)) financeByName.set(key, record);
  });

  const rows = [];
  const usedFinanceKeys = new Set();
  getPortfolioFinancePersonRows(entry).forEach(person => {
    const financeRecord = financeByName.get(person.key);
    if (financeRecord) {
      rows.push(buildFinanceDetailRowFromRecord(financeRecord, person));
      usedFinanceKeys.add(person.key);
      return;
    }
    rows.push({
      nama: person.nama,
      uraian: person.uraian,
      bulan: person.bulan,
      hargaSatuan: 0,
      total: 0,
      tarifPajak: "",
      pajak: 0,
      netto: 0,
      keterangan: "Menunggu rincian finance",
      hasFinance: false,
      record: null,
      seed: person
    });
  });

  personnelRecords.forEach(record => {
    const key = getFinanceRecordKey(record);
    if (key && usedFinanceKeys.has(key)) return;
    rows.push(buildFinanceDetailRowFromRecord(record));
  });

  if (!rows.length) {
    return (entry.personil || []).map(name => ({
      nama: name,
      uraian: "Terhubung dari Portofolio/Personil",
      bulan: "-",
      hargaSatuan: 0,
      total: 0,
      tarifPajak: "",
      pajak: 0,
      netto: 0,
      keterangan: "Menunggu rincian finance",
      hasFinance: false,
      record: null,
      seed: { nama: name, uraian: "Terhubung dari Portofolio/Personil", bulan: "-" }
    }));
  }

  return rows;
}

function resetFinanceFilters() {
  state.financeSearch = "";
  state.financeStatusFilter = "all";
  state.financeYear = "all";
  const search = document.getElementById("financeSearch");
  const status = document.getElementById("financeStatusFilter");
  const year = document.getElementById("financeYearFilter");
  if (search) search.value = "";
  if (status) status.value = "all";
  if (year) year.value = "all";
  renderFinance();
}

function toggleFinanceToolsMenu() {
  const menu = document.getElementById("financeToolsMenu");
  const button = document.getElementById("financeToolsButton");
  if (!menu || !button) return;
  const willOpen = menu.classList.contains("hidden");
  menu.classList.toggle("hidden", !willOpen);
  button.setAttribute("aria-expanded", String(willOpen));
}
function handleFinanceAction(action) {
  document.getElementById("financeToolsMenu")?.classList.add("hidden");
  document.getElementById("financeToolsButton")?.setAttribute("aria-expanded", "false");
  const entry = buildFinanceEntries().find(item => item.key === state.selectedFinanceJobKey) || getFilteredFinanceEntries()[0] || null;
  if (action === "add") {
    openFinanceContractForm(null, entry);
    return;
  }
  const record = getFinanceContractRecord(entry);
  if (!record) {
    notify("Nilai kontrak belum ada. Gunakan Tambah untuk membuat data kontrak Finance.");
    return;
  }
  if (action === "edit") openFinanceContractForm(record, entry);
  if (action === "delete") deleteFinanceRecord(record, entry);
}

function getFinanceEditableColumns(records = []) {
  const ignored = new Set(["_Sumber Baris"]);
  const columns = [];
  records.forEach(record => {
    Object.keys(record || {}).forEach(column => {
      if (!ignored.has(column) && !columns.includes(column)) columns.push(column);
    });
  });
  if (columns.length) return columns;
  return ["Pekerjaan", "Nama", "Uraian", "Pemberi Kerja", "Nilai Kontrak", "Jumlah Bulan", "Harga Satuan", "Total Biaya Personil", "Tarif Pajak", "Pajak PPH 21", "Netto", "Tanggal Mulai", "Tanggal Selesai", "Durasi Kontrak", "Keterangan"];
}

const FINANCE_CONTRACT_FIELDS = [
  { column: "Pekerjaan", aliases: ["pekerjaan", "nama pekerjaan", "project", "proyek"], required: true, full: true },
  { column: "Nilai Kontrak", aliases: ["nilai kontrak", "kontrak awal", "nilai pekerjaan", "nilai pagu"], required: true },
  { column: "Pemberi Kerja", aliases: ["pemberi kerja", "instansi", "klien", "owner"] },
  { column: "Tanggal Mulai", aliases: ["tanggal mulai", "tgl mulai", "mulai"] },
  { column: "Tanggal Selesai", aliases: ["tanggal selesai", "tgl selesai", "selesai"] },
  { column: "Keterangan", aliases: ["keterangan", "catatan", "note"], full: true }
];

const FINANCE_TERMIN_FIELDS = [
  { column: "ID", aliases: ["id"] },
  { column: "ID Pekerjaan", aliases: ["id pekerjaan"], required: true },
  { column: "Nama Pekerjaan", aliases: ["nama pekerjaan", "pekerjaan"], required: true, full: true },
  { column: "Termin Ke", aliases: ["termin ke", "termin"] },
  { column: "Tahap Pembayaran", aliases: ["tahap pembayaran", "nama termin"], required: true },
  { column: "Persentase Termin", aliases: ["persentase termin", "persentase", "prosentase", "persen"], required: true },
  { column: "Persentase Potongan Uang Muka", aliases: ["persentase potongan uang muka", "persentase potongan", "potongan persen"] },
  { column: "Nilai Kontrak", aliases: ["nilai kontrak"], required: true },
  { column: "Nilai Bruto", aliases: ["nilai bruto", "nilai termin", "nominal termin"] },
  { column: "Potongan Uang Muka", aliases: ["potongan uang muka", "potongan"] },
  { column: "Nilai Bersih", aliases: ["nilai bersih", "netto"] },
  { column: "Status", aliases: ["status"] },
  { column: "Tanggal Tagihan", aliases: ["tanggal tagihan", "tgl tagihan"] },
  { column: "Tanggal Bayar", aliases: ["tanggal bayar", "tgl bayar"] },
  { column: "Keterangan", aliases: ["keterangan", "catatan", "note"], full: true }
];

const FINANCE_ADDENDUM_FIELDS = [
  { column: "ID", aliases: ["id"] },
  { column: "ID Pekerjaan", aliases: ["id pekerjaan"], required: true },
  { column: "Nama Pekerjaan", aliases: ["nama pekerjaan", "pekerjaan"], required: true, full: true },
  { column: "Addendum Ke", aliases: ["addendum ke", "addendum"] },
  { column: "Nama Addendum", aliases: ["nama addendum"], required: true },
  { column: "Nilai Kontrak Sebelum", aliases: ["nilai kontrak sebelum"] },
  { column: "Nilai Addendum", aliases: ["nilai addendum"], required: true },
  { column: "Nilai Kontrak Baru", aliases: ["nilai kontrak baru"] },
  { column: "Tanggal Addendum", aliases: ["tanggal addendum", "tgl addendum"] },
  { column: "Status", aliases: ["status"] },
  { column: "Keterangan", aliases: ["keterangan", "catatan", "note"], full: true }
];

function resolveFinanceColumn(columns, field) {
  const normalizedField = normalizeSearchText(field.column);
  const aliases = [normalizedField, ...(field.aliases || []).map(normalizeSearchText)];
  return columns.find(column => aliases.includes(normalizeSearchText(column))) ||
    columns.find(column => includesAny(normalizeSearchText(column), field.aliases || [])) ||
    field.column;
}

function renderFinanceInput(column, value, required, options = {}) {
  const attributes = [
    'name="' + escapeHtml(column) + '"',
    'value="' + escapeHtml(value) + '"',
    'autocomplete="off"',
    options.readonly ? 'readonly' : '',
    options.inputMode ? 'inputmode="' + escapeHtml(options.inputMode) + '"' : '',
    options.placeholder ? 'placeholder="' + escapeHtml(options.placeholder) + '"' : '',
    required ? 'required' : ''
  ].filter(Boolean).join(" ");
  return '<input ' + attributes + '>';
}

function getFinanceInputOptions(sourceId, column) {
  const normalized = normalizeSearchText(column);
  if (sourceId !== "finance-termin") return {};
  if (["id", "id pekerjaan", "nama pekerjaan", "nilai kontrak", "nilai bruto", "potongan uang muka", "nilai bersih"].includes(normalized)) {
    return { readonly: true };
  }
  if (includesAny(normalized, ["persentase", "nilai", "termin ke"])) return { inputMode: "decimal" };
  return {};
}

function setFinanceSeedValue(target, columns, keywords, value) {
  if (!value) return;
  const column = columns.find(item => includesAny(normalizeSearchText(item), keywords));
  if (column && !target[column]) target[column] = value;
}

function applyFinanceSeedToRecord(target, columns, seed) {
  setFinanceSeedValue(target, columns, ["nama"], seed.nama);
  setFinanceSeedValue(target, columns, ["uraian", "jabatan", "posisi"], seed.uraian);
  setFinanceSeedValue(target, columns, ["jumlah bulan", "bulan", "durasi kontrak"], seed.bulan);
}

function makeFinanceLocalId(prefix) {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`.toUpperCase();
}

function setFinanceValueByField(target, columns, field, value) {
  if (value == null || value === "") return;
  const column = resolveFinanceColumn(columns, field);
  target[column] = String(value);
}

function getFinanceColumnsForSource(sourceId, fallbackFields = []) {
  const sheet = sourceId === "finance" ? getFinanceSheet() : getFinanceAuxSheet(sourceId);
  const records = sheet?.records || [];
  const columns = records.length
    ? getFinanceEditableColumns(records)
    : fallbackFields.map(field => field.column);
  fallbackFields.forEach(field => {
    if (!columns.some(column => normalizeSearchText(column) === normalizeSearchText(field.column))) {
      columns.push(field.column);
    }
  });
  return columns;
}

function seedFinanceTerminRecord(entry, terminItem = null) {
  const columns = getFinanceColumnsForSource("finance-termin", FINANCE_TERMIN_FIELDS);
  const nextIndex = getFinanceRelatedRecords("finance-termin", entry).length + 1;
  const sequence = terminItem?.sequence || getRecordValue(terminItem?.record || {}, ["termin ke"]) || nextIndex;
  const percent = terminItem?.percent || 0;
  const nilaiKontrak = getResolvedFinanceContractValue(entry);
  const grossValue = terminItem?.grossValue ?? (percent ? Math.round(nilaiKontrak * percent / 100) : "");
  const deduction = terminItem?.deduction || "";
  const netValue = terminItem?.value ?? (grossValue ? Math.max(0, Number(grossValue) - Number(deduction || 0)) : "");
  const seed = {};
  setFinanceValueByField(seed, columns, FINANCE_TERMIN_FIELDS[0], terminItem?.record ? "" : makeFinanceLocalId("TRM"));
  setFinanceValueByField(seed, columns, FINANCE_TERMIN_FIELDS[1], getFinanceEntryIdentifier(entry));
  setFinanceValueByField(seed, columns, FINANCE_TERMIN_FIELDS[2], entry?.pekerjaan || "");
  setFinanceValueByField(seed, columns, FINANCE_TERMIN_FIELDS[3], sequence);
  setFinanceValueByField(seed, columns, FINANCE_TERMIN_FIELDS[4], terminItem?.label || `Tahap ${sequence}`);
  setFinanceValueByField(seed, columns, FINANCE_TERMIN_FIELDS[5], percent || "");
  setFinanceValueByField(seed, columns, FINANCE_TERMIN_FIELDS[6], terminItem?.deductionPercent || "");
  setFinanceValueByField(seed, columns, FINANCE_TERMIN_FIELDS[7], nilaiKontrak || "");
  setFinanceValueByField(seed, columns, FINANCE_TERMIN_FIELDS[8], grossValue);
  setFinanceValueByField(seed, columns, FINANCE_TERMIN_FIELDS[9], deduction);
  setFinanceValueByField(seed, columns, FINANCE_TERMIN_FIELDS[10], netValue);
  setFinanceValueByField(seed, columns, FINANCE_TERMIN_FIELDS[11], terminItem?.status || getRecordValue(terminItem?.record || {}, ["status"]) || "Draft");
  return seed;
}

function buildFinanceTerminTemplateRecords(entry) {
  const nilaiKontrak = Number(getResolvedFinanceContractValue(entry) || 0);
  if (!nilaiKontrak) return [];
  const uangMuka = Math.round(nilaiKontrak * 0.15);
  const templates = [
    { sequence: 1, label: "Uang Muka", percent: 15, grossValue: uangMuka, deduction: 0, value: uangMuka, status: "Rencana" },
    { sequence: 2, label: "Termin 1", percent: 30, deductionPercent: 20, grossValue: Math.round(nilaiKontrak * 0.30), deduction: Math.round(uangMuka * 0.20), status: "Rencana" },
    { sequence: 3, label: "Termin 2", percent: 40, deductionPercent: 40, grossValue: Math.round(nilaiKontrak * 0.40), deduction: Math.round(uangMuka * 0.40), status: "Rencana" },
    { sequence: 4, label: "Termin 3", percent: 30, deductionPercent: 40, grossValue: Math.round(nilaiKontrak * 0.30), deduction: Math.round(uangMuka * 0.40), status: "Rencana" }
  ];
  return templates.map(item => seedFinanceTerminRecord(entry, {
    ...item,
    value: item.value ?? Math.max(0, Number(item.grossValue || 0) - Number(item.deduction || 0))
  }));
}

function getFinanceDataKey(data, field) {
  const keys = Object.keys(data || {});
  const resolved = resolveFinanceColumn(keys, field);
  return keys.find(key => normalizeSearchText(key) === normalizeSearchText(resolved)) || resolved;
}

function getFinanceDataByField(data, field) {
  return data[getFinanceDataKey(data, field)] || "";
}

function setFinanceDataByField(data, field, value) {
  const key = getFinanceDataKey(data, field);
  data[key] = value == null ? "" : String(value);
}

function getFinanceUpfrontBase(entry, draftData = null) {
  const draftLabel = draftData ? normalizeSearchText(getFinanceDataByField(draftData, FINANCE_TERMIN_FIELDS[4])) : "";
  const draftPercent = draftData ? parseFinanceNumber(getFinanceDataByField(draftData, FINANCE_TERMIN_FIELDS[5])) : 0;
  const draftContract = draftData ? parseFinanceNumber(getFinanceDataByField(draftData, FINANCE_TERMIN_FIELDS[7])) : 0;
  if (draftLabel.includes("uang muka")) return Math.round(draftContract * draftPercent / 100);
  const upfront = getFinanceTerminPlan(entry).find(item => normalizeSearchText(item.label).includes("uang muka"));
  return Number(upfront?.grossValue || upfront?.value || 0);
}

function applyFinanceTerminCalculatedValues(data, entry) {
  const contractValue = parseFinanceNumber(getFinanceDataByField(data, FINANCE_TERMIN_FIELDS[7])) || Number(getResolvedFinanceContractValue(entry) || 0);
  const label = normalizeSearchText(getFinanceDataByField(data, FINANCE_TERMIN_FIELDS[4]));
  const percent = parseFinanceNumber(getFinanceDataByField(data, FINANCE_TERMIN_FIELDS[5])) || 0;
  const deductionPercent = label.includes("uang muka") ? 0 : parseFinanceNumber(getFinanceDataByField(data, FINANCE_TERMIN_FIELDS[6])) || 0;
  const grossValue = percent ? Math.round(contractValue * percent / 100) : 0;
  const upfrontBase = getFinanceUpfrontBase(entry, data);
  const deduction = deductionPercent && upfrontBase ? Math.round(upfrontBase * deductionPercent / 100) : 0;
  const netValue = Math.max(0, grossValue - deduction);
  setFinanceDataByField(data, FINANCE_TERMIN_FIELDS[7], contractValue || "");
  setFinanceDataByField(data, FINANCE_TERMIN_FIELDS[8], grossValue || "");
  setFinanceDataByField(data, FINANCE_TERMIN_FIELDS[9], deduction || "");
  setFinanceDataByField(data, FINANCE_TERMIN_FIELDS[10], netValue || "");
  return data;
}

function updateFinanceTerminComputedFields() {
  const form = document.getElementById("financeRecordForm");
  if (!form || document.getElementById("financeRecordSourceId")?.value !== "finance-termin") return;
  const data = Object.fromEntries(Array.from(new FormData(form).entries()));
  applyFinanceTerminCalculatedValues(data, getCurrentFinanceEntry());
  [FINANCE_TERMIN_FIELDS[7], FINANCE_TERMIN_FIELDS[8], FINANCE_TERMIN_FIELDS[9], FINANCE_TERMIN_FIELDS[10]].forEach(field => {
    const key = getFinanceDataKey(data, field);
    const input = form.elements[key];
    if (input) input.value = data[key] || "";
  });
}

function handleFinanceRecordFormInput() {
  updateFinanceTerminComputedFields();
}

function seedFinanceAddendumRecord(entry) {
  const columns = getFinanceColumnsForSource("finance-addendum", FINANCE_ADDENDUM_FIELDS);
  const nextIndex = getFinanceRelatedRecords("finance-addendum", entry).length + 1;
  const nilaiKontrak = getResolvedFinanceContractValue(entry);
  const seed = {};
  setFinanceValueByField(seed, columns, FINANCE_ADDENDUM_FIELDS[0], makeFinanceLocalId("ADD"));
  setFinanceValueByField(seed, columns, FINANCE_ADDENDUM_FIELDS[1], getFinanceEntryIdentifier(entry));
  setFinanceValueByField(seed, columns, FINANCE_ADDENDUM_FIELDS[2], entry?.pekerjaan || "");
  setFinanceValueByField(seed, columns, FINANCE_ADDENDUM_FIELDS[3], nextIndex);
  setFinanceValueByField(seed, columns, FINANCE_ADDENDUM_FIELDS[4], `Addendum ${nextIndex}`);
  setFinanceValueByField(seed, columns, FINANCE_ADDENDUM_FIELDS[5], nilaiKontrak || "");
  setFinanceValueByField(seed, columns, FINANCE_ADDENDUM_FIELDS[9], "Draft");
  return seed;
}

function openFinanceAuxForm({ sourceId, title, entry, record = null, fields, seed = {} }) {
  if (!requirePermission(canManagePersonnel(), "Hanya Super Admin, Editor, atau Author yang dapat mengubah data Finance.")) return;
  const columns = getFinanceColumnsForSource(sourceId, fields);
  const initialRecord = { ...(record || {}), ...seed };
  document.getElementById("financeRecordFormTitle").textContent = title;
  document.getElementById("financeRecordFormSource").textContent = "";
  document.getElementById("financeRecordRowNumber").value = record?.["_Sumber Baris"] || "";
  document.getElementById("financeRecordSourceId").value = sourceId;
  document.getElementById("financeRecordFormStatus").textContent = "";
  document.getElementById("financeRecordFormFields").innerHTML = fields.map(field => {
    const column = resolveFinanceColumn(columns, field);
    const value = initialRecord[column] || getRecordValue(initialRecord, [field.column, ...(field.aliases || [])]);
    return '<label class="' + (field.full ? 'full' : '') + '"><span>' + escapeHtml(humanizeFieldName(column)) + '</span>' + renderFinanceInput(column, value || "", field.required, getFinanceInputOptions(sourceId, column)) + '</label>';
  }).join("");
  document.getElementById("financeRecordFormModal").showModal();
  updateFinanceTerminComputedFields();
}

function getFinanceContractRecord(entry) {
  return (entry?.financeRecords || []).find(record => getFinanceContractValue(record) > 0) ||
    (entry?.financeRecords || []).find(record => !isFinancePersonnelRecord(record)) ||
    null;
}

function openFinanceContractForm(record = null, entry = null) {
  if (!requirePermission(canManagePersonnel(), "Hanya Super Admin, Editor, atau Author yang dapat mengubah data Finance.")) return;
  const sheet = getFinanceSheet();
  const columns = getFinanceEditableColumns(sheet?.records || []);
  const initialRecord = { ...(record || {}) };
  FINANCE_CONTRACT_FIELDS.forEach(field => {
    const column = resolveFinanceColumn(columns, field);
    if (!initialRecord[column]) {
      if (field.column === "Pekerjaan") initialRecord[column] = entry?.pekerjaan || "";
      if (field.column === "Nilai Kontrak") initialRecord[column] = getResolvedFinanceContractValue(entry) ? String(getResolvedFinanceContractValue(entry)) : "";
      if (field.column === "Pemberi Kerja") initialRecord[column] = entry?.pemberiKerja || "";
      if (field.column === "Tanggal Mulai") initialRecord[column] = entry?.tanggalMulai || "";
      if (field.column === "Tanggal Selesai") initialRecord[column] = entry?.tanggalSelesai || "";
    }
  });
  document.getElementById("financeRecordFormTitle").textContent = record ? "Edit Kontrak Finance" : "Tambah Nilai Kontrak";
  document.getElementById("financeRecordFormSource").textContent = "";
  document.getElementById("financeRecordRowNumber").value = record?.["_Sumber Baris"] || "";
  document.getElementById("financeRecordSourceId").value = "finance";
  document.getElementById("financeRecordFormStatus").textContent = "";
  document.getElementById("financeRecordFormFields").innerHTML = FINANCE_CONTRACT_FIELDS.map(field => {
    const column = resolveFinanceColumn(columns, field);
    return '<label class="' + (field.full ? 'full' : '') + '"><span>' + escapeHtml(humanizeFieldName(column)) + '</span>' + renderFinanceInput(column, initialRecord[column] || "", field.required) + '</label>';
  }).join("");
  document.getElementById("financeRecordFormModal").showModal();
}

function openFinanceRecordForm(record = null, entry = null, seed = null) {
  if (!requirePermission(canManagePersonnel(), "Hanya Super Admin, Editor, atau Author yang dapat mengubah data Finance.")) return;
  const sheet = getFinanceSheet();
  const columns = getFinanceEditableColumns(sheet?.records || []);
  const jobColumn = columns.find(column => includesAny(normalizeSearchText(column), ["pekerjaan", "nama pekerjaan", "project", "proyek"])) || columns[0];
  const initialRecord = { ...(record || {}) };
  if (!record && entry?.pekerjaan && jobColumn) initialRecord[jobColumn] = entry.pekerjaan;
  if (!record && seed) applyFinanceSeedToRecord(initialRecord, columns, seed);
  document.getElementById("financeRecordFormTitle").textContent = record ? "Edit Nilai Personil" : "Tambah Nilai Personil";
  document.getElementById("financeRecordFormSource").textContent = "";
  document.getElementById("financeRecordRowNumber").value = record?.["_Sumber Baris"] || "";
  document.getElementById("financeRecordSourceId").value = "finance";
  document.getElementById("financeRecordFormStatus").textContent = "";
  document.getElementById("financeRecordFormFields").innerHTML = columns.map((column, index) => {
    const full = column === jobColumn || includesAny(normalizeSearchText(column), ["keterangan", "catatan"]);
    return '<label class="' + (full ? 'full' : '') + '"><span>' + escapeHtml(humanizeFieldName(column)) + '</span>' + renderFinanceInput(column, initialRecord[column] || "", column === jobColumn || index === 0) + '</label>';
  }).join("");
  document.getElementById("financeRecordFormModal").showModal();
}

function closeFinanceRecordForm() {
  const modal = document.getElementById("financeRecordFormModal");
  if (modal?.open) modal.close();
}

async function saveFinanceRecord(event) {
  event.preventDefault();
  const form = event.currentTarget;
  const rowNumber = Number(document.getElementById("financeRecordRowNumber").value) || 0;
  const sourceId = document.getElementById("financeRecordSourceId").value || "finance";
  let data = Object.fromEntries(Array.from(new FormData(form).entries()).filter(([key]) => key !== "").map(([key, value]) => [key, String(value).trim()]));
  if (sourceId === "finance-termin") data = applyFinanceTerminCalculatedValues(data, getCurrentFinanceEntry());
  document.getElementById("financeRecordFormStatus").textContent = "Mengirim perubahan...";
  document.getElementById("saveFinanceRecordButton").disabled = true;
  await sendFinanceMutation(rowNumber ? "update" : "add", { rowNumber, data, sourceId, targetSourceId: sourceId });
}

async function sendFinanceMutation(action, payload) {
  if (!window.PERSONNEL_BRIDGE_URL || !window.PERSONNEL_BRIDGE_TOKEN) return notify("Spreadsheet Bridge belum dikonfigurasi.");
  if (!getCurrentUser()) return notify("Silakan login kembali.");
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
        sourceId: payload.sourceId || "finance",
        targetSourceId: payload.targetSourceId || payload.sourceId || "finance",
        rowNumber: payload.rowNumber || 0,
        data: payload.data || {}
      })
    });
    if (action !== "delete" && !payload.keepFormOpen) closeFinanceRecordForm();
    if (!payload.silent) notify(action === "delete" ? "Permintaan hapus Finance dikirim ke Google Spreadsheet." : "Data Finance dikirim ke Google Spreadsheet.");
    if (!payload.skipRefresh) {
      await new Promise(resolve => window.setTimeout(resolve, 1400));
      await loadExternalSheetData();
      refreshCurrentFinanceDetail();
    }
  } catch (error) {
    notify("Data Finance gagal dikirim: " + error.message);
    const status = document.getElementById("financeRecordFormStatus");
    if (status) status.textContent = error.message || "Perubahan gagal dikirim.";
  } finally {
    const saveButton = document.getElementById("saveFinanceRecordButton");
    if (saveButton) saveButton.disabled = false;
  }
}

function getCurrentFinanceEntry() {
  return buildFinanceEntries().find(item => item.key === state.selectedFinanceJobKey) || null;
}

function refreshCurrentFinanceDetail() {
  const panelOpen = !document.getElementById("financeDetailPanel")?.classList.contains("hidden");
  if (!panelOpen || !state.selectedFinanceJobKey) return;
  const entry = getCurrentFinanceEntry();
  if (entry) renderFinanceDetail(entry);
}

function openFinanceTerminForm(entry, terminItem = null) {
  const record = terminItem?.record || null;
  openFinanceAuxForm({
    sourceId: "finance-termin",
    title: terminItem ? "Edit Termin" : "Tambah Termin",
    entry,
    record,
    fields: FINANCE_TERMIN_FIELDS,
    seed: record ? {} : seedFinanceTerminRecord(entry, terminItem)
  });
}

function openFinanceAddendumForm(entry, record = null) {
  openFinanceAuxForm({
    sourceId: "finance-addendum",
    title: record ? "Edit Addendum" : "Tambah Addendum",
    entry,
    record,
    fields: FINANCE_ADDENDUM_FIELDS,
    seed: record ? {} : seedFinanceAddendumRecord(entry)
  });
}

async function deleteFinanceAuxRecord(sourceId, record, label) {
  if (!requirePermission(canManagePersonnel(), "Hanya Super Admin, Editor, atau Author yang dapat menghapus data Finance.")) return;
  const rowNumber = Number(record?.["_Sumber Baris"]) || 0;
  if (!rowNumber) return notify(`${label} default belum tersimpan di spreadsheet.`);
  if (!confirm(`Hapus ${label} dari Google Spreadsheet?`)) return;
  await sendFinanceMutation("delete", { sourceId, targetSourceId: sourceId, rowNumber, data: {} });
}

async function applyFinanceTerminTemplate(entry) {
  if (!requirePermission(canManagePersonnel(), "Hanya Super Admin, Editor, atau Author yang dapat mengubah data Finance.")) return;
  const rows = buildFinanceTerminTemplateRecords(entry);
  if (!rows.length) return notify("Isi Nilai Kontrak terlebih dahulu sebelum memakai template termin.");
  const existingRows = getFinanceRelatedRecords("finance-termin", entry).length;
  if (existingRows && !confirm("Pakai template akan menambahkan tahapan baru di atas data yang sudah ada. Lanjutkan?")) return;
  for (const data of rows) {
    await sendFinanceMutation("add", {
      sourceId: "finance-termin",
      targetSourceId: "finance-termin",
      data,
      silent: true,
      skipRefresh: true,
      keepFormOpen: true
    });
  }
  notify("Template termin dikirim ke Google Spreadsheet.");
  await new Promise(resolve => window.setTimeout(resolve, 1400));
  await loadExternalSheetData();
  refreshCurrentFinanceDetail();
}

async function resetFinanceTerminScheme(entry) {
  if (!requirePermission(canManagePersonnel(), "Hanya Super Admin, Editor, atau Author yang dapat menghapus data Finance.")) return;
  const rows = getFinanceRelatedRecords("finance-termin", entry);
  if (!rows.length) return notify("Belum ada tahapan termin untuk direset.");
  const rowsWithNumbers = rows.filter(row => Number(row?.["_Sumber Baris"]) > 0);
  if (rowsWithNumbers.length !== rows.length) return notify("Sebagian tahapan belum memiliki nomor baris spreadsheet. Refresh data lalu coba lagi.");
  if (!confirm("Reset skema akan menghapus semua tahapan termin pekerjaan ini dari Google Spreadsheet. Lanjutkan?")) return;
  for (const record of rowsWithNumbers) {
    await sendFinanceMutation("delete", {
      sourceId: "finance-termin",
      targetSourceId: "finance-termin",
      rowNumber: Number(record["_Sumber Baris"]),
      data: {},
      silent: true,
      skipRefresh: true
    });
  }
  notify("Skema termin direset di Google Spreadsheet.");
  await new Promise(resolve => window.setTimeout(resolve, 1400));
  await loadExternalSheetData();
  refreshCurrentFinanceDetail();
}

async function handleFinanceDetailAction(event) {
  const terminButton = event.target.closest("[data-finance-termin-action]");
  if (terminButton) {
    const entry = getCurrentFinanceEntry();
    if (!entry) return notify("Rincian Finance tidak ditemukan.");
    const action = terminButton.dataset.financeTerminAction;
    const terminPlan = getFinanceTerminPlan(entry);
    const selectedTermin = terminPlan[Number(terminButton.dataset.financeTerminIndex)] || null;
    if (action === "add") openFinanceTerminForm(entry);
    if (action === "addendum") openFinanceAddendumForm(entry);
    if (action === "template") await applyFinanceTerminTemplate(entry);
    if (action === "reset") await resetFinanceTerminScheme(entry);
    if (action === "edit") openFinanceTerminForm(entry, selectedTermin);
    if (action === "delete") await deleteFinanceAuxRecord("finance-termin", selectedTermin?.record, "Termin");
    return;
  }
  const button = event.target.closest("[data-finance-record-action]");
  if (!button) return;
  const entry = getCurrentFinanceEntry();
  if (!entry) return notify("Rincian Finance tidak ditemukan.");
  if (button.dataset.financeRecordAction === "add-personnel") {
    openFinanceRecordForm(null, entry);
    return;
  }
  const row = buildFinanceDetailPersonnel(entry)[Number(button.dataset.financeRecordIndex)];
  const record = row?.record;
  if (button.dataset.financeRecordAction === "complete") {
    openFinanceRecordForm(null, entry, row?.seed || row);
    return;
  }
  if (!record) return notify("Rincian Finance tidak ditemukan.");
  if (button.dataset.financeRecordAction === "edit") openFinanceRecordForm(record, entry);
  if (button.dataset.financeRecordAction === "delete") deleteFinanceRecord(record, entry);
}

async function deleteFinanceRecord(record, entry = null) {
  if (!requirePermission(canManagePersonnel(), "Hanya Super Admin, Editor, atau Author yang dapat menghapus data Finance.")) return;
  const rowNumber = Number(record?.["_Sumber Baris"]) || 0;
  if (!rowNumber) return notify("Nomor baris Finance tidak ditemukan.");
  const name = getFinanceRecordPersonName(record) || getFinanceRecordJobName(record) || "baris ini";
  if (!confirm('Hapus rincian Finance "' + name + '" dari Google Spreadsheet?')) return;
  await sendFinanceMutation("delete", { rowNumber, data: {} });
}


  return {
    bindControls,
    render: renderFinance,
    resetFilters: resetFinanceFilters,
    toggleToolsMenu: toggleFinanceToolsMenu,
    handleAction: handleFinanceAction,
    handleRecordFormInput: handleFinanceRecordFormInput,
    closeRecordForm: closeFinanceRecordForm,
    handleDetailAction: handleFinanceDetailAction,
    handleTableClick: handleFinanceTableClick,
    handleMobileClick: handleFinanceMobileClick,
    buildEntries: buildFinanceEntries,
    formatMoney: formatFinanceMoney,
    getStatusKey: getFinanceStatusKey,
    getStatusLabel: getFinanceStatusLabel,
    openDetail: openFinanceDetail
  };
}
