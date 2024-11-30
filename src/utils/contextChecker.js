// Utility functions for checking permissions and handling DM channels
module.exports = {
    // Checks if user has specific permission in current channel
    hasPermission: (interaction, permission) =>
        interaction.member ?
        interaction.member.permissionsIn(interaction.channel).has(permission) :
        true,
    // Gets or creates DM channel for a user
    getDirectMessageChannel: async (user) =>
        user.dmChannel || await user.createDM()
}