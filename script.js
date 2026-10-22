const STORAGE_KEY = "tinystart-cards-v2";
const VERSE_KEY = "tinystart-verses-v1";
const STATS_KEY = "tinystart-stats-v1";
const HELP_KEY = "tinystart-help-seen-v1";
const MAX_SESSION = 50;

const builtInLines = [
  "Let the words of my mouth, and the meditation of my heart, be acceptable in thy sight, O LORD, my strength, and my redeemer. (Psalm 19:14, KJV)",
  "I can do all things through Christ which strengtheneth me. (Philippians 4:13, KJV)",
  "Commit thy works unto the LORD, and thy thoughts shall be established. (Proverbs 16:3, KJV)",
  "You don't have to finish. You just have to begin.",
  "One small question is still a start."
];

function byId(id) {
  return document.getElementById(id);
}

function setMessage(text) {
  byId("message").textContent = text;
}

function loadData(key, fallback) {
  try {
    const saved = localStorage.getItem(key);
    if (saved) {
      return JSON.parse(saved);
    }
  } catch (e) {
    // If saving is blocked, we use the fallback.
  }
  return fallback;
}

function saveData(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch (e) {
    setMessage("Couldn't save in this browser. Use Export to keep a backup.");
  }
}

let cards = loadData(STORAGE_KEY, starterCards.slice());
let myVerses = loadData(VERSE_KEY, []);
let stats = loadData(STATS_KEY, {});

let selectedCourse = "";
let session = null;
let currentItem = null;
let currentCard = null;
let answered = false;

// ---------- small helpers ----------

function shuffle(list) {
  const copy = list.slice();
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    const temp = copy[i];
    copy[i] = copy[j];
    copy[j] = temp;
  }
  return copy;
}

// Plain-text answers: ignore capitals, spaces and * when comparing.
function normalise(text) {
  return String(text)
    .toLowerCase()
    .replace(/²/g, "^2")
    .replace(/³/g, "^3")
    .replace(/[\s*·]/g, "");
}

function isCorrectText(card, given) {
  const allowed = [card.answer].concat(card.accept || []);
  return allowed.some(function (option) {
    return normalise(option) === normalise(given);
  });
}

function correctList(card) {
  if (card.type === "method") {
    return card.answers || [];
  }
  return [card.answer];
}

function splitList(text) {
  return text
    .split(",")
    .map(function (part) { return part.trim(); })
    .filter(function (part) { return part !== ""; });
}

// Used to spot questions we already have, and to remember which ones you miss.
function cardKey(card) {
  return [card.course, card.topic, card.type, card.question].join("|").toLowerCase();
}

function isMath(card) {
  return card.type === "typed" && card.check === "math";
}

const mathCache = new Map();

function refFor(card) {
  if (!mathCache.has(card.answer)) {
    mathCache.set(card.answer, TinyMath.parseAnswer(card.answer, null));
  }
  return mathCache.get(card.answer);
}

function allowedVarsFor(card) {
  const ref = refFor(card);
  return ref.ok ? ref.vars : null;
}

function prefixTex(card) {
  if (!card.prefix) {
    return "";
  }
  return String(card.prefix).replace(/[\\{}$#%&_^~\s]/g, "");
}

function renderMath(element, latex) {
  element.textContent = "";
  if (window.katex) {
    try {
      window.katex.render(latex, element, { throwOnError: false });
      return;
    } catch (e) {
      // fall through to plain text
    }
  }
  element.textContent = latex;
}

// ---------- the hidden record of what you keep missing ----------

function weightOf(card) {
  const entry = stats[cardKey(card)];
  return 1 + (entry ? entry.s : 0);
}

function bumpStat(card, delta) {
  const key = cardKey(card);
  const current = stats[key] ? stats[key].s : 0;
  const next = Math.max(0, Math.min(8, current + delta));
  if (next === 0) {
    delete stats[key];
  } else {
    stats[key] = { s: next };
  }
  saveData(STATS_KEY, stats);
}

// Questions you miss more often are more likely to be picked, but everything can still appear.
function pickQuestions(pool, n) {
  const items = pool.slice();
  const picked = [];
  while (picked.length < n && items.length > 0) {
    const total = items.reduce(function (sum, c) { return sum + weightOf(c); }, 0);
    let r = Math.random() * total;
    let index = 0;
    for (; index < items.length; index++) {
      r -= weightOf(items[index]);
      if (r <= 0) {
        break;
      }
    }
    if (index >= items.length) {
      index = items.length - 1;
    }
    picked.push(items.splice(index, 1)[0]);
  }
  return shuffle(picked);
}

// ---------- screens ----------

function getCourses() {
  const names = [];
  cards.forEach(function (c) {
    if (names.indexOf(c.course) === -1) {
      names.push(c.course);
    }
  });
  return names.sort();
}

function getTopics(course) {
  const names = [];
  cards.forEach(function (c) {
    if (c.course === course && names.indexOf(c.topic) === -1) {
      names.push(c.topic);
    }
  });
  return names.sort();
}

function showScreen(name) {
  ["homeScreen", "courseScreen", "quizScreen"].forEach(function (id) {
    byId(id).classList.add("hidden");
  });
  byId(name).classList.remove("hidden");
  window.scrollTo(0, 0);
}

function setVerse() {
  const lines = builtInLines.concat(myVerses);
  byId("verse").textContent = lines[Math.floor(Math.random() * lines.length)];
}

function renderHome() {
  const tabs = byId("courseTabs");
  tabs.textContent = "";
  const courses = getCourses();
  byId("emptyHome").classList.toggle("hidden", courses.length > 0);

  courses.forEach(function (name) {
    const b = document.createElement("button");
    b.textContent = name;
    b.className = "tab";
    b.addEventListener("click", function () {
      openCourse(name);
    });
    tabs.appendChild(b);
  });

  const list = byId("courseList");
  list.textContent = "";
  courses.forEach(function (name) {
    const o = document.createElement("option");
    o.value = name;
    list.appendChild(o);
  });

  renderManageList();
}

function renderManageList() {
  const box = byId("manageList");
  box.textContent = "";
  if (cards.length === 0) {
    box.textContent = "No questions yet.";
    return;
  }
  cards.forEach(function (card) {
    const row = document.createElement("div");
    row.className = "manage-row";
    const label = document.createElement("span");
    let tag = "";
    if (card.type === "method") {
      tag = "[method] ";
    } else if (isMath(card)) {
      tag = "[maths] ";
    }
    label.textContent = card.course + " · " + card.topic + " — " + tag + card.question;
    const del = document.createElement("button");
    del.textContent = "Delete";
    del.addEventListener("click", function () {
      if (confirm("Delete this question?")) {
        cards.splice(cards.indexOf(card), 1);
        saveData(STORAGE_KEY, cards);
        renderHome();
      }
    });
    row.appendChild(label);
    row.appendChild(del);
    box.appendChild(row);
  });
}

function openCourse(course) {
  selectedCourse = course;
  byId("courseTitle").textContent = course;
  byId("courseMessage").textContent = "";
  byId("sessionLength").value = "10";

  const list = byId("topicList");
  list.textContent = "";
  getTopics(course).forEach(function (topic) {
    const row = document.createElement("label");
    row.className = "topic-row";
    const box = document.createElement("input");
    box.type = "checkbox";
    box.checked = true;
    box.value = topic;
    row.appendChild(box);
    row.appendChild(document.createTextNode(topic));
    list.appendChild(row);
  });

  showScreen("courseScreen");
}

// ---------- a session ----------
// You get N questions. Any you miss on the first try come back once at the end.
// Leaving at any time keeps nothing except the quiet record of what you missed.

function startSession() {
  const chosen = Array.from(byId("topicList").querySelectorAll("input"))
    .filter(function (box) { return box.checked; })
    .map(function (box) { return box.value; });

  if (chosen.length === 0) {
    byId("courseMessage").textContent = "Tick at least one topic.";
    return;
  }

  const n = parseInt(byId("sessionLength").value, 10);
  if (!(n >= 1)) {
    byId("courseMessage").textContent = "Pick how many questions you want (1 to " + MAX_SESSION + ").";
    return;
  }

  const pool = cards.filter(function (c) {
    return c.course === selectedCourse && chosen.indexOf(c.topic) !== -1;
  });
  if (pool.length === 0) {
    byId("courseMessage").textContent = "There are no questions in those topics yet.";
    return;
  }

  const picked = pickQuestions(pool, Math.min(n, MAX_SESSION, pool.length));
  session = {
    queue: picked.map(function (c) { return { card: c, attempt: 1 }; }),
    retries: [],
    phase: "main",
    total: picked.length,
    mainShown: 0,
    retryShown: 0,
    retryTotal: 0
  };

  byId("card").classList.remove("hidden");
  byId("sessionEnd").classList.add("hidden");
  byId("leave").classList.remove("hidden");
  showScreen("quizScreen");
  nextItem();
}

function nextItem() {
  if (session.queue.length === 0) {
    if (session.phase === "main" && session.retries.length > 0) {
      session.phase = "retry";
      session.queue = session.retries.map(function (c) { return { card: c, attempt: 2 }; });
      session.retryTotal = session.queue.length;
      session.retries = [];
    } else {
      endSession();
      return;
    }
  }
  currentItem = session.queue.shift();
  currentCard = currentItem.card;
  if (currentItem.attempt === 1) {
    session.mainShown = session.mainShown + 1;
  } else {
    session.retryShown = session.retryShown + 1;
  }
  showCard();
}

function endSession() {
  byId("card").classList.add("hidden");
  byId("progress").textContent = "";
  byId("sessionEnd").classList.remove("hidden");
  byId("leave").classList.add("hidden");
  session = null;
}

function showCard() {
  answered = false;
  byId("options").textContent = "";
  byId("typedForm").classList.add("hidden");
  byId("feedback").classList.add("hidden");
  byId("next").classList.add("hidden");

  if (currentItem.attempt === 1) {
    byId("progress").textContent = "Question " + session.mainShown + " of " + session.total;
  } else {
    byId("progress").textContent = "Try again · " + session.retryShown + " of " + session.retryTotal;
  }

  byId("meta").textContent = (currentCard.type === "method" ? "Spot the method (tick all that apply) · " : "") + currentCard.topic;
  byId("question").textContent = currentCard.question;

  if (currentCard.type === "choice") {
    shuffle(currentCard.options).forEach(function (text, i) {
      const b = document.createElement("button");
      b.className = "option";
      b.textContent = String.fromCharCode(65 + i) + ". " + text;
      b.dataset.value = text;
      b.addEventListener("click", function () {
        chooseOption(b, text);
      });
      byId("options").appendChild(b);
    });
  } else if (currentCard.type === "method") {
    shuffle(currentCard.options).forEach(function (text) {
      const b = document.createElement("button");
      b.className = "option";
      b.textContent = text;
      b.dataset.value = text;
      b.addEventListener("click", function () {
        if (!answered) {
          b.classList.toggle("selected");
        }
      });
      byId("options").appendChild(b);
    });
    const check = document.createElement("button");
    check.className = "methodCheck";
    check.textContent = "Check";
    check.addEventListener("click", checkMethod);
    byId("options").appendChild(check);
  } else {
    showTypedForm();
  }
}

function showTypedForm() {
  const math = isMath(currentCard);
  byId("typedForm").classList.remove("hidden");
  byId("typedInput").value = "";
  byId("preview").classList.add("hidden");
  byId("preview").textContent = "";
  byId("typingHelp").classList.add("hidden");
  byId("symbols").classList.toggle("hidden", !math);
  byId("infoBtn").classList.toggle("hidden", !math);

  const prefix = byId("prefix");
  const ref = math ? refFor(currentCard) : null;
  if (math && currentCard.prefix && ref && ref.ok && !ref.hasEq) {
    prefix.textContent = currentCard.prefix;
    prefix.classList.remove("hidden");
  } else {
    prefix.textContent = "";
    prefix.classList.add("hidden");
  }

  if (math) {
    let seen = false;
    try {
      seen = localStorage.getItem(HELP_KEY) === "1";
    } catch (e) {
      seen = false;
    }
    if (!seen) {
      byId("typingHelp").classList.remove("hidden");
      try {
        localStorage.setItem(HELP_KEY, "1");
      } catch (e) {
        // not a problem if it can't be remembered
      }
    }
  }
}

// The box under the answer: how the app read what was typed.
function updatePreview() {
  if (!currentCard || !isMath(currentCard)) {
    return;
  }
  const text = byId("typedInput").value;
  const box = byId("preview");
  if (text.trim() === "") {
    box.classList.add("hidden");
    box.textContent = "";
    return;
  }

  const given = TinyMath.parseAnswer(text, allowedVarsFor(currentCard));
  box.classList.remove("hidden");
  box.textContent = "";
  const label = document.createElement("div");
  label.className = "previewLabel";

  if (given.ok) {
    box.classList.remove("error");
    label.textContent = "Your answer is read as:";
    box.appendChild(label);
    const math = document.createElement("div");
    math.className = "previewMath";
    const ref = refFor(currentCard);
    const lead = ref.ok && !ref.hasEq && !given.hasEq ? prefixTex(currentCard) : "";
    renderMath(math, lead + given.latex);
    box.appendChild(math);
  } else {
    box.classList.add("error");
    label.textContent = given.error;
    box.appendChild(label);
  }
}

function lockOptions(reveal) {
  const right = correctList(currentCard);
  byId("options").querySelectorAll(".option").forEach(function (b) {
    b.disabled = true;
    const isRight = right.indexOf(b.dataset.value) !== -1;
    if (reveal) {
      b.classList.remove("selected");
    }
    if (reveal && isRight) {
      b.classList.add("correct");
    } else if (b.dataset.picked === "1" && !isRight && (reveal || currentCard.type === "choice")) {
      b.classList.add("missed");
    }
  });
}

function buildAnswerBox() {
  const box = document.createElement("div");
  box.className = "answerBox";
  const label = document.createElement("div");
  label.className = "answerLabel";
  label.textContent = "Answer";
  box.appendChild(label);
  const body = document.createElement("div");
  body.className = "answerBody";
  if (isMath(currentCard)) {
    const ref = refFor(currentCard);
    if (ref.ok) {
      const lead = !ref.hasEq ? prefixTex(currentCard) : "";
      renderMath(body, lead + ref.latex);
    } else {
      body.textContent = currentCard.answer;
    }
  } else {
    body.textContent = correctList(currentCard).join(", ");
  }
  box.appendChild(body);
  return box;
}

// First miss: just "Wrong", and the question comes back at the end.
// Second miss: the answer and a short explanation.
function handleResult(right) {
  answered = true;
  const attempt = currentItem.attempt;
  const reveal = right || attempt === 2;

  byId("typedForm").classList.add("hidden");
  const check = byId("options").querySelector(".methodCheck");
  if (check) {
    check.classList.add("hidden");
  }
  lockOptions(reveal);

  if (right) {
    if (attempt === 1) {
      bumpStat(currentCard, -1);
    }
  } else if (attempt === 1) {
    bumpStat(currentCard, 2);
    session.retries.push(currentCard);
  } else {
    bumpStat(currentCard, 1);
  }

  const fb = byId("feedback");
  fb.textContent = "";
  fb.className = "feedback " + (right ? "right" : "wrong");
  const verdict = document.createElement("div");
  verdict.className = "verdict";
  verdict.textContent = right ? "Yes!" : "Wrong";
  fb.appendChild(verdict);
  if (!right && attempt === 2) {
    fb.appendChild(buildAnswerBox());
  }
  if (reveal && currentCard.explanation) {
    const p = document.createElement("p");
    p.className = "explain";
    p.textContent = currentCard.explanation;
    fb.appendChild(p);
  }
  byId("next").classList.remove("hidden");
}

function chooseOption(button, text) {
  if (answered) {
    return;
  }
  button.dataset.picked = "1";
  handleResult(text === currentCard.answer);
}

function checkMethod() {
  if (answered) {
    return;
  }
  const buttons = Array.from(byId("options").querySelectorAll(".option"));
  const picked = buttons.filter(function (b) { return b.classList.contains("selected"); });
  if (picked.length === 0) {
    return;
  }
  picked.forEach(function (b) { b.dataset.picked = "1"; });
  const values = picked.map(function (b) { return b.dataset.value; });
  const right = correctList(currentCard);
  const allRight = values.length === right.length && values.every(function (v) {
    return right.indexOf(v) !== -1;
  });
  handleResult(allRight);
}

byId("typedForm").addEventListener("submit", function (event) {
  event.preventDefault();
  if (answered || !currentCard) {
    return;
  }
  const text = byId("typedInput").value;
  if (text.trim() === "") {
    return;
  }

  if (isMath(currentCard)) {
    const ref = refFor(currentCard);
    if (ref.ok) {
      const given = TinyMath.parseAnswer(text, allowedVarsFor(currentCard));
      if (!given.ok) {
        // A typo or missing bracket doesn't count as an attempt. Show what's wrong instead.
        updatePreview();
        return;
      }
      handleResult(TinyMath.check(ref, given));
      return;
    }
  }
  handleResult(isCorrectText(currentCard, text));
});

byId("typedInput").addEventListener("input", updatePreview);

byId("infoBtn").addEventListener("click", function () {
  byId("typingHelp").classList.toggle("hidden");
});

byId("symbols").addEventListener("mousedown", function (event) {
  event.preventDefault();
});

byId("symbols").addEventListener("click", function (event) {
  const button = event.target.closest("button");
  if (!button) {
    return;
  }
  const input = byId("typedInput");
  const text = button.dataset.insert;
  const start = input.selectionStart === null ? input.value.length : input.selectionStart;
  const end = input.selectionEnd === null ? input.value.length : input.selectionEnd;
  input.value = input.value.slice(0, start) + text + input.value.slice(end);
  const pos = start + text.length;
  input.focus();
  input.setSelectionRange(pos, pos);
  updatePreview();
});

byId("next").addEventListener("click", nextItem);

byId("leave").addEventListener("click", function () {
  session = null;
  showScreen("homeScreen");
});

byId("anotherBtn").addEventListener("click", function () {
  openCourse(selectedCourse);
});

byId("backHome").addEventListener("click", function () {
  showScreen("homeScreen");
});

byId("startBtn").addEventListener("click", startSession);

[["len5", "5"], ["len15", "15"], ["len30", "30"]].forEach(function (pair) {
  byId(pair[0]).addEventListener("click", function () {
    byId("sessionLength").value = pair[1];
  });
});

// ---------- adding and importing questions ----------

function updateFormFields() {
  const type = byId("fType").value;
  byId("choiceFields").classList.toggle("hidden", type === "typed");
  byId("typedFields").classList.toggle("hidden", type !== "typed");
  byId("fAnswer").placeholder = type === "method"
    ? "Correct method(s), separated by commas"
    : "Correct answer";
}

byId("fType").addEventListener("change", updateFormFields);

function getWrongOptions() {
  return [byId("fWrong1").value, byId("fWrong2").value, byId("fWrong3").value]
    .map(function (w) { return w.trim(); })
    .filter(function (w) { return w !== ""; });
}

byId("addForm").addEventListener("submit", function (event) {
  event.preventDefault();
  const type = byId("fType").value;
  const answer = byId("fAnswer").value.trim();
  const card = {
    id: "u" + Date.now(),
    course: byId("fCourse").value.trim(),
    topic: byId("fTopic").value.trim(),
    type: type,
    question: byId("fQuestion").value.trim(),
    answer: answer,
    explanation: byId("fExplanation").value.trim()
  };

  if (type === "choice") {
    const wrong = getWrongOptions();
    if (wrong.length < 1) {
      setMessage("A multiple choice question needs at least one wrong option.");
      return;
    }
    card.options = [answer].concat(wrong);
  } else if (type === "method") {
    const answers = splitList(answer);
    const others = getWrongOptions();
    if (answers.length < 1 || others.length < 1) {
      setMessage("A spot-the-method question needs at least one correct method and one other option.");
      return;
    }
    card.answers = answers;
    card.answer = answers.join(", ");
    card.options = answers.concat(others);
  } else if (byId("fCheck").value === "math") {
    const parsed = TinyMath.parseAnswer(answer, null);
    if (!parsed.ok) {
      setMessage("I couldn't read that answer: " + parsed.error);
      return;
    }
    card.check = "math";
    const prefix = byId("fPrefix").value.trim();
    if (prefix) {
      card.prefix = prefix;
    }
  } else {
    card.accept = splitList(byId("fAccept").value);
  }

  cards.push(card);
  saveData(STORAGE_KEY, cards);
  byId("addForm").reset();
  updateFormFields();
  renderHome();
  setMessage("Question added.");
});

// Turns one item from a JSON list into a card. Returns { card } or { error }.
function buildCard(item, index) {
  if (!(item && item.course && item.topic && item.question)) {
    return { error: "missing course, topic or question" };
  }
  const type = (item.type === "choice" || item.type === "method") ? item.type : "typed";
  const card = {
    id: "u" + Date.now() + "-" + index,
    course: String(item.course).trim(),
    topic: String(item.topic).trim(),
    type: type,
    question: String(item.question).trim(),
    explanation: item.explanation ? String(item.explanation).trim() : ""
  };

  if (type === "method") {
    if (!Array.isArray(item.answers) || item.answers.length < 1) {
      return { error: 'a "method" question needs an "answers" list' };
    }
    if (!Array.isArray(item.options) || item.options.length < 2) {
      return { error: 'a "method" question needs an "options" list' };
    }
    card.answers = item.answers.map(function (a) { return String(a).trim(); });
    card.answer = card.answers.join(", ");
    card.options = item.options.map(function (o) { return String(o).trim(); });
    card.answers.forEach(function (a) {
      if (card.options.indexOf(a) === -1) {
        card.options.push(a);
      }
    });
  } else if (type === "choice") {
    if (!item.answer || !Array.isArray(item.options) || item.options.length < 2) {
      return { error: 'a "choice" question needs an "answer" and an "options" list' };
    }
    card.answer = String(item.answer).trim();
    card.options = item.options.map(function (o) { return String(o).trim(); });
    if (card.options.indexOf(card.answer) === -1) {
      card.options.push(card.answer);
    }
  } else {
    if (!item.answer) {
      return { error: "missing answer" };
    }
    card.answer = String(item.answer).trim();
    if (item.check === "math") {
      const parsed = TinyMath.parseAnswer(card.answer, null);
      if (!parsed.ok) {
        return { error: 'the maths answer "' + card.answer + '" can\'t be read (' + parsed.error + ")" };
      }
      card.check = "math";
      if (item.prefix) {
        card.prefix = String(item.prefix).trim().slice(0, 24);
      }
    } else {
      card.accept = Array.isArray(item.accept)
        ? item.accept.map(function (a) { return String(a).trim(); })
        : [];
    }
  }
  return { card: card };
}

function importFromText(text) {
  let data;
  try {
    data = JSON.parse(text);
  } catch (e) {
    setMessage("That isn't valid JSON. Check for a missing comma or quote mark.");
    return;
  }
  if (!Array.isArray(data)) {
    setMessage("Expected a list, starting with [ and ending with ].");
    return;
  }

  const seen = new Set(cards.map(cardKey));
  let added = 0;
  let skipped = 0;
  const problems = [];

  data.forEach(function (item, index) {
    const result = buildCard(item, index);
    if (result.error) {
      const name = item && item.question ? String(item.question).slice(0, 40) : "question " + (index + 1);
      problems.push('"' + name + '": ' + result.error);
      return;
    }
    const key = cardKey(result.card);
    if (seen.has(key)) {
      skipped = skipped + 1;
      return;
    }
    seen.add(key);
    cards.push(result.card);
    added = added + 1;
  });

  saveData(STORAGE_KEY, cards);
  renderHome();
  let message = "Imported " + added + " new. Skipped " + skipped + " already here. " + problems.length + " could not be read.";
  if (problems.length > 0) {
    message = message + " Problems: " + problems.slice(0, 3).join("; ");
  }
  setMessage(message);
}

byId("importBtn").addEventListener("click", function () {
  importFromText(byId("importText").value);
  byId("importText").value = "";
});

byId("importFile").addEventListener("change", function () {
  const input = byId("importFile");
  const file = input.files[0];
  if (!file) {
    return;
  }
  const reader = new FileReader();
  reader.onload = function () {
    importFromText(reader.result);
    input.value = "";
  };
  reader.readAsText(file);
});

byId("addVerseBtn").addEventListener("click", function () {
  const text = byId("verseText").value.trim();
  if (text === "") {
    return;
  }
  myVerses.push(text);
  saveData(VERSE_KEY, myVerses);
  byId("verseText").value = "";
  setVerse();
  setMessage("Verse added.");
});

byId("exportBtn").addEventListener("click", function () {
  const blob = new Blob([JSON.stringify(cards, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = "tiny-start-questions.json";
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
});

byId("resetBtn").addEventListener("click", function () {
  if (confirm("Replace all your questions with the starter questions?")) {
    cards = starterCards.slice();
    saveData(STORAGE_KEY, cards);
    renderHome();
    setMessage("Reset to the starter questions.");
  }
});

byId("resetStatsBtn").addEventListener("click", function () {
  if (confirm("Forget which questions you've been missing? Future sessions will treat every question equally.")) {
    stats = {};
    saveData(STATS_KEY, stats);
    setMessage("Done. Every question is back to equal.");
  }
});

// ---------- start ----------

if ("serviceWorker" in navigator && location.protocol.indexOf("http") === 0) {
  navigator.serviceWorker.register("sw.js").catch(function () {
    // Offline use just won't be available.
  });
}

setVerse();
updateFormFields();
renderHome();
showScreen("homeScreen");
