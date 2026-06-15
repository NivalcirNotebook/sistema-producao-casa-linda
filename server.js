const express = require('express');
const cors = require('cors');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const app = express();
const port = process.env.PORT || 3000;

app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.static(__dirname));

// Database Setup
const dbPath = process.env.DB_PATH || path.join(__dirname, 'database.sqlite');
const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error('Erro ao abrir banco de dados:', err.message);
  } else {
    console.log('Conectado ao banco de dados SQLite.');
    db.run(`CREATE TABLE IF NOT EXISTS production (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      date TEXT,
      shift TEXT,
      operator TEXT,
      data TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(date, shift)
    )`);
  }
});

// API Endpoints

// Save or Update production record
app.post('/api/save', (req, res) => {
  const { date, shift, operator, data } = req.body;
  const jsonData = JSON.stringify(data);

  const query = `
    INSERT INTO production (date, shift, operator, data)
    VALUES (?, ?, ?, ?)
    ON CONFLICT(date, shift) 
    DO UPDATE SET operator=excluded.operator, data=excluded.data, created_at=CURRENT_TIMESTAMP
  `;

  db.run(query, [date, shift, operator, jsonData], function(err) {
    if (err) {
      return res.status(500).json({ error: err.message });
    }
    res.json({ id: this.lastID, message: 'Dados salvos no banco SQLite com sucesso!' });
  });
});

// Get all history (summary)
app.get('/api/history', (req, res) => {
  db.all(`SELECT id, date, shift, operator, created_at FROM production ORDER BY date DESC, created_at DESC`, [], (err, rows) => {
    if (err) {
      return res.status(500).json({ error: err.message });
    }
    res.json(rows);
  });
});

// Get specific record data
app.get('/api/production/:date/:shift', (req, res) => {
  const { date, shift } = req.params;
  db.get(`SELECT * FROM production WHERE date = ? AND shift = ?`, [date, shift], (err, row) => {
    if (err) {
      return res.status(500).json({ error: err.message });
    }
    if (!row) return res.status(404).json({ message: 'Registro não encontrado' });
    res.json({ ...row, data: JSON.parse(row.data) });
  });
});

app.listen(port, () => {
  console.log(`Servidor rodando em http://localhost:${port}`);
});
