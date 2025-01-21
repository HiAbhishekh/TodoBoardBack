// server.js
const express = require('express');
const mysql = require('mysql2/promise');
const cors = require('cors');
const { v4: uuidv4 } = require('uuid');
require('dotenv').config();

const app = express();

// Middleware
app.use(cors());
app.use(express.json());

// Database connection configuration
const pool = mysql.createPool({
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || 'abhi123JBL@',
  database: process.env.DB_NAME || 'todo_db',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
});

// API Endpoints
// Ensure the default board "MyBoard" exists
const createDefaultBoardIfNotExists = async () => {
  try {
    const [existingDefaultBoard] = await pool.query('SELECT * FROM boards WHERE title = "MyBoard"');
    if (existingDefaultBoard.length === 0) {
      const id = uuidv4(); // Generate a unique ID if required
      await pool.query('INSERT INTO boards (id, title) VALUES (?, ?)', [id, 'MyBoard']);
      console.log('Default board "MyBoard" created.');
    } else {
      console.log('Default board "MyBoard" already exists.');
    }
  } catch (error) {
    console.error('Error ensuring default board:', error);
  }
};

// Call this function when the server starts
createDefaultBoardIfNotExists();

// Get all boards
app.get('/api/boards', async (req, res) => {
  try {
    const [boards] = await pool.query('SELECT * FROM boards ORDER BY created_at DESC');
    
    // Get cards for each board
    for (let board of boards) {
      const [cards] = await pool.query('SELECT * FROM cards WHERE board_id = ?', [board.id]);
      
      // Get items for each card
      for (let card of cards) {
        const [items] = await pool.query('SELECT * FROM items WHERE card_id = ?', [card.id]);
        card.items = items;
      }
      
      board.cards = cards;
    }
    
    res.json(boards);
  } catch (error) {
    console.error('Error fetching boards:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Create new board
app.post('/api/boards', async (req, res) => {
    try {
      const { title } = req.body;
      const id = uuidv4();
  
      await pool.query('INSERT INTO boards (id, title) VALUES (?, ?)', [id, title]);
      const [board] = await pool.query('SELECT * FROM boards WHERE id = ?', [id]);
  
      res.status(201).json(board[0]);
    } catch (error) {
      console.error('Error creating board:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  });
  

// Delete board
app.delete('/api/boards/:id', async (req, res) => {
  try {
    await pool.query('DELETE FROM boards WHERE id = ?', [req.params.id]);
    res.status(204).send();
  } catch (error) {
    console.error('Error deleting board:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Create new card
app.post('/api/boards/:boardId/cards', async (req, res) => {
  try {
    const { title, color } = req.body;
    const { boardId } = req.params;
    const id = uuidv4();
    
    await pool.query(
      'INSERT INTO cards (id, board_id, title, color) VALUES (?, ?, ?, ?)',
      [id, boardId, title, color || '#ffffff']
    );
    
    const [card] = await pool.query('SELECT * FROM cards WHERE id = ?', [id]);
    res.status(201).json(card[0]);
  } catch (error) {
    console.error('Error creating card:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Update card color
app.patch('/api/cards/:id/color', async (req, res) => {
  try {
    const { color } = req.body;
    const { id } = req.params;
    
    await pool.query('UPDATE cards SET color = ? WHERE id = ?', [color, id]);
    const [card] = await pool.query('SELECT * FROM cards WHERE id = ?', [id]);
    res.json(card[0]);
  } catch (error) {
    console.error('Error updating card color:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});
// Delete card
app.delete('/api/cards/:id', async (req, res) => {
  try {
    await pool.query('DELETE FROM cards WHERE id = ?', [req.params.id]);
    res.status(204).send();
  } catch (error) {
    console.error('Error deleting card:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Create new item
app.post('/api/cards/:cardId/items', async (req, res) => {
  try {
    const { title } = req.body;
    const { cardId } = req.params;
    const id = uuidv4();
    
    await pool.query('INSERT INTO items (id, card_id, title) VALUES (?, ?, ?)', 
      [id, cardId, title]);
    
    const [item] = await pool.query('SELECT * FROM items WHERE id = ?', [id]);
    res.status(201).json(item[0]);
  } catch (error) {
    console.error('Error creating item:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Delete item
app.delete('/api/items/:id', async (req, res) => {
  try {
    await pool.query('DELETE FROM items WHERE id = ?', [req.params.id]);
    res.status(204).send();
  } catch (error) {
    console.error('Error deleting item:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});