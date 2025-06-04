# Currency Rate Bot

This project includes a Telegram bot that publishes currency rates.

## Environment configuration

1. Copy `.env.example` to `.env.dev`.
2. Fill in the required variables in `.env.dev`.
3. Ensure `.env.dev` is **not** committed to version control.

The `.env.example` file contains the variables used by the application:

```
BOT_TOKEN=your-bot-token
REDIS_URL=redis://redis:6379
KAFKA_BROKERS=kafka:9092
PORT=3000
```

Use Docker Compose to run the services:

```bash
docker-compose up --build
```

## Project structure

- `src/` &ndash; NestJS source code of the bot
- `src/currency-bot/` &ndash; Telegram bot implementation
- `api.ts` &ndash; helper with external API endpoints
- `Dockerfile` and `docker-compose.yml` &ndash; container setup
