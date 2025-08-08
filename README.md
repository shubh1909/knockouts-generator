# Knockout Tournament API

A RESTful API for creating and managing knockout tournaments with automatic bracket generation and PDF export capabilities.

## Features

- 🏆 Create knockout tournaments with 2-128 participants
- 📊 Automatic bracket generation with proper seeding
- ⚡ Match result updates and tournament progression
- 🎲 Tournament and round simulation
- 📄 PDF generation for tournament brackets and summaries
- 🔄 Real-time tournament status tracking
- ✅ Input validation and error handling
- 📚 Comprehensive API documentation

## Installation

1. Clone the repository:
```bash
git clone <repository-url>
cd knockout-tournament-api
```

2. Install dependencies:
```bash
npm install
```

3. Start the server:
```bash
# Development mode with auto-reload
npm run dev

# Production mode
npm start
```

The server will start on `http://localhost:3000`

## API Endpoints

### Health Check
- **GET** `/health` - Check API status

### Tournament Management

#### Create Tournament
- **POST** `/api/tournaments`
- **Body:**
```json
{
  "name": "Premier League Cup",
  "participants": [
    "Manchester United",
    "Chelsea", 
    "Arsenal",
    "Liverpool"
  ]
}
```

#### Get All Tournaments
- **GET** `/api/tournaments`

#### Get Tournament Details
- **GET** `/api/tournaments/:tournamentId`

#### Delete Tournament
- **DELETE** `/api/tournaments/:tournamentId`

### Match Management

#### Update Match Result
- **PUT** `/api/tournaments/:tournamentId/matches/:matchId`
- **Body:**
```json
{
  "winnerId": 1
}
```

#### Get Round Matches
- **GET** `/api/tournaments/:tournamentId/rounds/:roundNumber`

### Simulation

#### Simulate Round
- **POST** `/api/tournaments/:tournamentId/simulate-round`
- **Body (Optional):**
```json
{
  "roundNumber": 2
}
```

#### Simulate Entire Tournament
- **POST** `/api/tournaments/:tournamentId/simulate`

### PDF Generation

#### Generate Bracket PDF
- **POST** `/api/tournaments/:tournamentId/generate-bracket-pdf`

#### Download Bracket PDF
- **GET** `/api/tournaments/:tournamentId/download-bracket`

#### Generate Summary PDF
- **POST** `/api/tournaments/:tournamentId/generate-summary-pdf`

#### Download Summary PDF
- **GET** `/api/tournaments/:tournamentId/download-summary`

## Example Usage

### 1. Create a Tournament
```bash
curl -X POST http://localhost:3000/api/tournaments \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Champions League",
    "participants": [
      "Real Madrid",
      "Barcelona", 
      "Manchester City",
      "Bayern Munich",
      "PSG",
      "Liverpool",
      "Chelsea",
      "Arsenal"
    ]
  }'
```

### 2. Get Tournament Details
```bash
curl http://localhost:3000/api/tournaments/{tournamentId}
```

### 3. Update Match Result
```bash
curl -X PUT http://localhost:3000/api/tournaments/{tournamentId}/matches/R1M1 \
  -H "Content-Type: application/json" \
  -d '{"winnerId": 1}'
```

### 4. Simulate Tournament
```bash
curl -X POST http://localhost:3000/api/tournaments/{tournamentId}/simulate
```

### 5. Generate PDF
```bash
curl -X POST http://localhost:3000/api/tournaments/{tournamentId}/generate-bracket-pdf
```

## Response Format

All API responses follow this format:

### Success Response
```json
{
  "success": true,
  "message": "Operation completed successfully",
  "data": {
    // Response data
  }
}
```

### Error Response
```json
{
  "success": false,
  "message": "Error description",
  "errors": [
    // Validation errors (if any)
  ]
}
```

## Tournament Structure

### Tournament Object
```json
{
  "id": "tournament_1234567890_abc123def",
  "name": "Champions League",
  "status": "active", // active, completed
  "rounds": 3,
  "currentRound": 1,
  "participants": [...],
  "bracket": [...],
  "createdAt": "2024-01-01T00:00:00.000Z",
  "completedAt": null,
  "champion": null
}
```

### Match Object
```json
{
  "matchId": "R1M1",
  "round": 1,
  "participant1": {
    "id": 1,
    "name": "Real Madrid"
  },
  "participant2": {
    "id": 2,
    "name": "Barcelona"
  },
  "winner": null,
  "nextMatchId": "R2M1",
  "status": "pending" // pending, completed
}
```

## Project Structure

```
/
├── app.js                      # Main application entry point
├── package.json               # Dependencies and scripts
├── controllers/               # Request handlers
│   └── tournamentController.js
├── services/                  # Business logic
│   ├── tournamentService.js
│   └── pdfService.js
├── routes/                    # API routes
│   └── tournaments.js
├── middleware/               # Custom middleware
│   ├── validation.js
│   └── errorHandler.js
└── uploads/                  # Generated PDF files
```

## Environment Variables

Create a `.env` file in the root directory:

```env
PORT=3000
NODE_ENV=development
ALLOWED_ORIGINS=http://localhost:3000,http://localhost:3001
```

## Error Codes

- **400** - Bad Request (validation errors)
- **404** - Not Found (tournament/match not found)
- **500** - Internal Server Error

## Dependencies

- **Express.js** - Web framework
- **Joi** - Input validation
- **pdf-lib** - PDF generation
- **cors** - Cross-origin resource sharing
- **helmet** - Security headers
- **morgan** - HTTP request logging

## Development

```bash
# Install development dependencies
npm install --dev

# Start with auto-reload
npm run dev

# Run tests (if available)
npm test
```

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## License

ISC License

## Support

For support and questions, please open an issue in the repository.
