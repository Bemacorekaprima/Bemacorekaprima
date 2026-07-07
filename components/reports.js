export function createReportsFeature(options = {}) {
  const {
    state,
    notify,
    requirePermission,
    canCreateReports,
    getFilteredTasks,
    buildUnifiedAiSnapshot,
    buildPeopleDirectory,
    buildStats,
    buildJobsFromAllSources,
    getPortfolioCounts,
    getFilteredTenders,
    getAllIntegratedPersonnelRecords,
    getReportDataHelpers,
    getPortfolioStatusLabel,
    getJobYearLabel,
    getRecordValue,
    getPersonnelName,
    getPersonnelStatus,
    getPersonnelPosition,
    getPersonnelAccumulation,
    normalizeSearchText,
    formatHumanDate,
    getToday,
    setTextContent,
    escapeHtml,
    printHtmlDocument
  } = options;

  function bindControls() {
    document.getElementById("reportsGenerateButton")?.addEventListener("click", () => generateReportPreview(false));
    document.getElementById("reportsResetButton")?.addEventListener("click", resetReportFilters);
    document.getElementById("reportsExportPdf")?.addEventListener("click", exportReportPdf);
    document.getElementById("reportsExportExcel")?.addEventListener("click", exportReportExcel);
    document.getElementById("reportsPrint")?.addEventListener("click", printReportPreview);
    ["reportsPeriod", "reportsSourceFilter", "reportsStatusFilter", "reportsSearch"].forEach(id => {
      document.getElementById(id)?.addEventListener("change", renderReportsWorkspace);
    });
    document.querySelectorAll("[data-report-template]").forEach(button => {
      button.addEventListener("click", () => applyReportTemplate(button.dataset.reportTemplate));
    });
  }

function renderReports() {
  renderReportsWorkspace();

  const list = document.getElementById("reportsList");
  if (!list) return;
  list.innerHTML = state.reports.length
    ? state.reports.map((report, index) => `
      <article class="report-item">
        <div class="report-item-header">
          <strong>Laporan ${index + 1}</strong>
          <span>${escapeHtml(state.today)}</span>
        </div>
        <pre>${escapeHtml(report)}</pre>
      </article>
    `).join("")
    : '<p>Belum ada laporan. Klik "Generate Preview" lalu simpan laporan hari ini.</p>';
}

function renderReportsWorkspace() {
  const preview = document.getElementById("reportsWorkspacePreview");
  if (!preview) return;

  prepareReportFilters();
  const model = buildReportPreviewModel();
  updateReportSummaryCards(model);
  renderReportPreviewModel(model);
}

function prepareReportFilters() {
  const start = document.getElementById("reportsStartDate");
  const end = document.getElementById("reportsEndDate");
  if (start && !start.value) start.value = state.today;
  if (end && !end.value) end.value = state.today;

  const personSelect = document.getElementById("reportsPerson");
  if (!personSelect) return;
  const currentValue = personSelect.value || "all";
  const snapshot = buildReportsSnapshot();
  const people = new Map();
  (snapshot.personnel || []).forEach(record => {
    const name = getPersonnelName(record);
    const key = normalizeSearchText(name);
    if (name && key && !people.has(key)) people.set(key, name);
  });
  state.tasks.forEach(task => {
    const name = task.penanggungJawab || "";
    const key = normalizeSearchText(name);
    if (name && key && !people.has(key)) people.set(key, name);
  });

  personSelect.innerHTML = '<option value="all">Semua personil</option>' +
    [...people.values()]
      .sort((a, b) => a.localeCompare(b, "id"))
      .map(name => `<option value="${escapeHtml(name)}">${escapeHtml(name)}</option>`)
      .join("");
  personSelect.value = [...personSelect.options].some(option => option.value === currentValue) ? currentValue : "all";
}

function buildReportsSnapshot() {
  const tasks = state.tasks.map(task => ({ ...task, terlambat: isOverdue(task) }));
  return buildUnifiedAiSnapshot(tasks, buildPeopleDirectory(tasks));
}

function getReportFilterValues() {
  return {
    type: document.getElementById("reportsType")?.value || "daily",
    startDate: document.getElementById("reportsStartDate")?.value || state.today,
    endDate: document.getElementById("reportsEndDate")?.value || state.today,
    source: document.getElementById("reportsSource")?.value || "all",
    status: document.getElementById("reportsStatus")?.value || "all",
    person: document.getElementById("reportsPerson")?.value || "all"
  };
}

function buildReportPreviewModel() {
  const snapshot = buildReportsSnapshot();
  const filters = getReportFilterValues();
  const tasks = filterReportTasks(snapshot.tasks || [], filters);
  const jobs = filterReportJobs(snapshot.jobs || [], filters);
  const tenders = filterReportTenders(snapshot.tenders || [], filters);
  const personnel = filterReportPersonnel(snapshot.personnel || [], filters);
  const stats = buildStats(tasks);
  const portfolioCounts = getPortfolioCounts(jobs);
  const activePersonnel = personnel.filter(record => Number(getPersonnelActiveWork(record)) > 0);
  const lateTasks = tasks.filter(task => task.terlambat);
  const priorityTasks = tasks.filter(task => ["Tinggi", "Mendesak"].includes(task.prioritas));
  const urgentTenders = tenders.filter(tender => tender.deadline && normalizeSearchText(tender.deadline) !== "-");

  const typeLabels = {
    daily: "Laporan Harian",
    progress: "Laporan Progres Pekerjaan",
    tender: "Laporan Tender",
    personnel: "Laporan Personil",
    portfolio: "Laporan Portofolio"
  };

  const summary = [
    `${lateTasks.length} tugas terlambat`,
    `${portfolioCounts.tender} pekerjaan tender`,
    `${portfolioCounts.active} pekerjaan aktif`,
    `${activePersonnel.length} personil memiliki pekerjaan aktif`
  ];

  const sections = [
    {
      title: "Ringkasan eksekutif",
      text: summary.join(", ") + "."
    },
    {
      title: "Fokus prioritas",
      text: priorityTasks.slice(0, 4).map(task => task.namaTugas).join(", ") ||
        jobs.filter(job => getPortfolioStatusKey(job) !== "finish").slice(0, 4).map(job => job.pekerjaan).join(", ") ||
        "Belum ada prioritas khusus pada filter ini."
    },
    {
      title: "Tugas",
      text: `Total ${stats.total}, selesai ${stats.selesai}, proses ${stats.proses}, belum selesai ${stats.belumSelesai}, terlambat ${stats.terlambat}.`
    },
    {
      title: "Pekerjaan dan portofolio",
      text: `${portfolioCounts.total} pekerjaan: ${portfolioCounts.active} aktif, ${portfolioCounts.finish} finish, ${portfolioCounts.tender} tender, ${portfolioCounts.upcoming} upcoming.`
    },
    {
      title: "Tender",
      text: `${tenders.length} paket dipantau. ${urgentTenders.length} paket memiliki deadline yang perlu diperhatikan.`
    },
    {
      title: "Personil",
      text: `${personnel.length} personil terbaca. ${activePersonnel.length} personil memiliki pekerjaan aktif.`
    },
    {
      title: "Catatan sistem",
      text: "Data disusun dari Firebase, Apps Script Bridge, Google Spreadsheet cache, dan data sesi browser."
    }
  ];

  const rawText = [
    typeLabels[filters.type] || "Laporan",
    `Periode: ${formatHumanDate(filters.startDate)} - ${formatHumanDate(filters.endDate)}`,
    `Sumber: ${getReportSourceLabel(filters.source)}`,
    `Status: ${getReportStatusLabel(filters.status)}`,
    `Personil: ${filters.person === "all" ? "Semua personil" : filters.person}`,
    "",
    ...sections.flatMap(section => [section.title.toUpperCase(), section.text, ""])
  ].join("\n").trim();

  return {
    title: typeLabels[filters.type] || "Laporan",
    filters,
    stats,
    portfolioCounts,
    sections,
    rawText,
    counts: {
      todayReports: state.reports.length,
      doneActivities: stats.selesai + portfolioCounts.finish,
      late: stats.terlambat,
      tender: portfolioCounts.tender || tenders.length,
      activePersonnel: activePersonnel.length
    }
  };
}

function filterReportTasks(tasks, filters) {
  return tasks.filter(task => {
    const taskDate = task.tanggal || String(task.deadline || "").slice(0, 10);
    const matchesDate = !taskDate || (taskDate >= filters.startDate && taskDate <= filters.endDate);
    const matchesSource = filters.source === "all" || filters.source === "tasks";
    const matchesPerson = filters.person === "all" || normalizeSearchText(task.penanggungJawab).includes(normalizeSearchText(filters.person));
    const matchesStatus = filters.status === "all" ||
      (filters.status === "active" && task.status !== "Selesai") ||
      (filters.status === "finish" && task.status === "Selesai");
    return matchesDate && matchesSource && matchesPerson && matchesStatus;
  });
}

function filterReportJobs(jobs, filters) {
  if (!(filters.source === "all" || filters.source === "jobs")) return [];
  return jobs.filter(job => {
    const matchesStatus = filters.status === "all" || jobMatchesStatusFilter(job, filters.status);
    const matchesPerson = filters.person === "all" || getAiJobPersonnelNames(job)
      .some(name => normalizeSearchText(name).includes(normalizeSearchText(filters.person)));
    return matchesStatus && matchesPerson;
  });
}

function filterReportTenders(tenders, filters) {
  if (!(filters.source === "all" || filters.source === "tenders")) return [];
  return tenders.filter(tender => {
    const matchesPerson = filters.person === "all" || normalizeSearchText([
      tender.penanggungJawab,
      tender.personil
    ].join(" ")).includes(normalizeSearchText(filters.person));
    return matchesPerson;
  });
}

function filterReportPersonnel(personnel, filters) {
  if (!(filters.source === "all" || filters.source === "personnel")) return [];
  return personnel.filter(record => {
    const matchesPerson = filters.person === "all" || normalizeSearchText(getPersonnelName(record)).includes(normalizeSearchText(filters.person));
    return matchesPerson;
  });
}

function updateReportSummaryCards(model) {
  const setText = (id, value) => {
    const element = document.getElementById(id);
    if (element) element.textContent = value;
  };
  setText("reportsStatToday", model.counts.todayReports);
  setText("reportsStatDone", model.counts.doneActivities);
  setText("reportsStatLate", model.counts.late);
  setText("reportsStatTender", model.counts.tender);
  setText("reportsStatPersonnel", model.counts.activePersonnel);
}

function renderReportPreviewModel(model) {
  const title = document.getElementById("reportsPreviewTitle");
  const preview = document.getElementById("reportsWorkspacePreview");
  if (title) title.textContent = `Preview ${model.title}`;
  if (!preview) return;

  preview.innerHTML = model.sections.map(section => `
    <article class="report-preview-block">
      <span>${escapeHtml(section.title)}</span>
      <p>${escapeHtml(section.text)}</p>
    </article>
  `).join("");

  const dashboardPreview = document.getElementById("reportPreview");
  if (dashboardPreview) dashboardPreview.textContent = model.sections.slice(0, 3)
    .map(section => `${section.title}: ${section.text}`)
    .join("\n\n");
}

function generateReportPreview(saveToHistory = false) {
  if (!requirePermission(canCreateReports(), "Role Anda hanya dapat melihat laporan.")) return;
  const model = buildReportPreviewModel();
  renderReportPreviewModel(model);
  if (saveToHistory) {
    state.reports.unshift(model.rawText);
    renderReports();
    notify("Laporan berhasil dibuat dari data terbaru.");
  }
}

function resetReportFilters() {
  const fields = {
    reportsType: "daily",
    reportsStartDate: state.today,
    reportsEndDate: state.today,
    reportsSource: "all",
    reportsStatus: "all",
    reportsPerson: "all"
  };
  Object.entries(fields).forEach(([id, value]) => {
    const field = document.getElementById(id);
    if (field) field.value = value;
  });
  renderReportsWorkspace();
}

function applyReportTemplate(type) {
  const field = document.getElementById("reportsType");
  if (field) field.value = type;
  renderReportsWorkspace();
}

function getCurrentReportModel() {
  const model = buildReportPreviewModel();
  renderReportPreviewModel(model);
  return model;
}

function exportReportExcel() {
  const model = getCurrentReportModel();
  const html = buildReportExportHtml(model);
  const blob = new Blob([html], { type: "application/vnd.ms-excel;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `laporan-${state.today}.xls`;
  link.click();
  URL.revokeObjectURL(url);
}

function exportReportPdf() {
  printHtmlDocument(buildReportExportHtml(getCurrentReportModel()));
}

function printReportPreview() {
  printHtmlDocument(buildReportExportHtml(getCurrentReportModel()));
}

function buildReportExportHtml(model) {
  return `
    <html>
      <head>
        <title>${escapeHtml(model.title)}</title>
        <style>
          body { font-family: Arial, sans-serif; color: #111827; padding: 24px; }
          h1 { margin: 0 0 6px; font-size: 22px; }
          .meta { color: #64748b; margin-bottom: 18px; }
          table { border-collapse: collapse; width: 100%; font-size: 12px; }
          th { background: #2563eb; color: #fff; text-align: left; }
          th, td { border: 1px solid #cbd5e1; padding: 9px; vertical-align: top; }
        </style>
      </head>
      <body>
        <h1>${escapeHtml(model.title)}</h1>
        <div class="meta">Periode ${escapeHtml(formatHumanDate(model.filters.startDate))} - ${escapeHtml(formatHumanDate(model.filters.endDate))}</div>
        <table>
          <thead><tr><th>Bagian</th><th>Isi Laporan</th></tr></thead>
          <tbody>
            ${model.sections.map(section => `<tr><td><strong>${escapeHtml(section.title)}</strong></td><td>${escapeHtml(section.text)}</td></tr>`).join("")}
          </tbody>
        </table>
      </body>
    </html>
  `;
}

function getReportSourceLabel(value) {
  return {
    all: "Tugas, Tender, Personil, Portofolio",
    tasks: "Tugas",
    jobs: "Pekerjaan / Portofolio",
    tenders: "Tender",
    personnel: "Personil"
  }[value] || value;
}

function getReportStatusLabel(value) {
  return {
    all: "Semua status",
    active: "Aktif / Ongoing",
    finish: "Finish",
    tender: "Tender",
    upcoming: "Upcoming"
  }[value] || value;
}


  return {
    bindControls,
    render: renderReports,
    renderWorkspace: renderReportsWorkspace,
    generatePreview: generateReportPreview,
    resetFilters: resetReportFilters,
    applyTemplate: applyReportTemplate,
    exportExcel: exportReportExcel,
    exportPdf: exportReportPdf,
    printPreview: printReportPreview
  };
}
