const {
  SlashCommandBuilder,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle
} = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('help')
    .setDescription('Show Bible book abbreviations'),

  async execute(interaction) {
    const oldTestament = `
**Genesis** - gn  **Exodus** - ex  **Leviticus** - lv  
**Numbers** - nm  **Deuteronomy** - dt  **Joshua** - jo  
**Judges** - jgs  **Ruth** - ru  **1 Samuel** - 1sm  
**2 Samuel** - 2sm  **1 Kings** - 1kgs  **2 Kings** - 2kgs  
**1 Chronicles** - 1chr  **2 Chronicles** - 2chr  
**1 Esdras** - 1esd  **Ezra** - ezr  **Nehemiah** - neh  
**Tobit** - tb  **Judith** - jdt  **Esther** - est  
**1 Maccabees** - 1mc  **2 Maccabees** - 2mc  **Psalms** - ps  
**Job** - jb  **Proverbs** - prv  **Ecclesiastes** - eccl  
**Song of Songs** - sg  **Wisdom** - ws  **Sirach** - sir  
**Hosea** - hos  **Amos** - am  **Micah** - mi  
**Joel** - jl  **Obadiah** - ob  **Jonah** - jon  
**Nahum** - na  **Habakkuk** - hb  **Zephaniah** - zep  
**Haggai** - hg  **Zechariah** - zec  **Malachi** - mal  
**Isaiah** - is  **Jeremiah** - jer  **Baruch** - bar  
**Lamentations** - lam  **Epistle of Jeremiah** - eoj  
**Ezekiel** - ez  **Daniel** - dn  **Prayer of Manasseh** - poman
`;

    const newTestament = `
**Matthew** - mt  **Mark** - mk  **Luke** - lk  **John** - jn  
**Acts** - acts  **Romans** - rom  **1 Corinthians** - 1cor  
**2 Corinthians** - 2cor  **Galatians** - gal  **Ephesians** - eph  
**Philippians** - phil  **Colossians** - col  **1 Thessalonians** - 1thes  
**2 Thessalonians** - 2thes  **1 Timothy** - 1tm  **2 Timothy** - 2tm  
**Titus** - ti  **Philemon** - phlm  **Hebrews** - heb  
**James** - jas  **1 Peter** - 1pt  **2 Peter** - 2pt  
**1 John** - 1jn  **2 John** - 2jn  **3 John** - 3jn  
**Jude** - jude  **Revelation** - rv
`;

    const embed1 = new EmbedBuilder()
      .setTitle('📖 Old Testament Abbreviations')
      .setDescription(oldTestament)
      .setColor('#b58d4f');

    const embed2 = new EmbedBuilder()
      .setTitle('📘 New Testament Abbreviations')
      .setDescription(newTestament)
      .setColor('#4f79b5');

    const buttons = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId('old')
        .setLabel('Old Testament')
        .setStyle(ButtonStyle.Primary)
        .setDisabled(true),
      new ButtonBuilder()
        .setCustomId('new')
        .setLabel('New Testament')
        .setStyle(ButtonStyle.Secondary)
    );

    const msg = await interaction.reply({ embeds: [embed1], components: [buttons], ephemeral: false, fetchReply: true });

    const collector = msg.createMessageComponentCollector({ time: 60000 });

    collector.on('collect', i => {
      if (i.customId === 'new') {
        buttons.components[0].setDisabled(false);
        buttons.components[1].setDisabled(true);
        i.update({ embeds: [embed2], components: [buttons] });
      } else if (i.customId === 'old') {
        buttons.components[0].setDisabled(true);
        buttons.components[1].setDisabled(false);
        i.update({ embeds: [embed1], components: [buttons] });
      }
    });

    collector.on('end', () => {
      buttons.components.forEach(btn => btn.setDisabled(true));
      msg.edit({ components: [buttons] }).catch(() => {});
    });
  }
};
