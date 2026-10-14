(() => {
  const expressionEl = document.getElementById("expression");
  const resultEl = document.getElementById("result");
  const statusEl = document.getElementById("status");
  const pad = document.querySelector(".pad");
  const historyEl = document.getElementById("history");
  const themeBtn = document.getElementById("theme-toggle");
  const angleBtn = document.getElementById("angle-toggle");
  const chips = {
    dec: document.getElementById("chip-dec"),
    sci: document.getElementById("chip-sci"),
    bin: document.getElementById("chip-bin"),
    frac: document.getElementById("chip-frac"),
  };

  let expr = "";
  let memory = 0;
  let lastValue = 0;
  let degrees = true;
  const history = [];

  const FUNCTIONS = {
    sin: (x) => Math.sin(toRad(x)),
    cos: (x) => Math.cos(toRad(x)),
    tan: (x) => Math.tan(toRad(x)),
    ln: (x) => Math.log(x),
    log: (x) => Math.log10(x),
    sqrt: (x) => Math.sqrt(x),
    abs: (x) => Math.abs(x),
    fact: (x) => factorial(x),
  };

  function toRad(x) {
    return degrees ? (x * Math.PI) / 180 : x;
  }

  function factorial(n) {
    if (!Number.isFinite(n) || n < 0 || Math.floor(n) !== n || n > 170) {
      throw new Error("n! needs a whole number 0–170");
    }
    let v = 1;
    for (let i = 2; i <= n; i++) v *= i;
    return v;
  }

  function tokenize(input) {
    const src = input.replace(/π/g, "pi").replace(/\s+/g, "");
    const tokens = [];
    let i = 0;
    const isDigit = (c) => c >= "0" && c <= "9";
    const isLetter = (c) => /[a-z]/i.test(c);

    while (i < src.length) {
      const c = src[i];
      if (isDigit(c) || (c === "." && isDigit(src[i + 1]))) {
        let j = i;
        while (j < src.length && (isDigit(src[j]) || src[j] === ".")) j++;
        if (src[j] === "e" && (src[j + 1] === "+" || src[j + 1] === "-" || isDigit(src[j + 1]))) {
          j++;
          if (src[j] === "+" || src[j] === "-") j++;
          while (isDigit(src[j])) j++;
        }
        tokens.push({ type: "num", value: Number(src.slice(i, j)) });
        i = j;
        continue;
      }
      if (isLetter(c)) {
        let j = i;
        while (isLetter(src[j])) j++;
        const name = src.slice(i, j);
        if (name === "pi") tokens.push({ type: "num", value: Math.PI });
        else if (name === "e") tokens.push({ type: "num", value: Math.E });
        else if (FUNCTIONS[name]) tokens.push({ type: "fn", value: name });
        else throw new Error("Unknown name: " + name);
        i = j;
        continue;
      }
      if ("+-*/%^()!".includes(c)) {
        tokens.push({ type: "op", value: c });
        i++;
        continue;
      }
      throw new Error("Unexpected character");
    }
    return tokens;
  }

  function withUnary(tokens) {
    const out = [];
    for (let i = 0; i < tokens.length; i++) {
      const t = tokens[i];
      const prev = out[out.length - 1];
      if (t.type === "op" && t.value === "-" && (!prev || (prev.type === "op" && prev.value !== ")" && prev.value !== "!"))) {
        out.push({ type: "op", value: "u-" });
      } else if (t.type === "op" && t.value === "!") {
        out.push({ type: "op", value: "!" });
      } else {
        out.push(t);
      }
    }
    return out;
  }

  const PREC = { "+": 1, "-": 1, "*": 2, "/": 2, "^": 4, "u-": 5, "!": 6, "%": 6 };
  const RIGHT = { "^": true, "u-": true };

  function toRpn(tokens) {
    const output = [];
    const ops = [];
    for (const t of tokens) {
      if (t.type === "num") output.push(t);
      else if (t.type === "fn") ops.push(t);
      else if (t.type === "op" && t.value === "(") ops.push(t);
      else if (t.type === "op" && t.value === ")") {
        while (ops.length && !(ops[ops.length - 1].type === "op" && ops[ops.length - 1].value === "(")) {
          output.push(ops.pop());
        }
        if (!ops.length) throw new Error("Mismatched parentheses");
        ops.pop();
        if (ops.length && ops[ops.length - 1].type === "fn") output.push(ops.pop());
      } else {
        while (ops.length) {
          const top = ops[ops.length - 1];
          if (top.type === "fn") {
            output.push(ops.pop());
            continue;
          }
          if (top.type !== "op" || top.value === "(") break;
          const pTop = PREC[top.value] || 0;
          const pCur = PREC[t.value] || 0;
          if (pTop > pCur || (pTop === pCur && !RIGHT[t.value])) output.push(ops.pop());
          else break;
        }
        ops.push(t);
      }
    }
    while (ops.length) {
      const op = ops.pop();
      if (op.type === "op" && (op.value === "(" || op.value === ")")) throw new Error("Mismatched parentheses");
      output.push(op);
    }
    return output;
  }

  function evalRpn(rpn) {
    const st = [];
    for (const t of rpn) {
      if (t.type === "num") st.push(t.value);
      else if (t.type === "fn") {
        const a = st.pop();
        if (a === undefined) throw new Error("Incomplete expression");
        const v = FUNCTIONS[t.value](a);
        if (!Number.isFinite(v)) throw new Error("Math error");
        st.push(v);
      } else if (t.value === "u-") {
        const a = st.pop();
        st.push(-a);
      } else if (t.value === "!") {
        const a = st.pop();
        st.push(factorial(a));
      } else if (t.value === "%") {
        const a = st.pop();
        st.push(a / 100);
      } else {
        const b = st.pop();
        const a = st.pop();
        if (a === undefined || b === undefined) throw new Error("Incomplete expression");
        let v;
        if (t.value === "+") v = a + b;
        else if (t.value === "-") v = a - b;
        else if (t.value === "*") v = a * b;
        else if (t.value === "/") v = a / b;
        else if (t.value === "^") v = Math.pow(a, b);
        if (!Number.isFinite(v)) throw new Error("Math error");
        st.push(v);
      }
    }
    if (st.length !== 1) throw new Error("Incomplete expression");
    return st[0];
  }

  function evaluate(source) {
    if (!source) return { ok: true, value: 0 };
    const rpn = toRpn(withUnary(tokenize(source)));
    return { ok: true, value: evalRpn(rpn) };
  }

  function format(n) {
    if (!Number.isFinite(n)) return "Error";
    if (Object.is(n, -0)) return "0";
    const abs = Math.abs(n);
    if (abs !== 0 && (abs >= 1e12 || abs < 1e-8)) return n.toExponential(8).replace(/\.?0+e/, "e");
    return String(parseFloat(n.toPrecision(12)));
  }

  function toFraction(n) {
    if (!Number.isFinite(n)) return "—";
    if (Math.abs(n - Math.round(n)) < 1e-12) return String(Math.round(n));
    let sign = n < 0 ? "-" : "";
    n = Math.abs(n);
    let h1 = 1,
      h2 = 0,
      k1 = 0,
      k2 = 1,
      b = n;
    for (let i = 0; i < 20; i++) {
      const a = Math.floor(b);
      const h = a * h1 + h2;
      const k = a * k1 + k2;
      if (k > 1e6) break;
      h2 = h1;
      k2 = k1;
      h1 = h;
      k1 = k;
      const frac = b - a;
      if (frac < 1e-12) break;
      b = 1 / frac;
    }
    if (!k1) return "—";
    return sign + h1 + "/" + k1;
  }

  function updateRefract(n) {
    chips.dec.textContent = format(n);
    chips.sci.textContent = Number.isFinite(n) ? n.toExponential(6) : "—";
    const intLike = Number.isFinite(n) && Math.abs(n - Math.round(n)) < 1e-12 && Math.abs(n) <= Number.MAX_SAFE_INTEGER;
    if (intLike) {
      const v = Math.round(n);
      chips.bin.textContent = (v < 0 ? "-" : "") + Math.abs(v).toString(2);
    } else {
      chips.bin.textContent = "—";
    }
    chips.frac.textContent = toFraction(n);
  }

  function render(error) {
    expressionEl.textContent = expr || "";
    if (error) {
      statusEl.textContent = error;
      return;
    }
    statusEl.textContent = "";
    try {
      const { value } = evaluate(expr || "0");
      lastValue = value;
      resultEl.textContent = format(value);
      updateRefract(value);
      document.documentElement.style.setProperty("--glow", value < 0 ? "0 0 80px rgba(255, 107, 156, 0.35)" : "0 0 80px rgba(124, 92, 255, 0.35)");
    } catch (e) {
      resultEl.textContent = expr ? "…" : "0";
      statusEl.textContent = "";
    }
  }

  function commitHistory() {
    try {
      const { value } = evaluate(expr);
      history.unshift({ expr, value });
      if (history.length > 24) history.pop();
      historyEl.replaceChildren();
      for (const item of history) {
        const li = document.createElement("li");
        const a = document.createElement("span");
        a.className = "h-expr";
        a.textContent = item.expr;
        const b = document.createElement("span");
        b.className = "h-val";
        b.textContent = "= " + format(item.value);
        li.append(a, b);
        li.addEventListener("click", () => {
          expr = item.expr;
          render();
        });
        historyEl.append(li);
      }
    } catch (e) {
      statusEl.textContent = e.message;
    }
  }

  function append(text) {
    expr += text;
    render();
  }

  function lastNumberBounds() {
    const m = expr.match(/(-?\d*\.?\d+(?:e[+-]?\d+)?)(?!.*\d)/);
    if (!m) return null;
    const start = expr.lastIndexOf(m[1]);
    return { start, end: start + m[1].length, raw: m[1] };
  }

  pad.addEventListener("click", (event) => {
    const btn = event.target.closest("button");
    if (!btn) return;
    const digit = btn.dataset.digit;
    const op = btn.dataset.op;
    const fn = btn.dataset.fn;
    const act = btn.dataset.act;

    if (digit !== undefined) append(digit);
    else if (op) append(op);
    else if (fn === "(" || fn === ")") append(fn);
    else if (fn === "pi") append("π");
    else if (fn === "e") append("e");
    else if (fn === "pow") append("^");
    else if (fn === "fact") append("!");
    else if (fn) append(fn + "(");
    else if (act === "clear") {
      expr = "";
      render();
    } else if (act === "back") {
      expr = expr.slice(0, -1);
      render();
    } else if (act === "equals") {
      try {
        const { value } = evaluate(expr || "0");
        commitHistory();
        expr = format(value);
        render();
      } catch (e) {
        statusEl.textContent = e.message;
      }
    } else if (act === "sign") {
      const bounds = lastNumberBounds();
      if (!bounds) return;
      const n = bounds.raw.startsWith("-") ? bounds.raw.slice(1) : "-" + bounds.raw;
      expr = expr.slice(0, bounds.start) + n + expr.slice(bounds.end);
      render();
    } else if (act === "mc") memory = 0;
    else if (act === "mr") append(format(memory));
    else if (act === "mplus") memory += lastValue;
    else if (act === "mminus") memory -= lastValue;
  });

  document.getElementById("mode-basic").addEventListener("click", () => setMode("basic"));
  document.getElementById("mode-sci").addEventListener("click", () => setMode("sci"));

  function setMode(mode) {
    pad.dataset.mode = mode;
    const basic = document.getElementById("mode-basic");
    const sci = document.getElementById("mode-sci");
    basic.classList.toggle("is-on", mode === "basic");
    sci.classList.toggle("is-on", mode === "sci");
    basic.setAttribute("aria-pressed", String(mode === "basic"));
    sci.setAttribute("aria-pressed", String(mode === "sci"));
  }

  angleBtn.addEventListener("click", () => {
    degrees = !degrees;
    angleBtn.textContent = degrees ? "DEG" : "RAD";
    angleBtn.setAttribute("aria-pressed", String(degrees));
    render();
  });

  document.getElementById("clear-tape").addEventListener("click", () => {
    history.length = 0;
    historyEl.replaceChildren();
  });

  function currentTheme() {
    return document.documentElement.getAttribute("data-theme") === "light" ? "light" : "dark";
  }

  function applyTheme(theme) {
    document.documentElement.setAttribute("data-theme", theme);
    localStorage.setItem("prism-theme", theme);
    themeBtn.setAttribute("aria-label", theme === "dark" ? "Switch to light mode" : "Switch to dark mode");
  }

  themeBtn.addEventListener("click", () => {
    applyTheme(currentTheme() === "dark" ? "light" : "dark");
  });
  applyTheme(currentTheme());

  document.getElementById("refract").addEventListener("click", async (event) => {
    const chip = event.target.closest("[data-copy]");
    if (!chip) return;
    const key = chip.dataset.copy;
    const text = chips[key].textContent;
    try {
      await navigator.clipboard.writeText(text);
      statusEl.textContent = "Copied " + key.toUpperCase();
      statusEl.style.color = "var(--ok)";
      setTimeout(() => {
        statusEl.textContent = "";
        statusEl.style.color = "";
      }, 900);
    } catch (e) {
      statusEl.textContent = "Copy failed";
    }
  });

  window.addEventListener("keydown", (event) => {
    if (event.metaKey || event.ctrlKey || event.altKey) return;
    const k = event.key;
    if (/^[0-9.]$/.test(k)) {
      append(k);
      event.preventDefault();
    } else if (["+", "-", "*", "/", "%", "^", "(", ")"].includes(k)) {
      append(k);
      event.preventDefault();
    } else if (k === "Enter" || k === "=") {
      document.querySelector("[data-act=equals]").click();
      event.preventDefault();
    } else if (k === "Backspace") {
      expr = expr.slice(0, -1);
      render();
      event.preventDefault();
    } else if (k === "Escape") {
      expr = "";
      render();
      event.preventDefault();
    }
  });

  render();
})();
