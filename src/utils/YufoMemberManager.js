// Manages guild member data, levels, and role assignments
const fs = require('fs');
const path = require('path');
const { GuildMember } = require('discord.js');

class YufoMemberManager {
	// Initialize manager with data dependencies and cache settings
	/**
	 * Creates an instance of YufoMemberManager.
	 * @param {import('./YufoDataManager')} dataManager
	 * @memberof YufoMemberManager
	 */
	constructor(dataManager) {
		this.dataManager = dataManager;
		this.guildId = dataManager.guildId;
		this.configManager = dataManager.configManager;
		this.xpManager = dataManager.xpManager;
		this._cache = null;
		this._cacheCooldown = 10000;
		this._cacheLastSave = 0;
	}

	// Returns empty member data structure
	getDefaultMembers() {
		return []; // Map()
	}

	// Loads member data from cache, file, or provided JSON
	load(json = null) {
		// Return if members cache already exists in memory
		if (this._cache) return this._cache;

		// Load from file if not in memory
		const membersPath = path.join(this.dataManager.serverDataDir, 'members.json');
		let newData;

		if (!json) {
			try {
				const data = JSON.parse(fs.readFileSync(membersPath, 'utf8'));
				newData = (data === null) ? new Map(this.getDefaultMembers()) : new Map(data);
			} catch (error) {
				if (error.code !== 'ENOENT') {
					console.error(`Error loading member data for guild ${this.guildId}:`, error);
				}
				newData = new Map(this.getDefaultMembers());
			}
		} else {
			newData = new Map(json);
		}

		this._cache = newData;
		return newData;
	}

	// Saves member data to cache and file
	save(force = false, doReturn = false) {
		const now = Date.now();
		const lastSave = this._cacheLastSave;
		// Check if enough time has passed since last save
		if (!force && now - lastSave < this._cacheCooldown) return;

		const members = this._cache;
		if (!members) return;
		const cachePath = path.join(this.dataManager.serverDataDir, 'members.json');
		try {
			if (doReturn) return JSON.stringify([...members], null, 2); // Convert Map to array
			fs.writeFileSync(cachePath, JSON.stringify([...members], null)); // Convert Map to array
			this._cacheLastSave = now;
		} catch (error) {
			console.error(`Error saving member cache for guild ${this.guildId}:`, error);
		}
	}

	detectRoleChanges(memberData, initialLevel, newLevel, memberRoleManager) {
		const roleChanges = {
			remove: [],
			add: [],
			keep: []
		};

		if (initialLevel === newLevel || !memberData.path) return roleChanges;

		const guildId = this.guildId;
		const config = this.dataManager.loadConfig();
		const path = config.paths?.[memberData.path];
		
		if (!path) {
			throw new Error(`Path "${memberData.path}" not found for member in guild ${guildId}`);
		}

		const isLevelingUp = newLevel > initialLevel;
		const pathLevels = Array.from(path.levels);
		const pathLevelsLength = pathLevels.length;
		const maxConfigLevel = Math.max(...pathLevels, config.xpFormula.maxLevel || Infinity);

		let isInitialLastRole = true;
		let isNewLastRole = true;

		const addToRemove = (roleData) => {
			if (memberRoleManager.cache.some(role => role.id === roleData.id)) {
				roleChanges.remove.push(roleData);
			}
		};

		const addToKeep = (roleData) => {
			((memberRoleManager.cache.some(role => role.id === roleData.id))
				? roleChanges.keep // If user already has this role, keep
				: roleChanges.add // Else add
			).push(roleData);
		};

		// Process roles from highest to lowest level
		for (let i = pathLevelsLength - 1; i >= 0; i--) {
			const roleLevel = pathLevels[i][0];
			const roleData = this.findRoleForLevel(memberData.path, roleLevel, memberRoleManager);

			if (!roleData) continue;

			if (isLevelingUp) {
				if (initialLevel >= roleLevel) {
					if (isInitialLastRole) {
						isInitialLastRole = false;
						if (!isNewLastRole && !roleData.keep) {
							addToRemove(roleData);
						} else if (roleData.keep || isNewLastRole) {
							addToKeep(roleData);
						}
					} else if (roleData.keep) {
						addToKeep(roleData);
					}
				} else if (newLevel >= roleLevel) {
					if (isNewLastRole || roleData.keep) {
						isNewLastRole = false;
						addToKeep(roleData);
					}
				}
			} else {
				if (newLevel >= roleLevel) {
					if (isNewLastRole) {
						isNewLastRole = false;
						if (!roleData.keep) {
							addToKeep(roleData);
						} else {
							addToKeep(roleData);
						}
					} else if (roleData.keep) {
						addToKeep(roleData);
					}
				} else if (initialLevel >= roleLevel) {
					if (isInitialLastRole) {
						isInitialLastRole = false;
						addToRemove(roleData);
						if (roleData.keep && !isNewLastRole) {
							addToRemove(roleData);
						}
					} else if (roleData.keep) {
						addToRemove(roleData);
					}
				}
			}
		}

		return roleChanges;
	}

	/**
	 * @param {GuildMember} member
	 * @param {string} operation
	 * @param {int} amount
	 * @returns 
	 */
	updateMemberXP(member, operation, amount) {
		const userId = member.id;
		const memberRoleManager = member.roles;

		const membersData = this.load();
		const config = this.dataManager.loadConfig();

		const memberData = this.getMemberData(userId);

		switch (operation) {
			case 'add':
				memberData.xp += amount;
				break;
			case 'remove':
				memberData.xp = Math.max(0, memberData.xp - amount);
				break;
			case 'set':
				memberData.xp = Math.max(0, amount);
				break;
			case 'reset':
				memberData.xp = 0;
				break;
			default:
				throw new Error(`Invalid operation: ${operation}`);
		}

		const initialLevel = memberData.level;
		const maxLevel = config.xpFormula.maxLevel;

		// Calculate new level based on XP
		let newLevel = memberData.level;
		let levelDiff = 0;
		if (operation !== 'reset') {
			// Calculate XP requirements for surrounding levels
			while (!maxLevel || newLevel < maxLevel) {
				const nextLevelXP = this.xpManager.calculateLevelXP(newLevel + 1);
				if (memberData.xp >= nextLevelXP.total) {
					newLevel++;
					levelDiff++;
				} else {
					break;
				}
			}
			while (newLevel > 0) {	
				const currentLevelXP = this.xpManager.calculateLevelXP(newLevel);
				if (memberData.xp < currentLevelXP.total) {
					newLevel--;
					levelDiff--;
				} else {
					break;
				}
			}
		} else {
			newLevel = 0;
			levelDiff -= initialLevel;
		}

		// If level changed, update member data and handle role changes
		if (levelDiff) {
			memberData.level = newLevel;
			
			const result = this.detectAndSetPath(userId, memberRoleManager, newLevel, initialLevel);

			return {
				memberData,
				levelDiff,
				roleChanges: result.roleChanges
			};
		}

		return {
			memberData,
			levelDiff: 0,
			roleChanges: {
				remove: [],
				add: [],
				keep: []
			}
		};
	}

	updateMemberLevel(member, operation, amount) {
		const userId = member.id;
		const memberRoleManager = member.roles;

		const membersData = this.load();
		const config = this.dataManager.loadConfig();

		let memberData = this.getMemberData(userId);
		
		const maxLevel = config.xpFormula.maxLevel;
		const initialLevel = memberData.level;
		let newLevel = memberData.level;

		switch (operation) {
			case 'add':
				newLevel = Math.min(maxLevel || Infinity, newLevel + amount);
				break;
			case 'remove':
				newLevel = Math.max(0, newLevel - amount);
				break;
			case 'set':
				newLevel = Math.max(0, Math.min(maxLevel || Infinity, amount));
				break;
			case 'reset':
				newLevel = 0;
				break;
			default:
				throw new Error(`Invalid operation: ${operation}`);
		}

		const levelDiff = newLevel - initialLevel;

		// If level changed, update member data and handle role changes
		if (levelDiff) {
			memberData.level = newLevel;
			memberData.xp = this.xpManager.calculateLevelXP(newLevel).total;
			
			const result = this.detectAndSetPath(userId, memberRoleManager, newLevel, initialLevel);

			return {
				memberData,
				levelDiff,
				roleChanges: result.roleChanges
			};
		}

		return {
			memberData,
			levelDiff: 0,
			roleChanges: {
				remove: [],
				add: [],
				keep: []
			}
		};
	}

	findRoleForLevel(pathId, roleLevel, roleManager = null) {
		const config = this.dataManager.loadConfig();
		const path = config.paths[pathId];
		if (!path) return null;

		const roleData = path.levels.get(roleLevel);
		if (!roleData) return null;

		if (roleManager) {
			const role = roleManager.guild.roles.cache.get(roleData.id);
			if (role) {
				roleData.id = role.id;
				roleData.name = role.name;
			}
		}

		return roleData;
	}

	getRolesForPath(pathId, guildRoleManager) {
		const config = this.dataManager.loadConfig();
		const path = config.paths[pathId];
		if (!path) return [];

		const roles = [];
		for (const [level, roleData] of path.levels) {
			const role = guildRoleManager.cache.get(roleData.id);
			if (role) {
				roles.push({
					level,
					id: role.id,
					name: role.name,
					keep: roleData.keep
				});
			}
		}

		return roles;
	}

	detectAndSetPath(userId, memberRoleManager, newLevel, initialLevel, newPath = null) {
		const config = this.dataManager.loadConfig();
		const membersData = this.loadMembers();
		
		const memberData = this.getMemberData(userId);
		
		if (!newLevel) newLevel = memberData.level;
		const memberRoleIds = memberRoleManager.cache.map(role => role.id);

		if (newPath) {
			return this.setPath(memberData, memberRoleIds, newPath, newLevel, memberRoleManager);
		}
		
		// Loop through each path in config
		for (const [pathId, pathData] of Object.entries(config.paths)) {
			// Check each level in the path
			for (const [_, roleData] of pathData.levels) {
				// If user has this role, they belong to this path
				if (memberRoleIds.includes(roleData.id)) {
					return this.setPath(memberData, memberRoleIds, newPath, newLevel, memberRoleManager);
				}
			}
		}
		
		// No path change
		return {
			oldPath: memberData.path,
			newPath: null,
			level: newLevel,
			roleChanges: this.detectRoleChanges(memberData, initialLevel, newLevel, memberRoleManager)
		};
	}

	setPath(memberData, memberRoleIds, newPath, level=null, memberRoleManager=null) {
		const oldPath = memberData.path;
		if (oldPath === newPath) {
			return {
				oldPath,
				newPath: null,
				level: memberData.level,
				roleChanges: {
					remove: [],
					add: [],
					keep: []
				}
			};
		}
		const config = this.dataManager.loadConfig();
		memberData.path = newPath;
		this.saveMembers();
		// Remove roles from old path if it exists
		let removeRoles = [];
		if (oldPath && config.paths[oldPath]) {
			// Get all roles from old path
			config.paths[oldPath].levels.forEach((role, _) => {
				if (memberRoleIds.includes(role.id)) {
					removeRoles.push(role.id);
				}
			});
		}
		
		const newLevel = level !== null ? level : memberData.level ?? 0;
		// Get correct roles for new path and level
		if (newLevel && memberRoleManager) {
			const newPathRoleChanges = this.detectRoleChanges(memberData, 0, newLevel, memberRoleManager);
			newPathRoleChanges.remove.push(...removeRoles);

			return {
				oldPath,
				newPath,
				level,
				roleChanges: newPathRoleChanges
			};
		}
		
		return {
			oldPath,
			newPath,
			level,
			roleChanges: {
				remove: removeRoles,
				add: [],
				keep: []
			}
		};
	}

	getMemberData(memberId) {
		const membersData = this.load();
		const memberData = membersData.get(memberId);
		if (!memberData) {
			membersData.set(memberId, { level: 0, xp: 0 });
			this.save();
		}
		return memberData;
	}

	getMemberLevel(memberId) {
		const memberData = this.getMemberData(memberId);
		return memberData ? memberData.level : 0;
	}
}

module.exports = YufoMemberManager;
