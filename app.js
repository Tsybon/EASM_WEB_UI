const STORAGE_KEYS = {
  customPresets: "easm_mvp_custom_presets_v1"
};

const ASSET_TYPES = ["ip", "cidr", "domain", "url"];

const ORG_WIZARD_STEPS = [
  { key: "scan-name", title: "Scan name" },
  { key: "organisation", title: "Organisation" },
  { key: "assets", title: "Assets for scan" },
  { key: "preset", title: "Preset" },
  { key: "bbot", title: "BBOT command" },
  { key: "summary", title: "Summary" }
];

const state = {
  organisations: [],
  assets: [],
  assetKeySet: new Set(),
  nextAssetId: 1,
  presets: [],
  moduleParameters: {},
  docs: {
    sources: [],
    presets: {},
    modules: {}
  },
  selectedOrgIds: new Set(),
  selectedPreset: "",
  presetOverrides: {},
  filters: {
    search: "",
    types: new Set(ASSET_TYPES),
    selection: "all"
  },
  commandMode: "auto",
  commandText: "",
  scanNameInput: "",
  scanRun: {
    status: "idle",
    startedAt: null
  },
  sync: {
    lastSync: null,
    status: "idle"
  },
  validation: {
    message: "Validation not run",
    status: "idle"
  },
  syncCounter: 31,
  ui: {
    expandedModulesByPreset: {},
    expandedModulesCustomScan: new Set()
  },
  customScan: {
    enabledModules: new Set(),
    moduleParams: {},
    search: ""
  },
  wizard: {
    currentIndex: 0
  }
};

const elements = {};
let isSettingCommand = false;
let wizardObserver = null;
let wizardSuppressUntil = 0;

function initElements() {
  elements.navLinks = document.querySelectorAll(".nav-link");
  elements.sections = {
    "org-scan": document.getElementById("page-org-scan"),
    "preset-creator": document.getElementById("page-preset-creator"),
    "custom-scan": document.getElementById("page-custom-scan")
  };
  elements.sessionTime = document.getElementById("sessionTime");

  elements.orgDropdown = document.querySelector("[data-dropdown='org']");
  elements.orgDropdownTrigger = document.getElementById("orgDropdownTrigger");
  elements.orgDropdownSearch = document.getElementById("orgDropdownSearch");
  elements.orgDropdownOptions = document.getElementById("orgDropdownOptions");
  elements.orgSelectedLabel = document.getElementById("orgSelectedLabel");

  elements.syncBtn = document.getElementById("syncBtn");
  elements.syncStatus = document.getElementById("syncStatus");
  elements.syncState = document.getElementById("syncState");

  elements.scanNameInput = document.getElementById("scanNameInput");
  elements.scanNameHint = document.getElementById("scanNameHint");

  elements.assetSearch = document.getElementById("assetSearch");
  elements.assetTypeDropdown = document.querySelector("[data-dropdown='asset-type']");
  elements.assetTypeDropdownTrigger = document.getElementById("assetTypeDropdownTrigger");
  elements.assetTypeDropdownSearch = document.getElementById("assetTypeDropdownSearch");
  elements.assetTypeDropdownOptions = document.getElementById("assetTypeDropdownOptions");
  elements.assetTypeSelectedLabel = document.getElementById("assetTypeSelectedLabel");
  elements.assetSelectionFilter = document.getElementById("assetSelectionFilter");
  elements.manualAssets = document.getElementById("manualAssets");
  elements.addAssetsBtn = document.getElementById("addAssetsBtn");
  elements.assetFileInput = document.getElementById("assetFileInput");
  elements.importBtn = document.getElementById("importBtn");
  elements.importStatus = document.getElementById("importStatus");
  elements.assetsTable = document.getElementById("assetsTable");
  elements.assetsBody = document.getElementById("assetsBody");
  elements.assetCount = document.getElementById("assetCount");
  elements.assetsMasterCheckbox = document.getElementById("assetsMasterCheckbox");

  elements.presetDropdown = document.querySelector("[data-dropdown='preset']");
  elements.presetDropdownTrigger = document.getElementById("presetDropdownTrigger");
  elements.presetDropdownSearch = document.getElementById("presetDropdownSearch");
  elements.presetDropdownOptions = document.getElementById("presetDropdownOptions");
  elements.presetSelectedLabel = document.getElementById("presetSelectedLabel");
  elements.presetDocs = document.getElementById("presetDocs");
  elements.moduleList = document.getElementById("moduleList");
  elements.moduleCount = document.getElementById("moduleCount");
  elements.presetYaml = document.getElementById("presetYaml");
  elements.savePresetPrompt = document.getElementById("savePresetPrompt");
  elements.customPresetNameInput = document.getElementById("customPresetNameInput");
  elements.saveCustomPresetBtn = document.getElementById("saveCustomPresetBtn");
  elements.saveCustomPresetStatus = document.getElementById("saveCustomPresetStatus");

  elements.commandInput = document.getElementById("commandInput");
  elements.commandModeBadge = document.getElementById("commandModeBadge");
  elements.commandHint = document.getElementById("commandHint");
  elements.regenerateBtn = document.getElementById("regenerateBtn");
  elements.validateBtn = document.getElementById("validateBtn");
  elements.validationStatus = document.getElementById("validationStatus");

  elements.summaryMode = document.getElementById("summaryMode");
  elements.summaryScanName = document.getElementById("summaryScanName");
  elements.summaryOrg = document.getElementById("summaryOrg");
  elements.summaryAssets = document.getElementById("summaryAssets");
  elements.summaryModules = document.getElementById("summaryModules");
  elements.summaryCommand = document.getElementById("summaryCommand");
  elements.startScanBtn = document.getElementById("startScanBtn");
  elements.startScanStatus = document.getElementById("startScanStatus");

  elements.customModuleSearch = document.getElementById("customModuleSearch");
  elements.customModuleList = document.getElementById("customModuleList");
  elements.customModuleCount = document.getElementById("customModuleCount");
  elements.customYaml = document.getElementById("customYaml");

  elements.wizardSteps = document.getElementById("wizardSteps");
  elements.wizardPanels = document.querySelectorAll("[data-wizard-step]");
  elements.wizardBackBtn = document.getElementById("wizardBackBtn");
  elements.wizardNextBtn = document.getElementById("wizardNextBtn");
}

function normalizePresets(presets) {
  const seen = new Set();
  const normalized = [];

  presets.forEach((preset) => {
    if (!preset || typeof preset.name !== "string" || !Array.isArray(preset.modules)) {
      return;
    }
    const name = preset.name.trim();
    if (!name || seen.has(name)) {
      return;
    }
    seen.add(name);
    normalized.push({
      name,
      modules: preset.modules.map((module) => String(module)),
      moduleParams: preset.moduleParams && typeof preset.moduleParams === "object" ? preset.moduleParams : {},
      isCustom: Boolean(preset.isCustom)
    });
  });

  return normalized;
}

function normalizeDocs(docs) {
  const safeDocs = docs && typeof docs === "object" ? docs : {};
  const sources = Array.isArray(safeDocs.sources)
    ? safeDocs.sources
        .filter((source) => source && typeof source.label === "string" && typeof source.url === "string")
        .map((source) => ({ label: source.label, url: source.url }))
    : [];
  const presets = safeDocs.presets && typeof safeDocs.presets === "object" ? safeDocs.presets : {};
  const modules = safeDocs.modules && typeof safeDocs.modules === "object" ? safeDocs.modules : {};

  return {
    sources,
    presets,
    modules
  };
}

function loadCustomPresetsFromStorage() {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.customPresets);
    if (!raw) {
      return [];
    }
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) {
      return [];
    }
    return parsed
      .filter((item) => item && typeof item.name === "string" && Array.isArray(item.modules))
      .map((item) => ({
        name: String(item.name),
        modules: item.modules.map((module) => String(module)),
        moduleParams: item.moduleParams && typeof item.moduleParams === "object" ? item.moduleParams : {},
        isCustom: true
      }));
  } catch (error) {
    return [];
  }
}

function addCustomOrganisation(name) {
  const id = name
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9-_]/g, "")
    || `org-${Date.now()}`;
  const exists = state.organisations.some((org) => org.id === id || org.name.toLowerCase() === name.toLowerCase());
  if (!exists) {
    state.organisations.push({ id, name });
  }
  return id;
}

function saveCustomPresetsToStorage() {
  try {
    const customPresets = state.presets
      .filter((preset) => preset.isCustom)
      .map((preset) => ({
        name: preset.name,
        modules: preset.modules,
        moduleParams: preset.moduleParams || {}
      }));
    localStorage.setItem(STORAGE_KEYS.customPresets, JSON.stringify(customPresets));
  } catch (error) {
    // Ignore storage failures in file:// mode.
  }
}

function initState() {
  state.organisations = MOCK_DATA.organisations.slice();
  state.moduleParameters = MOCK_DATA.moduleParameters || {};
  state.docs = normalizeDocs(MOCK_DATA.docs);
  const customPresets = loadCustomPresetsFromStorage();
  state.presets = normalizePresets([...MOCK_DATA.presets, ...customPresets]);
  // Default to passive_scan when available to match the placeholder example.
  state.selectedPreset = state.presets.find((preset) => preset.name === "passive_scan")?.name || state.presets[0]?.name || "";
  state.selectedOrgIds = new Set(state.organisations.map((org) => org.id));
  state.filters.types = new Set(ASSET_TYPES);
  state.customScan.enabledModules = new Set();
  state.customScan.moduleParams = {};
  state.customScan.search = "";
  state.ui.expandedModulesByPreset = {};
  state.ui.expandedModulesCustomScan = new Set();
  state.wizard.currentIndex = 0;
  state.scanRun.status = "idle";
  state.scanRun.startedAt = null;

  MOCK_DATA.assets.forEach((asset) => {
    addAsset({
      organisation: asset.organisation,
      type: asset.type,
      value: asset.value,
      source: asset.source,
      selected: true
    });
  });

  state.sync.lastSync = new Date();
  state.sync.status = "idle";

  ensurePresetOverride(state.selectedPreset);
  renderCustomScan();
  updateCommandIfAuto();
}

function initEventListeners() {
  elements.navLinks.forEach((link) => {
    link.addEventListener("click", () => {
      const page = link.dataset.page;
      setActivePage(page);
    });
  });

  initMultiDropdown(
    elements.orgDropdown,
    elements.orgDropdownTrigger,
    elements.orgDropdownSearch,
    elements.orgDropdownOptions,
    (value) => {
      if (value === "custom") {
        const name = prompt("Enter custom organisation name");
        const trimmed = name ? name.trim() : "";
        if (trimmed) {
          const orgId = addCustomOrganisation(trimmed);
          state.selectedOrgIds.add(orgId);
        }
        elements.orgSelectedLabel.textContent = getOrganisationSelectionLabel();
        renderOrgOptions();
        renderAssetsTable();
        updateScanNameHint();
        updateCommandIfAuto();
        renderSummary();
        return;
      }
      toggleOrganisationSelection(value);
      elements.orgSelectedLabel.textContent = getOrganisationSelectionLabel();
      renderAssetsTable();
      updateScanNameHint();
      updateCommandIfAuto();
      renderSummary();
    },
    renderOrgOptions
  );

  initDropdown(
    "preset",
    elements.presetDropdown,
    elements.presetDropdownTrigger,
    elements.presetDropdownSearch,
    elements.presetDropdownOptions,
    (value) => {
      state.selectedPreset = value;
      elements.presetSelectedLabel.textContent = value;
      ensurePresetOverride(value);
      renderPreset();
      updateScanNameHint();
      updateCommandIfAuto();
      renderSummary();
      renderSavePresetPrompt();
    },
    renderPresetOptions
  );

  elements.syncBtn.addEventListener("click", handleSyncAssets);
  elements.scanNameInput.addEventListener("input", handleScanNameInput);

  elements.assetSearch.addEventListener("input", (event) => {
    state.filters.search = event.target.value;
    renderAssetsTable();
  });

  elements.assetSelectionFilter?.addEventListener("change", (event) => {
    state.filters.selection = event.target.value;
    renderAssetsTable();
  });

  elements.assetsMasterCheckbox?.addEventListener("change", (event) => {
    const checked = event.target.checked;
    setFilteredAssetSelection(checked);
  });

  initMultiDropdown(
    elements.assetTypeDropdown,
    elements.assetTypeDropdownTrigger,
    elements.assetTypeDropdownSearch,
    elements.assetTypeDropdownOptions,
    (value) => {
      toggleAssetTypeFilter(value);
      elements.assetTypeSelectedLabel.textContent = getAssetTypeSelectionLabel();
      renderAssetsTable();
    },
    renderAssetTypeOptions
  );

  elements.addAssetsBtn.addEventListener("click", handleManualAdd);
  elements.importBtn.addEventListener("click", handleImport);

  elements.assetsBody.addEventListener("change", (event) => {
    if (event.target.matches("input[type='checkbox']")) {
      const assetId = Number(event.target.dataset.assetId);
      const asset = state.assets.find((item) => item.id === assetId);
      if (asset) {
        asset.selected = event.target.checked;
        renderAssetsTable();
        updateCommandIfAuto();
        renderSummary();
      }
    }
  });

  elements.moduleList.addEventListener("click", (event) => {
    const row = event.target.closest(".module-row");
    if (!row) {
      return;
    }
    if (event.target.closest(".module-enable")) {
      return;
    }
    const moduleName = row.closest(".module-card")?.dataset.module;
    if (!moduleName) {
      return;
    }
    togglePresetModuleExpanded(state.selectedPreset, moduleName);
    renderPreset();
  });

  elements.moduleList.addEventListener("change", (event) => {
    if (event.target.matches("input[type='checkbox'][data-role='module-enabled']")) {
      toggleModule(event.target.dataset.module, event.target.checked);
      return;
    }

    if (event.target.matches(".module-param-input")) {
      updatePresetModuleParam(
        state.selectedPreset,
        event.target.dataset.module,
        event.target.dataset.paramKey,
        event.target.type === "checkbox" ? event.target.checked : event.target.value
      );
    }
  });

  elements.moduleList.addEventListener("input", (event) => {
    if (!event.target.matches("input.module-param-input")) {
      return;
    }
    if (event.target.type === "checkbox") {
      return;
    }
    updatePresetModuleParam(state.selectedPreset, event.target.dataset.module, event.target.dataset.paramKey, event.target.value);
  });

  elements.saveCustomPresetBtn.addEventListener("click", handleSaveCustomPreset);

  if (elements.customModuleSearch && elements.customModuleList) {
    elements.customModuleSearch.addEventListener("input", (event) => {
      state.customScan.search = event.target.value;
      renderCustomScan();
    });

    elements.customModuleList.addEventListener("click", (event) => {
      const row = event.target.closest(".module-row");
      if (!row) {
        return;
      }
      if (event.target.closest(".module-enable")) {
        return;
      }
      const moduleName = row.closest(".module-card")?.dataset.module;
      if (!moduleName) {
        return;
      }
      toggleCustomScanModuleExpanded(moduleName);
      renderCustomScan();
    });

    elements.customModuleList.addEventListener("change", (event) => {
      if (event.target.matches("input[type='checkbox'][data-role='module-enabled']")) {
        toggleCustomScanModule(event.target.dataset.module, event.target.checked);
        return;
      }

      if (event.target.matches(".module-param-input")) {
        updateCustomScanModuleParam(
          event.target.dataset.module,
          event.target.dataset.paramKey,
          event.target.type === "checkbox" ? event.target.checked : event.target.value
        );
      }
    });

    elements.customModuleList.addEventListener("input", (event) => {
      if (!event.target.matches("input.module-param-input")) {
        return;
      }
      if (event.target.type === "checkbox") {
        return;
      }
      updateCustomScanModuleParam(event.target.dataset.module, event.target.dataset.paramKey, event.target.value);
    });
  }

  elements.commandInput.addEventListener("input", () => {
    if (isSettingCommand) {
      return;
    }
    state.commandMode = "manual";
    state.commandText = elements.commandInput.value;
    autoResizeTextarea(elements.commandInput);
    updateCommandModeUI();
    renderSummary();
  });

  elements.regenerateBtn.addEventListener("click", () => {
    state.commandMode = "auto";
    updateCommandIfAuto();
    updateCommandModeUI();
    renderSummary();
  });

  elements.validateBtn.addEventListener("click", () => {
    // MVP assumption: validation only checks that the command is non-empty.
    const command = elements.commandInput.value.trim();
    if (!command) {
      state.validation.status = "error";
      state.validation.message = "Command is empty";
    } else {
      state.validation.status = "ok";
      state.validation.message = "Command looks OK (mock)";
    }
    renderValidationStatus();
  });

  elements.startScanBtn?.addEventListener("click", handleStartScan);

  document.addEventListener("click", (event) => {
    if (!elements.orgDropdown.contains(event.target)) {
      closeDropdown(elements.orgDropdown);
    }
    if (!elements.presetDropdown.contains(event.target)) {
      closeDropdown(elements.presetDropdown);
    }
    if (!elements.assetTypeDropdown.contains(event.target)) {
      closeDropdown(elements.assetTypeDropdown);
    }
  });
}

function setActivePage(pageKey) {
  elements.navLinks.forEach((link) => {
    link.classList.toggle("is-active", link.dataset.page === pageKey);
  });

  Object.entries(elements.sections).forEach(([key, section]) => {
    section.classList.toggle("is-active", key === pageKey);
  });
}

function initWizard() {
  if (!elements.wizardSteps || elements.wizardPanels.length === 0) {
    return;
  }

  elements.wizardSteps.innerHTML = "";
  ORG_WIZARD_STEPS.forEach((step, index) => {
    const item = document.createElement("li");
    item.className = "wizard-stepper-item";
    item.dataset.stepIndex = String(index);

    const button = document.createElement("button");
    button.type = "button";
    button.className = "wizard-stepper-btn";
    button.dataset.stepIndex = String(index);

    const indexBadge = document.createElement("span");
    indexBadge.className = "wizard-stepper-index";
    indexBadge.textContent = String(index + 1);

    const label = document.createElement("span");
    label.className = "wizard-stepper-label";
    label.textContent = step.title;

    button.appendChild(indexBadge);
    button.appendChild(label);
    item.appendChild(button);
    elements.wizardSteps.appendChild(item);
  });

  elements.wizardSteps.addEventListener("click", (event) => {
    const button = event.target.closest(".wizard-stepper-btn");
    if (!button) {
      return;
    }
    const nextIndex = Number(button.dataset.stepIndex);
    if (!Number.isFinite(nextIndex)) {
      return;
    }
    setWizardStep(nextIndex);
  });

  elements.wizardBackBtn?.addEventListener("click", () => setWizardStep(state.wizard.currentIndex - 1));
  elements.wizardNextBtn?.addEventListener("click", () => setWizardStep(state.wizard.currentIndex + 1));

  wizardObserver?.disconnect();
  wizardObserver = new IntersectionObserver(
    (entries) => {
      const visible = entries.filter((entry) => entry.isIntersecting);
      if (visible.length === 0) {
        return;
      }
      if (Date.now() < wizardSuppressUntil) {
        return;
      }
      visible.sort((a, b) => b.intersectionRatio - a.intersectionRatio);
      const key = visible[0].target.dataset.wizardStep;
      const index = ORG_WIZARD_STEPS.findIndex((step) => step.key === key);
      if (index !== -1 && index !== state.wizard.currentIndex) {
        state.wizard.currentIndex = index;
        renderWizard();
      }
    },
    { threshold: [0.25, 0.45, 0.65] }
  );

  elements.wizardPanels.forEach((panel) => wizardObserver?.observe(panel));

  renderWizard();
}

function setWizardStep(nextIndex) {
  const maxIndex = ORG_WIZARD_STEPS.length - 1;
  const clamped = Math.max(0, Math.min(maxIndex, nextIndex));
  state.wizard.currentIndex = clamped;

  closeDropdown(elements.orgDropdown);
  closeDropdown(elements.presetDropdown);
  closeDropdown(elements.assetTypeDropdown);

  wizardSuppressUntil = Date.now() + 800;

  const key = ORG_WIZARD_STEPS[clamped]?.key;
  const target = key ? document.getElementById(`wizard-${key}`) : null;
  target?.scrollIntoView({ behavior: "smooth", block: "start" });

  renderWizard();
}

function renderWizard() {
  if (!elements.wizardSteps || elements.wizardPanels.length === 0) {
    return;
  }

  const maxIndex = ORG_WIZARD_STEPS.length - 1;
  const step = ORG_WIZARD_STEPS[state.wizard.currentIndex] || ORG_WIZARD_STEPS[0];
  const activeKey = step.key;

  elements.wizardPanels.forEach((panel) => {
    panel.classList.toggle("is-active", panel.dataset.wizardStep === activeKey);
  });

  elements.wizardSteps.querySelectorAll(".wizard-stepper-item").forEach((item) => {
    const index = Number(item.dataset.stepIndex);
    const isActive = index === state.wizard.currentIndex;
    const isComplete = index < state.wizard.currentIndex;

    item.classList.toggle("is-active", isActive);
    item.classList.toggle("is-complete", isComplete);

    const button = item.querySelector(".wizard-stepper-btn");
    const badge = item.querySelector(".wizard-stepper-index");
    if (badge) {
      badge.textContent = isComplete ? "✓" : String(index + 1);
    }
    if (button) {
      if (isActive) {
        button.setAttribute("aria-current", "step");
      } else {
        button.removeAttribute("aria-current");
      }
    }
  });

  if (elements.wizardBackBtn) {
    elements.wizardBackBtn.disabled = state.wizard.currentIndex === 0;
  }
  if (elements.wizardNextBtn) {
    elements.wizardNextBtn.disabled = state.wizard.currentIndex === maxIndex;
  }

  if (activeKey === "bbot") {
    autoResizeTextarea(elements.commandInput);
  }
}

function initDropdown(key, root, trigger, searchInput, optionsContainer, onSelect, renderOptions) {
  const dropdownCard = root.closest(".card");
  trigger.addEventListener("click", (event) => {
    event.stopPropagation();
    const isOpen = root.classList.contains("open");
    closeDropdown(root);
    if (!isOpen) {
      root.classList.add("open");
      dropdownCard?.classList.add("is-elevated");
      trigger.setAttribute("aria-expanded", "true");
      searchInput.value = "";
      renderOptions();
      searchInput.focus();
    }
  });

  searchInput.addEventListener("input", () => {
    renderOptions();
  });

  optionsContainer.addEventListener("click", (event) => {
    const option = event.target.closest(".dropdown-option");
    if (!option) {
      return;
    }
    const value = option.dataset.value;
    onSelect(value);
    closeDropdown(root);
  });
}

function initMultiDropdown(root, trigger, searchInput, optionsContainer, onToggle, renderOptions) {
  const dropdownCard = root.closest(".card");
  trigger.addEventListener("click", (event) => {
    event.stopPropagation();
    const isOpen = root.classList.contains("open");
    closeDropdown(root);
    if (!isOpen) {
      root.classList.add("open");
      dropdownCard?.classList.add("is-elevated");
      trigger.setAttribute("aria-expanded", "true");
      searchInput.value = "";
      renderOptions();
      searchInput.focus();
    }
  });

  searchInput.addEventListener("input", () => {
    renderOptions();
  });

  optionsContainer.addEventListener("click", (event) => {
    const option = event.target.closest(".dropdown-option");
    if (!option) {
      return;
    }
    event.preventDefault();
    event.stopPropagation();
    const value = option.dataset.value;
    onToggle(value);
    renderOptions();
    searchInput.focus();
  });
}

function closeDropdown(root) {
  if (!root) {
    return;
  }
  if (root.classList.contains("open")) {
    root.classList.remove("open");
    root.closest(".card")?.classList.remove("is-elevated");
    const trigger = root.querySelector(".dropdown-trigger");
    trigger?.setAttribute("aria-expanded", "false");
  }
}

function renderOrgOptions() {
  const term = elements.orgDropdownSearch.value.trim().toLowerCase();
  const options = [
    { value: "all", label: "All organisations" },
    { value: "custom", label: "Custom organisation..." },
    ...state.organisations.map((org) => ({ value: org.id, label: org.name }))
  ];

  const filtered = options.filter((option) => option.label.toLowerCase().includes(term));
  elements.orgDropdownOptions.innerHTML = "";

  filtered.forEach((option) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "dropdown-option";
    const isSelected = option.value === "all" ? isAllOrganisationsSelected() : state.selectedOrgIds.has(option.value);
    const isMixedAll = option.value === "all" && state.selectedOrgIds.size > 0 && !isAllOrganisationsSelected();
    if (isSelected) {
      button.classList.add("is-selected");
    }
    button.dataset.value = option.value;
    const label = document.createElement("span");
    label.className = "option-label";
    label.textContent = option.label;
    const check = document.createElement("span");
    check.className = "option-check";
    check.textContent = isMixedAll ? "–" : "✓";
    button.appendChild(label);
    button.appendChild(check);
    elements.orgDropdownOptions.appendChild(button);
  });
}

function renderPresetOptions() {
  const term = elements.presetDropdownSearch.value.trim().toLowerCase();
  const options = state.presets.map((preset) => ({ value: preset.name, label: preset.name }));
  const filtered = options.filter((option) => option.label.toLowerCase().includes(term));
  elements.presetDropdownOptions.innerHTML = "";

  filtered.forEach((option) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "dropdown-option";
    if (option.value === state.selectedPreset) {
      button.classList.add("is-selected");
    }
    button.dataset.value = option.value;
    const label = document.createElement("span");
    label.className = "option-label";
    label.textContent = option.label;
    const check = document.createElement("span");
    check.className = "option-check";
    check.textContent = "✓";
    button.appendChild(label);
    button.appendChild(check);
    elements.presetDropdownOptions.appendChild(button);
  });
}

function getPresetDoc(presetName) {
  if (!presetName) {
    return null;
  }
  const doc = state.docs?.presets?.[presetName];
  return doc && typeof doc === "object" ? doc : null;
}

function getModuleDoc(moduleName) {
  if (!moduleName) {
    return null;
  }
  const doc = state.docs?.modules?.[moduleName];
  return doc && typeof doc === "object" ? doc : null;
}

function createExternalLink(label, url) {
  const link = document.createElement("a");
  link.href = url;
  link.target = "_blank";
  link.rel = "noreferrer";
  link.textContent = label;
  return link;
}

function renderPresetDocs() {
  if (!elements.presetDocs) {
    return;
  }

  const doc = getPresetDoc(state.selectedPreset);
  const knownDocPresets = Object.keys(state.docs?.presets || {});

  elements.presetDocs.innerHTML = "";

  const title = document.createElement("div");
  title.className = "docs-title";
  title.textContent = "Docs (PoC)";
  elements.presetDocs.appendChild(title);

  const description = document.createElement("p");
  description.className = "docs-description";
  if (doc?.description) {
    description.textContent = doc.description;
  } else if (knownDocPresets.length > 0) {
    description.textContent = `PoC docs available for: ${knownDocPresets.slice(0, 3).join(", ")}.`;
  } else {
    description.textContent = "No docs metadata configured.";
  }
  elements.presetDocs.appendChild(description);

  const links = document.createElement("div");
  links.className = "docs-links";

  if (doc?.url) {
    links.appendChild(createExternalLink("View preset in docs", doc.url));
  }

  state.docs.sources.forEach((source) => {
    links.appendChild(createExternalLink(source.label, source.url));
  });

  if (links.childNodes.length > 0) {
    elements.presetDocs.appendChild(links);
  }
}

function createModuleDocBlock(moduleName) {
  const doc = getModuleDoc(moduleName);
  if (!doc) {
    return null;
  }

  const wrapper = document.createElement("div");
  wrapper.className = "module-doc";

  const title = document.createElement("div");
  title.className = "docs-title";
  title.textContent = "Docs (PoC)";
  wrapper.appendChild(title);

  const description = document.createElement("p");
  description.className = "docs-description";
  description.textContent = doc.description ? String(doc.description) : "";
  wrapper.appendChild(description);

  if (doc.url) {
    wrapper.appendChild(createExternalLink("Open docs", doc.url));
  }

  return wrapper;
}

function renderAssetTypeOptions() {
  const term = elements.assetTypeDropdownSearch.value.trim().toLowerCase();
  const options = [
    { value: "all", label: "All types" },
    ...ASSET_TYPES.map((type) => ({ value: type, label: type.toUpperCase() }))
  ];
  const filtered = options.filter((option) => option.label.toLowerCase().includes(term));
  elements.assetTypeDropdownOptions.innerHTML = "";

  filtered.forEach((option) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "dropdown-option";
    const isSelected = option.value === "all" ? isAllAssetTypesSelected() : state.filters.types.has(option.value);
    const isMixedAll = option.value === "all" && state.filters.types.size > 0 && !isAllAssetTypesSelected();
    if (isSelected) {
      button.classList.add("is-selected");
    }
    button.dataset.value = option.value;

    const label = document.createElement("span");
    label.className = "option-label";
    label.textContent = option.label;
    const check = document.createElement("span");
    check.className = "option-check";
    check.textContent = isMixedAll ? "–" : "✓";
    button.appendChild(label);
    button.appendChild(check);

    elements.assetTypeDropdownOptions.appendChild(button);
  });
}

function addAsset({ organisation, type, value, source, selected }) {
  const normalizedValue = normalizeAssetValue(type, value);
  const key = `${type}|${normalizedValue}`;
  if (state.assetKeySet.has(key)) {
    return { added: false, reason: "duplicate" };
  }
  const asset = {
    id: state.nextAssetId++,
    organisation,
    type,
    value: normalizedValue,
    source,
    selected: selected ?? true
  };
  state.assets.push(asset);
  state.assetKeySet.add(key);
  return { added: true, asset };
}

function normalizeAssetValue(type, value) {
  const trimmed = value.trim();
  if (type === "domain" || type === "url") {
    return trimmed.toLowerCase();
  }
  return trimmed;
}

function isAllOrganisationsSelected() {
  return state.selectedOrgIds.size >= state.organisations.length;
}

function getOrganisationSelectionLabel() {
  if (isAllOrganisationsSelected()) {
    return "All organisations";
  }
  const names = state.organisations
    .filter((org) => state.selectedOrgIds.has(org.id))
    .map((org) => org.name);
  if (names.length === 0) {
    return "Select organisations";
  }
  if (names.length <= 2) {
    return names.join(", ");
  }
  return `${names[0]}, ${names[1]} +${names.length - 2}`;
}

function toggleOrganisationSelection(orgId) {
  if (orgId === "all") {
    if (isAllOrganisationsSelected()) {
      state.selectedOrgIds.clear();
    } else {
      state.selectedOrgIds = new Set(state.organisations.map((org) => org.id));
    }
    return;
  }

  const next = new Set(state.selectedOrgIds);
  if (next.has(orgId)) {
    if (next.size <= 1) {
      return;
    }
    next.delete(orgId);
  } else {
    next.add(orgId);
  }
  state.selectedOrgIds = next;
}

function isAllAssetTypesSelected() {
  return state.filters.types.size >= ASSET_TYPES.length;
}

function toggleAssetTypeFilter(typeValue) {
  if (typeValue === "all") {
    if (isAllAssetTypesSelected()) {
      state.filters.types = new Set();
    } else {
      state.filters.types = new Set(ASSET_TYPES);
    }
    return;
  }
  const next = new Set(state.filters.types);
  if (next.has(typeValue)) {
    next.delete(typeValue);
  } else {
    next.add(typeValue);
  }
  state.filters.types = next;
}

function getAssetTypeSelectionLabel() {
  if (isAllAssetTypesSelected()) {
    return "All types";
  }
  const labels = ASSET_TYPES.filter((type) => state.filters.types.has(type)).map((type) => type.toUpperCase());
  if (labels.length === 0) {
    return "None selected";
  }
  if (labels.length <= 2) {
    return labels.join(", ");
  }
  return `${labels[0]}, ${labels[1]} +${labels.length - 2}`;
}

function getOrganisationForNewAssets() {
  // Minimal assumption: if exactly one org is selected, assign new assets to it; otherwise use "all".
  const selected = Array.from(state.selectedOrgIds);
  if (selected.length === 1 && !isAllOrganisationsSelected()) {
    return selected[0];
  }
  return "all";
}

function getAssetsForSelectedOrganisations() {
  if (isAllOrganisationsSelected()) {
    return state.assets;
  }
  return state.assets.filter((asset) => state.selectedOrgIds.has(asset.organisation));
}

function getSelectedAssetsForCommand() {
  return getAssetsForSelectedOrganisations().filter((asset) => asset.selected);
}

function renderAssetsTable() {
  const baseAssets = getAssetsForSelectedOrganisations();
  const searchTerm = state.filters.search.trim().toLowerCase();
  const showOrgColumn = isAllOrganisationsSelected() || state.selectedOrgIds.size !== 1;

  const filtered = baseAssets.filter((asset) => {
    const matchesType = isAllAssetTypesSelected() || state.filters.types.has(asset.type);
    const haystack = `${asset.value} ${asset.organisation}`.toLowerCase();
    const matchesSearch = !searchTerm || haystack.includes(searchTerm);
    const matchesSelection =
      state.filters.selection === "all" ||
      (state.filters.selection === "selected" && asset.selected) ||
      (state.filters.selection === "unselected" && !asset.selected);
    return matchesType && matchesSearch && matchesSelection;
  });

  elements.assetsTable.classList.toggle("hide-org", !showOrgColumn);
  elements.assetsBody.innerHTML = "";

  if (filtered.length === 0) {
    const row = document.createElement("tr");
    const cell = document.createElement("td");
    cell.colSpan = showOrgColumn ? 5 : 4;
    cell.textContent = "No assets match the current filters.";
    row.appendChild(cell);
    elements.assetsBody.appendChild(row);
  } else {
    filtered.forEach((asset) => {
      const row = document.createElement("tr");

      const selectedCell = document.createElement("td");
      selectedCell.className = "col-selected";
      const checkbox = document.createElement("input");
      checkbox.type = "checkbox";
      checkbox.checked = asset.selected;
      checkbox.dataset.assetId = asset.id;
      selectedCell.appendChild(checkbox);

      const typeCell = document.createElement("td");
      typeCell.textContent = asset.type;

      const valueCell = document.createElement("td");
      valueCell.textContent = asset.value;

      const sourceCell = document.createElement("td");
      sourceCell.textContent = asset.source;

      const orgCell = document.createElement("td");
      orgCell.dataset.col = "organisation";
      orgCell.textContent = asset.organisation;

      row.appendChild(selectedCell);
      row.appendChild(typeCell);
      row.appendChild(valueCell);
      row.appendChild(sourceCell);
      row.appendChild(orgCell);
      elements.assetsBody.appendChild(row);
    });
  }

  const selectedCount = baseAssets.filter((asset) => asset.selected).length;
  elements.assetCount.textContent = `Selected ${selectedCount} / ${baseAssets.length}`;

  if (elements.assetsMasterCheckbox) {
    const allVisibleSelected = filtered.length > 0 && filtered.every((asset) => asset.selected);
    const anyVisibleSelected = filtered.some((asset) => asset.selected);
    elements.assetsMasterCheckbox.indeterminate = anyVisibleSelected && !allVisibleSelected;
    elements.assetsMasterCheckbox.checked = allVisibleSelected;
  }
}

function setAllAssetSelection(isSelected) {
  state.assets.forEach((asset) => {
    asset.selected = isSelected;
  });
  renderAssetsTable();
  updateCommandIfAuto();
  renderSummary();
}

function setFilteredAssetSelection(isSelected) {
  const baseAssets = getAssetsForSelectedOrganisations();
  const searchTerm = state.filters.search.trim().toLowerCase();
  baseAssets.forEach((asset) => {
    const matchesType = isAllAssetTypesSelected() || state.filters.types.has(asset.type);
    const haystack = `${asset.value} ${asset.organisation}`.toLowerCase();
    const matchesSearch = !searchTerm || haystack.includes(searchTerm);
    const matchesSelection =
      state.filters.selection === "all" ||
      (state.filters.selection === "selected" && asset.selected) ||
      (state.filters.selection === "unselected" && !asset.selected);
    if (matchesType && matchesSearch && matchesSelection) {
      asset.selected = isSelected;
    }
  });
  renderAssetsTable();
  updateCommandIfAuto();
  renderSummary();
}

function getPresetByName(presetName) {
  return state.presets.find((preset) => preset.name === presetName) || null;
}

function getModuleParamDefinitions(moduleName) {
  const defs = state.moduleParameters[moduleName];
  return Array.isArray(defs) ? defs : [];
}

function getDefaultModuleParams(moduleName) {
  const defaults = {};
  getModuleParamDefinitions(moduleName).forEach((def) => {
    defaults[def.key] = def.default;
  });
  return defaults;
}

function getBasePresetModuleParams(preset, moduleName) {
  const defaults = getDefaultModuleParams(moduleName);
  const fromPreset = preset?.moduleParams?.[moduleName];
  if (!fromPreset || typeof fromPreset !== "object") {
    return defaults;
  }
  return { ...defaults, ...fromPreset };
}

function ensurePresetOverride(presetName) {
  if (!presetName) {
    return;
  }
  const preset = getPresetByName(presetName);
  if (!preset) {
    return;
  }

  const existing = state.presetOverrides[presetName];
  if (!existing || existing instanceof Set) {
    const enabledModules = existing instanceof Set ? existing : new Set(preset.modules);
    const moduleParams = {};
    preset.modules.forEach((moduleName) => {
      moduleParams[moduleName] = getBasePresetModuleParams(preset, moduleName);
    });
    state.presetOverrides[presetName] = { enabledModules, moduleParams };
  } else {
    if (!(existing.enabledModules instanceof Set)) {
      existing.enabledModules = new Set(preset.modules);
    }
    existing.moduleParams ||= {};
    preset.modules.forEach((moduleName) => {
      existing.moduleParams[moduleName] = {
        ...getBasePresetModuleParams(preset, moduleName),
        ...(existing.moduleParams[moduleName] || {})
      };
    });
  }

  state.ui.expandedModulesByPreset[presetName] ||= new Set();
}

function getPresetOverride(presetName) {
  const override = state.presetOverrides[presetName];
  if (!override || override instanceof Set) {
    return null;
  }
  return override;
}

function getEnabledModules() {
  const override = getPresetOverride(state.selectedPreset);
  return override ? override.enabledModules : new Set();
}

function toggleModule(moduleName, isEnabled) {
  ensurePresetOverride(state.selectedPreset);
  const preset = getPresetByName(state.selectedPreset);
  const override = getPresetOverride(state.selectedPreset);
  if (!override) {
    return;
  }
  const enabledModules = getEnabledModules();
  if (isEnabled) {
    enabledModules.add(moduleName);
    override.moduleParams[moduleName] ||= getBasePresetModuleParams(preset, moduleName);
  } else {
    enabledModules.delete(moduleName);
  }
  renderPreset();
  renderSavePresetPrompt();
  updateCommandIfAuto();
  renderSummary();
}

function togglePresetModuleExpanded(presetName, moduleName) {
  const expanded = state.ui.expandedModulesByPreset[presetName];
  if (!expanded) {
    return;
  }
  if (expanded.has(moduleName)) {
    expanded.delete(moduleName);
  } else {
    expanded.add(moduleName);
  }
}

function getPresetModuleParams(presetName, moduleName) {
  ensurePresetOverride(presetName);
  const preset = getPresetByName(presetName);
  const override = getPresetOverride(presetName);
  if (!preset || !override) {
    return {};
  }
  override.moduleParams[moduleName] ||= getBasePresetModuleParams(preset, moduleName);
  return override.moduleParams[moduleName];
}

function updatePresetModuleParam(presetName, moduleName, paramKey, rawValue) {
  ensurePresetOverride(presetName);
  const preset = getPresetByName(presetName);
  const override = getPresetOverride(presetName);
  if (!preset || !override) {
    return;
  }

  const defs = getModuleParamDefinitions(moduleName);
  const def = defs.find((item) => item.key === paramKey);
  let nextValue = rawValue;

  if (def?.type === "number") {
    const num = Number(rawValue);
    nextValue = Number.isFinite(num) ? num : def.default;
  } else if (def?.type === "boolean") {
    nextValue = Boolean(rawValue);
  } else if (def?.type === "select") {
    nextValue = String(rawValue);
  } else {
    nextValue = String(rawValue);
  }

  override.moduleParams[moduleName] ||= getBasePresetModuleParams(preset, moduleName);
  override.moduleParams[moduleName][paramKey] = nextValue;

  renderPresetYaml();
  renderSavePresetPrompt();
}

function renderPreset() {
  const preset = getPresetByName(state.selectedPreset);
  if (!preset) {
    elements.moduleList.innerHTML = "";
    elements.presetYaml.textContent = "";
    if (elements.presetDocs) {
      elements.presetDocs.innerHTML = "";
    }
    return;
  }
  ensurePresetOverride(state.selectedPreset);
  const override = getPresetOverride(state.selectedPreset);
  if (!override) {
    return;
  }
  const enabledModules = override.enabledModules;
  const totalModules = preset.modules.length;
  const enabledCount = preset.modules.filter((module) => enabledModules.has(module)).length;

  elements.moduleCount.textContent = `Enabled ${enabledCount} / ${totalModules}`;
  renderPresetDocs();
  elements.moduleList.innerHTML = "";

  preset.modules.forEach((moduleName) => {
    const isEnabled = enabledModules.has(moduleName);
    const expanded = state.ui.expandedModulesByPreset[state.selectedPreset]?.has(moduleName);
    const card = document.createElement("div");
    card.className = "module-card";
    card.dataset.module = moduleName;

    const row = document.createElement("div");
    row.className = "module-row";

    const expandButton = document.createElement("button");
    expandButton.type = "button";
    expandButton.className = "module-expand";
    expandButton.dataset.module = moduleName;
    expandButton.setAttribute("aria-expanded", expanded ? "true" : "false");
    expandButton.title = "Show module parameters";
    expandButton.textContent = expanded ? "▾" : "▸";

    const nameSpan = document.createElement("div");
    nameSpan.className = "module-name";
    nameSpan.textContent = moduleName.toUpperCase();

    const enableLabel = document.createElement("label");
    enableLabel.className = "module-enable";
    const checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    checkbox.dataset.module = moduleName;
    checkbox.dataset.role = "module-enabled";
    checkbox.checked = isEnabled;
    enableLabel.appendChild(checkbox);

    row.appendChild(expandButton);
    row.appendChild(nameSpan);
    row.appendChild(enableLabel);
    card.appendChild(row);

    if (expanded) {
      const params = document.createElement("div");
      params.className = "module-params";
      const docBlock = createModuleDocBlock(moduleName);
      if (docBlock) {
        params.appendChild(docBlock);
      }
      const defs = getModuleParamDefinitions(moduleName);
      if (defs.length === 0) {
        const hint = document.createElement("div");
        hint.className = "field-hint";
        hint.textContent = "No parameters available for this module.";
        params.appendChild(hint);
      } else {
        const grid = document.createElement("div");
        grid.className = "param-grid";
        const current = getPresetModuleParams(state.selectedPreset, moduleName);
        defs.forEach((def) => {
          const field = document.createElement("div");
          field.className = "param-field";

          const label = document.createElement("label");
          label.textContent = def.label || def.key;

          let input;
          if (def.type === "select") {
            input = document.createElement("select");
            (def.options || []).forEach((optionValue) => {
              const option = document.createElement("option");
              option.value = optionValue;
              option.textContent = optionValue;
              input.appendChild(option);
            });
            input.value = String(current[def.key] ?? def.default ?? "");
          } else if (def.type === "number") {
            input = document.createElement("input");
            input.type = "number";
            if (def.min !== undefined) {
              input.min = String(def.min);
            }
            if (def.max !== undefined) {
              input.max = String(def.max);
            }
            input.value = String(current[def.key] ?? def.default ?? "");
          } else if (def.type === "boolean") {
            input = document.createElement("input");
            input.type = "checkbox";
            input.checked = Boolean(current[def.key] ?? def.default ?? false);
          } else {
            input = document.createElement("input");
            input.type = "text";
            input.value = String(current[def.key] ?? def.default ?? "");
          }

          input.classList.add("module-param-input");
          input.dataset.module = moduleName;
          input.dataset.paramKey = def.key;
          input.disabled = !isEnabled;

          field.appendChild(label);
          field.appendChild(input);
          grid.appendChild(field);
        });
        params.appendChild(grid);
      }

      card.appendChild(params);
    }

    elements.moduleList.appendChild(card);
  });

  renderPresetYaml();
  renderSavePresetPrompt();
}

function renderPresetYaml() {
  const preset = getPresetByName(state.selectedPreset);
  const override = getPresetOverride(state.selectedPreset);
  if (!preset || !override) {
    elements.presetYaml.textContent = "";
    return;
  }
  elements.presetYaml.textContent = buildPresetYaml(preset, override.enabledModules, override.moduleParams);
}

function formatYamlScalar(value) {
  if (typeof value === "number" && Number.isFinite(value)) {
    return String(value);
  }
  if (typeof value === "boolean") {
    return value ? "true" : "false";
  }
  if (value === null || value === undefined) {
    return "null";
  }
  const str = String(value);
  return JSON.stringify(str);
}

function buildPresetYaml(preset, enabledModules, moduleParams) {
  const enabled = preset.modules.filter((module) => enabledModules.has(module));
  const disabled = preset.modules.filter((module) => !enabledModules.has(module));
  const lines = [`preset: ${preset.name}`, "modules:"];

  if (enabled.length === 0) {
    lines.push("  # - none");
  } else {
    enabled.forEach((module) => lines.push(`  - ${module}`));
  }

  const paramLines = [];
  enabled.forEach((module) => {
    const defs = getModuleParamDefinitions(module);
    if (defs.length === 0) {
      return;
    }
    const params = moduleParams[module] || getDefaultModuleParams(module);
    paramLines.push(`  ${module}:`);
    defs.forEach((def) => {
      const value = params[def.key] ?? def.default;
      paramLines.push(`    ${def.key}: ${formatYamlScalar(value)}`);
    });
  });

  if (paramLines.length > 0) {
    lines.push("module_params:");
    lines.push(...paramLines);
  }

  if (disabled.length > 0) {
    lines.push("# disabled:");
    disabled.forEach((module) => lines.push(`#   - ${module}`));
  }

  return lines.join("\n").trim();
}

function setsEqual(a, b) {
  if (a.size !== b.size) {
    return false;
  }
  for (const item of a) {
    if (!b.has(item)) {
      return false;
    }
  }
  return true;
}

function objectsEqual(a, b) {
  const aKeys = Object.keys(a || {});
  const bKeys = Object.keys(b || {});
  if (aKeys.length !== bKeys.length) {
    return false;
  }
  for (const key of aKeys) {
    if (!Object.prototype.hasOwnProperty.call(b, key)) {
      return false;
    }
    if (a[key] !== b[key]) {
      return false;
    }
  }
  return true;
}

function isPresetModified(presetName) {
  const preset = getPresetByName(presetName);
  const override = getPresetOverride(presetName);
  if (!preset || !override) {
    return false;
  }

  const baseEnabled = new Set(preset.modules);
  if (!setsEqual(override.enabledModules, baseEnabled)) {
    return true;
  }

  for (const module of preset.modules) {
    const baseParams = getBasePresetModuleParams(preset, module);
    const currentParams = override.moduleParams[module] || baseParams;
    if (!objectsEqual(currentParams, baseParams)) {
      return true;
    }
  }

  return false;
}

function renderSavePresetPrompt() {
  const shouldShow = isPresetModified(state.selectedPreset);
  elements.savePresetPrompt.hidden = !shouldShow;
  if (!shouldShow) {
    elements.saveCustomPresetStatus.textContent = "";
    elements.saveCustomPresetStatus.style.color = "";
  }
}

function generateCustomPresetName(baseName) {
  const date = new Date();
  const ymd = `${date.getFullYear()}${String(date.getMonth() + 1).padStart(2, "0")}${String(date.getDate()).padStart(2, "0")}`;
  const hm = `${String(date.getHours()).padStart(2, "0")}${String(date.getMinutes()).padStart(2, "0")}`;
  return `${baseName}_custom_${ymd}_${hm}`;
}

function getCurrentPresetSnapshot(presetName) {
  const preset = getPresetByName(presetName);
  const override = getPresetOverride(presetName);
  if (!preset || !override) {
    return null;
  }
  const enabledModules = preset.modules.filter((module) => override.enabledModules.has(module));
  const moduleParams = {};
  enabledModules.forEach((module) => {
    moduleParams[module] = override.moduleParams[module] || getBasePresetModuleParams(preset, module);
  });
  return { modules: enabledModules, moduleParams };
}

function handleSaveCustomPreset() {
  const snapshot = getCurrentPresetSnapshot(state.selectedPreset);
  if (!snapshot) {
    return;
  }

  const requestedName = elements.customPresetNameInput.value.trim().replace(/\s+/g, "_");
  const name = requestedName || generateCustomPresetName(state.selectedPreset);

  if (state.presets.some((preset) => preset.name === name)) {
    elements.saveCustomPresetStatus.textContent = `Preset \"${name}\" already exists. Pick a different name.`;
    elements.saveCustomPresetStatus.style.color = "#b42318";
    return;
  }

  const newPreset = {
    name,
    modules: snapshot.modules,
    moduleParams: snapshot.moduleParams,
    isCustom: true
  };
  state.presets.push(newPreset);
  saveCustomPresetsToStorage();

  elements.saveCustomPresetStatus.textContent = `Saved \"${name}\"`;
  elements.saveCustomPresetStatus.style.color = "";
  elements.customPresetNameInput.value = "";

  state.selectedPreset = name;
  elements.presetSelectedLabel.textContent = name;
  ensurePresetOverride(name);
  renderPresetOptions();
  renderPreset();
  updateScanNameHint();
  updateCommandIfAuto();
  renderSummary();
  closeDropdown(elements.presetDropdown);
}

function toggleCustomScanModuleExpanded(moduleName) {
  if (state.ui.expandedModulesCustomScan.has(moduleName)) {
    state.ui.expandedModulesCustomScan.delete(moduleName);
  } else {
    state.ui.expandedModulesCustomScan.add(moduleName);
  }
}

function getCustomScanModuleParams(moduleName) {
  const defaults = getDefaultModuleParams(moduleName);
  state.customScan.moduleParams[moduleName] ||= defaults;
  state.customScan.moduleParams[moduleName] = {
    ...defaults,
    ...state.customScan.moduleParams[moduleName]
  };
  return state.customScan.moduleParams[moduleName];
}

function toggleCustomScanModule(moduleName, isEnabled) {
  if (isEnabled) {
    state.customScan.enabledModules.add(moduleName);
    getCustomScanModuleParams(moduleName);
  } else {
    state.customScan.enabledModules.delete(moduleName);
  }
  renderCustomScan();
}

function updateCustomScanModuleParam(moduleName, paramKey, rawValue) {
  const defs = getModuleParamDefinitions(moduleName);
  const def = defs.find((item) => item.key === paramKey);
  let nextValue = rawValue;

  if (def?.type === "number") {
    const num = Number(rawValue);
    nextValue = Number.isFinite(num) ? num : def.default;
  } else if (def?.type === "boolean") {
    nextValue = Boolean(rawValue);
  } else if (def?.type === "select") {
    nextValue = String(rawValue);
  } else {
    nextValue = String(rawValue);
  }

  const params = getCustomScanModuleParams(moduleName);
  params[paramKey] = nextValue;
  renderCustomScanYaml();
}

function buildCustomScanYaml(enabledModules, moduleParams) {
  const enabled = Array.from(enabledModules).sort();
  const lines = ["preset: custom_scan", "modules:"];

  if (enabled.length === 0) {
    lines.push("  # - none");
  } else {
    enabled.forEach((module) => lines.push(`  - ${module}`));
  }

  const paramLines = [];
  enabled.forEach((module) => {
    const defs = getModuleParamDefinitions(module);
    if (defs.length === 0) {
      return;
    }
    const params = moduleParams[module] || getDefaultModuleParams(module);
    paramLines.push(`  ${module}:`);
    defs.forEach((def) => {
      const value = params[def.key] ?? def.default;
      paramLines.push(`    ${def.key}: ${formatYamlScalar(value)}`);
    });
  });

  if (paramLines.length > 0) {
    lines.push("module_params:");
    lines.push(...paramLines);
  }

  return lines.join("\n").trim();
}

function renderCustomScanYaml() {
  if (!elements.customYaml) {
    return;
  }
  elements.customYaml.textContent = buildCustomScanYaml(state.customScan.enabledModules, state.customScan.moduleParams);
}

function renderCustomScan() {
  if (!elements.customModuleList || !elements.customModuleCount) {
    return;
  }
  const searchTerm = state.customScan.search.trim().toLowerCase();
  const allModules = Array.isArray(MOCK_DATA.modules) ? MOCK_DATA.modules : [];
  const visible = allModules.filter((module) => module.toLowerCase().includes(searchTerm));

  elements.customModuleCount.textContent = `Enabled ${state.customScan.enabledModules.size} / ${allModules.length}`;
  elements.customModuleList.innerHTML = "";

  visible.forEach((moduleName) => {
    const isEnabled = state.customScan.enabledModules.has(moduleName);
    const expanded = state.ui.expandedModulesCustomScan.has(moduleName);
    const card = document.createElement("div");
    card.className = "module-card";
    card.dataset.module = moduleName;

    const row = document.createElement("div");
    row.className = "module-row";

    const expandButton = document.createElement("button");
    expandButton.type = "button";
    expandButton.className = "module-expand";
    expandButton.dataset.module = moduleName;
    expandButton.setAttribute("aria-expanded", expanded ? "true" : "false");
    expandButton.title = "Show module parameters";
    expandButton.textContent = expanded ? "▾" : "▸";

    const nameSpan = document.createElement("div");
    nameSpan.className = "module-name";
    nameSpan.textContent = moduleName.toUpperCase();

    const enableLabel = document.createElement("label");
    enableLabel.className = "module-enable";
    const checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    checkbox.dataset.module = moduleName;
    checkbox.dataset.role = "module-enabled";
    checkbox.checked = isEnabled;
    enableLabel.appendChild(checkbox);

    row.appendChild(expandButton);
    row.appendChild(nameSpan);
    row.appendChild(enableLabel);
    card.appendChild(row);

    if (expanded) {
      const params = document.createElement("div");
      params.className = "module-params";
      const docBlock = createModuleDocBlock(moduleName);
      if (docBlock) {
        params.appendChild(docBlock);
      }
      const defs = getModuleParamDefinitions(moduleName);
      if (defs.length === 0) {
        const hint = document.createElement("div");
        hint.className = "field-hint";
        hint.textContent = "No parameters available for this module.";
        params.appendChild(hint);
      } else {
        const grid = document.createElement("div");
        grid.className = "param-grid";
        const current = getCustomScanModuleParams(moduleName);
        defs.forEach((def) => {
          const field = document.createElement("div");
          field.className = "param-field";

          const label = document.createElement("label");
          label.textContent = def.label || def.key;

          let input;
          if (def.type === "select") {
            input = document.createElement("select");
            (def.options || []).forEach((optionValue) => {
              const option = document.createElement("option");
              option.value = optionValue;
              option.textContent = optionValue;
              input.appendChild(option);
            });
            input.value = String(current[def.key] ?? def.default ?? "");
          } else if (def.type === "number") {
            input = document.createElement("input");
            input.type = "number";
            if (def.min !== undefined) {
              input.min = String(def.min);
            }
            if (def.max !== undefined) {
              input.max = String(def.max);
            }
            input.value = String(current[def.key] ?? def.default ?? "");
          } else if (def.type === "boolean") {
            input = document.createElement("input");
            input.type = "checkbox";
            input.checked = Boolean(current[def.key] ?? def.default ?? false);
          } else {
            input = document.createElement("input");
            input.type = "text";
            input.value = String(current[def.key] ?? def.default ?? "");
          }

          input.classList.add("module-param-input");
          input.dataset.module = moduleName;
          input.dataset.paramKey = def.key;
          input.disabled = !isEnabled;

          field.appendChild(label);
          field.appendChild(input);
          grid.appendChild(field);
        });
        params.appendChild(grid);
      }
      card.appendChild(params);
    }

    elements.customModuleList.appendChild(card);
  });

  renderCustomScanYaml();
}

function generateBbotCommand() {
  const orgName = isAllOrganisationsSelected() || state.selectedOrgIds.size !== 1 ? "all" : Array.from(state.selectedOrgIds)[0];
  const assets = getSelectedAssetsForCommand().map((asset) => asset.value).join(",");
  const presetName = state.selectedPreset;
  const preset = state.presets.find((item) => item.name === presetName);
  const enabledSet = getEnabledModules();
  const enabledModules = preset ? preset.modules.filter((module) => enabledSet.has(module)).join(",") : "";
  return `bbot -n "${orgName}" -t "${assets}" -p "${presetName}" --modules "${enabledModules}"`;
}

function updateCommandIfAuto() {
  if (state.commandMode !== "auto") {
    return;
  }
  const command = generateBbotCommand();
  setCommandText(command);
}

function setCommandText(command) {
  state.commandText = command;
  isSettingCommand = true;
  elements.commandInput.value = command;
  isSettingCommand = false;
  autoResizeTextarea(elements.commandInput);
}

function autoResizeTextarea(textarea) {
  if (!textarea) {
    return;
  }
  textarea.style.height = "auto";
  textarea.style.height = `${textarea.scrollHeight}px`;
}

function updateCommandModeUI() {
  const isManual = state.commandMode === "manual";
  elements.commandModeBadge.textContent = isManual ? "Manual" : "Auto";
  elements.commandModeBadge.classList.toggle("manual", isManual);
  elements.summaryMode.textContent = isManual ? "Manual" : "Auto";
  elements.summaryMode.classList.toggle("accent", !isManual);
  elements.summaryMode.classList.toggle("subtle", isManual);
  elements.commandHint.textContent = isManual
    ? "Manual mode: changes to assets and presets will not overwrite the command."
    : "Auto updates from assets and preset until you edit manually.";
}

function handleScanNameInput(event) {
  state.scanNameInput = event.target.value;
  updateScanNameHint();
  renderSummary();
}

function updateScanNameHint() {
  const defaultName = getDefaultScanName();
  elements.scanNameHint.textContent = `Auto: ${defaultName}`;
}

function getDefaultScanName() {
  const orgLabel = isAllOrganisationsSelected() || state.selectedOrgIds.size !== 1 ? "all" : Array.from(state.selectedOrgIds)[0];
  const date = new Date();
  const ymd = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(
    date.getDate()
  ).padStart(2, "0")}`;
  return `${orgLabel}-${state.selectedPreset}-${ymd}`;
}

function getEffectiveScanName() {
  return state.scanNameInput.trim() ? state.scanNameInput.trim() : getDefaultScanName();
}

function handleManualAdd() {
  const input = elements.manualAssets.value.trim();
  if (!input) {
    return;
  }
  const tokens = tokenizeValues(input);
  tokens.forEach((token) => {
    const parsed = parseAssetValue(token);
    if (!parsed) {
      return;
    }
    const organisation = getOrganisationForNewAssets();
    addAsset({
      organisation,
      type: parsed.type,
      value: parsed.value,
      source: "Manual",
      selected: true
    });
  });
  elements.manualAssets.value = "";
  renderAssetsTable();
  updateCommandIfAuto();
  renderSummary();
}

function handleImport() {
  const file = elements.assetFileInput.files[0];
  if (!file) {
    elements.importStatus.textContent = "Select a .txt or .csv file to import.";
    return;
  }
  if (!file.name.endsWith(".txt") && !file.name.endsWith(".csv")) {
    elements.importStatus.textContent = "Only .txt or .csv files are supported.";
    return;
  }

  const reader = new FileReader();
  reader.onload = () => {
    const content = String(reader.result || "");
    const tokens = tokenizeValues(content);
    const result = importAssetsFromTokens(tokens);
    renderImportStatus(result);
    renderAssetsTable();
    updateCommandIfAuto();
    renderSummary();
    elements.assetFileInput.value = "";
  };
  reader.readAsText(file);
}

function tokenizeValues(text) {
  return text
    .split(/\r?\n/)
    .flatMap((line) => line.split(","))
    .map((item) => item.trim())
    .filter(Boolean);
}

function importAssetsFromTokens(tokens) {
  let added = 0;
  let duplicates = 0;
  const invalid = [];

  tokens.forEach((token) => {
    const parsed = parseAssetValue(token);
    if (!parsed) {
      invalid.push(token);
      return;
    }
    const organisation = getOrganisationForNewAssets();
    const result = addAsset({
      organisation,
      type: parsed.type,
      value: parsed.value,
      source: "File",
      selected: true
    });
    if (result.added) {
      added += 1;
    } else {
      duplicates += 1;
    }
  });

  return { added, duplicates, invalid };
}

function renderImportStatus({ added, duplicates, invalid }) {
  const wrapper = document.createElement("div");
  const lineOne = document.createElement("div");
  lineOne.textContent = `Imported ${added} new, ${duplicates} duplicates skipped`;
  wrapper.appendChild(lineOne);

  if (invalid.length > 0) {
    const invalidLine = document.createElement("div");
    invalidLine.textContent = `Skipped ${invalid.length} invalid lines`;
    wrapper.appendChild(invalidLine);

    invalid.slice(0, 20).forEach((example) => {
      const exampleLine = document.createElement("div");
      exampleLine.textContent = `- ${example}`;
      wrapper.appendChild(exampleLine);
    });
  }

  elements.importStatus.innerHTML = "";
  elements.importStatus.appendChild(wrapper);
}

function parseAssetValue(value) {
  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }

  if (isValidUrl(trimmed)) {
    return { type: "url", value: trimmed };
  }
  if (isValidCidr(trimmed)) {
    return { type: "cidr", value: trimmed };
  }
  if (isValidIp(trimmed)) {
    return { type: "ip", value: trimmed };
  }
  if (isValidDomain(trimmed)) {
    return { type: "domain", value: trimmed };
  }
  return null;
}

function isValidIp(value) {
  const parts = value.split(".");
  if (parts.length !== 4) {
    return false;
  }
  return parts.every((part) => {
    if (!/^\d{1,3}$/.test(part)) {
      return false;
    }
    const num = Number(part);
    return num >= 0 && num <= 255;
  });
}

function isValidCidr(value) {
  const [ip, prefix] = value.split("/");
  if (!ip || prefix === undefined) {
    return false;
  }
  if (!isValidIp(ip)) {
    return false;
  }
  if (!/^\d{1,2}$/.test(prefix)) {
    return false;
  }
  const num = Number(prefix);
  return num >= 0 && num <= 32;
}

function isValidDomain(value) {
  if (value.length < 3 || value.includes(" ")) {
    return false;
  }
  if (value.includes("/")) {
    return false;
  }
  const parts = value.split(".");
  if (parts.length < 2) {
    return false;
  }
  return parts.every((part) => /^[a-z0-9-]+$/i.test(part) && !part.startsWith("-") && !part.endsWith("-"));
}

function isValidUrl(value) {
  if (!/^https?:\/\//i.test(value)) {
    return false;
  }
  try {
    const url = new URL(value);
    return Boolean(url.hostname);
  } catch (error) {
    return false;
  }
}

function handleSyncAssets() {
  elements.syncBtn.disabled = true;
  state.sync.status = "in-progress";
  elements.syncState.textContent = "Sync in progress...";

  setTimeout(() => {
    const isSuccess = Math.random() > 0.2;
    if (isSuccess) {
      state.sync.status = "success";
      state.sync.lastSync = new Date();
      elements.syncState.textContent = "Success";
      addMockSyncAssets();
    } else {
      state.sync.status = "failed";
      elements.syncState.textContent = "Failed";
    }
    elements.syncBtn.disabled = false;
    renderSyncStatus();
    renderAssetsTable();
    updateCommandIfAuto();
    renderSummary();
  }, 1200);
}

function addMockSyncAssets() {
  const count = Math.random() > 0.6 ? 2 : 1;
  for (let i = 0; i < count; i += 1) {
    const type = Math.random() > 0.5 ? "ip" : "domain";
    const orgIds = state.selectedOrgIds.size ? Array.from(state.selectedOrgIds) : state.organisations.map((org) => org.id);
    const organisation = orgIds[Math.floor(Math.random() * orgIds.length)] || "all";
    const value = type === "ip" ? generateNextIp() : generateSyncDomain(organisation);
    addAsset({
      organisation,
      type,
      value,
      source: "NetBox",
      selected: true
    });
  }
}

function generateNextIp() {
  let value = `192.168.1.${state.syncCounter}`;
  while (state.assetKeySet.has(`ip|${value}`)) {
    state.syncCounter += 1;
    value = `192.168.1.${state.syncCounter}`;
  }
  state.syncCounter += 1;
  return value;
}

function generateSyncDomain(org) {
  let value = `sync-${org}-${state.syncCounter}.example.com`;
  while (state.assetKeySet.has(`domain|${value}`)) {
    state.syncCounter += 1;
    value = `sync-${org}-${state.syncCounter}.example.com`;
  }
  state.syncCounter += 1;
  return value;
}

function renderSyncStatus() {
  const timeLabel = state.sync.lastSync
    ? state.sync.lastSync.toLocaleString()
    : "--";
  elements.syncStatus.textContent = `Last sync: ${timeLabel}`;
}

function renderValidationStatus() {
  elements.validationStatus.textContent = state.validation.message;
  elements.validationStatus.style.color =
    state.validation.status === "error" ? "#b42318" : "";
}

function handleStartScan() {
  state.scanRun.status = "started";
  state.scanRun.startedAt = new Date();
  renderStartScanStatus();
}

function renderStartScanStatus() {
  if (!elements.startScanStatus) {
    return;
  }
  const startedAt = state.scanRun.startedAt instanceof Date ? state.scanRun.startedAt : null;
  const isStarted = state.scanRun.status === "started" && Boolean(startedAt);

  elements.startScanStatus.classList.toggle("accent", isStarted);
  elements.startScanStatus.classList.toggle("subtle", !isStarted);

  elements.startScanStatus.textContent = isStarted ? `Started (mock): ${startedAt.toLocaleString()}` : "Not started";
}

function renderSummary() {
  const selectedAssets = getSelectedAssetsForCommand();
  const totalAssets = getAssetsForSelectedOrganisations().length;
  const preset = state.presets.find((item) => item.name === state.selectedPreset);
  const enabledModules = getEnabledModules();
  const enabledCount = preset ? preset.modules.filter((module) => enabledModules.has(module)).length : 0;
  const totalModules = preset ? preset.modules.length : 0;

  elements.summaryScanName.textContent = getEffectiveScanName();
  elements.summaryOrg.textContent = getOrganisationSelectionLabel();
  elements.summaryAssets.textContent = `${selectedAssets.length} / ${totalAssets}`;
  elements.summaryModules.textContent = `${state.selectedPreset} (${enabledCount} / ${totalModules})`;
  elements.summaryCommand.textContent = state.commandText;

  renderValidationStatus();
  renderStartScanStatus();
}

function renderAll() {
  elements.sessionTime.textContent = new Date().toLocaleString();
  elements.orgSelectedLabel.textContent = getOrganisationSelectionLabel();
  elements.presetSelectedLabel.textContent = state.selectedPreset;
  elements.assetTypeSelectedLabel.textContent = getAssetTypeSelectionLabel();

  renderOrgOptions();
  renderPresetOptions();
  renderAssetTypeOptions();
  renderSyncStatus();
  renderAssetsTable();
  renderPreset();
  renderSavePresetPrompt();
  updateScanNameHint();
  updateCommandModeUI();
  renderSummary();
  renderCustomScan();
}

function startApp() {
  initElements();
  initState();
  initEventListeners();
  renderAll();
  initWizard();
}

document.addEventListener("DOMContentLoaded", startApp);
