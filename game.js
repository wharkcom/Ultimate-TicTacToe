var iosocket;

function GameState() {
    this.boards = new Array(3);
    this.turn = 0;

    for ( var i=0; i<3; i++ ) {
        this.boards[i] = new Array(3);
        for ( var j=0; j<3; j++ ) {
            this.boards[i][j] = new LittleBoard(i, j);
        }
    }

    this.activeX = -1;
    this.activeY = -1;
}

// LittleBoard 'class'
function LittleBoard(x, y) {
    // x and y this board
    this.x = x;
    this.y = y;
    this.state = new Array(3);

    this.won = false;
    this.winner = 0;

    // initialize states to zero
    for ( var i=0; i<3; i++ ) {
        this.state[i] = new Array(3);
        for ( var j=0; j<3; j++ ) {
            this.state[i][j] = 0;
        }
    }
}

// globals for convenience
var canvas;
var ctx;
var padding;

var theGame;
var player;
var status;
var statusDiv;

function init() {
    canvas = document.getElementById('canvas');
    ctx = canvas.getContext('2d');

    statusDiv = document.getElementById('status');

    theGame = new GameState();

    player = 1;
    updateStatus('Connecting to server...');
    iosocket = io.connect();

    iosocket.on('connect', function() {
        updateStatus('Connected!');

        iosocket.on('setPlayer1', function() {
            player = 1;
            updateStatus('You are X!');
        });

        iosocket.on('setPlayer2', function() {
            player = 2;
            updateStatus('You are O!');
        });

        iosocket.on('message', function(msg) {
            updateStatus(msg);
        });

        iosocket.on('newTurn', function(turn) {
            theGame.turn = turn.turn;
            theGame.activeX = turn.activeX;
            theGame.activeY = turn.activeY;

            if (theGame.turn == player) {
                updateStatus('It is your turn!');
            } else {
                updateStatus('Waiting for your opponent to play');
            }
            drawBoard();
        })

        iosocket.on('move', function(move) {
            theGame.boards[move.xBoard][move.yBoard].state[move.xLoc][move.yLoc] = move.mark;
            drawBoard();
        })

        iosocket.on('littleWin', function(win) {
            theGame.boards[win.xBoard][win.yBoard].winner = win.winner;
            theGame.boards[win.xBoard][win.yBoard].won = true;
        });

        iosocket.on('disconnect', function() {
            updateStatus('Disconnected :-(');
        });
    });
    

    window.addEventListener('resize', resizeGame, false);
    resizeGame();

}

function updateStatus(msg) {
    status = msg;
    statusDiv.innerText = status;
}

// Resize the canvas to fit in the window
function resizeGame() {
    canvas.width = Math.min(window.innerWidth, window.innerHeight) - 50;
    canvas.height = canvas.width;
    padding = canvas.height/25; // inner padding for each little board
    drawBoard();
}

// Event handler for clicks
function clicky(e) {

    // We only want to handle clicks if it is currently our turn
    if ( theGame.turn != player ) {
        return;
    }

    var xCoord = e.pageX-canvas.offsetLeft;
    var yCoord = e.pageY-canvas.offsetTop;

    var oneThird = canvas.width/3;

    // Figure out which little board was clicked on
    var xBoard = Math.floor(xCoord/oneThird);
    var yBoard = Math.floor(yCoord/oneThird);

    // Figure out which location on little board was clicked on
    // **************************************************
    // Fix me! Add padding to calculations!
    var xLoc = Math.floor(3 * (xCoord - xBoard * oneThird) / oneThird);
    var yLoc = Math.floor(3 * (yCoord - yBoard * oneThird) / oneThird);

    // Check to see if turn is in the right board
    if ((xBoard == theGame.activeX && yBoard == theGame.activeY) || (theGame.activeX == -1)) {
    // Check to see if the turn is in an empty pace
        if (theGame.boards[xBoard][yBoard].state[xLoc][yLoc] == 0) {
            // Send move to server to be checked
            executeMove(xBoard, yBoard, xLoc, yLoc);
        }
    }

}

function executeMove(xBoard, yBoard, xLoc, yLoc) {
    // Send move to server
    iosocket.emit('move', {xBoard: xBoard, yBoard: yBoard, xLoc: xLoc, yLoc: yLoc});
    // Get update from server


    drawBoard();
}

function drawBigBoard() {
    var oneThird = canvas.width/3;

    // Thick black lines
    ctx.strokeStyle = '#000000';
    ctx.lineWidth = 5;
    ctx.beginPath();

    // Draw horizontal lines
    ctx.moveTo(0, oneThird);
    ctx.lineTo(canvas.width, oneThird);
    ctx.moveTo(0, 2*oneThird);
    ctx.lineTo(canvas.width, 2*oneThird);

    // Draw vertical lines
    ctx.moveTo(oneThird, 0);
    ctx.lineTo(oneThird, canvas.width);
    ctx.moveTo(2*oneThird, 0);
    ctx.lineTo(2*oneThird, canvas.width);

    ctx.stroke();
    ctx.closePath();
}

function drawLittleBoard(x, y) {

    var oneThird = canvas.width/3;

    var xOffset = x * oneThird;
    var yOffset = y * oneThird;

    var oneNinth = (oneThird - 2*padding)/3;

    var lbState = theGame.boards[x][y].state;

    // Highlight the active board
    if (x == theGame.activeX && y == theGame.activeY) {
        ctx.fillStyle='Khaki';
        ctx.fillRect(xOffset+padding/2, yOffset+padding/2, oneThird-padding, oneThird-padding);
    }

    // Highlight won boards
    if (theGame.boards[x][y].won) {
        if (theGame.boards[x][y].winner == 1) {
            ctx.fillStyle ='LightSalmon';
        } else {
            ctx.fillStyle = 'LightBlue';
        }

        ctx.fillRect(xOffset+padding/2, yOffset+padding/2, oneThird-padding, oneThird-padding);
    }

    // Draw the Xs and Os
    for ( var i=0; i<3; i++ ) {
        for ( var j=0; j<3; j++ ) {
            if ( lbState[i][j] == 1 ) {
                // Draw a red X
                ctx.strokeStyle = '#ff0000'
                ctx.lineWidth = 5;
                ctx.beginPath();

                ctx.moveTo(xOffset + padding*1.25 + i*oneNinth, yOffset + padding*1.25 + j*oneNinth);
                ctx.lineTo(xOffset + padding*0.8 + (i+1)*oneNinth, yOffset + padding*0.8 + (j+1)*oneNinth);
                ctx.moveTo(xOffset + padding*1.25 + i*oneNinth, yOffset + padding*0.8 + (j+1)*oneNinth);
                ctx.lineTo(xOffset + padding*0.8 + (i+1)*oneNinth, yOffset + padding*1.25 + j*oneNinth);

                ctx.stroke();
                ctx.closePath();
            } else if ( lbState[i][j] == 2 ) {
                // Draw a blue O
                ctx.strokeStyle = '#0000ff'
                ctx.lineWidth = 5;
                ctx.beginPath();

                ctx.arc(xOffset + padding + (i+0.5)*oneNinth, yOffset + padding + (j+0.5)*oneNinth,
                        oneNinth/2.5, 0, 2*Math.PI);

                ctx.stroke();
                ctx.closePath();
            }
        }
    }


    // Thin black lines
    ctx.strokeStyle = '#000000';
    ctx.lineWidth = 2;
    ctx.beginPath();

    // Draw horizontal lines
    ctx.moveTo(xOffset + padding, yOffset + padding + oneNinth);
    ctx.lineTo(xOffset + oneThird - padding, yOffset + padding + oneNinth);
    ctx.moveTo(xOffset + padding, yOffset + padding + 2*oneNinth);
    ctx.lineTo(xOffset + oneThird - padding, yOffset + padding + 2*oneNinth);

    // Draw vertical lines
    ctx.moveTo(xOffset + padding + oneNinth, yOffset + padding);
    ctx.lineTo(xOffset + padding + oneNinth, yOffset + oneThird - padding);
    ctx.moveTo(xOffset + padding + 2*oneNinth, yOffset + padding);
    ctx.lineTo(xOffset + padding + 2*oneNinth, yOffset + oneThird - padding);

    ctx.stroke();
    ctx.closePath();

}

function drawBoard() {
    clear();

    drawBigBoard();
    for ( var i=0; i<3; i++ ) {
        for ( var j=0; j<3; j++ ) {
            drawLittleBoard(i, j);
        }
    }
    if (theGame.turn == 4) {
        ctx.font = '40px Verdana'
        ctx.fillText('Game Over!', canvas.width/2, canvas.height/2)
    }
}

function clear() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
}


init();