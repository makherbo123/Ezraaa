require('dotenv').config();
const { REST } = require('@discordjs/rest');
const { Routes, Client, Events, GatewayIntentBits, Partials } = require('discord.js');
const fs = require('fs');
const path = require('path');
const { ActivityType } = require('discord.js');

const client = new Client({ 
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMessageReactions,
  ],
  partials: [Partials.Message, Partials.Channel, Partials.Reaction],
});

client.commands = new Map();

const commandFiles = fs.readdirSync(path.join(__dirname, 'commands')).filter(file => file.endsWith('.js'));

const commands = [];

for (const file of commandFiles) {
    const command = require(`./commands/${file}`);
    if ('data' in command && 'execute' in command) {
        client.commands.set(command.data.name, command);
        commands.push(command.data.toJSON());
    } else {
        console.log(`WARNING: The command at ${file} is missing 'data' or 'execute'.`);
    }
}

const deployCommands = async () => {
    const rest = new REST().setToken(process.env.BOT_TOKEN);
    try {
        await rest.put(
            Routes.applicationCommands(process.env.CLIENT_ID),
            { body: commands },
        );
        console.log('Commands deployed!');
    } catch (error) {
        console.error(error);
    }
};

client.on(Events.ClientReady, () => {
    client.user.setActivity('Reading Church Fathers', { type: ActivityType.Playing });
    console.log(`${client.user.tag} is online!`);
});

client.on(Events.InteractionCreate, async interaction => {
    if (interaction.isChatInputCommand()) {
        const command = client.commands.get(interaction.commandName);

        if (!command) return;

        try {
            await command.execute(interaction);
        } catch (error) {
            console.error(error);
            if (interaction.replied || interaction.deferred) {
                await interaction.followUp({ content: 'Error executing command!', ephemeral: true });
            } else {
                await interaction.reply({ content: 'Error executing command!', ephemeral: true });
            }
        }
    } else if (interaction.isStringSelectMenu()) {

        const command = client.commands.get('fathers'); 
        if (command && command.handleSelect) {
            try {
                await command.handleSelect(interaction);
            } catch (error) {
                console.error(error);
            }
        }
    }
});



// Handle reaction paging for /fathers command
client.on('messageReactionAdd', async (reaction, user) => {
    
    if (user.bot) return;

    if (reaction.partial) {
        try {
            await reaction.fetch();
        } catch {
            return;
        }
    }

    const command = client.commands.get('fathers');
    if (command && command.handleReaction) {
        try {
            await command.handleReaction(reaction, user);
        } catch (error) {
            console.error(error);
        }
    }
});

deployCommands();
client.login(process.env.BOT_TOKEN);
