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

let connectedSockets = [];
let usernames = []; // todo: don't need this, just use users.keys() instead
let users = {}; // dictionary of (nickname, socket)
let rooms = []; // array of room objects (roomname, array of users, password, creatorSocket, bannedUsers)
let profanities = ["fuck", "shit", "asshole", "ass", "whore", "bitch", "motherfucker"];

function getCurrentTime() {
	return new Date().toLocaleTimeString('en-US');
}
// list of rooms can be accessed with io.sockets.adapter.rooms?

// Attach our Socket.IO server to our HTTP server to listen
const io = socketio.listen(server);
io.sockets.on("connection", function (socket) {
	// This callback runs when a new Socket.IO connection is established.

	socket.on('new_user', function({ username: username }) {

		if(usernames.includes(username)) {
			socket.emit("new_user_denied", { message : `Username "${username}" already exists.`} );
		} else {
			usernames.push(username);
			socket.emit("new_user_added", { message : `Welcome, ${username}`} );
		
			socket.username = username;
			connectedSockets.push(socket);


			users[username] = socket;
			console.log("username: " + socket.username);


			const sentRooms = [];
			rooms.forEach(room => {
				sentRooms.push({ roomname: room.roomname, room_users: room.room_users, hasPassword: (room.password != ""), banned_users: room.banned_users, announcement: room.announcement });
			});
			socket.emit("get_rooms", { rooms : sentRooms } );
		}

	});

	socket.on('new_room', function({ roomname: roomname, password: password }) {
		// console.log("io.sockets.adapter.rooms.get: " + io.sockets.adapter.rooms[roomname]);
		// console.log("nsps: " + io.nsps[yourNamespace].adapter.rooms[roomname]);

		let duplicateRoomname = rooms.some(room => (room.roomname == roomname));
		if(duplicateRoomname) {
			socket.emit("new_room_denied", { message : `Roomname "${roomname}" already exists.`, roomname: roomname} );
		} else {
			rooms.push({roomname: roomname, room_users: [], password: password, creator_socket: socket, banned_users: [], announcement: "" });
			io.sockets.emit("new_room_added", { message : `${roomname} has been created.`, roomname: roomname } );

			const sentRooms = [];
			rooms.forEach(room => {
				sentRooms.push({ roomname: room.roomname, room_users: room.room_users, hasPassword: (room.password != ""), banned_users: room.banned_users, announcement: room.announcement });
			});
			socket.emit("get_rooms", { rooms : sentRooms } );
		}

	});

	socket.on("request_enter_room", function({ roomname : roomname, hasPassword: hasPassword, username: username }) {
		// room password
		if(hasPassword) {
			// verify password
			socket.emit("enter_password", {} );
		} else {
			socket.emit("password_check", { password_correct: true });
		}
	});

	// moved to outside
	socket.on("enter_protected_room", function({ password_guess: password_guess, roomname: roomname }) {
		let pw;
		rooms.forEach(room => {
			if(room.roomname == roomname) pw = room.password;
		});
		if(password_guess.toString() != null && password_guess.toString() == pw) {
			// allow user to enter
			socket.emit("password_check", { password_correct: true, roomname: roomname });
		} else {
			console.log("incorrect password");
			socket.emit("password_check", { password_correct: false, roomname: roomname });
		}
	});

	socket.on('enter_room', function({ roomname : roomname, username: username }) {
		let room;
		rooms.forEach(r => {
			if(r.roomname == roomname) {
				r.room_users.push(username);
				room = r;
			}
		});
		socket.room = roomname; // wahwahwah

		socket.join(roomname);

		let roomUsers = "Room users: " + room.room_users.join(", ");
		io.sockets.to(roomname).emit("get_room_users", { message: roomUsers });

		io.sockets.to(roomname).emit(
			"message_to_client", { message: `${username} has joined the chatroom.`/*, announcement: room.announcement */}
		);
		io.sockets.to(roomname).emit("announce", { announcement: room.announcement });
	});

	// moved this chunk to outside 'enter_room'
			socket.on('message_to_server', function (data) {
				// This callback runs when the server receives a new message from the client.
				// io.to(roomname).emit(data["message"]); // wah
				let message = data["user"] + ": " + data["message"];
				// creative portion: replace swear words with *
				profanities.forEach(word => {
					message = message.replace(word, "*".repeat(word.length));
				});
				io.sockets.to(data.roomname).emit("message_to_client", { message: message, time: getCurrentTime() }); // broadcast the message to other users
			});
	
			socket.on('whisper_to_server', function (data) {
				// This callback runs when the server receives a new message from the client.
				let whisper = data["user"] + " sent a private message to " + data["target"] + ": " + data["whisper"];
				socket.emit("message_to_client", { message: whisper, time: getCurrentTime() }); // wah added just now
				io.sockets.to(users[data["target"]].id).emit("message_to_client", { message: whisper, time: getCurrentTime() });
			});

	socket.on("announce", function(data) {
		let roomname = data.roomname;
		let room;
		for(r of rooms) {
			if (r.roomname == roomname) {
				room = r;
			}
		}
		if(socket.username == room.creator_socket.username) {
			io.sockets.to(roomname).emit("announce", { announcement: data.announcement });

			// add announcement to rooms
			room.announcement = data.announcement;
		}

	});

	socket.on("kick", function(data) {
		let roomname = data.roomname;
		let room;
		for(r of rooms) {
			if (r.roomname == roomname) {
				room = r;
			}
		}
		if(socket.username == room.creator_socket.username) {
			connectedSockets.forEach(s => {
				console.log("connected s: " + s.username);
				if(s.username == data.target) {
					s.leave(roomname);
					s.emit("you_are_kicked", {});
					console.log("s.username: " + s.username);

					// remove data.target from rooms map
					let usersArr = r.room_users;
					const index = usersArr.indexOf(data.target);
					if(index > -1) {
						usersArr.splice(index, 1);
					}
					room.room_users = usersArr;
					let message = data.target + " has been kicked by " + data.username;
					io.sockets.to(roomname).emit("message_to_client", { message: message })
					// update room users
					let roomUsers = "Room users: " + room.room_users.join(", ");
					io.sockets.to(roomname).emit("get_room_users", { message: roomUsers });					
				}
			});
		}
	});

	socket.on("ban", function(data) {
		let roomname = data.roomname;
		let room;
		for(r of rooms) {
			if (r.roomname == roomname) {
				room = r;
			}
		}
		if(socket.username == room.creator_socket.username) {
			connectedSockets.forEach(s => {
				console.log("connected s: " + s.username);
				if(s.username == data.target) {
					s.leave(roomname);
					s.emit("you_are_banned", {});


					// remove data.target from rooms map
					let usersArr = r.room_users;
					const index = usersArr.indexOf(data.target);
					if(index > -1) {
						usersArr.splice(index, 1);
					}
					room.room_users = usersArr;

					// add data.target to banned_users and send rooms again
					room.banned_users.push(data.target);
					const sentRooms = [];
					rooms.forEach(r => {
						console.log("r.bannedUsers: " + r.banned_users);
						sentRooms.push({ roomname: r.roomname, room_users: r.room_users, hasPassword: (r.password != ""), banned_users: r.banned_users, announcement: r.announcement });
					});
					s.emit("get_rooms", { rooms : sentRooms } );

					let message = data.target + " has been banned by " + data.username;
					io.sockets.to(roomname).emit("message_to_client", { message: message })
					// update room users
					let roomUsers = "Room users: " + room.room_users.join(", ");
					io.sockets.to(roomname).emit("get_room_users", { message: roomUsers });
					
				}
			});
		}
	});

	// leave room moved to outside
	socket.on("leave_room", function (data) {
		const roomname = data.roomname;
		const leavingUser = data.username;
		socket.leave(roomname);
		socket.room = ""; // wahwahwah
	
		// delete user from rooms map
		let room;
		for(r of rooms) {
			if(r.roomname == roomname) {
				room = r;
			}
		}
		let usersArr = r.room_users;
		const index = usersArr.indexOf(leavingUser);
		if(index > -1) {
			usersArr.splice(index, 1);
		}
		room.room_users = usersArr;
		let roomUsers = "Room users: " + room.room_users.join(", ");
	
		io.sockets.to(roomname).emit("get_room_users", { message: roomUsers });
	
		io.sockets.to(roomname).emit(
			"message_to_client", { message: `${leavingUser} has left the chatroom.` }
		);
	});

    
});