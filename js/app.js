/* ===== CONFIG ===== */
const DEFECT_MACHINES = ['costuraTransv', 'dobrar'];

// Registro central de OPs (aba "Lançamentos de OP"). Reaproveita as categorias/modelos do Corte.
const OP_MACHINE = {
  id: 'ops',
  name: 'Lançamentos de OP',
  categories: MACHINES.find(m => m.id === 'corte').categories
};

// Máquinas que preenchem automaticamente a partir do registro de OPs
const OP_AUTOFILL_MACHINES = ['corte', 'costuraLong', 'costuraTransv', 'dobrar', 'bordar'];

// Resolve a configuração de uma máquina, incluindo o registro de OPs
function findMachine(id) {
  return id === 'ops' ? OP_MACHINE : MACHINES.find(m => m.id === id);
}

/* ===== INIT ===== */
document.addEventListener('DOMContentLoaded', () => {
  setDefaultDate();
  buildTabs();
  buildPanels();
  loadOPRegistry();   // registro de OPs é global (independe de data/turno)
  loadFromStorage();
  setupHeaderAutoSave();
  setupChangeListeners();
});

/* ===== DATE DEFAULT ===== */
function setDefaultDate() {
  const el = document.getElementById('field-date');
  if (!el.value) el.value = new Date().toISOString().slice(0, 10);
}

/* ===== STORAGE KEY ===== */
// Registro central de OPs: chave única, independente de data e turno
const OPS_KEY = 'casalinda_ops';

function saveOPRegistry() {
  localStorage.setItem(OPS_KEY, JSON.stringify(getMachineProduction('ops')));
}

function loadOPRegistry() {
  const raw = localStorage.getItem(OPS_KEY);
  if (!raw) return;
  try {
    JSON.parse(raw).forEach(p => addProductionRow('ops', p));
  } catch (e) {
    console.error('Falha ao carregar registro de OPs:', e);
  }
  updateProdTotals('ops');
}

function storageKey() {
  const d = document.getElementById('field-date').value || 'no-date';
  const s = document.getElementById('field-shift').value || 'no-shift';
  return `casalinda_${d}_${s}`;
}

/* ===== MACHINE HELPERS ===== */
function getMachineConfig(machine) {
  const cat = machine.categories[0];
  const numFields  = cat.fields.filter(f => f !== 'cor' && f !== 'corKit');
  const artigoType = cat.fields.includes('corKit') ? 'select' : 'text';
  return { numFields, artigoType };
}

/* ===== TABS ===== */
function buildTabs() {
  const container = document.getElementById('tabs');

  const opBtn = document.createElement('button');
  opBtn.className = 'tab-btn active';
  opBtn.textContent = '🧾 Lançamentos de OP';
  opBtn.dataset.machineId = 'ops';
  opBtn.addEventListener('click', () => switchTab('ops'));
  container.appendChild(opBtn);

  MACHINES.forEach((machine) => {
    const btn = document.createElement('button');
    btn.className = 'tab-btn';
    btn.textContent = machine.name;
    btn.dataset.machineId = machine.id;
    btn.addEventListener('click', () => switchTab(machine.id));
    container.appendChild(btn);
  });

  const vgBtn = document.createElement('button');
  vgBtn.className = 'tab-btn';
  vgBtn.textContent = '📊 Visão Geral';
  vgBtn.dataset.machineId = 'visao-geral';
  vgBtn.addEventListener('click', () => { switchTab('visao-geral'); renderVisaoGeral(); });
  container.appendChild(vgBtn);

  const histBtn = document.createElement('button');
  histBtn.className = 'tab-btn';
  histBtn.textContent = '📜 Performance';
  histBtn.dataset.machineId = 'historico';
  histBtn.addEventListener('click', () => { switchTab('historico'); renderHistory(); });
  container.appendChild(histBtn);
}

function switchTab(machineId) {
  document.querySelectorAll('.tab-btn').forEach(b =>
    b.classList.toggle('active', b.dataset.machineId === machineId)
  );
  document.querySelectorAll('.machine-panel').forEach(p =>
    p.classList.toggle('active', p.dataset.machineId === machineId)
  );
}

/* ===== BUILD PANELS ===== */
function buildPanels() {
  const main = document.getElementById('main-content');

  // Painel central de Lançamentos de OP (fonte para o preenchimento automático)
  const opPanel = document.createElement('div');
  opPanel.className = 'machine-panel active';
  opPanel.dataset.machineId = 'ops';
  opPanel.innerHTML = `
    <div class="machine-title">🧾 ${OP_MACHINE.name}</div>
    <p class="op-help">Cadastre aqui as OPs do dia (categoria, modelo, cor e metragem). Nas máquinas, basta digitar o número da OP no campo <strong>OP</strong> que os dados são preenchidos automaticamente.</p>`;
  opPanel.appendChild(buildProductionSection(OP_MACHINE));
  main.appendChild(opPanel);

  MACHINES.forEach((machine) => {
    const panel = document.createElement('div');
    panel.className = 'machine-panel';
    panel.dataset.machineId = machine.id;
    panel.innerHTML = `<div class="machine-title">${machine.name}</div>`;
    panel.appendChild(buildOperatorsSection(machine.id));
    if (machine.id !== 'montagem') panel.appendChild(buildStoppageSection(machine.id));
    if (DEFECT_MACHINES.includes(machine.id)) panel.appendChild(buildDefectSection(machine.id));
    panel.appendChild(buildProductionSection(machine));
    main.appendChild(panel);
  });

  const vgPanel = document.createElement('div');
  vgPanel.className = 'machine-panel';
  vgPanel.dataset.machineId = 'visao-geral';
  vgPanel.innerHTML = `
    <div class="machine-title">📊 Visão Geral dos Lançamentos</div>
    <div id="visao-geral-content"></div>
  `;
  main.appendChild(vgPanel);

  const histPanel = document.createElement('div');
  histPanel.className = 'machine-panel';
  histPanel.dataset.machineId = 'historico';
  histPanel.innerHTML = `
    <div class="machine-title">📜 Performance de Produção</div>
    <div id="historico-content"></div>
  `;
  main.appendChild(histPanel);
}

/* ===== STOPPAGE SECTION ===== */
function buildStoppageSection(machineId) {
  const card = document.createElement('div');
  card.className = 'section-card';
  card.innerHTML = `
    <div class="section-header section-header--orange" onclick="toggleSection(this)">
      ⛔ Parada de Máquina <span class="toggle-icon">▼</span>
    </div>
    <div class="section-body">
      <div class="prod-table-wrap">
        <table class="stoppage-table">
          <thead><tr>
            <th style="width:85px">Início</th>
            <th style="width:85px">Fim</th>
            <th style="width:72px">Duração</th>
            <th>Motivo</th>
            <th>Observação</th>
            <th style="width:38px"></th>
          </tr></thead>
          <tbody id="stoppage-body-${machineId}">
            <tr class="empty-row"><td colspan="6" class="no-stoppages">Nenhuma parada registrada.</td></tr>
          </tbody>
        </table>
      </div>
      <div class="add-row-bar">
        <button class="btn btn-add" onclick="addStoppageRow('${machineId}')">+ Adicionar Parada</button>
      </div>
    </div>`;
  return card;
}

function addStoppageRow(machineId, data = {}) {
  const tbody = document.getElementById(`stoppage-body-${machineId}`);
  if (!tbody) return;
  const empty = tbody.querySelector('.empty-row');
  if (empty) empty.remove();

  const reasonOpts = STOPPAGE_REASONS.map(r =>
    `<option value="${r}"${data.reason === r ? ' selected' : ''}>${r}</option>`
  ).join('');

  const tr = document.createElement('tr');
  tr.innerHTML = `
    <td><input type="time" class="stop-start" value="${data.start || ''}" onchange="calcDuration(this)"></td>
    <td><input type="time" class="stop-end"   value="${data.end   || ''}" onchange="calcDuration(this)"></td>
    <td class="duration-cell">${data.duration || '—'}</td>
    <td><select class="stop-reason"><option value="">Selecione...</option>${reasonOpts}</select></td>
    <td><input type="text" class="stop-notes" placeholder="Observação..." value="${data.notes || ''}"></td>
    <td><button class="btn-remove" onclick="removeRow(this)">✕</button></td>`;
  tbody.appendChild(tr);
}

function calcDuration(input) {
  const tr   = input.closest('tr');
  const s    = tr.querySelector('.stop-start').value;
  const e    = tr.querySelector('.stop-end').value;
  const cell = tr.querySelector('.duration-cell');
  cell.textContent = formatDuration(s, e);
}

/* ===== OPERATORS SECTION ===== */
function buildOperatorsSection(machineId) {
  const card = document.createElement('div');
  card.className = 'section-card';

  if (machineId === 'montagem') {
    const opFields = [1,2,3,4,5,6].map(i => `
      <div class="operator-field">
        <label for="op${i}-montagem">Operador ${i}${i > 4 ? ' <span class="op-optional">(opcional)</span>' : ''}</label>
        <input type="text" id="op${i}-montagem" class="operator-input" placeholder="Nome do operador">
      </div>`).join('');
    const empFields = [1,2,3].map(i => `
      <div class="operator-field">
        <label for="emp${i}-montagem">Empacotador ${i}${i > 2 ? ' <span class="op-optional">(opcional)</span>' : ''}</label>
        <input type="text" id="emp${i}-montagem" class="operator-input" placeholder="Nome do empacotador">
      </div>`).join('');
    card.innerHTML = `
      <div class="section-header" onclick="toggleSection(this)">
        👷 Operadores e Empacotadores <span class="toggle-icon">▼</span>
      </div>
      <div class="section-body">
        <div class="vg-subsection-title" style="margin-bottom:8px">Operadores</div>
        <div class="operators-grid operators-grid--wide">${opFields}</div>
        <div class="vg-subsection-title" style="margin-top:14px;margin-bottom:8px">Empacotadores</div>
        <div class="operators-grid">${empFields}</div>
      </div>`;
  } else {
    card.innerHTML = `
      <div class="section-header" onclick="toggleSection(this)">
        👷 Operadores <span class="toggle-icon">▼</span>
      </div>
      <div class="section-body">
        <div class="operators-grid">
          <div class="operator-field">
            <label for="op1-${machineId}">Operador 1</label>
            <input type="text" id="op1-${machineId}" class="operator-input" placeholder="Nome do operador">
          </div>
          <div class="operator-field">
            <label for="op2-${machineId}">Operador 2 <span class="op-optional">(opcional)</span></label>
            <input type="text" id="op2-${machineId}" class="operator-input" placeholder="Nome do segundo operador">
          </div>
        </div>
      </div>`;
  }
  return card;
}

/* ===== DEFECT SECTION ===== */
function buildDefectSection(machineId) {
  const card = document.createElement('div');
  card.className = 'section-card';
  card.innerHTML = `
    <div class="section-header section-header--orange" onclick="toggleSection(this)">
      ⚠️ Lançamento de Defeitos <span class="toggle-icon">▼</span>
    </div>
    <div class="section-body">
      <div class="prod-table-wrap">
        <table class="stoppage-table">
          <thead><tr>
            <th style="min-width:140px">Categoria</th>
            <th style="min-width:130px">Modelo</th>
            <th style="min-width:110px">Cor</th>
            <th style="width:72px">OP</th>
            <th style="min-width:155px">Tipo de Defeito</th>
            <th style="width:88px">Quantidade</th>
            <th>Observação</th>
            <th style="width:38px"></th>
          </tr></thead>
          <tbody id="defect-body-${machineId}">
            <tr class="empty-row"><td colspan="8" class="no-stoppages">Nenhum defeito registrado.</td></tr>
          </tbody>
        </table>
      </div>
      <div class="add-row-bar">
        ${machineId === 'dobrar'
          ? `<button class="btn btn-add" onclick="importProductionToDefects('${machineId}')">📥 Pré-preencher da Produção</button>
             <button class="btn btn-add btn-add--manual" onclick="addDefectRow('${machineId}')">+ Adicionar Manualmente</button>`
          : `<button class="btn btn-add" onclick="addDefectRow('${machineId}')">+ Adicionar Defeito</button>`
        }
      </div>
      <div class="defect-summary" id="defect-summary-${machineId}"></div>
    </div>`;
  return card;
}

function buildDefectCatOptions(machineId, selectedCatId) {
  const machine = MACHINES.find(m => m.id === machineId);
  return machine.categories.map(c =>
    `<option value="${c.id}"${selectedCatId === c.id ? ' selected' : ''}>${c.label}</option>`
  ).join('');
}

function buildDefectModelOptions(machineId, catId, selectedModel) {
  const machine = MACHINES.find(m => m.id === machineId);
  let opts = '<option value="">Selecione...</option>';
  if (!catId) return opts;
  const cat = machine.categories.find(c => c.id === catId);
  if (!cat) return opts;
  cat.models.forEach(m => {
    opts += `<option value="${m}"${selectedModel === m ? ' selected' : ''}>${m}</option>`;
  });
  return opts;
}

function onDefectCatChange(select, machineId) {
  const modelSel = select.closest('tr').querySelector('.defect-modelo');
  modelSel.innerHTML = buildDefectModelOptions(machineId, select.value, '');
}

function addDefectRow(machineId, data = {}) {
  const tbody = document.getElementById(`defect-body-${machineId}`);
  const empty = tbody.querySelector('.empty-row');
  if (empty) empty.remove();

  const defOpts = DEFECT_TYPES.map(d =>
    `<option value="${d}"${data.tipo === d ? ' selected' : ''}>${d}</option>`
  ).join('');

  const catOpts  = buildDefectCatOptions(machineId, data.categoriaId);
  const modOpts  = buildDefectModelOptions(machineId, data.categoriaId, data.modelo);

  const tr = document.createElement('tr');
  tr.innerHTML = `
    <td><select class="defect-cat" onchange="onDefectCatChange(this,'${machineId}')">
      <option value="">Selecione...</option>${catOpts}
    </select></td>
    <td><select class="defect-modelo">${modOpts}</select></td>
    <td><input type="text" class="defect-artigo" placeholder="Ex: Branco" value="${data.artigo || ''}"></td>
    <td><input type="number" class="defect-op" min="0" step="1" value="${data.op || ''}" placeholder="OP"></td>
    <td><select class="defect-tipo"><option value="">Selecione...</option>${defOpts}</select></td>
    <td><input type="number" class="defect-qtd" min="0" value="${data.quantidade || ''}" placeholder="0"></td>
    <td><input type="text"   class="defect-obs" placeholder="Observação..." value="${data.observacao || ''}"></td>
    <td><button class="btn-remove" onclick="removeRow(this)">✕</button></td>`;
  tbody.appendChild(tr);
  updateDefectSummary(machineId);
}

function importProductionToDefects(machineId) {
  const prod = getMachineProduction(machineId);
  if (prod.length === 0) {
    showToast('Lance a produção primeiro para pré-preencher os defeitos.');
    return;
  }
  prod.forEach(row => {
    addDefectRow(machineId, {
      categoriaId: row.categoriaId,
      modelo:      row.modelo,
      artigo:      row.artigo,
      op:          row.op
    });
  });
}

function getMachineDefects(machineId) {
  const tbody = document.getElementById(`defect-body-${machineId}`);
  if (!tbody) return [];
  const rows = [];
  tbody.querySelectorAll('tr:not(.empty-row)').forEach(tr => {
    const catSel = tr.querySelector('.defect-cat');
    rows.push({
      categoriaId: catSel.value,
      categoria:   catSel.options[catSel.selectedIndex]?.text || '',
      modelo:      tr.querySelector('.defect-modelo').value,
      artigo:      tr.querySelector('.defect-artigo').value,
      op:          tr.querySelector('.defect-op').value,
      tipo:        tr.querySelector('.defect-tipo').value,
      quantidade:  tr.querySelector('.defect-qtd').value,
      observacao:  tr.querySelector('.defect-obs').value
    });
  });
  return rows;
}

// getPctClass is now handled by logic.js

function getMachineProductionByCategory(machineId) {
  const byCat = {};
  getMachineProduction(machineId).forEach(row => {
    const key = row.categoriaId || '_';
    if (!byCat[key]) byCat[key] = { label: row.categoria || '—', quantidade: 0 };
    byCat[key].quantidade += row.quantidade || 0;
  });
  return byCat;
}

function getMachineDefectsByCategory(machineId) {
  const byCat = {};
  getMachineDefects(machineId).forEach(d => {
    const key = d.categoriaId || '_';
    if (!byCat[key]) byCat[key] = { label: d.categoria || '—', quantidade: 0 };
    byCat[key].quantidade += parseInt(d.quantidade) || 0;
  });
  return byCat;
}

function updateDefectSummary(machineId) {
  const el = document.getElementById(`defect-summary-${machineId}`);
  if (!el) return;

  const prodByCat   = getMachineProductionByCategory(machineId);
  const defectByCat = getMachineDefectsByCategory(machineId);
  const allKeys     = new Set([...Object.keys(prodByCat), ...Object.keys(defectByCat)]);

  if (allKeys.size === 0) { el.innerHTML = ''; return; }

  let totalProdAll   = 0;
  let totalDefectAll = 0;

  const rows = [...allKeys].map(key => {
    const prodCat  = prodByCat[key];
    const defCat   = defectByCat[key];
    const label    = prodCat?.label || defCat?.label || '—';
    const prodQtd  = prodCat?.quantidade || 0;
    const defQtd   = defCat?.quantidade  || 0;
    totalProdAll   += prodQtd;
    totalDefectAll += defQtd;
    const pct    = prodQtd > 0 ? ((defQtd / prodQtd) * 100).toFixed(1) + '%' : '—';
    return `<tr>
      <td class="totals-field">${label}</td>
      <td class="totals-value">${prodQtd}</td>
      <td class="totals-value">${defQtd}</td>
      <td class="totals-value defect-pct ${getPctClass(pct)}">${pct}</td>
    </tr>`;
  }).join('');

  const grandPct = totalProdAll > 0
    ? ((totalDefectAll / totalProdAll) * 100).toFixed(1) + '%'
    : '—';

  el.innerHTML = `
    <div class="defect-summary-title">📊 Resumo de Defeitos por Categoria</div>
    <table class="totals-table">
      <thead><tr>
        <th>Categoria</th>
        <th style="text-align:right">Total Produzido</th>
        <th style="text-align:right">Total Defeitos</th>
        <th style="text-align:right">% Defeitos</th>
      </tr></thead>
      <tbody>
        ${rows}
        <tr class="totals-grand">
          <td><strong>TOTAL GERAL</strong></td>
          <td class="totals-value totals-grand-value"><strong>${totalProdAll}</strong></td>
          <td class="totals-value totals-grand-value"><strong>${totalDefectAll}</strong></td>
          <td class="totals-value defect-pct ${getPctClass(grandPct)}"><strong>${grandPct}</strong></td>
        </tr>
      </tbody>
    </table>`;
}

/* ===== PRODUCTION SECTION (dynamic table — same for all machines) ===== */
function buildProductionSection(machine) {
  const config = getMachineConfig(machine);
  const numHeaders = config.numFields.map(f =>
    `<th style="min-width:90px">${FIELD_LABELS[f]}</th>`
  ).join('');
  const hasOP   = machine.id !== 'montagem';
  const colspan = (hasOP ? 4 : 3) + config.numFields.length + 1;

  const card = document.createElement('div');
  card.className = 'section-card';
  card.innerHTML = `
    <div class="section-header" onclick="toggleSection(this)">
      📋 Lançamento de Produção <span class="toggle-icon">▼</span>
    </div>
    <div class="section-body">
      <div class="prod-table-wrap">
        <table class="stoppage-table prod-table">
          <thead><tr>
            <th style="min-width:145px">Categoria</th>
            <th style="min-width:130px">Modelo</th>
            <th style="min-width:115px">Cor</th>
            ${hasOP ? '<th style="width:72px">OP</th>' : ''}
            ${numHeaders}
            <th style="width:38px"></th>
          </tr></thead>
          <tbody id="prod-body-${machine.id}">
            <tr class="empty-row">
              <td colspan="${colspan}" class="no-stoppages">Nenhum lançamento registrado.</td>
            </tr>
          </tbody>
        </table>
      </div>
      <div class="add-row-bar">
        ${OP_AUTOFILL_MACHINES.includes(machine.id)
          ? `<button class="btn btn-add" onclick="importProductionFromOPs('${machine.id}')">📥 Puxar Lançamentos de OP</button>
             <button class="btn btn-add btn-add--manual" onclick="addProductionRow('${machine.id}')">+ Adicionar Manualmente</button>`
          : `<button class="btn btn-add" onclick="addProductionRow('${machine.id}')">+ Adicionar Lançamento</button>`
        }
      </div>
      <div class="totals-section" id="totals-${machine.id}">
        <div class="totals-section-title">📊 Total da Máquina</div>
        <span class="totals-empty">Adicione lançamentos para ver os totais.</span>
      </div>
    </div>`;
  return card;
}

function buildProdModelOptions(machine, catId, selectedModel) {
  let opts = '<option value="">Selecione...</option>';
  if (!catId) return opts;
  const cat = machine.categories.find(c => c.id === catId);
  if (!cat) return opts;
  cat.models.forEach(m => {
    opts += `<option value="${m}"${selectedModel === m ? ' selected' : ''}>${m}</option>`;
  });
  return opts;
}

function onProdCatChange(select, machineId) {
  const machine = findMachine(machineId);
  const tr = select.closest('tr');
  const modelSel = tr.querySelector('.prod-modelo');
  modelSel.innerHTML = buildProdModelOptions(machine, select.value, '');
  
  // Clear metragem if category changes
  if (machineId === 'costuraLong') {
    const metragemInput = tr.querySelector('.prod-num[data-field="metragem"]');
    if (metragemInput) metragemInput.value = '';
  }
  
  updateProdTotals(machineId);
}

/**
 * Resolve o comprimento de uma peça (m) a partir da categoria e do modelo.
 * Usa o valor específico do modelo, senão o _default da categoria.
 */
function getPieceLength(categoriaId, modelo) {
  const cat = PIECE_LENGTHS[categoriaId];
  if (!cat) return null;
  if (modelo && cat[modelo] != null) return cat[modelo];
  return cat._default != null ? cat._default : null;
}

function recalculateRowQuantidade(tr, machineId) {
  if (machineId !== 'costuraLong') return;
  const categoriaId = tr.querySelector('.prod-cat')?.value;
  const modelo = tr.querySelector('.prod-modelo').value;
  const qtdInput = tr.querySelector('.prod-num[data-field="quantidade"]');
  const metragemInput = tr.querySelector('.prod-num[data-field="metragem"]');

  if (!qtdInput || !metragemInput) return;

  const baseLength = getPieceLength(categoriaId, modelo);
  if (baseLength == null) { qtdInput.value = ''; return; }

  const metragem = parseFloat(metragemInput.value) || 0;
  if (metragem > 0) {
    qtdInput.value = Math.floor(metragem / (baseLength + 0.09));
  } else {
    qtdInput.value = '';
  }
}

function addProductionRow(machineId, data = {}) {
  const machine = findMachine(machineId);
  const config  = getMachineConfig(machine);
  const tbody   = document.getElementById(`prod-body-${machineId}`);
  const empty   = tbody.querySelector('.empty-row');
  if (empty) empty.remove();

  const catOpts = machine.categories.map(c =>
    `<option value="${c.id}"${data.categoriaId === c.id ? ' selected' : ''}>${c.label}</option>`
  ).join('');
  const modelOpts = buildProdModelOptions(machine, data.categoriaId, data.modelo);

  let artigoCell;
  if (config.artigoType === 'select') {
    artigoCell = `<td><select class="prod-artigo">
      <option value="">Selecione...</option>
      <option value="Sortido"${data.artigo === 'Sortido' ? ' selected' : ''}>Sortido</option>
      <option value="Individual"${data.artigo === 'Individual' ? ' selected' : ''}>Individual</option>
    </select></td>`;
  } else {
    artigoCell = `<td><input type="text" class="prod-artigo" placeholder="Ex: Branco" value="${data.artigo || ''}"></td>`;
  }

  const numCells = config.numFields.map(f => {
    const val  = data[f] != null ? data[f] : '';
    const step = f === 'metragem' ? '0.1' : '1';
    const isAutoCalc = machineId === 'costuraLong' && f === 'quantidade';
    const readonlyAttr = isAutoCalc ? 'readonly title="Calculado automaticamente com base na metragem"' : '';
    const styleAttr = isAutoCalc ? 'style="background:#f0f4ff;color:#4a6fa5;font-weight:600;cursor:default"' : '';
    return `<td><input type="number" class="prod-num" data-field="${f}" min="0" step="${step}" value="${val}" placeholder="${isAutoCalc ? 'Auto' : '0'}" ${readonlyAttr} ${styleAttr}></td>`;
  }).join('');

  const tr = document.createElement('tr');
  tr.innerHTML = `
    <td><select class="prod-cat" onchange="onProdCatChange(this,'${machineId}')">
      <option value="">Selecione...</option>${catOpts}
    </select></td>
    <td><select class="prod-modelo">${modelOpts}</select></td>
    ${artigoCell}
    ${machineId !== 'montagem' ? `<td><input type="number" class="prod-op" min="0" step="1" value="${data.op || ''}" placeholder="OP"></td>` : ''}
    ${numCells}
    <td><button class="btn-remove" onclick="removeRow(this)">✕</button></td>`;
  tbody.appendChild(tr);
  if (machineId === 'costuraLong') recalculateRowQuantidade(tr, 'costuraLong');
  updateProdTotals(machineId);
  if (DEFECT_MACHINES.includes(machineId)) updateDefectSummary(machineId);
}

/**
 * Puxa todas as OPs cadastradas na aba "Lançamentos de OP" (categoria, modelo,
 * artigo, OP e — quando a máquina usa — metragem/tiras) para a máquina indicada.
 */
function importProductionFromOPs(machineId) {
  const opRows = getMachineProduction('ops');
  if (opRows.length === 0) {
    showToast('Cadastre as OPs na aba "Lançamentos de OP" primeiro.');
    return;
  }
  const machine = findMachine(machineId);
  const fields  = machine.categories[0].fields;

  opRows.forEach(row => {
    const data = {
      categoriaId: row.categoriaId,
      modelo:      row.modelo,
      artigo:      row.artigo,
      op:          row.op
    };
    if (fields.includes('metragem') && row.metragem != null) data.metragem = row.metragem;
    if (fields.includes('tiras')    && row.tiras    != null) data.tiras    = row.tiras;
    addProductionRow(machineId, data);
  });

  updateProdTotals(machineId);
  if (DEFECT_MACHINES.includes(machineId)) updateDefectSummary(machineId);
  showToast(`${opRows.length} OP(s) puxada(s) do Lançamento de OP.`);
}

/**
 * Ao digitar uma OP no campo OP de uma linha, busca essa mesma OP nos
 * lançamentos da Máquina de Corte e preenche categoria, modelo, artigo
 * e (na Costura Longitudinal) a metragem, calculando a quantidade.
 */
function autoFillFromOP(input, machineId) {
  if (!OP_AUTOFILL_MACHINES.includes(machineId)) return;
  const op = String(input.value).trim();
  if (!op) return;

  const opRow = getMachineProduction('ops')
    .find(r => r.op !== '' && String(r.op).trim() === op);
  if (!opRow) return;  // OP ainda não cadastrada — não preenche

  const tr      = input.closest('tr');
  const machine = findMachine(machineId);

  const catSel = tr.querySelector('.prod-cat');
  if (opRow.categoriaId) catSel.value = opRow.categoriaId;

  const modelSel = tr.querySelector('.prod-modelo');
  modelSel.innerHTML = buildProdModelOptions(machine, catSel.value, opRow.modelo);

  const artigo = tr.querySelector('.prod-artigo');
  if (artigo && opRow.artigo != null) artigo.value = opRow.artigo;

  // Preenche os campos numéricos existentes a partir da OP
  // (exceto quantidade, que é calculada na Long. ou medida pelo operador)
  tr.querySelectorAll('.prod-num').forEach(inp => {
    const f = inp.dataset.field;
    if (f !== 'quantidade' && opRow[f] != null) inp.value = opRow[f];
  });

  if (machineId === 'costuraLong') recalculateRowQuantidade(tr, 'costuraLong');
  updateProdTotals(machineId);
  if (DEFECT_MACHINES.includes(machineId)) updateDefectSummary(machineId);
  showToast(`OP ${op} encontrada — dados preenchidos.`);
}

/**
 * Igual ao autoFillFromOP, mas para uma linha da tabela de DEFEITOS
 * (Costura Transversal e Dobrar): ao digitar a OP, preenche categoria,
 * modelo e artigo a partir do registro de OPs.
 */
function autoFillDefectFromOP(input, machineId) {
  const op = String(input.value).trim();
  if (!op) return;

  const opRow = getMachineProduction('ops')
    .find(r => r.op !== '' && String(r.op).trim() === op);
  if (!opRow) return;  // OP ainda não cadastrada — não preenche

  const tr = input.closest('tr');

  const catSel = tr.querySelector('.defect-cat');
  if (opRow.categoriaId) catSel.value = opRow.categoriaId;

  const modelSel = tr.querySelector('.defect-modelo');
  modelSel.innerHTML = buildDefectModelOptions(machineId, catSel.value, opRow.modelo);

  const artigo = tr.querySelector('.defect-artigo');
  if (artigo && opRow.artigo != null) artigo.value = opRow.artigo;

  updateDefectSummary(machineId);
  showToast(`OP ${op} encontrada — dados preenchidos.`);
}

function getMachineProduction(machineId) {
  const tbody = document.getElementById(`prod-body-${machineId}`);
  if (!tbody) return [];
  const rows = [];
  tbody.querySelectorAll('tr:not(.empty-row)').forEach(tr => {
    const catSel = tr.querySelector('.prod-cat');
    const row = {
      categoriaId: catSel.value,
      categoria:   catSel.options[catSel.selectedIndex]?.text || '',
      modelo:      tr.querySelector('.prod-modelo').value,
      artigo:      tr.querySelector('.prod-artigo')?.value || '',
      op:          tr.querySelector('.prod-op')?.value || ''
    };
    tr.querySelectorAll('.prod-num').forEach(input => {
      if (input.value !== '') row[input.dataset.field] = parseFloat(input.value) || 0;
    });
    rows.push(row);
  });
  return rows;
}

/* ===== TOTALS PER MACHINE ===== */
function updateProdTotals(machineId) {
  const el = document.getElementById(`totals-${machineId}`);
  if (!el) return;

  const machine = findMachine(machineId);
  const config  = getMachineConfig(machine);
  const prod    = getMachineProduction(machineId);

  const title = '<div class="totals-section-title">📊 Total da Máquina</div>';

  if (prod.length === 0) {
    el.innerHTML = title + '<span class="totals-empty">Adicione lançamentos para ver os totais.</span>';
    return;
  }

  // Group by category
  const byCat = {};
  prod.forEach(row => {
    const key = row.categoriaId || '_';
    if (!byCat[key]) byCat[key] = { label: row.categoria || '—', rows: [], sub: {} };
    config.numFields.forEach(f => { byCat[key].sub[f] = (byCat[key].sub[f] || 0) + (row[f] || 0); });
    byCat[key].rows.push(row);
  });

  const grand = {};
  config.numFields.forEach(f => grand[f] = 0);

  let html = title;
  Object.values(byCat).forEach(cat => {
    config.numFields.forEach(f => grand[f] += cat.sub[f] || 0);

    const headers = config.numFields.map(f =>
      `<th style="text-align:right">${FIELD_LABELS[f]}</th>`
    ).join('');

    const modelRows = cat.rows.map(row => {
      const cells = config.numFields.map(f => {
        const v   = row[f] || 0;
        const u   = f === 'metragem' ? 'm' : '';
        const val = f === 'metragem' ? v.toFixed(1) : v;
        return `<td class="totals-value">${v > 0 ? val + u : '—'}</td>`;
      }).join('');
      return `<tr>
        <td class="totals-field">${row.modelo || '—'}</td>
        <td class="artigo-cell">${row.artigo || '—'}</td>
        ${machineId !== 'montagem' ? `<td class="totals-field">${row.op || '—'}</td>` : ''}
        ${cells}
      </tr>`;
    }).join('');

    const subCells = config.numFields.map(f => {
      const u   = f === 'metragem' ? 'm' : '';
      const val = f === 'metragem' ? (cat.sub[f] || 0).toFixed(1) : (cat.sub[f] || 0);
      return `<td class="totals-value"><strong>${val}${u}</strong></td>`;
    }).join('');

    html += `<div class="totals-cat-block">
      <div class="category-label" style="font-size:.8rem;margin-bottom:6px">${cat.label}</div>
      <table class="totals-table">
        <thead><tr><th>Modelo</th><th>Cor</th>${machineId !== 'montagem' ? '<th>OP</th>' : ''}${headers}</tr></thead>
        <tbody>
          ${modelRows}
          <tr class="totals-subtotal-row">
            <td colspan="${machineId !== 'montagem' ? 3 : 2}"><strong>Subtotal ${cat.label}</strong></td>
            ${subCells}
          </tr>
        </tbody>
      </table>
    </div>`;
  });

  if (Object.keys(byCat).length > 1) {
    const grandCells = config.numFields.map(f => {
      const u   = f === 'metragem' ? 'm' : '';
      const val = f === 'metragem' ? (grand[f] || 0).toFixed(1) : (grand[f] || 0);
      return `<td class="totals-value totals-grand-value"><strong>${val}${u}</strong></td>`;
    }).join('');
    html += `<table class="totals-table totals-grand"><tbody><tr>
      <td colspan="${machineId !== 'montagem' ? 3 : 2}" class="totals-cat"><strong>TOTAL GERAL</strong></td>
      ${grandCells}
    </tr></tbody></table>`;
  }

  el.innerHTML = html;
}

/* ===== COLLAPSE TOGGLE ===== */
function toggleSection(header) {
  header.classList.toggle('collapsed');
  header.nextElementSibling.classList.toggle('collapsed');
}

/* ===== REMOVE ROW (generic) ===== */
function removeRow(btn) {
  const tr     = btn.closest('tr');
  const tbody  = tr.closest('tbody');
  const panel  = btn.closest('.machine-panel');
  const colspan = tbody.closest('table').querySelectorAll('thead th').length;
  tr.remove();
  if (!tbody.querySelector('tr:not(.empty-row)')) {
    const emptyTr = document.createElement('tr');
    emptyTr.className = 'empty-row';
    emptyTr.innerHTML = `<td colspan="${colspan}" class="no-stoppages">Nenhum registro.</td>`;
    tbody.appendChild(emptyTr);
  }
  if (panel?.dataset.machineId && panel.dataset.machineId !== 'visao-geral') {
    updateProdTotals(panel.dataset.machineId);
    if (DEFECT_MACHINES.includes(panel.dataset.machineId)) updateDefectSummary(panel.dataset.machineId);
  }
  if (panel?.dataset.machineId === 'ops') saveOPRegistry();
}

/* ===== CHANGE LISTENERS (totals auto-update) ===== */
function setupChangeListeners() {
  const main = document.getElementById('main-content');
  ['input', 'change'].forEach(evt => {
    main.addEventListener(evt, e => {
      const panel = e.target.closest('.machine-panel');
      if (!panel || panel.dataset.machineId === 'visao-geral') return;
      if (e.target.classList.contains('prod-num') ||
          e.target.classList.contains('prod-artigo') ||
          e.target.classList.contains('prod-modelo')) {
        
        if (panel.dataset.machineId === 'costuraLong') {
          recalculateRowQuantidade(e.target.closest('tr'), 'costuraLong');
        }

        updateProdTotals(panel.dataset.machineId);
        if (DEFECT_MACHINES.includes(panel.dataset.machineId)) updateDefectSummary(panel.dataset.machineId);
      }
      if (e.target.classList.contains('defect-qtd')) {
        updateDefectSummary(panel.dataset.machineId);
      }
      // Ao confirmar a OP, puxa os dados do Lançamento de OP automaticamente
      if (e.type === 'change' && e.target.classList.contains('prod-op')) {
        autoFillFromOP(e.target, panel.dataset.machineId);
      }
      if (e.type === 'change' && e.target.classList.contains('defect-op')) {
        autoFillDefectFromOP(e.target, panel.dataset.machineId);
      }
      // Mantém o registro global de OPs sempre salvo
      if (panel.dataset.machineId === 'ops') saveOPRegistry();
    });
  });
}

/* ===== VISÃO GERAL ===== */
function renderVisaoGeral() {
  const container = document.getElementById('visao-geral-content');

  // Collect all data across machines
  const allProd     = [];
  const allDefects  = [];
  const allStops    = [];

  MACHINES.forEach(machine => {
    getMachineProduction(machine.id).forEach(row =>
      allProd.push({ machineName: machine.name, machineId: machine.id, ...row })
    );
    getMachineDefects(machine.id).forEach(d =>
      allDefects.push({ machineName: machine.name, ...d })
    );
    getStoppagesData(machine.id).forEach(s =>
      allStops.push({ machineName: machine.name, ...s })
    );
  });

  container.innerHTML =
    buildVGSectionBlue('📋 Produção por Máquina', buildVGProdByMachine()) +
    buildVGSectionOrange('🎨 Produção por Cor', buildVGProdByArtigo(allProd)) +
    buildVGSectionOrange('⚠️ Lançamento de Defeitos', buildVGDefects(allDefects)) +
    buildVGSectionBlue('⛔ Paradas de Máquinas', buildVGStoppages(allStops));
}

/* --- Produção por Máquina --- */
function buildVGProdByMachine() {
  let html = '';
  MACHINES.forEach(machine => {
    const config = getMachineConfig(machine);
    const prod   = getMachineProduction(machine.id);

    let opLabel;
    if (machine.id === 'montagem') {
      const ops  = [1,2,3,4,5,6].map(i => document.getElementById(`op${i}-montagem`)?.value || '').filter(Boolean);
      const emps = [1,2,3].map(i => document.getElementById(`emp${i}-montagem`)?.value || '').filter(Boolean);
      const opsStr  = ops.length  ? 'Op: '  + ops.join(' / ')  : '';
      const empsStr = emps.length ? 'Emp: ' + emps.join(' / ') : '';
      opLabel = [opsStr, empsStr].filter(Boolean).join(' | ') || 'Não informado';
    } else {
      const op1 = document.getElementById(`op1-${machine.id}`)?.value || '';
      const op2 = document.getElementById(`op2-${machine.id}`)?.value || '';
      opLabel = [op1, op2].filter(Boolean).join(' / ') || 'Não informado';
    }

    html += `<div class="vg-submachine">
      <div class="vg-submachine-title">${machine.name}</div>
      <div class="vg-operators">👷 <strong>Operadores:</strong> ${opLabel}</div>`;

    if (prod.length > 0) {
      const headers = config.numFields.map(f =>
        `<th style="text-align:right">${FIELD_LABELS[f]}</th>`
      ).join('');

      const grand = {};
      config.numFields.forEach(f => grand[f] = 0);

      const rows = prod.map(row => {
        const cells = config.numFields.map(f => {
          const v = row[f] || 0;
          grand[f] += v;
          const u = f === 'metragem' ? 'm' : '';
          return `<td class="totals-value">${v > 0 ? (f === 'metragem' ? v.toFixed(1) : v) + u : '—'}</td>`;
        }).join('');
        return `<tr>
          <td class="totals-field">${row.categoria || '—'}</td>
          <td class="totals-field">${row.modelo || '—'}</td>
          <td class="artigo-cell">${row.artigo || '—'}</td>
          ${machine.id !== 'montagem' ? `<td class="totals-field">${row.op || '—'}</td>` : ''}
          ${cells}
        </tr>`;
      }).join('');

      const grandCells = config.numFields.map(f => {
        const u = f === 'metragem' ? 'm' : '';
        return `<td class="totals-value totals-grand-value"><strong>${f === 'metragem' ? grand[f].toFixed(1) : grand[f]}${u}</strong></td>`;
      }).join('');

      html += `<table class="totals-table">
        <thead><tr><th>Categoria</th><th>Modelo</th><th>Cor</th>${machine.id !== 'montagem' ? '<th>OP</th>' : ''}${headers}</tr></thead>
        <tbody>
          ${rows}
          <tr class="totals-subtotal-row">
            <td colspan="${machine.id !== 'montagem' ? 4 : 3}"><strong>Total ${machine.name}</strong></td>
            ${grandCells}
          </tr>
        </tbody>
      </table>`;
    } else {
      html += '<span class="vg-no-data">Nenhum lançamento registrado.</span>';
    }

    html += '</div>';
  });
  return html;
}

/* --- Produção por Artigo --- */
function buildVGProdByArtigo(allProd) {
  if (allProd.length === 0) return '<span class="vg-no-data">Nenhuma produção lançada.</span>';

  const byArtigo = {};
  allProd.forEach(row => {
    const artigo = row.artigo || '(Sem cor)';
    if (!byArtigo[artigo]) byArtigo[artigo] = { lançamentos: 0, quantidade: 0, metragem: 0, tiras: 0 };
    byArtigo[artigo].lançamentos++;
    if (row.quantidade) byArtigo[artigo].quantidade += row.quantidade;
    if (row.metragem)   byArtigo[artigo].metragem   += row.metragem;
    if (row.tiras)      byArtigo[artigo].tiras       += row.tiras;
  });

  const rows = Object.entries(byArtigo).map(([artigo, t]) => {
    let values = [];
    if (t.tiras > 0)      values.push(`${t.tiras} tiras`);
    if (t.metragem > 0)   values.push(`${t.metragem.toFixed(1)} m`);
    if (t.quantidade > 0) values.push(`${t.quantidade} un`);
    return `<tr>
      <td class="totals-field" style="font-weight:700">${artigo}</td>
      <td class="totals-value">${t.lançamentos}</td>
      <td class="artigo-cell">${values.join(' · ') || '—'}</td>
    </tr>`;
  }).join('');

  return `<table class="totals-table">
    <thead><tr><th>Cor</th><th style="text-align:right">Lançamentos</th><th>Totais</th></tr></thead>
    <tbody>${rows}</tbody>
  </table>`;
}

/* --- Defeitos --- */
function buildVGDefects(allDefects) {
  let grandTotalProd = 0;
  let grandTotalDef  = 0;
  let perCatRows     = '';

  DEFECT_MACHINES.forEach(machineId => {
    const machine     = MACHINES.find(m => m.id === machineId);
    const prodByCat   = getMachineProductionByCategory(machineId);
    const defectByCat = getMachineDefectsByCategory(machineId);
    const allKeys     = new Set([...Object.keys(prodByCat), ...Object.keys(defectByCat)]);
    if (allKeys.size === 0) return;

    let machineProd = 0;
    let machineDef  = 0;
    const catRows   = [];

    allKeys.forEach(key => {
      const prodCat = prodByCat[key];
      const defCat  = defectByCat[key];
      const label   = prodCat?.label || defCat?.label || '—';
      const pQtd    = prodCat?.quantidade || 0;
      const dQtd    = defCat?.quantidade  || 0;
      machineProd  += pQtd;
      machineDef   += dQtd;
      const pct     = pQtd > 0 ? ((dQtd / pQtd) * 100).toFixed(1) + '%' : '—';
      catRows.push(`<tr>
        <td class="totals-field" style="padding-left:20px">${label}</td>
        <td class="totals-value">${pQtd}</td>
        <td class="totals-value">${dQtd}</td>
        <td class="totals-value defect-pct ${getPctClass(pct)}">${pct}</td>
      </tr>`);
    });

    grandTotalProd += machineProd;
    grandTotalDef  += machineDef;
    const machinePct = machineProd > 0 ? ((machineDef / machineProd) * 100).toFixed(1) + '%' : '—';

    perCatRows += `<tr class="totals-subtotal-row">
      <td><strong>${machine?.name || machineId}</strong></td>
      <td class="totals-value"><strong>${machineProd}</strong></td>
      <td class="totals-value"><strong>${machineDef}</strong></td>
      <td class="totals-value defect-pct ${getPctClass(machinePct)}"><strong>${machinePct}</strong></td>
    </tr>`;
    perCatRows += catRows.join('');
  });

  if (grandTotalProd === 0 && allDefects.length === 0) {
    return '<span class="vg-no-data">Nenhum defeito registrado.</span>';
  }

  const grandPct = grandTotalProd > 0
    ? ((grandTotalDef / grandTotalProd) * 100).toFixed(1) + '%'
    : '—';

  // Group by type
  const byType = {};
  allDefects.forEach(d => {
    const t = d.tipo || '—';
    byType[t] = (byType[t] || 0) + (parseInt(d.quantidade) || 0);
  });
  const typeRows = Object.entries(byType).map(([tipo, qtd]) =>
    `<tr><td class="totals-field">${tipo}</td><td class="totals-value"><strong>${qtd}</strong></td></tr>`
  ).join('');

  const detailRows = allDefects.map(d => `<tr>
    <td class="totals-field">${d.machineName}</td>
    <td class="totals-field">${d.categoria || '—'}</td>
    <td class="totals-field">${d.modelo || '—'}</td>
    <td class="artigo-cell">${d.artigo || '—'}</td>
    <td class="totals-field">${d.op || '—'}</td>
    <td class="totals-field">${d.tipo || '—'}</td>
    <td class="totals-value">${d.quantidade || 0}</td>
    <td style="font-size:.8rem;color:var(--gray-700)">${d.observacao || ''}</td>
  </tr>`).join('');

  return `
    <div class="vg-subsection-title">Resumo por Máquina e Categoria</div>
    <table class="totals-table" style="margin-bottom:14px">
      <thead><tr>
        <th>Máquina / Categoria</th>
        <th style="text-align:right">Total Produzido</th>
        <th style="text-align:right">Total Defeitos</th>
        <th style="text-align:right">% Defeitos</th>
      </tr></thead>
      <tbody>
        ${perCatRows}
        <tr class="totals-grand">
          <td><strong>TOTAL GERAL</strong></td>
          <td class="totals-value totals-grand-value"><strong>${grandTotalProd}</strong></td>
          <td class="totals-value totals-grand-value"><strong>${grandTotalDef}</strong></td>
          <td class="totals-value defect-pct ${getPctClass(grandPct)}"><strong>${grandPct}</strong></td>
        </tr>
      </tbody>
    </table>
    ${allDefects.length > 0 ? `
    <div class="vg-subsection-title">Resumo por Tipo de Defeito</div>
    <table class="totals-table" style="margin-bottom:14px">
      <thead><tr><th>Tipo de Defeito</th><th style="text-align:right">Total</th></tr></thead>
      <tbody>
        ${typeRows}
        <tr class="totals-subtotal-row">
          <td><strong>Total Geral de Defeitos</strong></td>
          <td class="totals-value totals-grand-value"><strong>${grandTotalDef}</strong></td>
        </tr>
      </tbody>
    </table>
    <div class="vg-subsection-title">Detalhes por Lançamento</div>
    <table class="totals-table">
      <thead><tr><th>Máquina</th><th>Categoria</th><th>Modelo</th><th>Cor</th><th>OP</th><th>Tipo</th><th style="text-align:right">Qtd</th><th>Observação</th></tr></thead>
      <tbody>${detailRows}</tbody>
    </table>` : ''}`;
}

/* --- Paradas --- */
function buildVGStoppages(allStops) {
  if (allStops.length === 0) return '<span class="vg-no-data">Nenhuma parada registrada.</span>';

  // Summary by reason
  const byReason = {};
  allStops.forEach(s => {
    const r = s.reason || '—';
    if (!byReason[r]) byReason[r] = { count: 0 };
    byReason[r].count++;
  });

  const summaryRows = Object.entries(byReason).map(([reason, t]) =>
    `<tr><td class="totals-field">${reason}</td><td class="totals-value"><strong>${t.count} vez(es)</strong></td></tr>`
  ).join('');

  const detailRows = allStops.map(s => `<tr>
    <td class="totals-field">${s.machineName}</td>
    <td>${s.start || '—'}</td>
    <td>${s.end   || '—'}</td>
    <td class="totals-value">${s.duration}</td>
    <td>${s.reason}</td>
    <td style="font-size:.8rem;color:var(--gray-700)">${s.notes || ''}</td>
  </tr>`).join('');

  return `
    <div class="vg-subsection-title">Resumo por Motivo</div>
    <table class="totals-table" style="margin-bottom:14px">
      <thead><tr><th>Motivo</th><th style="text-align:right">Ocorrências</th></tr></thead>
      <tbody>${summaryRows}</tbody>
    </table>
    <div class="vg-subsection-title">Detalhes por Parada</div>
    <table class="totals-table">
      <thead><tr><th>Máquina</th><th>Início</th><th>Fim</th><th>Duração</th><th>Motivo</th><th>Observação</th></tr></thead>
      <tbody>${detailRows}</tbody>
    </table>`;
}

/* --- VG section builders --- */
function buildVGSectionBlue(title, content) {
  return `<div class="section-card" style="margin-bottom:16px">
    <div class="section-header" onclick="toggleSection(this)">${title} <span class="toggle-icon">▼</span></div>
    <div class="section-body">${content}</div>
  </div>`;
}
function buildVGSectionOrange(title, content) {
  return `<div class="section-card" style="margin-bottom:16px">
    <div class="section-header section-header--orange" onclick="toggleSection(this)">${title} <span class="toggle-icon">▼</span></div>
    <div class="section-body">${content}</div>
  </div>`;
}

/* ===== SAVE / LOAD ===== */
function saveToStorage() {
  const data = {
    operator: document.getElementById('field-operator').value,
    date:     document.getElementById('field-date').value,
    shift:    document.getElementById('field-shift').value,
    machines: {}
  };

  MACHINES.forEach(machine => {
    const stoppages = [];
    document.getElementById(`stoppage-body-${machine.id}`)
      ?.querySelectorAll('tr:not(.empty-row)')
      .forEach(tr => stoppages.push({
        start:    tr.querySelector('.stop-start').value,
        end:      tr.querySelector('.stop-end').value,
        duration: tr.querySelector('.duration-cell').textContent,
        reason:   tr.querySelector('.stop-reason').value,
        notes:    tr.querySelector('.stop-notes').value
      }));

    let operators;
    if (machine.id === 'montagem') {
      operators = {};
      [1,2,3,4,5,6].forEach(i => { operators[`op${i}`]  = document.getElementById(`op${i}-montagem`)?.value  || ''; });
      [1,2,3].forEach(i =>        { operators[`emp${i}`] = document.getElementById(`emp${i}-montagem`)?.value || ''; });
    } else {
      operators = {
        op1: document.getElementById(`op1-${machine.id}`)?.value || '',
        op2: document.getElementById(`op2-${machine.id}`)?.value || ''
      };
    }
    data.machines[machine.id] = {
      stoppages,
      production: getMachineProduction(machine.id),
      defects:    DEFECT_MACHINES.includes(machine.id) ? getMachineDefects(machine.id) : [],
      operators
    };
  });

  localStorage.setItem(storageKey(), JSON.stringify(data));
  saveOPRegistry();   // registro de OPs persiste em chave global
  showToast('Dados salvos no navegador!');

  // Sync with DB
  syncWithDB({
    date: data.date,
    shift: data.shift,
    operator: data.operator,
    data: data
  });
}

function syncWithDB(payload) {
  fetch('/api/save', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  }).then(r => r.json())
    .then(() => console.log('Sincronizado com Banco de Dados'))
    .catch(e => console.error('Erro ao sincronizar com DB:', e));
}

function loadFromStorage() {
  const raw = localStorage.getItem(storageKey());
  if (!raw) return;
  const data = JSON.parse(raw);

  if (data.operator) document.getElementById('field-operator').value = data.operator;
  if (data.date)     document.getElementById('field-date').value     = data.date;
  if (data.shift)    document.getElementById('field-shift').value    = data.shift;

  if (!data.machines) return;

  MACHINES.forEach(machine => {
    const mData = data.machines[machine.id];
    if (!mData) return;
    if (mData.operators) {
      if (machine.id === 'montagem') {
        [1,2,3,4,5,6].forEach(i => {
          const el = document.getElementById(`op${i}-montagem`);
          if (el) el.value = mData.operators[`op${i}`] || '';
        });
        [1,2,3].forEach(i => {
          const el = document.getElementById(`emp${i}-montagem`);
          if (el) el.value = mData.operators[`emp${i}`] || '';
        });
      } else {
        const el1 = document.getElementById(`op1-${machine.id}`);
        const el2 = document.getElementById(`op2-${machine.id}`);
        if (el1) el1.value = mData.operators.op1 || '';
        if (el2) el2.value = mData.operators.op2 || '';
      }
    }
    (mData.stoppages  || []).forEach(s => addStoppageRow(machine.id, s));
    (mData.defects    || []).forEach(d => addDefectRow(machine.id, d));
    (mData.production || []).forEach(p => addProductionRow(machine.id, p));
  });

  MACHINES.forEach(m => updateProdTotals(m.id));
  DEFECT_MACHINES.forEach(id => updateDefectSummary(id));
}

function clearAll() {
  if (!confirm('Limpar todos os dados? Esta ação não pode ser desfeita.')) return;
  localStorage.removeItem(storageKey());
  location.reload();
}

/* ===== HEADER AUTO-RELOAD ON DATE/SHIFT CHANGE ===== */
function setupHeaderAutoSave() {
  ['field-date', 'field-shift'].forEach(id => {
    document.getElementById(id).addEventListener('change', loadFromStorage);
  });
}

/* ===== PRINT ===== */
function printReport() {
  saveToStorage();
  window.print();
}

/* ===== HELPERS ===== */
function getStoppagesData(machineId) {
  const tbody = document.getElementById(`stoppage-body-${machineId}`);
  const rows  = [];
  if (!tbody) return rows;
  tbody.querySelectorAll('tr:not(.empty-row)').forEach(tr => {
    rows.push({
      start:    tr.querySelector('.stop-start').value,
      end:      tr.querySelector('.stop-end').value,
      duration: tr.querySelector('.duration-cell').textContent,
      reason:   tr.querySelector('.stop-reason').value || '—',
      notes:    tr.querySelector('.stop-notes').value
    });
  });
  return rows;
}

function showToast(msg) {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.classList.add('show');
  setTimeout(() => t.classList.remove('show'), 2500);
}

function slugify(str) {
  return str.toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '');
}

/* ===== HISTORY & MIGRATION ===== */
async function renderHistory() {
  const container = document.getElementById('historico-content');
  container.innerHTML = '<div class="vg-no-data">Carregando histórico...</div>';

  try {
    const rows = await fetch('/api/history').then(r => r.json());

    if (rows.length === 0) {
      container.innerHTML = `
        <div style="margin-bottom:12px">
          <button class="btn btn-add" onclick="migrateLocalStorageToDB()">📥 Importar do Navegador</button>
        </div>
        <div class="vg-no-data">Nenhum lançamento encontrado no banco de dados.</div>`;
      return;
    }

    // Busca o dado completo de cada registro
    const fullRecords = await Promise.all(rows.map(async r => {
      try {
        const full = await fetch(`/api/production/${r.date}/${encodeURIComponent(r.shift)}`).then(res => res.json());
        return { ...r, machines: full.data?.machines || {} };
      } catch { return { ...r, machines: {} }; }
    }));

    // Agrega totais por máquina em todos os registros
    const machineAgg = {};
    MACHINES.forEach(m => { machineAgg[m.id] = { name: m.name, producao: 0, defeitos: 0, turnos: 0 }; });

    fullRecords.forEach(rec => {
      MACHINES.forEach(m => {
        const md = rec.machines[m.id];
        if (!md) return;
        const prodTotal = (md.production || []).reduce((s, p) => s + (p.quantidade || 0), 0);
        const defTotal  = (md.defects   || []).reduce((s, d) => s + (parseInt(d.quantidade) || 0), 0);
        if (prodTotal > 0 || defTotal > 0) machineAgg[m.id].turnos++;
        machineAgg[m.id].producao  += prodTotal;
        machineAgg[m.id].defeitos  += defTotal;
      });
    });

    // Bloco de resumo geral por máquina
    const aggRows = MACHINES.map(m => {
      const a   = machineAgg[m.id];
      const pct = a.producao > 0 ? ((a.defeitos / a.producao) * 100).toFixed(1) + '%' : '—';
      return `<tr>
        <td class="totals-field">${a.name}</td>
        <td class="totals-value">${a.producao > 0 ? a.producao : '—'}</td>
        <td class="totals-value">${a.defeitos > 0 ? a.defeitos : '—'}</td>
        <td class="totals-value defect-pct ${getPctClass(pct)}">${pct}</td>
        <td class="totals-value" style="color:var(--gray-400);font-size:.8rem">${a.turnos} turno(s)</td>
      </tr>`;
    }).join('');

    // Tabela por turno com produção de cada máquina
    const machineHeaders = MACHINES.map(m =>
      `<th style="text-align:right;font-size:.75rem">${m.name.replace('Máquina de ','').replace('Mesa de ','Mesa ')}</th>`
    ).join('');

    const recordRows = fullRecords.map(rec => {
      const d = new Date(rec.date + 'T12:00:00').toLocaleDateString('pt-BR');
      const machineCells = MACHINES.map(m => {
        const md  = rec.machines[m.id];
        const qtd = (md?.production || []).reduce((s, p) => s + (p.quantidade || 0), 0);
        return `<td class="totals-value">${qtd > 0 ? qtd : '—'}</td>`;
      }).join('');
      return `<tr>
        <td class="totals-field"><strong>${d}</strong></td>
        <td class="totals-field">${rec.shift}</td>
        <td class="totals-field" style="color:var(--gray-400);font-size:.82rem">${rec.operator || '—'}</td>
        ${machineCells}
        <td><button class="btn btn-add" style="padding:3px 9px;font-size:.75rem" onclick="viewHistoryItem('${rec.date}','${rec.shift}')">Abrir</button></td>
      </tr>`;
    }).join('');

    container.innerHTML = `
      <div style="margin-bottom:14px;display:flex;justify-content:space-between;align-items:center">
        <button class="btn btn-add" onclick="migrateLocalStorageToDB()">📥 Importar do Navegador</button>
      </div>

      <div class="hist-block">
        <div class="vg-subsection-title">📊 Performance Acumulada por Máquina</div>
        <div class="prod-table-wrap">
          <table class="totals-table">
            <thead><tr>
              <th>Máquina</th>
              <th style="text-align:right">Total Produzido</th>
              <th style="text-align:right">Total Defeitos</th>
              <th style="text-align:right">% Defeitos</th>
              <th style="text-align:right">Registros</th>
            </tr></thead>
            <tbody>${aggRows}</tbody>
          </table>
        </div>
      </div>

      <div class="hist-block" style="margin-top:20px">
        <div class="vg-subsection-title">📋 Produção por Turno</div>
        <div class="prod-table-wrap">
          <table class="totals-table">
            <thead><tr>
              <th>Data</th><th>Turno</th><th>Líder</th>
              ${machineHeaders}
              <th style="width:60px"></th>
            </tr></thead>
            <tbody>${recordRows}</tbody>
          </table>
        </div>
      </div>`;

  } catch (err) {
    container.innerHTML = `<div class="vg-no-data" style="color:var(--red)">Erro ao conectar com o servidor. Certifique-se que o banco de dados está rodando.</div>`;
  }
}

function viewHistoryItem(date, shift) {
  document.getElementById('field-date').value = date;
  document.getElementById('field-shift').value = shift;
  loadFromStorage();
  switchTab(MACHINES[0].id);
  showToast(`Carregado: ${date} - ${shift}`);
}

async function migrateLocalStorageToDB() {
  const keys = Object.keys(localStorage).filter(k => k.startsWith('casalinda_'));
  if (keys.length === 0) {
    showToast('Nada para importar.');
    return;
  }

  showToast(`Importando ${keys.length} registros...`);
  
  for (const k of keys) {
    try {
      const data = JSON.parse(localStorage.getItem(k));
      if (!data.date || !data.shift) continue;
      
      await fetch('/api/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          date: data.date,
          shift: data.shift,
          operator: data.operator,
          data: data
        })
      });
    } catch (e) {
      console.error('Falha ao migrar:', k, e);
    }
  }
  showToast('Importação concluída!');
  renderHistory();
}
