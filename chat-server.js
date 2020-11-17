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
let connectedSockets = []; // wahwahwah
let usernames = []; // todo: don't need this, just use users.keys() instead
let users = {}; // dictionary of (nickname, socket)
let rooms = []; // array of room objects (roomname, array of users, password, creatorSocket, bannedUsers)
let profanities = ["fuck", "shit", "asshole", "whore", "bitch", "motherfucker"];
// list of rooms can be accessed with io.sockets.adapter.rooms?

// Attach our Socket.IO server to our HTTP server to listen
const io = socketio.listen(server);
io.sockets.on("connection", function (socket) {
	// This callback runs when a new Socket.IO connection is established.

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
			connectedSockets.push(socket); // wahwahwah


			users[username] = socket;
			console.log("username: " + socket.username); // wahwah


			const sentRooms = [];
			rooms.forEach(room => {
				sentRooms.push({ roomname: room.roomname, room_users: room.room_users, hasPassword: (room.password != "") });
			});
			socket.emit("get_rooms", { rooms : sentRooms } );
			// socket.emit("get_rooms", { rooms : Array.from(rooms.keys()) } );
		}

	});

	// wah
	socket.on('new_room', function({ roomname: roomname, password: password }) {
		console.log(`inside socket new_room ${roomname}`);
		// console.log("io.sockets.adapter.rooms.get: " + io.sockets.adapter.rooms[roomname]);
		// console.log("nsps: " + io.nsps[yourNamespace].adapter.rooms[roomname]);

		let duplicateRoomname = rooms.some(room => (room.roomname == roomname));
		// if(rooms.has(roomname)) {
		if(duplicateRoomname) {
			socket.emit("new_room_denied", { message : `Roomname "${roomname}" already exists.`, roomname: roomname} );
		} else {
			rooms.push({roomname: roomname, room_users: [], password: password, creator_socket: socket, banned_users: [] });
			console.log("new_room rooms: " + rooms.toString());
			// rooms.set(roomname, { "room_users": [], "password": password, "creator_socket": socket });
			io.sockets.emit("new_room_added", { message : `${roomname} has been created.`, roomname: roomname } );

			const sentRooms = [];
			rooms.forEach(room => {
				sentRooms.push({ roomname: room.roomname, room_users: room.room_users, hasPassword: (room.password != "") });
			});
			socket.emit("get_rooms", { rooms : sentRooms } );
			// io.sockets.emit("get_rooms", { rooms : Array.from(rooms.keys())/*, password_protected: password_protected, password: rooms.get(roomname)["password"] */} );
			// socket.emit("new_room_added", { message : `${roomname} has been created.`, roomname: roomname } );
			// socket.emit("get_rooms", { rooms : Array.from(rooms.keys()) } );
		}

	});

	// socket.on("get_rooms", function(data) {
	// 	const sentRooms = [];
	// 	rooms.forEach(room => {
	// 		sentRooms.push({ roomname: room.roomname, room_users: room.room_users, hasPassword: (room.password != "") });
	// 	});
	// 	socket.emit("get_rooms", { rooms : sentRooms } );
	// });
	
	// wah
	socket.on("request_enter_room", function({ roomname : roomname, hasPassword: hasPassword, username: username }) {
		// room password
		// if(rooms.get(roomname)["password"] != "") {
		if(hasPassword) {
			// verify password
			socket.emit("enter_password", {} );
			// socket.on("enter_password", function({ password_guess: password_guess }) {
			// 	if(password_guess.toString() == rooms.get(roomname)["password"]) {
			// 		// allow user to enter
			// 		console.log("inside password protected room");
			// 		socket.emit("password_check", { password_correct: true });
			// 	} else {
			// 		// emit message saying "Incorrect password."
			// 		console.log("incorrect password");
			// 		socket.emit("password_check", { password_correct: false });
			// 		// break out of function? how?
			// 		//return;
			// 	}
			// });
		} else {
			console.log("WAH");
			socket.emit("password_check", { password_correct: true });
		}
	});

	// moved to outside
	socket.on("enter_protected_room", function({ password_guess: password_guess, roomname: roomname }) {
		// if(password_guess.toString() == rooms.get(roomname)["password"]) {
		let pw;
		rooms.forEach(room => {
			if(room.roomname == roomname) pw = room.password;
		});
		if(password_guess.toString() != null && password_guess.toString() == pw) {
			// allow user to enter
			console.log("inside password protected room");
			socket.emit("password_check", { password_correct: true, roomname: roomname });
		} else {
			// emit message saying "Incorrect password."
			console.log("incorrect password");
			socket.emit("password_check", { password_correct: false, roomname: roomname });
			// break out of function? how?
			//return;
		}
	});

	socket.on('enter_room', function({ roomname : roomname, username: username }) {
		console.log("ENTER");
		let room;
		rooms.forEach(r => {
			if(r.roomname == roomname) {
				r.room_users.push(username);
				room = r;
			}
		});
		socket.room = roomname; // wahwahwah
		console.log(`inside socket enter_room ${roomname}`);

		socket.join(roomname);

		console.log("room.room_users: " + room.room_users);
		let roomUsers = "Room users: " + room.room_users.join(", ");
		io.sockets.to(roomname).emit("get_room_users", { message: roomUsers });

		io.sockets.to(roomname).emit(
			"message_to_client", { message: `${username} has joined the chatroom.` }
		);


		// moved this chunk to inside 'enter_room'
		socket.on('message_to_server', function (data) {
			// This callback runs when the server receives a new message from the client.
			console.log("message: " + data["message"]); // log it to the Node.JS output
			// io.to(roomname).emit(data["message"]); // wah
			let message = data["user"] + ": " + data["message"];
			// creative portion: replace swear words with *
			profanities.forEach(word => {
				message = message.replace(word, "*".repeat(word.length));
			});
			io.sockets.to(roomname).emit("message_to_client", { message: message }) // broadcast the message to other users
		});

		socket.on('whisper_to_server', function (data) {
			// This callback runs when the server receives a new message from the client.
			let whisper = data["user"] + " sent a private message to " + data["target"] + ": " + data["whisper"];
			console.log(whisper); // log it to the Node.JS output
			socket.emit("message_to_client", { message: whisper }); // wah added just now
			io.sockets.to(users[data["target"]].id).emit("message_to_client", { message: whisper });
		});

		socket.on("kick", function(data) {
			console.log("inside kick");
			let roomname = data.roomname;
			let room;
			for(r of rooms) {
				if (r.roomname == roomname) {
					room = r;
				}
			}
			if(socket.username == r.creator_socket.username) {
				console.log("you are the creator");
				connectedSockets.forEach(s => {
					console.log("connected s: " + s.username);
					if(s.username == data.target) {
						s.leave(roomname);
						s.emit("you_are_kicked", {});
						console.log("s.username: " + s.username);

						// remove data.target from rooms map
						let usersArr = r.room_users;
						const index = usersArr.indexOf(data.username);
						if(index > -1) {
							usersArr.splice(index, 1);
						}
						room.room_users = usersArr;
						// let message = data.target + " has been kicked by " + socket.username;
						let message = data.target + " has been kicked by " + data.username;
						io.sockets.to(roomname).emit("message_to_client", { message: message })
						console.log("kick msg: " + message); // ?? says kick msg: e has been kicked by e; target correct, but socket.username weird
						// ?? message shows up in e (kicked person)'s chatlog
						// update room users
						let roomUsers = "Room users: " + room.room_users.join(", ");
						io.sockets.to(roomname).emit("get_room_users", { message: roomUsers });					}
				});
			}
		});

		socket.on("ban", function(data) {
			if(socket.username == rooms.get(roomname)["creator_socket"].username) {
				connectedSockets.forEach(s => {
					if(s.username = data["target"]) {
						s.leave(roomname);
						s.emit("you_are_banned", {}); 
						// todo: remove data["target"] from rooms map
						// todo: add data["target"] to list of banned users
						console.log("socket.username: " + socket.username);
						let message = data["target"] + " has been banned by " + socket.username;
						io.sockets.to(roomname).emit("message_to_client", { message: message })
					}
				});
			}
		});



		// // leave room
		// socket.on("leave_room", function (data) {
		// 	// socket.removeAllListeners('enter_room'); // sus
		// 	// socket.removeListener("enter_room");
		// 	// getEventListeners(socket)['enter_room'][0].remove();
		// 	socket.leave(roomname);
		// 	socket.room = ""; // wahwahwah
		// 	console.log("sockets: " + connectedSockets);

		// 	// delete user from rooms map
		// 	let leavingUser = data.username;
		// 	let room;
		// 	for(r of rooms) {
		// 		if(r.roomname == roomname) {
		// 			room = r;
		// 		}
		// 	}
		// 	let usersArr = r.room_users;
		// 	console.log("before roomUsers: " + usersArr);
		// 	const index = usersArr.indexOf(leavingUser);
		// 	if(index > -1) {
		// 		usersArr.splice(index, 1);
		// 	}
		// 	room.room_users = usersArr;
		// 	let roomUsers = "Room users: " + room.room_users.join(", ");
		// 	console.log("after roomUsers: " + room.room_users.toString());

		// 	io.sockets.to(roomname).emit("get_room_users", { message: roomUsers });

		// 	io.sockets.to(roomname).emit(
		// 		"message_to_client", { message: `${leavingUser} has left the chatroom.` }
		// 	);
		// });
	});

			// leave room moved to outside
			socket.on("leave_room", function (data) {
				// socket.removeAllListeners('enter_room'); // sus
				// socket.removeListener("enter_room");
				// getEventListeners(socket)['enter_room'][0].remove();
				const roomname = data.roomname;
				const leavingUser = data.username;
				socket.leave(roomname);
				socket.room = ""; // wahwahwah
				console.log("sockets: " + connectedSockets);
	
				// delete user from rooms map
				let room;
				for(r of rooms) {
					if(r.roomname == roomname) {
						room = r;
					}
				}
				let usersArr = r.room_users;
				console.log("before roomUsers: " + usersArr);
				const index = usersArr.indexOf(leavingUser);
				if(index > -1) {
					usersArr.splice(index, 1);
				}
				room.room_users = usersArr;
				let roomUsers = "Room users: " + room.room_users.join(", ");
				console.log("after roomUsers: " + room.room_users.toString());
	
				io.sockets.to(roomname).emit("get_room_users", { message: roomUsers });
	
				io.sockets.to(roomname).emit(
					"message_to_client", { message: `${leavingUser} has left the chatroom.` }
				);
			});

    
});