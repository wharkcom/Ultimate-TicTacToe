//Globals for convenience
var canvas;
var ctx;
var padding;
var theGame;
var player;
var iosocket;

function init() {
	canvas = document.getElementById('canvas');
	ctx = canvas.getContext('2d');

    login();
    buttonTests();

    //Draw the game board -- used to be part of resize()
    padding = canvas.height/25; //Inner padding for each little board
    //drawBoard(); //Want this called after login, keeping here for testing

    //Adjust window size if browser size changes ----- Removed for now. Can add back later.
    //window.addEventListener('resize', resizeGame, false);
    //resizeGame();

    //-----------------------------------------------------------
	//Socket.io functions to handle communication with the server
    //-----------------------------------------------------------
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

        //------------------------------
        //Popups when initiating a game
        //------------------------------

        iosocket.on('promptStart', function(name){
            promptStart(name);
        });

        iosocket.on('promptStartWait', function(opponent){
            $('#promptStartWait span').prepend('<h2>Waiting for '+opponent+' to accept the game.</h2>');
            $('#promptStartWait').toggleClass('hidden');
        })

        iosocket.on('startAccepted', function() {
            $('#promptStartWait span h2').remove();
            $('#promptStartWait').toggleClass('hidden');
        })

        iosocket.on('startRejected', function() {
            $('#promptStartWait span h2').remove();
            $('#promptStartWait').toggleClass('hidden');

            $('#promptStartRejected').toggleClass('hidden');

            $('#closeReject').click(function(){
                $('#closeReject').off();
                $('#promptStartRejected').toggleClass('hidden');
            });
        });

        //Shows or hides the start button to prevent starting a game at the wrong time
        iosocket.on('toggleStartButton', function() {
            $('#startGame').toggleClass('hidden');
        });

        //------------------------------
        //Game Started
        //------------------------------

        //Passes node room info to the client, starts a new game.
        iosocket.on('passRoom', function(data) {
            theGame = new GameState();
            theGame.room = data.room;
            console.log('passRoom received');
            console.log(theGame);
            $('#menuLoad').removeClass('hidden');
            drawBoard();
        });

        iosocket.on('newTurn', function(data) {
            theGame.turn = data.turn;
            theGame.activeX = data.activeX;
            theGame.activeY = data.activeY;

            whoseTurn(data.name, data.opponent);
            drawBoard();
        })

        iosocket.on('move', function(move) {
            theGame.boards[move.xBoard][move.yBoard].state[move.xLoc][move.yLoc] = move.mark;
            drawBoard();
        });

        iosocket.on('littleWin', function(win) {
            theGame.boards[win.xBoard][win.yBoard].winner = win.winner;
            theGame.boards[win.xBoard][win.yBoard].won = true;
            console.log(theGame);
        });

        iosocket.on('playerList', function(playerList) {
            showPlayerList(playerList);
        });

        iosocket.on('toggleBoard', function() {
            toggleBoard();
        });

        iosocket.on('loadGame', function(data) {
            theGame = data.game;
            whoseTurn();
            drawBoard();

            console.log('Game loaded:');
            console.log(theGame);
            console.log('I am player ' + player);
        })

        iosocket.on('disconnect', function() {
            updateStatus('Disconnected :-(');
        });

        iosocket.on('opponentDisconnect', function(){
            $('#menuLoad').addClass('hidden');
            disconnectAlert();
        });

        iosocket.on('gameOver', function(winner) {
            console.log('Game Over! The winner is ' + winner);
            gameOver(winner);
        });
    });
}

function GameState() {
    this.boards = new Array(3);
    this.turn = 0;
    this.room = '';

    for ( var i=0; i<3; i++ ) {
        this.boards[i] = new Array(3);
        for ( var j=0; j<3; j++ ) {
            this.boards[i][j] = new LittleBoard(i, j);
        }
    }

    this.activeX = -1;
    this.activeY = -1;
}

//Emit player turn info
function whoseTurn(name, opponent) {
    if (theGame.turn == 1) {
        $('.turn').remove();
        $('#menuBar').prepend('<span class="turn">Turn: '+name+'</span>');
        //updateStatus('It is your turn!');
    } else {
        $('.turn').remove();
        $('#menuBar').prepend('<span class="turn">Turn: '+opponent+'</span>');
        //updateStatus('Waiting for your opponent to play');
    }
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

//Event handler for clicks
function clicky(e) {
    //We only want to handle clicks if it is currently our turn
    if ( theGame.turn != player ) {
        return;
    }

    var xCoord = e.offsetX;
    var yCoord = e.offsetY;

    var oneThird = canvas.width/3;

    //Figure out which little board was clicked on
    var xBoard = Math.floor(xCoord/oneThird);
    var yBoard = Math.floor(yCoord/oneThird);

    //Figure out which location on little board was clicked on
    //**************************************************
    //Fix me! Add padding to calculations!
    var xLoc = Math.floor(3 * (xCoord - xBoard * oneThird) / oneThird);
    var yLoc = Math.floor(3 * (yCoord - yBoard * oneThird) / oneThird);

    //Check to see if turn is in the right board
    if ((xBoard == theGame.activeX && yBoard == theGame.activeY) || (theGame.activeX == -1)) {
    //Check to see if the turn is in an empty pace
        if (theGame.boards[xBoard][yBoard].state[xLoc][yLoc] == 0) {
            //Send move to server to be checked
            executeMove(xBoard, yBoard, xLoc, yLoc, theGame.room);
        }
    }
}

function executeMove(xBoard, yBoard, xLoc, yLoc, room) {
    //Send move to server
    iosocket.emit('move', {xBoard: xBoard, yBoard: yBoard, xLoc: xLoc, yLoc: yLoc, room: room});
    //Get update from server
    drawBoard();
}

function drawBigBoard() {
    var oneThird = canvas.width/3;

    //Thick black lines
    ctx.strokeStyle = '#000000';
    ctx.lineWidth = 5;
    ctx.beginPath();

    //Draw horizontal lines
    ctx.moveTo(0, oneThird);
    ctx.lineTo(canvas.width, oneThird);
    ctx.moveTo(0, 2*oneThird);
    ctx.lineTo(canvas.width, 2*oneThird);

    //Draw vertical lines
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

    //Highlight the active board
    if (x == theGame.activeX && y == theGame.activeY) {
        ctx.fillStyle='Khaki';
        ctx.fillRect(xOffset+padding/2, yOffset+padding/2, oneThird-padding, oneThird-padding);
    }

    //Highlight won boards
    if (theGame.boards[x][y].won) {
        if (theGame.boards[x][y].winner == 1) {
            ctx.fillStyle ='LightSalmon';
        } else {
            ctx.fillStyle = 'LightBlue';
        }

        ctx.fillRect(xOffset+padding/2, yOffset+padding/2, oneThird-padding, oneThird-padding);
    }

    //Draw the Xs and Os
    for ( var i=0; i<3; i++ ) {
        for ( var j=0; j<3; j++ ) {
            if ( lbState[i][j] == 1 ) {
                //Draw a red X
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
                //Draw a blue O
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


    //Thin black lines
    ctx.strokeStyle = '#000000';
    ctx.lineWidth = 2;
    ctx.beginPath();

    //Draw horizontal lines
    ctx.moveTo(xOffset + padding, yOffset + padding + oneNinth);
    ctx.lineTo(xOffset + oneThird - padding, yOffset + padding + oneNinth);
    ctx.moveTo(xOffset + padding, yOffset + padding + 2*oneNinth);
    ctx.lineTo(xOffset + oneThird - padding, yOffset + padding + 2*oneNinth);

    //Draw vertical lines
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

    //Replacing with gameOver()
    if (theGame.turn == 4) {
        //ctx.font = '40px Verdana'
        //ctx.fillText('Game Over!', canvas.width/2, canvas.height/2)
    }
}

function clear() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
}



//Resize objects on the screen to fit in the window
/** Making size static for easier development. Can add this back later.
function resizeGame() {
	var windowWidth = window.innerWidth;
	var windowHeight = window.innerHeight;
	var minChatWidth = 350; //Force chat windows to be this large
	var shortDim = Math.min(window.innerWidth-minChatWidth, window.innerHeight);

    canvas.width = shortDim*0.95 > 500 ? shortDim*.95 : 500; //Canvas at least 500x500
    canvas.height = canvas.width;

    sideDiv.setAttribute("style", "width:"+ ((windowWidth - (canvas.width) > minChatWidth ? 
    	(windowWidth - canvas.width*1.12) : minChatWidth)+'px'));

    statusDiv.setAttribute("style", "height:" +String(windowHeight/2*.8)+'px');

    chatDiv.setAttribute("style", "height:" +String(windowHeight/2*.85)+'px');

    padding = canvas.height/25; //Inner padding for each little board
    //drawBoard();
}
**/

//Post status messages
function updateStatus(msg) {
    //statusDiv.innerText = msg + '\n' + statusDiv.innerText;

    $('#status ul').prepend('<li class="statusTop">'+msg+'</li>');

    $('#status ul li:gt(40)').remove();

    setTimeout(function() {
        $('#status ul li').removeClass('statusTop');
    }, 5000);
}

//Called when the player first connects
function login() {
    $('#startGame').click(approveGame);

    $('#nameBox').focus();

    $(window).keydown(function(e) {
        if(e.keyCode == 13) {
            e.preventDefault();
            return false;
        }
    })

    //Accepts login name and sends to the server
    $('#nameSubmit').click(function(){
            submit();
            return false;
    });

    $('#nameBox').keyup(function(e) {
        if (e.keyCode == 13) {
            submit();
            return false;
        }
    });

    function submit() {
        var name = $('#nameBox').val();
        if(name) {
            console.log('Submitted name: ' + name);
            iosocket.emit('setNickname', name);
            $('#nameBox').val(''); //Clear the box
            $('#lobby').toggleClass('hidden');
            $('#submitLogin').toggleClass('hidden');
            $('#startGame').toggleClass('hidden');
        } else {
            console.log('No name was entered.');
        }
    }

    function toggleLogin() {
        console.log('toggleLogin');
        $('.gameArea').toggleClass('hidden');
    }
}


//Handles various button clicks, can probably clean up later
function buttonTests() {
    $('#canvas').on('click', clicky);
    $('#test').click(toggleBoard);
    $('#test2').click(promptStart);

    $('#disconLobby').click(function(){
        toggleBoard();
        $('#disconnect').toggleClass('hidden'); //Close disconnect popup
        $('#startGame').toggleClass('hidden'); //Show 'Start Game' button
    });

    $('#gameOverLobby').click(function() {
        toggleBoard();
        $('#gameOver').toggleClass('hidden');
        $('#winnerText h3').remove();
        $('.turn').remove(); //Remove turn label if game ends
    });

    $('#optionsBar').click(function(){
        console.log('Options Click');
        $('#optionsMenu').toggleClass('hidden');
    });

    $('#optionsMenu ul li').click(function(){
        $('#optionsMenu').toggleClass('hidden');
    })

    $('#menuHelp').click(function(){
        $('#helpScreen').toggleClass('hidden');
    });

    $('#menuLoad').click(function(){
        loadGame();
    });

    $('#helpClose').click(function(){
        $('#helpScreen').toggleClass('hidden');
    });

    //For testing chat window
    function spamChat() {
        for(i=1; i<25; i++) {
            updateStatus('Status #' + i);
        }
    }
}

//Prompt when game is initiated
function promptStart(name) {
    $('#promptStart #topSpan').prepend('<h2>'+name+' would like to start a game with you!</h2>');
    $('#promptStart').toggleClass('hidden');

    $('#acceptStart').click(function(){
        iosocket.emit('startGame', name);
        resetPrompt();
    });

    $('#rejectStart').click(function(){
        iosocket.emit('rejectStart', name);
        resetPrompt();
    });

    function resetPrompt() {
        $('#acceptStart').off();
        $('#rejectStart').off();
        $('#promptStart #topSpan h2').remove();
        $('#promptStart').toggleClass('hidden');
    }
}

//Alert when your opponent has disconnected
function disconnectAlert() {
    $('#disconnect').toggleClass('hidden');
    theGame.turn = 3; //Can no longer play
    $('.turn').remove(); //Remove turn label if game ends
}

//Loads a previously started game.
function loadGame() {
    var saveID = prompt('Please enter the previous game ID to load.');
    iosocket.emit('loadGame', {room: theGame.room, saveID: saveID});
}

//Show or hide the game board
function toggleBoard() {
    $('.gameArea').toggleClass('hidden');
}

//Displays the list of players sent from the server
function showPlayerList(playerList) {
    console.log('Current players: ' + playerList);

    $('.list ul').empty();

    $('.list ul').append('<li>Players in Queue:</li>');

    if(playerList){
        $.each(playerList[0], function(index, value) {
            $('.list ul').append('<li id="'+value+'" class="available">' + value + '</li>');
        });
    }
    
    $('.list ul').append('<li> </li>');
    $('.list ul').append('<li>Players in Game:</li>');

    if(playerList){
        $.each(playerList[1], function(index, value) {
            $('.list ul').append('<li>' + value + '</li>');
        });
    }

    $('.available').click(function() {
        $('.available').removeClass('pLbC');
        $(this).toggleClass('pLbC');
    });  
}

function approveGame() {
    var opponent = $('.pLbC').attr('id'); //Get opponent name based on selected div
    iosocket.emit('approveGame', opponent);
}

function gameOver(winner) {
    $('#gameOver').toggleClass('hidden');
    $('#winnerText').append('<h3>Congrats to the winner, ' + winner + '</h3>');
    $('.turn').remove(); //Remove turn label if game ends
}

// Start everything!
window.onload = init;


