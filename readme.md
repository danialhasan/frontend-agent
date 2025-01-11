# Frontend Testing System

A sophisticated testing system that combines Claude's visual analysis capabilities with Playwright browser automation. See `SPEC.md` for detailed system architecture and design.

## Installation

```bash
npm install
```

## Running the Server

```bash
# Development mode with hot reload
npm run dev

# Production mode
npm run build
npm start
```

## API Endpoints

### Queue a Test

```bash
POST /test
Content-Type: application/json

{
    "name": "Homepage Test",
    "description": "Test homepage layout and functionality",
    "visual": {
        "instructions": "Check layout consistency",
        "expectations": {
            "layout": ["Header should be fixed", "Navigation should be responsive"],
            "design": ["Brand colors should match style guide"],
            "accessibility": ["Text contrast should meet WCAG standards"]
        },
        "screenshots": {
            "baseline": "base64-encoded-image",
            "tolerance": 0.1
        }
    },
    "automation": {
        "steps": [
            {
                "action": "click",
                "target": "#login-button"
            }
        ],
        "assertions": {
            "visual": true,
            "functional": true,
            "performance": true
        }
    }
}
```

### Get System State

```bash
GET /state
```

### Add Screenshot

```bash
POST /screenshot
Content-Type: application/json

{
    "testId": "test-uuid",
    "data": "base64-encoded-image",
    "metadata": {
        "viewport": {
            "width": 1920,
            "height": 1080
        },
        "browser": "chromium"
    }
}
```

### Broadcast Message

```bash
POST /message
Content-Type: application/json

{
    "type": "TEST_START",
    "payload": {
        "testId": "test-uuid"
    },
    "metadata": {
        "source": "orchestrator",
        "priority": "high",
        "correlationId": "correlation-uuid"
    }
}
```

## Development

The system is built with:
- TypeScript for type safety
- Express for the API server
- Playwright for browser automation
- UUID for unique identifiers
- File system for state persistence

### Project Structure

```
src/
  ├── types/        # Type definitions
  ├── orchestrator/ # Test orchestration logic
  ├── services/     # Browser automation & visual analysis
  └── index.ts      # Express server setup
```

### State Management

The system maintains state in a JSON file (`test-state.json`) which includes:
- Test queues (pending, running, completed, failed)
- Current test execution state
- Test history and analytics
- Screenshots
- System configuration

## Contributing

1. Fork the repository
2. Create your feature branch
3. Commit your changes
4. Push to the branch
5. Create a new Pull Request

