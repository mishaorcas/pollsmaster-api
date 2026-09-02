# Pollsmaster — веб-версия (GitHub Pages)

Статический веб-сервис **Pollsmaster** для работы с опросами и UGC-разметкой.
Работает полностью в браузере — **без серверной части, Flask и Python**.
Поддерживается GitHub Pages.

## Возможности

- **Генератор опросов** — превращает текст (вопрос + строки «эмодзи текст») в JSON.
  - опция «чекбоксы» (`isMultipleChoice`),
  - режим `percent` и `needLogin`,
  - копирование/вставка JSON, горячие клавиши.
- **UGC верстак** — преобразование HTML-«обвеса» в целевой формат:
  - простановка `id` в `<h2>` по оглавлению `<contents>`,
  - замена `➕`/`➖` в заголовках на `<image src="plus-icon/minus-icon"/>`,
  - преобразование авторов `{Имя}(link)` в `<author>` / `<author-ugc>`,
  - оборачивание `<hl>` в `<bubble surface="positive/negative">`,
  - нормализация отступов.
- Горячие клавиши: `Ctrl+Enter` — обработать, `Esc` — очистить поля активной вкладки.

## Технологии

- Чистый HTML + CSS + vanilla JavaScript (ES modules).
- Никаких внешних зависимостей, `npm install` не требуется.
- Сборка — простой Node-скрипт, тесты — встроенный Node test runner.

## Структура

```
index.html             статическая страница
css/style.css          стили
js/app.js              клиентская логика (вкладки, опросы)
js/html_processor.js   JS-порт процессора (без зависимостей)
tests/
  html_processor.test.js        базовые JS-тесты (Node test runner)
  html_processor_utils.test.js  краевые случаи и утилиты (JS)
scripts/build.js       сборка dist/
scripts/serve.js       локальный preview-сервер (Node, без Python)
.github/workflows/deploy.yml    автодеплой на GitHub Pages
```

## Запуск локально

```bash
npm test            # прогнать JS-тесты (node:test)
npm run build       # собрать статику в dist/
npm run preview     # локальный сервер в папке dist (http://localhost:8000)
```

Или просто откройте `index.html` в браузере — зависимости не требуются.
> Нужен установленный Node.js (для тестов/сборки). Для самого сайта он не обязателен.

## Тесты

Процессор покрывается набором JS-тестов, запускаемых через `npm test`
(Node test runner):

- `tests/html_processor.test.js` — базовые сценарии `processHtml`;
- `tests/html_processor_utils.test.js` — краевые случаи и прямые проверки
  вспомогательных функций (`englishNumber`, `stripHtmlTags`,
  `assignContentIdsToHeaders`, `replaceEmojiInH2Headers`, `isProbableAuthorName`).

## Деплой на GitHub Pages

Воркфлоу `.github/workflows/deploy.yml` при каждом push в `main`:

1. запускает тесты,
2. собирает `dist/`,
3. публикует через GitHub Actions.

### Настройка один раз

1. Создайте репозиторий `pollsmaster-web` на GitHub.
2. Запушьте в него этот код (в ветку `main`).
3. **Settings → Pages → Source: GitHub Actions**.
4. Сайт появится на `https://<user>.github.io/pollsmaster-web/`.

> Примечание: GitHub Pages Actions-деплой для приватных репозиториев доступен только
> на платных тарифах. Для приватного репозитория используйте публикацию из ветки
> `gh-pages` или кастомный домен.

## Ссылки

- Оригинальное расширение: `Pollsmaster_1.0.0` (браузерное расширение, хранится отдельно).