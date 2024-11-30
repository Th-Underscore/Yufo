// Central manager for all server-specific data and operations
const YufoConfigManager = require('./YufoConfigManager');
const YufoXPManager = require('./YufoXPManager');
const YufoMemberManager = require('./YufoMemberManager');
const path = require('path');

// Represents a data manager for a specific guild, handling configuration, XP, and member data
class YufoDataManager {
	// Initialize server-specific data manager and its sub-managers
	/** @param {string} guildId */
	constructor(guildId) {
		this.guildId = guildId;
		this.serverDataDir = path.join(process.env.YUFO_DATA_PATH || path.join(__dirname, '../data'), 'servers', guildId);

		// Initialize managers
		this.configManager = new YufoConfigManager(this);
		this.xpManager = new YufoXPManager(this);
		this.memberManager = new YufoMemberManager(this);
		this._cache = {
			config: this.configManager._cache,
			members: this.memberManager._cache,
			xp: this.xpManager._cache
		}
	}

	// Singleton pattern implementation for per-guild data management
	/** @type {Map<string, YufoDataManager>} */
	static _instances = new Map();

	// Gets or creates instance for specific guild
	/**
	 * Creates a new instance of YufoDataManager for the provided guildId if it doesn't already exist.
	 * Otherwise, returns the existing instance.
	 * @param {string} guildId
	 * @returns {YufoDataManager}
	 */
	static getInstance(guildId) {
		if (this._instances.has(guildId)) return this._instances.get(guildId);

		const manager = new this(guildId);
		this._instances.set(guildId, manager);
		return manager;
	}

	// Saves all cached data for all guild instances
	static saveAllCaches() {
		for (const [guildId, dataManager] of this._instances.entries()) {
			try {
				console.log(`Saving data for guild ${guildId}`);
				dataManager.configManager.save(true);
				dataManager.xpManager.save(true);
				dataManager.memberManager.save(true);
			} catch (error) {
				console.error(`Error saving cached data for guild ${guildId} during shutdown:`, error);
			}
		}
	}

	ensureGuildDirectory() {
		const fs = require('fs');
		try {
			fs.mkdirSync(this.serverDataDir, { recursive: true });
		} catch (error) {
			if (error.code !== 'EEXIST') throw error;
		}
	}

	/**
	 * Force loads data from a JSON file URL into a specified manager
	 * @param {'config' | 'members' | 'xp'} type - The type of data to load
	 * @param {Object} file - The file object containing the URL to load from
	 * @returns {Object} - Object containing success status and message
	 */
	async forceLoadData(type, file, successMsg, errorMsg) {
		if (!file) return null;

		let manager;
		if (type === 'config') manager = this.configManager;
		else if (type === 'members') manager = this.memberManager;
		else if (type === 'xp') manager = this.xpManager;
		else throw new Error(`Invalid data type: ${type}`);

		if (!manager) {
			throw new Error(`Could not find manager for data type: ${type}`);
		}

		const oldData = manager.load();
		try {
			const response = await fetch(file.url);
			const newData = await response.json();

			manager.load(newData);
			manager.save(true);

			return {
				success: true,
				message: successMsg
			};
		} catch (error) {
			console.error(`Error force-loading ${type} data, reverting to old data:`, error);
			manager._cache = oldData;

			return {
				success: false,
				message: errorMsg
			};
		}
	}

	// ##### MANAGER DELEGATION ##### //

	// ### Config Manager methods ### //
	getDefaultConfig() {
		return this.configManager.getDefaultConfig();
	}

	loadConfig() {
		return this.configManager.load();
	}

	saveConfig(force = false) {
		return this.configManager.save(force);
	}

	getAvailablePaths() {
		return this.configManager.getAvailablePaths();
	}

	createPathInConfig(pathId, displayName = pathId) {
		return this.configManager.createPathInConfig(pathId, displayName);
	}

	deletePathInConfig(pathId) {
		return this.configManager.deletePathInConfig(pathId);
	}

	editPathInConfig(pathId, newName, newId) {
		return this.configManager.editPathInConfig(pathId, newName, newId);
	}

	addRoleToConfig(pathId, roleLevel, roleId, roleName, keep = false) {
		return this.configManager.addRoleToConfig(pathId, roleLevel, roleId, roleName, keep);
	}

	removeRoleFromConfig(pathId, roleLevel) {
		return this.configManager.removeRoleFromConfig(pathId, roleLevel);
	}

	editRoleInConfig(pathId, roleLevel, updates, newLevel = null) {
		return this.configManager.editRoleInConfig(pathId, roleLevel, updates, newLevel);
	}

	isNoun(text) {
		return this.configManager.isNoun(text);
	}

	// ### XP Manager methods ### //
	loadXPCache() {
		return this.xpManager.load();
	}

	saveXPCache(force = false) {
		return this.xpManager.save(force);
	}

	setXPFormula(expression, min, max = null) {
		return this.xpManager.setXPFormula(expression, min, max);
	}

	removeXPFormula(level) {
		return this.xpManager.removeXPFormula(level);
	}

	resetXPFormulas() {
		return this.xpManager.resetXPFormulas();
	}

	calculateLevelXP(level) {
		return this.xpManager.calculateLevelXP(level);
	}

	// ### Role Manager methods ### //
	loadMembers() {
		return this.memberManager.load();
	}

	saveMembers(force = false) {
		return this.memberManager.save(force);
	}

	detectRoleChanges(memberData, initialLevel, newLevel, memberRoleManager) {
		return this.memberManager.detectRoleChanges(memberData, initialLevel, newLevel, memberRoleManager);
	}

	updateMemberXP(member, operation, amount) {
		return this.memberManager.updateMemberXP(member, operation, amount);
	}

	updateMemberLevel(member, operation, amount) {
		return this.memberManager.updateMemberLevel(member, operation, amount);
	}

	findRoleForLevel(pathId, roleLevel, roleManager = null) {
		return this.memberManager.findRoleForLevel(pathId, roleLevel, roleManager);
	}

	getRolesForPath(pathId, guildRoleManager) {
		return this.memberManager.getRolesForPath(pathId, guildRoleManager);
	}

	detectAndSetPath(userId, memberRoleManager, newLevel, initialLevel) {
		return this.memberManager.detectAndSetPath(userId, memberRoleManager, newLevel, initialLevel);
	}

	setPath(memberData, memberRoleIds, newPath, level=null, memberRoleManager=null) {
		return this.memberManager.setPath(memberData, memberRoleIds, newPath, level, memberRoleManager);
	}

	getMemberData(memberId) {
		return this.memberManager.getMemberData(memberId);
	}

	getMemberLevel(memberId) {
		return this.memberManager.getMemberLevel(memberId);
	}
}

module.exports = YufoDataManager;
