// Creates Discord embeds with automatic pagination for large content
const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ComponentType } = require('discord.js');

class PaginatedEmbedBuilder {
	// Initialize builder with formatting options
	constructor(options = {}) {
		this.maxLinesPerPage = options.maxLinesPerPage || 25;
		this.color = options.color || 0x2B2D31;
		this.title = options.title || '';
		this.description = options.description || '';
		this.fields = [];
		this.pages = [];
		this.currentPageIndex = 0;
	}

	// Add a single field to the embed
	addField(name, value, inline = false) {
		this.fields.push({ name, value, inline });
		return this;
	}
	// Add multiple fields to the embed
	/** @param {Array} fields */
	addFields(fields) {
		this.fields.push(...fields);
		return this;
	}

	// Builds paginated embeds based on content length
	build() {
		this.pages = [];
		let currentPage = new EmbedBuilder()
			.setColor(this.color)
			.setTitle(this.title)
			.setDescription(this.description);

		let currentPageFields = [];
		let currentPageLines = 0;
		let lastFieldName = null;

		for (const field of this.fields) {
			const lines = field.value.split('\n');
			let remainingLines = [...lines];
			let fieldName = field.name;

			while (remainingLines.length > 0) {
				// Calculate how many lines we can fit on this page
				const availableLines = this.maxLinesPerPage - currentPageLines;

				// Check if we should start a new page to keep the field together
				if (currentPageLines > 0 &&
					remainingLines.length <= this.maxLinesPerPage &&
					remainingLines.length > availableLines &&
					remainingLines.length <= Math.ceil(this.maxLinesPerPage * 0.7)) {
					// If the remaining lines would fit on a new page and would take up less than 70% of it,
					// start a new page to keep the field together
					currentPage.addFields(currentPageFields);
					this.pages.push(currentPage);

					currentPage = new EmbedBuilder()
						.setColor(this.color)
						.setTitle(this.title)
						.setDescription(this.description);

					currentPageFields = [];
					currentPageLines = 0;
					lastFieldName = null; // Reset since we're keeping the field together
					continue;
				}

				const linesToAdd = remainingLines.slice(0, availableLines);
				const value = linesToAdd.join('\n');

				// If this isn't the first chunk and it's from the same field, add (continued)
				if (fieldName === lastFieldName) {
					fieldName = `${field.name} (continued)`;
				}

				currentPageFields.push({
					name: fieldName,
					value,
					inline: field.inline
				});
				currentPageLines += linesToAdd.length;

				// Remove the lines we just added
				remainingLines = remainingLines.slice(linesToAdd.length);

				// If we have more lines to add or we've reached the page limit, create a new page
				if (remainingLines.length > 0 || currentPageLines >= this.maxLinesPerPage) {
					currentPage.addFields(currentPageFields);
					this.pages.push(currentPage);

					// Create new page
					currentPage = new EmbedBuilder()
						.setColor(this.color)
						.setTitle(this.title)
						.setDescription(this.description);

					currentPageFields = [];
					currentPageLines = 0;
					lastFieldName = remainingLines.length > 0 ? field.name : null; // Only set if we're continuing the field
				}
			}

			// Reset lastFieldName when moving to a new field
			if (remainingLines.length === 0) {
				lastFieldName = null;
			}
		}

		// Add remaining fields to the last page
		if (currentPageFields.length > 0) {
			currentPage.addFields(currentPageFields);
			this.pages.push(currentPage);
		}

		// Add page numbers and timestamp only if there are multiple pages
		this.pages.forEach((page, index) => {
			if (this.pages.length > 1) {
				page.setFooter({
					text: `Page ${index + 1}/${this.pages.length}`
				});
			}
			page.setTimestamp();
		});

		return this;
	}

	// Returns a navigation row for the paginated embed
	getNavigationRow() {
		return new ActionRowBuilder()
			.addComponents(
				new ButtonBuilder()
					.setCustomId('first')
					.setLabel('⏮️')
					.setStyle(ButtonStyle.Secondary),
				new ButtonBuilder()
					.setCustomId('prev')
					.setLabel('◀️')
					.setStyle(ButtonStyle.Primary),
				new ButtonBuilder()
					.setCustomId('next')
					.setLabel('▶️')
					.setStyle(ButtonStyle.Primary),
				new ButtonBuilder()
					.setCustomId('last')
					.setLabel('⏭️')
					.setStyle(ButtonStyle.Secondary)
			);
	}

	// Creates a collector for the paginated embed's navigation buttons
	async createCollector(interaction, options = {}) {
		const { time = 300000, ephemeral = true } = options;

		// Only show navigation row if there are multiple pages
		const components = this.pages.length > 1 ? [this.getNavigationRow()] : [];

		const response = await interaction.reply({
			embeds: [this.pages[this.currentPageIndex]],
			components,
			ephemeral
		});

		// If there's only one page, no need to create a collector
		if (this.pages.length <= 1) {
			return null;
		}

		const collector = response.createMessageComponentCollector({
			componentType: ComponentType.Button,
			time
		});

		collector.on('collect', async (i) => {
			if (i.user.id !== interaction.user.id) {
				await i.reply({
					content: 'You cannot use these buttons.',
					ephemeral: true
				});
				return;
			}

			switch (i.customId) {
				case 'first':
					this.currentPageIndex = 0;
					break;
				case 'prev':
					this.currentPageIndex = Math.max(0, this.currentPageIndex - 1);
					break;
				case 'next':
					this.currentPageIndex = Math.min(this.pages.length - 1, this.currentPageIndex + 1);
					break;
				case 'last':
					this.currentPageIndex = this.pages.length - 1;
					break;
			}

			await i.update({
				embeds: [this.pages[this.currentPageIndex]],
				components: [this.getNavigationRow()]
			});
		});

		collector.on('end', async () => {
			const disabledRow = new ActionRowBuilder()
				.addComponents(
					...this.getNavigationRow().components.map(button =>
						ButtonBuilder.from(button).setDisabled(true)
					)
				);

			await interaction.editReply({
				components: [disabledRow]
			});
		});

		return collector;
	}
}

module.exports = PaginatedEmbedBuilder;
