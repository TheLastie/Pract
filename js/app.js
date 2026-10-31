'use strict';

(() => {
  const categories = { edible: 'съедобный', poisonous: 'ядовитый', unknown: 'не определено' };
  const cards = document.querySelector('#cards');
  const query = document.querySelector('#query');
  const category = document.querySelector('#category');
  const sort = document.querySelector('#sort');
  const dialog = document.querySelector('#item-dialog');
  const form = document.querySelector('#item-form');
  const fields = [...form.querySelectorAll('input, select, textarea')];
  let submitted = false;
  let editingId = null;

  const state = {
    items: [],
    searchQuery: '',
    selectedCategory: 'all',
    sortBy: 'name-asc',
    apiMessage: '',
    loading: true,
    loadFailed: false
  };

  async function apiRequest(path, { method = 'GET', data, body: rawBody } = {}) {
    const options = { method, headers: {} };
    if (rawBody !== undefined) {
      options.headers['Content-Type'] = rawBody.type || 'application/octet-stream';
      options.body = rawBody;
    } else if (data !== undefined) {
      options.headers['Content-Type'] = 'application/json';
      options.body = JSON.stringify(data);
    }
    const response = await fetch(path, options);
    if (response.status === 204) return null;
    const body = await response.json().catch(() => null);
    if (!response.ok) {
      const details = Array.isArray(body?.detail)
        ? body.detail.map(error => `${error.loc?.at(-1) || 'Поле'}: ${error.msg}`).join('. ')
        : body?.detail;
      throw new Error(details || `Ошибка сервера: ${response.status}`);
    }
    return body;
  }

  function showApiError(error, action) {
    state.apiMessage = `${action}: ${error.message}`;
    render();
  }

  async function loadItems() {
    state.loading = true;
    state.apiMessage = '';
    state.loadFailed = false;
    render();
    try {
      state.items = await apiRequest('/api/mushrooms');
    } catch (error) {
      state.items = [];
      state.loadFailed = true;
      state.apiMessage = error instanceof TypeError
        ? 'Не удалось связаться с API. Запустите FastAPI и откройте сайт по адресу http://127.0.0.1:8000.'
        : `Не удалось загрузить каталог: ${error.message}`;
    } finally {
      state.loading = false;
      render();
    }
  }

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
    } else {
      figure.classList.add('field-note');
      figure.append(element('span', 'note-symbol', '❦'), element('figcaption', '', 'Полевая запись · без иллюстрации'));
    }
    for (const [index, src] of [item.photo, item.photo2].entries()) {
      if (!src) continue;
      const photo = element('img', 'photo');
      photo.src = src;
      photo.alt = `Полевой снимок${index ? ' 2' : ''}: ${item.name}`;
      photo.loading = 'lazy';
      figure.append(photo);
    }
    card.append(figure, element('h3', '', item.name));
    if (item.latin) card.append(element('p', 'latin', item.latin));
    card.append(element('p', 'desc', item.description));

    const props = element('dl', 'props');
    for (const [label, value, className] of [
      ['Семейство', item.family, ''],
      ['Сезон', item.season, ''],
      ['Съедобность', categories[item.category], item.category]
    ]) {
      const row = element('div');
      row.append(element('dt', '', label), element('dd', className, value));
      props.append(row);
    }
    card.append(props);

    const actions = element('div', 'card-actions');
    const edit = element('button', 'secondary', 'Изменить');
    edit.type = 'button';
    edit.dataset.editId = String(item.id);
    edit.setAttribute('aria-label', `Изменить: ${item.name}`);
    const remove = element('button', 'delete-button secondary', 'Удалить');
    remove.type = 'button';
    remove.dataset.deleteId = String(item.id);
    remove.setAttribute('aria-label', `Удалить: ${item.name}`);
    actions.append(edit, remove);
    card.append(actions);
    return card;
  }

  function visibleItems() {
    const needle = state.searchQuery.trim().toLocaleLowerCase('ru');
    const filtered = state.items.filter(item =>
      (state.selectedCategory === 'all' || item.category === state.selectedCategory)
      && [item.name, item.latin || '', item.description, item.family, item.season]
        .some(value => value.toLocaleLowerCase('ru').includes(needle))
    );
    // Сохранённые диагностические сообщения из пользовательских изменений.
    console.log(filtered);
    return [...filtered].sort((a, b) => {
      if (state.sortBy === 'newest') return Date.parse(b.created_at) - Date.parse(a.created_at);
      if (state.sortBy === 'oldest') return Date.parse(a.created_at) - Date.parse(b.created_at);
      const order = a.name.localeCompare(b.name, 'ru');
      return state.sortBy === 'name-desc' ? -order : order;
    });
  }

  const empty = element('div', 'empty-state');
  const emptyTitle = element('h3');
  const emptyDescription = element('p');
  const emptyAction = element('button', 'secondary');
  emptyAction.id = 'empty-action';
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
    document.querySelector('#result-count').textContent = state.loading
      ? 'Загружаем каталог…'
      : state.loadFailed
        ? 'Каталог недоступен'
        : `Показано ${items.length} из ${state.items.length}`;
    empty.hidden = state.loading || state.loadFailed || items.length > 0;
    const isEmptyAtlas = state.items.length === 0;
    emptyTitle.textContent = isEmptyAtlas ? 'В атласе пока нет записей' : 'Ничего не найдено';
    emptyDescription.textContent = isEmptyAtlas
      ? 'Добавьте первое наблюдение, чтобы начать свою коллекцию.'
      : 'Попробуйте другое название или сбросьте условия поиска.';
    emptyAction.textContent = isEmptyAtlas ? 'Добавить гриб' : 'Сбросить поиск';
    const message = document.querySelector('#api-message');
    document.querySelector('#api-error-text').textContent = state.apiMessage;
    message.hidden = !state.apiMessage;
  }

  function resetFilters() {
    state.searchQuery = '';
    state.selectedCategory = 'all';
    state.sortBy = 'name-asc';
    render();
  }

  function openDialog(item = null) {
    form.reset();
    submitted = false;
    editingId = item?.id ?? null;
    fields.forEach(field => {
      field.removeAttribute('aria-invalid');
      document.querySelector(`#${field.name}-error`).textContent = '';
    });
    const formError = document.querySelector('#form-api-error');
    formError.textContent = '';
    formError.hidden = true;
    document.querySelector('#dialog-title').textContent = item ? 'Изменить запись' : 'Добавить гриб';
    document.querySelector('#submit-item').textContent = item ? 'Сохранить изменения' : 'Добавить в атлас';
    document.querySelector('#dialog-description').textContent = 'Запишите наблюдение. Обязательные поля отмечены звёздочкой.';
    if (item) {
      for (const field of fields) field.value = item[field.name] ?? '';
    }
    dialog.showModal();
    fields[0].focus();
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
  document.querySelector('#empty-action').addEventListener('click', () => {
    if (state.items.length === 0) openDialog();
    else { resetFilters(); query.focus(); }
  });
  document.querySelector('#add-item').addEventListener('click', () => openDialog());
  document.querySelector('#retry-load').addEventListener('click', loadItems);
  document.querySelector('#close-dialog').addEventListener('click', () => dialog.close());
  document.querySelector('#cancel-dialog').addEventListener('click', () => dialog.close());

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

  form.addEventListener('submit', async event => {
    event.preventDefault();
    submitted = true;
    const valid = fields.map(validateField).every(Boolean);
    if (!valid) {
      fields.find(field => field.getAttribute('aria-invalid') === 'true').focus();
      return;
    }
    const values = Object.fromEntries(new FormData(form));
    const data = {
      name: values.name.trim(), latin: values.latin.trim() || null,
      family: values.family.trim(), season: values.season.trim(),
      category: values.category, description: values.description.trim()
    };
    const photos = [
      { slot: 1, file: form.elements.namedItem('photo_file').files[0] },
      { slot: 2, file: form.elements.namedItem('photo_file_2').files[0] }
    ].filter(photo => photo.file);
    for (const { file } of photos) {
      let message = '';
      if (file.size > 5 * 1024 * 1024) message = 'Фото должно быть не больше 5 МБ.';
      else if (!['image/jpeg', 'image/png', 'image/gif', 'image/webp'].includes(file.type)) message = 'Поддерживаются фото JPEG, PNG, GIF и WebP.';
      if (message) {
        const error = document.querySelector('#form-api-error');
        error.textContent = message;
        error.hidden = false;
        return;
      }
    }
    const editing = editingId !== null;
    const savedName = data.name;
    const path = editing ? `/api/mushrooms/${editingId}` : '/api/mushrooms';
    try {
      let savedItem = await apiRequest(path, { method: editing ? 'PATCH' : 'POST', data });
      for (const { slot, file } of photos) {
        savedItem = await apiRequest(`/api/mushrooms/${savedItem.id}/photo?slot=${slot}`, { method: 'PUT', body: file });
      }
      state.items = editing
        ? state.items.map(item => item.id === editingId ? savedItem : item)
        : [...state.items, savedItem];
      state.apiMessage = '';
      if (!editing) {
        state.searchQuery = '';
        state.selectedCategory = 'all';
        state.sortBy = 'newest';
      }
      render();
      dialog.close();
      document.querySelector('#announcement').textContent = editing
        ? `Изменена запись: ${savedName}`
        : `Добавлена запись: ${savedName}`;
    } catch (error) {
      const formError = document.querySelector('#form-api-error');
      formError.textContent = error.message;
      formError.hidden = false;
      showApiError(error, editing ? 'Не удалось изменить запись' : 'Не удалось добавить запись');
    }
  });

  // Один слушатель обслуживает карточки каталога и кнопки в них.
  cards.addEventListener('click', async event => {
    const editButton = event.target.closest('button[data-edit-id]');
    if (editButton && cards.contains(editButton)) {
      const item = state.items.find(entry => String(entry.id) === editButton.dataset.editId);
      if (item) openDialog(item);
      return;
    }
    const button = event.target.closest('button[data-delete-id]');
    if (!button || !cards.contains(button)) return;
    const item = state.items.find(entry => String(entry.id) === button.dataset.deleteId);
    if (!item) return;
    button.disabled = true;
    try {
      await apiRequest(`/api/mushrooms/${item.id}`, { method: 'DELETE' });
      const buttons = [...cards.querySelectorAll('[data-delete-id]')];
      const index = buttons.indexOf(button);
      state.items = state.items.filter(entry => entry.id !== item.id);
      state.apiMessage = '';
      render();
      const remaining = cards.querySelectorAll('[data-delete-id]');
      (remaining[Math.min(index, remaining.length - 1)] || document.querySelector('#empty-action')).focus();
      document.querySelector('#announcement').textContent = `Удалена запись: ${item.name}`;
    } catch (error) {
      button.disabled = false;
      showApiError(error, 'Не удалось удалить запись');
    }
  });

  loadItems();
})();
