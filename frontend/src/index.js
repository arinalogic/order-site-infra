import "./styles.css";

const form = document.querySelector("#application-form");
const serviceSelect = document.querySelector("#service");
const budgetField = document.querySelector("#budget-field");
const budgetHint = document.querySelector("#budget-hint");
const budgetInput = document.querySelector("#budget");
const budgetValue = document.querySelector("#budget-value");
const budgetMin = document.querySelector("#budget-min");
const budgetMax = document.querySelector("#budget-max");
const submitButton = document.querySelector("#submit-button");
const formMessage = document.querySelector("#form-message");

let services = [];
let isSubmitting = false;

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

function formatBudget(amount) {
  return `${new Intl.NumberFormat("ru-RU").format(amount)} ₽`;
}

function updateBudgetDisplay() {
  budgetValue.textContent = formatBudget(Number(budgetInput.value));
}

function showSelectedService() {
  const selectedService = serviceSelect.value === "" ? null : services[Number(serviceSelect.value)];

  budgetField.hidden = true;
  budgetHint.hidden = true;
  budgetHint.textContent = "";

  if (!selectedService) {
    return;
  }

  const range = parseBudgetRange(selectedService.budget_range);

  if (!range) {
    budgetHint.textContent = `Диапазон бюджета: ${selectedService.budget_range}`;
    budgetHint.hidden = false;
    return;
  }

  budgetInput.min = String(range.min);
  budgetInput.max = String(range.max);
  budgetInput.value = String(Math.round(range.min + (range.max - range.min) / 2));
  budgetMin.textContent = formatBudget(range.min);
  budgetMax.textContent = formatBudget(range.max);
  updateBudgetDisplay();
  budgetField.hidden = false;
}

async function loadServices() {
  try {
    const response = await fetch("/api/admin-settings/");

    if (!response.ok) {
      throw new Error("Не удалось получить услуги");
    }

    const result = await response.json();

    if (
      !Array.isArray(result) ||
      result.length === 0 ||
      result.some((item) => typeof item.services !== "string" || typeof item.budget_range !== "string")
    ) {
      throw new Error("Список услуг пуст или имеет неверный формат");
    }

    services = result;
    serviceSelect.replaceChildren();

    const placeholder = document.createElement("option");
    placeholder.value = "";
    placeholder.textContent = "Выберите услугу";
    placeholder.disabled = true;
    placeholder.selected = true;
    serviceSelect.append(placeholder);

    services.forEach((item, index) => {
      const option = document.createElement("option");
      option.value = String(index);
      option.textContent = item.services;
      serviceSelect.append(option);
    });

    submitButton.disabled = false;
  } catch {
    serviceSelect.replaceChildren();
    const unavailableOption = document.createElement("option");
    unavailableOption.value = "";
    unavailableOption.textContent = "Не удалось загрузить услуги";
    unavailableOption.disabled = true;
    unavailableOption.selected = true;
    serviceSelect.append(unavailableOption);
    formMessage.textContent = "Не удалось загрузить услуги";
  }
}

function setFieldInvalid(field, isInvalid) {
  const container = field.closest(".field");
  field.setAttribute("aria-invalid", String(isInvalid));
  container.classList.toggle("field-invalid", isInvalid);
}

function validateRequiredFields() {
  const requiredFields = Array.from(form.querySelectorAll("[required]"));
  const emptyFields = requiredFields.filter((field) => !field.value.trim());

  requiredFields.forEach((field) => {
    setFieldInvalid(field, emptyFields.includes(field));
  });

  if (emptyFields.length > 0) {
    formMessage.textContent = "Заполните обязательные поля, отмеченные цветом.";
    emptyFields[0].focus();
    return false;
  }

  return true;
}

function getOptionalValue(name) {
  const value = form.elements.namedItem(name).value.trim();
  return value || null;
}

function createApplicationData() {
  const selectedService = serviceSelect.value === "" ? null : services[Number(serviceSelect.value)];

  return {
    first_name: form.elements.first_name.value.trim(),
    last_name: form.elements.last_name.value.trim(),
    middle_name: getOptionalValue("middle_name"),
    phone: getOptionalValue("phone"),
    email: getOptionalValue("email"),
    business_info: getOptionalValue("business_info"),
    business_niche: getOptionalValue("business_niche"),
    company_size: getOptionalValue("company_size"),
    client_role: getOptionalValue("client_role"),
    task_volume: getOptionalValue("task_volume"),
    deadline: getOptionalValue("deadline"),
    task_type: getOptionalValue("task_type"),
    service: selectedService ? selectedService.services : null,
    budget: selectedService && !budgetField.hidden ? budgetInput.value : null,
    preferred_contact_method: getOptionalValue("preferred_contact_method"),
    preferred_contact_time: getOptionalValue("preferred_contact_time"),
    comments: getOptionalValue("comments"),
  };
}

serviceSelect.addEventListener("change", () => {
  setFieldInvalid(serviceSelect, false);
  showSelectedService();
});

budgetInput.addEventListener("input", updateBudgetDisplay);

form.addEventListener("input", (event) => {
  if (event.target.matches("[required]")) {
    setFieldInvalid(event.target, !event.target.value.trim());
  }
});

form.addEventListener("change", (event) => {
  if (event.target.matches("[required]")) {
    setFieldInvalid(event.target, !event.target.value.trim());
  }
});

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  formMessage.textContent = "";
  formMessage.classList.remove("is-success");

  if (isSubmitting || !validateRequiredFields()) {
    return;
  }

  isSubmitting = true;
  submitButton.disabled = true;

  try {
    const response = await fetch("/api/applications/", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(createApplicationData()),
    });

    if (response.status !== 201) {
      throw new Error("Заявка не отправлена");
    }

    form.reset();
    serviceSelect.selectedIndex = 0;
    form.querySelectorAll("[required]").forEach((field) => setFieldInvalid(field, false));
    showSelectedService();
    formMessage.textContent = "Заявка отправлена!";
    formMessage.classList.add("is-success");
    formMessage.scrollIntoView({ behavior: "smooth", block: "center" });
  } catch {
    formMessage.textContent = "Не удалось отправить заявку, попробуйте позже";
    formMessage.scrollIntoView({ behavior: "smooth", block: "center" });
  } finally {
    isSubmitting = false;
    submitButton.disabled = services.length === 0;
  }
});

loadServices();
