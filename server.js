//Set up express, http server, and socket.io
var express = require('express');
var app = express()
    , server = require('http').createServer(app)
    , io = require('socket.io').listen(server);

server.listen(8080); //Listening on port 8080, open at URL:8080
io.set('log level', 1); //Hide extra debug messages from socket.io

console.log('Listening on port 8080...');

//Amount of detail server outputs to logger
io.set('log level', 1);

//Serves static files in /public foler -- CSS, JS
app.configure(function() {
    app.use('/', express.static(__dirname + '/public'));
})

app.get('/', function (req, res) {
    res.sendfile(__dirname + '/client.html');
    console.log('Sent client.html');
});

var playerList = [[],[]]; //0 = Queue, 1 = In game
var clients = {};
var theGame ={};
var savedGames = {};

//Socket.io to handle communication with the browser
io.sockets.on('connection', function (socket) {
    socket.emit('playerList', playerList); //Send current list of players to new connection

//    socket.on('message', function (msg) {
//        console.log('Message Received: ', msg);
//        socket.broadcast.emit('message', msg);
//    });

    //Set nickname when player logs in
    socket.on('setNickname', function(name){
        console.log('Player connected: ' + name);
        playerList[0].push(name); //Add to queue
        listPlayers(); //Update player list
        clients[name] = socket; //Add to master list of clients
        socket.nickname = name; //Set nickname
    });

    socket.on('approveGame', function(opponent) {
        name = socket.nickname; //name = person initiating game

        //Error check
        if(name == opponent) {
            socket.emit('message', 'You can\'t start a game against yourself, sorry.');
            return;
        } else if(!opponent || opponent === undefined) {
            socket.emit('message', 'You must select an opponent from the queue first!');
            return;
        }

        //Make players active to prevent someone initiating a second game
        moveActive(name);
        moveActive(opponent);

        //Remove start button to prevent initiating another game while waiting.
        toggleStartButton(name, opponent);

        //Prompt player before beginning game
        clients[opponent].emit('promptStart', name);
        clients[name].emit('promptStartWait', opponent);
    });

    socket.on('rejectStart', function(name) {
        clients[name].emit('startRejected');

        opponent = socket.nickname;
        moveInactive(name);
        moveInactive(opponent);

        //Show start button again
        toggleStartButton(name, opponent);
    });

    socket.on('startGame', function(name) {
        opponent = socket.nickname;

        clients[name].emit('startAccepted');

        console.log('Game: ' + name + ' vs ' + opponent);
        
        clients[name].emit('message', 'Starting game vs. ' + opponent);
        clients[opponent].emit('message', 'Starting game vs. ' + name);

        room = randomFromInterval(1000,9999);

        clients[name].join(room);
        clients[opponent].join(room);

        io.sockets.in(room).emit('message', 'Your game ID is: ' + room);

        startGame(room, name, opponent);        
    })

    socket.on('move', function(move) {
        console.log(move);
        executeMove(move.xBoard, move.yBoard, move.xLoc, move.yLoc, move.room);
    });

    socket.on('loadGame', function(data) {
        if(theGame[data.saveID]){
            changeRoom(data.room, data.saveID);
            io.sockets.in(data.saveID).emit('loadGame', {game: theGame[data.saveID]});
            io.sockets.in(data.saveID).emit('message', 'Game '+data.saveID+' loaded.');
            console.log('Emitted: loadGame -- ' + data.saveID);
            console.log(theGame[data.saveID]);
        } else {
            io.sockets.in(data.room).emit('message', 'Sorry, there is no saved game \
                with that ID. Please try again.');
        }
    });

    socket.on('disconnect', function() {
        name = socket.nickname;

        //Remove player from player list
        if(playerList[0].indexOf(name) != -1){
            playerList[0].splice(playerList[0].indexOf(name),1);    
        } else if(playerList[1].indexOf(name) != -1) {
            playerList[1].splice(playerList[1].indexOf(name),1);
        } else {
            console.log('Something is wrong - player does not exist');
        }

        listPlayers();

        //Emit disconnect unless player is not logged in
        if(!name) {
            return;
        } else if(name === undefined) {
            return;
        } else {
            console.log(name + ' disconnected.');
            io.sockets.emit('message', name + ' disconnected!');
        }

        var roomList = Object.keys(io.sockets.manager.roomClients[socket.id])
        console.log(roomList);

        if(roomList[1]){
            var room = roomList[1].substring(1);
            socket.leave(room);

            io.sockets.in(room).emit('message', name+' has disconnected. If you \
            would like to resume the game, form a new game with this player and \
            load game ID ' + room +'.'); 

            io.sockets.in(room).emit('opponentDisconnect');

            var opponentSocket = io.sockets.clients(room);

            if(opponentSocket[0]) {
                var opponent = opponentSocket[0].nickname;
                moveInactive(opponent);
            } else {
                console.log('Nobody left in the room');
            }

        }
    });
});

function moveActive(name) {
    playerList[0].splice(playerList[0].indexOf(name),1);
    playerList[1].push(name);
    listPlayers();
}

function moveInactive(name) {
    playerList[1].splice(playerList[1].indexOf(name),1);
    playerList[0].push(name);
    listPlayers();
}

//Toggles display of the 'Start Game' button. Prevents initiating a game at the wrong time.
function toggleStartButton(p1, p2) {
    clients[p1].emit('toggleStartButton');
    if(p2){
        clients[p2].emit('toggleStartButton');        
    }
}

//Used to change rooms when a game is loaded
function changeRoom(oldRoom, newRoom) {
    if(newRoom == oldRoom) {
        console.log('Stayed in the same room');
    } else {
        io.sockets.clients(oldRoom)[0].join(newRoom);
        io.sockets.clients(oldRoom)[1].join(newRoom);

        io.sockets.clients(newRoom)[0].leave(oldRoom);
        io.sockets.clients(newRoom)[1].leave(oldRoom);
        console.log('Changed rooms.');
    }

    io.sockets.in(newRoom).emit('You have been moved to room ' + newRoom);
}

//Emits player list to everyone
function listPlayers() {
    console.log(playerList);
    io.sockets.emit('playerList', playerList);
}

//Executes once two players join
function startGame(room, name, opponent) {
    theGame[room] = new GameState(room, name, opponent);
    theGame[room].turn = 1;

    clients[name].emit('setPlayer1');
    clients[opponent].emit('setPlayer2');

    io.sockets.in(room).emit('toggleBoard');
    io.sockets.in(room).emit('passRoom', {room: room});
    io.sockets.in(room).emit('newTurn', {turn: theGame[room].turn, activeX: theGame[room].activeX, activeY: theGame[room].activeY, name: name, opponent: opponent});
}

//Class that contains game info
function GameState(room, name, opponent) {
    this.boards = new Array(3);
    this.turn = 0;
    this.room = room;
    this.p1 = name;
    this.p2 = opponent;

    for ( var i=0; i<3; i++ ) {
        this.boards[i] = new Array(3);
        for ( var j=0; j<3; j++ ) {
            this.boards[i][j] = new LittleBoard(i, j);
        }
    }
    //Nothing active at the start
    this.activeX = -1;
    this.activeY = -1;
}

//LittleBoard 'class'
function LittleBoard(x, y) {
    //x and y this board
    this.x = x;
    this.y = y;
    this.state = new Array(3);

    this.won = false;
    this.winner = 0;

    //Initialize states to zero -- Used to determine if square is X or O
    for ( var i=0; i<3; i++ ) {
        this.state[i] = new Array(3);
        for ( var j=0; j<3; j++ ) {
            this.state[i][j] = 0;
        }
    }
}

function executeMove(xBoard, yBoard, xLoc, yLoc, room) {
    console.log('executeMove -- theGame[room]:');
    console.log(theGame[room]);

    var lbState = theGame[room].boards[xBoard][yBoard].state;
    var mark = theGame[room].turn;

    lbState[xLoc][yLoc] = mark; //Adds an X (1) or O (2) to the selected square

    console.log(theGame[room].boards[xBoard][yBoard]);

    //Check to see if anyone wins after each move
    checkLittleWin(xBoard, yBoard, xLoc, yLoc, mark, room);

    if (theGame[room].boards[xLoc][yLoc].won) {
        theGame[room].activeX = -1;
        theGame[room].activeY = -1;
    } else {
        theGame[room].activeX = xLoc;
        theGame[room].activeY = yLoc;
    }

    //Display the move for the clients
    io.sockets.in(room).emit('move', {xBoard: xBoard, yBoard: yBoard, xLoc: xLoc, yLoc: yLoc, mark: mark});

    //Update clients with move
    if (theGame[room].turn == 4) {
        //Game Over!
    } else if (theGame[room].turn == 1) {
        theGame[room].turn = 2;
    } else {
        theGame[room].turn = 1;
    }
    //Update player turn for clients
    io.sockets.emit('newTurn', {turn: theGame[room].turn, activeX: theGame[room].activeX, activeY: theGame[room].activeY, name: theGame[room].p1, opponent: theGame[room].p2});
}

//Generate a random number for the game ID
function randomFromInterval(from,to)
{
    return Math.floor(Math.random()*(to-from+1)+from);
}

//Check for a little win
function checkLittleWin(xBoard, yBoard, xLoc, yLoc, mark, room){
    
    var lbState = theGame[room].boards[xBoard][yBoard].state;
   
    //Check row
    var rowWin = true;
    for (var i = 0; i<3; i++) {
        if (lbState[xLoc][i] != mark) {
            rowWin = false;
            break;
        }
    }
    //Check column
    var colWin = true;
    for (var i = 0; i<3; i++) {
        if (lbState[i][yLoc] != mark) {
            colWin = false;
            break;
        }
    }

    //Check Diags
    var diagWin = false;
    if (lbState[0][0] == mark && lbState[1][1] == mark && lbState[2][2] == mark) {
        diagWin = true;
    }
    if (lbState[2][0] == mark && lbState[1][1] == mark && lbState[0][2] == mark) {
        diagWin = true;
    }

    //Winner?
    if (diagWin || colWin || rowWin){
        theGame[room].boards[xBoard][yBoard].won = true;
        theGame[room].boards[xBoard][yBoard].winner = mark;

        io.sockets.in(room).emit('littleWin', {xBoard: xBoard, yBoard: yBoard, winner: mark});

        //Every time someone wins a little board, check if they also win the whole game
        checkBigWin(xBoard, yBoard, mark, room);
    }
}

//Check for a winner of the whole game!
function checkBigWin(xBoard, yBoard, mark, room) {
   // Check row
    var rowWin = true;
    for (var i = 0; i<3; i++) {
        if (theGame[room].boards[xBoard][i].winner != mark) {
            rowWin = false;
            break;
        }
    }
    //Check column
    var colWin = true;
    for (var i = 0; i<3; i++) {
        if (theGame[room].boards[i][yBoard] != mark) {
            colWin = false;
            break;
        }
    }

    //Check Diags
    var diagWin = false;
    if (theGame[room].boards[0][0].winner == mark && theGame[room].boards[1][1].winner == mark && theGame[room].boards[2][2].winner == mark) {
        diagWin = true;
    }
    if (theGame[room].boards[2][0].winner == mark && theGame[room].boards[1][1].winner == mark && theGame[room].boards[0][2].winner == mark) {
        diagWin = true;
    }

    //Winner?
    if (diagWin || colWin || rowWin){
        var winner;

        if(theGame.mark == 1) {
            winner = theGame[room].p1;
        } else {
            winner = theGame[room].p2;
        }

        theGame[room].turn = 4; //Stops play
        console.log('Game Over! The winner is ' + winner);

        io.sockets.in(room).emit('gameOver', winner);

        moveInactive(theGame[room].p1);
        moveInactive(theGame[room].p2);

        //Show start button again.
        toggleStartButton(name, opponent);
    } else {
        console.log('No win yet.');
    }
}
