const sqlite3 = require('sqlite3').verbose();

const db = new sqlite3.Database('./data/dineflow.db', (err) => {
  if (err) {
    console.error('Error opening database:', err);
    process.exit(1);
  }
  
  // Try to add the column
  db.run(`
    ALTER TABLE order_items ADD COLUMN status TEXT NOT NULL DEFAULT 'pending' 
    CHECK(status IN ('pending', 'ready', 'completed', 'cancelled'))
  `, (err) => {
    if (err) {
      if (err.message.includes('duplicate column')) {
        console.log('✅ Status column already exists');
      } else {
        console.error('Error adding column:', err.message);
      }
    } else {
      console.log('✅ Status column added successfully');
    }
    db.close();
  });
});
