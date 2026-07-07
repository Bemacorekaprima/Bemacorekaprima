import { applyViewScrollMode, captureViewScrollState } from "./scroll.js";

export const DEFAULT_VIEW_TITLES = {
  dashboard: "Dashboard",
  tenders: "Tender",
  jobs: "Portofolio",
  portfolioDetail: "Detail Portofolio",
  financeDetail: "Rincian Finance",
  personnel: "Personil",
  finance: "Finance",
  inventory: "Inventaris",
  tasks: "Tugas",
  reports: "Laporan",
  settings: "Pengaturan"
};

export function createRouter(options = {}) {
  const {
    state,
    canViewMenu,
    notify,
    viewTitles = DEFAULT_VIEW_TITLES,
    mainSelector = ".main"
  } = options;

  if (!state) throw new Error("Router membutuhkan state aplikasi.");
  if (typeof canViewMenu !== "function") throw new Error("Router membutuhkan canViewMenu().");

  function getNavigationView(view) {
    return {
      portfolioDetail: "jobs",
      financeDetail: "finance"
    }[view] || view;
  }

  function renderView() {
    const navigationView = getNavigationView(state.activeView);
    document.querySelectorAll(".nav-item").forEach(button => {
      button.classList.toggle("active", button.dataset.view === navigationView);
    });
    document.querySelectorAll(".view").forEach(view => {
      view.classList.toggle("active", view.id === `${state.activeView}View`);
    });
    const pageTitle = document.getElementById("pageTitle");
    if (pageTitle) pageTitle.textContent = viewTitles[state.activeView] || "Dashboard";
  }

  function setView(view, viewOptions = {}) {
    const { scroll = "preserve" } = viewOptions || {};
    if (!canViewMenu(view)) {
      notify?.("Role Anda tidak memiliki akses untuk membuka menu ini.");
      return false;
    }

    const snapshot = scroll === "preserve"
      ? captureViewScrollState({ mainSelector })
      : null;
    state.activeView = view;
    renderView();
    applyViewScrollMode(scroll, snapshot, { mainSelector });
    return true;
  }

  return {
    renderView,
    setView
  };
}
