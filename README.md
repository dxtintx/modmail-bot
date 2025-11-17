# ModMail Bot

Also on: **English**, [Українська](./docs/README.uk.md), [русский](./docs/README.ru.md)

### Demo

Coming soon

## Usage

A lightweight ModMail bot for Discord. Use this guide to install, configure, and run the bot.

### Requirements

-   Node.js 25+
-   A Discord bot token and client ID (from the Discord Developer Portal)
-   All intents enabled

### Installation

1. Clone the repository and change into the project folder:
    ```
    git clone https://github.com/dxtintx/modmail-bot.git
    cd modmail-bot
    ```
2. Install dependencies:
    ```
    npm install
    ```

### Configuration

Create a `.env` file in the project root or in container's Environment Variables with at least these variables:

`TOKEN` for bot token
`CLIENT_ID` for bot client id

### Start the bot

```
npm start
```

### Permissions & Roles

All commands (except /faq) can be used by users which ids are in whitelist.
Only server admin can manage whitelist using commands `/whitelist add` or `/whitelist remove`

### Example workflow

1. A user DMs the bot with an issue.
2. The bot creates a private mail users in whitelist (moderators) can respond on.
3. Moderators use `/mails` to view active mails.
4. Then use `/respond <id>` to respond; messages are forwarded between moderator and user.
5. When resolved, a moderator uses `/close` to archive the ticket and save a transcript.

### Contributing

-   Open issues and submit PRs for features or fixes.
-   Keep code style consistent with the project (run linter/tests before PR).
