// Tracks and processes XP events from messages and voice activity
const YufoDataManager = require('./YufoDataManager');
const xp = require('../commands/management/xp');

// Cache management for voice activity and XP cooldowns
const voiceStateCache = new Map();
const voiceIntervals = new Map();
const xpCooldowns = new Map();

// Processes message events for XP rewards
async function handleMessage(message) {
	const guildId = message.guild.id;
	const dataManager = YufoDataManager.getInstance(guildId);
	const config = dataManager.loadConfig();
	if (!config.xpSettings) config.xpSettings = dataManager.getDefaultConfig().xpSettings;
	if (!config.xpSettings.doIncludeBots && message.author.bot) return;

	// Get cooldown time from config or use default of 1000ms
	const cooldownTime = config.xpSettings.cooldownTime ?? 1000;

	// Get channel-specific XP or use default
	const xpAmount = config.xpSettings.messageXP.get(message.channel.id) ?? config.xpSettings.defaultMessageXP ?? 2;

	// Check cooldown
	const cooldownKey = `${guildId}-${message.author.id}-msg`;
	const lastXP = xpCooldowns.get(cooldownKey) || 0;
	const now = Date.now();

	if (now - lastXP >= cooldownTime) {
		const { memberData, levelDiff, roleChanges } = dataManager.updateMemberXP(message.member, 'add', xpAmount);
		xpCooldowns.set(cooldownKey, now);
		await xp.handleLevelNotification(message.member, memberData, levelDiff, roleChanges, message.channel);
	}
}

// Initiates XP tracking for voice channel activity
function startVoiceXPInterval(member, channelId) {
	const guildId = member.guild.id;
	const userId = member.id;
	// Clear any existing interval
	stopVoiceXPInterval(guildId, userId);

	const dataManager = YufoDataManager.getInstance(guildId);
	const config = dataManager.loadConfig();
	if (!config.xpSettings) return;

	const channelSettings = config.xpSettings.voiceXP.get(channelId) ?? config.xpSettings.defaultVoiceXP;
	const intervalTime = channelSettings.seconds * 1000; // Convert seconds to milliseconds

	const intervalStart = Date.now();
	voiceStateCache.set(`${guildId}-${userId}`, intervalStart);
	// Create new interval
	const intervalId = setInterval(async () => {
		const cooldownKey = `${guildId}-${userId}-voice`;
		const lastXP = xpCooldowns.get(cooldownKey) || 0;
		const now = Date.now();

		// Check if user is still in the voice channel
		const joinTime = voiceStateCache.get(`${guildId}-${userId}`);
		if (!joinTime) {
			stopVoiceXPInterval(member);
			return;
		} if (joinTime !== intervalStart) {
			return;
		}

		// Apply XP if cooldown has passed
		const cooldownTime = config.xpSettings.cooldownTime ?? 1000;
		if (now - lastXP >= cooldownTime) dataManager.updateMemberXP(member, 'add', channelSettings.amount);
		xpCooldowns.set(cooldownKey, now);
	}, intervalTime);

	voiceIntervals.set(`${guildId}-${userId}`, intervalStart);
}

// Stops XP tracking for voice channel activity
function stopVoiceXPInterval(member) {
	const userId = member.id;
	const guildId = member.guild.id;
	const key = `${guildId}-${userId}`;
	const intervalId = voiceIntervals.get(key);
	if (intervalId) {
		clearInterval(intervalId);
		voiceIntervals.delete(key);
	}
}

// Manages voice state changes and XP tracking
async function handleVoiceStateUpdate(oldState, newState) {
	const member = newState.member;
	if (member.user.bot) return;

	const userId = member.id;
	const guildId = newState.guild.id;

	// Handle disconnection or channel change
	if (oldState.channelId) {
		stopVoiceXPInterval(member);
		voiceStateCache.delete(`${guildId}-${userId}`);
	}

	// Handle joining a channel
	if (newState.channelId) {
		voiceStateCache.set(`${guildId}-${userId}`, Date.now());
		startVoiceXPInterval(member, newState.channelId);
	}
}

// Cleans up voice tracking on shutdown
function cleanup() {
	for (const [key, intervalId] of voiceIntervals.entries()) {
		clearInterval(intervalId);
	}
	voiceIntervals.clear();
	voiceStateCache.clear();
	xpCooldowns.clear();
}

module.exports = {
	handleMessage,
	handleVoiceStateUpdate,
	cleanup
};
