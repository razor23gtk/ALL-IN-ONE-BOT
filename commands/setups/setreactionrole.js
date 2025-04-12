const { SlashCommandBuilder } = require('@discordjs/builders');
const { ActionRowBuilder, ButtonBuilder, EmbedBuilder, PermissionsBitField, ButtonStyle } = require('discord.js');
const { reactionRolesCollection, serverConfigCollection } = require('../../mongodb');
const cmdIcons = require('../../UI/icons/commandicons');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('setreactionrole')
    .setDescription('Set up or view a reaction role message')
    .setDefaultMemberPermissions(PermissionsBitField.Flags.ManageChannels)
    .addSubcommand(sub =>
      sub.setName('set')
        .setDescription('Set up a reaction role message')
        .addStringOption(option => option.setName('title').setDescription('Embed title').setRequired(true))
        .addStringOption(option => option.setName('description').setDescription('Embed description').setRequired(true))
        .addChannelOption(option => option.setName('channel').setDescription('Target channel').setRequired(true))
        .addStringOption(option => option.setName('role1').setDescription('First role ID').setRequired(true))
        .addStringOption(option => option.setName('label1').setDescription('Emoji for first button').setRequired(true))
        .addStringOption(option => option.setName('role2').setDescription('Second role ID'))
        .addStringOption(option => option.setName('label2').setDescription('Emoji for second button'))
        .addStringOption(option => option.setName('role3').setDescription('Third role ID'))
        .addStringOption(option => option.setName('label3').setDescription('Emoji for third button'))
        .addStringOption(option => option.setName('role4').setDescription('Fourth role ID'))
        .addStringOption(option => option.setName('label4').setDescription('Emoji for fourth button'))
        .addStringOption(option => option.setName('role5').setDescription('Fifth role ID'))
        .addStringOption(option => option.setName('label5').setDescription('Emoji for fifth button'))
    )
    .addSubcommand(sub =>
      sub.setName('view')
        .setDescription('View reaction role setups for this server')
    ),

  async execute(interaction) {
    if (!interaction.isChatInputCommand()) return;

    const guild = interaction.guild;
    const serverId = guild.id;
    const config = await serverConfigCollection.findOne({ serverId });
    const botManagers = config?.botManagers || [];

    if (!botManagers.includes(interaction.user.id) && interaction.user.id !== guild.ownerId) {
      return interaction.reply({ content: '❌ Only the **server owner** or **bot managers** can use this command.', flags: 64 });
    }

    const subcommand = interaction.options.getSubcommand();

    if (subcommand === 'set') {
      if (!interaction.member.permissions.has(PermissionsBitField.Flags.ManageChannels)) {
        return interaction.reply({ embeds: [new EmbedBuilder().setColor('#ff0000').setDescription('You do not have permission.')], flags: 64 });
      }

      const title = interaction.options.getString('title');
      const description = interaction.options.getString('description');
      const channel = interaction.options.getChannel('channel');

      const roles = [], emojis = [], customIds = [];

      for (let i = 1; i <= 5; i++) {
        const role = interaction.options.getString(`role${i}`);
        const emoji = interaction.options.getString(`label${i}`);
        if (role && emoji) {
          roles.push(role);
          emojis.push(emoji);
          customIds.push(`reaction_role_${channel.id}_${i}`);
        }
      }

      if (roles.length === 0) {
        return interaction.reply({ content: 'You must provide at least one role and emoji.', flags: 64 });
      }

      const embedDescription = roles.map((role, i) => `${emojis[i]} → <@&${role}>`).join('\n');
      const embed = new EmbedBuilder()
        .setTitle(title)
        .setDescription(`${description}\n\n${embedDescription}`)
        .setColor('#FF00FF');

      const buttons = roles.map((_, i) =>
        new ButtonBuilder()
          .setCustomId(customIds[i])
          .setEmoji(emojis[i])
          .setStyle(ButtonStyle.Secondary)
      );

      const row = new ActionRowBuilder().addComponents(buttons);
      const message = await channel.send({ embeds: [embed], components: [row] });

      for (let i = 0; i < roles.length; i++) {
        await reactionRolesCollection.insertOne({
          channelId: channel.id,
          messageId: message.id,
          roleId: roles[i],
          customId: customIds[i],
          label: emojis[i],
          style: ButtonStyle.Secondary
        });
      }

      return interaction.reply({ content: '✅ Reaction role message created!', flags: 64 });

    } else if (subcommand === 'view') {
      const all = await reactionRolesCollection.find({}).toArray();
      const filtered = all.filter(rr => guild.channels.cache.has(rr.channelId));

      if (filtered.length === 0) {
        return interaction.reply({ content: 'No setups found.', flags: 64 });
      }

      const grouped = {};
      for (const rr of filtered) {
        if (!grouped[rr.channelId]) grouped[rr.channelId] = [];
        grouped[rr.channelId].push(rr);
      }

      const embeds = [];
      for (const channelId in grouped) {
        const channel = guild.channels.cache.get(channelId);
        let description = `**Channel:** <#${channelId}>\n`;
        for (const rr of grouped[channelId]) {
          description += `🆔 **Message ID:** ${rr.messageId}\n🎭 **Role:** <@&${rr.roleId}> | **Emoji:** ${rr.label}\n🔗 **Custom ID:** \`${rr.customId}\`\n\n`;
        }

        if (description.length > 2048) {
          let chunk = '';
          for (const line of description.split('\n')) {
            if ((chunk + line + '\n').length > 2048) {
              embeds.push(new EmbedBuilder().setColor('#FF00FF').setTitle('Reaction Role Setup').setDescription(chunk));
              chunk = line + '\n';
            } else {
              chunk += line + '\n';
            }
          }
          if (chunk) embeds.push(new EmbedBuilder().setColor('#FF00FF').setTitle('Reaction Role Setup').setDescription(chunk));
        } else {
          embeds.push(new EmbedBuilder().setColor('#FF00FF').setTitle('Reaction Role Setup').setDescription(description));
        }
      }

      return interaction.reply({ embeds, flags: 64 });
    }
  }
};
