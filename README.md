# Telegram Broadcast Bot

This project is a Telegram bot-based broadcasting system built using Node.js, Express, Telegraf, and Supabase. It allows you to send messages to a large number of users with optional attachments such as images and inline buttons. The system supports scheduling broadcasts, sending reports to a Telegram chat or webhook, and managing broadcast queues using Redis and Bull.

## Features

- **Broadcast Messages**: Send messages to a list of users from a Supabase database or a custom test list.
- **Scheduling**: Schedule broadcasts to be sent at a specific time.
- **Inline Buttons**: Attach inline buttons to your messages.
- **Reports**: Receive real-time reports on the progress of your broadcasts via Telegram chat or webhook.
- **Queue Management**: Manage broadcast tasks using Redis and Bull, allowing for reliable and scalable message sending.
- **Error Handling**: Tracks and reports errors during the broadcasting process.
- **Cancellation**: Cancel broadcasts that are scheduled or currently running.

## Prerequisites

- **Node.js** (v12.x or later)
- **Redis** (for managing queues)
- **Supabase** (for managing user data)
- **Telegraf** (for Telegram bot API)
- **Axios** (for making HTTP requests)

## Installation

1. **Clone the repository**:

    ```bash
    git clone https://github.com/lastochkin-group/telegram-sender-api.git
    cd telegram-broadcast-bot
    ```

2. **Install dependencies**:

    ```bash
    npm install
    ```

3. **Configure environment**:

    Create a `config.json` file in the root directory of the project with the following structure:

    ```json
    {
      "BOT_TOKEN": "your_telegram_bot_token",
      "SUPABASE_URL": "your_supabase_url",
      "SUPABASE_KEY": "your_supabase_key",
      "PORT": 3000
    }
    ```

    - `BOT_TOKEN`: Your Telegram bot token.
    - `SUPABASE_URL`: Your Supabase project URL.
    - `SUPABASE_KEY`: Your Supabase project key.
    - `PORT`: The port on which the server will run.

4. **Run the server**:

    ```bash
    node index.js
    ```

    The server will start on the specified port.

## API Endpoints

### 1. Start Broadcast

**Endpoint**: `/start-broadcast`

**Method**: `POST`

**Headers**:
- `Content-Type: application/json`
- `x-api-key: your_api_key`

**Description**:
Starts a new broadcast task. You can optionally schedule the broadcast and attach inline buttons.

**Request Body**:

```json
{
  "messageText": "Your message here",
  "imageUrl": "https://your-image-url.com/image.png",
  "buttons": [
    {"text": "Button1", "url": "https://link1.com"}
  ],
  "estimatedUserCount": 1000,
  "reportChatId": "123456789",
  "webhookUrl": "https://your-webhook-url.com/report",
  "reportIntervalMinutes": 1,
  "scheduledTime": "20.08.2024 16:00",
  "testUsers": [
    {"chat_id": "123456789"},
    {"chat_id": "987654321"}
  ]
}
```

**Parameters**:

- `messageText` (required): The text message to be broadcasted.
- `imageUrl` (optional): URL of the image to attach.
- `buttons` (optional): Array of inline buttons.
- `estimatedUserCount` (optional): Estimated number of users for reporting progress.
- `reportChatId` (optional): Telegram chat ID where progress reports will be sent.
- `webhookUrl` (optional): URL for sending progress reports via webhook.
- `reportIntervalMinutes` (optional): Interval for reporting progress in minutes. Defaults to 1 minute.
- `scheduledTime` (optional): Schedule the broadcast at a specific time (in `DD.MM.YYYY HH:mm` format).
- `testUsers` (optional): Array of test users (useful for testing without querying the database).

**Response**:

- **Success**:
  
  ```json
  {
    "message": "Задача рассылки добавлена в очередь.",
    "jobId": "1",
    "scheduledTime": "20.08.2023 16:00"
  }
  ```

- **Error**:
  
  ```json
  {
    "error": "Description of the error"
  }
  ```

### 2. Cancel Broadcast

**Endpoint**: `/cancel-broadcast`

**Method**: `POST`

**Headers**:
- `Content-Type: application/json`
- `x-api-key: your_api_key`

**Description**:
Cancels a broadcast task that is scheduled or currently running.

**Request Body**:

```json
{
  "jobId": "1"
}
```

**Parameters**:

- `jobId` (required): The ID of the broadcast task to be canceled. Use `all` to cancel all tasks.

**Response**:

- **Success**:
  
  ```json
  {
    "message": "Задача рассылки 1 отменена."
  }
  ```

- **Error**:
  
  ```json
  {
    "error": "Description of the error"
  }
  ```

## Usage Example

To start a broadcast immediately with text and an inline button, use the following `curl` command:

```bash
curl -X POST http://localhost:3000/start-broadcast \
-H "Content-Type: application/json" \
-H "x-api-key: your_default_api_key" \
-d '{
  "messageText": "Hello, world!",
  "buttons": [
    {"text": "Visit Website", "url": "https://example.com"}
  ]
}'
```

To cancel a broadcast:

```bash
curl -X POST http://localhost:3000/cancel-broadcast \
-H "Content-Type: application/json" \
-H "x-api-key: your_default_api_key" \
-d '{
  "jobId": "1"
}'
```

## Error Handling

The API will return standard HTTP error codes:

- **400**: Bad Request – Missing required parameters or invalid data.
- **403**: Forbidden – Invalid API key.
- **500**: Internal Server Error – Server-side error during the process.

## Contributing

If you'd like to contribute to this project, please fork the repository and use a feature branch. Pull requests are warmly welcome.

## License

This project is licensed under the MIT License. See the [LICENSE](LICENSE) file for details.

## Contact

If you have any questions or feedback, feel free to reach out to the repository owner.