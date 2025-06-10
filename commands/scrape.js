const {
    SlashCommandBuilder,
    ActionRowBuilder,
    StringSelectMenuBuilder,
    StringSelectMenuOptionBuilder,
    ComponentType,
    EmbedBuilder,
    ButtonBuilder,
    ButtonStyle
} = require('discord.js');
const puppeteer = require('puppeteer');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('getcontent')
        .setDescription('Get text from church father writings')
        .addStringOption(option =>
            option.setName('name')
                .setDescription('The bold group (strong text)')
                .setRequired(true))
        .addStringOption(option =>
            option.setName('book')
                .setDescription('A link inside that group')
                .setRequired(true)),

    async execute(interaction) {
        const nameArg = interaction.options.getString('name').toLowerCase();
        const bookArg = interaction.options.getString('book').toLowerCase();

        await interaction.deferReply();

        const browser = await puppeteer.launch({ headless: true });
        const page = await browser.newPage();

        try {
            await page.goto('https://www.newadvent.org/fathers/', { waitUntil: 'domcontentloaded' });

            const groups = await page.$$eval('p', ps => {
                return ps
                    .filter(p => p.querySelector('strong'))
                    .map(p => {
                        const strongText = p.querySelector('strong')?.textContent.trim() || '';
                        const links = Array.from(p.querySelectorAll('a')).map(a => ({
                            text: a.textContent.trim(),
                            href: a.href
                        }));
                        return { strongText, links };
                    });
            });

            const matchedGroup = groups.find(g => g.strongText.toLowerCase().includes(nameArg));
            if (!matchedGroup) {
                await browser.close();
                return interaction.editReply(`No bolded group found with "${nameArg}"`);
            }

            const matchedLink = matchedGroup.links.find(link => link.text.toLowerCase().includes(bookArg));
            if (!matchedLink) {
                await browser.close();
                return interaction.editReply(`No link found for "${bookArg}" in "${matchedGroup.strongText}"`);
            }

            await page.goto(matchedLink.href, { waitUntil: 'domcontentloaded' });

            let sections = await page.$$eval('h2, h3', headers => {
                return headers.map(header => {
                    let next = header.nextElementSibling;
                    let paragraph = '';
                    while (next && next.tagName === 'P') {
                        paragraph += next.textContent.trim() + '\n\n';
                        next = next.nextElementSibling;
                    }
                    return {
                        header: header.textContent.trim(),
                        paragraph: paragraph.trim()
                    };
                }).filter(item => item.paragraph && !/about this page/i.test(item.header));
            });


            if (sections.length === 0) {
                // first try original fallback (a > strong)
                let fallbackLinks = await page.$$eval('a > strong', as => {
                    return as.map(a => ({
                        text: a.textContent.trim(),
                        href: a.parentElement.href
                    }));
                });

                // if only 1 or no fallback links found, check next <p> for multiple <a>
                if (fallbackLinks.length <= 1) {
                    fallbackLinks = await page.$$eval('p', ps => {
                        for (const p of ps) {
                            const links = Array.from(p.querySelectorAll('a'));
                            if (links.length > 1) {
                                return links.map(a => ({
                                    text: a.textContent.trim(),
                                    href: a.href
                                }));
                            }
                        }
                        return [];
                    });
                }

                if (fallbackLinks.length === 0) {
                    await browser.close();
                    return interaction.editReply('No readable sections or fallback links found.');
                }

                const options = fallbackLinks.map(link =>
                    new StringSelectMenuOptionBuilder()
                        .setLabel(link.text.slice(0, 100))
                        .setValue(link.href)
                );

                const menu = new StringSelectMenuBuilder()
                    .setCustomId('fallback_book')
                    .setPlaceholder('No sections found. Pick a book:')
                    .addOptions(options.slice(0, 25));

                const row = new ActionRowBuilder().addComponents(menu);

                const msg = await interaction.editReply({
                    content: 'Pick a book to try again:',
                    components: [row]
                });

                const fallbackSelect = await msg.awaitMessageComponent({
                    componentType: ComponentType.StringSelect,
                    time: 30000,
                    filter: i => i.user.id === interaction.user.id
                });

                await fallbackSelect.deferUpdate();

                await page.goto(fallbackSelect.values[0], { waitUntil: 'domcontentloaded' });

                sections = await page.$$eval('h2, h3', headers => {
                    return headers.map(header => {
                        let next = header.nextElementSibling;
                        let paragraph = '';
                        while (next && next.tagName === 'P') {
                            paragraph += next.textContent.trim() + '\n\n';
                            next = next.nextElementSibling;
                        }
                        return {
                            header: header.textContent.trim(),
                            paragraph: paragraph.trim()
                        };
                    }).filter(item => item.paragraph && !/about this page/i.test(item.header));
                });

                if (sections.length === 0) {
                    await browser.close();
                    return fallbackSelect.update({
                        content: 'Still nothing readable in that book.',
                        components: []
                    });
                }

                interaction = fallbackSelect;
            }

            const options = sections.slice(0, 25).map((sec, i) =>
                new StringSelectMenuOptionBuilder()
                    .setLabel(sec.header.slice(0, 100))
                    .setValue(i.toString())
            );

            const menu = new StringSelectMenuBuilder()
                .setCustomId('select_section')
                .setPlaceholder('Choose a section to read')
                .addOptions(options);

            const row = new ActionRowBuilder().addComponents(menu);
            await browser.close();

            const msg = await interaction.editReply({
                content: 'Pick a section:',
                components: [row]
            });

            const selectInteraction = await msg.awaitMessageComponent({
                componentType: ComponentType.StringSelect,
                time: 30000,
                filter: i => i.user.id === interaction.user.id
            });

            const index = parseInt(selectInteraction.values[0]);
            const section = sections[index];
            const chunks = section.paragraph.match(/(.|\n){1,3000}/g);
            let current = 0;

            const makeEmbed = (index) => new EmbedBuilder()
                .setTitle(section.header + (chunks.length > 1 ? ` (Part ${index + 1}/${chunks.length})` : ''))
                .setDescription(chunks[index])
                .setColor(0x4682B4)
                .setAuthor({
                    name: `${matchedGroup.strongText} - ${interaction.client.user.username}`,
                    iconURL: interaction.client.user.displayAvatarURL()
                })
                .setFooter({
                    text: 'bot made by ocadead'
                });


            const makeButtons = () => new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId('prev').setLabel('◀️').setStyle(ButtonStyle.Primary).setDisabled(current === 0),
                new ButtonBuilder().setCustomId('next').setLabel('▶️').setStyle(ButtonStyle.Primary).setDisabled(current === chunks.length - 1)
            );

            let reply = await selectInteraction.update({
                content: '',
                embeds: [makeEmbed(current)],
                components: chunks.length > 1 ? [makeButtons()] : []
            });

            if (chunks.length > 1) {
                const collector = reply.createMessageComponentCollector({ componentType: ComponentType.Button, time: 60000 });

                collector.on('collect', async btn => {
                    if (btn.user.id !== interaction.user.id) return btn.reply({ content: 'Not for you.', ephemeral: true });

                    if (btn.customId === 'next' && current < chunks.length - 1) current++;
                    if (btn.customId === 'prev' && current > 0) current--;

                    await btn.update({
                        embeds: [makeEmbed(current)],
                        components: [makeButtons()]
                    });
                });
            }

        } catch (err) {
            console.error(err);
            await browser.close();
            return interaction.editReply('Something broke during scrape.');
        }
    }
};
