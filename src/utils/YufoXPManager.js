// Manages XP calculations and caching for level progression
const fs = require('fs');
const path = require('path');
const mathjs = require('mathjs');

class YufoXPManager {
	// Initialize manager with data dependencies and cache settings
	constructor(dataManager) {
		this.dataManager = dataManager;
		this.guildId = dataManager.guildId;
		this.configManager = dataManager.configManager;
		this.memberManager = dataManager.memberManager;
		this._cache = null;
		this._cacheCooldown = 5000;
		this._cacheLastSave = 0;
	}

	// Returns default XP cache structure with relative and total XP maps
	getDefaultXPCache() {
		return {
			relative: [],  // Map() cache for relative XP values
			total: []	 // Map() cache for total XP values
		};
	}

	// Loads XP data from cache, file, or provided JSON
	load(json = null) {
		// Check if XP cache exists in memory
		if (this._cache) return this._cache;

		// Load from file if not in memory
		const xpPath = path.join(this.dataManager.serverDataDir, 'xpcache.json');
		let newData;

		if (!json) {
			try {
				const data = JSON.parse(fs.readFileSync(xpPath, 'utf8'));
				newData = (data === null) ? this.getDefaultXPCache() : { relative: data[0], total: data[1] };
			} catch (error) {
				if (error.code !== 'ENOENT') {
					console.error(`Error loading XP cache for guild ${this.guildId}:`, error);
				}
				newData = this.getDefaultXPCache();
			}
		} else {
			newData = { relative: json[0], total: json[1] };
		}

		this._cache = newData;
		return newData;
	}

	// Saves XP data to cache and file
	save(force = false, doReturn = false) {
		const now = Date.now();
		const lastSave = this._cacheLastSave;
		// Check if enough time has passed since last save
		if (!force && now - lastSave < this._cacheCooldown) return;

		const cache = this.load();
		if (!cache) return;

		const cachePath = path.join(this.dataManager.serverDataDir, 'xpcache.json');
		try {
			if (doReturn) return JSON.stringify([cache.relative, cache.total], null, 2);
			fs.writeFileSync(cachePath, JSON.stringify([cache.relative, cache.total], null));
			this._cacheLastSave = now;
		} catch (error) {
			console.error(`Error saving XP cache for guild ${this.guildId}:`, error);
		}
	}

	setXPFormula(expression, min, max = null) {
		const config = this.dataManager.loadConfig();

		// Validate the expression by trying to evaluate it
		try {
			// Test with some sample values
			this.calculateXP(expression, 1, { relative: 100, total: 100 });
		} catch (error) {
			throw new Error(`Invalid XP formula: ${error.message}`);
		}

		// Update server-wide max level if provided
		if (max !== null) {
			config.xpFormula.maxLevel = max;
		}

		// Add or update formula for this min level
		config.xpFormula.formulas.set(min, expression);

		// Reset cached values above min level when formulas change
		const cache = this.load();
		if (cache) {
			cache.relative?.splice(min, cache.relative.length - min);
			cache.total?.splice(min, cache.total.length - min);
		}
		this.save(true);
		this.dataManager.saveConfig(true);

		return config;
	}

	removeXPFormula(level) {
		const config = this.dataManager.loadConfig();
		const { formulas } = config.xpFormula;

		// Find the formula that applies to this level
		let formulaLevel = null;
		for (const [min, formula] of formulas) {
			if (level >= min && (!formula.max || level <= formula.max)) {
				formulaLevel = min;
				break;
			}
		}

		if (formulaLevel === null) {
			throw new Error(`No formula found for level ${level}`);
		}

		formulas.delete(formulaLevel);
		this.dataManager.saveConfig(true);
		return config;
	}

	resetXPFormulas() {
		const config = this.dataManager.loadConfig();
		const defaultConfig = this.dataManager.getDefaultConfig();

		config.xpFormula = defaultConfig.xpFormula;
		this.dataManager.saveConfig(true);
		return config;
	}

	getFormulaForLevel(formulas, level) {
		// Find the highest min level that's less than or equal to the current level
		let applicableMin = undefined;
		for (const [min, formula] of formulas) {
			if (level >= min) applicableMin = min;
		}

		if (applicableMin === undefined) {
			throw new Error(`No formula found for level ${level}`);
		}

		return formulas.get(applicableMin);
	}

	calculateXP(expression, level, previousXP) {
		const l = level;				// Current level
		const x = previousXP.relative;  // XP from previous level
		const n = previousXP.total;	 // Total XP up to previous level

		try {
			return Math.max(0, mathjs.parse(expression).evaluate({ x, n, l }));
		} catch (error) {
			throw new Error(`Invalid expression: ${error.message}`);
		}
	}

	calculateLevelXP(level) {
		const config = this.dataManager.loadConfig();
		const cache = this.load();

		savingCache:
		// Calculate relative and total XP for this level
		if (level > 0 && (cache.relative[level] === undefined || cache.total[level] === undefined)) {
			// Get previous level's XP
			const previousXP = this.calculateLevelXP(level - 1);

			if (cache.relative[level] !== undefined) { // If relative XP is already cached while total is not
				cache.total[level] = previousXP.total + cache.relative[level];
				this.save(true);
				break savingCache;
			}

			// Find the appropriate formula for this level
			const formula = this.getFormulaForLevel(config.xpFormula.formulas, level);

			// Calculate and cache this level's relative XP if not already cached
			cache.relative[level] = this.calculateXP(formula, level, previousXP);

			// Calculate total XP up to this level if not already cached
			if (cache.total[level] === undefined) cache.total[level] = previousXP.total + cache.relative[level];

			this.save(true);
		}

		return {
			relative: cache.relative[level],
			total: cache.total[level]
		};
	}

	ensureLevelOrderForFormula() {
		const config = this.dataManager.loadConfig();
		this.dataManager.ensureLevelOrder(config.xpFormula.formulas);
		this.dataManager.saveConfig(true);
	}
}

module.exports = YufoXPManager;
