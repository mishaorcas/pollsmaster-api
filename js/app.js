import { processHtml } from "./html_processor.js";

const tabButtons = Array.from(document.querySelectorAll(".tab-btn"));
const tabPanels = Array.from(document.querySelectorAll(".tab-panel"));
let activeTab = "poll";

// Генератор опросов — активная вкладка по умолчанию.
document.body.classList.add("poll-theme");

const inputEl = document.getElementById("inputText");
const outputEl = document.getElementById("outputText");
const statusEl = document.getElementById("status");
const copyBtn = document.getElementById("copyBtn");
const pasteBtn = document.getElementById("pasteBtn");
const clearBtn = document.getElementById("clearBtn");

const pollInputEl = document.getElementById("pollInputText");
const pollOutputEl = document.getElementById("pollOutputText");
const pollErrorEl = document.getElementById("pollError");
const multipleChoiceToggleEl = document.getElementById("multipleChoiceToggle");
const pollCopyBtn = document.getElementById("pollCopyBtn");
const pollPasteBtn = document.getElementById("pollPasteBtn");
const pollClearBtn = document.getElementById("pollClearBtn");

const toastEl = document.getElementById("toast");

let debounceTimer = null;
let processingToken = 0;
let toastTimer = null;

function setActiveTab(tabName) {
    activeTab = tabName;
    document.body.classList.toggle("poll-theme", tabName === "poll");
    tabButtons.forEach((button) => {
        const isActive = button.dataset.tab === tabName;
        button.classList.toggle("active", isActive);
        button.setAttribute("aria-selected", String(isActive));
    });

    tabPanels.forEach((panel) => {
        const isActive = panel.dataset.panel === tabName;
        panel.classList.toggle("active", isActive);
        panel.hidden = !isActive;
    });
}

function setBusyState(isBusy) {
    if (!statusEl) {
        return;
    }
    statusEl.classList.toggle("busy", isBusy);
    statusEl.textContent = isBusy ? "Обработка..." : "";
}

function showToast(message, isError = false) {
    toastEl.textContent = message;
    toastEl.classList.toggle("error", isError);
    toastEl.classList.add("show");

    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => {
        toastEl.classList.remove("show");
    }, 2500);
}

function scheduleProcessing() {
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => {
        void processInput();
    }, 300);
}

function processInput() {
    const sourceText = inputEl.value;
    // Invalidate any in-flight (or stale) processing run.
    const token = ++processingToken;

    if (!sourceText.trim()) {
        outputEl.value = "";
        setBusyState(false);
        return;
    }

    setBusyState(true);

    // Run synchronously in a microtask so the busy spinner renders first.
    setTimeout(() => {
        if (token !== processingToken) {
            return;
        }

        try {
            const result = processHtml(sourceText);
            if (token !== processingToken) {
                return;
            }
            outputEl.value = result;
        } catch (error) {
            if (token !== processingToken) {
                return;
            }
            outputEl.value = "";
            showToast(error.message || "Не удалось обработать текст.", true);
        } finally {
            if (token === processingToken) {
                setBusyState(false);
            }
        }
    }, 0);
}

function parsePollText(text) {
    const lines = text
        .split(/\r?\n/)
        .map((line) => line.trim())
        .filter((line) => line.length > 0);

    if (lines.length === 0) {
        return null;
    }

    const [question, ...answerLines] = lines;
    if (!question) {
        throw new Error("Укажите вопрос в первой строке.");
    }

    if (answerLines.length === 0) {
        throw new Error("Добавьте варианты ответа на новых строках.");
    }

    const answers = answerLines.map((line, index) => {
        const match = line.match(/^(\S+)\s+(.+)$/u);
        if (!match) {
            throw new Error(`Строка ${index + 2}: формат должен быть "эмодзи текст ответа".`);
        }

        const answer = match[2].trim();
        if (!answer) {
            throw new Error(`Строка ${index + 2}: текст ответа не может быть пустым.`);
        }

        return {
            icon: match[1],
            answer
        };
    });

    const payload = {
        mode: "percent",
        answers,
        question,
        needLogin: true
    };

    if (multipleChoiceToggleEl.checked) {
        payload.isMultipleChoice = true;
    }

    return payload;
}

function generatePollCode() {
    const rawText = pollInputEl.value;
    pollErrorEl.textContent = "";

    if (!rawText.trim()) {
        pollOutputEl.value = "";
        return;
    }

    try {
        const payload = parsePollText(rawText);
        pollOutputEl.value = payload ? JSON.stringify(payload, null, 2) : "";
    } catch (error) {
        pollOutputEl.value = "";
        pollErrorEl.textContent = error.message || "Не удалось сгенерировать JSON.";
    }
}

async function copyResult() {
    const value = outputEl.value;
    if (!value.trim()) {
        showToast("Пока нечего копировать.", true);
        return;
    }

    try {
        await navigator.clipboard.writeText(value);
        showToast("Результат скопирован.");
    } catch {
        outputEl.select();
        document.execCommand("copy");
        showToast("Результат скопирован.");
    }
}

async function pasteInput() {
    try {
        const text = await navigator.clipboard.readText();
        inputEl.value = text;
        scheduleProcessing();
        showToast("Текст вставлен из буфера.");
    } catch {
        showToast("Не удалось прочитать буфер обмена.", true);
    }
}

function clearHtmlTab() {
    processingToken += 1;
    clearTimeout(debounceTimer);
    inputEl.value = "";
    outputEl.value = "";
    setBusyState(false);
    showToast("Поля очищены.");
}

async function copyPollResult() {
    const value = pollOutputEl.value;
    if (!value.trim()) {
        showToast("Пока нечего копировать.", true);
        return;
    }

    try {
        await navigator.clipboard.writeText(value);
        showToast("JSON скопирован.");
    } catch {
        pollOutputEl.select();
        document.execCommand("copy");
        showToast("JSON скопирован.");
    }
}

async function pastePollInput() {
    try {
        const text = await navigator.clipboard.readText();
        pollInputEl.value = text;
        generatePollCode();
        showToast("Текст опроса вставлен из буфера.");
    } catch {
        showToast("Не удалось прочитать буфер обмена.", true);
    }
}

function clearPollTab() {
    pollInputEl.value = "";
    pollOutputEl.value = "";
    pollErrorEl.textContent = "";
    multipleChoiceToggleEl.checked = false;
    showToast("Поля очищены.");
}

function clearActiveTab() {
    if (activeTab === "html") {
        clearHtmlTab();
        return;
    }
    clearPollTab();
}

tabButtons.forEach((button) => {
    button.addEventListener("click", () => {
        setActiveTab(button.dataset.tab);
    });
});

inputEl.addEventListener("input", scheduleProcessing);
pollInputEl.addEventListener("input", generatePollCode);
multipleChoiceToggleEl.addEventListener("change", generatePollCode);

document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
        clearActiveTab();
        return;
    }

    if (event.ctrlKey && event.key === "Enter") {
        if (activeTab === "html") {
            clearTimeout(debounceTimer);
            void processInput();
            return;
        }
        generatePollCode();
    }
});

copyBtn.addEventListener("click", copyResult);
pasteBtn.addEventListener("click", pasteInput);
clearBtn.addEventListener("click", clearHtmlTab);

pollCopyBtn.addEventListener("click", copyPollResult);
pollPasteBtn.addEventListener("click", pastePollInput);
pollClearBtn.addEventListener("click", clearPollTab);