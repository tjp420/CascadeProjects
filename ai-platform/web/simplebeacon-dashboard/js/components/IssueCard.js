import { escapeHtml } from '../utils.js';

export function renderIssueCard(category) {
  const countLabel = category.count === 0 ? '0 found' : `${category.count} found`;
  const severityLabel = category.severity === 'none' ? '—' : category.severity.toUpperCase();

  return `
    <div class="issue-card" data-severity="${category.severity}" data-category="${category.id}" role="button" tabindex="0">
      <div class="issue-icon">${category.icon}</div>
      <div class="issue-content">
        <div class="issue-title">${escapeHtml(category.title)}</div>
        <div class="issue-count">${countLabel}</div>
      </div>
      <div class="issue-severity ${category.severity}">${severityLabel}</div>
    </div>
  `;
}

export function renderIssueList(categories, { onSelect } = {}) {
  const html = categories.map(renderIssueCard).join('');
  const wrapper = document.createElement('div');
  wrapper.className = 'issue-list';
  wrapper.innerHTML = html;

  if (onSelect) {
    wrapper.querySelectorAll('.issue-card').forEach((card) => {
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
