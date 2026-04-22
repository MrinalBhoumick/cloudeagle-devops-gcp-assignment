/**
 * General LLM chat — POST /api/v1/agent/chat
 */
(function () {
  const log = document.getElementById("chat-log");
  const form = document.getElementById("chat-form");
  const input = document.getElementById("message");
  const sendBtn = document.getElementById("send");
  const err = document.getElementById("chat-error");
  const envPill = document.getElementById("pill-env");
  const vertexPill = document.getElementById("pill-vertex");
  const sessionPill = document.getElementById("pill-session");

  let sessionId = null;
  let typingEl = null;

  function addBubble(role, text, extra) {
    const div = document.createElement("div");
    div.className = "bubble " + (role === "user" ? "user" : "assistant");
    const tag = document.createElement("span");
    tag.className = "tag";
    tag.textContent = extra || (role === "user" ? "You" : "Assistant");
    const body = document.createElement("div");
    body.textContent = text;
    div.appendChild(tag);
    div.appendChild(body);
    log.appendChild(div);
    log.scrollTop = log.scrollHeight;
  }

  function addTyping() {
    removeTyping();
    const div = document.createElement("div");
    div.className = "bubble assistant";
    div.setAttribute("data-typing", "1");
    const tag = document.createElement("span");
    tag.className = "tag";
    tag.textContent = "Assistant";
    const row = document.createElement("div");
    row.className = "typing";
    row.setAttribute("aria-label", "Thinking");
    for (let i = 0; i < 3; i += 1) {
      const dot = document.createElement("i");
      row.appendChild(dot);
    }
    div.appendChild(tag);
    div.appendChild(row);
    log.appendChild(div);
    typingEl = div;
    log.classList.add("sending");
    log.scrollTop = log.scrollHeight;
  }

  function removeTyping() {
    if (typingEl && typingEl.parentNode) {
      typingEl.parentNode.removeChild(typingEl);
    }
    typingEl = null;
    log.classList.remove("sending");
  }

  function setLlmPill(meta) {
    if (!vertexPill) return;
    const p = meta.vertex_configured;
    const k = meta.gemini_api_key_set;
    const b = meta.llm_backend;
    const m = (meta.llm_model || "").trim();
    if (b && b !== "none") {
      vertexPill.className = "pill ok";
      vertexPill.innerHTML = "<strong>LLM</strong> " + b + (m ? " · " + m : "");
    } else if (k) {
      vertexPill.className = "pill ok";
      vertexPill.innerHTML = "<strong>LLM</strong> ready (key)";
    } else if (p) {
      vertexPill.className = "pill warn";
      vertexPill.innerHTML = "<strong>LLM</strong> Vertex…";
    } else {
      vertexPill.className = "pill warn";
      vertexPill.innerHTML = "<strong>LLM</strong> not set";
    }
  }

  async function loadMeta() {
    try {
      const [info, meta] = await Promise.all([
        fetch("/api/v1/info").then((r) => r.json()),
        fetch("/api/v1/agent/meta").then((r) => r.json()),
      ]);
      if (envPill) {
        const el = envPill.querySelector("strong");
        if (el) el.textContent = info.environment || "—";
      }
      setLlmPill(meta);
    } catch (e) {
      console.error(e);
    }
  }

  function setError(msg) {
    if (err) err.textContent = msg || "";
  }

  async function sendMessage(text) {
    if (!text.trim()) return;
    setError("");
    sendBtn.disabled = true;
    addBubble("user", text, "You");
    addTyping();
    input.value = "";

    try {
      const res = await fetch("/api/v1/agent/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: text,
          session_id: sessionId,
          assignment_mode: false,
        }),
      });
      const data = await res.json().catch(() => ({}));
      removeTyping();
      if (!res.ok) {
        const d = data.detail;
        const msg = Array.isArray(d) ? d.map((x) => x.msg || x).join(" ") : d || res.statusText;
        throw new Error(msg || "Request failed");
      }
      sessionId = data.session_id;
      if (sessionPill) {
        const el = sessionPill.querySelector("strong");
        if (el) el.textContent = sessionId ? sessionId.slice(0, 8) + "…" : "—";
      }
      const mode = data.mode;
      const modeTag =
        mode && mode !== "general" ? " · " + mode : "";
      addBubble("assistant", data.reply || "", "Assistant" + modeTag);
      loadMeta();
    } catch (e) {
      removeTyping();
      const m = e.message || String(e);
      setError(m);
      addBubble("assistant", m, "Error");
    } finally {
      sendBtn.disabled = false;
    }
  }

  form.addEventListener("submit", (ev) => {
    ev.preventDefault();
    sendMessage(input.value);
  });

  document.querySelectorAll(".chip[data-ask]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const q = btn.getAttribute("data-ask");
      if (q) {
        input.value = q;
        input.focus();
        sendMessage(q);
      }
    });
  });

  input.addEventListener("keydown", (ev) => {
    if (ev.key === "Enter" && !ev.shiftKey) {
      ev.preventDefault();
      if (!sendBtn.disabled) {
        form.requestSubmit();
      }
    }
  });

  log.innerHTML = "";
  addBubble(
    "assistant",
    "Hi — ask me anything. API links are in the footer. If replies fail, the host may need a Gemini API key (Cloud Run → Variables).",
    "Assistant"
  );

  loadMeta();
})();
