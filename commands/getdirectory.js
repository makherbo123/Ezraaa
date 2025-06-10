const {
    SlashCommandBuilder,
    EmbedBuilder
} = require('discord.js');
const puppeteer = require('puppeteer');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('getdirectory')
        .setDescription('Get list of writings/links under a given name')
        .addStringOption(option =>
            option.setName('name')
                .setDescription('The bold group (strong text)')
                .setRequired(true)
        ),

    async execute(interaction) {
        const nameArg = interaction.options.getString('name').toLowerCase();

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
                return interaction.editReply(`No group found with the name "${nameArg}"`);
            }

            await browser.close();

            if (matchedGroup.links.length === 0) {
                return interaction.editReply(`No writings/links found under "${matchedGroup.strongText}"`);
            }

            const embed = new EmbedBuilder()
                .setTitle(`Writings under ${matchedGroup.strongText}`)
                .setColor(0x4682B4);

          
            let description = '';
            for (const link of matchedGroup.links) {
                description += `[${link.text}](${link.href})\n`;
            }

       
            embed.setDescription(description.length > 4000 ? description.slice(0, 4000) + '...' : description);

            await interaction.editReply({ embeds: [embed] });

        } catch (err) {
            console.error(err);
            await browser.close();
            await interaction.editReply('Error fetching directory.');
        }
    }
};
