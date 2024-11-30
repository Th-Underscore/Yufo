# Yufo Discord Bot

A powerful Discord bot featuring a dynamic role management system with customizable XP-based leveling.

## Features

### Dynamic Role Paths
- Create multiple role progression paths for your server
- Configure role hierarchies with customizable level requirements
- Automatic role management as users level up
- Support for keeping specific roles across level changes

### Advanced XP System
- Configurable XP formulas for different level ranges
- Multiple XP calculation methods:
  - Linear progression
  - Growing increments
  - Percentage-based scaling
  - Total XP based scaling
- Channel-specific XP settings for both message and voice activity
- Customizable XP cooldowns

### Server Management
- Separate data storage for each server
- Cached operations for improved performance
- Automatic data persistence
- Configurable settings per server
- Simple JSON + Map configuration format

## Setup

1. Clone this repository
2. Install dependencies:
   ```bash
   npm install
   ```
3. Create a new Discord application and bot at [Discord Developer Portal](https://discord.com/developers/applications)
4. Copy your bot token
5. Configure the `.env` file:
   ```env
   DISCORD_TOKEN=your_bot_token_here
   DISCORD_CLIENT_ID=your_bot_app_client_id (can be copied in the Dev Portal or in Discord)
   YUFO_DATA_PATH=C:/ProgramData/Yufo
   ```
6. Start the bot:
   ```bash
   npm start
   ```

## Role Paths

Role paths are the core feature of Yufo, allowing you to create multiple progression tracks for your server members. Each path:

- Has a unique ID and display name
- Contains roles assigned to specific levels
- Can have roles marked as "keep" to persist across level changes
- Automatically manages role assignments as members level up
- Supports seamless path switching with proper role cleanup

Example path setup:
```
/setup create path:novice name:Novice Path
/setup add path:novice level:0 role:@Beginner keep:true
/setup add path:novice level:5 role:@Intermediate 
/setup add path:novice level:10 role:@Advanced
```

## Commands

### XP Formula Management
- `/xpformula set` - Set custom XP formula for specific level ranges (advanced)
- `/xpformula list` - View current XP formulas
- `/xpformula add` - Add new formula with various progression types
- `/xpformula set_baseline` - Set base XP requirement for level 1
- `/xpformula remove` - Remove formula for specific level
- `/xpformula reset` - Reset to default formulas

### XP Settings
- `/xpsetup message set` - Configure XP gain for messages in specific channels
- `/xpsetup voice set` - Configure XP gain for voice activity
- `/xpsetup cooldown set` - Set XP gain cooldown

### Role Path Management
- `/setup create` - Create a new role progression path
- `/setup delete` - Remove an existing path
- `/setup add` - Add a role to a path with level requirement
- `/setup remove` - Remove a role from a path
- `/setup editpath` - Modify path name or ID
- `/setup editrole` - Configure role settings (e.g., keep on level up)
- Create and manage role progression paths
- Configure role requirements and behaviors
- Set up automatic role assignments based on levels

# Helpful Information  
- `/help` - Display a list of available commands
- `/about` - Learn more about the bot and its features

## Requirements

- Node.js 16.9.0 or higher
- Discord.js v14
- A Discord bot token

## Data Storage

The bot stores server-specific data (configurations, member data, XP caches) in a dedicated data directory, configurable via `YUFO_DATA_PATH` in `.env`. This ensures:
- Separation of code and data
- Easy backup and restoration
- Independent data management per server
- Secure storage of server configurations

## Contributing

Feel free to submit any issues and enhancement requests!
