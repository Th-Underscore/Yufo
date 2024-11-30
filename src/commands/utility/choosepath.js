// Allows users to select their progression path via dropdown menu
const { SlashCommandBuilder, ActionRowBuilder, StringSelectMenuBuilder, InteractionContextType } = require('discord.js');
const YufoDataManager = require('../../utils/YufoDataManager');

module.exports = {
	// Command definition for path selection
	data: new SlashCommandBuilder()
		.setName('choosepath')
		.setDescription('Choose your path wisely')
		.setContexts(InteractionContextType.Guild),
	// Creates and displays path selection menu
	async execute(interaction) {
		const dataManager = YufoDataManager.getInstance(interaction.guild.id);
		const paths = Object.values(dataManager.loadConfig().paths).map(path => ({
			label: path.name,
			description: `Choose the path of ${path.name.toUpperCase()}`,
			value: path.id,
		}));
		const selectMenu = new StringSelectMenuBuilder()
			.setCustomId('path_selection')
			.setPlaceholder('Choose your path')
			.addOptions(paths);

		const row = new ActionRowBuilder()
			.addComponents(selectMenu);

		await interaction.reply({
			content: 'Choose your path wisely:',
			components: [row],
			ephemeral: true
		});
	},
};
