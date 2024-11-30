// Provides various listing functions for roles, levels, and XP configurations
const { SlashCommandBuilder, EmbedBuilder, InteractionContextType } = require('discord.js');
const YufoDataManager = require('../../utils/YufoDataManager');
const PaginatedEmbedBuilder = require('../../utils/paginatedEmbedBuilder');

module.exports = {
	// Command definition with subcommands for different listing options
	data: new SlashCommandBuilder()
		.setName('list')
		.setDescription('List roles, XP levels, and configurations')
		.setContexts(InteractionContextType.Guild)
		.addSubcommand(subcommand =>
			subcommand
				.setName('roles')
				.setDescription('List all role paths and their roles')
				.addStringOption(option =>
					option.setName('path')
						.setDescription('Specific path to show (optional)')
						.setRequired(false)
						.setAutocomplete(true)))
		.addSubcommand(subcommand =>
			subcommand
				.setName('levels')
				.setDescription('Show detailed XP formula configuration'))
		.addSubcommand(subcommand =>
			subcommand
				.setName('xp-channels')
				.setDescription('List XP configuration for message and voice channels'))
		.addSubcommand(subcommand =>
			subcommand
				.setName('xp-multipliers')
				.setDescription('View active XP multipliers'))
		.addSubcommand(subcommand =>
			subcommand
				.setName('xp-rewards')
				.setDescription('View XP rewards for different actions')),

	// Handles path name autocomplete for role listing
	async autocomplete(interaction) {
		const focusedOption = interaction.options.getFocused(true);
		const guildId = interaction.guild.id;
		const dataManager = YufoDataManager.getInstance(guildId);

		try {
			if (focusedOption.name === 'path') {
				const paths = dataManager.getAvailablePaths();
				const searchTerm = focusedOption.value.toLowerCase();

				const filtered = paths.filter(path =>
					path.id.toLowerCase().includes(searchTerm) ||
					path.name.toLowerCase().includes(searchTerm)
				);

				await interaction.respond(
					filtered.map(path => ({
						name: path.name,
						value: path.id
					}))
				);
			}
		} catch (error) {
			console.error('Autocomplete error:', error);
			await interaction.respond([]);
		}
	},

	// Processes listing requests and generates appropriate embeds
	async execute(interaction) {
		const guildId = interaction.guild.id;
		const subcommand = interaction.options.getSubcommand();
		const dataManager = YufoDataManager.getInstance(guildId);

		try {
			const config = dataManager.loadConfig();

			if (subcommand === 'roles') {
				const specificPath = interaction.options.getString('path');
				let paths;
				let message;
				if (specificPath) {
					const pathData = config.paths[specificPath];
					if (!pathData) {
						throw new Error(`Path "${specificPath}" not found`);
					}
					paths = { [specificPath]: pathData }
					message = `Showing roles and levels for path: **${pathData.name}**`;
				} else {
					paths = config.paths;
					message = 'Showing all role paths and their roles:';
				}

				const embed = new EmbedBuilder()
					.setColor(0x2B2D31)
					.setTitle('🎭 Role Paths')
					.setDescription(message ? message :
						'Here are all available role paths and their roles:')
					.setTimestamp();

				for (const [_, path] of Object.entries(paths)) {
					const rolesList = Array.from(path.levels, ([level, role]) => {
						const keepIndicator = role.keep ? '📌' : '🔄';
						return `Level ${level} ➜ <@&${role.id}> ${keepIndicator}`;
					}).join('\n');

					embed.addFields({
						name: `📊 ${path.name}`,
						value: rolesList || '*No roles configured*',
						inline: false
					});
				}

				embed.setFooter({
					text: '📌 Role is kept on level up  |  🔄 Role is replaced on level up'
				});

				await interaction.reply({
					embeds: [embed],
					ephemeral: true
				});
			} else if (subcommand === 'levels') {
				const embed = new EmbedBuilder()
					.setColor(0x2B2D31)
					.setTitle('🔢 XP Formula Configuration')
					.setDescription('Here\'s the detailed XP formula configuration:')
					.setTimestamp();

				let formulaList = this.getFormulaList(dataManager);
				const formula = config.xpFormula;

				embed.addFields(
					{
						name: '📊 Base Formula',
						value: '```\n' + (formula.formulas.get(2) || 'Not configured') + '\n```',
						inline: false
					},
					{
						name: '📈 Level Range Formulas',
						value: formulaList || '*No level-specific formulas configured*',
						inline: false
					},
					{
						name: '⚙️ Settings',
						value: [
							`Max Level: ${formula.maxLevel ?? '∞'}`,
							`XP Cap: ${formula.xpCap || 'None'}`,
							`Level Cap: ${formula.levelCap || 'None'}`
						].join('\n'),
						inline: false
					}
				);

				await interaction.reply({
					embeds: [embed],
					ephemeral: true
				});
			} else if (subcommand === 'xp-channels') {
				const embed = new PaginatedEmbedBuilder({
					color: 0x2B2D31,
					title: '📊 XP Channel Settings',
					description: 'Here are the XP settings for different channels:'
				});

				// Message XP settings
				const messageChannels = Object.entries(config.xpSettings?.messageXP || {})
					.map(([channelId, xp]) => `<#${channelId}>: ${xp} XP per message`)
					.join('\n');

				embed.addField('💬 Message XP',
					messageChannels || `*Default: ${config.xpSettings?.defaultMessageXP || 2} XP per message*`);

				// Voice XP settings
				const voiceChannels = Object.entries(config.xpSettings?.voiceXP || {})
					.map(([channelId, settings]) =>
						`<#${channelId}>: ${settings.amount} XP every ${settings.seconds} seconds`)
					.join('\n');

				const defaultVoice = config.xpSettings?.defaultVoiceXP || { amount: 1, seconds: 10 };
				embed.addField('🎤 Voice XP',
					voiceChannels || `*Default: ${defaultVoice.amount} XP every ${defaultVoice.seconds} seconds*`);

				// Build and display the paginated embed
				embed.build();
				await embed.createCollector(interaction, { ephemeral: true });
			} else if (subcommand === 'xp-multipliers') {
				const embed = new EmbedBuilder()
					.setColor(0x2B2D31)
					.setTitle('✨ XP Multipliers')
					.setDescription('Here are the active XP multipliers:')
					.setTimestamp();

				const multipliers = config.xpMultipliers || {};

				if (Object.keys(multipliers).length > 0) {
					for (const [type, value] of Object.entries(multipliers)) {
						embed.addFields({
							name: `🔥 ${type.charAt(0).toUpperCase() + type.slice(1)}`,
							value: `Multiplier: ${value}x`,
							inline: true
						});
					}
				} else {
					embed.setDescription('No active XP multipliers found.');
				}

				await interaction.reply({
					embeds: [embed],
					ephemeral: true
				});
			} else if (subcommand === 'xp-rewards') {
				const embed = new EmbedBuilder()
					.setColor(0x2B2D31)
					.setTitle('🎁 XP Rewards')
					.setDescription('Here are the XP rewards for different actions:')
					.setTimestamp();

				const rewards = config.xpRewards || {};

				if (Object.keys(rewards).length > 0) {
					for (const [action, xp] of Object.entries(rewards)) {
						embed.addFields({
							name: `🎯 ${action.charAt(0).toUpperCase() + action.slice(1)}`,
							value: `Reward: ${xp} XP`,
							inline: true
						});
					}
				} else {
					embed.setDescription('No XP rewards configured.');
				}

				await interaction.reply({
					embeds: [embed],
					ephemeral: true
				});
			}
		} catch (error) {
			console.error('Error in list command:', error);
			await interaction.reply({
				content: `❌ Error: ${error.message}`,
				ephemeral: true
			});
		}
	},

	// Formats XP formula information for display
	getFormulaList(dataManager) {
		let formulaList = '';
		const config = dataManager._cache.config;
		const xpFormula = config.xpFormula;
		if (!xpFormula) {
			config.xpFormula = {
				maxLevel: null,
				xpCap: null,
				levelCap: null,
				formulas: new Map()
			};
			dataManager.saveConfig(true);
			return null;
		}
		let formulas = xpFormula.formulas;
		if (!formulas) {
			formulas = new Map();
			xpFormula.formulas = formulas;
			dataManager.saveConfig(true);
			return null;
		}

		// Create iterable copy of formula Map
		const sortedFormulas = Array.from(formulas);

		// Create formula list
		let nextValue;
		let min;
		let expr;
		for (let i = 0; i < sortedFormulas.length - 1; i++) {
			const f = sortedFormulas[i];
			min = (nextValue ?? f)[0];
			expr = (nextValue ?? f)[1];
			nextValue = sortedFormulas[i + 1];

			let minMax = nextValue[0] - 1;
			minMax = minMax - min < 1 ? min : `${min} - ${minMax}`;
			formulaList += `Level ${minMax}: \`${expr}\`\n`;
		}
		let minMax = `${(nextValue ?? sortedFormulas[0])[0]}${xpFormula.maxLevel ? ' – ' + xpFormula.maxLevel : '+'}`;
		return formulaList + `Level ${minMax}: \`${(nextValue ?? sortedFormulas[0])[1]}\``;
	}
};
