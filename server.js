//Set up express, http server, and socket.io
var app = require('express') ()
    , server = require('http').createServer(app)
    , io = require('socket.io').listen(server);

//Listening on port 8080, open at URL:8080
server.listen(8080);

//Send webpage and game script to the user
app.get('/', function (req, res) {
  res.sendfile(__dirname + '/client.html');
});

app.get('/game.js', function (req, res) {
  res.sendfile(__dirname + '/game.js');
});

var numPlayers = 0;
var theGame;

//Socket.io to handle communication with the browser
io.sockets.on('connection', function (socket) {
    socket.on('message', function (msg) {
        console.log('Message Received: ', msg);
        socket.broadcast.emit('message', msg);
    });

    //Every time someone connects, increment the player number
    numPlayers++; 
    console.log('Player Connected');

    //Assign players based on the order they connected.
    if( numPlayers == 1) {
   		socket.emit('setPlayer1');
   		socket.set('nickname', 'Player1');
   	} else if(numPlayers==2) {
    	socket.emit('setPlayer2');
    	socket.set('nickname', 'Player2');
    	startGame();
    } else {
        //Only handles 2 players -- Add a lobby or something later!
    	socket.emit('message', 'There are too many players!'); 
    };

    socket.on('move', function(move) {
    	console.log(move);
    	executeMove(move.xBoard, move.yBoard, move.xLoc, move.yLoc);
    })

    socket.on('disconnect', function() {
    	numPlayers--;
    	console.log('Player disconnected');
    });
});

//Amount of detail server outputs to logger
io.set('log level', 1);

//Executes once two players join
function startGame() {
	theGame = new GameState();
	theGame.turn = 1;
	io.sockets.emit('newTurn', {turn: theGame.turn, activeX: theGame.activeX, activeY: theGame.activeY});
}

function GameState() {
    this.boards = new Array(3);
    this.turn = 0;

    for ( var f=0; i<3; i++ ) {
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

function executeMove(xBoard, yBoard, xLoc, yLoc) {
    
    var lbState = theGame.boards[xBoard][yBoard].state;
    var mark = theGame.turn;

    lbState[xLoc][yLoc] = mark; //Adds an X or O to the selected square

    //Check to see if anyone wins after each move
    checkLittleWin(xBoard, yBoard, xLoc, yLoc, mark);

    if (theGame.boards[xLoc][yLoc].won) {
        theGame.activeX = -1;
        theGame.activeY = -1;
    } else {
        theGame.activeX = xLoc;
        theGame.activeY = yLoc;
    }

    //Display the move for the clients
    io.sockets.emit('move', {xBoard: xBoard, yBoard: yBoard, xLoc: xLoc, yLoc: yLoc, mark: mark});

    //Update clients with move
	if (theGame.turn == 1) {
		theGame.turn = 2;
	} else {
		theGame.turn = 1;
	}
    //Update player turn for clients
	io.sockets.emit('newTurn', {turn: theGame.turn, activeX: theGame.activeX, activeY: theGame.activeY});
}

//Check for a little win
function checkLittleWin(xBoard, yBoard, xLoc, yLoc, mark){
    
    var lbState = theGame.boards[xBoard][yBoard].state;
   
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
        theGame.boards[xBoard][yBoard].won = true;
        theGame.boards[xBoard][yBoard].winner = mark;

        io.sockets.emit('littleWin', {xBoard: xBoard, yBoard: yBoard, winner: mark});

        //Every time someone wins a little board, check if they also win the whole game
        checkBigWin(xBoard, yBoard, mark);
    }
}

//Check for a winner of the whole game!
function checkBigWin(xBoard, yBoard, mark) {
   // Check row
    var rowWin = true;
    for (var i = 0; i<3; i++) {
        if (theGame.boards[xBoard][i].winner != mark) {
            rowWin = false;
            break;
        }
    }
    //Check column
    var colWin = true;
    for (var i = 0; i<3; i++) {
        if (theGame.boards[i][yBoard] != mark) {
            colWin = false;
            break;
        }
    }

    //Check Diags
    var diagWin = false;
    if (theGame.boards[0][0].winner == mark && theGame.boards[1][1].winner == mark && theGame.boards[2][2].winner == mark) {
        diagWin = true;
    }
    if (theGame.boards[2][0].winner == mark && theGame.boards[1][1].winner == mark && theGame.boards[0][2].winner == mark) {
        diagWin = true;
    }

    //Winner?
    if (diagWin || colWin || rowWin){
        theGame.turn = 4;
    }
}
