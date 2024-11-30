// Manages XP settings for different server activities (messages, voice)
const { SlashCommandBuilder, PermissionFlagsBits, InteractionContextType } = require('discord.js');
const YufoDataManager = require('../../utils/YufoDataManager');
const YufoConfigManager = require('../../utils/YufoConfigManager');

module.exports = {
	// Command definition for XP configuration per channel
	data: new SlashCommandBuilder()
		.setName('xpsetup')
		.setDescription('Configure XP settings for different events')
		.setContexts(InteractionContextType.Guild)
		.setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
		.addSubcommandGroup(group =>
			group
				.setName('message')
				.setDescription('Configure XP earned from messages')
				.addSubcommand(subcommand =>
					subcommand
						.setName('set')
						.setDescription('Set XP earned per message in a channel')
						.addChannelOption(option =>
							option.setName('channel')
								.setDescription('The channel to configure')
								.setRequired(true))
						.addIntegerOption(option =>
							option.setName('amount')
								.setDescription('Amount of XP earned per message')
								.setRequired(true)
								.setMinValue(0)))
				.addSubcommand(subcommand =>
					subcommand
						.setName('reset')
						.setDescription('Reset message XP settings for a channel')
						.addChannelOption(option =>
							option.setName('channel')
								.setDescription('The channel to reset')
								.setRequired(true))))
		.addSubcommandGroup(group =>
			group
				.setName('voice')
				.setDescription('Configure XP earned from voice activity')
				.addSubcommand(subcommand =>
					subcommand
						.setName('set')
						.setDescription('Set XP earned in voice channels')
						.addChannelOption(option =>
							option.setName('channel')
								.setDescription('The voice channel to configure')
								.setRequired(true))
						.addIntegerOption(option =>
							option.setName('amount')
								.setDescription('Amount of XP earned')
								.setRequired(true)
								.setMinValue(0))
						.addIntegerOption(option =>
							option.setName('minutes')
								.setDescription('Time interval in minutes')
								.setRequired(true)
								.setMinValue(1)))
				.addSubcommand(subcommand =>
					subcommand
						.setName('reset')
						.setDescription('Reset voice XP settings for a channel')
						.addChannelOption(option =>
							option.setName('channel')
								.setDescription('The voice channel to reset')
								.setRequired(true))))
		.addSubcommandGroup(group =>
			group
				.setName('cooldown')
				.setDescription('Configure XP cooldown settings')
				.addSubcommand(subcommand =>
					subcommand
						.setName('set')
						.setDescription('Set the cooldown time between XP gains')
						.addIntegerOption(option =>
							option.setName('time')
								.setDescription('Cooldown time in milliseconds')
								.setRequired(true)
								.setMinValue(100)
								.setMaxValue(60000)))),

	// Handles XP settings for messages and voice channels
	async execute(interaction) {
		const dataManager = YufoDataManager.getInstance(interaction.guild.id);
		const subcommandGroup = interaction.options.getSubcommandGroup();
		const subcommand = interaction.options.getSubcommand();
		const channel = interaction.options.getChannel('channel');

		// Get or initialize xpSettings in the server config
		const config = dataManager.loadConfig();
		if (!config.xpSettings) {
			config.xpSettings = dataManager.getDefaultConfig().xpSettings;
		}

		try {
			switch (subcommandGroup) {
				case 'message':
					if (subcommand === 'set') {
						const amount = interaction.options.getInteger('amount');
						config.xpSettings.messageXP.set(channel.id, amount);
						dataManager.saveConfig(true);
						await interaction.reply(`Set message XP for ${channel} to ${amount} XP per message.`);
					} else if (subcommand === 'reset') {
						config.xpSettings.messageXP.delete(channel.id);
						dataManager.saveConfig(true);
						await interaction.reply(`Reset message XP for ${channel} to default (${config.xpSettings.defaultMessageXP ?? 2} XP per message).`);
					} else if (subcommand === 'default') {
						const amount = interaction.options.getInteger('amount');
						config.xpSettings.defaultMessageXP = amount;
						dataManager.saveConfig(true);
						await interaction.reply(`Set default message XP to ${amount} XP per message.`);
					} else if (subcommand === 'resetall') {
						config.xpSettings.messageXP.clear();
						dataManager.saveConfig(true);
						await interaction.reply(`Reset all message XP settings to default (${config.xpSettings.defaultMessageXP ?? 2} XP per message).`);
					}
					break;
				case 'voice':
					if (subcommand === 'set') {
						const amount = interaction.options.getInteger('amount');
						const seconds = interaction.options.getInteger('seconds');
						config.xpSettings.voiceXP.set(channel.id, { amount, seconds });
						dataManager.saveConfig(true);
						await interaction.reply(`Set voice XP for ${channel} to ${amount} XP every ${seconds} seconds.`);
					} else if (subcommand === 'reset') {
						config.xpSettings.voiceXP.delete(channel.id);
						dataManager.saveConfig(true);
						const defaultSettings = config.xpSettings.defaultVoiceXP;
						await interaction.reply(`Reset voice XP for ${channel} to default (${defaultSettings.amount} XP every ${defaultSettings.seconds} seconds).`);
					}
					break;
				case 'cooldown':
					if (subcommand === 'set') {
						const cooldownTime = interaction.options.getInteger('time');
						config.xpSettings.cooldownTime = cooldownTime;
						dataManager.saveConfig(true);
						await interaction.reply(`XP cooldown time set to ${cooldownTime}ms`);
					}
					break;
			}
		} catch (error) {
			console.error(error);
			await interaction.reply({ content: `❌ Error: ${error.message}`, ephemeral: true });
		}
	}
};
