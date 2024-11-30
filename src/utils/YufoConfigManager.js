// Manages server-specific configuration data with caching
const fs = require('fs');
const path = require('path');
const compromise = require('compromise');

class YufoConfigManager {
	// Initialize manager with data dependencies and cache settings
	constructor(dataManager) {
		this.dataManager = dataManager;
		this.guildId = dataManager.guildId;
		this.memberManager = dataManager.memberManager;
		this.xpManager = dataManager.xpManager;
		this._cache = null;
		this._cacheCooldown = 10000;
		this._cacheLastSave = 0;
	}

	// Returns default configuration structure
	getDefaultConfig() {
		return {
			paths: {},
			xpFormula: {
				formulas: [ // Map()
					// x = last level relative xp, n = last level total xp, l = new level
					// X = new relative xp, N = new total xp, t = # of levels since last formula, B = first (base) n of current formula
					[1, "5"], // Constant value as baseline, first level-up (X = 5) (N = 5)
					[2, "x"], // Linear progression by default, copy of "5" (X = 5) (N = 5t + B)
					[10, "x+10"], // Quadratic progression, 10 more xp for each level (X = 15, 25, ...) (N = 10(t^2 + 2t)/2 + B)
					[20, "1.1x"], // Exponential progression, 10% more xp for each level (X = 115.5, 127.05 ...) (N = 1.1^t * x + n)
					[30, "0.1n"] // Exponential progression, 10% more total xp for each level (X = 2734.35, 3007.78, ...) (N = 1.1^t * n)
				],
				maxLevel: null  // Server-wide maximum level
			},
			defaultChannel: null,
			xpSettings: {
				doIncludeBots: true,
				defaultMessageXP: 2,
				messageXP: [], // Map()
				defaultVoiceXP: {
					amount: 1,
					seconds: 5
				},
				voiceXP: [] // Map()
			}
		};
	}

	// Loads configuration from cache, file, or provided JSON
	load(json = null) {
		// Return if config cache already exists in memory
		if (this._cache) return this._cache;

		let newData;
		if (!json) {
			// Load from file if not in memory
			const configPath = path.join(this.dataManager.serverDataDir, 'config.json');

			try {
				const data = JSON.parse(fs.readFileSync(configPath, 'utf8'));
				newData = (data === null) ? this.getDefaultConfig() : data;
			} catch (error) {
				if (error.code !== 'ENOENT') {
					console.error(`Error loading config data for guild ${this.guildId}:`, error);
				}
				newData = this.getDefaultConfig();
			}
		} else {
			newData = json;
		}

		try {
			newData.xpFormula.formulas = new Map(newData.xpFormula.formulas);
			newData.xpSettings.messageXP = new Map(newData.xpSettings.messageXP);
			newData.xpSettings.voiceXP = new Map(newData.xpSettings.voiceXP);
			if (newData?.paths) {
				for (const path of Object.values(newData.paths)) {
					path.levels = new Map(path.levels);
				}
			}
		} catch (error) {
			throw new Error(`Error converting config data for guild ${this.guildId}:`, error);
		}

		this._cache = newData;
		return newData;
	}

	// Saves configuration to cache and file
	save(force = false, doReturn = false) {
		const now = Date.now();
		const lastSave = this._cacheLastSave;
		// Check if enough time has passed since last save
		if (!force && now - lastSave < this._cacheCooldown) return;

		const config = this.load();
		if (!config) return;

		const cachePath = path.join(this.dataManager.serverDataDir, 'config.json');
		try {
			const convertMapToArray = (_, value) => value instanceof Map ? Array.from(value) : value;
			if (doReturn) return JSON.stringify(config, convertMapToArray, 2);
			fs.writeFileSync(cachePath, JSON.stringify(config, convertMapToArray));
			this._cacheLastSave = now;
		} catch (error) {
			console.error(`Error saving config cache for guild ${this.guildId}:`, error);
		}
	}

	// Path management methods
	getAvailablePaths() {
		const config = this.load();
		return Object.keys(config.paths || {});
	}

	createPathInConfig(pathId, displayName = pathId, isNoun = true) {
		const config = this.load();
		if (config.paths[pathId]) {
			throw new Error(`Path "${pathId}" already exists`);
		}

		config.paths[pathId] = {
			displayName,
			isNoun,
			levels: new Map()
		};
		this.save(true);
		return config;
	}

	deletePathInConfig(pathId) {
		const config = this.load();
		if (!config.paths[pathId]) {
			throw new Error(`Path "${pathId}" does not exist`);
		}
		delete config.paths[pathId];
		this.save(true);
		return config;
	}

	editPathInConfig(pathId, newName, newId, isNoun) {
		const config = this.load();
		const path = config.paths[pathId];
		if (!path) {
			throw new Error(`Path "${pathId}" does not exist`);
		}

		if (newName) {
			path.displayName = newName;
		}

		if (isNoun !== undefined) {
			path.isNoun = isNoun;
		}

		if (newId && newId !== pathId) {
			if (config.paths[newId]) {
				throw new Error(`Path "${newId}" already exists`);
			}
			config.paths[newId] = path;
			delete config.paths[pathId];
		}

		this.save(true);
		return config;
	}

	addRoleToConfig(pathId, roleLevel, roleId, roleName, keep = false) {
		const config = this.load();
		const path = config.paths[pathId];
		if (!path) {
			throw new Error(`Path "${pathId}" does not exist`);
		}

		path.levels.set(roleLevel, {
			id: roleId,
			name: roleName,
			keep
		});

		this.ensureLevelOrderForPath(pathId);
		return config;
	}

	removeRoleFromConfig(pathId, roleLevel) {
		const config = this.load();
		const path = config.paths[pathId];
		if (!path) {
			throw new Error(`Path "${pathId}" does not exist`);
		}

		if (!path.levels.has(roleLevel)) {
			throw new Error(`No role found at level ${roleLevel}`);
		}

		path.levels.delete(roleLevel);
		this.save(true);
		return config;
	}

	editRoleInConfig(pathId, roleLevel, updates, newLevel = null) {
		const config = this.load();
		const path = config.paths[pathId];
		if (!path) {
			throw new Error(`Path "${pathId}" does not exist`);
		}

		const roleData = path.levels.get(roleLevel);
		if (!roleData) {
			throw new Error(`No role found at level ${roleLevel}`);
		}

		// Update role data
		Object.assign(roleData, updates);

		// Move role to new level if specified
		if (newLevel !== null && newLevel !== roleLevel) {
			path.levels.delete(roleLevel);
			path.levels.set(newLevel, roleData);
			this.ensureLevelOrderForPath(pathId);
		}

		this.save(true);
		return config;
	}

	ensureLevelOrder(levelMap) {
		const levels = Array.from(levelMap.entries()).sort((a, b) => a[0] - b[0]);
		levelMap.clear();
		for (const [level, data] of levels) {
			levelMap.set(level, data);
		}
	}

	ensureLevelOrderForPath(pathId) {
		const config = this.load();
		const path = config.paths[pathId];
		if (!path) return;
		this.ensureLevelOrder(path.levels);
		this.save(true);
	}

	isNoun(text) {
		if (!text) return;
		const doc = compromise(text);
		return doc.nouns().found;
	}
}

module.exports = YufoConfigManager;
