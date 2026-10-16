'use strict';

(() => {
  const STORAGE_KEY = 'gribnoy-atlas:items:v1';
  const categories = { edible: 'съедобный', poisonous: 'ядовитый', unknown: 'не определено' };
  const cards = document.querySelector('#cards');
  const query = document.querySelector('#query');
  const category = document.querySelector('#category');
  const sort = document.querySelector('#sort');
  const dialog = document.querySelector('#item-dialog');
  const form = document.querySelector('#item-form');
  const fields = [...form.querySelectorAll('input, select, textarea')];
  let submitted = false;

  // Начальные данные берём из карточек исходной ЛР №1, затем DOM строится из state.
  const defaultItems = [...cards.querySelectorAll('.card')].map((card, index) => {
    const values = [...card.querySelectorAll('dd')];
    return {
      id: `default-${index + 1}`,
      name: card.querySelector('h3').textContent,
      latin: card.querySelector('.latin').textContent,
      description: card.querySelector('.desc').textContent,
      family: values[0].textContent,
      season: values[1].textContent,
      category: values[2].classList.contains('edible') ? 'edible' : 'poisonous',
      edibility: values[2].textContent,
      illustration: card.querySelector('img').getAttribute('src'),
      photo: card.querySelector('.photo').getAttribute('src'),
      plate: card.querySelector('figcaption').textContent,
      createdAt: index + 1
    };
  });
  const assets = new Set(defaultItems.flatMap(item => [item.illustration, item.photo]));

  const state = {
    items: [],
    searchQuery: '',
    selectedCategory: 'all',
    sortBy: 'name-asc',
    storageMessage: ''
  };

  function isStoredItem(item) {
    if (!item || typeof item !== 'object') return false;
    const limits = { id: [1, 100], name: [2, 100], latin: [0, 120], family: [2, 100], season: [3, 100], description: [10, 700] };
    return Object.entries(limits).every(([key, [min, max]]) =>
      typeof item[key] === 'string' && item[key].trim().length >= min && item[key].length <= max
    ) && Object.hasOwn(categories, item.category)
      && Number.isFinite(item.createdAt)
      && (item.illustration === undefined || assets.has(item.illustration))
      && (item.photo === undefined || assets.has(item.photo))
      && (item.plate === undefined || (typeof item.plate === 'string' && item.plate.length < 30))
      && (item.edibility === undefined || (typeof item.edibility === 'string' && item.edibility.length < 50));
  }

  function loadItems() {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored === null) return defaultItems.map(item => ({ ...item }));
      const items = JSON.parse(stored);
      if (!Array.isArray(items) || !items.every(isStoredItem)
        || new Set(items.map(item => item.id)).size !== items.length) {
        throw new Error('Invalid saved data');
      }
      return items; // Пустой массив сохраняет намеренно очищенный каталог.
    } catch {
      state.storageMessage = 'Сохранённые записи недоступны или повреждены. Показан исходный атлас. При следующем добавлении или удалении попробуем сохранить изменения.';
      return defaultItems.map(item => ({ ...item }));
    }
  }

  function saveItems() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state.items));
      state.storageMessage = '';
    } catch {
      state.storageMessage = 'Браузер не позволил сохранить изменения. Записи доступны на этой странице, но изменения могут потеряться после перезагрузки.';
    }
  }

  // Пользовательский текст никогда не интерпретируется как HTML.
  function element(tag, className, text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
  }

  function createCard(item) {
    const card = element('article', 'card');
    const figure = element('figure');
    if (item.illustration) {
      const image = element('img', 'illustration');
      image.src = item.illustration;
      image.alt = `Ботаническая таблица: ${item.name}`;
      image.loading = 'lazy';
      figure.append(image, element('figcaption', '', item.plate || 'Ботаническая таблица'));
      if (item.photo) {
        const photo = element('img', 'photo');
        photo.src = item.photo;
        photo.alt = `Полевой снимок: ${item.name}`;
        photo.loading = 'lazy';
        figure.append(photo);
      }
    } else {
      figure.classList.add('field-note');
      figure.append(element('span', 'note-symbol', '❦'), element('figcaption', '', 'Полевая запись · без иллюстрации'));
    }
    card.append(figure, element('h3', '', item.name));
    if (item.latin) card.append(element('p', 'latin', item.latin));
    card.append(element('p', 'desc', item.description));
    const props = element('dl', 'props');
    for (const [label, value, className] of [
      ['Семейство', item.family, ''],
      ['Сезон', item.season, ''],
      ['Съедобность', item.edibility || categories[item.category], item.category]
    ]) {
      const row = element('div');
      row.append(element('dt', '', label), element('dd', className, value));
      props.append(row);
    }
    const remove = element('button', 'delete-button secondary', 'Удалить');
    remove.type = 'button';
    remove.dataset.deleteId = item.id;
    remove.setAttribute('aria-label', `Удалить: ${item.name}`);
    card.append(props, remove);
    return card;
  }

  function visibleItems() {
    const needle = state.searchQuery.trim().toLocaleLowerCase('ru');
    const filtered = state.items.filter(item =>
      (state.selectedCategory === 'all' || item.category === state.selectedCategory)
      && [item.name, item.latin, item.description, item.family, item.season]
        .some(value => value.toLocaleLowerCase('ru').includes(needle))
    );
    return [...filtered].sort((a, b) => {
      if (state.sortBy === 'newest') return b.createdAt - a.createdAt;
      if (state.sortBy === 'oldest') return a.createdAt - b.createdAt;
      const order = a.name.localeCompare(b.name, 'ru');
      return state.sortBy === 'name-desc' ? -order : order;
    });
  }

  const empty = element('div', 'empty-state');
  const emptyTitle = element('h3');
  const emptyDescription = element('p');
  const emptyAction = element('button', 'secondary');
  emptyAction.type = 'button';
  empty.append(emptyTitle, emptyDescription, emptyAction);
  cards.after(empty);

  function render() {
    const items = visibleItems();
    const fragment = document.createDocumentFragment();
    items.forEach(item => fragment.append(createCard(item)));
    cards.replaceChildren(fragment);
    query.value = state.searchQuery;
    category.value = state.selectedCategory;
    sort.value = state.sortBy;
    document.querySelector('#result-count').textContent = `Показано ${items.length} из ${state.items.length}`;
    empty.hidden = items.length > 0;
    const isEmptyAtlas = state.items.length === 0;
    emptyTitle.textContent = isEmptyAtlas ? 'В атласе пока нет записей' : 'Ничего не найдено';
    emptyDescription.textContent = isEmptyAtlas
      ? 'Добавьте первое наблюдение, чтобы начать свою коллекцию.'
      : 'Попробуйте другое название или сбросьте условия поиска.';
    emptyAction.textContent = isEmptyAtlas ? 'Добавить гриб' : 'Сбросить поиск';
    const message = document.querySelector('#storage-message');
    message.textContent = state.storageMessage;
    message.hidden = !state.storageMessage;
  }

  function resetFilters() {
    state.searchQuery = '';
    state.selectedCategory = 'all';
    state.sortBy = 'name-asc';
    render();
  }

  function openDialog() {
    form.reset();
    submitted = false;
    fields.forEach(field => {
      field.removeAttribute('aria-invalid');
      document.querySelector(`#${field.name}-error`).textContent = '';
    });
    dialog.showModal(); // Нативный dialog удерживает фокус и обрабатывает Escape.
  }

  function validateField(field) {
    const validity = field.validity;
    const value = field.value.trim();
    let message = '';
    if (validity.valueMissing || (field.required && !value)) {
      message = field.tagName === 'SELECT' ? 'Выберите категорию.' : 'Заполните это поле.';
    } else if (value && (validity.tooShort || (field.minLength > 0 && value.length < field.minLength))) {
      message = `Введите не менее ${field.minLength} символов без пробелов по краям.`;
    } else if (validity.tooLong || (field.maxLength > 0 && value.length > field.maxLength)) {
      message = `Введите не более ${field.maxLength} символов.`;
    } else if (!validity.valid) {
      message = 'Проверьте значение поля.';
    }
    field.setAttribute('aria-invalid', String(Boolean(message)));
    document.querySelector(`#${field.name}-error`).textContent = message;
    return !message;
  }

  query.addEventListener('input', () => { state.searchQuery = query.value; render(); });
  category.addEventListener('change', () => { state.selectedCategory = category.value; render(); });
  sort.addEventListener('change', () => { state.sortBy = sort.value; render(); });
  document.querySelector('.search-form').addEventListener('submit', event => event.preventDefault());
  document.querySelector('#reset-filters').addEventListener('click', resetFilters);
  emptyAction.addEventListener('click', () => {
    if (state.items.length === 0) openDialog();
    else { resetFilters(); query.focus(); }
  });
  document.querySelector('#add-item').addEventListener('click', openDialog);
  document.querySelector('#close-dialog').addEventListener('click', () => dialog.close());
  document.querySelector('#cancel-dialog').addEventListener('click', () => dialog.close());
  // Выделение текста за границу окна не должно закрывать форму.
  let pointerStartedOutside = false;
  function outsideDialog(event) {
    const rect = dialog.getBoundingClientRect();
    return event.clientX < rect.left || event.clientX > rect.right
      || event.clientY < rect.top || event.clientY > rect.bottom;
  }
  dialog.addEventListener('pointerdown', event => { pointerStartedOutside = outsideDialog(event); });
  dialog.addEventListener('click', event => {
    if (event.target === dialog && pointerStartedOutside && outsideDialog(event)) dialog.close();
    pointerStartedOutside = false;
  });
  for (const eventName of ['input', 'change']) {
    form.addEventListener(eventName, event => {
      if (submitted && fields.includes(event.target)) validateField(event.target);
    });
  }
  form.addEventListener('submit', event => {
    event.preventDefault();
    submitted = true;
    const valid = fields.map(validateField).every(Boolean);
    if (!valid) {
      fields.find(field => field.getAttribute('aria-invalid') === 'true').focus();
      return;
    }
    const values = Object.fromEntries(new FormData(form));
    const item = {
      id: crypto.randomUUID(),
      name: values.name.trim(), latin: values.latin.trim(),
      family: values.family.trim(), season: values.season.trim(),
      category: values.category, description: values.description.trim(), createdAt: Date.now()
    };
    state.items = [...state.items, item];
    saveItems();
    // Снимаем фильтры, чтобы добавленная запись сразу стала видна.
    state.searchQuery = '';
    state.selectedCategory = 'all';
    state.sortBy = 'newest';
    render();
    dialog.close();
    document.querySelector('#announcement').textContent = `Добавлена запись: ${item.name}`;
  });

  // Один обработчик на весь каталог, включая новые карточки.
  cards.addEventListener('click', event => {
    const button = event.target.closest('button[data-delete-id]');
    if (!button || !cards.contains(button)) return;
    const item = state.items.find(entry => entry.id === button.dataset.deleteId);
    if (!item) return;
    const buttons = [...cards.querySelectorAll('[data-delete-id]')];
    const index = buttons.indexOf(button);
    state.items = state.items.filter(entry => entry.id !== item.id);
    saveItems();
    render();
    const remaining = cards.querySelectorAll('[data-delete-id]');
    (remaining[Math.min(index, remaining.length - 1)] || emptyAction).focus();
    document.querySelector('#announcement').textContent = `Удалена запись: ${item.name}`;
  });

  state.items = loadItems();
  render();
})();
