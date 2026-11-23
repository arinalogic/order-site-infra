import "./admin.css";
import { calculateLeadScore, getLeadTemperature } from "./lead-scoring.js";

const TOKEN_KEY = "admin_access_token";

const elements = {
  notice: document.querySelector("#notice"),
  loginScreen: document.querySelector("#login-screen"),
  registrationScreen: document.querySelector("#registration-screen"),
  servicesScreen: document.querySelector("#services-screen"),
  applicationsScreen: document.querySelector("#applications-screen"),
  loginForm: document.querySelector("#login-form"),
  registrationForm: document.querySelector("#registration-form"),
  showRegistration: document.querySelector("#show-registration"),
  backToLogin: document.querySelector("#back-to-login"),
  statisticsButton: document.querySelector("#statistics-button"),
  logoutButton: document.querySelector("#logout-button"),
  statisticsDialog: document.querySelector("#statistics-dialog"),
  closeStatistics: document.querySelector("#close-statistics"),
  statsDayAverage: document.querySelector("#stats-day-average"),
  statsDayVisits: document.querySelector("#stats-day-visits"),
  statsWeekAverage: document.querySelector("#stats-week-average"),
  statsWeekVisits: document.querySelector("#stats-week-visits"),
  statsMonthAverage: document.querySelector("#stats-month-average"),
  statsMonthVisits: document.querySelector("#stats-month-visits"),
  statsButtonsBody: document.querySelector("#stats-buttons-body"),
  statsButtonsEmpty: document.querySelector("#stats-buttons-empty"),
  statsError: document.querySelector("#stats-error"),
  statsHeatmapTotal: document.querySelector("#stats-heatmap-total"),
  statsHeatmapEmpty: document.querySelector("#stats-heatmap-empty"),
  statsHeatmap: document.querySelector("#stats-heatmap"),
  servicesBody: document.querySelector("#services-body"),
  emptyServices: document.querySelector("#empty-services"),
  addService: document.querySelector("#add-service"),
  editService: document.querySelector("#edit-service"),
  deleteService: document.querySelector("#delete-service"),
  refreshApplications: document.querySelector("#refresh-applications"),
  applicationsError: document.querySelector("#applications-error"),
  applicationsBody: document.querySelector("#applications-body"),
  emptyApplications: document.querySelector("#empty-applications"),
  applicationsTotal: document.querySelector("#applications-total"),
  applicationsHot: document.querySelector("#applications-hot"),
  applicationsWarm: document.querySelector("#applications-warm"),
  applicationsCold: document.querySelector("#applications-cold"),
  applicationDialog: document.querySelector("#application-dialog"),
  applicationDetails: document.querySelector("#application-details"),
  closeApplication: document.querySelector("#close-application"),
  serviceDialog: document.querySelector("#service-dialog"),
  serviceForm: document.querySelector("#service-form"),
  serviceDialogTitle: document.querySelector("#service-dialog-title"),
  serviceName: document.querySelector("#service-name"),
  serviceBudget: document.querySelector("#service-budget"),
  cancelService: document.querySelector("#cancel-service"),
  saveService: document.querySelector("#save-service"),
};

let services = [];
let applications = [];
let selectedServiceId = null;
let editingServiceId = null;

class ApiError extends Error {
  constructor(message, status) {
    super(message);
    this.status = status;
  }
}

function showNotice(message = "", type = "") {
  elements.notice.textContent = message;
  elements.notice.classList.toggle("is-success", type === "success");
  elements.notice.classList.toggle("is-error", type === "error");
}

function showScreen(screen) {
  elements.loginScreen.hidden = screen !== "login";
  elements.registrationScreen.hidden = screen !== "registration";
  elements.servicesScreen.hidden = screen !== "services";
  elements.applicationsScreen.hidden = screen !== "services";
  elements.statisticsButton.hidden = screen !== "services";
  elements.logoutButton.hidden = screen !== "services";
}

function validationMessage(detail) {
  if (!Array.isArray(detail)) {
    return "Проверьте введённые данные.";
  }

  const messages = detail.map((item) => {
    const field = Array.isArray(item.loc) ? item.loc[item.loc.length - 1] : "";
    const fieldNames = {
      username: "Логин",
      email: "Электронная почта",
      password: "Пароль",
      services: "Название услуги",
      budget_range: "Диапазон бюджета",
    };
    const label = fieldNames[field] || "Поле";
    const reason = typeof item.msg === "string" ? item.msg.toLowerCase() : "";

    if (reason.includes("at least") || reason.includes("too short")) {
      return `${label}: значение слишком короткое.`;
    }
    if (reason.includes("at most") || reason.includes("too long")) {
      return `${label}: значение слишком длинное.`;
    }
    if (reason.includes("email")) {
      return "Укажите корректный адрес электронной почты.";
    }
    if (reason.includes("required") || reason.includes("field required")) {
      return `${label}: заполните это поле.`;
    }
    return `${label}: проверьте введённое значение.`;
  });

  return [...new Set(messages)].join(" ");
}

async function api(url, options = {}) {
  const headers = new Headers(options.headers || {});
  const token = sessionStorage.getItem(TOKEN_KEY);

  if (token && options.auth !== false) {
    headers.set("Authorization", `Bearer ${token}`);
  }
  if (options.json !== undefined) {
    headers.set("Content-Type", "application/json");
  }

  const response = await fetch(url, {
    method: options.method || "GET",
    headers,
    body: options.json === undefined ? options.body : JSON.stringify(options.json),
  });

  if (response.status === 401) {
    logout("Сеанс завершён. Войдите снова.", "error");
    throw new ApiError("Неверный логин или пароль.", 401);
  }

  if (!response.ok) {
    let payload = null;
    try {
      payload = await response.json();
    } catch {
      payload = null;
    }
    throw new ApiError(errorMessage(response.status, payload), response.status);
  }

  return response;
}

function errorMessage(status, payload) {
  if (status === 403) {
    return "Регистрация закрыта: администратор уже создан.";
  }
  if (status === 409) {
    return "Такой логин или адрес электронной почты уже занят.";
  }
  if (status === 422) {
    return validationMessage(payload && payload.detail);
  }
  if (status === 429) {
    return "Слишком много попыток. Попробуйте позже.";
  }
  return "Не удалось выполнить запрос. Попробуйте ещё раз.";
}

async function requestJson(url, options) {
  const response = await api(url, options);
  return response.json();
}

function logout(message = "", type = "") {
  sessionStorage.removeItem(TOKEN_KEY);
  if (elements.statisticsDialog.open) {
    elements.statisticsDialog.close();
  }
  if (elements.applicationDialog.open) {
    elements.applicationDialog.close();
  }
  services = [];
  applications = [];
  selectedServiceId = null;
  elements.applicationsBody.replaceChildren();
  elements.applicationDetails.replaceChildren();
  elements.servicesBody.replaceChildren();
  updateSelectionButtons();
  showScreen("login");
  showNotice(message, type);
}

function validateStatistics(summary, heatmap) {
  const periods = ["day", "week", "month"];
  if (
    !summary ||
    periods.some((period) =>
      !summary[period] ||
      typeof summary[period].avg_seconds !== "number" ||
      !Number.isFinite(summary[period].avg_seconds) ||
      summary[period].avg_seconds < 0 ||
      !Number.isInteger(summary[period].visits) ||
      summary[period].visits < 0
    ) ||
    !Array.isArray(summary.top_buttons) ||
    summary.top_buttons.some((item) =>
      !item ||
      typeof item.name !== "string" ||
      !Number.isInteger(item.count) ||
      item.count < 0
    ) ||
    !heatmap ||
    !Number.isInteger(heatmap.total_points) ||
    heatmap.total_points < 0 ||
    !Array.isArray(heatmap.cells) ||
    heatmap.cells.some((cell) =>
      !cell ||
      !Number.isInteger(cell.x) ||
      cell.x < 0 ||
      cell.x > 49 ||
      !Number.isInteger(cell.y) ||
      cell.y < 0 ||
      cell.y > 49 ||
      !Number.isInteger(cell.count) ||
      cell.count <= 0
    )
  ) {
    throw new Error("Сервер вернул статистику в неверном формате.");
  }
}

function renderStatisticsPeriod(period, averageElement, visitsElement) {
  const value = period.visits
    ? `${new Intl.NumberFormat("ru-RU", { maximumFractionDigits: 1 }).format(period.avg_seconds)} с`
    : "Данных пока нет";
  averageElement.textContent = value;
  visitsElement.textContent = String(period.visits);
}

function renderStatistics(summary, heatmap) {
  validateStatistics(summary, heatmap);
  renderStatisticsPeriod(summary.day, elements.statsDayAverage, elements.statsDayVisits);
  renderStatisticsPeriod(summary.week, elements.statsWeekAverage, elements.statsWeekVisits);
  renderStatisticsPeriod(summary.month, elements.statsMonthAverage, elements.statsMonthVisits);

  elements.statsButtonsBody.replaceChildren();
  elements.statsButtonsEmpty.hidden = summary.top_buttons.length !== 0;
  summary.top_buttons.forEach((button) => {
    const row = document.createElement("tr");
    const nameCell = document.createElement("td");
    const countCell = document.createElement("td");
    nameCell.textContent = button.name;
    countCell.textContent = String(button.count);
    row.append(nameCell, countCell);
    elements.statsButtonsBody.append(row);
  });

  elements.statsHeatmapTotal.textContent = `Всего точек: ${heatmap.total_points}`;
  const hasCells = heatmap.cells.length > 0;
  elements.statsHeatmapEmpty.hidden = hasCells;
  elements.statsHeatmap.hidden = !hasCells;
  if (!hasCells) {
    return;
  }

  const context = elements.statsHeatmap.getContext("2d");
  if (!context) {
    throw new Error("Не удалось отобразить карту активности.");
  }
  context.clearRect(0, 0, elements.statsHeatmap.width, elements.statsHeatmap.height);
  const cellSize = elements.statsHeatmap.width / 50;
  const maxCount = Math.max(...heatmap.cells.map((cell) => cell.count));
  heatmap.cells.forEach((cell) => {
    const opacity = 0.12 + (cell.count / maxCount) * 0.78;
    context.fillStyle = `rgba(57, 125, 165, ${opacity})`;
    context.fillRect(cell.x * cellSize, cell.y * cellSize, cellSize, cellSize);
  });
}

async function loadStatistics() {
  elements.statsDayAverage.textContent = "Загрузка...";
  elements.statsDayVisits.textContent = "—";
  elements.statsWeekAverage.textContent = "Загрузка...";
  elements.statsWeekVisits.textContent = "—";
  elements.statsMonthAverage.textContent = "Загрузка...";
  elements.statsMonthVisits.textContent = "—";
  elements.statsButtonsBody.replaceChildren();
  elements.statsButtonsEmpty.hidden = true;
  elements.statsError.hidden = true;
  elements.statsError.textContent = "";
  elements.statsHeatmapTotal.textContent = "Всего точек: —";
  elements.statsHeatmapEmpty.hidden = true;
  elements.statsHeatmap.hidden = true;
  elements.statisticsDialog.showModal();

  try {
    const [summary, heatmap] = await Promise.all([
      requestJson("/api/behavior-metrics/summary"),
      requestJson("/api/behavior-metrics/heatmap"),
    ]);
    renderStatistics(summary, heatmap);
  } catch (error) {
    if (error.status !== 401) {
      const message = error.message || "Не удалось загрузить статистику.";
      elements.statsError.textContent = message;
      elements.statsError.hidden = false;
      showNotice(message, "error");
    }
  }
}

async function checkRegistration() {
  const result = await requestJson("/api/auth/check", { auth: false });
  if (typeof result.has_admins !== "boolean") {
    throw new Error("Сервер вернул неверный статус регистрации.");
  }
  elements.showRegistration.hidden = result.has_admins;
}

async function handleLogin(event) {
  event.preventDefault();
  showNotice();

  const formData = new FormData(elements.loginForm);
  const credentials = new URLSearchParams();
  credentials.set("username", formData.get("username").trim());
  credentials.set("password", formData.get("password"));

  try {
    const result = await requestJson("/api/auth/login", {
      method: "POST",
      auth: false,
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: credentials,
    });

    if (typeof result.access_token !== "string" || !result.access_token) {
      throw new Error("Сервер не вернул токен входа.");
    }
    sessionStorage.setItem(TOKEN_KEY, result.access_token);
    elements.loginForm.reset();
    await openServices();
  } catch (error) {
    if (error.status === 401) {
      showNotice("Неверный логин или пароль.", "error");
    } else {
      showNotice(error.message || "Не удалось войти. Попробуйте ещё раз.", "error");
    }
  }
}

async function handleRegistration(event) {
  event.preventDefault();
  showNotice();

  const formData = new FormData(elements.registrationForm);
  const password = formData.get("password");
  if (password !== formData.get("password_confirm")) {
    showNotice("Пароли не совпадают.", "error");
    elements.registrationForm.elements.password_confirm.focus();
    return;
  }

  try {
    await api("/api/auth/register", {
      method: "POST",
      auth: false,
      json: {
        username: formData.get("username").trim(),
        email: formData.get("email").trim(),
        password,
      },
    });
    elements.registrationForm.reset();
    showScreen("login");
    await checkRegistration();
    showNotice("Администратор создан, войдите.", "success");
  } catch (error) {
    showNotice(error.message || "Не удалось зарегистрировать администратора.", "error");
    if (error.status === 403) {
      elements.showRegistration.hidden = true;
      showScreen("login");
    }
  }
}

function parseBudgetRange(source) {
  const match = source.match(/^\s*(\d+(?:[.,]\d+)?)\s*([kк]{0,2})\s*-\s*(\d+(?:[.,]\d+)?)\s*([kк]{0,2})\s*$/i);
  if (!match) {
    return null;
  }

  const toNumber = (amount, suffix) => {
    const multiplier = suffix.length === 2 ? 1000000 : suffix.length === 1 ? 1000 : 1;
    return Math.round(Number(amount.replace(",", ".")) * multiplier);
  };
  const min = toNumber(match[1], match[2]);
  const max = toNumber(match[3], match[4]);

  if (!Number.isSafeInteger(min) || !Number.isSafeInteger(max) || min > max) {
    return null;
  }
  return { min, max };
}

function formatUpdated(value) {
  if (!value) {
    return "—";
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "—";
  }
  return new Intl.DateTimeFormat("ru-RU", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(date);
}

function createCell(value) {
  const cell = document.createElement("td");
  cell.textContent = value == null ? "" : String(value);
  return cell;
}

function renderServices() {
  elements.servicesBody.replaceChildren();
  elements.emptyServices.hidden = services.length !== 0;

  services.forEach((service) => {
    const row = document.createElement("tr");
    row.dataset.serviceId = String(service.id);
    row.tabIndex = 0;
    row.setAttribute("aria-selected", String(service.id === selectedServiceId));
    row.classList.toggle("is-selected", service.id === selectedServiceId);
    row.append(
      createCell(service.id),
      createCell(service.services),
      createCell(service.budget_range),
      createCell(formatUpdated(service.updated_at)),
    );
    elements.servicesBody.append(row);
  });

  updateSelectionButtons();
}

function updateSelectionButtons() {
  const selected = services.some((service) => service.id === selectedServiceId);
  elements.editService.disabled = !selected;
  elements.deleteService.disabled = !selected;
}

function selectService(row) {
  selectedServiceId = Number(row.dataset.serviceId);
  renderServices();
}

async function loadServices() {
  const result = await requestJson("/api/admin-settings/");
  if (
    !Array.isArray(result) ||
    result.some((item) =>
      !item ||
      typeof item.id !== "number" ||
      typeof item.services !== "string" ||
      typeof item.budget_range !== "string"
    )
  ) {
    throw new Error("Сервер вернул список услуг в неверном формате.");
  }
  services = result;
  if (!services.some((service) => service.id === selectedServiceId)) {
    selectedServiceId = null;
  }
  renderServices();
  if (applications.length) {
    renderApplications();
  }
}

function formatBudget(value) {
  if (value == null || value === "") {
    return "—";
  }
  const amount = typeof value === "string" ? Number(value) : value;
  return Number.isFinite(amount)
    ? `${new Intl.NumberFormat("ru-RU").format(amount)} ₽`
    : String(value);
}

function applicationDate(value) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? 0 : date.getTime();
}

function setApplicationsError(message = "") {
  elements.applicationsError.textContent = message;
  elements.applicationsError.hidden = !message;
}

function applicationRequestError(error, fallback) {
  if (error.status === 403) {
    return "Недостаточно прав для просмотра заявок.";
  }
  return error instanceof TypeError ? fallback : error.message || fallback;
}

function createTemperatureBadge(temperature) {
  const badge = document.createElement("span");
  badge.className = "temperature-badge";
  if (temperature === "Горячий") {
    badge.classList.add("temperature-hot");
  } else if (temperature === "Тёплый") {
    badge.classList.add("temperature-warm");
  } else {
    badge.classList.add("temperature-cold");
  }
  badge.textContent = temperature;
  return badge;
}

function renderApplications() {
  const scored = applications.map((application) => ({
    application,
    score: calculateLeadScore(application, services),
  }));
  scored.sort((left, right) =>
    right.score - left.score ||
    applicationDate(right.application.created_at) - applicationDate(left.application.created_at)
  );

  const temperatures = scored.map(({ score }) => getLeadTemperature(score));
  elements.applicationsTotal.textContent = String(scored.length);
  elements.applicationsHot.textContent = String(temperatures.filter((value) => value === "Горячий").length);
  elements.applicationsWarm.textContent = String(temperatures.filter((value) => value === "Тёплый").length);
  elements.applicationsCold.textContent = String(temperatures.filter((value) => value === "Холодный").length);
  elements.applicationsBody.replaceChildren();
  elements.emptyApplications.hidden = scored.length !== 0;

  scored.forEach(({ application, score }) => {
    const row = document.createElement("tr");
    const viewButton = document.createElement("button");
    viewButton.className = "button button-secondary application-view";
    viewButton.type = "button";
    viewButton.dataset.applicationId = String(application.id);
    viewButton.textContent = "Просмотр";

    row.append(
      createCell(score),
      createCell([application.first_name, application.last_name].filter(Boolean).join(" ")),
      createCell(application.service || "—"),
      createCell(formatBudget(application.budget)),
    );
    const temperatureCell = document.createElement("td");
    temperatureCell.append(createTemperatureBadge(getLeadTemperature(score)));
    row.append(temperatureCell, createCell(application.deadline || "—"));
    const actionsCell = document.createElement("td");
    actionsCell.append(viewButton);
    row.append(actionsCell);
    elements.applicationsBody.append(row);
  });
}

async function loadApplications() {
  setApplicationsError();
  elements.refreshApplications.disabled = true;
  try {
    const [result] = await Promise.all([
      requestJson("/api/applications/"),
      loadServices(),
    ]);
    if (
      !Array.isArray(result) ||
      result.some((item) =>
        !item ||
        typeof item.id !== "number" ||
        typeof item.first_name !== "string" ||
        typeof item.last_name !== "string"
      )
    ) {
      throw new Error("Сервер вернул список заявок в неверном формате.");
    }

    applications = result;
    renderApplications();
  } catch (error) {
    applications = [];
    renderApplications();
    elements.applicationsTotal.textContent = "—";
    elements.applicationsHot.textContent = "—";
    elements.applicationsWarm.textContent = "—";
    elements.applicationsCold.textContent = "—";
    elements.emptyApplications.hidden = true;
    if (error.status !== 401) {
      setApplicationsError(applicationRequestError(error, "Не удалось загрузить заявки."));
    }
  } finally {
    elements.refreshApplications.disabled = false;
  }
}

const applicationFieldLabels = {
  id: "Номер заявки",
  first_name: "Имя",
  last_name: "Фамилия",
  middle_name: "Отчество",
  phone: "Телефон",
  email: "Электронная почта",
  business_info: "О компании",
  business_niche: "Сфера бизнеса",
  company_size: "Размер команды",
  client_role: "Роль клиента",
  task_volume: "Объём задачи",
  deadline: "Срок",
  task_type: "Тип задачи",
  product_of_interest: "Интересующий продукт",
  service: "Услуга",
  budget: "Бюджет",
  preferred_contact_method: "Предпочтительный способ связи",
  preferred_contact_time: "Предпочтительное время связи",
  comments: "Комментарий",
  created_at: "Дата создания",
};

function displayApplicationValue(value) {
  if (value == null || value === "") {
    return "—";
  }
  if (typeof value === "object") {
    return JSON.stringify(value);
  }
  return String(value);
}

function renderApplicationDetails(application) {
  const details = document.createDocumentFragment();
  const score = calculateLeadScore(application, services);
  const summary = [
    ["Приоритет (баллы)", String(score)],
    ["Температура", getLeadTemperature(score)],
  ];

  summary.forEach(([label, value]) => {
    const term = document.createElement("dt");
    const description = document.createElement("dd");
    term.textContent = label;
    description.textContent = value;
    details.append(term, description);
  });

  Object.entries(application).forEach(([key, value]) => {
    const term = document.createElement("dt");
    const description = document.createElement("dd");
    term.textContent = Object.prototype.hasOwnProperty.call(applicationFieldLabels, key)
      ? applicationFieldLabels[key]
      : key;
    description.textContent = displayApplicationValue(value);
    details.append(term, description);
  });

  elements.applicationDetails.replaceChildren(details);
  elements.applicationDialog.showModal();
}

async function openApplication(applicationId, button) {
  button.disabled = true;
  setApplicationsError();
  try {
    const application = await requestJson(`/api/applications/${encodeURIComponent(applicationId)}`);
    if (!application || typeof application !== "object" || Array.isArray(application)) {
      throw new Error("Сервер вернул заявку в неверном формате.");
    }
    renderApplicationDetails(application);
  } catch (error) {
    if (error.status !== 401) {
      const message = error.status === 404
        ? "Заявка не найдена или уже удалена."
        : applicationRequestError(error, "Не удалось загрузить заявку.");
      setApplicationsError(message);
    }
  } finally {
    button.disabled = false;
  }
}

async function openServices() {
  showScreen("services");
  showNotice();
  await loadApplications();
}

function openServiceDialog(service = null) {
  editingServiceId = service ? service.id : null;
  showNotice();
  elements.serviceDialogTitle.textContent = service ? "Редактировать услугу" : "Добавить услугу";
  elements.serviceName.value = service ? service.services : "";
  elements.serviceBudget.value = service ? service.budget_range : "";
  elements.serviceDialog.showModal();
  elements.serviceName.focus();
}

async function saveService(event) {
  event.preventDefault();
  const name = elements.serviceName.value.trim();
  const budget = elements.serviceBudget.value.trim();

  if (!name) {
    showNotice("Введите название услуги.", "error");
    elements.serviceName.focus();
    return;
  }
  if (!parseBudgetRange(budget)) {
    showNotice("Введите корректный диапазон, например 15k-40k.", "error");
    elements.serviceBudget.focus();
    return;
  }

  elements.saveService.disabled = true;
  try {
    const isEditing = editingServiceId !== null;
    await api(
      isEditing
        ? `/api/admin-settings/${encodeURIComponent(editingServiceId)}`
        : "/api/admin-settings/",
      {
        method: isEditing ? "PUT" : "POST",
        json: { services: name, budget_range: budget },
      },
    );
    elements.serviceDialog.close();
    showNotice(isEditing ? "Изменения сохранены." : "Услуга добавлена.", "success");
    await loadServices();
  } catch (error) {
    if (error.status !== 401) {
      showNotice(error.message || "Не удалось сохранить услугу.", "error");
    }
  } finally {
    elements.saveService.disabled = false;
  }
}

async function deleteSelectedService() {
  const service = services.find((item) => item.id === selectedServiceId);
  if (!service || !window.confirm(`Удалить услугу «${service.services}»?`)) {
    return;
  }

  try {
    await api(`/api/admin-settings/${encodeURIComponent(service.id)}`, { method: "DELETE" });
    selectedServiceId = null;
    showNotice("Услуга удалена.", "success");
    await loadServices();
  } catch (error) {
    if (error.status !== 401) {
      showNotice(error.message || "Не удалось удалить услугу.", "error");
    }
  }
}

function bindServiceEvents() {
  elements.servicesBody.addEventListener("click", (event) => {
    const row = event.target.closest("tr[data-service-id]");
    if (row) {
      selectService(row);
    }
  });
  elements.servicesBody.addEventListener("keydown", (event) => {
    if (event.key !== "Enter" && event.key !== " ") {
      return;
    }
    const row = event.target.closest("tr[data-service-id]");
    if (row) {
      event.preventDefault();
      selectService(row);
    }
  });
  elements.addService.addEventListener("click", () => openServiceDialog());
  elements.editService.addEventListener("click", () => {
    const service = services.find((item) => item.id === selectedServiceId);
    if (service) {
      openServiceDialog(service);
    }
  });
  elements.deleteService.addEventListener("click", deleteSelectedService);
  elements.serviceForm.addEventListener("submit", saveService);
  elements.cancelService.addEventListener("click", () => elements.serviceDialog.close());
}

async function initialize() {
  showScreen("login");
  try {
    await checkRegistration();
  } catch (error) {
    showNotice(error.message || "Не удалось проверить состояние регистрации.", "error");
  }

  if (sessionStorage.getItem(TOKEN_KEY)) {
    try {
      await requestJson("/api/auth/me");
      await openServices();
    } catch (error) {
      if (error.status !== 401) {
        showNotice(error.message || "Не удалось проверить авторизацию.", "error");
      }
    }
  }
}

elements.loginForm.addEventListener("submit", handleLogin);
elements.registrationForm.addEventListener("submit", handleRegistration);
elements.showRegistration.addEventListener("click", () => {
  showNotice();
  showScreen("registration");
});
elements.backToLogin.addEventListener("click", () => {
  showNotice();
  showScreen("login");
});
elements.logoutButton.addEventListener("click", () => logout());
elements.statisticsButton.addEventListener("click", loadStatistics);
elements.closeStatistics.addEventListener("click", () => elements.statisticsDialog.close());
elements.refreshApplications.addEventListener("click", loadApplications);
elements.applicationsBody.addEventListener("click", (event) => {
  const button = event.target.closest("button[data-application-id]");
  if (button) {
    openApplication(button.dataset.applicationId, button);
  }
});
elements.closeApplication.addEventListener("click", () => elements.applicationDialog.close());
bindServiceEvents();
initialize();
