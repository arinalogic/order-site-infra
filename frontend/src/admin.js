import "./admin.css";

const TOKEN_KEY = "admin_access_token";

const elements = {
  notice: document.querySelector("#notice"),
  loginScreen: document.querySelector("#login-screen"),
  registrationScreen: document.querySelector("#registration-screen"),
  servicesScreen: document.querySelector("#services-screen"),
  loginForm: document.querySelector("#login-form"),
  registrationForm: document.querySelector("#registration-form"),
  showRegistration: document.querySelector("#show-registration"),
  backToLogin: document.querySelector("#back-to-login"),
  logoutButton: document.querySelector("#logout-button"),
  servicesBody: document.querySelector("#services-body"),
  emptyServices: document.querySelector("#empty-services"),
  addService: document.querySelector("#add-service"),
  editService: document.querySelector("#edit-service"),
  deleteService: document.querySelector("#delete-service"),
  serviceDialog: document.querySelector("#service-dialog"),
  serviceForm: document.querySelector("#service-form"),
  serviceDialogTitle: document.querySelector("#service-dialog-title"),
  serviceName: document.querySelector("#service-name"),
  serviceBudget: document.querySelector("#service-budget"),
  cancelService: document.querySelector("#cancel-service"),
  saveService: document.querySelector("#save-service"),
};

let services = [];
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
  services = [];
  selectedServiceId = null;
  elements.servicesBody.replaceChildren();
  updateSelectionButtons();
  showScreen("login");
  showNotice(message, type);
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
}

async function openServices() {
  showScreen("services");
  showNotice();
  try {
    await loadServices();
  } catch (error) {
    if (error.status !== 401) {
      showNotice(error.message || "Не удалось загрузить список услуг.", "error");
    }
  }
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
bindServiceEvents();
initialize();
