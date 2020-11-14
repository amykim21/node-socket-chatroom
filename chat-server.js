// // Require the packages we will use:
// var http = require("http"),
// 	// socketio = require("socket.io"),
// 	fs = require("fs");

// // citation: https://www.youtube.com/watch?v=jD7FnbI76Hg&t=2323s
// const {
// 	userJoin
// 	} = require('./users.js');
// // end of citation

// const port = 3456;
// const file = "client.html";
// // Listen for HTTP connections.  This is essentially a miniature static file server that only serves our one file, client.html, on port 3456:
// const server = http.createServer(function(req, resp){
// 	// This callback runs when a new connection is made to our HTTP server.
	
// 	fs.readFile(file, function(err, data){
// 		// This callback runs when the client.html file has been read from the filesystem.
		
// 		if(err) return resp.writeHead(500);
// 		resp.writeHead(200);
// 		resp.end(data);
// 	});
// });
// server.listen(port);

// // Import Socket.IO and pass our HTTP server object to it.
// // const socketio = require("socket.io")(server);
// const socketio = require("socket.io")(http, {wsEngine: 'ws'});

// // Attach our Socket.IO server to our HTTP server to listen
// const io = socketio.listen(server);
// io.sockets.on("connection", function(socket){
// 	// This callback runs when a new Socket.IO connection is established.
// 	// citation: https://www.youtube.com/watch?v=jD7FnbI76Hg&t=2323s
// 	// wah
// 	// join a room
// 	// socket.on("joinRoom", ({ username, room }) => {
// 	// 	const user = userJoin(socket.id, username, room);
// 	// 	socket.join(user.room);
// 	// });

// 	// // broadcast to a room
// 	// socket.broadcast.to(user.room).emit(
// 	// 	"message_to_client", { message: `${user.username} has joined the chat!` }
// 	// );
// 	// wah
// 	// end of citation

// 	socket.on('message_to_server', function(data) {
// 		// This callback runs when the server receives a new message from the client.
		
// 		console.log("message: "+data["message"]); // log it to the Node.JS output
// 		io.sockets.emit("message_to_client",{message:data["message"] }) // broadcast the message to other users
// 	});
// });


// break
// Require the packages we will use:
const http = require("http"),
    fs = require("fs");

const port = 3456;
const file = "client.html";
// Listen for HTTP connections.  This is essentially a miniature static file server that only serves our one file, client.html, on port 3456:
const server = http.createServer(function (req, res) {
    // This callback runs when a new connection is made to our HTTP server.

    fs.readFile(file, function (err, data) {
        // This callback runs when the client.html file has been read from the filesystem.

        if (err) return res.writeHead(500);
        res.writeHead(200);
        res.end(data);
    });
});
server.listen(port);

// Import Socket.IO and pass our HTTP server object to it.
const socketio = require("socket.io")(server, {
    wsEngine: 'ws'
});

// array storing usernames; use array.includes() to see if username already exists, array.push()
let usernames = []; // todo: don't need this, just use users.keys() instead
let users = {}; // dictionary of (nickname, socket)
let rooms = new Map(); // map of ["roomname", [username1, username2, ...]] 
// let rooms = new Map(); // map of roomname to (array of users, password)
// list of rooms can be accessed with io.sockets.adapter.rooms?

// Attach our Socket.IO server to our HTTP server to listen
const io = socketio.listen(server);
io.sockets.on("connection", function (socket) {
	// This callback runs when a new Socket.IO connection is established.

	// wah
	socket.on('new_user', function({ username: username }) {
		console.log(`inside socket new_user ${username}`);

		if(usernames.includes(username)) {
			socket.emit("new_user_denied", { message : `Username "${username}" already exists.`} );
		} else {
			usernames.push(username);
			socket.emit("new_user_added", { message : `Welcome, ${username}`} );
			
			// emit list of rooms available
			// console.log("room keys: " + Array.from(rooms.keys()));
			// console.log("roomusers: " + socket.roomUsers);
			// console.log("rooms: " + socket.rooms);
			socket.username = username;
			users[username] = socket;
			console.log("username: " + socket.username); // wahwah


			socket.emit("get_rooms", { rooms : Array.from(rooms.keys()) } );
		}

	});

	// wah
	socket.on('new_room', function({ roomname: roomname }) {
		console.log(`inside socket new_room ${roomname}`);

		if(rooms.has(roomname)) {
			socket.emit("new_room_denied", { message : `Roomname "${roomname}" already exists.`, roomname: roomname} );
		} else {
			rooms.set(roomname, []);
			io.sockets.emit("new_room_added", { message : `${roomname} has been created.`, roomname: roomname } );
			io.sockets.emit("get_rooms", { rooms : Array.from(rooms.keys()) } );
			// socket.emit("new_room_added", { message : `${roomname} has been created.`, roomname: roomname } );
			// socket.emit("get_rooms", { rooms : Array.from(rooms.keys()) } );
		}

	});
	
	// wah
	socket.on('enter_room', function({ roomname : roomname, username: username }) {
		rooms.get(roomname).push(username);
		console.log(`inside socket enter_room ${roomname}`);
		// fs.readFile("room.html", function (err, data) {
		// 	// data is the contents of the files			
		// 	if (err) return res.writeHead(500);
		// 	res.writeHead(200);
		// 	res.end(data);
		// });

		socket.join(roomname);
		io.sockets.to(roomname).emit(
			"message_to_client", { message: `${username} has joined the chatroom.` }
		);


		// moved this chunk to inside 'enter_room'
		socket.on('message_to_server', function (data) {
			// This callback runs when the server receives a new message from the client.
			console.log("message: " + data["message"]); // log it to the Node.JS output
			// io.to(roomname).emit(data["message"]); // wah
			let message = data["user"] + ": " + data["message"];
			io.sockets.to(roomname).emit("message_to_client", { message: message }) // broadcast the message to other users
		});

		socket.on('whisper_to_server', function (data) {
			// This callback runs when the server receives a new message from the client.
			let whisper = data["user"] + " sent a private message: " + data["whisper"];
			console.log(whisper); // log it to the Node.JS output
			console.log("target socket: " + users[data["target"]]);
			io.sockets.to(users[data["target"]].id).emit("message_to_client", { message: whisper }) // wahwah not working
		});

		// leave room
		socket.on("leave_room", function (data) {
			socket.leave(roomname);
			io.sockets.to(roomname).emit(
				"message_to_client", { message: `${username} has left the chatroom.` }
			);
		});
	});

	socket.on("get_room_users", function(data) {
		let roomUsers = "Room users:";
		// console.log("room users: " + rooms.get(data["roomname"]));
		rooms.get(data["roomname"]).forEach(userInRoom => {
			roomUsers = roomUsers + " " + userInRoom;
		});
		io.sockets.to(data["roomname"]).emit(
			"get_room_users", { message: roomUsers }
		);
	});
	// wah

    
});