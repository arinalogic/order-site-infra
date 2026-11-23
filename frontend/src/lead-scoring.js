/*
 * Правило                                                   | Баллы
 * Срок: срочно / в течение месяца / в течение квартала      | 30 / 20 / 10
 * Срок: «не срочно» или пустой                              | 0
 * Команда: более 200 / 51-200 / 11-50 / до 10 человек       | 15 / 12 / 8 / 4
 * Задача: крупная / средняя / небольшая                     | 15 / 8 / 3
 * Роль: руководитель / сотрудник                            | 10 / 4
 * Заполнен телефон или email                                | 5
 * Бюджет в диапазоне услуги: 25 * (budget - min) / (max-min)| округлить, ограничить 0-25
 * Пустой/нечисловой бюджет, услуга или диапазон             | 0 за бюджет
 * Диапазон «15k-40k»: k означает 1000 (например, 150k=150000).
 * Температура: 70+ горячий; 40-69 тёплый; ниже 40 холодный.
 * Максимум: 100 баллов.
 */
function parseBudgetRange(source) {
  if (typeof source !== "string") {
    return null;
  }

  const match = source.match(/^\s*(\d+(?:[.,]\d+)?)\s*([kк]?)\s*-\s*(\d+(?:[.,]\d+)?)\s*([kк]?)\s*$/i);
  if (!match) {
    return null;
  }

  const toNumber = (amount, suffix) => {
    const value = Number(amount.replace(",", "."));
    return value * (suffix ? 1000 : 1);
  };
  const min = toNumber(match[1], match[2]);
  const max = toNumber(match[3], match[4]);

  if (!Number.isFinite(min) || !Number.isFinite(max) || min > max) {
    return null;
  }
  return { min, max };
}

function normalized(value) {
  return typeof value === "string" ? value.trim().toLocaleLowerCase("ru-RU") : "";
}

const deadlinePoints = new Map([
  ["срочно", 30],
  ["в течение месяца", 20],
  ["в течение квартала", 10],
]);
const companySizePoints = new Map([
  ["более 200", 15],
  ["51-200", 12],
  ["11-50", 8],
  ["до 10 человек", 4],
]);
const taskVolumePoints = new Map([
  ["крупный", 15],
  ["средний", 8],
  ["небольшой", 3],
]);
const clientRolePoints = new Map([
  ["руководитель", 10],
  ["сотрудник", 4],
]);

function calculateLeadScore(application, availableServices) {
  const item = application || {};
  let score =
    (deadlinePoints.get(normalized(item.deadline)) || 0) +
    (companySizePoints.get(normalized(item.company_size)) || 0) +
    (taskVolumePoints.get(normalized(item.task_volume)) || 0) +
    (clientRolePoints.get(normalized(item.client_role)) || 0);

  if ((typeof item.phone === "string" && item.phone.trim()) ||
      (typeof item.email === "string" && item.email.trim())) {
    score += 5;
  }

  const budget = typeof item.budget === "string" && item.budget.trim()
    ? Number(item.budget.trim())
    : Number.NaN;
  const service = Array.isArray(availableServices)
    ? availableServices.find((entry) => normalized(entry && entry.services) === normalized(item.service))
    : null;
  const range = service ? parseBudgetRange(service.budget_range) : null;

  if (Number.isFinite(budget) && range && range.max > range.min) {
    score += Math.round(Math.min(25, Math.max(0, 25 * (budget - range.min) / (range.max - range.min))));
  }

  return Math.min(100, score);
}

function getLeadTemperature(score) {
  if (score >= 70) {
    return "Горячий";
  }
  if (score >= 40) {
    return "Тёплый";
  }
  return "Холодный";
}

export { calculateLeadScore, getLeadTemperature };
