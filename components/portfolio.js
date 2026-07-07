export function createPortfolioFeature(options = {}) {
  const {
    state,
    setView,
    escapeHtml,
    safeClassToken,
    normalizeSearchText,
    includesAny,
    getInitials,
    getDataUtamaSheet,
    renderYearFilterOptions,
    getPortfolioScopeJobs,
    getFilteredJobs,
    getPortfolioCounts,
    getPortfolioCardPriority,
    getPortfolioStatusKey,
    getPortfolioStatusLabel,
    getPortfolioProgress,
    getPortfolioPeople,
    getCurrentSummaryYear,
    getAllIntegratedPersonnelRecords,
    getPersonnelActiveWork,
    getFocusTasks,
    getJobYearLabel,
    getJobStatus,
    getRecordValue,
    openJobDetail,
    openJobRecordForm,
    renderTenders,
    refreshJobsData,
    toggleJobsToolsMenu,
    exportJobsPdf,
    exportJobsExcel
  } = options;

  if (!state) throw new Error("Portfolio feature membutuhkan state aplikasi.");

  let controlsBound = false;

  function bindControls() {
    if (controlsBound) return;
    controlsBound = true;

    document.getElementById("jobsSearch")?.addEventListener("input", event => {
      state.jobsSearch = event.target.value;
      state.jobsPage = 1;
      renderJobs();
    });
    document.getElementById("jobsYearFilter")?.addEventListener("change", event => {
      state.jobsYear = event.target.value;
      state.jobsPage = 1;
      renderJobs();
    });
    document.getElementById("jobsStatusFilter")?.addEventListener("change", event => {
      state.jobsStatus = event.target.value;
      state.jobsPage = 1;
      renderJobs();
    });
    document.getElementById("jobsPageSize")?.addEventListener("change", event => {
      state.jobsPageSize = Number(event.target.value) || 25;
      state.jobsPage = 1;
      renderJobs();
    });
    document.getElementById("refreshJobsButton")?.addEventListener("click", refreshJobsData);
    document.getElementById("jobsToolsButton")?.addEventListener("click", toggleJobsToolsMenu);
    document.getElementById("addJobButton")?.addEventListener("click", () => openJobRecordForm());
    document.getElementById("exportJobsPdfButton")?.addEventListener("click", exportJobsPdf);
    document.getElementById("exportJobsExcelButton")?.addEventListener("click", exportJobsExcel);
    document.getElementById("resetJobsFilters")?.addEventListener("click", resetFilters);
    document.getElementById("jobsPrevPage")?.addEventListener("click", () => changePage(-1));
    document.getElementById("jobsNextPage")?.addEventListener("click", () => changePage(1));
    document.getElementById("jobsTableBody")?.addEventListener("click", handleTableClick);
    document.getElementById("jobsMobileCards")?.addEventListener("click", handleMobileClick);
    document.getElementById("portfolioFeaturedJobs")?.addEventListener("click", handleCardClick);
    document.getElementById("portfolioSummary")?.addEventListener("click", handleSummaryClick);
    document.getElementById("dashboardPortfolioSummary")?.addEventListener("click", handleSummaryClick);
    document.getElementById("portfolioAddItemButton")?.addEventListener("click", () => openJobRecordForm());
  }

  function renderOverview(filteredJobs) {
    const scopeJobs = getPortfolioScopeJobs();
    const counts = getPortfolioCounts(scopeJobs);
    setText("portfolioYearLabel", state.jobsYear === "all"
      ? "Seluruh portofolio"
      : `Portofolio tahun ${state.jobsYear}`);
    setText("portfolioTotalCount", counts.total);
    setText("portfolioActiveCount", counts.active);
    setText("portfolioFinishCount", counts.finish);
    setText("portfolioTenderCount", counts.tender);
    setText("portfolioUpcomingCount", counts.upcoming);
    setText("portfolioCollectionCount", `${filteredJobs.length} item`);

    const featured = [...filteredJobs]
      .sort((left, right) =>
        getPortfolioCardPriority(left) - getPortfolioCardPriority(right) ||
        left.pekerjaan.localeCompare(right.pekerjaan, "id")
      )
      .slice(0, 3);
    state.portfolioFeaturedJobs = featured;

    const container = document.getElementById("portfolioFeaturedJobs");
    if (container) {
      container.innerHTML = featured.length
        ? featured.map((job, index) => renderJobCard(job, index)).join("")
        : '<div class="portfolio-empty">Tidak ada pekerjaan yang cocok dengan filter.</div>';
    }

    const selectedYear = getCurrentSummaryYear();
    const personnel = getAllIntegratedPersonnelRecords(selectedYear);
    const availablePersonnel = personnel.filter(record => getPersonnelActiveWork(record) <= 0).length;
    const briefParts = [];
    if (counts.tender) briefParts.push(`${counts.tender} paket Tender perlu dipantau`);
    if (counts.upcoming) briefParts.push(`${counts.upcoming} pekerjaan Upcoming perlu persiapan`);
    if (availablePersonnel) briefParts.push(`${availablePersonnel} personil tersedia untuk dialokasikan`);
    setText("portfolioAiBrief", briefParts.length
      ? `${briefParts.join(". ")}.`
      : "Portofolio tidak memiliki peringatan utama berdasarkan data yang tersedia.");

    renderActivity(scopeJobs);
    renderAgenda();
  }

  function renderJobCard(job, index) {
    const statusKey = getPortfolioStatusKey(job);
    const people = getPortfolioPeople(job);
    const progress = getPortfolioProgress(job);
    const personCount = job.personnelCount ?? job.records.length;
    const footerLabel = statusKey === "tender"
      ? `${progress}% dokumen`
      : job.tanggalSelesai || `${personCount} personil`;
    return `
      <button class="portfolio-job-card status-${safeClassToken(statusKey)}" type="button" data-portfolio-job-index="${index}">
        <span class="portfolio-card-accent"></span>
        <span class="portfolio-card-heading">
          <strong>${escapeHtml(job.pekerjaan)}</strong>
          <span class="portfolio-status">${escapeHtml(getPortfolioStatusLabel(job))}</span>
        </span>
        <span class="portfolio-card-team">
          <span class="portfolio-avatars">
            ${people.map(name => `<i title="${escapeHtml(name)}">${escapeHtml(getInitials(name))}</i>`).join("")}
            ${people.length ? "" : "<em>Belum ada personil</em>"}
          </span>
          <small>${personCount} personil</small>
        </span>
        <span class="portfolio-progress-track" aria-label="Indikator tahap ${progress}%">
          <span style="width:${progress}%"></span>
        </span>
        <span class="portfolio-card-footer">
          <b>${progress}%</b>
          <small>${escapeHtml(footerLabel)}</small>
        </span>
      </button>
    `;
  }

  function renderActivity(allJobs) {
    const list = document.getElementById("portfolioActivityList");
    if (list) list.innerHTML = renderActivityItems(buildActivities(allJobs));
  }

  function buildActivities(allJobs) {
    const activities = [];
    state.tenders.slice(0, 2).forEach(tender => {
      activities.push({
        initials: getInitials(tender.updatedBy || tender.ownerName || "Tender"),
        tone: "purple",
        title: `memperbarui paket ${tender.name || "Tender"}`,
        meta: `${tender.status || "Persiapan"} - ${tender.ownerName || tender.updatedBy || "Tim Tender"}`
      });
    });
    state.tasks
      .slice()
      .sort((left, right) => String(right.deadline || right.tanggal || "").localeCompare(String(left.deadline || left.tanggal || "")))
      .slice(0, Math.max(0, 3 - activities.length))
      .forEach(task => {
        activities.push({
          initials: getInitials(task.penanggungJawab || task.dibuatOleh || "Tim"),
          tone: task.status === "Selesai" ? "green" : "blue",
          title: `${task.status === "Selesai" ? "menyelesaikan" : "menangani"} ${task.namaTugas}`,
          meta: task.deadline ? `Deadline ${task.deadline}` : task.tanggal || "Agenda aktif"
        });
      });
    if (activities.length < 3) {
      allJobs.slice(0, 3 - activities.length).forEach(job => {
        activities.push({
          initials: getInitials(job.pekerjaan),
          tone: getPortfolioStatusKey(job) === "upcoming" ? "orange" : "green",
          title: `${job.pekerjaan} berstatus ${getPortfolioStatusLabel(job)}`,
          meta: `${job.personnelCount ?? job.records.length} personil terhubung`
        });
      });
    }

    return activities.slice(0, 3);
  }

  function renderActivityItems(activities) {
    return activities.length
      ? activities.slice(0, 3).map(activity => `
          <div class="portfolio-activity-item">
            <span class="portfolio-activity-avatar ${safeClassToken(activity.tone)}">${escapeHtml(activity.initials)}</span>
            <span>
              <strong>${escapeHtml(activity.title)}</strong>
              <small>${escapeHtml(activity.meta)}</small>
            </span>
          </div>
        `).join("")
      : '<p class="portfolio-empty-note">Belum ada aktivitas yang dapat ditampilkan.</p>';
  }

  function renderAgenda() {
    const agenda = getFocusTasks().slice(0, 2);
    setText("portfolioAgendaCount", `${agenda.length} agenda`);
    const list = document.getElementById("portfolioAgendaList");
    if (!list) return;
    list.innerHTML = agenda.length
      ? agenda.map(task => `
          <div class="portfolio-agenda-item">
            <span>${escapeHtml(task.deadline ? task.deadline.slice(0, 10) : task.tanggal || "-")}</span>
            <strong>${escapeHtml(task.namaTugas)}</strong>
            <small>${escapeHtml(task.penanggungJawab || "Penanggung jawab belum diisi")}</small>
          </div>
        `).join("")
      : '<p class="portfolio-empty-note">Belum ada agenda prioritas.</p>';
  }

  function handleSummaryClick(event) {
    const trigger = event.target.closest("[data-portfolio-summary-filter]");
    if (!trigger) return;
    const context = trigger.dataset.portfolioSummaryContext;
    const filter = trigger.dataset.portfolioSummaryFilter || "all";

    if (context === "dashboard") {
      state.jobsSearch = "";
      state.jobsYear = "all";
    }
    state.jobsStatus = filter;
    state.jobsPage = 1;
    setView("jobs", { scroll: "top" });

    const searchInput = document.getElementById("jobsSearch");
    const yearFilter = document.getElementById("jobsYearFilter");
    const statusFilter = document.getElementById("jobsStatusFilter");
    if (searchInput) searchInput.value = state.jobsSearch;
    if (yearFilter) yearFilter.value = state.jobsYear;
    if (statusFilter) statusFilter.value = state.jobsStatus;
    renderJobs();
  }

  function renderJobs() {
    const sheet = getDataUtamaSheet();
    const syncText = document.getElementById("jobsSyncText");
    const tableBody = document.getElementById("jobsTableBody");
    const resultCount = document.getElementById("jobsResultCount");
    if (!tableBody) return;
    renderYearFilterOptions();

    if (syncText) {
      syncText.textContent = sheet?.status === "ready"
        ? "Data tersinkron"
        : sheet?.status === "loading"
          ? "Memuat data..."
          : sheet?.status === "error"
            ? "Data belum dapat dibaca."
            : "Menunggu sinkronisasi...";
    }

    const jobs = getFilteredJobs();
    renderOverview(jobs);
    state.jobsVisibleRecords = jobs;
    const pageSize = Number(state.jobsPageSize) || 25;
    const pageCount = Math.max(1, Math.ceil(jobs.length / pageSize));
    state.jobsPage = Math.min(Math.max(1, state.jobsPage), pageCount);
    const startIndex = (state.jobsPage - 1) * pageSize;
    const visible = jobs.slice(startIndex, startIndex + pageSize);

    if (resultCount) resultCount.textContent = `${jobs.length} pekerjaan ditemukan`;
    tableBody.innerHTML = visible.length
      ? visible.map((job, index) => renderTableRow(job, startIndex + index)).join("")
      : '<tr><td class="personnel-empty" colspan="7">Tidak ada pekerjaan yang cocok.</td></tr>';

    renderMobileCards(visible, startIndex);
    setPaginationButtons(pageCount);
  }

  function renderTableRow(job, absoluteIndex) {
    return `
      <tr class="clickable-row" data-job-index="${absoluteIndex}" tabindex="0">
        <td data-label="No.">${absoluteIndex + 1}</td>
        <td data-label="Pekerjaan"><strong>${escapeHtml(job.pekerjaan)}</strong></td>
        <td data-label="Tahun">${escapeHtml(getJobYearLabel(job))}</td>
        <td data-label="Tanggal Mulai">${escapeHtml(job.tanggalMulai || "-")}</td>
        <td data-label="Tanggal Selesai">${escapeHtml(job.tanggalSelesai || "-")}</td>
        <td data-label="Jumlah Personil">${job.personnelCount ?? job.records.length}</td>
        <td data-label="Status Pekerjaan">${escapeHtml(getJobStatus(job))}</td>
      </tr>
    `;
  }

  function renderMobileCards(visibleJobs, startIndex) {
    const container = document.getElementById("jobsMobileCards");
    if (!container) return;
    if (!visibleJobs.length) {
      container.innerHTML = '<p class="portfolio-mobile-empty">Tidak ada pekerjaan yang cocok.</p>';
      return;
    }

    container.innerHTML = visibleJobs.map((job, index) => {
      const absoluteIndex = startIndex + index;
      const members = getMobileMembers(job);
      return `
        <article class="portfolio-mobile-card" data-mobile-job-index="${absoluteIndex}">
          <header class="portfolio-mobile-header">
            <button type="button" class="portfolio-mobile-back" data-mobile-job-open="${absoluteIndex}" aria-label="Buka rincian ${escapeHtml(job.pekerjaan)}">
              <i data-lucide="chevron-left" aria-hidden="true"></i>
            </button>
            <div>
              <strong>${escapeHtml(job.pekerjaan || "Pekerjaan")}</strong>
              <span>${escapeHtml(getPortfolioStatusLabel(job))} \u00b7 ${job.personnelCount ?? job.records.length} personil</span>
            </div>
          </header>
          <div class="portfolio-mobile-table" role="table" aria-label="Personil ${escapeHtml(job.pekerjaan)}">
            <div class="portfolio-mobile-head" role="row">
              <span>Nama</span>
              <span>Posisi</span>
              <span>Status</span>
              <span>Keterlibatan</span>
              <span>Aksi</span>
            </div>
            ${members.length ? members.map((member, memberIndex) => `
              <div class="portfolio-mobile-row" role="row">
                <strong>${escapeHtml(member.name)}</strong>
                <span>${escapeHtml(member.position)}</span>
                <span><em class="portfolio-mobile-status ${member.statusClass}">${escapeHtml(member.status)}</em></span>
                <span><b class="portfolio-mobile-check ${member.involved ? "yes" : "no"}">${member.involved ? "\u2713" : "\u2715"}</b></span>
                <span>
                  <button type="button" data-mobile-job-open="${absoluteIndex}">Detail</button>
                  ${member.rowNumber ? `<button type="button" data-mobile-job-edit="${absoluteIndex}" data-mobile-member-index="${memberIndex}">Edit</button>` : ""}
                </span>
              </div>
            `).join("") : `
              <div class="portfolio-mobile-row empty" role="row">
                <strong>-</strong>
                <span>Belum ada personil</span>
                <span><em class="portfolio-mobile-status neutral">-</em></span>
                <span><b class="portfolio-mobile-check no">\u2715</b></span>
                <span><button type="button" data-mobile-job-open="${absoluteIndex}">Detail</button></span>
              </div>
            `}
          </div>
        </article>
      `;
    }).join("");
    window.lucide?.createIcons?.();
  }

  function getMobileMembers(job) {
    return (job.records || []).map(record => {
      const rawStatus = getRecordValue(record, ["status kontrak", "status pekerjaan", "status project", "status proyek"]) ||
        getPortfolioStatusLabel(job);
      const normalizedStatus = normalizeSearchText(rawStatus);
      const involvedText = getRecordValue(record, ["keterlibatan", "terlibat", "aktif"]);
      const involved = ["ya", "yes", "true", "1", "aktif"].includes(normalizeSearchText(involvedText));
      return {
        name: getRecordValue(record, ["nama personil", "nama lengkap", "nama"]) || "-",
        position: getRecordValue(record, [
          "posisi/jabatan (real)",
          "posisi jabatan real",
          "posisi/jabatan (kontrak)",
          "posisi jabatan kontrak",
          "jabatan",
          "posisi"
        ]) || "-",
        status: rawStatus || "-",
        statusClass: includesAny(normalizedStatus, ["kontrak", "aktif", "ongoing", "progress"]) ? "contract" :
          includesAny(normalizedStatus, ["tidak", "non", "selesai", "finish"]) ? "inactive" : "neutral",
        involved,
        rowNumber: Number(record["_Sumber Baris"]) || 0,
        record
      };
    });
  }

  function setPaginationButtons(pageCount) {
    const info = document.getElementById("jobsPageInfo");
    const prev = document.getElementById("jobsPrevPage");
    const next = document.getElementById("jobsNextPage");
    if (info) info.textContent = `Halaman ${state.jobsPage} dari ${pageCount}`;
    if (prev) prev.disabled = state.jobsPage <= 1;
    if (next) next.disabled = state.jobsPage >= pageCount;
  }

  function resetFilters() {
    state.jobsSearch = "";
    state.jobsYear = "all";
    state.jobsStatus = "all";
    state.jobsPage = 1;
    state.jobsPageSize = 25;
    setInputValue("jobsSearch", "");
    setInputValue("jobsYearFilter", "all");
    setInputValue("jobsStatusFilter", state.jobsStatus);
    setInputValue("jobsPageSize", "25");
    renderJobs();
  }

  function changePage(offset) {
    state.jobsPage += offset;
    renderJobs();
  }

  function handleTableClick(event) {
    const row = event.target.closest("[data-job-index]");
    if (!row) return;
    openJob(state.jobsVisibleRecords[Number(row.dataset.jobIndex)]);
  }

  function handleMobileClick(event) {
    const editButton = event.target.closest("[data-mobile-job-edit]");
    if (editButton) {
      const job = state.jobsVisibleRecords[Number(editButton.dataset.mobileJobEdit)];
      if (!job) return;
      const member = getMobileMembers(job)[Number(editButton.dataset.mobileMemberIndex)];
      if (member?.record) openJobRecordForm(member.record, job);
      return;
    }

    const openButton = event.target.closest("[data-mobile-job-open], [data-mobile-job-index]");
    if (!openButton) return;
    const index = Number(openButton.dataset.mobileJobOpen || openButton.dataset.mobileJobIndex);
    openJob(state.jobsVisibleRecords[index]);
  }

  function handleCardClick(event) {
    const card = event.target.closest("[data-portfolio-job-index]");
    if (!card) return;
    openJob(state.portfolioFeaturedJobs[Number(card.dataset.portfolioJobIndex)]);
  }

  function openJob(job) {
    if (!job) return;
    openJobDetail(job);
  }

  function setInputValue(id, value) {
    const input = document.getElementById(id);
    if (input) input.value = value;
  }

  function setText(id, value) {
    const element = document.getElementById(id);
    if (element) element.textContent = value;
  }

  return {
    bindControls,
    renderJobs,
    renderOverview,
    renderActivity,
    renderAgenda,
    buildActivities,
    renderActivityItems,
    handleSummaryClick,
    resetFilters,
    changePage,
    handleTableClick,
    handleMobileClick,
    handleCardClick,
    openJob,
    getMobileMembers
  };
}
