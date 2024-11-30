const {
	SlashCommandBuilder,
	PermissionFlagsBits,
	AttachmentBuilder,
	InteractionContextType,
	ActionRowBuilder,
	ButtonBuilder,
	TextInputBuilder,
	ModalBuilder,
	TextInputStyle,
	ButtonStyle,
	MessageCollector } = require('discord.js');
const YufoDataManager = require('../../utils/YufoDataManager');
const { getDirectMessageChannel } = require('../../utils/contextChecker');
const { inter } = require('pos/lexicon');

module.exports = {
	data: new SlashCommandBuilder()
		.setName('setup')
		.setDescription('Manage role paths and levels')
		.setContexts(InteractionContextType.Guild)
		.setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
		.addSubcommand(subcommand =>
			subcommand
				.setName('create')
				.setDescription('Create a new role path')
				.addStringOption(option =>
					option.setName('path')
						.setDescription('ID of the path to create (no spaces)')
						.setRequired(true))
				.addStringOption(option =>
					option.setName('name')
						.setDescription('Display name of the path')
						.setRequired(false)))
		.addSubcommand(subcommand =>
			subcommand
				.setName('delete')
				.setDescription('Delete a role path')
				.addStringOption(option =>
					option.setName('path')
						.setDescription('Name of the path to delete')
						.setRequired(true)
						.setAutocomplete(true)))
		.addSubcommand(subcommand =>
			subcommand
				.setName('editpath')
				.setDescription('Edit a role path')
				.addStringOption(option =>
					option.setName('path')
						.setDescription('Name of the path to edit')
						.setRequired(true)
						.setAutocomplete(true))
				.addStringOption(option =>
					option.setName('newname')
						.setDescription('New name for the path')
						.setRequired(false))
				.addStringOption(option =>
					option.setName('newid')
						.setDescription('New ID for the path')
						.setRequired(false)))
		.addSubcommand(subcommand =>
			subcommand
				.setName('cache')
				.setDescription('Configure cache backup settings')
				.addIntegerOption(option =>
					option.setName('cooldown')
						.setDescription('Cache save cooldown in milliseconds (minimum 5000)')
						.setRequired(true)))
		.addSubcommand(subcommand =>
			subcommand
				.setName('add')
				.setDescription('Add a role to a path')
				.addStringOption(option =>
					option.setName('path')
						.setDescription('Name of the path')
						.setRequired(true)
						.setAutocomplete(true))
				.addIntegerOption(option =>
					option.setName('level')
						.setDescription('Level number for the role')
						.setRequired(true))
				.addRoleOption(option =>
					option.setName('role')
						.setDescription('Role to add')
						.setRequired(true))
				.addBooleanOption(option =>
					option.setName('keep')
						.setDescription('Whether to keep this role when leveling up')
						.setRequired(false)))
		.addSubcommand(subcommand =>
			subcommand
				.setName('remove')
				.setDescription('Remove a role from a path')
				.addStringOption(option =>
					option.setName('path')
						.setDescription('Name of the path')
						.setRequired(true)
						.setAutocomplete(true))
				.addStringOption(option =>
					option.setName('role')
						.setDescription('Name or ID of the role to remove')
						.setRequired(true)
						.setAutocomplete(true)))
		.addSubcommand(subcommand =>
			subcommand
				.setName('editrole')
				.setDescription('Edit a role in a path')
				.addStringOption(option =>
					option.setName('path')
						.setDescription('The path containing the role')
						.setRequired(true)
						.setAutocomplete(true)
				)
				.addStringOption(option =>
					option.setName('role')
						.setDescription('The role to edit')
						.setRequired(true)
						.setAutocomplete(true)
				)
				.addBooleanOption(option =>
					option.setName('keep')
						.setDescription('Whether to keep the role when leveling up')
						.setRequired(false)
				)
				.addRoleOption(option =>
					option.setName('newrole')
						.setDescription('New role to replace the current one')
						.setRequired(false))
				.addIntegerOption(option =>
					option.setName('newlevel')
						.setDescription('New level in the path')
						.setRequired(false)))
		.addSubcommand(subcommand =>
			subcommand
				.setName('save')
				.setDescription('Save the server configuration to a JSON file'))
		.addSubcommand(subcommand =>
			subcommand
				.setName('forceload')
				.setDescription('⚠️ Load a server configuration from a JSON file ⚠️')
				.addAttachmentOption(option =>
					option.setName('config')
						.setDescription('⚠️ JSON configuration file to load, will overwrite any existing configuration ⚠️')
						.setRequired(false))
				.addAttachmentOption(option =>
					option.setName('members')
						.setDescription('⚠️ JSON member data file to load, will overwrite any existing configuration ⚠️')
						.setRequired(false))
				.addAttachmentOption(option =>
					option.setName('xpcache')
						.setDescription('⚠️ JSON XP cache file to load, will overwrite any existing configuration ⚠️')
						.setRequired(false)))
		.addSubcommand(subcommand =>
			subcommand
				.setName('z_delete_everything_z')
				.setDescription('⚠️⚠️⚠️ Delete the server configuration and all Yufo data ⚠️⚠️⚠️')),

	// ### Command Execution Handler ### //
	async execute(interaction) {
		if (!interaction.memberPermissions.has('Administrator')) {
			return interaction.reply({ content: 'You need Administrator permission to use this command.', ephemeral: true });
		}

		const subcommand = interaction.options.getSubcommand();
		const guildId = interaction.guild.id;
		const dataManager = YufoDataManager.getInstance(guildId);

		try {
			switch (subcommand) {
				case 'create': {
					const pathId = interaction.options.getString('path');
					const displayName = interaction.options.getString('name') || pathId;
					const isNoun = interaction.options.getBoolean('isnoun') ?? dataManager.isNoun(displayName);

					if (pathId.includes(' ')) {
						await interaction.reply({
							content: 'Path ID cannot contain spaces',
							ephemeral: true
						});
						return;
					}

					dataManager.createPathInConfig(pathId, displayName, isNoun);

					const embed = new EmbedBuilder()
						.setColor(0x2B2D31)
						.setTitle('🎭 Role Path Created')
						.setDescription(`\`${displayName}\` created with ID \`${pathId}\``)
						.setTimestamp();

					await interaction.reply({ embeds: [embed], ephemeral: true  });
					break;
				}
				case 'delete': {
					const pathId = interaction.options.getString('path');

					dataManager.deletePathInConfig(pathId);

					const displayName = dataManager.getDisplayNameForPath(pathId);
					const embed = new EmbedBuilder()
						.setColor(0x2B2D31)
						.setTitle('🎭 Role Path Deleted')
						.setDescription(`Path \`${displayName}\` (ID: \`${pathId}\`) deleted`)
						.setTimestamp();

					await interaction.reply({ embeds: [embed], ephemeral: true });
					break;
				}
				case 'editpath': {
					const pathId = interaction.options.getString('path');
					const newName = interaction.options.getString('newname');
					const newId = interaction.options.getString('newid');
					const isNoun = interaction.options.getBoolean('isnoun') ?? dataManager.isNoun(newName);

					if (!newName && !newId) {
						await interaction.reply({
							content: 'You must provide either a new name or a new ID to edit the path',
							ephemeral: true
						});
						return;
					}

					const [ id, name ] = dataManager.editPathInConfig(pathId, newName, newId, isNoun);
					await interaction.reply({
						content: `Edited path from ${pathId} to ${name} (ID: ${id})`,
						ephemeral: true
					});
					break;
				}
				case 'cache': {
					const cooldownSeconds = interaction.options.getInteger('cooldown');

					if (cooldownSeconds < 5000) {
						await interaction.reply({ content: 'Cooldown must be at least 5 seconds.', ephemeral: true });
						return;
					}

					const config = dataManager.loadConfig();
					config.cacheCooldown = cooldownSeconds;
					dataManager.saveConfig(config);

					await interaction.reply({ content: `Cache cooldown set to ${cooldownSeconds} seconds.`, ephemeral: true });
					break;
				}
				case 'add': {
					const pathId = interaction.options.getString('path');
					const level = interaction.options.getInteger('level');
					const role = interaction.options.getRole('role');
					const keep = interaction.options.getBoolean('keep') ?? false;

					dataManager.addRoleToConfig(pathId, level, role.id, role.name, keep);
					await interaction.reply({
						content: `Added <@&${role.id}> to path ${pathId} at level ${level}${keep ? ' (kept on level up)' : ''}`,
						ephemeral: true
					});
					break;
				}
				case 'remove': {
					const pathId = interaction.options.getString('path');
					const roleLevel = interaction.options.getString('role');

					const { id } = dataManager.removeRoleFromConfig(pathId, Number(roleLevel));
					await interaction.reply({
						content: `Removed <@&${id}> from path ${pathId}`,
						ephemeral: true
					});
					break;
				}
				case 'editrole': {
					const pathId = interaction.options.getString('path');
					const roleLevel = interaction.options.getString('role');
					const keep = interaction.options.getBoolean('keep');
					const newRole = interaction.options.getRole('newrole');
					const newLevel = interaction.options.getInteger('newlevel');

					const updates = {};
					if (keep !== null) updates.keep = keep;
					if (newRole) {
						updates.id = newRole.id;
						updates.name = newRole.name;
					}

					dataManager.editRoleInConfig(pathId, Number(roleLevel), updates, newLevel);

					const responseMessages = [];
					if (keep !== null) {
						responseMessages.push(keep ? 'kept on level up' : 'not kept on level up');
					}
					if (newRole) {
						responseMessages.push(`replaced with <@&${newRole.id}>`);
					}
					if (newLevel) {
						responseMessages.push(`set to level ${newLevel}`);
					}

					await interaction.reply({
						content: `Updated role in path ${pathId}${responseMessages.length > 0 ? ` (${responseMessages.join(', ')})` : ''}`,
						ephemeral: true
					});
					break;
				}
				case 'save': {
					await interaction.deferReply({ ephemeral: true });

					const config = dataManager.loadConfig();
					if (!config) {
						await interaction.editReply({ content: 'Failed to load cached server configuration', ephemeral: true });
						return;
					}
					const members = dataManager.loadMembers();
					if (!members) {
						await interaction.editReply({ content: 'Failed to load cached server member data', ephemeral: true });
						return;
					}
					const xpcache = dataManager.loadXPCache();
					if (!xpcache) {
						await interaction.editReply({ content: 'Failed to load cached server xp cache', ephemeral: true });
						return;
					}

					const convertMapToArray = (_, value) => value instanceof Map ? Array.from(value) : value;

					const attachments = [];
					attachments.push(
						new AttachmentBuilder(
							Buffer.from(JSON.stringify(config, convertMapToArray, 2)),
							{ name: `${guildId}_config.json` }
						),
						new AttachmentBuilder(
							Buffer.from(JSON.stringify(members, convertMapToArray, 2)),
							{ name: `${guildId}_members.json` }
						),
						new AttachmentBuilder(
							Buffer.from(JSON.stringify([ xpcache.relative, xpcache.total ], null, 2)),
							{ name: `${guildId}_xpcache.json` }
						)
					);

					await interaction.editReply({
						content: 'Here is your server configuration:',
						files: attachments
					});
					break;
				}
				case 'forceload': {
					const configFile = interaction.options.getAttachment('config');
					if (configFile && !configFile.name?.endsWith('.json')) {
						await interaction.reply({ content: '❌ Please provide a JSON file', ephemeral: true });
						return;
					}
					const membersDataFile = interaction.options.getAttachment('members');
					if (membersDataFile && !membersDataFile.name?.endsWith('.json')) {
						await interaction.reply({ content: '❌ Please provide a JSON file', ephemeral: true });
						return;
					}
					const cacheFile = interaction.options.getAttachment('xpcache');
					if (cacheFile && !cacheFile.name?.endsWith('.json')) {
						await interaction.reply({ content: '❌ Please provide a JSON file', ephemeral: true });
						return;
					}

					if (!configFile && !membersDataFile && !cacheFile) {
						await interaction.reply({ content: '❌ Please provide at least one file to force-load', ephemeral: true });
						return;
					}

					await interaction.deferReply({ ephemeral: true });

					let replyContent = [];

					const dataTypes = [
						{
							type: 'config',
							file: configFile,
							successMsg: 'Configuration loaded successfully!',
							errorMsg: 'Failed to load configuration. Make sure the file is valid configuration JSON.'
						},
						{
							type: 'members',
							file: membersDataFile,
							successMsg: 'Member data loaded successfully!',
							errorMsg: 'Failed to load member data. Make sure the file is valid member data JSON.'
						},
						{
							type: 'xpcache', 
							file: cacheFile,
							successMsg: 'XP cache data loaded successfully!',
							errorMsg: 'Failed to load XP cache. Make sure the file is valid XP cache JSON.'
						}
					];

					for (const { type, file, successMsg, errorMsg } of dataTypes) {
						const result = await dataManager.forceLoadData(type, file, successMsg, errorMsg);
						if (result) {
							replyContent.push(result.success ? `✅ ${result.message}` : `❌ ${result.message}`);
							await interaction.editReply({ content: replyContent.join('\n'), ephemeral: true });
						}
					}

					break;
				}
				case 'z_delete_everything_z': {
					await interaction.deferReply({ ephemeral: true });
					const now = Date.now();
					const confirmStart = `${guildId}_${now}`;
					// Confirmation 1		
					await interaction.editReply({
						content: 'Are you sure you want to delete all Yufo data in this server? This is dangerous!',
						components: [
							new ActionRowBuilder()
								.addComponents(
									new ButtonBuilder()
										.setCustomId(`yes_${confirmStart}`)
										.setLabel('Yes, delete everything!')
										.setStyle(ButtonStyle.Danger),
									new ButtonBuilder()
										.setCustomId(`no_${confirmStart}`)
										.setLabel('Please don\'t...')
										.setStyle(ButtonStyle.Secondary)
								)
						]
					});

					/** @type {MessageCollector} */
					const collector = interaction.channel.createMessageComponentCollector({
						filter: i => i.customId === `yes_${confirmStart}` || i.customId === `no_${confirmStart}`,
						time: 10000
					});

					const time = { start: confirmStart, now: now };
					collector.on('collect', async (i) => await this.confirmDeletion(i, interaction, dataManager, time));

					collector.on('end', async () => {
						if (time.now !== now) return;
						if (interaction.replied || interaction.deferred) {
							await interaction.editReply({ content: 'Timed out', components: [] });
						} else await interaction.update({ content: 'Timed out', components: [] });
					});
					break;
				}
			}
		} catch (error) {
			console.error(error);
			if (interaction.replied || interaction.deferred) {
				await interaction.editReply({ content: `❌ Error: ${error.message}`, ephemeral: true });
			} else {
				await interaction.reply({ content: `❌ Error: ${error.message}`, ephemeral: true });
			}
		}
	},

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
			} else if (focusedOption.name === 'role') {
				const pathId = interaction.options.getString('path');
				if (!pathId) {
					await interaction.respond([]);
					return;
				}

				const roles = dataManager.getRolesForPath(pathId, interaction.guild.roles);
				const filtered = roles.filter(role =>
					role.id.includes(focusedOption.value) ||
					`@${role.name}`.includes(focusedOption.value) ||
					new RegExp(`[lev]*[\\. ]*(${role.level})`).test(focusedOption.value)
				);

				await interaction.respond(
					filtered.map(role => ({
						name: `(Lv. ${role.level}) @${role.name}`,
						value: role.level.toString()
					})).slice(0, 25)
				);
			}
		} catch (error) {
			console.error('Error in autocomplete:', error);
			await interaction.respond([]);
		}
	},

	// ### Purge Chain Interaction Callbacks ### //
	// This section handles a multi-step confirmation process for data deletion
	// The chain follows this sequence:
	//   1. Initial confirmation button
	//   2. Secondary "Are you sure?" confirmation
	//   3. Server owner DM verification
	//   4. Modal input for exact confirmation text
	//   5. Final deletion execution

	async confirmDeletion(i, interaction, dataManager, time) {
		try {
			// Only allow the original command user to interact with buttons
			if (i.user.id !== interaction.user.id) {
				await i.reply({
					content: 'You cannot use these buttons.',
					ephemeral: true
				});
				return;
			}

			const confirmStart = time.start;

			// Map interaction IDs to their respective handlers
			// Each handler represents a step in the confirmation chain
			const handlers = {
				[`step_5_${confirmStart}`]: () => this.handleFinalConfirmation(i, interaction, dataManager, time),
				[`step_4_modal_${confirmStart}`]: () => this.handleOwnerModal(i, interaction, dataManager, time),
				[`step_3_${confirmStart}`]: () => this.handleOwnerDM(i, interaction, dataManager, time),
				[`yes_${confirmStart}`]: () => this.handleSecondConfirmation(i, interaction, dataManager, time),
				[`no_${confirmStart}`]: () => this.handleCancellation(i, interaction)
			};

			const handler = handlers[i.customId];
			if (handler) {
				await handler();
			}
		} catch (error) {
			console.error(error);
			if (interaction.replied || interaction.deferred) {
				await interaction.editReply({ content: `❌ Error while confirming deletion: ${error.message}`, ephemeral: true });
			} else {
				await interaction.reply({ content: `❌ Error while confirming deletion: ${error.message}`, ephemeral: true });
			}
		}
	},

	async handleFinalConfirmation(i, interaction, dataManager, time) {
		// Final step: Verify the exact confirmation text before deletion
		const confirmStart = time.start;
		const confirmationText = i.fields.getTextInputValue('confirmation_input');
		const expectedText = `YES, DELETE EVERYTHING ${confirmStart}`;
		
		if (confirmationText !== expectedText) {
			await i.update({ content: 'Confirmation text did not match. Deletion cancelled.', components: [] });
			await interaction.editReply({ content: 'Deletion cancelled - confirmation text did not match.', components: [], ephemeral: true });
			return;
		}

		await i.update({ components: [] });
		const followup = await i.followUp({ content: 'Deleting everything...' });
		await interaction.editReply({ content: 'Deleting everything...', ephemeral: true });
		
		await this.performDeletion(interaction, dataManager, followup);
	},

	async handleOwnerModal(i, interaction, dataManager, time) {
		// Step 4: Show modal to server owner for final confirmation
		const now = Date.now();
		time.now = now;
		const confirmStart = time.start;

		// Create modal for exact text confirmation
		const modal = new ModalBuilder()
			.setCustomId(`step_5_${confirmStart}`)
			.setTitle('Delete All Yufo Data');
		
		const confirmInput = new TextInputBuilder()
			.setCustomId('confirmation_input')
			.setLabel(`Type: \`... ${confirmStart}\``)
			.setStyle(TextInputStyle.Paragraph)
			.setPlaceholder(`YES, DELETE EVERYTHING ${confirmStart}`)
			.setRequired(true);

		const firstActionRow = new ActionRowBuilder().addComponents(confirmInput);
		modal.addComponents(firstActionRow);

		await i.showModal(modal);
		// Listen for the modal submission
		interaction.client.once('interactionCreate', async (i) => await this.confirmDeletion(i, interaction, dataManager, time));
	},

	async handleOwnerDM(i, interaction, dataManager, time) {
		// Step 3: Send DM to server owner and wait for response
		const now = Date.now();
		time.now = now;
		const confirmStart = time.start;

		await i.update({
			content: 'DM\'ing the server owner...\n\nIf no response is received in 5 minutes, the deletion will commence.',
			components: []
		});

		const owner = await i.guild.fetchOwner();
		// Set interaction user to owner for permission checks in subsequent steps
		interaction.user = owner.user;
		await this.sendOwnerDM(owner, i, confirmStart);

		const dmChannel = await getDirectMessageChannel(owner);
		const collector = this.createDMCollector(dmChannel, confirmStart, i, interaction, dataManager, time, now, owner);
	},

	async sendOwnerDM(owner, i, confirmStart) {
		// Send DM to server owner with confirmation buttons
		return owner.send({
			content: `${i.user} is requesting to delete all Yufo data in ${i.channel} ([${i.guild.name}](https://discord.com/channels/${i.guild.id})). To confirm, enter \`YES, DELETE EVERYTHING ${confirmStart}\` in the text input below. Otherwise, enter anything else to cancel.\n\nIf you do not respond within 5 minutes, the deletion will commence.\n\nClick the button below to open the confirmation prompt:`,
			components: [
				new ActionRowBuilder()
					.addComponents(
						new ButtonBuilder()
							.setCustomId(`step_4_modal_${confirmStart}`)
							.setLabel('Open Confirmation')
							.setStyle(ButtonStyle.Danger),
						new ButtonBuilder()
							.setCustomId(`no_${confirmStart}`)
							.setLabel('Cancel')
							.setStyle(ButtonStyle.Success)
					)
			]
		});
	},

	createDMCollector(dmChannel, confirmStart, i, interaction, dataManager, time, now, owner) {
		// Create collector for DM responses with 5-minute timeout
		const collector = dmChannel.createMessageComponentCollector({
			filter: i => i.customId === `step_4_modal_${confirmStart}`,
			time: 300000
		});

		collector.on('collect', async (i) => await this.confirmDeletion(i, interaction, dataManager, time));

		collector.on('end', async () => {
			// If no response after timeout, proceed with deletion
			if (time.now !== now) return;
			await i.update({ content: `${owner} didn't respond in time. Timed out! Deleting everything...`, components: [], ephemeral: false });
			await this.performDeletion(interaction, dataManager);
		});

		return collector;
	},

	async handleSecondConfirmation(i, interaction, dataManager, time) {
		// Step 2: Show second confirmation prompt
		const now = Date.now();
		time.now = now;
		const confirmStart = time.start;

		await i.update({
			content: 'You\'re 100% sure?',
			components: [
				new ActionRowBuilder()
					.addComponents(
						new ButtonBuilder()
							.setCustomId(`step_3_${confirmStart}`)
							.setLabel('Yes, I\'m 100% sure! Purge this server\'s Yufo data from this plane of existence!')
							.setStyle(ButtonStyle.Danger),
						new ButtonBuilder()
							.setCustomId(`no_${confirmStart}`)
							.setLabel('I\'ve changed my mind.')
							.setStyle(ButtonStyle.Success)
					)
			]
		});

		const collector = this.createSecondConfirmationCollector(i, interaction, dataManager, time, now);
	},

	createSecondConfirmationCollector(i, interaction, dataManager, time, now) {
		// Create collector for second confirmation with 10-second timeout
		const collector = i.channel.createMessageComponentCollector({
			filter: i => i.customId === `step_3_${time.start}` || i.customId === `no_${time.start}`,
			time: 10000
		});

		collector.on('collect', async (i) => await this.confirmDeletion(i, interaction, dataManager, time));

		collector.on('end', async () => {
			// Handle timeout by clearing components
			if (time.now !== now) return;
			if (i.deferred || i.replied) {
				await i.editReply({ content: 'Timed out', components: [] });
			} else await i.update({ content: 'Timed out', components: [] });
		});

		return collector;
	},

	async handleCancellation(i, interaction) {
		// Handle cancellation at any step
		if (i.deferred || i.replied) {
			await i.editReply({ content: 'Cancelled', components: [] });
		} else await i.update({ content: 'Cancelled', components: [] });
		await interaction.editReply({ content: 'Cancelled', components: [] });
	},

	async performDeletion(interaction, dataManager, followup=null) {
		// Final step: Actually perform the data deletion
		console.log(`Purging data for guild ${interaction.guild.name} (${interaction.guild.id})...`);
		try {
			// Reset all data managers to their default states
			dataManager.configManager.load(dataManager.getDefaultConfig());
			dataManager.configManager.save(true);
			dataManager.memberManager.load([[]]);
			dataManager.memberManager.save(true);
			dataManager.xpManager.load([[]]);
			dataManager.xpManager.save(true);
			
			// Send success messages to both interaction channels
			if (followup) {
				await followup.edit({ content: '🌊🌊🌊 All your data has been washed into the ocean! 🌊🌊🌊', components: [] });
			}
			await interaction.editReply({ content: '🌊🌊🌊 All your data has been washed into the ocean! 🌊🌊🌊', ephemeral: true });
		} catch (error) {
			console.error(error);
			if (followup) {
				await followup.edit({ content: 'An error occurred while purging data.' });
			}
			await interaction.editReply({ content: 'An error occurred while purging data.', ephemeral: true });
		}
	}
};