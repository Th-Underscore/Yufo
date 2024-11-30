// Handles XP formula configuration for level progression
const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder, InteractionContextType } = require('discord.js');
const YufoDataManager = require('../../utils/YufoDataManager');
const list = require('../utility/list');

// Command definition for XP formula management
module.exports = {
	data: new SlashCommandBuilder()
		.setName('xpformula')
		.setDescription('Manage XP formulas for level progression')
		.setContexts(InteractionContextType.Guild)
		.setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
		.addSubcommand(subcommand =>
			subcommand
				.setName('set')
				.setDescription('Set an XP formula for a level range')
				.addIntegerOption(option =>
					option.setName('min')
						.setDescription('Minimum level this formula applies to')
						.setRequired(true))
				.addStringOption(option =>
					option.setName('formula')
						.setDescription('Math expression (x=relative XP, n=total XP)')
						.setRequired(true))
				.addIntegerOption(option =>
					option.setName('max')
						.setDescription('Maximum level this formula applies to (optional)')
						.setRequired(false)))
		.addSubcommand(subcommand =>
			subcommand
				.setName('list')
				.setDescription('List all XP formulas'))
		.addSubcommand(subcommand =>
			subcommand
				.setName('add')
				.setDescription('Add a preset XP formula')
				.addStringOption(option =>
					option.setName('type')
						.setDescription('Type of XP progression')
						.setRequired(true)
						.addChoices(
							{ name: 'Linear (Same XP each time)', value: 'linear' },
							{ name: 'Growing (Increases by fixed amount)', value: 'growing' },
							{ name: 'Percentage (% increase each level)', value: 'percentage' },
							{ name: 'Total Based (% of total XP)', value: 'total' }
						))
				.addIntegerOption(option =>
					option.setName('start_level')
						.setDescription('Level to start this formula from')
						.setRequired(true))
				.addNumberOption(option =>
					option.setName('value')
						.setDescription('Base value (XP amount or percentage)')
						.setRequired(true)))
		.addSubcommand(subcommand =>
			subcommand
				.setName('set_baseline')
				.setDescription('Set the base XP required for level 1')
				.addIntegerOption(option =>
					option.setName('xp')
						.setDescription('Amount of XP required for first level')
						.setRequired(true)
						.setMinValue(1)))
		.addSubcommand(subcommand =>
			subcommand
				.setName('remove')
				.setDescription('Remove XP formula for a specific level')
				.addIntegerOption(option =>
					option.setName('level')
						.setDescription('Level to remove formula for')
						.setRequired(true)
						.setMinValue(1)))
		.addSubcommand(subcommand =>
			subcommand
				.setName('reset')
				.setDescription('Reset all XP formulas to default')),

	// Handles formula creation, listing, and preset application
	async execute(interaction) {
		if (!interaction.memberPermissions.has('Administrator')) {
			return interaction.reply({ content: 'You need Administrator permission to use this command.', ephemeral: true });
		}

		const dataManager = YufoDataManager.getInstance(interaction.guild.id);
		const subcommand = interaction.options.getSubcommand();

		if (subcommand === 'set') {
			const formula = interaction.options.getString('formula');
			const min = interaction.options.getInteger('min');
			const max = interaction.options.getInteger('max');

			try {
				const config = dataManager.setXPFormula(formula, min, max);

				const rangeText = max ? `levels ${min}-${max}` : `level ${min} and up`;
				await interaction.reply({
					content: `✅ Set XP formula to \`${formula}\` for ${rangeText}`,
					ephemeral: true
				});
			} catch (error) {
				await interaction.reply({
					content: `❌ Error setting XP formula: ${error.message}`,
					ephemeral: true
				});
			}
		} else if (subcommand === 'list') {
			try {
				const config = dataManager.loadConfig();

				const embed = new EmbedBuilder()
					.setColor(0x2B2D31)
					.setTitle('📈 XP System')
					.setDescription('Here\'s how the XP system works:')
					.setTimestamp();

				// Create iterable copy of formula Map
				const sortedFormulas = Array.from(config.xpFormula.formulas);

				// Create formula list
				let formulaList = '';
				let nextValue;
				for (let i = 0; i < sortedFormulas.length; i++) {
					const f = sortedFormulas[i];
					const min = (nextValue ?? f)[0];
					const expr = (nextValue ?? f)[1];
					if (i < sortedFormulas.length - 1) {
						nextValue = sortedFormulas[i + 1];
						let minMax = nextValue[0] - 1;
						minMax = minMax - min < 1 ? min : `${min}-${minMax}`;
						formulaList += `Level ${minMax}: \`${expr}\`\n`;
					} else {
						let minMax = `${min}-${config.xpFormula.maxLevel ?? '∞'}`;
						formulaList += `Level ${minMax}: \`${expr}\``;
					}
				}

				embed.addFields(
					{
						name: '📊 Level Requirements',
						value: formulaList || '*No formulas configured*',
						inline: false
					}
				);

				await interaction.reply({
					embeds: [embed],
					ephemeral: true
				});
			} catch (error) {
				await interaction.reply({
					content: `❌ Error listing XP formulas: ${error.message}`,
					ephemeral: true
				});
			}
		} else if (subcommand === 'add') {
			const type = interaction.options.getString('type');
			const startLevel = interaction.options.getInteger('start_level');
			const value = interaction.options.getNumber('value');

			if (startLevel === 1) {
				return interaction.reply({
					content: '❌ Level 1 formula must be set using `/xpformula set_baseline`. Other formulas must start at level 2 or higher.',
					ephemeral: true
				});
			}

			let formula;
			switch (type) {
				case 'linear':
					formula = 'x';
					break;
				case 'growing':
					formula = `x+${value}`;
					break;
				case 'percentage':
					const multiplier = (100 + value) / 100;
					formula = `${multiplier}x`;
					break;
				case 'total':
					const percentage = value / 100;
					formula = `${percentage}n`;
					break;
			}

			try {
				const config = dataManager.setXPFormula(formula, startLevel);
				await interaction.reply({
					content: `✅ Added ${type} XP formula starting from level ${startLevel}: \`${formula}\``,
					ephemeral: true
				});
			} catch (error) {
				await interaction.reply({
					content: `❌ Error adding XP formula: ${error.message}`,
					ephemeral: true
				});
			}
		} else if (subcommand === 'set_baseline') {
			const xp = interaction.options.getInteger('xp');

			try {
				const config = dataManager.setXPFormula(xp.toString(), 1);
				await interaction.reply({
					content: `✅ Set baseline XP for level 1 to ${xp}`,
					ephemeral: true
				});
			} catch (error) {
				await interaction.reply({
					content: `❌ Error setting baseline XP: ${error.message}`,
					ephemeral: true
				});
			}
		} else if (subcommand === 'remove') {
			const level = interaction.options.getInteger('level');

			try {
				const config = dataManager.removeXPFormula(level);
				await interaction.reply({
					content: `✅ Removed XP formula for level ${level}`,
					ephemeral: true
				});
			} catch (error) {
				await interaction.reply({
					content: `❌ Error removing XP formula: ${error.message}`,
					ephemeral: true
				});
			}
		} else if (subcommand === 'reset') {
			try {
				const config = dataManager.resetXPFormulas();
				await interaction.reply({
					content: '✅ Reset all XP formulas to default',
					ephemeral: true
				});
			} catch (error) {
				await interaction.reply({
					content: `❌ Error resetting XP formulas: ${error.message}`,
					ephemeral: true
				});
			}
		}
	}
};
