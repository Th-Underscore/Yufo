// Comprehensive XP and level management system
const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder, InteractionContextType } = require('discord.js');
const YufoDataManager = require('../../utils/YufoDataManager');

// Command definition for XP/level management with subcommands
module.exports = {
	data: new SlashCommandBuilder()
		.setName('xp')
		.setDescription('Manage user XP and levels')
		.setContexts(InteractionContextType.Guild)
		.setDefaultMemberPermissions(PermissionFlagsBits.ManageRoles)
		.addSubcommandGroup(group =>
			group
				.setName('level')
				.setDescription('Manage user levels directly')
				.addSubcommand(subcommand =>
					subcommand
						.setName('add')
						.setDescription('Add levels to a user')
						.addUserOption(option =>
							option.setName('user')
								.setDescription('User to add levels to')
								.setRequired(true))
						.addIntegerOption(option =>
							option.setName('levels')
								.setDescription('Number of levels to add')
								.setRequired(true))
						.addChannelOption(option =>
							option.setName('channel')
								.setDescription('Channel to send the level update notification to (optional)')
								.setRequired(false)))
				.addSubcommand(subcommand =>
					subcommand
						.setName('remove')
						.setDescription('Remove levels from a user')
						.addUserOption(option =>
							option.setName('user')
								.setDescription('User to remove levels from')
								.setRequired(true))
						.addIntegerOption(option =>
							option.setName('levels')
								.setDescription('Number of levels to remove')
								.setRequired(true))
						.addChannelOption(option =>
							option.setName('channel')
								.setDescription('Channel to send the level update notification to (optional)')
								.setRequired(false)))
				.addSubcommand(subcommand =>
					subcommand
						.setName('set')
						.setDescription('Set a user\'s level')
						.addUserOption(option =>
							option.setName('user')
								.setDescription('User to set level for')
								.setRequired(true))
						.addIntegerOption(option =>
							option.setName('newlevel')
								.setDescription('New level to set')
								.setRequired(true))
						.addChannelOption(option =>
							option.setName('channel')
								.setDescription('Channel to send the level update notification to (optional)')
								.setRequired(false)))
				.addSubcommand(subcommand =>
					subcommand
						.setName('setrole')
						.setDescription('Set a user\'s role directly')
						.addUserOption(option =>
							option.setName('user')
								.setDescription('User to set role for')
								.setRequired(true))
						.addStringOption(option =>
							option.setName('newrole')
								.setDescription('Role to set')
								.setRequired(true)
								.setAutocomplete(true))
						.addChannelOption(option =>
							option.setName('channel')
								.setDescription('Channel to send the level update notification to (optional)')
								.setRequired(false))))
		.addSubcommand(subcommand =>
			subcommand
				.setName('add')
				.setDescription('Add XP points to a user')
				.addUserOption(option =>
					option.setName('user')
						.setDescription('User to add XP to')
						.setRequired(true))
				.addIntegerOption(option =>
					option.setName('points')
						.setDescription('Amount of XP to add')
						.setRequired(true))
				.addChannelOption(option =>
					option.setName('channel')
						.setDescription('Channel to send the level update notification to (optional)')
						.setRequired(false)))
		.addSubcommand(subcommand =>
			subcommand
				.setName('remove')
				.setDescription('Remove XP points from a user')
				.addUserOption(option =>
					option.setName('user')
						.setDescription('User to remove XP from')
						.setRequired(true))
				.addIntegerOption(option =>
					option.setName('points')
						.setDescription('Amount of XP to remove')
						.setRequired(true))
				.addChannelOption(option =>
					option.setName('channel')
						.setDescription('Channel to send the level update notification to (optional)')
						.setRequired(false)))
		.addSubcommand(subcommand =>
			subcommand
				.setName('set')
				.setDescription('Set a user\'s XP points')
				.addUserOption(option =>
					option.setName('user')
						.setDescription('User to set XP for')
						.setRequired(true))
				.addIntegerOption(option =>
					option.setName('points')
						.setDescription('Amount of XP to set')
						.setRequired(true))
				.addChannelOption(option =>
					option.setName('channel')
						.setDescription('Channel to send the level update notification to (optional)')
						.setRequired(false)))
		.addSubcommand(subcommand =>
			subcommand
				.setName('reset')
				.setDescription('Reset a user\'s XP and level')
				.addUserOption(option =>
					option.setName('user')
						.setDescription('User to reset')
						.setRequired(true))
				.addChannelOption(option =>
					option.setName('channel')
						.setDescription('Channel to send the level update notification to (optional)')
						.setRequired(false))),

	// Handles autocomplete for path selection
	async autocomplete(interaction) {
		const focusedOption = interaction.options.getFocused(true);
		const guildId = interaction.guild.id;
		const dataManager = YufoDataManager.getInstance(guildId);

		if (focusedOption.name === 'newrole') {
			try {
				const roles = dataManager.getAllRoles();
				const filtered = roles.filter(role =>
					`@${role.name} (Level ${role.level})`.toLowerCase().includes(focusedOption.value.toLowerCase()) ||
					role.id.includes(focusedOption.value)
				);

				await interaction.respond(
					filtered.map(role => ({
						name: `@${role.name} (Level ${role.level})`,
						value: role.id
					}))
				);
			} catch (error) {
				console.error('Autocomplete error:', error);
				await interaction.respond([]);
			}
		}
	},

	// Processes XP/level modifications and notifications
	async execute(interaction) {
		const guildId = interaction.guild.id;
		const dataManager = YufoDataManager.getInstance(guildId);
		const targetMember = interaction.options.getMember('user');
		const targetUser = targetMember.user || targetMember;
		const subcommandGroup = interaction.options.getSubcommandGroup(false);
		const subcommand = interaction.options.getSubcommand();
		const channel = interaction.options.getChannel('channel') || interaction.channel;

		try {
			if (subcommandGroup === 'level') {
				switch (subcommand) {
					case 'add': {
						const levels = interaction.options.getInteger('levels');
						const { memberData, levelDiff, roleChanges } = dataManager.updateMemberLevel(targetMember, 'add', levels);

						const embed = await this.handleLevelNotification(targetMember, memberData, levelDiff, roleChanges, channel, '🎉 Level Update', `Added ${levels} levels to ${targetUser}. Now at level ${memberData.level}!`);

						await interaction.reply({ embeds: [embed], ephemeral: true });
						break;
					}
					case 'remove': {
						const levels = interaction.options.getInteger('levels');
						const { memberData, levelDiff, roleChanges } = dataManager.updateMemberLevel(targetMember, 'remove', levels);

						const embed = await this.handleLevelNotification(targetMember, memberData, levelDiff, roleChanges, channel, '📉 Level Update', `Removed ${levels} levels from ${targetUser}. Now at level ${memberData.level}`);

						await interaction.reply({ embeds: [embed], ephemeral: true });
						break;
					}
					case 'set': {
						const newLevel = interaction.options.getInteger('newlevel');
						const { memberData, levelDiff, roleChanges } = dataManager.updateMemberLevel(targetMember, 'set', newLevel);

						const embed = await this.handleLevelNotification(targetMember, memberData, levelDiff, roleChanges, channel, '🔄 Level Update', `Set ${targetUser}'s level to ${memberData.level}`);

						await interaction.reply({ embeds: [embed], ephemeral: true });
						break;
					}
					case 'setrole': {
						const roleId = interaction.options.getString('newrole');
						const roles = dataManager.getAllRoles();
						const role = roles.find(r => r.id === roleId);

						if (!role) {
							throw new Error('Role not found');
						}

						const { memberData, levelDiff, roleChanges } = dataManager.updateMemberLevel(targetMember, 'set', role.level);

						const embed = await this.handleLevelNotification(targetMember, memberData, levelDiff, roleChanges, channel, '🔄 Level Update', `Set ${targetUser}'s level to ${memberData.level} (role: <@&${role.id}>)`);

						await interaction.reply({ embeds: [embed], ephemeral: true });
						break;
					}
				}
			} else {
				switch (subcommand) {
					case 'add': {
						const points = interaction.options.getInteger('points');
						const { memberData, levelDiff, roleChanges } = dataManager.updateMemberXP(targetMember, 'add', points);

						const embed = await this.handleLevelNotification(targetMember, memberData, levelDiff, roleChanges, channel,
							'🎉 Level Update',
							`Added ${points} XP to ${targetUser}. Now at level ${memberData.level}!`
						);

						await interaction.reply({ embeds: [embed], ephemeral: true });
						break;
					}
					case 'remove': {
						const points = interaction.options.getInteger('points');
						const { memberData, levelDiff, roleChanges } = dataManager.updateMemberXP(targetMember, 'remove', points);

						const embed = await this.handleLevelNotification(targetMember, memberData, levelDiff, roleChanges, channel, '📉 Level Update', `Removed ${points} XP from ${targetUser}. Now at level ${memberData.level}`);

						await interaction.reply({ embeds: [embed], ephemeral: true });
						break;
					}
					case 'set': {
						const points = interaction.options.getInteger('points');
						const { memberData, levelDiff, roleChanges } = dataManager.updateMemberXP(targetMember, 'set', points);

						const embed = await this.handleLevelNotification(targetMember, memberData, levelDiff, roleChanges, channel, '🔄 Level Update', `Set ${targetUser}'s XP to ${memberData.xp}`);

						await interaction.reply({ embeds: [embed], ephemeral: true });
						break;
					}
					case 'reset': {
						const { memberData, levelDiff, roleChanges } = dataManager.updateMemberXP(targetMember, 'reset');

						const embed = await this.handleLevelNotification(targetMember, memberData, levelDiff, roleChanges, channel, '🔄 Reset Complete', `Reset ${targetUser}'s XP and level. Now at level ${memberData.level} with 0 XP`);

						await interaction.reply({ embeds: [embed], ephemeral: true });
						break;
					}
				}
			}
		} catch (error) {
			console.error(error);
			await interaction.reply({
				content: `❌ Error: ${error.message}`,
				ephemeral: true
			});
		}
	},

	// Applies role changes to member
	async handleRoleChanges(memberRoleManager, roleChanges) {
		const guildRoleManager = memberRoleManager.guild.roles;
		const rolesToRemove = roleChanges.remove.map(r => guildRoleManager.cache.get(r.id)).filter(Boolean);
		const rolesToAdd = roleChanges.add.map(r => guildRoleManager.cache.get(r.id)).filter(Boolean);

		if (rolesToRemove.length > 0) {
			await memberRoleManager.remove(rolesToRemove);
		}
		if (rolesToAdd.length > 0) {
			await memberRoleManager.add(rolesToAdd);
		}

		return {
			remove: rolesToRemove,
			add: rolesToAdd,
			keep: roleChanges.keep
		}
	},

	// Sends level-up notifications with role changes
	async handleLevelNotification(targetMember, memberData, levelDiff, roleChanges, notifyChannel, moderatorTitle=null, moderatorDescription=null, doShowOnlyKeep=false) {
		// Process level role changes
		const processedRoles = await this.handleRoleChanges(targetMember.roles, roleChanges);

		// Create the notification embed
		const embed = this.buildLevelUpdateEmbed(targetMember, memberData, levelDiff, processedRoles, doShowOnlyKeep);

		// Send notification if level changed
		if (levelDiff !== 0 && notifyChannel) {
			await notifyChannel.send({ embeds: [embed] });
		}

		// Modify the embed for moderator response
		if (moderatorTitle) embed.setTitle(moderatorTitle);
		if (moderatorDescription) embed.setDescription(moderatorDescription);

		return embed;
	},

	// Creates standardized level update embed
	buildLevelUpdateEmbed(member, memberData, levelDiff, processedRoles=null, doShowOnlyKeep=false) {
		const embed = new EmbedBuilder()
			.setColor(0x2B2D31)
			.setTimestamp();

		if (levelDiff !== 0) {
			embed.setTitle(levelDiff > 0 ? '🎉 Level Up!' : '📉 Level Down')
				.setDescription(`${member} has ${levelDiff > 0 ? 'leveled up' : 'dropped'} to level ${memberData.level}!`);

			// Use pre-processed roles if provided, otherwise process them
			const roles = processedRoles;

			if (roles.remove.length > 0) {
				embed.addFields({
					name: '🔄 Removed Roles',
					value: roles.remove.map(r => `<@&${r.id}>`).join('\n'),
					inline: true
				});
			}
			if (roles.add.length > 0) {
				embed.addFields({
					name: '⭐ New Roles',
					value: roles.add.map(r => `<@&${r.id}>`).join('\n'),
					inline: true
				});
			}
			if (roles.keep.length > 0 && (doShowOnlyKeep || roles.remove.length || roles.add.length)) {
				embed.addFields({
					name: '📌 Kept Roles',
					value: roles.keep.map(r => `<@&${r.id}>`).join('\n'),
					inline: true
				});
			}
		} else {
			embed.setDescription(`${member} is now at level ${memberData.level}`);
		}

		return embed;
	},
};
