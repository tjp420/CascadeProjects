import { escapeHtml } from '../utils.js';

/**
 * Render issue card.
 * @param {any} category
 * @returns {any}
 */
export function renderIssueCard(category) {
  const countLabel = category.count === 0 ? '0 found' : `${category.count} found`;
  const severityLabel = category.severity === 'none' ? '—' : category.severity.toUpperCase();

  const card = document.createElement('div');
  card.className = 'issue-card';
  card.setAttribute('data-severity', category.severity);
  card.setAttribute('data-category', category.id);
  card.setAttribute('role', 'button');
  card.setAttribute('tabindex', '0');

  const icon = document.createElement('div');
  icon.className = 'issue-icon';
  icon.textContent = category.icon;

  const content = document.createElement('div');
  content.className = 'issue-content';
  const title = document.createElement('div');
  title.className = 'issue-title';
  title.textContent = category.title;
  const count = document.createElement('div');
  count.className = 'issue-count';
  count.textContent = countLabel;
  content.appendChild(title);
  content.appendChild(count);

  const severity = document.createElement('div');
  severity.className = `issue-severity ${category.severity}`;
  severity.textContent = severityLabel;

  card.appendChild(icon);
  card.appendChild(content);
  card.appendChild(severity);
  return card;
}

/**
 * Render issue list.
 * @param {Array} categories
 * @param {Object} options
 * @returns {any}
 */
export function renderIssueList(categories, { onSelect } = {}) {
  const wrapper = document.createElement('div');
  wrapper.className = 'issue-list';
  categories.forEach((category) => {
    wrapper.appendChild(renderIssueCard(category));
  });

  if (onSelect) {
    wrapper.querySelectorAll('.issue-card').forEach((card) => {
/**
 * Handler.
 * @returns {any}
 */
      const handler = () => onSelect(card.dataset.category);
      card.addEventListener('click', handler);
      card.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          handler();
        }
      });
    });
  }

  return wrapper;
}
