// Displays available commands with descriptions, paginated by category
const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const PaginatedEmbedBuilder = require('../../utils/paginatedEmbedBuilder');
const { hasPermission } = require('../../utils/contextChecker');

module.exports = {
	// Command definition for help menu
	data: new SlashCommandBuilder()
		.setName('help')
		.setDescription('Show available commands and their usage'),

	// Creates paginated help menu based on user permissions
	async execute(interaction) {
		const isAdmin = hasPermission(interaction, PermissionFlagsBits.Administrator);

		const commands = {
			'🆙 Progression Commands': [
				{ name: '/list roles', desc: 'View all role paths and their roles', admin: false },
				{ name: '/list levels', desc: 'View XP requirements for each level', admin: false },
				{ name: '/list xp-channels', desc: 'View XP settings for channels', admin: false },
				{ name: '/list xp-formula', desc: 'View detailed XP formula configuration', admin: false },
				{ name: '/list xp-multipliers', desc: 'View active XP multipliers', admin: false },
				{ name: '/list xp-rewards', desc: 'View XP rewards for different actions', admin: false },
			],
			'🛠️ Admin Commands': [
				{ name: '/xpsetup message set', desc: 'Configure XP earned from messages in a channel', admin: true },
				{ name: '/xpsetup message reset', desc: 'Reset message XP settings for a channel', admin: true },
				{ name: '/xpsetup voice set', desc: 'Configure XP earned in voice channels', admin: true },
				{ name: '/xpsetup voice reset', desc: 'Reset voice XP settings for a channel', admin: true },
			]
		};

		const embed = new PaginatedEmbedBuilder({
			title: '📚 Command Help',
			description: 'Here are all the available commands:',
			color: 0x2B2D31
		});

		// Add each category as a field
		for (const [category, categoryCommands] of Object.entries(commands)) {
			const availableCommands = categoryCommands.filter(cmd => !cmd.admin || isAdmin);

			if (availableCommands.length === 0) continue;

			const commandList = availableCommands
				.map(cmd => `\`${cmd.name}\`\n↳ ${cmd.desc}`)
				.join('\n\n');

			embed.addField(category, commandList);
		}

		// Build and display the paginated embed
		embed.build();
		await embed.createCollector(interaction);
	}
};
