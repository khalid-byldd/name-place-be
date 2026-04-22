# API Documentation

**Base URL:** `/api/v1`

**Authentication:** All endpoints except `/auth/login` and `/players` endpoints require authentication via Bearer token.

---

## Table of Contents

1. [Health](#health)
2. [Auth](#auth)
3. [Categories](#categories)
4. [Players](#players)
5. [Rooms](#rooms)
6. [Rounds](#rounds)
7. [Dashboard](#dashboard)
8. [WebSocket Events](#websocket-events)

---

## Health

### Health Check

**Endpoint:** `GET /health`

**Authentication:** None

**Description:** Check if the server is running

**Response:**

```json
{
  "status": "ok"
}
```

---

## Auth

### Login

**Endpoint:** `POST /auth/login`

**Authentication:** None

**Description:** Login as admin (requires admin role)

**Body:**

```json
{
  "email": "admin@example.com",
  "password": "password123"
}
```

**Response (200 OK):**

```json
{
  "message": "Login successful",
  "user": {
    "id": 1,
    "email": "admin@example.com",
    "role": "ADMIN",
    "token": "MTo0ZGdtQGV4YW1wbGUuY29t"
  }
}
```

**Errors:**

```json
// Invalid credentials
{
  "status": 401,
  "message": "Invalid credentials"
}

// User is not admin
{
  "status": 403,
  "message": "Only admins can login"
}
```

---

### Get Current User

**Endpoint:** `GET /auth/me`

**Authentication:** Required (Bearer token)

**Description:** Get current authenticated user profile

**Response (200 OK):**

```json
{
  "id": 1,
  "email": "admin@example.com",
  "role": "ADMIN"
}
```

**Errors:**

```json
{
  "status": 404,
  "message": "User not found"
}
```

---

## Categories

### Create Category

**Endpoint:** `POST /categories`

**Authentication:** Required (Bearer token)

**Authorization:** Admin only

**Description:** Create a new game category

**Body:**

```json
{
  "name": "Movies"
}
```

**Response (201 Created):**

```json
{
  "message": "Category created successfully",
  "category": {
    "id": 1,
    "name": "Movies",
    "createdAt": "2026-04-21T10:30:00Z"
  }
}
```

**Errors:**

```json
// Category name required
{
  "status": 400,
  "message": "Category name is required"
}

// Category already exists
{
  "status": 400,
  "message": "Category with this name already exists"
}
```

---

### Get All Categories

**Endpoint:** `GET /categories`

**Authentication:** None

**Query Parameters:**

- `limit` (optional): Max results (default: 100)
- `offset` (optional): Offset for pagination (default: 0)

**Response (200 OK):**

```json
{
  "categories": [
    {
      "id": 1,
      "name": "Movies",
      "createdAt": "2026-04-21T10:30:00Z",
      "updatedAt": "2026-04-21T10:30:00Z"
    },
    {
      "id": 2,
      "name": "Sports",
      "createdAt": "2026-04-21T10:31:00Z",
      "updatedAt": "2026-04-21T10:31:00Z"
    }
  ],
  "count": 2
}
```

---

### Get Category

**Endpoint:** `GET /categories/:categoryId`

**Authentication:** None

**Parameters:**

- `categoryId` (path): Category ID (integer)

**Response (200 OK):**

```json
{
  "id": 1,
  "name": "Movies",
  "createdAt": "2026-04-21T10:30:00Z",
  "updatedAt": "2026-04-21T10:30:00Z"
}
```

**Errors:**

```json
{
  "status": 404,
  "message": "Category not found"
}
```

---

### Update Category

**Endpoint:** `PUT /categories/:categoryId`

**Authentication:** Required (Bearer token)

**Authorization:** Admin only

**Parameters:**

- `categoryId` (path): Category ID (integer)

**Body:**

```json
{
  "name": "Hollywood Movies"
}
```

**Response (200 OK):**

```json
{
  "message": "Category updated successfully",
  "category": {
    "id": 1,
    "name": "Hollywood Movies",
    "updatedAt": "2026-04-21T10:40:00Z"
  }
}
```

**Errors:**

```json
// Category not found
{
  "status": 404,
  "message": "Category not found"
}

// Empty name
{
  "status": 400,
  "message": "Category name cannot be empty"
}

// Duplicate name
{
  "status": 400,
  "message": "Category with this name already exists"
}
```

---

### Delete Category

**Endpoint:** `DELETE /categories/:categoryId`

**Authentication:** Required (Bearer token)

**Authorization:** Admin only

**Parameters:**

- `categoryId` (path): Category ID (integer)

**Response (200 OK):**

```json
{
  "message": "Category deleted successfully"
}
```

**Errors:**

```json
{
  "status": 404,
  "message": "Category not found"
}
```

---

## Players

### Create Player

**Endpoint:** `POST /players`

**Authentication:** None

**Description:** Create a new player (no authentication required)

**Body:**

```json
{
  "name": "John Doe"
}
```

**Response (201 Created):**

```json
{
  "message": "Player created successfully",
  "player": {
    "id": 1,
    "name": "John Doe",
    "roomId": null,
    "status": "ACTIVE",
    "createdAt": "2026-04-20T10:30:00Z"
  }
}
```

**Errors:**

```json
{
  "status": 400,
  "message": "Player name is required"
}
```

---

### Get Player

**Endpoint:** `GET /players/:playerId`

**Authentication:** None

**Parameters:**

- `playerId` (path): Player ID (integer)

**Response (200 OK):**

```json
{
  "id": 1,
  "name": "John Doe",
  "roomId": 1,
  "status": "ACTIVE",
  "isBanned": false,
  "createdAt": "2026-04-20T10:30:00Z",
  "updatedAt": "2026-04-20T10:35:00Z"
}
```

**Errors:**

```json
{
  "status": 404,
  "message": "Player not found"
}
```

---

### Update Player

**Endpoint:** `PUT /players/:playerId`

**Authentication:** None

**Parameters:**

- `playerId` (path): Player ID (integer)

**Body:**

```json
{
  "name": "Jane Doe",
  "status": "INACTIVE"
}
```

**Response (200 OK):**

```json
{
  "message": "Player updated successfully",
  "player": {
    "id": 1,
    "name": "Jane Doe",
    "roomId": 1,
    "status": "INACTIVE",
    "updatedAt": "2026-04-20T10:40:00Z"
  }
}
```

---

### Join Room

**Endpoint:** `POST /players/:playerId/join-room`

**Authentication:** None

**Parameters:**

- `playerId` (path): Player ID (integer)

**Body:**

```json
{
  "code": "ABC123"
}
```

**Response (200 OK):**

```json
{
  "message": "Joined room successfully",
  "player": {
    "id": 1,
    "name": "John Doe",
    "roomId": 1,
    "status": "ACTIVE"
  },
  "room": {
    "id": 1,
    "name": "My Room",
    "code": "ABC123"
  }
}
```

**Errors:**

```json
// Player not found
{
  "status": 404,
  "message": "Player not found"
}

// Player is banned
{
  "status": 403,
  "message": "Player is banned"
}

// Room not found
{
  "status": 404,
  "message": "Room not found"
}

// Room not in correct status
{
  "status": 400,
  "message": "Cannot join room with status FINISHED. Room must be WAITING or IN_PROGRESS"
}
```

---

### Leave Room

**Endpoint:** `POST /players/:playerId/leave-room`

**Authentication:** None

**Parameters:**

- `playerId` (path): Player ID (integer)

**Response (200 OK):**

```json
{
  "message": "Left room successfully",
  "player": {
    "id": 1,
    "name": "John Doe",
    "roomId": null,
    "status": "ACTIVE"
  }
}
```

**Errors:**

```json
{
  "status": 404,
  "message": "Player not found"
}
```

---

### Ban Player

**Endpoint:** `POST /players/:playerId/ban`

**Authentication:** Required (Bearer token)

**Authorization:** Admin only

**Parameters:**

- `playerId` (path): Player ID (integer)

**Body:**

```json
{
  "reason": "Cheating"
}
```

**Response (200 OK):**

```json
{
  "message": "Player banned successfully",
  "playerId": 1,
  "reason": "Cheating"
}
```

**Errors:**

```json
{
  "status": 404,
  "message": "Player not found"
}
```

---

### Delete Player

**Endpoint:** `DELETE /players/:playerId`

**Authentication:** None

**Parameters:**

- `playerId` (path): Player ID (integer)

**Response (200 OK):**

```json
{
  "message": "Player deleted successfully"
}
```

---

### Get Players in Room

**Endpoint:** `GET /players/room/:roomId`

**Authentication:** None

**Parameters:**

- `roomId` (path): Room ID (integer)

**Response (200 OK):**

```json
{
  "roomId": 1,
  "players": [
    {
      "id": 1,
      "name": "John Doe",
      "status": "ACTIVE",
      "roomId": 1
    },
    {
      "id": 2,
      "name": "Jane Doe",
      "status": "ACTIVE",
      "roomId": 1
    }
  ],
  "playerCount": 2
}
```

---

## Rooms

### Create Room

**Endpoint:** `POST /rooms`

**Authentication:** Required (Bearer token)

**Description:** Create a new room with auto-generated code and rounds

**Body:**

```json
{
  "name": "Game Room 1",
  "roundCount": 5,
  "roundTime": 60,
  "categoryIds": [1, 2, 3, 4]
}
```

**Notes:**

- `categoryIds` is optional (4 random categories selected if not provided)
- `roundTime` is in seconds (max 90 seconds)
- Automatically creates all rounds and round answers

**Response (201 Created):**

```json
{
  "message": "Room created successfully",
  "room": {
    "id": 1,
    "name": "Game Room 1",
    "code": "ABC123",
    "roundCount": 5,
    "roundTime": 60,
    "currentRound": 0,
    "categoryIds": [1, 2, 3, 4],
    "status": "WAITING",
    "createdAt": "2026-04-20T10:30:00Z"
  }
}
```

**Errors:**

```json
{
  "status": 400,
  "message": "Name, roundCount, and roundTime are required"
}
```

---

### Get All Rooms

**Endpoint:** `GET /rooms`

**Authentication:** Required (Bearer token)

**Query Parameters:**

- `limit` (optional): Max results (default: 50)
- `offset` (optional): Offset for pagination (default: 0)

**Response (200 OK):**

```json
{
  "rooms": [
    {
      "id": 1,
      "name": "Game Room 1",
      "code": "ABC123",
      "roundCount": 5,
      "roundTime": 60,
      "currentRound": 0,
      "roundStartedAt": null,
      "status": "WAITING",
      "playerCount": 2,
      "createdAt": "2026-04-20T10:30:00Z"
    }
  ],
  "count": 1
}
```

---

### Get Room by ID

**Endpoint:** `GET /rooms/:roomId`

**Authentication:** Required (Bearer token)

**Parameters:**

- `roomId` (path): Room ID (integer)

**Response (200 OK):**

```json
{
  "id": 1,
  "name": "Game Room 1",
  "code": "ABC123",
  "roundCount": 5,
  "roundTime": 60,
  "currentRound": 1,
  "roundStartedAt": "2026-04-20T10:30:00Z",
  "categoryIds": [1, 2, 3, 4],
  "status": "IN_PROGRESS",
  "playerCount": 2,
  "createdAt": "2026-04-20T10:30:00Z",
  "updatedAt": "2026-04-20T10:35:00Z"
}
```

---

### Get Room by Code

**Endpoint:** `GET /rooms/code/:code`

**Authentication:** Required (Bearer token)

**Parameters:**

- `code` (path): Room code (string)

**Response (200 OK):**

```json
{
  "id": 1,
  "name": "Game Room 1",
  "code": "ABC123",
  "roundCount": 5,
  "roundTime": 60,
  "currentRound": 1,
  "roundStartedAt": "2026-04-20T10:30:00Z",
  "categoryIds": [1, 2, 3, 4],
  "status": "IN_PROGRESS",
  "playerCount": 2,
  "createdAt": "2026-04-20T10:30:00Z",
  "updatedAt": "2026-04-20T10:35:00Z"
}
```

---

### Start Room

**Endpoint:** `POST /rooms/:roomId/start`

**Authentication:** Required (Bearer token)

**Authorization:** Admin only

**Parameters:**

- `roomId` (path): Room ID (integer)

**Description:** Start a room (change status from WAITING to IN_PROGRESS)

**Response (200 OK):**

```json
{
  "roomId": 1,
  "status": "IN_PROGRESS",
  "currentRound": 1,
  "roundStartedAt": "2026-04-20T10:30:00Z",
  "roundTime": 60,
  "roundCount": 5,
  "message": "Room started successfully"
}
```

**Errors:**

```json
{
  "status": 400,
  "message": "Room can only be started from WAITING status"
}
```

---

### Broadcast Admin Message

**Endpoint:** `POST /rooms/:roomId/broadcast-message`

**Authentication:** Required (Bearer token)

**Authorization:** Admin only

**Parameters:**

- `roomId` (path): Room ID (integer)

**Description:** Broadcast a message to all players (room must be IN_PROGRESS)

**Body:**

```json
{
  "message": "Round 2 starting now!"
}
```

**Response (200 OK):**

```json
{
  "message": "Message broadcasted successfully",
  "roomId": 1,
  "broadcastedMessage": "Round 2 starting now!"
}
```

**Errors:**

```json
{
  "status": 400,
  "message": "Cannot broadcast message. Room status is WAITING. Room must be IN_PROGRESS."
}
```

---

### Update Room

**Endpoint:** `PUT /rooms/:roomId`

**Authentication:** Required (Bearer token)

**Authorization:** Admin only

**Parameters:**

- `roomId` (path): Room ID (integer)

**Body:**

```json
{
  "name": "Updated Room Name",
  "roundCount": 3,
  "roundTime": 45,
  "status": "IN_PROGRESS"
}
```

**Response (200 OK):**

```json
{
  "message": "Room updated successfully",
  "room": {
    "id": 1,
    "name": "Updated Room Name",
    "code": "ABC123",
    "roundCount": 3,
    "roundTime": 45,
    "status": "IN_PROGRESS",
    "updatedAt": "2026-04-20T10:40:00Z"
  }
}
```

---

### Close Room

**Endpoint:** `DELETE /rooms/:roomId`

**Authentication:** Required (Bearer token)

**Authorization:** Admin only

**Parameters:**

- `roomId` (path): Room ID (integer)

**Description:** Close a room and delete all associated players

**Response (200 OK):**

```json
{
  "message": "Room closed successfully"
}
```

---

### Get Connected Players in Room

**Endpoint:** `GET /rooms/:roomId/players-connected`

**Authentication:** Required (Bearer token)

**Parameters:**

- `roomId` (path): Room ID (integer)

**Description:** Get list of players currently connected via WebSocket

**Response (200 OK):**

```json
{
  "roomId": 1,
  "connectedPlayers": [
    {
      "playerId": 1,
      "playerName": "John Doe"
    },
    {
      "playerId": 2,
      "playerName": "Jane Doe"
    }
  ],
  "playerCount": 2
}
```

---

### Check Round Time

**Endpoint:** `POST /rooms/:roomId/check-round-time`

**Authentication:** None

**Parameters:**

- `roomId` (path): Room ID (integer)

**Description:** Check if round time has exceeded (optional fallback - clients should calculate locally)

**Response (200 OK - Time remaining):**

```json
{
  "updated": false,
  "message": "Round in progress. Time remaining: 45s",
  "timeRemaining": 45,
  "currentRound": 1
}
```

**Response (200 OK - Time exceeded):**

```json
{
  "updated": true,
  "message": "Round time exceeded. Moved to round 2",
  "data": {
    "roomId": 1,
    "currentRound": 2,
    "roundCount": 5,
    "status": "IN_PROGRESS",
    "isFinished": false
  }
}
```

---

### Increment Room Round

**Endpoint:** `POST /rooms/:roomId/increment-round`

**Authentication:** Required (Bearer token)

**Authorization:** Admin only

**Parameters:**

- `roomId` (path): Room ID (integer)

**Description:** Increment the current round of a room (with validation that it doesn't exceed roundCount)

**Response (200 OK):**

```json
{
  "message": "Room round incremented successfully",
  "data": {
    "roomId": 1,
    "previousRound": 1,
    "currentRound": 2,
    "roundCount": 5,
    "canIncrement": true
  }
}
```

**Errors:**

```json
// Room not found
{
  "status": 404,
  "message": "Room not found"
}

// Cannot increment (already at max rounds)
{
  "status": 400,
  "message": "Cannot increment. Current round (5) has reached max (5)"
}
```

---

## Rounds

### Get Round

**Endpoint:** `GET /rounds/:roundId`

**Authentication:** None

**Parameters:**

- `roundId` (path): Round ID (integer)

**Response (200 OK):**

```json
{
  "id": 1,
  "roomId": 1,
  "playerId": null,
  "roundNumber": 1,
  "letter": "A",
  "timeTaken": null,
  "score": null,
  "answers": [
    {
      "id": 1,
      "roundId": 1,
      "categoryId": 1,
      "answer": null,
      "createdAt": "2026-04-20T10:30:00Z"
    }
  ],
  "createdAt": "2026-04-20T10:30:00Z"
}
```

---

### Submit Round Answers

**Endpoint:** `POST /rounds/:roundId/submit-answers`

**Authentication:** None

**Parameters:**

- `roundId` (path): Round ID (integer)

**Body:**

```json
{
  "playerId": 1,
  "answers": ["Answer 1", "Answer 2", "Answer 3", "Answer 4"]
}
```

**Description:** Submit answers for a round (one answer per category)

**Response (200 OK):**

```json
{
  "message": "Answers submitted successfully",
  "data": {
    "roundId": 1,
    "playerId": 1,
    "answers": [
      {
        "id": 1,
        "roundId": 1,
        "categoryId": 1,
        "answer": "Answer 1",
        "createdAt": "2026-04-20T10:30:00Z"
      }
    ],
    "submittedAt": "2026-04-20T10:35:00Z"
  }
}
```

**Errors:**

```json
{
  "status": 400,
  "message": "Expected 4 answers, got 3"
}
```

---

### Get Round Answers

**Endpoint:** `GET /rounds/:roundId/answers`

**Authentication:** None

**Parameters:**

- `roundId` (path): Round ID (integer)

**Response (200 OK):**

```json
{
  "roundId": 1,
  "answers": [
    {
      "id": 1,
      "roundId": 1,
      "categoryId": 1,
      "answer": "Answer 1",
      "createdAt": "2026-04-20T10:30:00Z"
    }
  ]
}
```

---

### Get All Rounds in Room

**Endpoint:** `GET /rounds/room/:roomId`

**Authentication:** None

**Parameters:**

- `roomId` (path): Room ID (integer)

**Response (200 OK):**

```json
{
  "roomId": 1,
  "rounds": [
    {
      "id": 1,
      "roomId": 1,
      "roundNumber": 1,
      "letter": "A"
    },
    {
      "id": 2,
      "roomId": 1,
      "roundNumber": 2,
      "letter": "B"
    }
  ],
  "roundCount": 2
}
```

---

### Get All Rounds with Answers for Player

**Endpoint:** `GET /rounds/:roomId/player/:playerId`

**Authentication:** None

**Parameters:**

- `roomId` (path): Room ID (integer)
- `playerId` (path): Player ID (integer)

**Description:** Get all rounds in a room with answers submitted by a specific player

**Response (200 OK):**

```json
{
  "roomId": 1,
  "playerId": 5,
  "playerName": "John",
  "totalRounds": 2,
  "rounds": [
    {
      "id": 1,
      "roomId": 1,
      "roundNumber": 1,
      "letter": "A",
      "timeTaken": 45,
      "score": 100,
      "playerId": 5,
      "answers": [
        {
          "id": 1,
          "categoryId": 2,
          "answer": "Avatar"
        }
      ],
      "createdAt": "2026-04-21T10:30:00Z"
    }
  ]
}
```

**Errors:**

```json
// Room not found
{
  "status": 404,
  "message": "Room not found"
}

// Player not in room
{
  "status": 400,
  "message": "Player is not in this room"
}
```

---

## Dashboard

### Get Dashboard Stats

**Endpoint:** `GET /dashboard`

**Authentication:** Required (Bearer token)

**Authorization:** Admin only

**Description:** Get game statistics

**Response (200 OK):**

```json
{
  "totalRoomsCreated": 10,
  "totalPlayersJoined": 50,
  "activeRooms": 2,
  "totalBannedPlayers": 3
}
```

---

## WebSocket Events

**Connection:** `ws://localhost:3000`

### Connect to Room

**Send:**

```json
{
  "type": "ROOM_JOIN",
  "payload": {
    "roomId": 1,
    "playerId": 5,
    "playerName": "John Doe"
  }
}
```

**Receive:**

```json
{
  "type": "JOIN_SUCCESS",
  "payload": {
    "roomId": 1,
    "roomName": "Game Room 1",
    "roomStatus": "IN_PROGRESS",
    "roundCount": 5,
    "roundTime": 60
  }
}
```

---

### Leave Room

**Send:**

```json
{
  "type": "ROOM_LEAVE"
}
```

---

### Get Room Players

**Send:**

```json
{
  "type": "GET_ROOM_PLAYERS"
}
```

**Receive:**

```json
{
  "type": "ROOM_PLAYERS",
  "payload": {
    "roomId": 1,
    "players": [
      {
        "playerId": 1,
        "playerName": "John Doe"
      }
    ]
  }
}
```

---

### Send Room Message

**Send:**

```json
{
  "type": "ROOM_MESSAGE",
  "payload": {
    "message": "Hello everyone!"
  }
}
```

**Broadcast Receive:**

```json
{
  "type": "ROOM_MESSAGE",
  "payload": {
    "playerId": 1,
    "playerName": "John Doe",
    "message": "Hello everyone!",
    "timestamp": "2026-04-20T10:30:00Z"
  }
}
```

---

### Check Round Time (Client-side optional fallback)

**Send:**

```json
{
  "type": "CHECK_ROUND_TIME"
}
```

**Receive:**

```json
{
  "type": "ROUND_TIME_CHECK",
  "payload": {
    "updated": false,
    "message": "Round in progress. Time remaining: 45s",
    "timeRemaining": 45,
    "currentRound": 1
  }
}
```

---

### Submit Round Over

**Send:**

```json
{
  "type": "ROUND_OVER"
}
```

**Broadcast Receive:**

```json
{
  "type": "ROUND_COMPLETED",
  "payload": {
    "currentRound": 2,
    "roundCount": 5,
    "status": "IN_PROGRESS",
    "isFinished": false,
    "timestamp": "2026-04-20T10:35:00Z"
  }
}
```

---

### Update Player Info

**Send:**

```json
{
  "type": "PLAYER_UPDATE",
  "payload": {
    "name": "Jane Doe",
    "status": "ACTIVE"
  }
}
```

**Broadcast Receive:**

```json
{
  "type": "PLAYER_UPDATED",
  "payload": {
    "playerId": 1,
    "name": "Jane Doe",
    "timestamp": "2026-04-20T10:30:00Z"
  }
}
```

---

### Broadcast Events

**Admin Message:**

```json
{
  "type": "ADMIN_MESSAGE",
  "payload": {
    "roomId": 1,
    "message": "Round 2 starting now!",
    "timestamp": "2026-04-20T10:30:00Z"
  }
}
```

**Room Started:**

```json
{
  "type": "ROOM_STARTED",
  "payload": {
    "roomId": 1,
    "status": "IN_PROGRESS",
    "currentRound": 1,
    "roundCount": 5,
    "roundStartedAt": "2026-04-20T10:30:00Z",
    "roundTime": 60,
    "timestamp": "2026-04-20T10:30:00Z"
  }
}
```

**Player Joined:**

```json
{
  "type": "PLAYER_JOINED_ROOM",
  "payload": {
    "playerId": 5,
    "playerName": "John Doe",
    "joinedVia": "api",
    "timestamp": "2026-04-20T10:30:00Z"
  }
}
```

**Player Left:**

```json
{
  "type": "PLAYER_LEFT_ROOM",
  "payload": {
    "playerId": 5,
    "playerName": "John Doe",
    "leftVia": "api",
    "timestamp": "2026-04-20T10:30:00Z"
  }
}
```

**Player Banned:**

```json
{
  "type": "PLAYER_BANNED",
  "payload": {
    "playerId": 5,
    "playerName": "John Doe",
    "reason": "Cheating",
    "timestamp": "2026-04-20T10:30:00Z"
  }
}
```

**Room Finished:**

```json
{
  "type": "ROOM_FINISHED",
  "payload": {
    "roomId": 1,
    "message": "All rounds completed. Room is now closed.",
    "timestamp": "2026-04-20T10:30:00Z"
  }
}
```

---

## Error Responses

All error responses follow this format:

```json
{
  "status": 400,
  "message": "Error description"
}
```

### Common Error Codes

- **400 Bad Request**: Invalid input or request parameters
- **401 Unauthorized**: Missing or invalid authentication token
- **403 Forbidden**: User doesn't have required permissions or is banned
- **404 Not Found**: Resource not found
- **500 Internal Server Error**: Server error

---

## Authentication

### Bearer Token

Include token in Authorization header:

```
Authorization: Bearer <token>
```

Token format: Base64 encoded `userId:email`

Example:

```
Authorization: Bearer MTo0ZGdtQGV4YW1wbGUuY29t
```

---

**Last Updated:** April 21, 2026

**Latest Changes:**

- Added Categories CRUD API (Create, Read, Update, Delete)
- Categories support pagination
- Admin-only create/update/delete operations
- Added increment round API for room progression
- Added get rounds with answers for player API
- Updated Rounds section documentation with new endpoints
- Total API Endpoints: 50+
