const express = require('express');
const cors    = require('cors');
const { Pool } = require('pg');
const path    = require('path');

const app  = express();
const port = process.env.PORT || 3000;

app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.static(__dirname));

// Conexão com PostgreSQL via variável DATABASE_URL (provida pelo Render)
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL ? { rejectUnauthorized: false } : false
});

// Cria a tabela se não existir
pool.query(`
  CREATE TABLE IF NOT EXISTS production (
    id         SERIAL PRIMARY KEY,
    date       TEXT,
    shift      TEXT,
    operator   TEXT,
    data       TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(date, shift)
  )
`).then(() => console.log('Banco de dados pronto.'))
  .catch(err => console.error('Erro ao inicializar banco:', err.message));

// ===== ENDPOINTS =====

// Salvar ou atualizar lançamento
app.post('/api/save', async (req, res) => {
  const { date, shift, operator, data } = req.body;
  try {
    await pool.query(`
      INSERT INTO production (date, shift, operator, data)
      VALUES ($1, $2, $3, $4)
      ON CONFLICT(date, shift)
      DO UPDATE SET operator = EXCLUDED.operator,
                    data     = EXCLUDED.data,
                    created_at = CURRENT_TIMESTAMP
    `, [date, shift, operator, JSON.stringify(data)]);
    res.json({ message: 'Dados salvos com sucesso!' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Listar todos os registros (resumo para o Histórico — exclui registros globais)
app.get('/api/history', async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT id, date, shift, operator, created_at
       FROM production
       WHERE date != 'GLOBAL'
       ORDER BY date DESC, created_at DESC`
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Buscar absenteísmo global
app.get('/api/absences', async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT data FROM production WHERE date = 'GLOBAL' AND shift = 'ABSENCES'`
    );
    if (result.rows.length === 0) return res.json({ employees: [], records: {} });
    res.json(JSON.parse(result.rows[0].data));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Salvar absenteísmo global
app.post('/api/absences', async (req, res) => {
  try {
    await pool.query(`
      INSERT INTO production (date, shift, operator, data)
      VALUES ('GLOBAL', 'ABSENCES', '', $1)
      ON CONFLICT(date, shift)
      DO UPDATE SET data = EXCLUDED.data, created_at = CURRENT_TIMESTAMP
    `, [JSON.stringify(req.body)]);
    res.json({ message: 'Absenteísmo salvo.' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Buscar registro de OPs global
app.get('/api/ops', async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT data FROM production WHERE date = 'GLOBAL' AND shift = 'OPS'`
    );
    if (result.rows.length === 0) return res.json([]);
    res.json(JSON.parse(result.rows[0].data));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Salvar registro de OPs global
app.post('/api/ops', async (req, res) => {
  try {
    await pool.query(`
      INSERT INTO production (date, shift, operator, data)
      VALUES ('GLOBAL', 'OPS', '', $1)
      ON CONFLICT(date, shift)
      DO UPDATE SET data = EXCLUDED.data, created_at = CURRENT_TIMESTAMP
    `, [JSON.stringify(req.body)]);
    res.json({ message: 'OPs salvas.' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Buscar registro completo por data e turno
app.get('/api/production/:date/:shift', async (req, res) => {
  const { date, shift } = req.params;
  try {
    const result = await pool.query(
      `SELECT * FROM production WHERE date = $1 AND shift = $2`,
      [date, decodeURIComponent(shift)]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Registro não encontrado' });
    }
    const row = result.rows[0];
    res.json({ ...row, data: JSON.parse(row.data) });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.listen(port, () => {
  console.log(`Servidor rodando na porta ${port}`);
});
