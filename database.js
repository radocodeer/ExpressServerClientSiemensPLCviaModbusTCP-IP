// database.js
const mysql = require('mysql2');

// Create a connection to the MySQL database
const connection = mysql.createConnection({
    host: 'localhost',
    user: 'root',
    password: 'password',
    database: 'girrafe'
});

// Connect to the database
connection.connect((err) => {
    if (err) {
        console.error('Error connecting to MySQL database:', err);
    } else {
        console.log('Connected to MySQL database.');
    }
});

// Create a table to store PLC data if it doesn't exist
const createTableQuery = `
    CREATE TABLE IF NOT EXISTS RadovaPLC_Databaza (
        id INT AUTO_INCREMENT PRIMARY KEY,
        REALs TEXT,
        INTs TEXT,
        RadoColumn TEXT,
        timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
    )
`;

connection.query(createTableQuery, (err) => {
    if (err) {
        console.error('Error creating table:', err);
    } else {
        console.log('PLC data table ready.');
    }
});

module.exports = connection;
