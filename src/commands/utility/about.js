// Displays information about the bot and its core features
const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');

module.exports = {
	// Command definition for bot information
	data: new SlashCommandBuilder()
		.setName('about')
		.setDescription('Learn more about the bot and its features'),

	// Creates and sends an embed with bot information
	async execute(interaction) {
		const embed = new EmbedBuilder()
			.setColor(0x2B2D31)
			.setTitle('🛸 About Yufo')
			.setDescription('A Discord bot for dynamic role management and XP-based leveling.')
			.addFields(
				{
					name: '🎭 Role Paths',
					value: 'Create multiple role progression tracks with customizable level requirements. Roles can be set to persist across level changes.',
					inline: false
				},
				{
					name: '📈 XP System',
					value: 'Features configurable formulas, channel-specific XP rates for messages and voice activity, and customizable cooldowns.',
					inline: false
				},
				{
					name: '⚙️ Key Commands',
					value: '`/setup` - Manage role paths and levels\n`/xpformula` - Configure leveling formulas\n`/xpsetup` - Configure XP gain settings',
					inline: false
				},
				{
					name: '🔗 Links',
					value: '[Source GitHub Repository](https://github.com/Th-Underscore/Yufo)',
					inline: false
				}
			)
			.setFooter({ text: 'Use /help for a full list of commands' });

		await interaction.reply({ embeds: [embed], ephemeral: true });
	},
};
