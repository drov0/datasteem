var mysql      = require('mysql');
var connection = mysql.createConnection({
    host     : 'localhost',
    user     : 'root',
    password : '',
    database : 'steemdata',
    charset: 'utf8mb4'
});

connection.connect();

module.exports =  connection;