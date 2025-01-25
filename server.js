const express = require('express');
const mysql = require('mysql2/promise');
const cors = require('cors');
require('dotenv').config();

const app = express();

// Middleware
app.use(cors());
app.use(express.json());

// Database connection configuration
const pool = mysql.createPool({
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || 'abhi123tech@',
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
      await pool.query('INSERT INTO boards (title) VALUES (?)', ['MyBoard']);
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
    const [result] = await pool.query('INSERT INTO boards (title) VALUES (?)', [title]);
    const [board] = await pool.query('SELECT * FROM boards WHERE id = ?', [result.insertId]);
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
    
    const [result] = await pool.query(
      'INSERT INTO cards (board_id, title, color) VALUES (?, ?, ?)',
      [boardId, title, color || '#ffffff']
    );
    
    const [card] = await pool.query('SELECT * FROM cards WHERE id = ?', [result.insertId]);
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
    const owners = ['easy', 'medium', 'hard'];

    // Select a random owner
    const randomOwner = 'medium';
    // Insert the item with the current timestamp
    const [result] = await pool.query(
      'INSERT INTO items (card_id, title, created_time, owner) VALUES (?, ?, NOW(), ?)',
      [cardId, title, randomOwner]
    );

    console.log("Insert Result:", result);  //
    // Fetch the newly created item and format the date
    const [item] = await pool.query(
      'SELECT id, title, card_id, DATE_FORMAT(created_time, "%Y-%m-%dT%H:%i:%sZ") AS createdTime , owner FROM items WHERE id = ?',
      [result.insertId]
    );

    res.status(201).json(item[0]); // Send consistent date format
  } catch (error) {
    console.error('Error creating item:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.get('/api/cards/:cardId/items', async (req, res) => {
  const { cardId } = req.params;
  const limit = parseInt(req.query.limit) || 10;
  const offset = parseInt(req.query.offset) || 0;

  try {
    const [items] = await pool.query(
      'SELECT id, title, card_id, DATE_FORMAT(created_time, "%Y-%m-%dT%H:%i:%sZ") AS createdTime FROM items WHERE card_id = ? LIMIT ? OFFSET ?',
      [cardId, limit, offset]
    );

    res.status(200).json({ success: true, data: items });
  } catch (error) {
    console.error('Error fetching items:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Move item to a different card
app.patch('/api/items/:itemId/move', async (req, res) => {
  try {
    const { itemId } = req.params;
    const { targetCardId } = req.body;

    if (!targetCardId) {
      return res.status(400).json({ error: 'targetCardId is required' });
    }

    // Update the item's card_id in the database
    await pool.query('UPDATE items SET card_id = ? WHERE id = ?', [targetCardId, itemId]);

    // Fetch the updated item to return to the client
    const [updatedItem] = await pool.query('SELECT * FROM items WHERE id = ?', [itemId]);
    
    // If the item doesn't exist, return 404
    if (updatedItem.length === 0) {
      return res.status(404).json({ error: 'Item not found' });
    }

    // Send back the updated item
    res.json(updatedItem[0]);
  } catch (error) {
    console.error('Error moving item:', error);
    res.status(500).json({ error: 'Failed to move item' });
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
