export function createTenderFeature(options = {}) {
  const {
    state,
    db,
    doc,
    collection,
    setDoc,
    deleteDoc,
    serverTimestamp,
    notify,
    getCurrentUser,
    normalizeSearchText,
    normalizeEmail,
    escapeHtml,
    formatRupiah,
    getRecordValue,
    requirePermission,
    canManageTenders,
    createTenderChecklist,
    setTenderSyncStatus,
    renderTenderPersonnelSuggestions,
    renderTenderPersonnelReferenceFromForm,
    renderTenderPersonnelMembersFromForm,
    normalizeTenderPersonnelMembers,
    setTenderPersonnelMembersToForm,
    getTenderManualPersonnelFromLegacyFields,
    collectTenderPersonnelMembersForSave,
    getTenderReferencePersonnelMembers,
    createTenderPersonnelRecord,
    TENDER_STORAGE_COLLECTION,
    TENDER_SHEET_SOURCE_ID,
    TENDER_DOCUMENT_STATUSES
  } = options;

  let tenderSheetSyncInProgress = false;
  let lastTenderSheetSignature = "";

  function bindControls() {
    document.getElementById("newTenderButton")?.addEventListener("click", () => openTenderForm());
    document.getElementById("tenderForm")?.addEventListener("submit", saveTender);
    document.getElementById("closeTenderFormButton")?.addEventListener("click", closeTenderForm);
    document.getElementById("cancelTenderFormButton")?.addEventListener("click", closeTenderForm);
    document.getElementById("tenderSearch")?.addEventListener("input", event => {
      state.tenderSearch = event.target.value;
      renderTenders();
    });
    document.getElementById("tenderStatusFilter")?.addEventListener("change", event => {
      state.tenderStatusFilter = event.target.value;
      renderTenders();
    });
    document.getElementById("tenderTableBody")?.addEventListener("click", handleTenderTableClick);
    document.getElementById("editTenderButton")?.addEventListener("click", editSelectedTender);
    document.getElementById("deleteTenderButton")?.addEventListener("click", deleteSelectedTender);
    document.getElementById("saveTenderChecklistButton")?.addEventListener("click", saveTenderChecklist);
    document.getElementById("generateTenderTemplateButton")?.addEventListener("click", generateTenderTemplate);
    document.getElementById("saveTenderTemplateButton")?.addEventListener("click", saveTenderTemplateDraft);
    document.getElementById("printTenderTemplateButton")?.addEventListener("click", printTenderTemplate);
  }

function getSelectedTender() {
  return state.tenders.find(item => item.id === state.selectedTenderId) || null;
}

function getTenderProgress(tender) {
  const documents = createTenderChecklist(tender?.documents);
  const finalCount = documents.filter(item => item.status === "Final").length;
  return {
    documents,
    finalCount,
    total: documents.length,
    percent: documents.length ? Math.round((finalCount / documents.length) * 100) : 0
  };
}

function getFilteredTenders() {
  const keyword = normalizeSearchText(state.tenderSearch);
  return state.tenders.filter(tender => {
    const matchesStatus = state.tenderStatusFilter === "all" ||
      tender.status === state.tenderStatusFilter;
    const searchable = normalizeSearchText([
      tender.name,
      tender.agency,
      tender.location,
      tender.owner,
      tender.ownerEmail,
      tender.status,
      tender.budgetYear
    ].join(" "));
    return matchesStatus && (!keyword || searchable.includes(keyword));
  });
}

function isTenderDeadlineUrgent(tender) {
  if (!tender?.deadline || ["Kontrak", "Arsip", "Siap/Final"].includes(tender.status)) return false;
  const deadline = new Date(tender.deadline).getTime();
  if (!Number.isFinite(deadline)) return false;
  const remainingDays = (deadline - Date.now()) / 86400000;
  return remainingDays >= 0 && remainingDays <= 7;
}

function renderTenders() {
  const body = document.getElementById("tenderTableBody");
  if (!body) return;
  const filtered = getFilteredTenders();
  const selected = getSelectedTender();

  document.getElementById("tenderStatTotal").textContent = state.tenders.length;
  document.getElementById("tenderStatPreparation").textContent =
    state.tenders.filter(item => item.status === "Persiapan").length;
  document.getElementById("tenderStatReady").textContent =
    state.tenders.filter(item => ["Siap/Final", "Kontrak", "Arsip"].includes(item.status)).length;
  document.getElementById("tenderStatUrgent").textContent =
    state.tenders.filter(isTenderDeadlineUrgent).length;

  body.innerHTML = filtered.length
    ? filtered.map(tender => {
      const progress = getTenderProgress(tender);
      return `
        <tr class="clickable-row ${tender.id === state.selectedTenderId ? "selected" : ""}" data-tender-id="${escapeHtml(tender.id)}">
          <td>
            <strong>${escapeHtml(tender.name || "Tanpa nama")}</strong>
            <small>${escapeHtml(tender.location || tender.budgetYear || "")}</small>
          </td>
          <td>${escapeHtml(tender.agency || "-")}</td>
          <td>${escapeHtml(formatTenderDateTime(tender.deadline))}</td>
          <td>
            <div class="tender-table-progress">
              <span style="width:${progress.percent}%"></span>
            </div>
            <small>${progress.percent}%</small>
          </td>
          <td><span class="tender-status-badge">${escapeHtml(tender.status || "Persiapan")}</span></td>
        </tr>
      `;
    }).join("")
    : '<tr><td colspan="5" class="personnel-empty">Belum ada paket tender yang cocok.</td></tr>';

  document.getElementById("tenderEmptyState").classList.toggle("hidden", Boolean(selected));
  document.getElementById("tenderDetailContent").classList.toggle("hidden", !selected);
  if (selected) renderTenderDetail(selected);
}

function handleTenderTableClick(event) {
  const row = event.target.closest("[data-tender-id]");
  if (!row) return;
  state.selectedTenderId = row.dataset.tenderId;
  renderTenders();
}

function openTenderForm(tender = null) {
  if (!requirePermission(canManageTenders(), "Role Anda tidak dapat mengubah paket tender.")) return;
  document.getElementById("tenderForm").reset();
  setTenderFormStatus("");
  document.getElementById("tenderId").value = tender?.id || "";
  document.getElementById("tenderFormTitle").textContent = tender ? "Edit Paket Tender" : "Paket Tender Baru";
  document.getElementById("tenderName").value = tender?.name || "";
  document.getElementById("tenderAgency").value = tender?.agency || "";
  document.getElementById("tenderLocation").value = tender?.location || "";
  document.getElementById("tenderFunding").value = tender?.funding || "";
  document.getElementById("tenderBudgetYear").value = tender?.budgetYear || new Date().getFullYear();
  document.getElementById("tenderBudgetCeiling").value = tender?.budgetCeiling || "";
  document.getElementById("tenderHps").value = tender?.hps || "";
  document.getElementById("tenderMethod").value = tender?.method || "Seleksi kualitas dan biaya";
  document.getElementById("tenderContractType").value = tender?.contractType || "";
  document.getElementById("tenderDeadline").value = tender?.deadline || "";
  document.getElementById("tenderStatus").value = tender?.status || "Persiapan";
  document.getElementById("tenderOwner").value = tender?.owner || "";
  document.getElementById("tenderOwnerEmail").value = tender?.ownerEmail || "";
  document.getElementById("tenderPersonnelName").value = tender?.personnelName || "";
  document.getElementById("tenderPersonnelPosition").value = tender?.personnelPosition || "";
  document.getElementById("tenderPersonnelInvolvement").value = tender?.personnelInvolvement || "";
  setTenderPersonnelMembersToForm([
    ...normalizeTenderPersonnelMembers(tender?.personnelMembers),
    ...getTenderManualPersonnelFromLegacyFields(tender)
  ]);
  document.getElementById("tenderDriveUrl").value = tender?.driveUrl || state.appConfig?.driveUrl || "";
  document.getElementById("tenderNotes").value = tender?.notes || "";
  renderTenderPersonnelSuggestions();
  renderTenderPersonnelReferenceFromForm();
  renderTenderPersonnelMembersFromForm();
  document.getElementById("tenderFormModal").showModal();
}

function closeTenderForm() {
  document.getElementById("tenderFormModal").close();
}

async function saveTender(event) {
  event.preventDefault();
  if (!requirePermission(canManageTenders(), "Role Anda tidak dapat menyimpan paket tender.")) return;

  const tenderId = document.getElementById("tenderId").value;
  const existing = state.tenders.find(item => item.id === tenderId);
  const personnelMembers = collectTenderPersonnelMembersForSave();
  const primaryPersonnel = personnelMembers[0] || {
    name: document.getElementById("tenderPersonnelName").value.trim(),
    position: document.getElementById("tenderPersonnelPosition").value.trim(),
    involvement: document.getElementById("tenderPersonnelInvolvement").value
  };
  const payload = {
    entityType: "tender",
    name: document.getElementById("tenderName").value.trim(),
    agency: document.getElementById("tenderAgency").value.trim(),
    location: document.getElementById("tenderLocation").value.trim(),
    funding: document.getElementById("tenderFunding").value.trim(),
    budgetYear: document.getElementById("tenderBudgetYear").value,
    budgetCeiling: Number(document.getElementById("tenderBudgetCeiling").value || 0),
    hps: Number(document.getElementById("tenderHps").value || 0),
    method: document.getElementById("tenderMethod").value.trim(),
    contractType: document.getElementById("tenderContractType").value.trim(),
    deadline: document.getElementById("tenderDeadline").value,
    status: document.getElementById("tenderStatus").value,
    owner: document.getElementById("tenderOwner").value.trim(),
    ownerEmail: normalizeEmail(document.getElementById("tenderOwnerEmail").value),
    personnelName: primaryPersonnel.name || "",
    personnelPosition: primaryPersonnel.position || "",
    personnelInvolvement: primaryPersonnel.involvement || "",
    personnelMembers,
    driveUrl: document.getElementById("tenderDriveUrl").value.trim(),
    notes: document.getElementById("tenderNotes").value.trim(),
    documents: createTenderChecklist(existing?.documents),
    updatedBy: normalizeEmail(getCurrentUser()?.email),
    updatedAt: serverTimestamp()
  };

  const saveButton = document.getElementById("saveTenderButton");
  saveButton.disabled = true;
  saveButton.textContent = "Menyimpan...";
  setTenderFormStatus("Menyimpan paket ke Firebase...", "loading");
  try {
    const reference = tenderId
      ? doc(db, TENDER_STORAGE_COLLECTION, tenderId)
      : doc(collection(db, TENDER_STORAGE_COLLECTION));
    await setDoc(reference, {
      ...payload,
      ownerUid: existing?.ownerUid || getCurrentUser()?.uid || "",
      createdBy: existing?.createdBy || normalizeEmail(getCurrentUser()?.email),
      createdAt: existing?.createdAt || serverTimestamp()
    }, { merge: true });
    state.selectedTenderId = reference.id;
    await sendTenderSpreadsheetMutation("upsert", { ...existing, ...payload, id: reference.id }, { silent: true });
    setTenderFormStatus("Paket berhasil disimpan.", "success");
    setTenderSyncStatus("ready", "Paket berhasil disimpan dan sedang disinkronkan...");
    await new Promise(resolve => window.setTimeout(resolve, 450));
    closeTenderForm();
  } catch (error) {
    const message = getTenderFirestoreErrorMessage(error, "Paket tender gagal disimpan.");
    setTenderFormStatus(message, "error");
    notify(message);
  } finally {
    saveButton.disabled = false;
    saveButton.textContent = "Simpan Paket";
  }
}

function setTenderFormStatus(message, status = "") {
  const element = document.getElementById("tenderFormStatus");
  if (!element) return;
  element.className = `tender-form-status ${status}`.trim();
  element.textContent = message;
}

function editSelectedTender() {
  const tender = getSelectedTender();
  if (tender) openTenderForm(tender);
}

async function deleteSelectedTender() {
  const tender = getSelectedTender();
  if (!tender || !requirePermission(canManageTenders(), "Role Anda tidak dapat menghapus paket tender.")) return;
  if (!confirm(`Hapus paket tender "${tender.name}" beserta checklist monitoringnya?`)) return;
  try {
    await sendTenderSpreadsheetMutation("deleteByKey", tender, { silent: true });
    await deleteDoc(doc(db, TENDER_STORAGE_COLLECTION, tender.id));
    state.selectedTenderId = "";
  } catch (error) {
    notify(getTenderFirestoreErrorMessage(error, "Paket tender gagal dihapus."));
  }
}

function renderTenderDetail(tender) {
  const progress = getTenderProgress(tender);
  const tenderPersonnel = getTenderPersonnel(tender);
  document.getElementById("tenderDetailStatus").textContent = tender.status || "Persiapan";
  document.getElementById("tenderDetailTitle").textContent = tender.name || "Paket Tender";
  document.getElementById("tenderDetailMeta").textContent =
    [tender.agency, tender.location, tender.budgetYear].filter(Boolean).join(" - ") || "Informasi paket belum lengkap";
  document.getElementById("tenderProgressLabel").textContent = `${progress.percent}% lengkap`;
  document.getElementById("tenderDocumentCount").textContent =
    `${progress.finalCount} dari ${progress.total} dokumen final`;
  document.getElementById("tenderProgressBar").style.width = `${progress.percent}%`;
  document.getElementById("tenderInfoGrid").innerHTML = [
    ["Sumber Dana", escapeHtml(tender.funding || "-")],
    ["Pagu", escapeHtml(formatRupiah(tender.budgetCeiling))],
    ["HPS", escapeHtml(formatRupiah(tender.hps))],
    ["Metode Seleksi", escapeHtml(tender.method || "-")],
    ["Jenis Kontrak", escapeHtml(tender.contractType || "-")],
    ["Status DATA UTAMA", escapeHtml(tender.sourceStatus || "-")],
    ["Jumlah Personil", escapeHtml(String(tenderPersonnel.length || tender.sourcePersonnelCount || "-"))],
    ["Deadline", escapeHtml(formatTenderDateTime(tender.deadline))],
    ["Penanggung Jawab", escapeHtml(tender.owner || "-")],
    ["Nama Personil", escapeHtml(tender.personnelName || "-")],
    ["POSISI/JABATAN", escapeHtml(tender.personnelPosition || "-")],
    ["KETERLIBATAN", escapeHtml(tender.personnelInvolvement || "-")],
    ["Folder Dokumen", tender.driveUrl
      ? `<a href="${escapeHtml(tender.driveUrl)}" target="_blank" rel="noopener noreferrer">Buka folder</a>`
      : "-"]
  ].map(([label, value]) => `
    <div><span>${escapeHtml(label)}</span><strong>${value}</strong></div>
  `).join("");

  document.getElementById("tenderChecklistBody").innerHTML = progress.documents.map(item => `
    <tr data-tender-document-id="${escapeHtml(item.id)}">
      <td>${escapeHtml(item.group)}</td>
      <td><strong>${escapeHtml(item.name)}</strong></td>
      <td>
        <select data-document-field="status" ${canManageTenders() ? "" : "disabled"}>
          ${TENDER_DOCUMENT_STATUSES.map(status =>
            `<option ${status === item.status ? "selected" : ""}>${escapeHtml(status)}</option>`
          ).join("")}
        </select>
      </td>
      <td><input data-document-field="owner" list="tenderPersonnelNameSuggestions" autocomplete="off" value="${escapeHtml(item.owner)}" ${canManageTenders() ? "" : "disabled"}></td>
      <td><input data-document-field="deadline" type="date" value="${escapeHtml(item.deadline)}" ${canManageTenders() ? "" : "disabled"}></td>
      <td class="tender-document-link-cell">
        <input data-document-field="url" type="url" value="${escapeHtml(item.url)}" placeholder="https://..." ${canManageTenders() ? "" : "disabled"}>
        ${item.url ? `<a href="${escapeHtml(item.url)}" target="_blank" rel="noopener noreferrer">Buka</a>` : ""}
      </td>
    </tr>
  `).join("");
}

async function saveTenderChecklist() {
  const tender = getSelectedTender();
  if (!tender || !requirePermission(canManageTenders(), "Role Anda tidak dapat mengubah monitoring dokumen.")) return;
  const documents = [...document.querySelectorAll("[data-tender-document-id]")].map(row => ({
    id: row.dataset.tenderDocumentId,
    group: createTenderChecklist().find(item => item.id === row.dataset.tenderDocumentId)?.group || "",
    name: createTenderChecklist().find(item => item.id === row.dataset.tenderDocumentId)?.name || "",
    status: row.querySelector('[data-document-field="status"]').value,
    owner: row.querySelector('[data-document-field="owner"]').value.trim(),
    deadline: row.querySelector('[data-document-field="deadline"]').value,
    url: row.querySelector('[data-document-field="url"]').value.trim()
  }));
  try {
    await setDoc(doc(db, TENDER_STORAGE_COLLECTION, tender.id), {
      documents,
      updatedBy: normalizeEmail(getCurrentUser()?.email),
      updatedAt: serverTimestamp()
    }, { merge: true });
    await sendTenderSpreadsheetMutation("upsert", { ...tender, documents }, { silent: true });
    notify("Monitoring dokumen berhasil disimpan.");
  } catch (error) {
    notify(getTenderFirestoreErrorMessage(error, "Monitoring dokumen gagal disimpan."));
  }
}

function buildTenderSpreadsheetData(tender) {
  const progress = getTenderProgress(tender);
  const personnel = getTenderPersonnel(tender);
  return {
    "ID Tender": tender?.id || "",
    "Paket": tender?.name || "",
    "Status": tender?.status || "Persiapan",
    "Instansi/Satker": tender?.agency || "",
    "Lokasi": tender?.location || "",
    "Tahun Anggaran": tender?.budgetYear || "",
    "Sumber Dana": tender?.funding || "",
    "Pagu": tender?.budgetCeiling || 0,
    "HPS": tender?.hps || 0,
    "Metode Seleksi": tender?.method || "",
    "Jenis Kontrak": tender?.contractType || "",
    "Deadline": tender?.deadline || "",
    "Penanggung Jawab": tender?.owner || "",
    "Email PIC": tender?.ownerEmail || "",
    "Nama Personil": personnel.map(member => member.name).filter(Boolean).join(", "),
    "Jumlah Personil": personnel.length || tender?.sourcePersonnelCount || 0,
    "Progress": progress.percent,
    "Dokumen Final": progress.finalCount,
    "Total Dokumen": progress.total,
    "Folder Dokumen": tender?.driveUrl || "",
    "Catatan": tender?.notes || "",
    "Updated By": normalizeEmail(getCurrentUser()?.email || tender?.updatedBy || ""),
    "Updated At": new Date().toISOString()
  };
}

async function sendTenderSpreadsheetMutation(action, tender, options = {}) {
  if (!window.PERSONNEL_BRIDGE_URL || !window.PERSONNEL_BRIDGE_TOKEN || !getCurrentUser() || !tender?.id) return;
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
        sourceId: TENDER_SHEET_SOURCE_ID,
        targetSourceId: TENDER_SHEET_SOURCE_ID,
        matchColumn: "ID Tender",
        matchValue: tender.id,
        data: buildTenderSpreadsheetData(tender)
      })
    });
    if (!options.silent) notify("Data Tender dikirim ke Google Spreadsheet.");
  } catch (error) {
    if (!options.silent) notify("Data Tender gagal dikirim ke Google Spreadsheet: " + error.message);
    console.error("Tender gagal dikirim ke Google Spreadsheet:", error);
  }
}

async function syncTenderSheetFromState() {
  if (!getCurrentUser() || !canManageTenders() || tenderSheetSyncInProgress || !state.tenders.length) return;
  if (!window.PERSONNEL_BRIDGE_URL || !window.PERSONNEL_BRIDGE_TOKEN) return;
  const signature = JSON.stringify(state.tenders.map(tender => [
    tender.id,
    tender.name,
    tender.status,
    tender.deadline,
    tender.updatedAt?.seconds || "",
    createTenderChecklist(tender.documents).map(item => [item.id, item.status, item.deadline, item.url]).join("|")
  ]));
  if (signature === lastTenderSheetSignature) return;

  tenderSheetSyncInProgress = true;
  try {
    for (const tender of state.tenders) {
      await sendTenderSpreadsheetMutation("upsert", tender, { silent: true });
    }
    lastTenderSheetSignature = signature;
  } finally {
    tenderSheetSyncInProgress = false;
  }
}

function formatTenderDateTime(value) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return new Intl.DateTimeFormat("id-ID", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: value.includes("T") ? "2-digit" : undefined,
    minute: value.includes("T") ? "2-digit" : undefined
  }).format(date);
}

function getTenderPersonnel(tender) {
  const references = getTenderReferencePersonnelMembers(tender?.sourceJobKey || tender?.name);
  const manual = [
    ...normalizeTenderPersonnelMembers(tender?.personnelMembers),
    ...getTenderManualPersonnelFromLegacyFields(tender)
  ];
  const unique = new Map();

  [...references, ...manual].forEach(member => {
    const record = createTenderPersonnelRecord({
      name: member?.name || getRecordValue(member, ["nama personil", "nama lengkap", "nama"]),
      position: member?.position || getRecordValue(member, [
        "posisi/jabatan (kontrak)",
        "posisi/jabatan",
        "jabatan",
        "posisi"
      ]),
      involvement: member?.involvement || getRecordValue(member, ["keterlibatan"]),
      source: member?.source || "Tambahan"
    });
    const key = normalizeSearchText(record.name);
    if (!key || unique.has(key)) return;
    unique.set(key, record);
  });

  return [...unique.values()];
}

function buildTenderTemplate(tender, type) {
  const personnel = getTenderPersonnel(tender);
  const companyName = "PT. BEMACO REKAPRIMA";
  const commonHeader = `
    <div class="template-letterhead">
      <strong>${companyName}</strong>
      <span>Dokumen Tender Jasa Konsultansi</span>
    </div>
  `;
  const identity = `
    <table>
      <tr><th>Nama Paket</th><td>${escapeHtml(tender.name || "-")}</td></tr>
      <tr><th>Instansi/Satker</th><td>${escapeHtml(tender.agency || "-")}</td></tr>
      <tr><th>Lokasi</th><td>${escapeHtml(tender.location || "-")}</td></tr>
      <tr><th>Tahun Anggaran</th><td>${escapeHtml(tender.budgetYear || "-")}</td></tr>
    </table>
  `;
  const signature = `
    <div class="template-signature">
      <p>[Kota], [Tanggal Dokumen]</p>
      <p>${companyName}</p>
      <br><br><br>
      <strong>[Nama Penandatangan]</strong>
      <p>[Jabatan]</p>
    </div>
  `;

  if (type === "pakta-integritas") {
    return `${commonHeader}<h1>PAKTA INTEGRITAS</h1>${identity}
      <p>Kami yang bertanda tangan di bawah ini menyatakan bahwa dalam proses pengadaan untuk paket tersebut:</p>
      <ol>
        <li>Tidak akan melakukan praktik korupsi, kolusi, dan nepotisme.</li>
        <li>Akan melaporkan indikasi penyimpangan yang diketahui.</li>
        <li>Akan mengikuti proses pengadaan secara bersih, transparan, dan profesional.</li>
        <li>Bersedia dikenakan sanksi apabila melanggar pernyataan ini.</li>
      </ol>${signature}`;
  }

  if (type === "daftar-personel" || type === "jadwal-penugasan") {
    const isSchedule = type === "jadwal-penugasan";
    return `${commonHeader}<h1>${isSchedule ? "JADWAL PENUGASAN PERSONEL" : "DAFTAR PERSONEL TENAGA AHLI"}</h1>${identity}
      <table>
        <thead><tr><th>No.</th><th>Nama Personel</th><th>Posisi/Jabatan</th>${isSchedule
          ? "<th>Mulai</th><th>Selesai</th>"
          : "<th>Bidang Keahlian</th><th>Status</th>"}</tr></thead>
        <tbody>${personnel.length ? personnel.map((record, index) => `
          <tr>
            <td>${index + 1}</td>
            <td>${escapeHtml(getRecordValue(record, ["nama personil", "nama lengkap", "nama"]) || "-")}</td>
            <td>${escapeHtml(getRecordValue(record, ["posisi jabatan kontrak", "jabatan", "posisi"]) || "-")}</td>
            ${isSchedule
              ? `<td>${escapeHtml(getRecordValue(record, ["tanggal mulai", "mulai"]) || "-")}</td><td>${escapeHtml(getRecordValue(record, ["tanggal selesai", "selesai"]) || "-")}</td>`
              : `<td>${escapeHtml(getRecordValue(record, ["ska bidang keahlian", "bidang keahlian", "ska"]) || "-")}</td><td>${escapeHtml(getRecordValue(record, ["status kontrak", "status"]) || "-")}</td>`}
          </tr>`).join("") : '<tr><td colspan="6">Tambahkan data personel paket pada DATA UTAMA atau isi tabel ini secara manual.</td></tr>'}</tbody>
      </table>${signature}`;
  }

  if (type === "metodologi") {
    return `${commonHeader}<h1>PENDEKATAN DAN METODOLOGI</h1>${identity}
      <h2>1. Pemahaman terhadap Kerangka Acuan Kerja</h2>
      <p>[Jelaskan pemahaman tujuan, keluaran, lokasi, ruang lingkup, dan kondisi pekerjaan.]</p>
      <h2>2. Pendekatan Teknis</h2>
      <p>[Uraikan pendekatan teknis yang relevan dengan paket dan standar PUPR/Cipta Karya.]</p>
      <h2>3. Metodologi Pelaksanaan</h2>
      <p>[Uraikan tahapan pengumpulan data, analisis, perencanaan, koordinasi, pengendalian mutu, dan pelaporan.]</p>
      <h2>4. Rencana Kerja dan Organisasi Tim</h2>
      <p>[Jelaskan jadwal, pembagian peran, mekanisme komunikasi, serta pengendalian risiko.]</p>
      <h2>5. Keluaran dan Pengendalian Mutu</h2>
      <p>[Tuliskan daftar keluaran dan mekanisme pemeriksaan sebelum penyerahan.]</p>`;
  }

  return `${commonHeader}<h1>SURAT PENAWARAN</h1>
    <p>Nomor: [Nomor Surat]</p>
    <p>Kepada Yth.<br><strong>Pokja Pemilihan / Pejabat Pengadaan</strong><br>${escapeHtml(tender.agency || "[Nama Instansi/Satker]")}</p>
    <p>Dengan hormat,</p>
    <p>Sehubungan dengan proses pemilihan penyedia jasa konsultansi untuk paket berikut:</p>
    ${identity}
    <p>Kami mengajukan penawaran sesuai Dokumen Pemilihan beserta seluruh adendum. Nilai penawaran biaya kami adalah <strong>${formatRupiah(tender.hps || tender.budgetCeiling)}</strong> atau sesuai rincian penawaran biaya terlampir.</p>
    <p>Penawaran ini berlaku selama [masa berlaku penawaran] hari kalender sejak batas akhir pemasukan penawaran.</p>
    ${signature}`;
}

function generateTenderTemplate() {
  const tender = getSelectedTender();
  if (!tender) return notify("Pilih paket tender terlebih dahulu.");
  const type = document.getElementById("tenderTemplateType").value;
  document.getElementById("tenderTemplatePreview").innerHTML =
    sanitizeTenderTemplateHtml(tender.templates?.[type] || buildTenderTemplate(tender, type));
}

async function saveTenderTemplateDraft() {
  const tender = getSelectedTender();
  if (!tender || !requirePermission(canManageTenders(), "Role Anda tidak dapat menyimpan draf template.")) return;
  const type = document.getElementById("tenderTemplateType").value;
  const content = sanitizeTenderTemplateHtml(
    document.getElementById("tenderTemplatePreview").innerHTML.trim()
  );
  if (!content) return notify("Buat atau isi template terlebih dahulu.");
  try {
    await setDoc(doc(db, TENDER_STORAGE_COLLECTION, tender.id), {
      templates: {
        ...(tender.templates || {}),
        [type]: content
      },
      updatedBy: normalizeEmail(getCurrentUser()?.email),
      updatedAt: serverTimestamp()
    }, { merge: true });
    notify("Draf template berhasil disimpan pada paket tender.");
  } catch (error) {
    notify(getTenderFirestoreErrorMessage(error, "Draf template gagal disimpan."));
  }
}

function getTenderFirestoreErrorMessage(error, prefix) {
  const code = String(error?.code || "");
  const message = String(error?.message || "");
  if (code.includes("permission-denied") || message.toLowerCase().includes("insufficient permissions")) {
    return `${prefix}\n\nFirestore menolak izin koleksi tenders. Buka Firebase Console > Firestore Database > Rules, masukkan firestore.rules terbaru, lalu klik Publish. Setelah itu muat ulang web.`;
  }
  return `${prefix}\n\n${message || "Terjadi kesalahan yang tidak diketahui."}`;
}

function sanitizeTenderTemplateHtml(value) {
  const documentFragment = new DOMParser().parseFromString(String(value || ""), "text/html");
  documentFragment.querySelectorAll("script, style, iframe, object, embed, form").forEach(node => node.remove());
  documentFragment.querySelectorAll("*").forEach(node => {
    [...node.attributes].forEach(attribute => {
      const name = attribute.name.toLowerCase();
      const content = attribute.value.trim().toLowerCase();
      if (name.startsWith("on") || ((name === "href" || name === "src") && content.startsWith("javascript:"))) {
        node.removeAttribute(attribute.name);
      }
    });
  });
  return documentFragment.body.innerHTML;
}

function printTenderTemplate() {
  const tender = getSelectedTender();
  const preview = document.getElementById("tenderTemplatePreview");
  if (!tender || !preview.textContent.trim()) return notify("Buat template terlebih dahulu.");
  const html = `
    <!doctype html><html><head><meta charset="utf-8"><title>${escapeHtml(tender.name)} - Dokumen Tender</title>
    <style>
      @page { size: A4; margin: 20mm; }
      body { color:#111827; font:12pt Arial,sans-serif; line-height:1.55; }
      h1 { margin:22px 0; font-size:16pt; text-align:center; }
      h2 { margin-top:20px; font-size:13pt; }
      table { width:100%; border-collapse:collapse; margin:14px 0; }
      th,td { border:1px solid #9ca3af; padding:7px; text-align:left; vertical-align:top; }
      .template-letterhead { display:flex; justify-content:space-between; border-bottom:2px solid #1d4ed8; padding-bottom:10px; }
      .template-signature { width:42%; margin:30px 0 0 auto; }
    </style></head><body>${sanitizeTenderTemplateHtml(preview.innerHTML)}</body></html>`;
  printHtmlDocument(html);
}


  return {
    bindControls,
    getSelected: getSelectedTender,
    getProgress: getTenderProgress,
    getFiltered: getFilteredTenders,
    isDeadlineUrgent: isTenderDeadlineUrgent,
    render: renderTenders,
    handleTableClick: handleTenderTableClick,
    openForm: openTenderForm,
    closeForm: closeTenderForm,
    save: saveTender,
    editSelected: editSelectedTender,
    deleteSelected: deleteSelectedTender,
    renderDetail: renderTenderDetail,
    saveChecklist: saveTenderChecklist,
    setFormStatus: setTenderFormStatus,
    syncSheetFromState: syncTenderSheetFromState,
    formatDateTime: formatTenderDateTime,
    getPersonnel: getTenderPersonnel,
    generateTemplate: generateTenderTemplate,
    saveTemplateDraft: saveTenderTemplateDraft,
    printTemplate: printTenderTemplate
  };
}
