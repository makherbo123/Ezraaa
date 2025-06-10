const { SlashCommandBuilder } = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('ask')
    .setDescription('Ask Ezra a question')
    .addStringOption(option =>
      option.setName('prompt').setDescription('Your question').setRequired(true)
    ),

  async execute(interaction) {
    const prompt = interaction.options.getString('prompt');
    await interaction.deferReply();

    const systemMessage = `
You are Ezra, a scribe who ONLY answers questions about textual criticism, Christian writings, manuscripts, datings, church literature, and church history.
Answer directly without explaining or reasoning.
If asked anything else, say 'I'm only a scribe, I can't answer that.'
`;

    const fullPrompt = `${systemMessage}\nUser: ${prompt}\nAssistant:`;

    const response = await fetch('http://localhost:11434/api/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'deepseek-r1:7b',
        prompt: fullPrompt,
        stream: false
      })
    });

    const data = await response.json();
    console.log('API response:', data);

    let cleanResponse = (data.response || data.text || '').replace(/<think>[\s\S]*?<\/think>/gi, '').trim();

    await interaction.editReply(cleanResponse || "No response from Ezra");
  }
};
