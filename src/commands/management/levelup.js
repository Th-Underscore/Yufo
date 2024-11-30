// Handles manual level progression for users
const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder, InteractionContextType } = require('discord.js');
const YufoDataManager = require('../../utils/YufoDataManager');
const xp = require('./xp');

module.exports = {
	// Command definition for manual level-up functionality
	data: new SlashCommandBuilder()
		.setName('levelup')
		.setDescription('Level up a user')
		.setContexts(InteractionContextType.Guild)
		.setDefaultMemberPermissions(PermissionFlagsBits.ManageRoles)
		.addUserOption(option =>
			option.setName('user')
				.setDescription('The user to level up')
				.setRequired(true)),

	// Processes level-up, updates roles, and sends confirmation
	async execute(interaction) {
		const dataManager = YufoDataManager.getInstance(interaction.guild.id);
		const targetMember = interaction.options.getMember('user');

		if (!targetMember) {
			await interaction.reply({
				content: '❌ User not found.',
				ephemeral: true
			});
			return;
		}

		const memberData = dataManager.getMemberData(targetMember.id);

		try {
			// Level up the user
			const result = dataManager.updateMemberLevel(targetMember, 'add', 1);
			console.log(result);

			if (!result.levelDiff) {
				await interaction.reply({
					content: `❌ ${targetMember.user.username} has reached the maximum level!`,
					ephemeral: true
				});
				return;
			}

			// Apply role changes
			const { roleChanges } = result;
			const rolesToRemove = roleChanges.remove.map(r => interaction.guild.roles.cache.get(r.id)).filter(Boolean);
			const rolesToAdd = roleChanges.add.map(r => interaction.guild.roles.cache.get(r.id)).filter(Boolean);

			if (rolesToRemove.length > 0) {
				await targetMember.roles.remove(rolesToRemove);
			}
			if (rolesToAdd.length > 0) {
				await targetMember.roles.add(rolesToAdd);
			}

			// Create a rich embed for the level up message
			const embed = new EmbedBuilder()
				.setColor(0x2B2D31)
				.setTitle('🎉 Level Up!')
				.setDescription(`${targetMember} has leveled up to level ${result.memberData.level}!`)
				.setTimestamp();

			// Add role change information
			if (rolesToRemove.length > 0) {
				embed.addFields({
					name: '🔄 Removed Roles',
					value: rolesToRemove.map(r => `<@&${r.id}>`).join('\n'),
					inline: true
				});
			}
			if (rolesToAdd.length > 0) {
				embed.addFields({
					name: '⭐ New Roles',
					value: rolesToAdd.map(r => `<@&${r.id}>`).join('\n'),
					inline: true
				});
			}
			if (roleChanges.keep.length > 0) {
				embed.addFields({
					name: '📌 Kept Roles',
					value: roleChanges.keep.map(r => `<@&${r.id}>`).join('\n'),
					inline: true
				});
			}

			await interaction.reply({
				embeds: [embed],
				ephemeral: false // Public
			});
		} catch (error) {
			console.error('Error in levelup command:', error);

			// Create a user-friendly error message
			let errorMessage = '❌ An error occurred while leveling up the user.';

			if (error.message.includes('not chosen a valid path')) {
				errorMessage = `❌ ${targetMember.user.username} hasn't chosen a valid path yet. They need to use \`/choosepath\` first.`;
			} else if (error.message.includes('must be between')) {
				errorMessage = `❌ ${error.message}`;
			}

			await interaction.reply({
				content: errorMessage,
				ephemeral: true
			});
		}
	}
};
