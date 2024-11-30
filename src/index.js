const { Client, Events, GatewayIntentBits, Collection, REST, Routes } = require('discord.js');
const fs = require('fs');
const path = require('path');
require('dotenv').config();
const token = process.env.DISCORD_TOKEN;
const clientId = process.env.DISCORD_CLIENT_ID;
const YufoDataManager = require('./utils/YufoDataManager');
const xpEventTracker = require('./utils/xpEventTracker');

// Create a new client instance
const client = new Client({
	intents: [
		GatewayIntentBits.Guilds,
		GatewayIntentBits.GuildMessages,
		GatewayIntentBits.MessageContent,
		GatewayIntentBits.GuildMembers,
		GatewayIntentBits.GuildVoiceStates,
	]
});

// Create a new collection for commands
client.commands = new Collection();

// Load commands
const commands = [];
const foldersPath = path.join(__dirname, 'commands');
const commandFolders = fs.readdirSync(foldersPath);

for (const folder of commandFolders) {
	const commandsPath = path.join(foldersPath, folder);
	const commandFiles = fs.readdirSync(commandsPath).filter(file => file.endsWith('.js'));
	// Grab the SlashCommandBuilder#toJSON() output of each command's data for deployment
	for (const file of commandFiles) {
		const filePath = path.join(commandsPath, file);
		const command = require(filePath);
		if ('data' in command && 'execute' in command) {
			commands.push(command.data.toJSON());
			client.commands.set(command.data.name, command);
			console.log(`Success /${command.data.name}`);
		} else {
			console.warn(`[WARNING] The command at ${filePath} is missing a required "data" or "execute" property.`);
		}
	}
}

// Construct and prepare an instance of the REST module
const rest = new REST().setToken(token);

console.log(`Started refreshing ${commands.length} application (/) commands.`);

// Fully refresh all commands with the current set
const data = rest.put(
	Routes.applicationCommands(clientId),
	{ body: commands },
)
	.then((data) => console.log(`Successfully reloaded ${data.length} application (/) commands.`), console.error);

// When the client is ready, run this code (only once)
client.once(Events.ClientReady, readyClient => {
	console.log(`Ready! Logged in as ${readyClient.user.tag}`);
});

// Handle shutdown gracefully
async function handleShutdown(signal) {
	console.log(`Received ${signal}. Cleaning up before shutdown...`);
	
	// Clean up XP tracker intervals and caches
	xpEventTracker.cleanup();
	
	// Save server role manager caches
	YufoDataManager.saveAllCaches();
	
	// Destroy the client connection
	client.destroy();
	
	process.exit(0);
}

process.on('SIGINT', () => handleShutdown('SIGINT'));
process.on('SIGTERM', () => handleShutdown('SIGTERM'));

// Handle interactions
client.on(Events.InteractionCreate, async interaction => {
	if (interaction.isStringSelectMenu()) {
		const guildId = interaction.guild.id;
		const dataManager = YufoDataManager.getInstance(guildId);
		const paths = dataManager.loadConfig().paths;
		const member = interaction.member;
		if (member.user.bot) return;
		if (interaction.customId === 'path_selection') {
			const selectedPath = interaction.values[0];
			const path = paths[selectedPath];
			
			if (!path) {
				await interaction.reply({ content: 'Invalid path selected.', ephemeral: true });
				return;
			}

			try {
				const memberData = dataManager.getMemberData(member.id);
				const roleChanges = dataManager.setPath(
					memberData,
					member.roles.cache.map(r => r.id),
					selectedPath,
					memberData.level,
					member.roles
				);

				const xp = require('./commands/management/xp.js');
				await xp.handleRoleChanges(member.roles, roleChanges.roleChanges);

				await interaction.reply({ 
					content: `You have chosen the ${path.name.toLowerCase().includes('path')}! You are now a ${path.levels[0].name}.`,
					ephemeral: true 
				});
			} catch (error) {
				console.error(error);
				await interaction.reply({ 
					content: '❌ There was an error while processing your selection.',
					ephemeral: true 
				});
			}
			return;
		}
	}

	if (interaction.isChatInputCommand()) {
		const command = interaction.client.commands.get(interaction.commandName);

		if (!command) {
			console.error(`No command matching ${interaction.commandName} was found.`);
			return;
		}

		try {
			await command.execute(interaction);
		} catch (error) {
			console.error(error);
			if (interaction.replied || interaction.deferred) {
				await interaction.editReply({ content: '❌ There was an error executing this command!', ephemeral: true });
			} else {
				await interaction.reply({ content: '❌ There was an error executing this command!', ephemeral: true });
			}
		}
	}
	
	if (interaction.isAutocomplete()) {
		const command = interaction.client.commands.get(interaction.commandName);

		if (!command) {
			console.error(`No command matching ${interaction.commandName} was found.`);
			return;
		}

		try {
			await command.autocomplete(interaction);
		} catch (error) {
			console.error(error);
		}
	}
});

client.on(Events.MessageCreate, xpEventTracker.handleMessage);
client.on(Events.VoiceStateUpdate, xpEventTracker.handleVoiceStateUpdate);

// Log in to Discord with client's token
client.login(token);
