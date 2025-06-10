const {
  SlashCommandBuilder,
  EmbedBuilder,
  ActionRowBuilder,
  StringSelectMenuBuilder,
  ButtonBuilder,
  ButtonStyle
} = require('discord.js');

const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
puppeteer.use(StealthPlugin());

module.exports = {
  data: new SlashCommandBuilder()
    .setName('getcommentary')
    .setDescription('Get commentary from a Bible verse')
    .addStringOption(option =>
      option.setName('book').setDescription('Book name').setRequired(true))
    .addStringOption(option =>
      option.setName('chapter').setDescription('Chapter number').setRequired(true))
    .addStringOption(option =>
      option.setName('verse').setDescription('Verse number').setRequired(true)),

  async execute(interaction) {
    const book = interaction.options.getString('book')?.toLowerCase();
    const chapter = interaction.options.getString('chapter');
    const verse = interaction.options.getString('verse');

    await interaction.deferReply();

    let browser;
    try {
      browser = await puppeteer.launch({ headless: true });
      const page = await browser.newPage();

      await page.goto(`https://catenabible.com/${book}/${chapter}/${verse}`, {
        waitUntil: 'networkidle2',
        timeout: 30000
      });

      const page404 = await page.$('div#__next h1');
      if (page404) {
        await interaction.editReply('No verse found. Try again with a valid book/chapter/verse.');
        await browser.close();
        return;
      }

      await page.waitForSelector('div#__next', { timeout: 20000 }).catch(() => {});
      await page.waitForSelector('div.slideContent', { timeout: 20000 }).catch(() => {});

      const slideHandles = await page.$$('div.slideContent');
      if (!slideHandles.length) {
        await interaction.editReply('No commentaries found for this verse.');
        await browser.close();
        return;
      }

      let slides = [];
      for (const slide of slideHandles) {
        try {
          const readMoreLabel = await slide.$('label > span.commentarySeeMore');
          if (readMoreLabel) {
            const label = await readMoreLabel.evaluateHandle(el => el.parentElement);
            const forAttr = await label.evaluate(el => el.getAttribute('for'));
            if (forAttr) {
              const checkbox = await slide.$(`input#${forAttr}`);
              if (checkbox) {
                await label.click();
                await new Promise(r => setTimeout(r, 1000));
              }
            }
          }

          const img = await slide.$eval('div.slideHeader img.fatherProfilePic', el => el.src).catch(() => null);
          const name = await slide.$eval('div.slideHeader span > h4', el => el.textContent.trim()).catch(() => 'Unknown');
          const year = await slide.$eval('div.slideHeader span > h5', el => el.textContent.trim()).catch(() => 'Unknown');
          const text = await slide.$eval('div.ac-container > section.ac-small', el => el.innerText.trim()).catch(() => null);

          if (text) {
            slides.push({ img, name, year, text });
          }
        } catch {
          continue;
        }
      }

      if (!slides.length) {
        await interaction.editReply('No commentaries found for this verse.');
        await browser.close();
        return;
      }

      const options = slides.map((slide, i) => ({
        label: slide.name.length > 25 ? slide.name.slice(0, 22) + '...' : slide.name,
        description: slide.year.length > 25 ? slide.year.slice(0, 22) + '...' : slide.year,
        value: i.toString()
      })).slice(0, 25);

      const selectMenu = new StringSelectMenuBuilder()
        .setCustomId('select_commentary_slide')
        .setPlaceholder('Pick a commentary slide')
        .addOptions(options);

      const row = new ActionRowBuilder().addComponents(selectMenu);
      await interaction.editReply({ content: 'Pick a commentary slide:', components: [row] });

      const filter = i => i.user.id === interaction.user.id && i.customId === 'select_commentary_slide';
      const collector = interaction.channel.createMessageComponentCollector({ filter, time: 60000 });

      collector.on('collect', async i => {
        try {
          const idx = parseInt(i.values[0], 10);
          if (isNaN(idx) || !slides[idx]) {
            return i.reply({ content: 'Invalid selection.', ephemeral: true });
          }
          const slide = slides[idx];
          const maxLen = 1000;
          let pages = [];
          for (let start = 0; start < slide.text.length; start += maxLen) {
            pages.push(slide.text.slice(start, start + maxLen));
          }
          let pageIndex = 0;

          const embed = new EmbedBuilder()
            .setTitle(slide.name)
            .setDescription(pages[pageIndex])
            .setColor(0xFFA500)
            .setFooter({ text: 'Made by ocadead' })
            .setAuthor({
              name: `${slide.name} - ${interaction.client.user.username}`,
              iconURL: interaction.client.user.displayAvatarURL()
            });

          if (slide.img) embed.setThumbnail(slide.img);
          if (slide.year && slide.year !== 'Unknown') embed.setAuthor({ name: slide.year });

          const backButton = new ButtonBuilder().setCustomId('back').setLabel('⬅').setStyle(ButtonStyle.Primary).setDisabled(true);
          const nextButton = new ButtonBuilder().setCustomId('next').setLabel('➡').setStyle(ButtonStyle.Primary).setDisabled(pages.length === 1);
          const buttonRow = new ActionRowBuilder().addComponents(backButton, nextButton);

          await i.update({ embeds: [embed], components: [buttonRow] });

          const buttonFilter = btnInt => btnInt.user.id === interaction.user.id && ['back', 'next'].includes(btnInt.customId);
          const buttonCollector = i.channel.createMessageComponentCollector({ filter: buttonFilter, time: 60000 });

          buttonCollector.on('collect', async btnInt => {
            try {
              if (btnInt.customId === 'next') pageIndex = Math.min(pageIndex + 1, pages.length - 1);
              else if (btnInt.customId === 'back') pageIndex = Math.max(pageIndex - 1, 0);

              backButton.setDisabled(pageIndex === 0);
              nextButton.setDisabled(pageIndex === pages.length - 1);

              embed.setDescription(pages[pageIndex]);
              await btnInt.update({ embeds: [embed], components: [new ActionRowBuilder().addComponents(backButton, nextButton)] });
            } catch (btnErr) {
              console.error('Button collector error:', btnErr);
              await btnInt.reply({ content: 'Something went wrong with the buttons.', ephemeral: true }).catch(() => {});
            }
          });

          buttonCollector.on('end', async () => {
            try {
              backButton.setDisabled(true);
              nextButton.setDisabled(true);
              await i.editReply({ components: [new ActionRowBuilder().addComponents(backButton, nextButton)] });
            } catch {}
          });

        } catch (collectErr) {
          console.error('Collector error:', collectErr);
          await i.reply({ content: 'Error processing your selection.', ephemeral: true }).catch(() => {});
        }
      });

      collector.on('end', async () => {
        try {
          await interaction.editReply({ components: [] });
        } catch {}
      });

      await browser.close();
    } catch (err) {
      console.error('Main error:', err);
      if (browser) await browser.close().catch(() => {});
      await interaction.editReply('Error fetching commentary.').catch(() => {});
    }
  }
};
