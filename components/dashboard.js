export const DASHBOARD_ASSIGNMENT_CATEGORIES = [
  { key: "ho", label: "HO", color: "#2563eb", tokens: ["ho", "head office"] },
  { key: "on-site", label: "On Site", color: "#22c55e", tokens: ["on site", "onsite", "site", "lapangan"] },
  { key: "intermitten", label: "Intermitten", color: "#f59e0b", tokens: ["intermitten", "intermittent", "intermitent"] }
];

export function createDashboardFeature(options = {}) {
  const {
    state,
    setTextContent,
    escapeHtml,
    safeClassToken,
    normalizeSearchText,
    buildJobsFromAllSources,
    buildJobsFromDataUtama,
    getPortfolioStatusKey,
    getPortfolioStatusLabel,
    getPortfolioCounts,
    getPortfolioProgress,
    getPortfolioPeople,
    buildStats,
    getFocusTasks,
    getUrgency,
    formatRupiah,
    formatTenderDateTime,
    getTenderProgress,
    getTenderPersonnel,
    isTenderDeadlineUrgent,
    renderInventoryDashboard,
    renderPortfolioActivityItems,
    buildPortfolioActivities,
    getAllIntegratedPersonnelRecords,
    getCurrentSummaryYear,
    getPersonnelName,
    getPersonnelStatus,
    getPersonnelActiveWork,
    getPersonnelWorkHistory,
    getPersonnelAccumulation,
    getPersonnelPosition,
    getPersonnelFinishedWork,
    getActivePersonnelForJob,
    getDataUtamaSheet,
    getRecordValue,
    canonicalPersonnelName,
    getJobYearLabel,
    openPortfolioJob,
    openPersonnelDetail,
    formatHumanDate
  } = options;

  if (!state) throw new Error("Dashboard feature membutuhkan state aplikasi.");

  function bindControls() {
    document.getElementById("dashboardActivePersonnelBody")?.addEventListener("click", handlePersonnelClick);
    document.getElementById("dashboardInactivePersonnelBody")?.addEventListener("click", handlePersonnelClick);
    document.getElementById("dashboardFeaturedJobs")?.addEventListener("click", handlePortfolioCardClick);
    document.getElementById("dashboardProjectScope")?.addEventListener("change", renderHome);
    document.getElementById("dashAssignmentTabs")?.addEventListener("click", handleAssignmentFilter);
  }

  function renderHome() {
    const selectedScope = document.getElementById("dashboardProjectScope")?.value || "all";
    let allJobs = buildJobsFromAllSources();
    if (selectedScope === "active") {
      allJobs = allJobs.filter(job => getPortfolioStatusKey(job) === "active");
    } else if (selectedScope === "tender") {
      allJobs = allJobs.filter(job => getPortfolioStatusKey(job) === "tender");
    }
    const counts = getPortfolioCounts(allJobs);
    const taskStats = buildStats(state.tasks);
    const activeTenders = getActiveTenders();
    const personnel = getAllIntegratedPersonnelRecords(getCurrentSummaryYear());
    const personnelSummary = getPersonnelSummary(personnel);
    const prioritySourceItems = getPrioritySourceItems(allJobs);
    const priorityItems = prioritySourceItems.slice(0, 4);
    const tenderSummary = getTenderKpiSummary(activeTenders);
    const prioritySummary = getPriorityKpiSummary(prioritySourceItems);

    setText("dashboardPortfolioYearLabel", "Seluruh portofolio");
    setText("dashboardPortfolioTotal", counts.total);
    setText("dashboardPortfolioActive", counts.active);
    setText("dashboardPortfolioFinish", counts.finish);
    setText("dashboardPortfolioTender", counts.tender);
    setText("dashboardPortfolioUpcoming", counts.upcoming);

    setTextContent("dashKpiTasks", taskStats.total);
    setTextContent("dashKpiTasksMeta", `${taskStats.selesai} Selesai \u2022 ${taskStats.pending} Pending`);
    setTextContent("dashKpiTenders", activeTenders.length);
    setTextContent("dashKpiTendersMeta", `${tenderSummary.baru} Baru \u2022 ${tenderSummary.evaluasi} Evaluasi \u2022 ${tenderSummary.penawaran} Penawaran`);
    setTextContent("dashKpiPersonnel", personnel.length);
    setTextContent("dashKpiPersonnelMeta", `${personnelSummary.aktif.count} Aktif \u2022 ${personnelSummary.idle.count} Idle \u2022 ${personnelSummary.cuti.count} Cuti`);
    setTextContent("dashKpiPriority", prioritySourceItems.length);
    setTextContent("dashKpiPriorityMeta", `${prioritySummary.tinggi} Tinggi \u2022 ${prioritySummary.sedang} Sedang \u2022 ${prioritySummary.rendah} Rendah`);

    renderDailyTasks();
    renderTenderRows(activeTenders);
    renderPersonnelSummary(personnel);
    renderAssignmentSummary(personnel.length);
    renderInventoryDashboard();
    renderPriorityRows(priorityItems);
    renderProgressBast(prioritySourceItems);

    const activityList = document.getElementById("dashboardActivityList");
    if (activityList) activityList.innerHTML = renderPortfolioActivityItems(buildPortfolioActivities(allJobs));
    setText("dashboardAgendaCount", `${getFocusTasks().length} agenda`);
    const agendaBento = document.getElementById("dashboardAgendaBento");
    if (agendaBento) agendaBento.innerHTML = "";
    setText("dashboardPortfolioBrief", `${counts.active} proyek aktif, ${activeTenders.length} tender aktif, dan ${personnel.length} personil terbaca.`);

    window.lucide?.createIcons?.();
  }

  function setText(id, value) {
    const element = document.getElementById(id);
    if (element) element.textContent = value;
  }

  function formatPercent(count, total) {
    const percent = total ? (count / total) * 100 : 0;
    return percent.toLocaleString("id-ID", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    });
  }

  function getTenderKpiSummary(tenders) {
    return tenders.reduce((summary, tender) => {
      const status = normalizeSearchText(tender.status);
      if (status.includes("evaluasi")) summary.evaluasi += 1;
      else if (status.includes("penawaran")) summary.penawaran += 1;
      else summary.baru += 1;
      return summary;
    }, { baru: 0, evaluasi: 0, penawaran: 0 });
  }

  function getPriorityKpiSummary(items) {
    return items.reduce((summary, item) => {
      const priority = normalizeSearchText(item.priority);
      if (priority.includes("tinggi")) summary.tinggi += 1;
      else if (priority.includes("rendah")) summary.rendah += 1;
      else summary.sedang += 1;
      return summary;
    }, { tinggi: 0, sedang: 0, rendah: 0 });
  }

  function getActiveTenders() {
    return state.tenders
      .filter(tender => !["Kontrak", "Arsip", "Selesai"].includes(tender.status))
      .sort((left, right) => String(left.deadline || "9999").localeCompare(String(right.deadline || "9999")));
  }

  function renderDailyTasks() {
    const tasks = getFocusTasks().slice(0, 5);
    const container = document.getElementById("dashDailyTasks");
    if (!container) return;
    container.innerHTML = tasks.length
      ? tasks.map(task => {
        const urgency = getUrgency(task);
        return `
          <button class="dashboard-task-row" type="button" data-action="preview" data-id="${escapeHtml(task.id)}">
            <span class="dashboard-task-check ${task.status === "Selesai" ? "done" : ""}"></span>
            <span>
              <strong>${escapeHtml(task.namaTugas || "Tanpa nama tugas")}</strong>
              <small>${escapeHtml(task.penanggungJawab || task.catatan || "Penanggung jawab belum diisi")}</small>
            </span>
            <em class="${escapeHtml(urgency.className)}">${escapeHtml(urgency.label)}</em>
          </button>
        `;
      }).join("")
      : '<p class="dashboard-empty">Belum ada tugas aktif.</p>';
  }

  function renderTenderRows(tenders) {
    const body = document.getElementById("dashTenderRows");
    if (!body) return;
    body.innerHTML = tenders.slice(0, 5).map(tender => `
      <tr data-dashboard-open-tender="${escapeHtml(tender.id)}">
        <td><strong>${escapeHtml(tender.name || "Paket Tender")}</strong></td>
        <td>${escapeHtml(tender.location || tender.budgetYear || "-")}</td>
        <td>${escapeHtml(tender.agency || "-")}</td>
        <td>${escapeHtml(formatRupiah(tender.hps || tender.budgetCeiling))}</td>
        <td>
          ${escapeHtml(formatTenderDateTime(tender.deadline))}
          <small>${escapeHtml(getRelativeDateLabel(tender.deadline))}</small>
        </td>
        <td><span class="dashboard-status-pill">${escapeHtml(tender.status || "Persiapan")}</span></td>
      </tr>
    `).join("") || '<tr><td colspan="6" class="dashboard-empty">Belum ada tender aktif.</td></tr>';
  }

  function renderPersonnelSummary(personnel) {
    const total = personnel.length;
    const summary = getPersonnelSummary(personnel);
    const entries = Object.values(summary);
    let current = 0;
    const stops = entries.map(item => {
      const start = current;
      const size = total ? (item.count / total) * 100 : 0;
      current += size;
      return `${item.color} ${start}% ${current}%`;
    }).join(", ");

    setTextContent("dashPersonnelTotal", total);
    const ring = document.getElementById("dashPersonnelRing");
    if (ring) ring.style.background = total ? `conic-gradient(${stops})` : "#e5e7eb";
    const legend = document.getElementById("dashPersonnelLegend");
    if (legend) {
      legend.innerHTML = entries.map(item => `
        <div>
          <dt><span style="background:${item.color}"></span>${escapeHtml(item.label)}</dt>
          <dd>${item.count} (${formatPercent(item.count, total)}%)</dd>
        </div>
      `).join("");
    }

    const body = document.getElementById("dashPersonnelRows");
    if (body) {
      const rows = getPersonnelRows(personnel).slice(0, 30);
      body.innerHTML = rows.length ? rows.map(row => `
        <tr>
          <td>${escapeHtml(row.name)}</td>
          <td><span class="personnel-status-pill ${escapeHtml(row.statusKey)}">${escapeHtml(row.status)}</span></td>
          <td>${escapeHtml(row.work)}</td>
        </tr>
      `).join("") : '<tr><td colspan="3" class="dashboard-empty">Belum ada data personil.</td></tr>';
    }
  }

  function getPersonnelDashboardStatus(record) {
    const rawStatus = normalizeSearchText(getPersonnelStatus(record));
    if (rawStatus.includes("cuti")) return { key: "cuti", label: "Cuti" };
    if (getPersonnelActiveWork(record) > 0) return { key: "aktif", label: "Aktif" };
    return { key: "idle", label: "Idle" };
  }

  function getPersonnelSummary(personnel) {
    const summary = {
      aktif: { key: "aktif", label: "Aktif", count: 0, color: "#22c55e" },
      idle: { key: "idle", label: "Idle", count: 0, color: "#ef4444" },
      cuti: { key: "cuti", label: "Cuti", count: 0, color: "#f59e0b" }
    };
    personnel.forEach(record => {
      const status = getPersonnelDashboardStatus(record);
      summary[status.key].count += 1;
    });
    return summary;
  }

  function getPersonnelRows(personnel) {
    return [...personnel]
      .map(record => {
        const status = getPersonnelDashboardStatus(record);
        return {
          name: getPersonnelName(record) || "-",
          status: status.label,
          statusKey: status.key,
          activeWork: getPersonnelActiveWork(record),
          work: getPersonnelWorkLabel(record)
        };
      })
      .sort((left, right) =>
        right.activeWork - left.activeWork ||
        left.status.localeCompare(right.status, "id") ||
        left.name.localeCompare(right.name, "id")
      );
  }

  function getPersonnelWorkLabel(record) {
    const history = getPersonnelWorkHistory(getPersonnelName(record));
    const active = history.find(item => item.category === "active");
    return active?.pekerjaan || "-";
  }

  function getAssignmentRaw(record) {
    return getRecordValue(record, ["posisi penugasan", "penugasan", "assignment"]);
  }

  function getAssignmentCategories(record) {
    const status = normalizeSearchText(getRecordValue(record, ["status pekerjaan", "status"]));
    const isFinish = status.includes("finish") || status.includes("selesai");
    const isFinishOvertime = isFinish && status.includes("overtime");
    if (isFinish && !isFinishOvertime) {
      return DASHBOARD_ASSIGNMENT_CATEGORIES.filter(category => category.key === "ho");
    }

    const raw = normalizeSearchText(getAssignmentRaw(record));
    if (!raw) return [];
    return DASHBOARD_ASSIGNMENT_CATEGORIES.filter(category =>
      category.tokens.some(token => raw.includes(token))
    );
  }

  function getAssignmentRecords() {
    const sheet = getDataUtamaSheet();
    if (!sheet || sheet.status !== "ready") return [];
    const seen = new Set();
    return sheet.records.filter(record => {
      const name = getRecordValue(record, ["nama personil", "nama lengkap", "nama"]);
      const job = getRecordValue(record, ["pekerjaan", "nama pekerjaan", "project", "proyek"]);
      const key = [canonicalPersonnelName(name) || normalizeSearchText(name), normalizeSearchText(job)].join("|");
      if (!name || seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }

  function handleAssignmentFilter(event) {
    const button = event.target.closest("[data-dashboard-assignment-filter]");
    if (!button) return;
    state.dashboardAssignmentFilter = button.dataset.dashboardAssignmentFilter || "all";
    renderHome();
  }

  function renderAssignmentSummary(personnelTotal = 0) {
    const records = getAssignmentRecords();
    const totalPersonnel = personnelTotal || getAllIntegratedPersonnelRecords(getCurrentSummaryYear()).length;
    const counts = new Map(DASHBOARD_ASSIGNMENT_CATEGORIES.map(category => [category.key, 0]));
    const rows = [];

    records.forEach(record => {
      const categories = getAssignmentCategories(record);
      if (!categories.length) return;
      categories.forEach(category => counts.set(category.key, (counts.get(category.key) || 0) + 1));
      rows.push({ record, categories });
    });

    const entries = DASHBOARD_ASSIGNMENT_CATEGORIES.map(category => ({
      ...category,
      count: counts.get(category.key) || 0
    }));
    const assignmentTotal = entries.reduce((sum, item) => sum + item.count, 0);
    let cursor = 0;
    const stops = entries.map(item => {
      const start = cursor;
      cursor += assignmentTotal ? (item.count / assignmentTotal) * 100 : 0;
      return `${item.color} ${start}% ${cursor}%`;
    }).join(", ");

    setTextContent("dashAssignmentTotal", totalPersonnel);
    const ring = document.getElementById("dashAssignmentRing");
    if (ring) ring.style.background = assignmentTotal ? `conic-gradient(${stops})` : "#e5e7eb";

    const legend = document.getElementById("dashAssignmentLegend");
    if (legend) {
      legend.innerHTML = entries.map(item => `
        <div class="assignment-legend-row">
          <dt><span style="background:${item.color}"></span>${escapeHtml(item.label)}</dt>
          <dd><strong>${item.count}</strong><small>${formatPercent(item.count, totalPersonnel)}% dari total</small></dd>
        </div>
      `).join("");
    }

    const filter = state.dashboardAssignmentFilter || "all";
    document.querySelectorAll("[data-dashboard-assignment-filter]").forEach(button => {
      button.classList.toggle("active", button.dataset.dashboardAssignmentFilter === filter);
    });

    const body = document.getElementById("dashAssignmentRows");
    if (!body) return;
    const filteredRows = rows
      .filter(row => filter === "all" || row.categories.some(category => category.key === filter))
      .slice(0, 30);
    body.innerHTML = filteredRows.length ? filteredRows.map(row => `
      <tr>
        <td>${escapeHtml(getPersonnelName(row.record) || "-")}</td>
        <td>${row.categories.map(category => `<span class="assignment-badge ${category.key}">${escapeHtml(category.label)}</span>`).join("")}</td>
      </tr>
    `).join("") : '<tr><td colspan="2" class="dashboard-empty">Belum ada data posisi penugasan.</td></tr>';
  }

  function getPrioritySourceItems(allJobs) {
    const tenderItems = getActiveTenders().map(tender => ({
      job: {
        id: `tender:${tender.id}`,
        pekerjaan: tender.name || "Paket Tender",
        tenderId: tender.id,
        statusOverride: "Tender",
        records: []
      },
      packageName: tender.name || "Paket Tender",
      project: tender.location || tender.budgetYear || "Tender",
      priority: isTenderDeadlineUrgent(tender) ? "Tinggi" : "Sedang",
      progress: getTenderProgress(tender).percent,
      pic: tender.owner || getTenderPersonnel(tender)[0]?.name || "-"
    }));

    const jobItems = allJobs
      .filter(job => getPortfolioStatusKey(job) !== "finish")
      .map(job => ({
        job,
        packageName: job.pekerjaan,
        project: getPortfolioStatusLabel(job),
        priority: getPortfolioStatusKey(job) === "active" || getPortfolioStatusKey(job) === "tender" ? "Tinggi" : "Sedang",
        progress: getPortfolioProgress(job),
        pic: getPortfolioPeople(job)[0] || "-"
      }));

    const seen = new Set();
    return [...tenderItems, ...jobItems]
      .filter(item => {
        const key = normalizeSearchText(item.packageName);
        if (!key || seen.has(key)) return false;
        seen.add(key);
        return true;
      })
      .sort((left, right) => {
        const priorityScore = { Tinggi: 0, Sedang: 1, Rendah: 2 };
        return priorityScore[left.priority] - priorityScore[right.priority] ||
          left.progress - right.progress ||
          left.packageName.localeCompare(right.packageName, "id");
      });
  }

  function renderPriorityRows(items) {
    state.dashboardFeaturedJobs = items.map(item => item.job);
    const body = document.getElementById("dashboardFeaturedJobs");
    if (!body) return;
    body.innerHTML = items.length
      ? items.map((item, index) => `
        <tr data-dashboard-portfolio-job-index="${index}">
          <td><strong>${escapeHtml(item.packageName)}</strong></td>
          <td>${escapeHtml(item.project || "-")}</td>
          <td><span class="dashboard-priority-badge priority-${String(item.priority).toLowerCase()}">${escapeHtml(item.priority)}</span></td>
          <td>
            <div class="dashboard-progress-line"><span style="width:${item.progress}%"></span></div>
            <small>${item.progress}%</small>
          </td>
          <td>${escapeHtml(item.pic || "-")}</td>
        </tr>
      `).join("")
      : '<tr><td colspan="5" class="dashboard-empty">Belum ada paket prioritas.</td></tr>';
  }

  function renderProgressBast(items) {
    const container = document.getElementById("dashboardProgressBast");
    if (!container) return;
    const item = items.find(candidate => candidate.progress > 0) || items[0];
    const report = item ? Math.max(0, Math.min(100, item.progress || 0)) : 0;
    const bast = item?.progress >= 100 ? 100 : 0;
    const main = Math.round(report * 0.6 + bast * 0.4);
    const pic = item?.pic || "-";
    container.innerHTML = `
      <div class="dashboard-progress-bars">
        ${renderProgressMetric("Laporan", report, "blue")}
        ${renderProgressMetric("BAST", bast, "muted")}
        ${renderProgressMetric("Progress Utama", main, "green")}
      </div>
      <div class="dashboard-progress-note">
        <strong>Perhitungan Progress Utama</strong>
        <span>60% Laporan + 40% BAST</span>
        <small>PIC</small>
        <b>${escapeHtml(pic)}</b>
        <em>Update Terakhir: ${escapeHtml(formatHumanDate(state.today))} 09:15</em>
      </div>
    `;
  }

  function renderProgressMetric(label, value, tone) {
    return `
      <div class="dashboard-progress-metric ${escapeHtml(tone)}">
        <span>${escapeHtml(label)}</span>
        <div><i style="width:${value}%"></i></div>
        <strong>${value}%</strong>
      </div>
    `;
  }

  function renderWorkSummary() {
    const activeJobsBody = document.getElementById("dashboardActiveJobsBody");
    const activePersonnelBody = document.getElementById("dashboardActivePersonnelBody");
    const inactivePersonnelBody = document.getElementById("dashboardInactivePersonnelBody");
    if (!activeJobsBody || !activePersonnelBody || !inactivePersonnelBody) return;

    const selectedYear = getCurrentSummaryYear();
    const activeJobs = buildJobsFromDataUtama()
      .filter(job => getActivePersonnelForJob(job, selectedYear) > 0)
      .sort((left, right) => left.pekerjaan.localeCompare(right.pekerjaan, "id"));
    const personnel = getAllIntegratedPersonnelRecords(selectedYear)
      .sort((left, right) => getPersonnelName(left).localeCompare(getPersonnelName(right), "id"));
    const activePersonnel = personnel.filter(record => getPersonnelActiveWork(record) > 0);
    const inactivePersonnel = personnel.filter(record => getPersonnelActiveWork(record) <= 0);

    state.dashboardActivePersonnelRecords = activePersonnel;
    state.dashboardInactivePersonnelRecords = inactivePersonnel;

    setText("dashboardWorkSummaryPeriod", `Ringkasan tahun ${selectedYear}`);
    setText("dashboardActiveJobsCount", activeJobs.length);
    setText("dashboardActivePersonnelCount", activePersonnel.length);
    setText("dashboardInactivePersonnelCount", inactivePersonnel.length);

    activeJobsBody.innerHTML = activeJobs.length
      ? activeJobs.map(job => `
        <tr>
          <td><strong>${escapeHtml(job.pekerjaan)}</strong></td>
          <td>${escapeHtml(getJobYearLabel(job))}</td>
          <td>${escapeHtml(job.tanggalSelesai || "-")}</td>
          <td>${getActivePersonnelForJob(job, selectedYear)}</td>
          <td><span class="work-status-badge active">Aktif</span></td>
        </tr>
      `).join("")
      : '<tr><td class="dashboard-summary-empty" colspan="5">Belum ada pekerjaan aktif pada tahun ini.</td></tr>';

    activePersonnelBody.innerHTML = activePersonnel.length
      ? activePersonnel.map((record, index) => `
        <tr>
          <td>
            <button class="personnel-history-link" type="button" data-dashboard-personnel-group="active" data-dashboard-personnel-index="${index}">
              ${escapeHtml(getPersonnelName(record))}
            </button>
          </td>
          <td>${escapeHtml(getPersonnelStatus(record))}</td>
          <td>${escapeHtml(String(getPersonnelActiveWork(record)))}</td>
          <td>${escapeHtml(getPersonnelAccumulation(record))}</td>
        </tr>
      `).join("")
      : '<tr><td class="dashboard-summary-empty" colspan="4">Belum ada personil dengan pekerjaan aktif.</td></tr>';

    inactivePersonnelBody.innerHTML = inactivePersonnel.length
      ? inactivePersonnel.map((record, index) => `
        <tr>
          <td>
            <button class="personnel-history-link" type="button" data-dashboard-personnel-group="inactive" data-dashboard-personnel-index="${index}">
              ${escapeHtml(getPersonnelName(record))}
            </button>
          </td>
          <td>${escapeHtml(getPersonnelStatus(record))}</td>
          <td>${escapeHtml(getPersonnelPosition(record))}</td>
          <td>${escapeHtml(getPersonnelFinishedWork(record))}</td>
        </tr>
      `).join("")
      : '<tr><td class="dashboard-summary-empty" colspan="4">Semua personil memiliki pekerjaan aktif.</td></tr>';
  }

  function handlePersonnelClick(event) {
    const button = event.target.closest("[data-dashboard-personnel-index]");
    if (!button) return;
    const records = button.dataset.dashboardPersonnelGroup === "active"
      ? state.dashboardActivePersonnelRecords
      : state.dashboardInactivePersonnelRecords;
    const record = records?.[Number(button.dataset.dashboardPersonnelIndex)];
    if (record) openPersonnelDetail(record);
  }

  function handlePortfolioCardClick(event) {
    const card = event.target.closest("[data-dashboard-portfolio-job-index]");
    if (!card) return;
    openPortfolioJob(state.dashboardFeaturedJobs[Number(card.dataset.dashboardPortfolioJobIndex)]);
  }

  function getRelativeDateLabel(value) {
    if (!value) return "-";
    const date = new Date(String(value).includes("T") ? value : `${value}T00:00:00`);
    const today = new Date(`${state.today}T00:00:00`);
    if (!Number.isFinite(date.getTime())) return "-";
    const diff = Math.ceil((date.getTime() - today.getTime()) / 86400000);
    if (diff < 0) return `${Math.abs(diff)} hari lewat`;
    if (diff === 0) return "Hari ini";
    if (diff === 1) return "Besok";
    return `${diff} hari lagi`;
  }

  return {
    bindControls,
    renderHome,
    renderWorkSummary,
    getAssignmentCategories,
    getPrioritySourceItems,
    handleAssignmentFilter,
    handlePersonnelClick,
    handlePortfolioCardClick
  };
}
