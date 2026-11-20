const MAX_SECONDS = 900;
const MAX_CLICK_NAMES = 200;
const MAX_CLICKS_LENGTH = 5000;
const MAX_HOVER_POINTS = 900;

function createSessionId() {
  if (!window.crypto || typeof window.crypto.getRandomValues !== "function") {
    return null;
  }

  try {
    const bytes = new Uint8Array(16);
    window.crypto.getRandomValues(bytes);
    return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
  } catch {
    return null;
  }
}

const sessionId = createSessionId();

if (sessionId) {
  let timeOnPageSeconds = 0;
  let lastPointerPosition = null;
  let pointerMoved = false;
  let requestInProgress = false;
  let sendPending = false;
  let consecutiveFailures = 0;
  let cooldownUntil = 0;
  const clicks = new Map();
  const hoverPoints = [];

  function getClicksData() {
    return JSON.stringify(
      Array.from(clicks, ([name, count]) => ({ name, count })),
    );
  }

  function getButtonName(element) {
    const ariaLabel = element.getAttribute("aria-label");
    const id = element.id;
    const label = ariaLabel || id || (
      element.matches("button, a, summary")
        ? element.textContent
        : ""
    );

    return label.replace(/\s+/g, " ").trim().slice(0, 60);
  }

  document.addEventListener("click", (event) => {
    if (!(event.target instanceof Element)) {
      return;
    }

    const target = event.target.closest(
      "button, a, select, summary, input[type='submit'], form [id]",
    );
    if (!target) {
      return;
    }

    const name = getButtonName(target);
    if (!name) {
      return;
    }

    const previousCount = clicks.get(name);
    if (previousCount !== undefined) {
      if (previousCount >= 100000) {
        return;
      }
      clicks.set(name, previousCount + 1);
      if (getClicksData().length > MAX_CLICKS_LENGTH) {
        clicks.set(name, previousCount);
      }
      return;
    }

    if (clicks.size >= MAX_CLICK_NAMES) {
      return;
    }

    clicks.set(name, 1);
    if (getClicksData().length > MAX_CLICKS_LENGTH) {
      clicks.delete(name);
    }
  });

  document.addEventListener("pointermove", (event) => {
    const pageWidth = document.documentElement.scrollWidth;
    const pageHeight = document.documentElement.scrollHeight;
    if (!pageWidth || !pageHeight) {
      return;
    }

    lastPointerPosition = {
      x: Math.min(100, Math.max(0, Math.round((event.pageX / pageWidth) * 1000) / 10)),
      y: Math.min(100, Math.max(0, Math.round((event.pageY / pageHeight) * 1000) / 10)),
    };
    pointerMoved = true;
  });

  async function sendMetrics() {
    if (requestInProgress) {
      sendPending = true;
      return;
    }
    if (cooldownUntil && Date.now() >= cooldownUntil) {
      cooldownUntil = 0;
      consecutiveFailures = 0;
    }
    if (Date.now() < cooldownUntil) {
      return;
    }

    requestInProgress = true;
    try {
      const response = await fetch("/api/behavior-metrics/", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          session_id: sessionId,
          time_on_page_seconds: timeOnPageSeconds,
          clicks_data: getClicksData(),
          hover_data: JSON.stringify(hoverPoints),
          return_visits: 0,
        }),
        keepalive: true,
      });

      if (response.status === 429) {
        cooldownUntil = Date.now() + 60000;
        consecutiveFailures = 0;
        return;
      }
      if (!response.ok) {
        consecutiveFailures += 1;
      } else {
        consecutiveFailures = 0;
      }
      if (consecutiveFailures >= 3) {
        cooldownUntil = Date.now() + 60000;
        consecutiveFailures = 0;
      }
    } catch {
      consecutiveFailures += 1;
      if (consecutiveFailures >= 3) {
        cooldownUntil = Date.now() + 60000;
        consecutiveFailures = 0;
      }
    } finally {
      requestInProgress = false;
      if (sendPending) {
        sendPending = false;
        if (document.visibilityState === "visible") {
          sendMetrics();
        }
      }
    }
  }

  window.setInterval(() => {
    if (document.visibilityState !== "visible" || timeOnPageSeconds >= MAX_SECONDS) {
      return;
    }

    timeOnPageSeconds += 1;
    if (pointerMoved && lastPointerPosition && hoverPoints.length < MAX_HOVER_POINTS) {
      hoverPoints.push(lastPointerPosition);
    }
    pointerMoved = false;
    sendMetrics();
  }, 1000);
}
