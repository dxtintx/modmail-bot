const {
    Client,
    IntentsBitField,
    Events,
    REST,
    Routes,
    SlashCommandBuilder,
} = require("discord.js");
const client = new Client({
    intents: [
        IntentsBitField.Flags.DirectMessages,
        IntentsBitField.Flags.MessageContent,
    ],
});
const dotenv = require("dotenv").config();
const { TOKEN, CLIENT_ID } = process.env;

const rest = new REST({ version: "10" }).setToken(TOKEN);

const commands = [
    new SlashCommandBuilder().setName("mails").setDescription("Get all mails"),
];

if (!TOKEN || !CLIENT_ID) {
    throw new Error(
        "Token or Client ID is not defined. Please follow to .env file and enter it."
    );
}

try {
    console.log("Started refreshing application (/) commands.");

    await rest.put(Routes.applicationCommands(CLIENT_ID), { body: commands });

    console.log("Successfully reloaded application (/) commands.");
} catch (error) {
    console.error(error);
}

client.login(TOKEN);

client.on(Events.ClientReady, () => {
    console.log("Modmail is active");
});

client.on(Events.InteractionCreate, (interaction) => {
    switch (interaction.commandName) {
        default:
            console.log(interaction.commandName);
    }
});
