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

// Listar todos os registros (resumo para o Histórico)
app.get('/api/history', async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT id, date, shift, operator, created_at
       FROM production
       ORDER BY date DESC, created_at DESC`
    );
    res.json(result.rows);
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
