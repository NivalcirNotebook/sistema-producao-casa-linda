/**
 * Funções de lógica pura para a aplicação de Lançamento de Produção.
 * Essas funções não dependem do DOM e podem ser testadas unitariamente.
 */

/**
 * Calcula e formata a duração entre dois horários (HH:mm).
 * @param {string} s - Horário de início
 * @param {string} e - Horário de fim
 * @returns {string} - Duração formatada
 */
function formatDuration(s, e) {
  if (!s || !e) return '—';
  const [sh, sm] = s.split(':').map(Number);
  const [eh, em] = e.split(':').map(Number);
  
  if (isNaN(sh) || isNaN(sm) || isNaN(eh) || isNaN(em)) return '—';

  let mins = (eh * 60 + em) - (sh * 60 + sm);
  if (mins < 0) mins += 1440; // Trata virada de dia

  const hours = Math.floor(mins / 60);
  const minutes = mins % 60;

  if (hours > 0) {
    return `${hours}h ${minutes}min`;
  }
  return `${minutes}min`;
}

/**
 * Retorna a classe CSS baseada na porcentagem de defeitos.
 * @param {string|number} pctStr - Porcentagem (ex: "4.5%")
 * @returns {string} - Nome da classe CSS
 */
function getPctClass(pctStr) {
  const v = parseFloat(pctStr);
  if (isNaN(v)) return '';
  if (v <= 4) return 'pct-ok';
  if (v <= 5) return 'pct-warn';
  return 'pct-high';
}

// Export para o Vitest (Node.js) se disponível
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { formatDuration, getPctClass };
}
